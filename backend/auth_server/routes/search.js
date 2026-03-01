const express = require('express');
const User = require('../models/User');
const Prediction = require('../models/Prediction');
const { verifyToken, loadUser, requireDoctorOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(verifyToken, loadUser);

// @route   GET /api/search/users
// @desc    Search users by name, email, username, or phone
// @access  Private
router.get('/users', async (req, res) => {
  try {
    const { q: query, role, limit = 10 } = req.query;
    const currentUser = req.userDoc;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // Build search query
    let searchQuery = {
      isActive: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    };

    // Role-based filtering
    if (role) {
      searchQuery.role = role;
    }

    // Permission checks
    if (currentUser.role === 'patient') {
      // Patients can only search for doctors and admins
      searchQuery.role = { $in: ['doctor', 'admin'] };
    }

    const users = await User.find(searchQuery)
      .select('name email username phone role specialization hospital createdAt')
      .limit(parseInt(limit))
      .sort({ name: 1 });

    res.json({ users });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// @route   GET /api/search/patients
// @desc    Search patients (Doctor/Admin only)
// @access  Private (Doctor/Admin)
router.get('/patients', requireDoctorOrAdmin, async (req, res) => {
  try {
    const { q: query, limit = 10, includeStats = false } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const searchQuery = {
      role: 'patient',
      isActive: true,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
        { phone: { $regex: query, $options: 'i' } }
      ]
    };

    let patients = await User.find(searchQuery)
      .select('name email phone age gender medicalInfo diabeticFootHistory createdAt')
      .limit(parseInt(limit))
      .sort({ name: 1 });

    // Include prediction statistics if requested
    if (includeStats === 'true') {
      const patientIds = patients.map(p => p._id);
      
      const predictionStats = await Prediction.aggregate([
        {
          $match: {
            userId: { $in: patientIds },
            isArchived: false
          }
        },
        {
          $group: {
            _id: '$userId',
            totalPredictions: { $sum: 1 },
            criticalPredictions: { $sum: { $cond: ['$isCritical', 1, 0] } },
            unreviewedPredictions: { $sum: { $cond: [{ $eq: ['$isReviewed', false] }, 1, 0] } },
            lastPrediction: { $max: '$createdAt' }
          }
        }
      ]);

      // Attach stats to patients
      patients = patients.map(patient => {
        const stats = predictionStats.find(s => s._id.toString() === patient._id.toString());
        return {
          ...patient.toJSON(),
          predictionStats: stats || {
            totalPredictions: 0,
            criticalPredictions: 0,
            unreviewedPredictions: 0,
            lastPrediction: null
          }
        };
      });
    }

    res.json({ patients });

  } catch (error) {
    console.error('Search patients error:', error);
    res.status(500).json({ error: 'Failed to search patients' });
  }
});

// @route   GET /api/search/predictions
// @desc    Search predictions by patient name or prediction details
// @access  Private (Doctor/Admin)
router.get('/predictions', requireDoctorOrAdmin, async (req, res) => {
  try {
    const { 
      q: query, 
      limit = 20,
      grade,
      severity,
      critical,
      unreviewed
    } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    // First, find patients matching the query
    const matchingPatients = await User.find({
      role: 'patient',
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    }).select('_id');

    const patientIds = matchingPatients.map(p => p._id);

    // Build prediction search query
    let searchQuery = {
      isArchived: false,
      $or: [
        { userId: { $in: patientIds } }, // Match by patient
        { 'prediction.description': { $regex: query, $options: 'i' } }, // Match by description
        { 'scanContext.notes': { $regex: query, $options: 'i' } } // Match by notes
      ]
    };

    // Additional filters
    if (grade) {
      searchQuery['prediction.grade'] = grade;
    }

    if (severity) {
      searchQuery['prediction.severity'] = severity;
    }

    if (critical === 'true') {
      searchQuery.isCritical = true;
    }

    if (unreviewed === 'true') {
      searchQuery.isReviewed = false;
    }

    const predictions = await Prediction.find(searchQuery)
      .populate('userId', 'name email phone')
      .populate('doctorReview.doctorId', 'name specialization')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ predictions });

  } catch (error) {
    console.error('Search predictions error:', error);
    res.status(500).json({ error: 'Failed to search predictions' });
  }
});

// @route   GET /api/search/suggestions
// @desc    Get search suggestions based on partial query
// @access  Private
router.get('/suggestions', async (req, res) => {
  try {
    const { q: query, type = 'users' } = req.query;
    const currentUser = req.userDoc;

    if (!query || query.length < 1) {
      return res.json({ suggestions: [] });
    }

    let suggestions = [];

    if (type === 'users' || type === 'all') {
      let userQuery = {
        isActive: true,
        $or: [
          { name: { $regex: `^${query}`, $options: 'i' } },
          { email: { $regex: `^${query}`, $options: 'i' } },
          { username: { $regex: `^${query}`, $options: 'i' } }
        ]
      };

      // Role-based filtering
      if (currentUser.role === 'patient') {
        userQuery.role = { $in: ['doctor', 'admin'] };
      }

      const users = await User.find(userQuery)
        .select('name email username role')
        .limit(5)
        .sort({ name: 1 });

      suggestions.push(...users.map(user => ({
        type: 'user',
        id: user._id,
        text: user.name,
        subtext: user.email,
        role: user.role
      })));
    }

    if ((type === 'patients' || type === 'all') && ['doctor', 'admin'].includes(currentUser.role)) {
      const patients = await User.find({
        role: 'patient',
        isActive: true,
        name: { $regex: `^${query}`, $options: 'i' }
      })
      .select('name email phone')
      .limit(5)
      .sort({ name: 1 });

      suggestions.push(...patients.map(patient => ({
        type: 'patient',
        id: patient._id,
        text: patient.name,
        subtext: patient.email,
        role: 'patient'
      })));
    }

    res.json({ suggestions: suggestions.slice(0, 10) });

  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
  }
});

module.exports = router;
