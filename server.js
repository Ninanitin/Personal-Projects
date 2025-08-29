const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const topicRoutes = require('./routes/topics');
const discussionRoutes = require('./routes/discussions');
const commentRoutes = require('./routes/comments');
const likeRoutes = require('./routes/likes');
const searchRoutes = require('./routes/search');

const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Discussion Forum API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/search', searchRoutes);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Discussion Forum API',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/profile',
        updateProfile: 'PUT /api/auth/profile',
        changePassword: 'PUT /api/auth/change-password',
        refreshToken: 'POST /api/auth/refresh-token'
      },
      topics: {
        getAll: 'GET /api/topics',
        getById: 'GET /api/topics/:id',
        create: 'POST /api/topics',
        update: 'PUT /api/topics/:id',
        delete: 'DELETE /api/topics/:id',
        getByCategory: 'GET /api/topics/category/:category',
        getTrending: 'GET /api/topics/trending/active'
      },
      discussions: {
        getAll: 'GET /api/discussions',
        getById: 'GET /api/discussions/:id',
        create: 'POST /api/discussions',
        update: 'PUT /api/discussions/:id',
        delete: 'DELETE /api/discussions/:id',
        getByTopic: 'GET /api/discussions/topic/:topicId',
        getTrending: 'GET /api/discussions/trending/liked',
        getByAuthor: 'GET /api/discussions/author/:authorId'
      },
      comments: {
        getByDiscussion: 'GET /api/comments/discussion/:discussionId',
        getById: 'GET /api/comments/:id',
        create: 'POST /api/comments',
        update: 'PUT /api/comments/:id',
        delete: 'DELETE /api/comments/:id',
        getReplies: 'GET /api/comments/:id/replies',
        getByAuthor: 'GET /api/comments/author/:authorId',
        getThreadTree: 'GET /api/comments/:id/thread-tree'
      },
      likes: {
        toggle: 'POST /api/likes/toggle',
        getStatus: 'GET /api/likes/status'
      },
      search: {
        basic: 'GET /api/search?query=...',
        advanced: 'POST /api/search/advanced',
        suggestions: 'GET /api/search/suggestions',
        byTags: 'GET /api/search/tags',
        popular: 'GET /api/search/popular',
        stats: 'GET /api/search/stats'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors
    });
  }

  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }

  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 Discussion Forum API v1.0.0`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Documentation: http://localhost:${PORT}/api`);
});

module.exports = app; 