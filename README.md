# Discussion Forum API

A comprehensive RESTful API for a discussion forum system similar to Slack threads, organized by topics/classes.

## Features

- **Topics/Classes Management** - Create and manage discussion topics
- **Discussion Posts** - Create, read, update, and delete discussions
- **Threaded Comments** - Support for nested comments and thread replies
- **Like System** - Like/unlike discussions and comments
- **Advanced Search** - Multi-modal search with fuzzy matching
- **User Authentication** - JWT-based authentication
- **Real-time Statistics** - Track views, likes, comments

## Tech Stack

- Node.js, Express.js
- MongoDB with Mongoose
- JWT Authentication
- Advanced search with Fuse.js
- Input validation with Joi

## Installation

1. Install dependencies: `npm install`
2. Copy `env.example` to `.env` and configure
3. Start MongoDB
4. Run: `npm run dev`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile

### Topics
- `GET /api/topics` - Get all topics
- `POST /api/topics` - Create topic
- `PUT /api/topics/:id` - Update topic

### Discussions
- `GET /api/discussions` - Get all discussions
- `POST /api/discussions` - Create discussion
- `GET /api/discussions/topic/:topicId` - Get by topic

### Comments
- `GET /api/comments/discussion/:discussionId` - Get comments
- `POST /api/comments` - Create comment
- `GET /api/comments/:id/thread-tree` - Get thread tree

### Search
- `GET /api/search` - Basic search
- `POST /api/search/advanced` - Advanced search

## Usage

Start the server: `npm run dev`
API Documentation: `http://localhost:3000/api` 