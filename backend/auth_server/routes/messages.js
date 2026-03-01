const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const { verifyToken, loadUser, requireDoctorOrAdmin } = require('../middleware/auth');

const router = express.Router();

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  messageType: {
    type: String,
    enum: ['general', 'medical_advice', 'appointment', 'urgent', 'system'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  // For threading messages
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    default: function() { return this._id; }
  },
  parentMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  // Attachments (future feature)
  attachments: [{
    filename: String,
    url: String,
    type: String,
    size: Number
  }],
  // Metadata
  metadata: {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    predictionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prediction'
    }
  }
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, isRead: 1 });
messageSchema.index({ threadId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', [
  body('recipientId').isMongoId().withMessage('Valid recipient ID is required'),
  body('subject').trim().isLength({ min: 1, max: 200 }).withMessage('Subject must be 1-200 characters'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters'),
  body('messageType').optional().isIn(['general', 'medical_advice', 'appointment', 'urgent', 'system']),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent']),
  body('parentMessageId').optional().isMongoId()
], verifyToken, loadUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const sender = req.userDoc;
    const { 
      recipientId, 
      subject, 
      content, 
      messageType = 'general',
      priority = 'normal',
      parentMessageId,
      metadata = {}
    } = req.body;

    // Verify recipient exists and is active
    const User = require('../models/User');
    const recipient = await User.findById(recipientId);
    if (!recipient || !recipient.isActive) {
      return res.status(404).json({ error: 'Recipient not found or inactive' });
    }

    // Check permissions based on roles
    if (sender.role === 'patient') {
      // Patients can only send messages to doctors and admins
      if (!['doctor', 'admin'].includes(recipient.role)) {
        return res.status(403).json({ error: 'Patients can only message doctors and admins' });
      }
    }

    // Handle threading
    let threadId = null;
    if (parentMessageId) {
      const parentMessage = await Message.findById(parentMessageId);
      if (parentMessage) {
        threadId = parentMessage.threadId;
      }
    }

    // Create message
    const message = new Message({
      sender: sender._id,
      recipient: recipient._id,
      subject,
      content,
      messageType,
      priority,
      threadId,
      parentMessage: parentMessageId || null,
      metadata
    });

    await message.save();

    // Populate for response
    await message.populate('sender', 'name firstName lastName email role');
    await message.populate('recipient', 'name firstName lastName email role');

    res.status(201).json({
      message: 'Message sent successfully',
      messageData: message
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// @route   GET /api/messages
// @desc    Get messages for user
// @access  Private
router.get('/', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    console.log('Getting messages for user:', { userId: user._id, role: user.role });
    
    const { 
      type = 'received', 
      page = 1, 
      limit = 20,
      unreadOnly = false,
      threadId,
      search
    } = req.query;

    // Build query
    let query = {};
    
    if (type === 'sent') {
      query.sender = user._id;
    } else {
      query.recipient = user._id;
    }

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    if (threadId) {
      query.threadId = threadId;
    }

    if (search) {
      query.$or = [
        { subject: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get messages
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'name firstName lastName email role specialization')
      .populate('recipient', 'name firstName lastName email role specialization')
      .populate('parentMessage', 'subject createdAt');

    // Get total count
    const total = await Message.countDocuments(query);

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
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const messageId = req.params.id;

    console.log('Marking message as read:', { messageId, userId: user._id });

    // Validate messageId format
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID format' });
    }

    const message = await Message.findOne({
      _id: messageId,
      recipient: user._id
    });

    if (!message) {
      console.log('Message not found for user:', { messageId, userId: user._id });
      return res.status(404).json({ error: 'Message not found' });
    }

    if (!message.isRead) {
      message.isRead = true;
      message.readAt = new Date();
      await message.save();
      console.log('Message marked as read successfully');
    } else {
      console.log('Message already marked as read');
    }

    res.json({ message: 'Message marked as read' });

  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

// @route   GET /api/messages/unread-count
// @desc    Get unread message count
// @access  Private
router.get('/unread-count', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;

    const unreadCount = await Message.countDocuments({
      recipient: user._id,
      isRead: false
    });

    res.json({ unreadCount });

  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// @route   GET /api/messages/threads
// @desc    Get message threads
// @access  Private
router.get('/threads', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const { page = 1, limit = 10 } = req.query;

    // Get unique thread IDs for user
    const threads = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: user._id },
            { recipient: user._id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$threadId',
          lastMessage: { $first: '$$ROOT' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$recipient', user._id] },
                  { $eq: ['$isRead', false] }
                ]},
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      }
    ]);

    // Populate user data
    await Message.populate(threads, [
      { path: 'lastMessage.sender', select: 'name firstName lastName email role' },
      { path: 'lastMessage.recipient', select: 'name firstName lastName email role' }
    ]);

    res.json({ threads });

  } catch (error) {
    console.error('Get threads error:', error);
    res.status(500).json({ error: 'Failed to fetch message threads' });
  }
});

// @route   POST /api/messages/to-admins
// @desc    Send message to all admins (Doctor feature)
// @access  Private (Doctor)
router.post('/to-admins', [
  body('message').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters'),
  body('subject').optional().trim().isLength({ max: 200 }).withMessage('Subject must be max 200 characters'),
  body('priority').optional().isIn(['low', 'normal', 'high', 'urgent'])
], verifyToken, loadUser, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const sender = req.userDoc;
    
    // Only doctors can use this endpoint
    if (sender.role !== 'doctor') {
      return res.status(403).json({ error: 'Only doctors can send messages to admins' });
    }

    const { message: content, subject = 'Message from Doctor', priority = 'normal' } = req.body;

    // Get all active admins
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin', isActive: true });

    if (admins.length === 0) {
      return res.status(404).json({ error: 'No active admins found' });
    }

    // Create messages for all admins
    const messages = admins.map(admin => ({
      sender: sender._id,
      recipient: admin._id,
      subject,
      content,
      messageType: 'general',
      priority
    }));

    const createdMessages = await Message.insertMany(messages);

    res.json({
      message: `Message sent to ${admins.length} admin(s)`,
      recipientCount: admins.length,
      messageIds: createdMessages.map(msg => msg._id)
    });

  } catch (error) {
    console.error('Send to admins error:', error);
    res.status(500).json({ error: 'Failed to send message to admins' });
  }
});

// @route   DELETE /api/messages/:id
// @desc    Delete a message
// @access  Private
router.delete('/:id', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const messageId = req.params.id;

    const message = await Message.findOne({
      _id: messageId,
      $or: [
        { sender: user._id },
        { recipient: user._id }
      ]
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await Message.findByIdAndDelete(messageId);

    res.json({ message: 'Message deleted successfully' });

  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// @route   POST /api/messages/mark-read
// @desc    Mark messages as read
// @access  Private
router.post('/mark-read', verifyToken, loadUser, async (req, res) => {
  try {
    const user = req.userDoc;
    const { senderId, messageId } = req.body;

    console.log('Mark messages as read request:', { senderId, messageId, userId: user._id });

    let updateQuery = { recipient: user._id, isRead: false };
    
    if (messageId) {
      // Validate messageId format
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({ error: 'Invalid message ID format' });
      }
      updateQuery._id = messageId;
    } else if (senderId) {
      // Validate senderId format
      if (!mongoose.Types.ObjectId.isValid(senderId)) {
        return res.status(400).json({ error: 'Invalid sender ID format' });
      }
      updateQuery.sender = senderId;
    }

    const result = await Message.updateMany(
      updateQuery,
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    res.json({
      message: 'Messages marked as read',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Mark messages as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

module.exports = router;
