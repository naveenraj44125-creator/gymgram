const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

// Generate unique filename
const generateFileName = (originalname, userId) => {
  const timestamp = Date.now();
  const extension = path.extname(originalname);
  const baseName = path.basename(originalname, extension);
  return `${userId}/${timestamp}-${baseName}${extension}`;
};

// Multer S3 configuration for posts
const uploadPost = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      const fileName = generateFileName(file.originalname, req.user.id);
      cb(null, `posts/${fileName}`);
    },
    metadata: function (req, file, cb) {
      cb(null, {
        'uploaded-by': req.user.username,
        'upload-date': new Date().toISOString(),
        'original-name': file.originalname
      });
    }
  }),
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10 // Maximum 10 files per upload
  }
});

// Multer S3 configuration for profile pictures
const uploadProfile = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    key: function (req, file, cb) {
      const fileName = generateFileName(file.originalname, req.user.id);
      cb(null, `profiles/${fileName}`);
    },
    metadata: function (req, file, cb) {
      cb(null, {
        'uploaded-by': req.user.username,
        'upload-date': new Date().toISOString(),
        'original-name': file.originalname,
        'type': 'profile-picture'
      });
    }
  }),
  fileFilter: (req, file, cb) => {
    // Only allow images for profile pictures
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed for profile pictures.'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for profile pictures
    files: 1 // Only one profile picture at a time
  }
});

// Function to delete file from S3
const deleteFromS3 = async (fileKey) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    return false;
  }
};

// Function to get signed URL for private files
const getSignedUrl = (fileKey, expires = 3600) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey,
    Expires: expires
  };

  return s3.getSignedUrl('getObject', params);
};

// Function to copy file within S3 (useful for moving files)
const copyWithinS3 = async (sourceKey, destinationKey) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    CopySource: `${process.env.AWS_S3_BUCKET}/${sourceKey}`,
    Key: destinationKey
  };

  try {
    await s3.copyObject(params).promise();
    return true;
  } catch (error) {
    console.error('Error copying in S3:', error);
    return false;
  }
};

// Function to check if bucket exists and is accessible
const checkS3Connection = async () => {
  try {
    await s3.headBucket({ Bucket: process.env.AWS_S3_BUCKET }).promise();
    return true;
  } catch (error) {
    console.error('S3 Connection Error:', error.message);
    return false;
  }
};

// Get file info from S3
const getFileInfo = async (fileKey) => {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: fileKey
  };

  try {
    const data = await s3.headObject(params).promise();
    return {
      size: data.ContentLength,
      lastModified: data.LastModified,
      contentType: data.ContentType,
      metadata: data.Metadata
    };
  } catch (error) {
    console.error('Error getting file info from S3:', error);
    return null;
  }
};

module.exports = {
  s3,
  uploadPost,
  uploadProfile,
  deleteFromS3,
  getSignedUrl,
  copyWithinS3,
  checkS3Connection,
  getFileInfo
};
