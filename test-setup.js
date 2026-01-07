#!/usr/bin/env node

/**
 * Gymgram Setup Test Script
 * 
 * This script tests the basic setup and connectivity of the Gymgram application
 * Run with: node test-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('🏋️  Gymgram Setup Test\n');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - Missing: ${filePath}`, 'red');
    return false;
  }
}

function checkDirectory(dirPath, description) {
  if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
    log(`✅ ${description}`, 'green');
    return true;
  } else {
    log(`❌ ${description} - Missing: ${dirPath}`, 'red');
    return false;
  }
}

function checkPackageJson(packagePath, requiredDeps) {
  if (!fs.existsSync(packagePath)) {
    log(`❌ Package.json missing: ${packagePath}`, 'red');
    return false;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    let allDepsFound = true;

    for (const dep of requiredDeps) {
      if (!pkg.dependencies || !pkg.dependencies[dep]) {
        log(`❌ Missing dependency: ${dep}`, 'red');
        allDepsFound = false;
      }
    }

    if (allDepsFound) {
      log(`✅ All required dependencies found in ${path.basename(packagePath)}`, 'green');
    }

    return allDepsFound;
  } catch (error) {
    log(`❌ Error reading ${packagePath}: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  let allTestsPassed = true;

  log('🔍 Checking Project Structure...', 'blue');
  
  // Check main directories
  const directories = [
    ['server', 'Server directory'],
    ['client', 'Client directory'],
    ['server/models', 'Server models directory'],
    ['server/routes', 'Server routes directory'],
    ['server/config', 'Server config directory'],
    ['server/middleware', 'Server middleware directory'],
    ['client/src', 'Client source directory'],
    ['client/src/components', 'Client components directory'],
    ['client/src/context', 'Client context directory'],
    ['client/public', 'Client public directory']
  ];

  for (const [dir, desc] of directories) {
    if (!checkDirectory(dir, desc)) {
      allTestsPassed = false;
    }
  }

  log('\n📋 Checking Essential Files...', 'blue');

  // Check essential files
  const files = [
    ['package.json', 'Root package.json'],
    ['server/package.json', 'Server package.json'],
    ['client/package.json', 'Client package.json'],
    ['server/server.js', 'Main server file'],
    ['server/.env.example', 'Environment example file'],
    ['server/models/User.js', 'User model'],
    ['server/models/Post.js', 'Post model'],
    ['server/routes/auth.js', 'Auth routes'],
    ['server/routes/posts.js', 'Posts routes'],
    ['server/routes/users.js', 'Users routes'],
    ['server/routes/upload.js', 'Upload routes'],
    ['server/config/s3.js', 'S3 configuration'],
    ['server/middleware/auth.js', 'Auth middleware'],
    ['client/src/App.js', 'React App component'],
    ['client/src/index.js', 'React entry point'],
    ['client/src/context/AuthContext.js', 'Auth context'],
    ['README.md', 'Project documentation']
  ];

  for (const [file, desc] of files) {
    if (!checkFile(file, desc)) {
      allTestsPassed = false;
    }
  }

  log('\n📦 Checking Dependencies...', 'blue');

  // Check server dependencies
  const serverDeps = [
    'express',
    'mongoose',
    'bcryptjs',
    'jsonwebtoken',
    'cors',
    'helmet',
    'multer',
    'multer-s3',
    'aws-sdk',
    'dotenv',
    'express-validator',
    'sharp',
    'fluent-ffmpeg'
  ];

  if (!checkPackageJson('server/package.json', serverDeps)) {
    allTestsPassed = false;
  }

  // Check client dependencies
  const clientDeps = [
    'react',
    'react-dom',
    'react-router-dom',
    'react-query',
    '@mui/material',
    '@mui/icons-material',
    'axios',
    'react-dropzone',
    'react-toastify'
  ];

  if (!checkPackageJson('client/package.json', clientDeps)) {
    allTestsPassed = false;
  }

  log('\n🔧 Checking Configuration...', 'blue');

  // Check if .env exists (not .env.example)
  if (fs.existsSync('server/.env')) {
    log('✅ Environment file exists', 'green');
    
    // Basic check of .env content
    try {
      const envContent = fs.readFileSync('server/.env', 'utf8');
      const requiredVars = [
        'MONGODB_URI',
        'JWT_SECRET',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_S3_BUCKET'
      ];

      let envVarsFound = 0;
      for (const envVar of requiredVars) {
        if (envContent.includes(`${envVar}=`)) {
          envVarsFound++;
        }
      }

      if (envVarsFound === requiredVars.length) {
        log('✅ All required environment variables present', 'green');
      } else {
        log(`⚠️  Only ${envVarsFound}/${requiredVars.length} environment variables found`, 'yellow');
        log('   Make sure to configure: ' + requiredVars.join(', '), 'yellow');
      }
    } catch (error) {
      log(`❌ Error reading .env file: ${error.message}`, 'red');
    }
  } else {
    log('⚠️  No .env file found - copy from .env.example and configure', 'yellow');
    log('   Run: cp server/.env.example server/.env', 'yellow');
  }

  // Final summary
  log('\n📊 Test Summary', 'bold');
  log('='.repeat(50), 'blue');

  if (allTestsPassed) {
    log('🎉 All tests passed! Your Gymgram setup looks good.', 'green');
    log('\nNext steps:', 'blue');
    log('1. Configure your .env file with database and AWS credentials', 'yellow');
    log('2. Install dependencies: npm run install-deps', 'yellow');
    log('3. Start the development servers: npm run dev', 'yellow');
    log('4. Visit http://localhost:3000 to see your app!', 'yellow');
  } else {
    log('❌ Some tests failed. Please check the issues above.', 'red');
    allTestsPassed = false;
  }

  log('\n💪 Happy coding with Gymgram!', 'green');
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Test script error:', error);
  process.exit(1);
});

// Run the tests
main().catch((error) => {
  console.error('Test script failed:', error);
  process.exit(1);
});
