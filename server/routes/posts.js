const express = require('express');
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const User = require('../models/User');
const { authenticateToken, optionalAuth, createRateLimit } = require('../middleware/auth');
const { deleteFromS3 } = require('../config/s3');

const router = express.Router();

// Rate limiting for post creation
const createPostRateLimit = createRateLimit(60 * 60 * 1000, 20, 'Too many posts created. Please try again later.');

// Validation rules
const createPostValidation = [
  body('caption').optional().isLength({ max: 2200 }).withMessage('Caption must be less than 2200 characters'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('location.name').optional().isLength({ max: 100 }).withMessage('Location name must be less than 100 characters'),
  body('workout.exercises').optional().isArray().withMessage('Exercises must be an array'),
  body('workout.duration').optional().isInt({ min: 0 }).withMessage('Workout duration must be a positive number'),
  body('workout.caloriesBurned').optional().isInt({ min: 0 }).withMessage('Calories burned must be a positive number')
];

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', authenticateToken, createPostRateLimit, createPostValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { caption, media, workout, tags, location, isPrivate, allowComments, hideLikes } = req.body;

    // Create new post
    const post = new Post({
      user: req.user._id,
      caption: caption || '',
      media: media || [],
      workout,
      tags: tags || [],
      location,
      isPrivate: isPrivate || false,
      allowComments: allowComments !== false,
      hideLikes: hideLikes || false
    });

    await post.save();

    // Add post to user's posts array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { posts: post._id }
    });

    // Populate user info
    await post.populate('user', 'username fullName profilePicture isVerified');

    res.status(201).json({
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// @route   GET /api/posts/feed
// @desc    Get user's personalized feed
// @access  Private
router.get('/feed', authenticateToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get posts from users the current user follows + their own posts
    const user = await User.findById(req.user._id);
    const followingIds = [...user.following, req.user._id];

    const posts = await Post.find({
      $and: [
        { user: { $in: followingIds } },
        {
          $or: [
            { isPrivate: false },
            { user: req.user._id }
          ]
        }
      ]
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username fullName profilePicture isVerified')
    .populate('comments.user', 'username fullName profilePicture');

    // Add interaction flags for current user
    const postsWithFlags = posts.map(post => {
      const postObj = post.toObject();
      postObj.isLiked = post.isLikedBy(req.user._id);
      postObj.isSaved = post.isSavedBy(req.user._id);
      return postObj;
    });

    res.json({
      posts: postsWithFlags,
      pagination: {
        page,
        limit,
        hasMore: posts.length === limit
      }
    });

  } catch (error) {
    console.error('Get feed error:', error);
    res.status(500).json({ error: 'Failed to get feed' });
  }
});

// @route   GET /api/posts/explore
// @desc    Get explore/discover posts
// @access  Public (but better with auth)
router.get('/explore', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    let query = { isPrivate: false };

    // If user is authenticated, exclude posts from users they already follow
    if (req.user) {
      const user = await User.findById(req.user._id);
      const followingIds = [...user.following, req.user._id];
      query.user = { $nin: followingIds };
    }

    const posts = await Post.find(query)
      .sort({ 
        createdAt: -1,
        'likes.length': -1 // Also sort by popularity
      })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username fullName profilePicture isVerified');

    // Add interaction flags if user is authenticated
    const postsWithFlags = req.user ? posts.map(post => {
      const postObj = post.toObject();
      postObj.isLiked = post.isLikedBy(req.user._id);
      postObj.isSaved = post.isSavedBy(req.user._id);
      return postObj;
    }) : posts;

    res.json({
      posts: postsWithFlags,
      pagination: {
        page,
        limit,
        hasMore: posts.length === limit
      }
    });

  } catch (error) {
    console.error('Get explore posts error:', error);
    res.status(500).json({ error: 'Failed to get explore posts' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get single post
// @access  Public (but better with auth)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('user', 'username fullName profilePicture isVerified')
      .populate('comments.user', 'username fullName profilePicture');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user can view this post
    if (post.isPrivate && (!req.user || post.user._id.toString() !== req.user._id.toString())) {
      return res.status(403).json({ error: 'This post is private' });
    }

    const postObj = post.toObject();
    if (req.user) {
      postObj.isLiked = post.isLikedBy(req.user._id);
      postObj.isSaved = post.isSavedBy(req.user._id);
    }

    res.json({ post: postObj });

  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ error: 'Failed to get post' });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update post
// @access  Private (owner only)
router.put('/:id', authenticateToken, createPostValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { caption, workout, tags, location, isPrivate, allowComments, hideLikes } = req.body;

    // Update fields
    if (caption !== undefined) post.caption = caption;
    if (workout !== undefined) post.workout = workout;
    if (tags !== undefined) post.tags = tags;
    if (location !== undefined) post.location = location;
    if (isPrivate !== undefined) post.isPrivate = isPrivate;
    if (allowComments !== undefined) post.allowComments = allowComments;
    if (hideLikes !== undefined) post.hideLikes = hideLikes;

    await post.save();
    await post.populate('user', 'username fullName profilePicture isVerified');

    res.json({
      message: 'Post updated successfully',
      post
    });

  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ error: 'Failed to update post' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete post
// @access  Private (owner only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check if user owns the post
    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete media files from S3
    if (post.media && post.media.length > 0) {
      for (const mediaItem of post.media) {
        const fileKey = mediaItem.url.split('/').slice(-2).join('/'); // Extract key from URL
        await deleteFromS3(fileKey);
      }
    }

    // Remove post from user's posts array
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { posts: post._id }
    });

    // Remove from other users' liked/saved posts
    await User.updateMany(
      { $or: [{ likedPosts: post._id }, { savedPosts: post._id }] },
      { $pull: { likedPosts: post._id, savedPosts: post._id } }
    );

    await Post.findByIdAndDelete(req.params.id);

    res.json({ message: 'Post deleted successfully' });

  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/unlike a post
// @access  Private
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user._id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike the post
      post.likes = post.likes.filter(id => id.toString() !== userId.toString());
      await User.findByIdAndUpdate(userId, { $pull: { likedPosts: post._id } });
    } else {
      // Like the post
      post.likes.push(userId);
      await User.findByIdAndUpdate(userId, { $push: { likedPosts: post._id } });
    }

    await post.save();

    res.json({
      message: isLiked ? 'Post unliked' : 'Post liked',
      isLiked: !isLiked,
      likeCount: post.likes.length
    });

  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// @route   POST /api/posts/:id/save
// @desc    Save/unsave a post
// @access  Private
router.post('/:id/save', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const userId = req.user._id;
    const isSaved = post.saves.includes(userId);

    if (isSaved) {
      // Unsave the post
      post.saves = post.saves.filter(id => id.toString() !== userId.toString());
      await User.findByIdAndUpdate(userId, { $pull: { savedPosts: post._id } });
    } else {
      // Save the post
      post.saves.push(userId);
      await User.findByIdAndUpdate(userId, { $push: { savedPosts: post._id } });
    }

    await post.save();

    res.json({
      message: isSaved ? 'Post unsaved' : 'Post saved',
      isSaved: !isSaved,
      saveCount: post.saves.length
    });

  } catch (error) {
    console.error('Save post error:', error);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// @route   POST /api/posts/:id/comments
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comments', authenticateToken, [
  body('text').notEmpty().isLength({ max: 500 }).withMessage('Comment must be 1-500 characters')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    if (!post.allowComments) {
      return res.status(403).json({ error: 'Comments are disabled for this post' });
    }

    const { text } = req.body;

    const newComment = {
      user: req.user._id,
      text,
      likes: []
    };

    post.comments.push(newComment);
    await post.save();

    // Populate the new comment with user info
    await post.populate('comments.user', 'username fullName profilePicture');

    const addedComment = post.comments[post.comments.length - 1];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: addedComment
    });

  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// @route   DELETE /api/posts/:id/comments/:commentId
