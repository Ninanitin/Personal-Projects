const express = require('express');
const Discussion = require('../models/discussion');
const Topic = require('../models/topic');
const { auth, requireRole } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Get all discussions with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      topic, 
      author,
      sortBy = 'lastActivity', 
      sortOrder = 'desc',
      search,
      tags
    } = req.query;

    const skip = (page - 1) * limit;
    const query = { isLocked: false };

    // Add filters
    if (topic) query.topic = topic;
    if (author) query.author = author;
    if (tags) {
      const tagArray = tags.split(',');
      query.tags = { $in: tagArray };
    }
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const discussions = await Discussion.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    // Get total count
    const total = await Discussion.countDocuments(query);

    res.json({
      success: true,
      data: discussions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get discussions',
      error: error.message
    });
  }
});

// Get single discussion by ID
router.get('/:id', async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id)
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Increment view count
    await discussion.incrementViewCount();

    res.json({
      success: true,
      data: discussion
    });

  } catch (error) {
    console.error('Get discussion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get discussion',
      error: error.message
    });
  }
});

// Create new discussion
router.post('/', auth, validate(schemas.createDiscussion), async (req, res) => {
  try {
    const { title, content, topic, tags } = req.body;

    // Verify topic exists and is active
    const topicDoc = await Topic.findById(topic);
    if (!topicDoc || !topicDoc.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or inactive topic'
      });
    }

    const discussion = new Discussion({
      title,
      content,
      topic,
      author: req.user._id,
      tags: tags || []
    });

    await discussion.save();
    
    // Update topic stats
    await topicDoc.incrementDiscussionCount();
    await topicDoc.updateLastActivity();

    // Update user stats
    await req.user.incrementDiscussionCount();

    await discussion.populate('author', 'username displayName avatar');
    await discussion.populate('topic', 'name category');

    res.status(201).json({
      success: true,
      message: 'Discussion created successfully',
      data: discussion
    });

  } catch (error) {
    console.error('Create discussion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create discussion',
      error: error.message
    });
  }
});

// Update discussion
router.put('/:id', auth, validate(schemas.updateDiscussion), async (req, res) => {
  try {
    const { title, content, tags, isPinned, isLocked } = req.body;
    const discussionId = req.params.id;

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check permissions
    const canEdit = discussion.author.toString() === req.user._id.toString() || 
                   ['admin', 'moderator'].includes(req.user.role);
    
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this discussion'
      });
    }

    // Only admins/moderators can pin/lock discussions
    if ((isPinned !== undefined || isLocked !== undefined) && 
        !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only moderators can pin or lock discussions'
      });
    }

    // Update discussion
    const updateData = {};
    if (title) updateData.title = title;
    if (content) updateData.content = content;
    if (tags) updateData.tags = tags;
    if (isPinned !== undefined) updateData.isPinned = isPinned;
    if (isLocked !== undefined) updateData.isLocked = isLocked;

    const updatedDiscussion = await Discussion.findByIdAndUpdate(
      discussionId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    res.json({
      success: true,
      message: 'Discussion updated successfully',
      data: updatedDiscussion
    });

  } catch (error) {
    console.error('Update discussion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update discussion',
      error: error.message
    });
  }
});

// Delete discussion (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const discussion = await Discussion.findById(req.params.id);
    
    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    // Check permissions
    const canDelete = discussion.author.toString() === req.user._id.toString() || 
                     ['admin', 'moderator'].includes(req.user.role);
    
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this discussion'
      });
    }

    // Soft delete
    discussion.isDeleted = true;
    discussion.deletedAt = new Date();
    await discussion.save();

    res.json({
      success: true,
      message: 'Discussion deleted successfully'
    });

  } catch (error) {
    console.error('Delete discussion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete discussion',
      error: error.message
    });
  }
});

// Get discussions by topic
router.get('/topic/:topicId', async (req, res) => {
  try {
    const { topicId } = req.params;
    const { page = 1, limit = 20, sortBy = 'lastActivity', sortOrder = 'desc' } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const discussions = await Discussion.find({ 
      topic: topicId,
      isLocked: false
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    const total = await Discussion.countDocuments({ topic: topicId, isLocked: false });

    res.json({
      success: true,
      data: discussions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get discussions by topic error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get discussions by topic',
      error: error.message
    });
  }
});

// Get trending discussions (most liked)
router.get('/trending/liked', async (req, res) => {
  try {
    const { limit = 10, timeRange = '7d' } = req.query;

    let dateFilter = {};
    if (timeRange === '24h') {
      dateFilter = { createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } };
    } else if (timeRange === '7d') {
      dateFilter = { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } };
    } else if (timeRange === '30d') {
      dateFilter = { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } };
    }

    const discussions = await Discussion.find({
      ...dateFilter,
      isLocked: false
    })
      .sort({ likeCount: -1, commentCount: -1 })
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    res.json({
      success: true,
      data: discussions
    });

  } catch (error) {
    console.error('Get trending discussions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trending discussions',
      error: error.message
    });
  }
});

// Get discussions by author
router.get('/author/:authorId', async (req, res) => {
  try {
    const { authorId } = req.params;
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const discussions = await Discussion.find({ 
      author: authorId,
      isLocked: false
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    const total = await Discussion.countDocuments({ author: authorId, isLocked: false });

    res.json({
      success: true,
      data: discussions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get discussions by author error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get discussions by author',
      error: error.message
    });
  }
});

module.exports = router; 