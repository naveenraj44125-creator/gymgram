# 💪 Gymgram

A social media platform specifically designed for gym enthusiasts to share their fitness journey, workout routines, and progress photos/videos.

## 🌟 Features

### Core Features
- **User Authentication & Profiles** - Secure registration/login with JWT tokens
- **Photo & Video Sharing** - Upload workout photos and videos with AWS S3 integration
- **Feed & Timeline** - Personalized feed from followed users
- **Social Interactions** - Like, comment, save posts
- **Follow System** - Follow other fitness enthusiasts
- **Workout Tracking** - Share detailed workout routines with exercises, sets, reps
- **Hashtags & Discovery** - Discover content through hashtags and trending topics
- **Search & Explore** - Find users, gyms, and content
- **Responsive Design** - Works perfectly on mobile and desktop

### Fitness-Specific Features
- **Gym Check-ins** - Tag your gym location
- **Fitness Goals Tracking** - Set and display fitness goals (weight loss, muscle gain, etc.)
- **Exercise Database** - Detailed workout logging with sets, reps, weights
- **Progress Sharing** - Before/after photos, transformation stories
- **Gym Community** - Find users from the same gym
- **Workout Types** - Categorize workouts (strength, cardio, flexibility, sports)

## 🛠 Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - Database with Mongoose ODM
- **JWT** - Authentication
- **AWS S3** - Media storage
- **Multer & Multer-S3** - File upload handling
- **Sharp** - Image processing
- **FFmpeg** - Video processing
- **bcryptjs** - Password hashing

### Frontend
- **React 18** - UI library
- **Material-UI (MUI)** - Component library
- **React Router** - Navigation
- **React Query** - Data fetching and caching
- **Axios** - HTTP client
- **React Dropzone** - File uploads
- **React Player** - Video player

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- MongoDB (local or MongoDB Atlas)
- AWS Account with S3 bucket

### 1. Clone Repository
```bash
git clone <repository-url>
cd gymgram
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm run install-deps

# Or install manually
npm install
cd server && npm install
cd ../client && npm install
```

### 3. Environment Setup

Create `server/.env` file:
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/gymgram

# JWT Secret (use a strong secret in production)
JWT_SECRET=your_jwt_secret_key_here

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-gymgram-bucket

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:3000
```

### 4. AWS S3 Setup

1. Create an S3 bucket in your AWS account
2. Set bucket permissions for public read access on uploaded files
3. Create an IAM user with S3 permissions
4. Add the IAM credentials to your `.env` file

Example S3 bucket policy for public read:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicRead",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

### 5. Database Setup

For local MongoDB:
```bash
# Make sure MongoDB is running
mongod

# The app will automatically create the database and collections
```

For MongoDB Atlas:
- Create a cluster on MongoDB Atlas
- Get the connection string
- Replace `MONGODB_URI` in your `.env` file

### 6. Run the Application

Development mode (runs both server and client):
```bash
npm run dev
```

Or run separately:
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📱 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update user profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - Logout user

### Posts Endpoints
- `POST /api/posts` - Create new post
- `GET /api/posts/feed` - Get user feed
- `GET /api/posts/explore` - Get explore posts
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Like/unlike post
- `POST /api/posts/:id/save` - Save/unsave post
- `POST /api/posts/:id/comments` - Add comment
- `DELETE /api/posts/:id/comments/:commentId` - Delete comment
- `GET /api/posts/hashtag/:tag` - Get posts by hashtag
- `GET /api/posts/trending/hashtags` - Get trending hashtags

### Users Endpoints
- `GET /api/users/search` - Search users
- `GET /api/users/:username` - Get user profile
- `GET /api/users/:username/posts` - Get user posts
- `POST /api/users/:username/follow` - Follow/unfollow user
- `GET /api/users/:username/followers` - Get user followers
- `GET /api/users/:username/following` - Get user following
- `GET /api/users/:username/saved` - Get saved posts (private)
- `GET /api/users/suggestions/follow` - Get follow suggestions
- `GET /api/users/nearby` - Get nearby users
- `GET /api/users/gym/:gymName` - Get users by gym

### Upload Endpoints
- `POST /api/upload/post` - Upload media for posts
- `POST /api/upload/profile` - Upload profile picture
- `GET /api/upload/test` - Test S3 connection

## 🏗 Project Structure

```
gymgram/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── context/        # React context providers
│   │   ├── hooks/          # Custom hooks
│   │   ├── utils/          # Utility functions
│   │   └── App.js         # Main app component
│   └── package.json
├── server/                 # Node.js backend
│   ├── config/            # Configuration files
│   ├── middleware/        # Express middleware
│   ├── models/           # Mongoose models
│   ├── routes/           # Express routes
│   ├── server.js         # Server entry point
│   └── package.json
├── package.json          # Root package.json
└── README.md
```

## 🌐 Deployment

### Automated AWS Lightsail Deployment

Gymgram includes automated deployment to AWS Lightsail using GitHub Actions. This sets up the complete full-stack application with one click!

#### Prerequisites
- GitHub repository for your Gymgram code
- AWS account with Lightsail access
- GitHub OIDC role configured (done automatically)

#### Deployment Configuration

The application uses `deployment-nodejs.config.yml` for intelligent deployment:

**Features Included:**
- ✅ **Lightsail Instance** - Ubuntu 22.04 with 4GB RAM
- ✅ **Node.js 20** - Latest LTS version with PM2 process management
- ✅ **MongoDB 7.0** - Configured with authentication
- ✅ **Nginx** - Reverse proxy for React frontend and API routes
- ✅ **S3 Bucket** - For media storage (photos/videos)
- ✅ **SSL Ready** - Automatic HTTPS configuration
- ✅ **Health Monitoring** - Automatic health checks

#### Quick Deploy Steps

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Deploy Gymgram to Lightsail"
   git push origin main
   ```

