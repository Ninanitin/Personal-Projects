const express = require('express');
const Like = require('../models/like');
const Discussion = require('../models/discussion');
const Comment = require('../models/comment');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Toggle like on discussion or comment
router.post('/toggle', auth, async (req, res) => {
  try {
    const { discussionId, commentId } = req.body;

    if (!discussionId && !commentId) {
      return res.status(400).json({
        success: false,
        message: 'Either discussionId or commentId is required'
      });
    }

    if (discussionId && commentId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot like both discussion and comment simultaneously'
      });
    }

    const likeQuery = {
      user: req.user._id
    };

    if (discussionId) {
      likeQuery.discussion = discussionId;
    } else {
      likeQuery.comment = commentId;
    }

    // Check if like already exists
    const existingLike = await Like.findOne(likeQuery);

    if (existingLike) {
      // Unlike
      await Like.findByIdAndDelete(existingLike._id);

      // Update like count
      if (discussionId) {
        const discussion = await Discussion.findById(discussionId);
        if (discussion) {
          discussion.likeCount = Math.max(0, discussion.likeCount - 1);
          await discussion.save();
        }
      } else {
        const comment = await Comment.findById(commentId);
        if (comment) {
          comment.likeCount = Math.max(0, comment.likeCount - 1);
          await comment.save();
        }
      }

      res.json({
        success: true,
        message: 'Like removed successfully',
        data: { liked: false }
      });
    } else {
      // Like
      const newLike = new Like({
        user: req.user._id,
        discussion: discussionId,
        comment: commentId
      });

      await newLike.save();

      // Update like count
      if (discussionId) {
        const discussion = await Discussion.findById(discussionId);
        if (discussion) {
          discussion.likeCount += 1;
          await discussion.save();
        }
      } else {
        const comment = await Comment.findById(commentId);
        if (comment) {
          comment.likeCount += 1;
          await comment.save();
        }
      }

      res.json({
        success: true,
        message: 'Liked successfully',
        data: { liked: true }
      });
    }

  } catch (error) {
    console.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: error.message
    });
  }
});

// Get like status for current user
router.get('/status', auth, async (req, res) => {
  try {
    const { discussionId, commentId } = req.query;

    if (!discussionId && !commentId) {
      return res.status(400).json({
        success: false,
        message: 'Either discussionId or commentId is required'
      });
    }

    const likeQuery = {
      user: req.user._id
    };

    if (discussionId) {
      likeQuery.discussion = discussionId;
    } else {
      likeQuery.comment = commentId;
    }

    const like = await Like.findOne(likeQuery);

    res.json({
      success: true,
      data: { liked: !!like }
    });

  } catch (error) {
    console.error('Get like status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get like status',
      error: error.message
    });
  }
});

module.exports = router; 