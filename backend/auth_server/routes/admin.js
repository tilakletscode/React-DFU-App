const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Prediction = require('../models/Prediction');
const mongoose = require('mongoose');
const { verifyToken, requireAdmin, loadUser } = require('../middleware/auth');
const { createUser: createFirebaseUser, setCustomClaims, deleteUser: deleteFirebaseUser } = require('../config/firebase');

const router = express.Router();

// Apply admin authentication to all routes
router.use(verifyToken, requireAdmin, loadUser);

// @route   GET /api/admin/users
// @desc    Get all users with filtering and pagination
// @access  Private (Admin)
router.get('/users', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role, 
      search, 
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    let query = {};
    
    if (role) {
      query.role = role;
    }
    
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get users
    const users = await User.find(query)
      .select('-passwordHash -resetPasswordOTP -resetPasswordExpires')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await User.countDocuments(query);

    // Get summary statistics
    const stats = await User.aggregate([
      { $group: {
        _id: '$role',
        count: { $sum: 1 },
        active: { $sum: { $cond: ['$isActive', 1, 0] } }
      }}
    ]);

    res.json({
      users,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      statistics: stats
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// @route   GET /api/admin/users/:id
// @desc    Get specific user details
// @access  Private (Admin)
router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId)
      .select('-passwordHash -resetPasswordOTP -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's prediction statistics
    const predictionStats = await Prediction.aggregate([
      { $match: { userId: user._id, isArchived: false } },
      { $group: {
        _id: null,
        totalPredictions: { $sum: 1 },
        criticalPredictions: { $sum: { $cond: ['$isCritical', 1, 0] } },
        averageConfidence: { $avg: '$prediction.confidence' }
      }}
    ]);

    // Get recent predictions
    const recentPredictions = await Prediction.find({
      userId: user._id,
      isArchived: false
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('prediction createdAt processingStatus imageUrl notes');

    // Get recent messages (if Message model exists)
    let recentMessages = [];
    try {
      const Message = mongoose.model('Message');
      recentMessages = await Message.find({
        $or: [
          { sender: user._id },
          { recipient: user._id }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('sender', 'firstName lastName role')
      .populate('recipient', 'firstName lastName role');
    } catch (error) {
      // Message model might not exist or be available, that's ok
      console.log('Messages not available:', error.message);
    }

    res.json({
      user,
      predictions: recentPredictions,
      messages: recentMessages,
      stats: predictionStats[0] || {
        totalPredictions: 0,
        criticalPredictions: 0,
        averageConfidence: 0
      }
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// @route   POST /api/admin/users
// @desc    Create a new user
// @access  Private (Admin)
router.post('/users', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').isMobilePhone().withMessage('Valid phone number is required'),
  body('username').trim().isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/).withMessage('Username must be 3-30 characters, letters/numbers/underscore only'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('age').isInt({ min: 1, max: 150 }).withMessage('Age must be 1-150'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Gender must be male, female, or other'),
  body('role').isIn(['patient', 'doctor', 'admin']).withMessage('Role must be patient, doctor, or admin'),
  body('specialization').optional().trim().isLength({ max: 100 }),
  body('licenseNumber').optional().trim().isLength({ max: 50 }),
  body('hospital').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const {
      name, email, phone, username, password, age, gender, role,
      specialization, licenseNumber, hospital
    } = req.body;

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username },
        { phone }
      ]
    });

    if (existingUser) {
      let field = 'Email';
      if (existingUser.username === username) field = 'Username';
      if (existingUser.phone === phone) field = 'Phone number';
      return res.status(400).json({ error: `${field} already exists` });
    }

    let firebaseUser = null;
    let user = null;

    try {
      // Create Firebase user (except for admin)
      if (role !== 'admin') {
        firebaseUser = await createFirebaseUser({
          email,
          password,
          displayName: name,
          emailVerified: true // Admin-created users are pre-verified
        });

        // Set custom claims
        await setCustomClaims(firebaseUser.uid, { role });
      }

      // Create user in MongoDB
      const userData = {
        name,
        email: email.toLowerCase(),
        phone,
        username,
        age,
        gender,
        role,
        emailVerified: true,
        phoneVerified: true,
        isActive: true
      };

      if (firebaseUser) {
        userData.firebaseUid = firebaseUser.uid;
      } else {
        // For admin users, generate a unique firebase UID placeholder
        userData.firebaseUid = `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        userData.passwordHash = password; // Will be hashed by pre-save middleware
      }

      // Add professional info for doctors
      if (role === 'doctor') {
        if (specialization) userData.specialization = specialization;
        if (licenseNumber) userData.licenseNumber = licenseNumber;
        if (hospital) userData.hospital = hospital;
      }

      user = new User(userData);
      await user.save();

      // Remove sensitive data from response
      const userResponse = user.toJSON();
      delete userResponse.passwordHash;

      res.status(201).json({
        message: 'User created successfully',
        user: userResponse
      });

    } catch (error) {
      // Cleanup on error
      if (firebaseUser) {
        try {
          await deleteFirebaseUser(firebaseUser.uid);
        } catch (cleanupError) {
          console.error('Firebase user cleanup error:', cleanupError);
        }
      }
      throw error;
    }

  } catch (error) {
    console.error('Create user error:', error);
    
    if (error.message.includes('email-already-in-use')) {
      return res.status(400).json({ error: 'Email already registered with Firebase' });
    }
    
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private (Admin)
router.put('/users/:id', [
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('phone').optional().isMobilePhone(),
  body('age').optional().isInt({ min: 1, max: 150 }),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('specialization').optional().trim().isLength({ max: 100 }),
  body('licenseNumber').optional().trim().isLength({ max: 50 }),
  body('hospital').optional().trim().isLength({ max: 200 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const userId = req.params.id;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.email;
    delete updates.username;
    delete updates.role;
    delete updates.firebaseUid;
    delete updates.passwordHash;

    const user = await User.findByIdAndUpdate(
      userId,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).select('-passwordHash -resetPasswordOTP -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated successfully',
      user
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// @route   PATCH /api/admin/users/:id/status
// @desc    Activate/Deactivate user
// @access  Private (Admin)
router.patch('/users/:id/status', [
  body('isActive').isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const userId = req.params.id;
    const { isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { isActive, updatedAt: new Date() },
      { new: true }
    ).select('-passwordHash -resetPasswordOTP -resetPasswordExpires');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      user
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (soft delete by deactivation)
// @access  Private (Admin)
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Soft delete by deactivation
    user.isActive = false;
    user.updatedAt = new Date();
    await user.save();

    // Archive user's predictions
    await Prediction.updateMany(
      { userId: user._id },
      { isArchived: true }
    );

    res.json({ message: 'User deactivated successfully' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', async (req, res) => {
  try {
    // User statistics
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$isActive', 1, 0] } }
        }
      }
    ]);

    // Prediction statistics
    const predictionStats = await Prediction.aggregate([
      {
        $match: { isArchived: false }
      },
      {
        $group: {
          _id: null,
          totalPredictions: { $sum: 1 },
          criticalPredictions: { $sum: { $cond: ['$isCritical', 1, 0] } },
          unreviewedPredictions: { $sum: { $cond: [{ $eq: ['$isReviewed', false] }, 1, 0] } }
        }
      }
    ]);

    // Recent activity
    const recentUsers = await User.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email role createdAt');

    const recentPredictions = await Prediction.find({ isArchived: false })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('userId', 'name email')
      .select('prediction createdAt processingStatus');

    // Grade distribution
    const gradeDistribution = await Prediction.aggregate([
      {
        $match: { isArchived: false }
      },
      {
        $group: {
          _id: '$prediction.grade',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.json({
      userStatistics: userStats,
      predictionStatistics: predictionStats[0] || {
        totalPredictions: 0,
        criticalPredictions: 0,
        unreviewedPredictions: 0
      },
      gradeDistribution,
      recentActivity: {
        recentUsers,
        recentPredictions
      }
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// @route   GET /api/admin/doctor-messages
// @desc    Get messages between doctors and admins
// @access  Private (Admin)
router.get('/doctor-messages', async (req, res) => {
  try {
    const admin = req.userDoc;
    const { page = 1, limit = 20, doctorId } = req.query;

    // Build query for messages between doctors and admins
    let query = {
      $or: [
        { sender: admin._id, 'recipient.role': 'doctor' },
        { 'sender.role': 'doctor', recipient: admin._id }
      ]
    };

    if (doctorId) {
      query = {
        $or: [
          { sender: admin._id, recipient: doctorId },
          { sender: doctorId, recipient: admin._id }
        ]
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Try to get Message model
    let messages = [];
    let total = 0;
    
    try {
      const Message = mongoose.model('Message');
      
      messages = await Message.find(query)
        .populate('sender', 'firstName lastName role email')
        .populate('recipient', 'firstName lastName role email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      total = await Message.countDocuments(query);
    } catch (error) {
      console.log('Message model not available:', error.message);
      // Return empty result if Message model doesn't exist
      return res.json({
        messages: [],
        pagination: {
          current: parseInt(page),
          pages: 0,
          total: 0,
          limit: parseInt(limit)
        }
      });
    }

    res.json({
      messages,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get doctor messages error:', error);
    res.status(500).json({ error: 'Failed to fetch doctor messages' });
  }
});

// @route   GET /api/admin/unread-messages-count
// @desc    Get count of unread messages for admin
// @access  Private (Admin)
router.get('/unread-messages-count', async (req, res) => {
  try {
    const admin = req.userDoc;
    
    let unreadCount = 0;
    
    try {
      const Message = mongoose.model('Message');
      unreadCount = await Message.countDocuments({
        recipient: admin._id,
        isRead: false
      });
    } catch (error) {
      console.log('Message model not available:', error.message);
    }

    res.json({ unreadCount });

  } catch (error) {
    console.error('Get unread messages count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread messages count' });
  }
});

module.exports = router;