2. **GitHub Actions automatically**:
   - Creates Lightsail instance `gymgram-app`
   - Sets up MongoDB database
   - Builds React frontend
   - Configures Nginx reverse proxy
   - Starts Node.js backend with PM2
   - Creates S3 bucket for media

3. **Access your app**:
   - Frontend: `http://gymgram-app.lightsail.aws.com`
   - API: `http://gymgram-app.lightsail.aws.com/api/health`

#### Configuration Details

**Instance Specifications:**
- **Size**: medium_3_0 (4GB RAM, 2 vCPU)
- **Storage**: 80GB SSD
- **Estimated Cost**: $26-80/month
- **Region**: us-east-1 (configurable)

**Security Features:**
- MongoDB with authentication
- Firewall: Only ports 22, 80, 443 open
- Secure password generation
- File permissions properly set

#### Manual Deployment (Alternative)

For manual deployment or other cloud providers:

1. **Build the client**:
```bash
cd client && npm run build
```

2. **Set up environment variables**:
```bash
export MONGODB_URI="your_mongodb_connection"
export JWT_SECRET="your_secure_secret"
export AWS_ACCESS_KEY_ID="your_key"
export AWS_SECRET_ACCESS_KEY="your_secret"
export AWS_S3_BUCKET="your_bucket"
```

3. **Start the server**:
```bash
cd server && npm start
```

### Environment Variables for Production

**Required Environment Variables:**
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Strong secret key (auto-generated in Lightsail)
- `AWS_ACCESS_KEY_ID` - AWS credentials (uses IAM role in Lightsail)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials
- `AWS_REGION` - AWS region (default: us-east-1)
- `AWS_S3_BUCKET` - S3 bucket name (auto-created)
- `NODE_ENV=production`
- `CLIENT_URL` - Frontend URL
- `PORT=5000` - Backend port

## 🔒 Security Features

- **JWT Authentication** with refresh tokens
- **Password Hashing** using bcryptjs
- **Rate Limiting** on sensitive endpoints
- **Input Validation** using express-validator
- **CORS Protection** 
- **Helmet Security Headers**
- **File Upload Validation** (file types, sizes)

## 🎨 Design System

The app uses a custom Material-UI theme with:
- **Primary Color**: Pink (#E91E63) - Energetic and fitness-focused
- **Secondary Color**: Orange (#FF5722) - High energy and motivation
- **Typography**: Inter font family for modern, clean text
- **Components**: Custom styled MUI components with fitness branding

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

If you encounter any issues:

1. **Check the logs** - Server and browser console logs provide helpful error information
2. **Verify environment variables** - Ensure all required variables are set
3. **Test S3 connection** - Use the `/api/upload/test` endpoint
4. **Database connection** - Verify MongoDB is running and accessible

## 🏋️ Start Your Fitness Journey!

Ready to share your gains? Get started with Gymgram and connect with the fitness community!

```bash
npm run dev
```

Visit http://localhost:3000 and create your account to start sharing your fitness journey! 💪
