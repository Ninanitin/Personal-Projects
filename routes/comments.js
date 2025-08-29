const express = require('express');
const Comment = require('../models/comment');
const Discussion = require('../models/discussion');
const { auth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');

const router = express.Router();

// Get all comments for a discussion with thread support
router.get('/discussion/:discussionId', async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { page = 1, limit = 50, sortBy = 'createdAt', sortOrder = 'asc' } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get main comments (not replies)
    const mainComments = await Comment.find({
      discussion: discussionId,
      parentComment: null,
      isDeleted: false
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar');

    // Get replies for each main comment
    const commentsWithReplies = await Promise.all(
      mainComments.map(async (comment) => {
        const replies = await Comment.find({
          discussion: discussionId,
          parentComment: comment._id,
          isDeleted: false
        })
          .sort({ createdAt: 1 })
          .populate('author', 'username displayName avatar');

        return {
          ...comment.toObject(),
          replies
        };
      })
    );

    const total = await Comment.countDocuments({
      discussion: discussionId,
      parentComment: null,
      isDeleted: false
    });

    res.json({
      success: true,
      data: commentsWithReplies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comments',
      error: error.message
    });
  }
});

// Get single comment by ID
router.get('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('author', 'username displayName avatar')
      .populate('discussion', 'title')
      .populate('parentComment', 'content');

    if (!comment || comment.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    res.json({
      success: true,
      data: comment
    });

  } catch (error) {
    console.error('Get comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comment',
      error: error.message
    });
  }
});

// Create new comment
router.post('/', auth, validate(schemas.createComment), async (req, res) => {
  try {
    const { content, discussion, parentComment } = req.body;

    // Verify discussion exists and is not locked
    const discussionDoc = await Discussion.findById(discussion);
    if (!discussionDoc) {
      return res.status(400).json({
        success: false,
        message: 'Discussion not found'
      });
    }

    if (discussionDoc.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'Discussion is locked'
      });
    }

    // If this is a reply, verify parent comment exists
    if (parentComment) {
      const parentCommentDoc = await Comment.findById(parentComment);
      if (!parentCommentDoc || parentCommentDoc.isDeleted) {
        return res.status(400).json({
          success: false,
          message: 'Parent comment not found'
        });
      }
    }

    const comment = new Comment({
      content,
      discussion,
      author: req.user._id,
      parentComment: parentComment || null
    });

    await comment.save();

    // Update discussion stats
    await discussionDoc.incrementCommentCount();
    await discussionDoc.updateLastActivity();

    // Update parent comment reply count if this is a reply
    if (parentComment) {
      const parentCommentDoc = await Comment.findById(parentComment);
      if (parentCommentDoc) {
        await parentCommentDoc.incrementReplyCount();
      }
    }

    // Update user stats
    await req.user.incrementCommentCount();

    await comment.populate('author', 'username displayName avatar');
    await comment.populate('discussion', 'title');
    if (parentComment) {
      await comment.populate('parentComment', 'content');
    }

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: comment
    });

  } catch (error) {
    console.error('Create comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create comment',
      error: error.message
    });
  }
});

// Update comment
router.put('/:id', auth, validate(schemas.updateComment), async (req, res) => {
  try {
    const { content } = req.body;
    const commentId = req.params.id;

    const comment = await Comment.findById(commentId);
    if (!comment || comment.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check permissions
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this comment'
      });
    }

    // Update comment
    comment.content = content;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await comment.populate('author', 'username displayName avatar');
    await comment.populate('discussion', 'title');
    if (comment.parentComment) {
      await comment.populate('parentComment', 'content');
    }

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: comment
    });

  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update comment',
      error: error.message
    });
  }
});

// Delete comment (soft delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    
    if (!comment || comment.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    // Check permissions
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this comment'
      });
    }

    // Soft delete
    await comment.softDelete();

    // Update discussion comment count
    const discussion = await Discussion.findById(comment.discussion);
    if (discussion) {
      await discussion.decrementCommentCount();
    }

    // Update parent comment reply count if this is a reply
    if (comment.parentComment) {
      const parentComment = await Comment.findById(comment.parentComment);
      if (parentComment) {
        await parentComment.decrementReplyCount();
      }
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message
    });
  }
});

// Get thread replies for a specific comment
router.get('/:id/replies', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'asc' } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const replies = await Comment.find({
      parentComment: id,
      isDeleted: false
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar');

    const total = await Comment.countDocuments({
      parentComment: id,
      isDeleted: false
    });

    res.json({
      success: true,
      data: replies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get replies error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get replies',
      error: error.message
    });
  }
});

// Get comments by author
router.get('/author/:authorId', async (req, res) => {
  try {
    const { authorId } = req.params;
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const skip = (page - 1) * limit;
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const comments = await Comment.find({
      author: authorId,
      isDeleted: false
    })
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username displayName avatar')
      .populate('discussion', 'title')
      .populate('parentComment', 'content');

    const total = await Comment.countDocuments({
      author: authorId,
      isDeleted: false
    });

    res.json({
      success: true,
      data: comments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get comments by author error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get comments by author',
      error: error.message
    });
  }
});

// Get thread tree for a comment (all nested replies)
router.get('/:id/thread-tree', async (req, res) => {
  try {
    const { id } = req.params;

    const getThreadTree = async (commentId, depth = 0) => {
      if (depth > 10) return null; // Prevent infinite recursion

      const comment = await Comment.findById(commentId)
        .populate('author', 'username displayName avatar');

      if (!comment || comment.isDeleted) return null;

      const replies = await Comment.find({
        parentComment: commentId,
        isDeleted: false
      })
        .sort({ createdAt: 1 })
        .populate('author', 'username displayName avatar');

      const replyTrees = await Promise.all(
        replies.map(reply => getThreadTree(reply._id, depth + 1))
      );

      return {
        ...comment.toObject(),
        replies: replyTrees.filter(Boolean)
      };
    };

    const threadTree = await getThreadTree(id);

    if (!threadTree) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }

    res.json({
      success: true,
      data: threadTree
    });

  } catch (error) {
    console.error('Get thread tree error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get thread tree',
      error: error.message
    });
  }
});

module.exports = router; 