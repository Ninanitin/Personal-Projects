const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    required: true,
    enum: ['academic', 'professional', 'personal', 'other'],
    default: 'academic'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  discussionCount: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search functionality
topicSchema.index({ name: 'text', description: 'text' });

// Update lastActivity when discussions are added
topicSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

// Increment discussion count
topicSchema.methods.incrementDiscussionCount = function() {
  this.discussionCount += 1;
  return this.save();
};

module.exports = mongoose.model('Topic', topicSchema); 