// @desc    Delete a comment
// @access  Private (comment owner or post owner)
router.delete('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.comments.id(req.params.commentId);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user owns the comment or the post
    if (comment.user.toString() !== req.user._id.toString() && 
        post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    post.comments.pull(req.params.commentId);
    await post.save();

    res.json({ message: 'Comment deleted successfully' });

  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// @route   GET /api/posts/hashtag/:tag
// @desc    Get posts by hashtag
// @access  Public
router.get('/hashtag/:tag', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const tag = req.params.tag.toLowerCase();

    const posts = await Post.find({
      tags: tag,
      isPrivate: false
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username fullName profilePicture isVerified');

    const postsWithFlags = req.user ? posts.map(post => {
      const postObj = post.toObject();
      postObj.isLiked = post.isLikedBy(req.user._id);
      postObj.isSaved = post.isSavedBy(req.user._id);
      return postObj;
    }) : posts;

    res.json({
      tag,
      posts: postsWithFlags,
      pagination: {
        page,
        limit,
        hasMore: posts.length === limit
      }
    });

  } catch (error) {
    console.error('Get posts by hashtag error:', error);
    res.status(500).json({ error: 'Failed to get posts by hashtag' });
  }
});

// @route   GET /api/posts/trending/hashtags
// @desc    Get trending hashtags
// @access  Public
router.get('/trending/hashtags', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const trending = await Post.getTrendingHashtags(limit);

    res.json({ hashtags: trending });

  } catch (error) {
    console.error('Get trending hashtags error:', error);
    res.status(500).json({ error: 'Failed to get trending hashtags' });
  }
});

module.exports = router;
