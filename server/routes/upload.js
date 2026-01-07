const express = require('express');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { uploadPost, uploadProfile, checkS3Connection } = require('../config/s3');
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

const router = express.Router();

// Middleware to check S3 connection
router.use(async (req, res, next) => {
  const isConnected = await checkS3Connection();
  if (!isConnected) {
    return res.status(503).json({ error: 'S3 storage service unavailable' });
  }
  next();
});

// @route   POST /api/upload/post
// @desc    Upload media files for posts
// @access  Private
router.post('/post', authenticateToken, (req, res) => {
  uploadPost.array('media', 10)(req, res, async (error) => {
    if (error) {
      console.error('Upload error:', error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 100MB per file.' });
      }
      
      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files. Maximum is 10 files per upload.' });
      }
      
      if (error.message === 'Invalid file type. Only images and videos are allowed.') {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Upload failed' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    try {
      const processedFiles = [];

      for (const file of req.files) {
        const fileInfo = {
          type: file.mimetype.startsWith('image/') ? 'image' : 'video',
          url: file.location,
          originalName: file.originalname,
          size: file.size,
          order: processedFiles.length
        };

        // Process images - create thumbnails and get dimensions
        if (fileInfo.type === 'image') {
          try {
            const imageBuffer = Buffer.from(await fetch(file.location).then(res => res.arrayBuffer()));
            const metadata = await sharp(imageBuffer).metadata();
            
            fileInfo.width = metadata.width;
            fileInfo.height = metadata.height;

            // Create thumbnail if image is large
            if (metadata.width > 800 || metadata.height > 800) {
              const thumbnailBuffer = await sharp(imageBuffer)
                .resize(800, 800, { fit: 'inside', withoutEnlargement: false })
                .jpeg({ quality: 85 })
                .toBuffer();
              
              // In a real app, you'd upload this thumbnail to S3 as well
              // For now, we'll just use the original URL
              fileInfo.thumbnailUrl = file.location;
            }
          } catch (err) {
            console.error('Image processing error:', err);
            // Continue with original image if processing fails
          }
        }

        // Process videos - get duration and create thumbnail
        if (fileInfo.type === 'video') {
          try {
            // Get video metadata
            await new Promise((resolve, reject) => {
              ffmpeg(file.location)
                .ffprobe((err, metadata) => {
                  if (err) {
                    console.error('Video probe error:', err);
                    reject(err);
                  } else {
                    fileInfo.duration = metadata.format.duration;
                    if (metadata.streams[0]) {
                      fileInfo.width = metadata.streams[0].width;
                      fileInfo.height = metadata.streams[0].height;
                    }
                    resolve();
                  }
                });
            });

            // In a real app, you'd generate a thumbnail from the video
            // and upload it to S3. For now, we'll skip this step.
            fileInfo.thumbnailUrl = null;

          } catch (err) {
            console.error('Video processing error:', err);
            // Continue without video metadata if processing fails
          }
        }

        processedFiles.push(fileInfo);
      }

      res.json({
        message: 'Files uploaded successfully',
        files: processedFiles
      });

    } catch (error) {
      console.error('File processing error:', error);
      res.status(500).json({ error: 'Failed to process uploaded files' });
    }
  });
});

// @route   POST /api/upload/profile
// @desc    Upload profile picture
// @access  Private
router.post('/profile', authenticateToken, (req, res) => {
  uploadProfile.single('profilePicture')(req, res, async (error) => {
    if (error) {
      console.error('Profile upload error:', error);
      
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      
      if (error.message === 'Invalid file type. Only images are allowed for profile pictures.') {
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(500).json({ error: 'Upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Process profile picture - resize and optimize
      const imageUrl = req.file.location;
      let processedImageUrl = imageUrl;

      try {
        const imageBuffer = Buffer.from(await fetch(imageUrl).then(res => res.arrayBuffer()));
        const metadata = await sharp(imageBuffer).metadata();

        // Resize to square profile picture (400x400) if needed
        if (metadata.width !== 400 || metadata.height !== 400) {
          const resizedBuffer = await sharp(imageBuffer)
            .resize(400, 400, { fit: 'cover', position: 'center' })
            .jpeg({ quality: 90 })
            .toBuffer();
          
          // In a real app, you'd upload the resized image to S3 and use that URL
          // For now, we'll use the original URL
          processedImageUrl = imageUrl;
        }
      } catch (err) {
        console.error('Profile image processing error:', err);
        // Continue with original image if processing fails
      }

      // Update user's profile picture
      await User.findByIdAndUpdate(req.user._id, {
        profilePicture: processedImageUrl
      });

      res.json({
        message: 'Profile picture updated successfully',
        profilePicture: processedImageUrl,
        file: {
          url: processedImageUrl,
          originalName: req.file.originalname,
          size: req.file.size
        }
      });

    } catch (error) {
      console.error('Profile picture update error:', error);
      res.status(500).json({ error: 'Failed to update profile picture' });
    }
  });
});

// @route   GET /api/upload/test
// @desc    Test S3 connection and upload functionality
// @access  Private
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const isConnected = await checkS3Connection();
    
    res.json({
      s3Connected: isConnected,
      bucketName: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION,
      message: isConnected ? 'S3 connection successful' : 'S3 connection failed'
    });

  } catch (error) {
    console.error('S3 test error:', error);
    res.status(500).json({ 
      s3Connected: false,
      error: 'Failed to test S3 connection' 
    });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error) {
    console.error('Upload middleware error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files' });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Unexpected file field' });
    }
    
    return res.status(500).json({ error: 'Upload error' });
  }
  
  next();
});

module.exports = router;
