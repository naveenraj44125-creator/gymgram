const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true,
    maxlength: 500
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const mediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['image', 'video'],
    required: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String // For video thumbnails
  },
  originalName: String,
  size: Number,
  duration: Number, // For videos in seconds
  width: Number,
  height: Number,
  order: {
    type: Number,
    default: 0
  }
});

const workoutSchema = new mongoose.Schema({
  exercises: [{
    name: {
      type: String,
      required: true
    },
    sets: Number,
    reps: String, // Can be "10-12" or "10"
    weight: String, // Can include unit like "80kg" or "180lbs"
    duration: Number, // In seconds for cardio
    distance: String, // For running/cycling
    notes: String
  }],
  duration: Number, // Total workout duration in minutes
  caloriesBurned: Number,
  workoutType: {
    type: String,
    enum: ['strength', 'cardio', 'flexibility', 'sports', 'other'],
    default: 'strength'
  }
});

const postSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caption: {
    type: String,
    maxlength: 2200,
    default: ''
  },
  media: [mediaSchema],
  workout: workoutSchema,
  tags: [{
    type: String,
    maxlength: 50
  }],
  location: {
    name: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  saves: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  allowComments: {
    type: Boolean,
    default: true
  },
  hideLikes: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
postSchema.index({ user: 1, createdAt: -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ 'location.coordinates': '2dsphere' });

// Virtual for like count
postSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for comment count
postSchema.virtual('commentCount').get(function() {
  return this.comments.length;
});

// Virtual for save count
postSchema.virtual('saveCount').get(function() {
  return this.saves.length;
});

// Method to check if user liked the post
postSchema.methods.isLikedBy = function(userId) {
  return this.likes.some(like => like.toString() === userId.toString());
};

// Method to check if user saved the post
postSchema.methods.isSavedBy = function(userId) {
  return this.saves.some(save => save.toString() === userId.toString());
};

// Method to add hashtags from caption
postSchema.methods.extractHashtags = function() {
  const hashtags = this.caption.match(/#[a-zA-Z0-9_]+/g);
  if (hashtags) {
    this.tags = [...new Set([...this.tags, ...hashtags.map(tag => tag.substring(1).toLowerCase())])];
  }
};

// Pre-save middleware to extract hashtags
postSchema.pre('save', function(next) {
  this.extractHashtags();
  this.updatedAt = Date.now();
  next();
});

// Static method to get trending hashtags
postSchema.statics.getTrendingHashtags = async function(limit = 20) {
  const pipeline = [
    { $unwind: '$tags' },
    { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }, // Last 7 days
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: limit }
  ];
  
  return this.aggregate(pipeline);
};

// Static method to get posts by location
postSchema.statics.getPostsByLocation = async function(longitude, latitude, maxDistance = 5000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    }
  }).populate('user', 'username fullName profilePicture');
};

module.exports = mongoose.model('Post', postSchema);
