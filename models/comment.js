const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  discussion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  isThread: {
    type: Boolean,
    default: false
  },
  threadDepth: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient querying
commentSchema.index({ discussion: 1, createdAt: 1 });
commentSchema.index({ parentComment: 1, createdAt: 1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ likeCount: -1, createdAt: -1 });

// Text index for search
commentSchema.index({ content: 'text' });

// Pre-save middleware to calculate thread depth
commentSchema.pre('save', function(next) {
  if (this.parentComment) {
    this.isThread = true;
    // Calculate thread depth
    this.constructor.findById(this.parentComment)
      .then(parent => {
        if (parent) {
          this.threadDepth = parent.threadDepth + 1;
        }
        next();
      })
      .catch(next);
  } else {
    this.isThread = false;
    this.threadDepth = 0;
    next();
  }
});

// Increment reply count
commentSchema.methods.incrementReplyCount = function() {
  this.replyCount += 1;
  return this.save();
};

// Decrement reply count
commentSchema.methods.decrementReplyCount = function() {
  this.replyCount = Math.max(0, this.replyCount - 1);
  return this.save();
};

// Soft delete
commentSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Comment', commentSchema); 