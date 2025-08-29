const mongoose = require('mongoose');

const discussionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: 20
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search functionality
discussionSchema.index({ title: 'text', content: 'text', tags: 'text' });

// Index for sorting and filtering
discussionSchema.index({ topic: 1, createdAt: -1 });
discussionSchema.index({ topic: 1, lastActivity: -1 });
discussionSchema.index({ likeCount: -1, createdAt: -1 });

// Update lastActivity when comments are added
discussionSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Increment comment count
discussionSchema.methods.incrementCommentCount = function() {
  this.commentCount += 1;
  return this.save();
};

// Decrement comment count
discussionSchema.methods.decrementCommentCount = function() {
  this.commentCount = Math.max(0, this.commentCount - 1);
  return this.save();
};

// Increment view count
discussionSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  return this.save();
};

module.exports = mongoose.model('Discussion', discussionSchema); 