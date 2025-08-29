const Fuse = require('fuse.js');
const natural = require('natural');
const Topic = require('../models/topic');
const Discussion = require('../models/discussion');
const Comment = require('../models/comment');

// Configure Fuse.js for fuzzy search
const fuseOptions = {
  threshold: 0.3,
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'description', weight: 0.5 },
    { name: 'title', weight: 0.8 },
    { name: 'content', weight: 0.6 },
    { name: 'tags', weight: 0.4 }
  ]
};

// Tokenizer for keyword extraction
const tokenizer = new natural.WordTokenizer();

// Search function
const search = async (query, type = 'all', options = {}) => {
  const { limit = 20, page = 1, sortBy = 'relevance' } = options;
  const skip = (page - 1) * limit;

  try {
    let results = [];

    // MongoDB text search
    const textSearchResults = await performTextSearch(query, type, limit * 2);
    
    // Fuzzy search with Fuse.js
    const fuzzySearchResults = await performFuzzySearch(query, type, limit * 2);
    
    // Keyword-based search
    const keywordResults = await performKeywordSearch(query, type, limit * 2);

    // Combine and rank results
    results = combineAndRankResults(textSearchResults, fuzzySearchResults, keywordResults, query);
    
    // Apply pagination
    results = results.slice(skip, skip + limit);

    return {
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total: results.length,
        hasMore: results.length === limit
      }
    };

  } catch (error) {
    console.error('Search error:', error);
    return {
      success: false,
      message: 'Search failed',
      error: error.message
    };
  }
};

// MongoDB text search
const performTextSearch = async (query, type, limit) => {
  const searchQuery = { $text: { $search: query } };
  const sort = { score: { $meta: 'textScore' } };

  let results = [];

  if (type === 'all' || type === 'topics') {
    const topics = await Topic.find(searchQuery, { score: { $meta: 'textScore' } })
      .sort(sort)
      .limit(limit)
      .populate('createdBy', 'username displayName');
    
    results.push(...topics.map(topic => ({
      ...topic.toObject(),
      type: 'topic',
      searchScore: topic.score
    })));
  }

  if (type === 'all' || type === 'discussions') {
    const discussions = await Discussion.find(searchQuery, { score: { $meta: 'textScore' } })
      .sort(sort)
      .limit(limit)
      .populate('author', 'username displayName')
      .populate('topic', 'name');
    
    results.push(...discussions.map(discussion => ({
      ...discussion.toObject(),
      type: 'discussion',
      searchScore: discussion.score
    })));
  }

  if (type === 'all' || type === 'comments') {
    const comments = await Comment.find(searchQuery, { score: { $meta: 'textScore' } })
      .sort(sort)
      .limit(limit)
      .populate('author', 'username displayName')
      .populate('discussion', 'title')
      .populate('topic', 'name');
    
    results.push(...comments.map(comment => ({
      ...comment.toObject(),
      type: 'comment',
      searchScore: comment.score
    })));
  }

  return results;
};

// Fuzzy search with Fuse.js
const performFuzzySearch = async (query, type, limit) => {
  let results = [];

  if (type === 'all' || type === 'topics') {
    const topics = await Topic.find().populate('createdBy', 'username displayName');
    const fuse = new Fuse(topics, fuseOptions);
    const topicResults = fuse.search(query).slice(0, limit);
    
    results.push(...topicResults.map(result => ({
      ...result.item.toObject(),
      type: 'topic',
      fuzzyScore: result.score
    })));
  }

  if (type === 'all' || type === 'discussions') {
    const discussions = await Discussion.find()
      .populate('author', 'username displayName')
      .populate('topic', 'name');
    const fuse = new Fuse(discussions, fuseOptions);
    const discussionResults = fuse.search(query).slice(0, limit);
    
    results.push(...discussionResults.map(result => ({
      ...result.item.toObject(),
      type: 'discussion',
      fuzzyScore: result.score
    })));
  }

  if (type === 'all' || type === 'comments') {
    const comments = await Comment.find()
      .populate('author', 'username displayName')
      .populate('discussion', 'title');
    const fuse = new Fuse(comments, fuseOptions);
    const commentResults = fuse.search(query).slice(0, limit);
    
    results.push(...commentResults.map(result => ({
      ...result.item.toObject(),
      type: 'comment',
      fuzzyScore: result.score
    })));
  }

  return results;
};

