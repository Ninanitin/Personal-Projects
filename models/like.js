const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  discussion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion'
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure either discussion or comment is provided, but not both
likeSchema.pre('save', function(next) {
  if (!this.discussion && !this.comment) {
    return next(new Error('Like must be associated with either a discussion or comment'));
  }
  if (this.discussion && this.comment) {
    return next(new Error('Like cannot be associated with both discussion and comment'));
  }
  next();
});

// Compound index to prevent duplicate likes
likeSchema.index({ user: 1, discussion: 1 }, { unique: true, sparse: true });
likeSchema.index({ user: 1, comment: 1 }, { unique: true, sparse: true });

// Index for efficient querying
likeSchema.index({ discussion: 1, createdAt: -1 });
likeSchema.index({ comment: 1, createdAt: -1 });
likeSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Like', likeSchema); 