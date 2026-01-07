const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Post = require('../models/Post');
const { authenticateToken, optionalAuth, createRateLimit } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for follow/unfollow operations
const followRateLimit = createRateLimit(60 * 60 * 1000, 100, 'Too many follow/unfollow requests');

// @route   GET /api/users/search
// @desc    Search users by username, full name, or gym name
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const searchQuery = q.trim();
    
    const users = await User.find({
      $or: [
        { username: { $regex: searchQuery, $options: 'i' } },
        { fullName: { $regex: searchQuery, $options: 'i' } },
        { gymName: { $regex: searchQuery, $options: 'i' } }
      ]
    })
    .select('username fullName profilePicture bio gymName location isVerified followerCount postCount')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ followerCount: -1, username: 1 });

    const usersWithCounts = users.map(user => ({
      ...user.toObject(),
      followerCount: user.followers.length,
      postCount: user.posts.length
    }));

    res.json({
      users: usersWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: users.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// @route   GET /api/users/:username
// @desc    Get user profile by username
// @access  Public (but better with auth)
router.get('/:username', optionalAuth, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .populate('posts', null, null, { sort: { createdAt: -1 } })
      .select('-password -email -likedPosts -savedPosts');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userObj = user.getPublicProfile();
    
    // Add interaction flags if current user is authenticated
    if (req.user) {
      userObj.isFollowing = user.followers.some(
        followerId => followerId.toString() === req.user._id.toString()
      );
      userObj.isFollowingMe = user.following.some(
        followingId => followingId.toString() === req.user._id.toString()
      );
      userObj.isMe = user._id.toString() === req.user._id.toString();
    }

    // Add counts
    userObj.followerCount = user.followers.length;
    userObj.followingCount = user.following.length;
    userObj.postCount = user.posts.length;

    res.json({ user: userObj });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

// @route   GET /api/users/:username/posts
// @desc    Get user's posts
// @access  Public (respects privacy settings)
router.get('/:username/posts', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy settings
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      // If private and not the owner, check if current user follows this user
      const isFollowing = req.user && user.followers.some(
        followerId => followerId.toString() === req.user._id.toString()
      );
      
      if (!isFollowing) {
        return res.status(403).json({ error: 'This account is private' });
      }
    }

    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username fullName profilePicture isVerified');

    // Add interaction flags if authenticated
    const postsWithFlags = req.user ? posts.map(post => {
      const postObj = post.toObject();
      postObj.isLiked = post.isLikedBy(req.user._id);
      postObj.isSaved = post.isSavedBy(req.user._id);
      return postObj;
    }) : posts;

    res.json({
      posts: postsWithFlags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: posts.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get user posts error:', error);
    res.status(500).json({ error: 'Failed to get user posts' });
  }
});

// @route   POST /api/users/:username/follow
// @desc    Follow/unfollow a user
// @access  Private
router.post('/:username/follow', authenticateToken, followRateLimit, async (req, res) => {
  try {
    const targetUser = await User.findOne({ username: req.params.username });
    
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Can't follow yourself
    if (targetUser._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const currentUser = await User.findById(req.user._id);
    const isFollowing = currentUser.following.includes(targetUser._id);

    if (isFollowing) {
      // Unfollow
      await User.findByIdAndUpdate(currentUser._id, {
        $pull: { following: targetUser._id }
      });
      
      await User.findByIdAndUpdate(targetUser._id, {
        $pull: { followers: currentUser._id }
      });

      res.json({
        message: `Unfollowed @${targetUser.username}`,
        isFollowing: false,
        followerCount: targetUser.followers.length - 1
      });
    } else {
      // Follow
      await User.findByIdAndUpdate(currentUser._id, {
        $push: { following: targetUser._id }
      });
      
      await User.findByIdAndUpdate(targetUser._id, {
        $push: { followers: currentUser._id }
      });

      res.json({
        message: `Now following @${targetUser.username}`,
        isFollowing: true,
        followerCount: targetUser.followers.length + 1
      });
    }

  } catch (error) {
    console.error('Follow user error:', error);
    res.status(500).json({ error: 'Failed to follow/unfollow user' });
  }
});

// @route   GET /api/users/:username/followers
// @desc    Get user's followers
// @access  Public (respects privacy)
router.get('/:username/followers', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      const isFollowing = req.user && user.followers.some(
        followerId => followerId.toString() === req.user._id.toString()
      );
      
      if (!isFollowing) {
        return res.status(403).json({ error: 'This account is private' });
      }
    }

    const followers = await User.find({ _id: { $in: user.followers } })
      .select('username fullName profilePicture bio isVerified')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ fullName: 1 });

    // Add follow status if current user is authenticated
    const followersWithFlags = req.user ? followers.map(follower => {
      const followerObj = follower.toObject();
      followerObj.isFollowing = req.user.following.includes(follower._id);
      followerObj.isMe = follower._id.toString() === req.user._id.toString();
      return followerObj;
    }) : followers;

    res.json({
      followers: followersWithFlags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: followers.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ error: 'Failed to get followers' });
  }
});

