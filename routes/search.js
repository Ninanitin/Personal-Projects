const express = require('express');
const { search, advancedSearch } = require('../utils/search');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Basic search
router.get('/', validate(schemas.search), async (req, res) => {
  try {
    const { query, type, limit, page } = req.query;

    const searchResults = await search(query, type, {
      limit: parseInt(limit),
      page: parseInt(page)
    });

    res.json(searchResults);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// Advanced search with filters
router.post('/advanced', async (req, res) => {
  try {
    const { query, filters, options } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchResults = await advancedSearch(query, filters, options);

    res.json(searchResults);

  } catch (error) {
    console.error('Advanced search error:', error);
    res.status(500).json({
      success: false,
      message: 'Advanced search failed',
      error: error.message
    });
  }
});

// Search suggestions/autocomplete
router.get('/suggestions', async (req, res) => {
  try {
    const { query, type = 'all', limit = 5 } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    // Get search results for suggestions
    const searchResults = await search(query, type, {
      limit: parseInt(limit),
      page: 1
    });

    // Extract suggestions from results
    const suggestions = searchResults.data.map(item => {
      if (item.type === 'topic') {
        return {
          type: 'topic',
          id: item._id,
          text: item.name,
          description: item.description
        };
      } else if (item.type === 'discussion') {
        return {
          type: 'discussion',
          id: item._id,
          text: item.title,
          description: item.content.substring(0, 100) + '...'
        };
      } else if (item.type === 'comment') {
        return {
          type: 'comment',
          id: item._id,
          text: item.content.substring(0, 100) + '...',
          discussion: item.discussion?.title
        };
      }
    });

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error('Search suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get search suggestions',
      error: error.message
    });
  }
});

// Search by tags
router.get('/tags', async (req, res) => {
  try {
    const { tags, limit = 20, page = 1 } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        message: 'Tags parameter is required'
      });
    }

    const tagArray = tags.split(',');
    const skip = (page - 1) * limit;

    // Search discussions by tags
    const Discussion = require('../models/discussion');
    const discussions = await Discussion.find({
      tags: { $in: tagArray },
      isLocked: false
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar')
      .populate('topic', 'name category');

    const total = await Discussion.countDocuments({
      tags: { $in: tagArray },
      isLocked: false
    });

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
    console.error('Search by tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search by tags',
      error: error.message
    });
  }
});

// Popular search terms
router.get('/popular', async (req, res) => {
  try {
    const { limit = 10, timeRange = '7d' } = req.query;

    // This would typically come from a search analytics collection
    // For now, we'll return some sample popular terms
    const popularTerms = [
      'javascript',
      'react',
      'node.js',
      'mongodb',
      'api',
      'authentication',
      'database',
      'frontend',
      'backend',
      'deployment'
    ].slice(0, parseInt(limit));

    res.json({
      success: true,
      data: popularTerms
    });

  } catch (error) {
    console.error('Get popular search terms error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get popular search terms',
      error: error.message
    });
  }
});

// Search statistics
router.get('/stats', async (req, res) => {
  try {
    const Topic = require('../models/topic');
    const Discussion = require('../models/discussion');
    const Comment = require('../models/comment');

    const stats = {
      totalTopics: await Topic.countDocuments({ isActive: true }),
      totalDiscussions: await Discussion.countDocuments({ isLocked: false }),
      totalComments: await Comment.countDocuments({ isDeleted: false }),
      recentActivity: {
        topics: await Topic.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        discussions: await Discussion.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        comments: await Comment.countDocuments({
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      }
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get search stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get search statistics',
      error: error.message
    });
  }
});

module.exports = router; 