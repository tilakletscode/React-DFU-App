const express = require('express');
const { body, validationResult } = require('express-validator');
const axios = require('axios');

const Prediction = require('../models/Prediction');
const { verifyToken, loadUser, requireDoctorOrAdmin } = require('../middleware/auth');

const router = express.Router();

// ML Server URL
const ML_SERVER_URL = process.env.ML_SERVER_URL || 'http://localhost:5001';

// @route   POST /api/predictions
// @desc    Save a new prediction
// @access  Private (Patient)
router.post('/', [
  body('imagePath').optional().isString(), // Changed: imagePath is now optional since Firebase is disabled
  body('prediction').notEmpty().withMessage('Prediction data is required'),
  body('notes').optional().isString()
], verifyToken, loadUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const user = req.userDoc;
    const { imagePath, prediction: predictionData, notes, scanContext, imageMetadata } = req.body;

    // Since we're saving a prediction that was already processed by ML,
    // we don't need to call the ML server again. The prediction data comes from frontend.
    const processingTime = 0; // Already processed
    
    // Use imagePath as imageUrl (base64 data or local path)
    const imageUrl = imagePath || 'local://no-image';

    // Create prediction record with the data from frontend
    const prediction = new Prediction({
      userId: user._id,
      userFirebaseUid: user.firebaseUid,
      imageUrl,
      imageMetadata: imageMetadata || {},
      prediction: {
        class: predictionData.predicted_class,
        confidence: predictionData.confidence,
        grade: predictionData.predicted_class,
        description: predictionData.grade_info?.description || 'AI prediction result',
        recommendations: predictionData.grade_info?.recommendations || [],
        severity: predictionData.grade_info?.severity || 'low'
      },
      modelVersion: predictionData.model_info?.model_version || '1.0.0',
      modelType: predictionData.model_info?.model_type || 'mobilenetv3_ulcer_classification',
      scanContext: { notes: notes || '', ...scanContext },
      processingTime,
      processingStatus: 'completed'
    });

    await prediction.save();

    // Populate user data for response
    await prediction.populate('userId', 'name email');

    res.status(201).json({
      message: 'Prediction saved successfully',
      prediction: prediction
    });

  } catch (error) {
    console.error('Save prediction error:', error);
    res.status(500).json({ error: 'Failed to save prediction' });
  }
});

// @route   GET /api/predictions
// @desc    Get user's prediction history
// @access  Private
router.get('/', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const { page = 1, limit = 10, grade, severity } = req.query;

    // Build query
    let query = { userFirebaseUid: user.firebaseUid, isArchived: false };
    
    if (grade) {
      query['prediction.grade'] = grade;
    }
    
    if (severity) {
      query['prediction.severity'] = severity;
    }

    // Calculate skip value
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get predictions with pagination
    const predictions = await Prediction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('userId', 'name email')
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
    console.error('Get predictions error:', error);
    res.status(500).json({ error: 'Failed to fetch predictions' });
  }
});

// @route   GET /api/predictions/:id
// @desc    Get specific prediction
// @access  Private
router.get('/:id', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const predictionId = req.params.id;

    const prediction = await Prediction.findOne({
      _id: predictionId,
      $or: [
        { userFirebaseUid: user.firebaseUid }, // User's own prediction
        { 'doctorReview.doctorId': user._id } // Doctor who reviewed it
      ]
    })
    .populate('userId', 'name email phone age gender')
    .populate('doctorReview.doctorId', 'name specialization hospital');

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Check if user has permission to view
    if (user.role === 'patient' && prediction.userFirebaseUid !== user.firebaseUid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ prediction });

  } catch (error) {
    console.error('Get prediction error:', error);
    res.status(500).json({ error: 'Failed to fetch prediction' });
  }
});

// @route   DELETE /api/predictions/:id
// @desc    Delete/Archive a prediction
// @access  Private
router.delete('/:id', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const predictionId = req.params.id;

    const prediction = await Prediction.findOne({
      _id: predictionId,
      userFirebaseUid: user.firebaseUid
    });

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Archive instead of delete to maintain data integrity
    prediction.isArchived = true;
    await prediction.save();

    res.json({ message: 'Prediction deleted successfully' });

  } catch (error) {
    console.error('Delete prediction error:', error);
    res.status(500).json({ error: 'Failed to delete prediction' });
  }
});

// @route   POST /api/predictions/:id/review
// @desc    Add doctor review to prediction
// @access  Private (Doctor/Admin)
router.post('/:id/review', [
  body('notes').optional().isString(),
  body('recommendedActions').optional().isArray(),
  body('followUpRequired').optional().isBoolean(),
  body('followUpDate').optional().isISO8601()
], verifyToken, loadUser, requireDoctorOrAdmin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const user = req.userDoc;
    const predictionId = req.params.id;
    const reviewData = req.body;

    const prediction = await Prediction.findById(predictionId);

    if (!prediction) {
      return res.status(404).json({ error: 'Prediction not found' });
    }

    // Add doctor review
    await prediction.markAsReviewed(user._id, reviewData);

    // Populate for response
    await prediction.populate('userId', 'name email');
    await prediction.populate('doctorReview.doctorId', 'name specialization');

    res.json({
      message: 'Review added successfully',
      prediction
    });

  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({ error: 'Failed to add review' });
  }
});

// @route   GET /api/predictions/stats/overview
// @desc    Get prediction statistics
// @access  Private (Doctor/Admin)
router.get('/stats/overview', verifyToken, requireDoctorOrAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Get overall statistics
    const totalPredictions = await Prediction.countDocuments({
      ...dateFilter,
      isArchived: false
    });

    const criticalPredictions = await Prediction.countDocuments({
      ...dateFilter,
      isCritical: true,
      isArchived: false
    });

    const unreviewedPredictions = await Prediction.countDocuments({
      ...dateFilter,
      isReviewed: false,
      isArchived: false
    });

    // Get grade distribution
    const gradeStats = await Prediction.aggregate([
      {
        $match: {
          ...dateFilter,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$prediction.grade',
          count: { $sum: 1 },
          avgConfidence: { $avg: '$prediction.confidence' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get severity distribution
    const severityStats = await Prediction.aggregate([
      {
        $match: {
          ...dateFilter,
          isArchived: false
        }
      },
      {
        $group: {
          _id: '$prediction.severity',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      overview: {
        totalPredictions,
        criticalPredictions,
        unreviewedPredictions,
        reviewedPredictions: totalPredictions - unreviewedPredictions
      },
      gradeDistribution: gradeStats,
      severityDistribution: severityStats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// @route   GET /api/predictions/critical
// @desc    Get critical predictions requiring immediate attention
// @access  Private (Doctor/Admin)
router.get('/critical', verifyToken, requireDoctorOrAdmin, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const criticalPredictions = await Prediction.getCriticalPredictions({
      limit: parseInt(limit)
    });

    res.json({
      criticalPredictions,
      count: criticalPredictions.length
    });

  } catch (error) {
    console.error('Get critical predictions error:', error);
    res.status(500).json({ error: 'Failed to fetch critical predictions' });
  }
});

module.exports = router;