// Keyword-based search
const performKeywordSearch = async (query, type, limit) => {
  const keywords = tokenizer.tokenize(query.toLowerCase());
  const keywordRegex = keywords.map(keyword => new RegExp(keyword, 'i'));
  
  let results = [];

  if (type === 'all' || type === 'topics') {
    const topics = await Topic.find({
      $or: [
        { name: { $in: keywordRegex } },
        { description: { $in: keywordRegex } }
      ]
    }).populate('createdBy', 'username displayName');
    
    results.push(...topics.map(topic => ({
      ...topic.toObject(),
      type: 'topic',
      keywordMatches: countKeywordMatches(topic, keywords)
    })));
  }

  if (type === 'all' || type === 'discussions') {
    const discussions = await Discussion.find({
      $or: [
        { title: { $in: keywordRegex } },
        { content: { $in: keywordRegex } },
        { tags: { $in: keywordRegex } }
      ]
    }).populate('author', 'username displayName')
      .populate('topic', 'name');
    
    results.push(...discussions.map(discussion => ({
      ...discussion.toObject(),
      type: 'discussion',
      keywordMatches: countKeywordMatches(discussion, keywords)
    })));
  }

  if (type === 'all' || type === 'comments') {
    const comments = await Comment.find({
      content: { $in: keywordRegex }
    }).populate('author', 'username displayName')
      .populate('discussion', 'title');
    
    results.push(...comments.map(comment => ({
      ...comment.toObject(),
      type: 'comment',
      keywordMatches: countKeywordMatches(comment, keywords)
    })));
  }

  return results;
};

// Count keyword matches in an object
const countKeywordMatches = (obj, keywords) => {
  const text = JSON.stringify(obj).toLowerCase();
  return keywords.filter(keyword => text.includes(keyword)).length;
};

// Combine and rank search results
const combineAndRankResults = (textResults, fuzzyResults, keywordResults, query) => {
  const allResults = [...textResults, ...fuzzyResults, ...keywordResults];
  const resultMap = new Map();

  // Combine results by ID and calculate composite score
  allResults.forEach(result => {
    const id = result._id.toString();
    const type = result.type;
    const key = `${type}-${id}`;

    if (!resultMap.has(key)) {
      resultMap.set(key, {
        ...result,
        compositeScore: 0
      });
    }

    const existing = resultMap.get(key);
    
    // Calculate composite score
    let score = 0;
    if (result.searchScore) score += (1 - result.searchScore) * 0.4; // MongoDB text search
    if (result.fuzzyScore) score += (1 - result.fuzzyScore) * 0.3; // Fuzzy search
    if (result.keywordMatches) score += result.keywordMatches * 0.3; // Keyword matches
    
    existing.compositeScore = Math.max(existing.compositeScore, score);
  });

  // Convert to array and sort by composite score
  const rankedResults = Array.from(resultMap.values())
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return rankedResults;
};

// Advanced search with filters
const advancedSearch = async (query, filters = {}, options = {}) => {
  const { category, author, dateRange, tags } = filters;
  
  let searchQuery = { $text: { $search: query } };
  
  // Add filters
  if (category) {
    searchQuery.category = category;
  }
  
  if (author) {
    searchQuery.createdBy = author;
  }
  
  if (dateRange) {
    searchQuery.createdAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }
  
  if (tags && tags.length > 0) {
    searchQuery.tags = { $in: tags };
  }

  try {
    const results = await Discussion.find(searchQuery, { score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } })
      .populate('author', 'username displayName')
      .populate('topic', 'name')
      .limit(options.limit || 20);

    return {
      success: true,
      data: results,
      total: results.length
    };
  } catch (error) {
    return {
      success: false,
      message: 'Advanced search failed',
      error: error.message
    };
  }
};

module.exports = {
  search,
  advancedSearch,
  performTextSearch,
  performFuzzySearch,
  performKeywordSearch
}; 