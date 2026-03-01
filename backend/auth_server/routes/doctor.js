const express = require('express');
const { body, validationResult } = require('express-validator');

const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { verifyToken, requireDoctorOrAdmin, loadUser } = require('../middleware/auth');

const router = express.Router();

// Apply doctor/admin authentication to all routes
router.use(verifyToken, requireDoctorOrAdmin, loadUser);

// @route   GET /api/doctor/patients
// @desc    Get patients list with their data
// @access  Private (Doctor/Admin)
router.get('/patients', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      sortBy = 'createdAt',
      sortOrder = 'desc',
      hasRecentPredictions = false
    } = req.query;

    // Build query
    let query = { role: 'patient', isActive: true };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort configuration
    const sortConfig = {};
    sortConfig[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get patients
    let patients = await User.find(query)
      .select('-passwordHash -resetPasswordOTP -resetPasswordExpires')
      .sort(sortConfig)
      .skip(skip)
      .limit(parseInt(limit));

    // If filtering by recent predictions, get additional data
    if (hasRecentPredictions === 'true') {
      const patientIds = patients.map(p => p._id);
      const recentPredictions = await Prediction.aggregate([
        {
          $match: {
            userId: { $in: patientIds },
            isArchived: false,
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
          }
        },
        {
          $group: {
            _id: '$userId',
            count: { $sum: 1 },
            latestPrediction: { $max: '$createdAt' },
            criticalCount: { $sum: { $cond: ['$isCritical', 1, 0] } }
          }
        }
      ]);

      // Filter patients with recent predictions
      const patientsWithPredictions = recentPredictions.map(p => p._id.toString());
      patients = patients.filter(patient => 
        patientsWithPredictions.includes(patient._id.toString())
      );

      // Add prediction data to patients
      patients = patients.map(patient => {
        const predictionData = recentPredictions.find(p => 
          p._id.toString() === patient._id.toString()
        );
        return {
          ...patient.toJSON(),
          recentPredictions: predictionData || { count: 0, criticalCount: 0 }
        };
      });
    }

    // Get total count
    const total = await User.countDocuments(query);

    res.json({
      patients,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get patients error:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// @route   GET /api/doctor/patients/:id
// @desc    Get specific patient details with medical history
// @access  Private (Doctor/Admin)
router.get('/patients/:id', async (req, res) => {
  try {
    const patientId = req.params.id;

    // Get patient details
    const patient = await User.findOne({
      _id: patientId,
      role: 'patient'
    }).select('-passwordHash -resetPasswordOTP -resetPasswordExpires');

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Get patient's prediction history
    const predictions = await Prediction.find({
      userId: patientId,
      isArchived: false
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('prediction createdAt processingStatus imageUrl notes doctorReview')
    .populate('doctorReview.doctorId', 'name specialization');

    // Get prediction statistics
    const predictionStats = await Prediction.aggregate([
      { $match: { userId: patient._id, isArchived: false } },
      {
        $group: {
          _id: null,
          totalPredictions: { $sum: 1 },
          criticalPredictions: { $sum: { $cond: ['$isCritical', 1, 0] } },
          reviewedPredictions: { $sum: { $cond: ['$isReviewed', 1, 0] } },
          averageConfidence: { $avg: '$prediction.confidence' }
        }
      }
    ]);

    // Get grade distribution
    const gradeDistribution = await Prediction.aggregate([
      { $match: { userId: patient._id, isArchived: false } },
      {
        $group: {
          _id: '$prediction.grade',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      patient,
      predictions,
      statistics: predictionStats[0] || {
        totalPredictions: 0,
        criticalPredictions: 0,
        reviewedPredictions: 0,
        averageConfidence: 0
      },
      gradeDistribution
    });

  } catch (error) {
    console.error('Get patient details error:', error);
    res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// @route   GET /api/doctor/predictions
// @desc    Get all predictions for review
// @access  Private (Doctor/Admin)
router.get('/predictions', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      unreviewed = false,
      critical = false,
      grade,
      patientId,
      dateFrom,
      dateTo
    } = req.query;

    // Build query
    let query = { isArchived: false };

    if (unreviewed === 'true') {
      query.isReviewed = false;
    }

    if (critical === 'true') {
      query.isCritical = true;
    }

    if (grade) {
      query['prediction.grade'] = grade;
    }

    if (patientId) {
      query.userId = patientId;
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get predictions
    const predictions = await Prediction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email phone age gender')
      .populate('doctorReview.doctorId', 'name specialization');

    // Get total count
    const total = await Prediction.countDocuments(query);

    res.json({
      predictions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get predictions for review error:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// @route   POST /api/doctor/predictions/:id/review
// @desc    Add review to a prediction
// @access  Private (Doctor/Admin)
router.post('/predictions/:id/review', [
  body('notes').optional().trim().isLength({ max: 2000 }).withMessage('Notes must be max 2000 characters'),
  body('recommendedActions').optional().isArray().withMessage('Recommended actions must be an array'),
  body('followUpRequired').optional().isBoolean().withMessage('Follow up required must be boolean'),
  body('followUpDate').optional().isISO8601().withMessage('Follow up date must be valid date')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const doctor = req.userDoc;
    const predictionId = req.params.id;
    const reviewData = req.body;

    // Find prediction
    const prediction = await Prediction.findById(predictionId)
      .populate('userId', 'name email');

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Add review
    await prediction.markAsReviewed(doctor._id, reviewData);

    // Populate doctor info for response
    await prediction.populate('doctorReview.doctorId', 'name specialization');

    res.json({
      message: 'Review added successfully',
      prediction
    });

  } catch (error) {
    console.error('Add prediction review error:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// @route   GET /api/doctor/dashboard
// @desc    Get doctor dashboard statistics
// @access  Private (Doctor/Admin)
router.get('/dashboard', async (req, res) => {
  try {
    const doctor = req.userDoc;

    // Get overall statistics
    const totalPatients = await User.countDocuments({
      role: 'patient',
      isActive: true
    });

    const totalPredictions = await Prediction.countDocuments({
      isArchived: false
    });

    const criticalPredictions = await Prediction.countDocuments({
      isCritical: true,
      isArchived: false
    });

    const unreviewedPredictions = await Prediction.countDocuments({
      isReviewed: false,
      isArchived: false
    });

    // Get doctor's review statistics
    const doctorReviewStats = await Prediction.countDocuments({
      'doctorReview.doctorId': doctor._id
    });

    // Get recent critical predictions
    const recentCritical = await Prediction.find({
      isCritical: true,
      isArchived: false,
      isReviewed: false
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name email phone');

    // Get recent predictions needing review
    const needsReview = await Prediction.find({
      isReviewed: false,
      isArchived: false
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('userId', 'name email');

    // Get grade distribution for recent predictions
    const gradeDistribution = await Prediction.aggregate([
      {
        $match: {
          isArchived: false,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
        }
      },
      {
        $group: {
          _id: '$prediction.grade',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      overview: {
        totalPatients,
        totalPredictions,
        criticalPredictions,
        unreviewedPredictions,
        reviewedByDoctor: doctorReviewStats
      },
      recentCritical,
      needsReview,
      gradeDistribution
    });

  } catch (error) {
    console.error('Get doctor dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// @route   GET /api/doctor/search-patients
// @desc    Search patients by name, email, or phone
// @access  Private (Doctor/Admin)
router.get('/search-patients', async (req, res) => {
  try {
    const { q: query, limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const patients = await User.find({
      role: 'patient',
      isActive: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name email phone age gender createdAt')
    .limit(parseInt(limit))
    .sort({ name: 1 });

    res.json({ patients });

  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
});

// @route   GET /api/doctor/admin-messages
// @desc    Get messages between doctor and admins
// @access  Private (Doctor)
router.get('/admin-messages', async (req, res) => {
  try {
    const doctor = req.userDoc;
    const { page = 1, limit = 20, adminId } = req.query;

    // Build query for messages between doctor and admins
    let query = {
      $or: [
        { sender: doctor._id, 'recipient.role': 'admin' },
        { 'sender.role': 'admin', recipient: doctor._id }
      ]
    };

    if (adminId) {
      query = {
        $or: [
          { sender: doctor._id, recipient: adminId },
          { sender: adminId, recipient: doctor._id }
        ]
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Try to get Message model
    let messages = [];
    let total = 0;
    
    try {
      const Message = require('mongoose').model('Message');
      
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
    console.error('Get admin messages error:', error);
    res.status(500).json({ error: 'Failed to fetch admin messages' });
  }
});

// @route   GET /api/doctor/unread-messages-count
// @desc    Get count of unread messages for doctor
// @access  Private (Doctor)
router.get('/unread-messages-count', async (req, res) => {
  try {
    const doctor = req.userDoc;
    
    let unreadCount = 0;
    
    try {
      const Message = require('mongoose').model('Message');
      unreadCount = await Message.countDocuments({
        recipient: doctor._id,
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
