const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const { initializeFirebase } = require('./config/firebase');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const doctorRoutes = require('./routes/doctor');
const messageRoutes = require('./routes/messages');
const predictionRoutes = require('./routes/predictions');
const searchRoutes = require('./routes/search');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Firebase Admin
initializeFirebase();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com'] 
    : ['http://localhost:19006', 'http://localhost:3000', 'exp://localhost:19000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Healthcare ML Backend is running!', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV 
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/search', searchRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Healthcare ML Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/test`);
  console.log(`🌐 Network access: http://192.168.0.168:${PORT}/api/test`);
  console.log(`✅ Server is ready to accept connections`);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('🔄 Shutting down server gracefully...');
  server.close(() => {
    console.log('📴 HTTP server closed');
  });
});

process.on('SIGTERM', () => {
  console.log('🔄 Received SIGTERM, shutting down server gracefully...');
  server.close(() => {
    console.log('📴 HTTP server closed');
  });
});

// Seed admin users on startup
const seedAdminUsers = async () => {
  try {
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    
    // Check if admin already exists
    let adminUser = await User.findOne({ email: 'admin@mlauth.com' });
    if (!adminUser) {
      const hashedPassword = await bcrypt.hash('admin123', 12);
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
      console.log('✅ Admin user created: admin@mlauth.com / admin123');
    }

    // Check if doctor already exists
    let doctorUser = await User.findOne({ email: 'doctor@mlauth.com' });
    if (!doctorUser) {
      const hashedPassword = await bcrypt.hash('doctor123', 12);
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
      console.log('✅ Doctor user created: doctor@mlauth.com / doctor123');
    }
  } catch (error) {
    console.error('❌ Admin seeding error:', error.message);
  }
};

// Seed admin users after database connection
setTimeout(seedAdminUsers, 2000);

module.exports = app;