// @route   GET /api/users/:username/following
// @desc    Get users that this user follows
// @access  Public (respects privacy)
router.get('/:username/following', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const user = await User.findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy
    if (user.isPrivate && (!req.user || req.user._id.toString() !== user._id.toString())) {
      const isFollowing = req.user && user.followers.some(
        followerId => followerId.toString() === req.user._id.toString()
      );
      
      if (!isFollowing) {
        return res.status(403).json({ error: 'This account is private' });
      }
    }

    const following = await User.find({ _id: { $in: user.following } })
      .select('username fullName profilePicture bio isVerified')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ fullName: 1 });

    // Add follow status if current user is authenticated
    const followingWithFlags = req.user ? following.map(followedUser => {
      const followedUserObj = followedUser.toObject();
      followedUserObj.isFollowing = req.user.following.includes(followedUser._id);
      followedUserObj.isMe = followedUser._id.toString() === req.user._id.toString();
      return followedUserObj;
    }) : following;

    res.json({
      following: followingWithFlags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: following.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ error: 'Failed to get following' });
  }
});

// @route   GET /api/users/:username/saved
// @desc    Get user's saved posts (private - only for the user themselves)
// @access  Private
router.get('/:username/saved', authenticateToken, async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only the user themselves can see their saved posts
    if (user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { page = 1, limit = 12 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find({ _id: { $in: user.savedPosts } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'username fullName profilePicture isVerified');

    const postsWithFlags = posts.map(post => {
      const postObj = post.toObject();
      postObj.isLiked = post.isLikedBy(req.user._id);
      postObj.isSaved = true; // All posts here are saved
      return postObj;
    });

    res.json({
      posts: postsWithFlags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: posts.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get saved posts error:', error);
    res.status(500).json({ error: 'Failed to get saved posts' });
  }
});

// @route   GET /api/users/suggestions/follow
// @desc    Get suggested users to follow
// @access  Private
router.get('/suggestions/follow', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const currentUser = await User.findById(req.user._id);
    
    // Get users that current user is not following and exclude themselves
    const suggestions = await User.find({
      _id: { 
        $nin: [...currentUser.following, currentUser._id] 
      },
      isPrivate: false // Only suggest public accounts
    })
    .select('username fullName profilePicture bio gymName location isVerified')
    .limit(limit)
    .sort({ 
      followerCount: -1, // Sort by popularity
      createdAt: -1 
    });

    // Add additional info
    const suggestionsWithInfo = suggestions.map(user => ({
      ...user.toObject(),
      followerCount: user.followers.length,
      postCount: user.posts.length,
      mutualFollowersCount: 0 // TODO: Calculate mutual followers
    }));

    res.json({ suggestions: suggestionsWithInfo });

  } catch (error) {
    console.error('Get follow suggestions error:', error);
    res.status(500).json({ error: 'Failed to get follow suggestions' });
  }
});

// @route   GET /api/users/nearby
// @desc    Get users near a location
// @access  Public
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, maxDistance = 50000, limit = 20 } = req.query; // 50km default

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Find users based on their location (this is a simple text search)
    // In a real app, you'd want to store coordinates and use geospatial queries
    const users = await User.find({
      location: { $exists: true, $ne: '' },
      isPrivate: false
    })
    .select('username fullName profilePicture bio location gymName isVerified')
    .limit(parseInt(limit))
    .sort({ createdAt: -1 });

    const usersWithCounts = users.map(user => ({
      ...user.toObject(),
      followerCount: user.followers.length,
      postCount: user.posts.length
    }));

    res.json({ users: usersWithCounts });

  } catch (error) {
    console.error('Get nearby users error:', error);
    res.status(500).json({ error: 'Failed to get nearby users' });
  }
});

// @route   GET /api/users/gym/:gymName
// @desc    Get users from the same gym
// @access  Public
router.get('/gym/:gymName', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const gymName = decodeURIComponent(req.params.gymName);

    const users = await User.find({
      gymName: { $regex: gymName, $options: 'i' },
      isPrivate: false
    })
    .select('username fullName profilePicture bio gymName location isVerified')
    .skip(skip)
    .limit(parseInt(limit))
    .sort({ followerCount: -1, createdAt: -1 });

    const usersWithCounts = users.map(user => ({
      ...user.toObject(),
      followerCount: user.followers.length,
      postCount: user.posts.length
    }));

    res.json({
      gymName,
      users: usersWithCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: users.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get gym users error:', error);
    res.status(500).json({ error: 'Failed to get gym users' });
  }
});

module.exports = router;
