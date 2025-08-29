// API Examples for Discussion Forum
// Run these examples to test the API endpoints

const BASE_URL = 'http://localhost:3000/api';
let authToken = '';

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
}

// Example 1: User Registration
async function registerUser() {
  console.log('🔐 Registering new user...');
  
  const userData = {
    username: 'john_doe',
    email: 'john@example.com',
    password: 'password123',
    displayName: 'John Doe'
  };

  try {
    const result = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    console.log('✅ User registered:', result.data.user);
    authToken = result.data.token;
    return result.data.user;
  } catch (error) {
    console.error('❌ Registration failed:', error.message);
  }
}

// Example 2: User Login
async function loginUser() {
  console.log('🔐 Logging in...');
  
  const loginData = {
    email: 'john@example.com',
    password: 'password123'
  };

  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(loginData)
    });

    console.log('✅ Login successful:', result.data.user);
    authToken = result.data.token;
    return result.data.user;
  } catch (error) {
    console.error('❌ Login failed:', error.message);
  }
}

// Example 3: Create a Topic
async function createTopic() {
  console.log('📚 Creating a new topic...');
  
  const topicData = {
    name: 'JavaScript Fundamentals',
    description: 'Discussion about JavaScript basics, ES6 features, and modern development practices',
    category: 'academic'
  };

  try {
    const result = await apiRequest('/topics', {
      method: 'POST',
      body: JSON.stringify(topicData)
    });

    console.log('✅ Topic created:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Topic creation failed:', error.message);
  }
}

// Example 4: Create a Discussion
async function createDiscussion(topicId) {
  console.log('💬 Creating a new discussion...');
  
  const discussionData = {
    title: 'Understanding Closures in JavaScript',
    content: 'I am learning JavaScript and having trouble understanding closures. Can someone explain how they work and provide some practical examples?',
    topic: topicId,
    tags: ['javascript', 'closures', 'help', 'learning']
  };

  try {
    const result = await apiRequest('/discussions', {
      method: 'POST',
      body: JSON.stringify(discussionData)
    });

    console.log('✅ Discussion created:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Discussion creation failed:', error.message);
  }
}

// Example 5: Add a Comment
async function addComment(discussionId) {
  console.log('💭 Adding a comment...');
  
  const commentData = {
    content: 'Great question! Closures are functions that have access to variables in their outer scope. Here\'s a simple example: function outer() { let x = 10; return function inner() { return x; }; }',
    discussion: discussionId
  };

  try {
    const result = await apiRequest('/comments', {
      method: 'POST',
      body: JSON.stringify(commentData)
    });

    console.log('✅ Comment added:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Comment creation failed:', error.message);
  }
}

// Example 6: Add a Thread Reply
async function addThreadReply(discussionId, parentCommentId) {
  console.log('🔄 Adding a thread reply...');
  
  const replyData = {
    content: 'To add to the previous explanation, closures are also useful for data privacy and creating factory functions.',
    discussion: discussionId,
    parentComment: parentCommentId
  };

  try {
    const result = await apiRequest('/comments', {
      method: 'POST',
      body: JSON.stringify(replyData)
    });

    console.log('✅ Thread reply added:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Thread reply failed:', error.message);
  }
}

// Example 7: Like a Discussion
async function likeDiscussion(discussionId) {
  console.log('👍 Liking discussion...');
  
  const likeData = {
    discussionId: discussionId
  };

  try {
    const result = await apiRequest('/likes/toggle', {
      method: 'POST',
      body: JSON.stringify(likeData)
    });

    console.log('✅ Like toggled:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Like failed:', error.message);
  }
}

// Example 8: Search Discussions
async function searchDiscussions() {
  console.log('🔍 Searching discussions...');
  
  try {
    const result = await apiRequest('/search?query=javascript&type=discussions&limit=5');
    console.log('✅ Search results:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Search failed:', error.message);
  }
}

// Example 9: Get Trending Discussions
async function getTrendingDiscussions() {
  console.log('🔥 Getting trending discussions...');
  
  try {
    const result = await apiRequest('/discussions/trending/liked?limit=5');
    console.log('✅ Trending discussions:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Trending fetch failed:', error.message);
  }
}

// Example 10: Get Thread Tree
async function getThreadTree(commentId) {
  console.log('🌳 Getting thread tree...');
  
  try {
    const result = await apiRequest(`/comments/${commentId}/thread-tree`);
    console.log('✅ Thread tree:', result.data);
    return result.data;
  } catch (error) {
    console.error('❌ Thread tree fetch failed:', error.message);
  }
}

// Run all examples
async function runExamples() {
  console.log('🚀 Starting API Examples...\n');

  try {
    // 1. Register and login
    await registerUser();
    if (!authToken) {
      await loginUser();
    }

    // 2. Create topic
    const topic = await createTopic();
    if (!topic) return;

    // 3. Create discussion
    const discussion = await createDiscussion(topic._id);
    if (!discussion) return;

    // 4. Add comment
    const comment = await addComment(discussion._id);
    if (!comment) return;

    // 5. Add thread reply
    await addThreadReply(discussion._id, comment._id);

    // 6. Like discussion
    await likeDiscussion(discussion._id);

    // 7. Search
    await searchDiscussions();

    // 8. Get trending
    await getTrendingDiscussions();

    // 9. Get thread tree
    await getThreadTree(comment._id);

    console.log('\n✅ All examples completed successfully!');

  } catch (error) {
    console.error('\n❌ Examples failed:', error);
  }
}

// Export functions for individual testing
module.exports = {
  registerUser,
  loginUser,
  createTopic,
  createDiscussion,
  addComment,
  addThreadReply,
  likeDiscussion,
  searchDiscussions,
  getTrendingDiscussions,
  getThreadTree,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
} 