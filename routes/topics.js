const express = require('express');
const Topic = require('../models/topic');
const { auth, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Get all topics with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      sortBy = 'lastActivity', 
      sortOrder = 'desc',
      search 
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isActive: true };

    // Add category filter
    if (category) {
      query.category = category;
    }

    // Add search filter
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const topics = await Topic.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username displayName avatar');

    // Get total count
    const total = await Topic.countDocuments(query);

    res.json({
      success: true,
      data: topics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get topics',
      error: error.message
    });
  }
});

// Get single topic by ID
router.get('/:id', async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id)
      .populate('createdBy', 'username displayName avatar');

    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    res.json({
      success: true,
      data: topic
    });

  } catch (error) {
    console.error('Get topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get topic',
      error: error.message
    });
  }
});

// Create new topic
router.post('/', auth, validate(schemas.createTopic), async (req, res) => {
  try {
    const { name, description, category } = req.body;

    // Check if topic with same name already exists
    const existingTopic = await Topic.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isActive: true
    });

    if (existingTopic) {
      return res.status(400).json({
        success: false,
        message: 'A topic with this name already exists'
      });
    }

    const topic = new Topic({
      name,
      description,
      category,
      createdBy: req.user._id
    });

    await topic.save();
    await topic.populate('createdBy', 'username displayName avatar');

    res.status(201).json({
      success: true,
      message: 'Topic created successfully',
      data: topic
    });

  } catch (error) {
    console.error('Create topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create topic',
      error: error.message
    });
  }
});

// Update topic
router.put('/:id', auth, validate(schemas.updateTopic), async (req, res) => {
  try {
    const { name, description, category, isActive } = req.body;
    const topicId = req.params.id;

    const topic = await Topic.findById(topicId);
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Check permissions (only creator or admin/moderator can update)
    if (topic.createdBy.toString() !== req.user._id.toString() && 
        !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this topic'
      });
    }

    // Check for name conflicts if name is being changed
    if (name && name !== topic.name) {
      const existingTopic = await Topic.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        isActive: true,
        _id: { $ne: topicId }
      });

      if (existingTopic) {
        return res.status(400).json({
          success: false,
          message: 'A topic with this name already exists'
        });
      }
    }

    // Update topic
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updatedTopic = await Topic.findByIdAndUpdate(
      topicId,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'username displayName avatar');

    res.json({
      success: true,
      message: 'Topic updated successfully',
      data: updatedTopic
    });

  } catch (error) {
    console.error('Update topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update topic',
      error: error.message
    });
  }
});

// Delete topic (soft delete)
router.delete('/:id', auth, requireRole(['admin', 'moderator']), async (req, res) => {
  try {
    const topic = await Topic.findById(req.params.id);
    
    if (!topic) {
      return res.status(404).json({
        success: false,
        message: 'Topic not found'
      });
    }

    // Soft delete
    topic.isActive = false;
    await topic.save();

    res.json({
      success: true,
      message: 'Topic deleted successfully'
    });

  } catch (error) {
    console.error('Delete topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete topic',
      error: error.message
    });
  }
});

// Get topics by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20, sortBy = 'lastActivity', sortOrder = 'desc' } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const topics = await Topic.find({ 
      category, 
      isActive: true 
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'username displayName avatar');

    const total = await Topic.countDocuments({ category, isActive: true });

    res.json({
      success: true,
      data: topics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get topics by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get topics by category',
      error: error.message
    });
  }
});

// Get trending topics (most active)
router.get('/trending/active', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topics = await Topic.find({ isActive: true })
      .sort({ discussionCount: -1, lastActivity: -1 })
      .limit(parseInt(limit))
      .populate('createdBy', 'username displayName avatar');

    res.json({
      success: true,
      data: topics
    });

  } catch (error) {
    console.error('Get trending topics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending topics',
      error: error.message
    });
  }
});

module.exports = router; 