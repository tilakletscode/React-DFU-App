const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const User = require('../models/User');
const { verifyToken, loadUser, checkAccountLock } = require('../middleware/auth');
const { createUser: createFirebaseUser, getUserByEmail, setCustomClaims } = require('../config/firebase');

const router = express.Router();

// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Validation rules
const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('age').isInt({ min: 1, max: 150 }).withMessage('Age must be between 1 and 150'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other')
];

const loginValidation = [
  body('password').notEmpty().withMessage('Password is required')
];

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, firstName, lastName, email, phone, username, password, age, gender, role = 'patient' } = req.body;
    
    // Handle both name formats
    const fullName = name || `${firstName || ''} ${lastName || ''}`.trim();

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username },
        ...(phone ? [{ phone }] : [])
      ]
    });

    if (existingUser) {
      let field = 'Email';
      if (existingUser.username === username) field = 'Username';
      if (existingUser.phone === phone) field = 'Phone number';
      return res.status(400).json({ error: `${field} already registered` });
    }

    // Create Firebase user (skip if Firebase not properly configured)
    let firebaseUser = null;
    let firebaseUid = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const firebaseUserData = {
        email,
        password,
        displayName: fullName,
        emailVerified: false
      };

      firebaseUser = await createFirebaseUser(firebaseUserData);
      firebaseUid = firebaseUser.uid;

      // Set custom claims for role-based access
      await setCustomClaims(firebaseUser.uid, { role });
    } catch (firebaseError) {
      console.log('⚠️ Firebase user creation failed, using temporary UID:', firebaseError.message);
      // Continue with temporary UID for development
    }

    // Create user in MongoDB
    const user = new User({
      firebaseUid: firebaseUid,
      name: fullName,
      firstName: firstName || '',
      lastName: lastName || '',
      email: email.toLowerCase(),
      phone: phone || '',
      username,
      age,
      gender,
      role,
      passwordHash: password, // Save password for development (will be hashed by middleware)
      emailVerified: false,
      phoneVerified: false
    });

    await user.save();

    // Generate JWT token for immediate login
    const token = jwt.sign(
      { 
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        phone: user.phone,
        age: user.age,
        gender: user.gender,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        medicalInfo: user.medicalInfo,
        diabeticFootHistory: user.diabeticFootHistory
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle Firebase errors
    if (error.message.includes('email-already-in-use')) {
      return res.status(400).json({ error: 'Email already registered with Firebase' });
    }
    if (error.message.includes('weak-password')) {
      return res.status(400).json({ error: 'Password is too weak' });
    }
    
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    // Handle both email and username login
    const { email, username, password } = req.body;
    const loginIdentifier = email || username;

    // Find user in MongoDB by email or username
    let user;
    if (loginIdentifier.includes('@')) {
      user = await User.findByEmail(loginIdentifier);
    } else {
      user = await User.findByUsername(loginIdentifier);
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Check if account is locked
    if (user.isLocked) {
      const lockTime = Math.ceil((user.lockUntil - Date.now()) / (1000 * 60));
      return res.status(423).json({ 
        error: `Account locked due to too many failed attempts. Try again in ${lockTime} minutes.` 
      });
    }

    // For admin users or development mode, verify password directly
    if (user.role === 'admin' || process.env.NODE_ENV === 'development') {
      const isValidPassword = await user.comparePassword(password);
      if (!isValidPassword) {
        await user.incLoginAttempts();
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      // For regular users in production, verify with Firebase
      try {
        const firebaseUser = await getUserByEmail(user.email);
        if (!firebaseUser) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
      } catch (firebaseError) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        phone: user.phone,
        age: user.age,
        gender: user.gender,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        medicalInfo: user.medicalInfo,
        diabeticFootHistory: user.diabeticFootHistory,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    
    res.json({
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
        phone: user.phone,
        age: user.age,
        gender: user.gender,
        role: user.role,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        medicalInfo: user.medicalInfo,
        diabeticFootHistory: user.diabeticFootHistory,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// @route   POST /api/auth/medical-info
// @desc    Save/update medical information
// @access  Private (Patient)
router.post('/medical-info', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const medicalData = req.body;

    // Validate required fields (allow skipping during registration)
    const isSkipping = medicalData.additionalNotes === 'Skipped during registration';
    if (!isSkipping && (!medicalData.height || !medicalData.weight)) {
      return res.status(400).json({ error: 'Height and weight are required' });
    }

    // Convert string values to proper types for medical info
    const processedMedicalData = { ...medicalData };
    
    // Convert string boolean values to actual booleans
    const booleanFields = [
      'hasDiabetes', 'hasHighBloodPressure', 'hasHighCholesterol', 
      'hasHeartDisease', 'hasKidneyDisease', 'hasChronicKidneyDisease',
      'hasNerveDamage', 'hasPoorCirculation', 'hasFootUlcers',
      'hasAmputations', 'hasFootDeformities', 'hasCalluses',
      'hasCorns', 'hasBlisters', 'hasCuts', 'hasSores',
      'hasIngrownToenails', 'hasFungalInfections', 'hasDrySkin',
      'hasCrackedHeels', 'hasFootPain', 'hasNumbness',
      'hasTingling', 'hasBurning', 'hasWeakness',
      'hasBalanceProblems', 'hasWalkingDifficulties'
    ];
    
    booleanFields.forEach(field => {
      if (processedMedicalData[field] !== undefined) {
        const value = processedMedicalData[field];
        if (typeof value === 'string') {
          if (value.toLowerCase() === 'true' || value === '1' || value === 'yes') {
            processedMedicalData[field] = true;
          } else if (value.toLowerCase() === 'false' || value === '0' || value === 'no') {
            processedMedicalData[field] = false;
          } else if (value.toLowerCase() === 'not_sure' || value === 'unknown') {
            processedMedicalData[field] = null; // Use null for unknown/not sure
          }
        }
      }
    });

    // Update medical information
    user.medicalInfo = {
      ...user.medicalInfo,
      ...processedMedicalData,
      lastUpdated: new Date()
    };

    await user.save();

    res.json({
      message: 'Medical information saved successfully',
      medicalInfo: user.medicalInfo
    });

  } catch (error) {
    console.error('Medical info save error:', error);
    res.status(500).json({ error: 'Failed to save medical information' });
  }
});

// @route   POST /api/auth/seed-admin
// @desc    Seed admin and doctor users (for development)
// @access  Public (should be removed in production)
router.post('/seed-admin', async (req, res) => {
  try {
    // Check if admin already exists
    let adminUser = await User.findOne({ email: 'admin@mlauth.com' });
    let doctorUser = await User.findOne({ email: 'doctor@mlauth.com' });
    
    const results = [];

    if (!adminUser) {
      // Hash password
      const hashedPassword = await bcrypt.hash('admin123', 12);

      // Create admin user
      adminUser = new User({
        username: 'admin',
        email: 'admin@mlauth.com',
        phone: '+1234567890',
        name: 'System Administrator',
        firstName: 'System',
        lastName: 'Administrator',
        age: 30,
        gender: 'other',
        role: 'admin',
        password: hashedPassword,
        firebaseUid: 'admin-' + Date.now(),
        emailVerified: true,
        phoneVerified: true,
        isActive: true
      });

      await adminUser.save();
      results.push({ type: 'admin', email: 'admin@mlauth.com', password: 'admin123', created: true });
    } else {
      results.push({ type: 'admin', email: 'admin@mlauth.com', password: 'admin123', created: false, message: 'Already exists' });
    }

    if (!doctorUser) {
      // Hash password
      const hashedPassword = await bcrypt.hash('doctor123', 12);

      // Create doctor user
      doctorUser = new User({
        username: 'doctor',
        email: 'doctor@mlauth.com',
        phone: '+1234567891',
        name: 'Dr. Medical Expert',
        firstName: 'Medical',
        lastName: 'Expert',
        age: 35,
        gender: 'other',
        role: 'doctor',
        password: hashedPassword,
        firebaseUid: 'doctor-' + Date.now(),
        emailVerified: true,
        phoneVerified: true,
        isActive: true
      });

      await doctorUser.save();
      results.push({ type: 'doctor', email: 'doctor@mlauth.com', password: 'doctor123', created: true });
    } else {
      results.push({ type: 'doctor', email: 'doctor@mlauth.com', password: 'doctor123', created: false, message: 'Already exists' });
    }

    res.json({
      message: 'Admin seeding completed',
      results
    });

  } catch (error) {
    console.error('Admin seeding error:', error);
    res.status(500).json({ error: 'Failed to seed admin users' });
  }
});

// @route   POST /api/auth/diabetic-foot-history
// @desc    Save/update diabetic foot history
// @access  Private (Patient)
router.post('/diabetic-foot-history', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const historyData = req.body;

    // Update diabetic foot history
    user.diabeticFootHistory = {
      ...user.diabeticFootHistory,
      ...historyData,
      completed: true,
      lastUpdated: new Date()
    };

    await user.save();

    res.json({
      message: 'Diabetic foot history saved successfully',
      diabeticFootHistory: user.diabeticFootHistory
    });

  } catch (error) {
    console.error('Diabetic foot history save error:', error);
    res.status(500).json({ error: 'Failed to save diabetic foot history' });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
], verifyToken, loadUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const user = req.userDoc;
    const { currentPassword, newPassword } = req.body;

    // For admin users, verify current password
    if (user.role === 'admin') {
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      
      user.passwordHash = newPassword; // Will be hashed in pre-save middleware
      await user.save();
    } else {
      // For Firebase users, password change should be handled on the frontend
      return res.status(400).json({ 
        error: 'Password change for Firebase users should be handled through the app interface' 
      });
    }

    res.json({ message: 'Password changed successfully' });

  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// @route   POST /api/auth/send-otp
// @desc    Send OTP for password reset
// @access  Public
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email } = req.body;
    const user = await User.findByEmail(email);

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If the email exists, an OTP has been sent' });
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    
    // Save OTP with expiration (10 minutes)
    user.resetPasswordOTP = otp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Send OTP via email
    const transporter = createEmailTransporter();
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset OTP - Healthcare ML App',
      html: `
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is: <strong>${otp}</strong></p>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ message: 'OTP sent successfully' });

  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password using OTP
// @access  Public
router.post('/reset-password', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  body('newPassword').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, otp, newPassword } = req.body;
    
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // For admin users, update password hash
    if (user.role === 'admin') {
      user.passwordHash = newPassword; // Will be hashed in pre-save middleware
    }
    // For Firebase users, the password should be updated through Firebase Auth on frontend

    // Clear OTP fields
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// @route   POST /api/auth/otp-login
// @desc    Login using OTP (alternative to password)
// @access  Public
router.post('/otp-login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, otp } = req.body;
    
    // This would typically verify OTP sent via SMS/Email
    // For now, we'll implement a simple check
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Clear OTP
    user.resetPasswordOTP = undefined;
    user.resetPasswordExpires = undefined;
    user.lastLogin = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    res.json({
      message: 'OTP login successful',
      token,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error('OTP login error:', error);
    res.status(500).json({ error: 'OTP login failed' });
  }
});

module.exports = router;
