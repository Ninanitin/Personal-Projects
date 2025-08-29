const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Validation schemas
const schemas = {
  // User validation
  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    displayName: Joi.string().min(1).max(50).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  updateProfile: Joi.object({
    displayName: Joi.string().min(1).max(50),
    bio: Joi.string().max(200),
    avatar: Joi.string().uri()
  }),

  // Topic validation
  createTopic: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().min(1).max(500).required(),
    category: Joi.string().valid('academic', 'professional', 'personal', 'other')
  }),

  updateTopic: Joi.object({
    name: Joi.string().min(1).max(100),
    description: Joi.string().min(1).max(500),
    category: Joi.string().valid('academic', 'professional', 'personal', 'other'),
    isActive: Joi.boolean()
  }),

  // Discussion validation
  createDiscussion: Joi.object({
    title: Joi.string().min(1).max(200).required(),
    content: Joi.string().min(1).max(5000).required(),
    topic: Joi.string().required(),
    tags: Joi.array().items(Joi.string().max(20))
  }),

  updateDiscussion: Joi.object({
    title: Joi.string().min(1).max(200),
    content: Joi.string().min(1).max(5000),
    tags: Joi.array().items(Joi.string().max(20)),
    isPinned: Joi.boolean(),
    isLocked: Joi.boolean()
  }),

  // Comment validation
  createComment: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    discussion: Joi.string().required(),
    parentComment: Joi.string().optional()
  }),

  updateComment: Joi.object({
    content: Joi.string().min(1).max(2000).required()
  }),

  // Search validation
  search: Joi.object({
    query: Joi.string().min(1).max(100).required(),
    type: Joi.string().valid('topics', 'discussions', 'comments', 'all'),
    limit: Joi.number().integer().min(1).max(50).default(20),
    page: Joi.number().integer().min(1).default(1)
  }),

  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'likeCount', 'commentCount', 'viewCount'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

module.exports = { validate, schemas }; 