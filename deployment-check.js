#!/usr/bin/env node

/**
 * Gymgram Deployment Configuration Checker
 * 
 * This script validates the deployment configuration for AWS Lightsail
 * Run with: node deployment-check.js
 */

const fs = require('fs');

// Try to load js-yaml, fallback to simple parser if not available
let yaml;
try {
  yaml = require('js-yaml');
} catch (e) {
  // Simple YAML parser fallback
  yaml = {
    load: (content) => {
      const config = {};
      const lines = content.split('\n');
      let currentSection = config;
      const sectionStack = [config];
      let currentIndent = 0;
      
      for (const line of lines) {
        if (line.trim().startsWith('#') || !line.trim()) continue;
        
        const indent = line.match(/^\s*/)[0].length;
        const [key, ...valueParts] = line.trim().split(':');
        const value = valueParts.join(':').trim();
        
        // Handle indentation levels
        if (indent < currentIndent) {
          // Back to previous level
          while (sectionStack.length > 1 && indent < currentIndent) {
            sectionStack.pop();
            currentIndent -= 2;
          }
          currentSection = sectionStack[sectionStack.length - 1];
        }
        
        if (value && !value.startsWith('{') && !value.startsWith('[')) {
          currentSection[key] = value.replace(/['"]/g, '');
        } else if (!value) {
          currentSection[key] = {};
          sectionStack.push(currentSection[key]);
          currentSection = currentSection[key];
          currentIndent = indent;
        }
      }
      
      return config;
    }
  };
}

console.log('🚀 Gymgram Deployment Configuration Check\n');

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

async function main() {
  let allTestsPassed = true;

  log('🔍 Checking Deployment Configuration...', 'blue');
  
  // Check deployment files
  const deploymentFiles = [
    ['deployment-nodejs.config.yml', 'Node.js deployment configuration'],
    ['.github/workflows/deploy-react.yml', 'GitHub Actions workflow'],
    ['server/server.js', 'Node.js server entry point'],
    ['client/src/App.js', 'React app entry point'],
    ['package.json', 'Root package.json with scripts']
  ];

  for (const [file, desc] of deploymentFiles) {
    if (!checkFile(file, desc)) {
      allTestsPassed = false;
    }
  }

  log('\n📋 Validating Deployment Configuration...', 'blue');

  try {
    // Check deployment config
    if (fs.existsSync('deployment-nodejs.config.yml')) {
      const deployConfig = yaml.load(fs.readFileSync('deployment-nodejs.config.yml', 'utf8'));
      
      // Validate key sections
      if (deployConfig.application?.type === 'nodejs') {
        log('✅ Application type: Node.js', 'green');
      } else {
        log('❌ Application type not set to nodejs', 'red');
        allTestsPassed = false;
      }

      if (deployConfig.dependencies?.mongodb?.enabled) {
        log('✅ MongoDB database configured', 'green');
      } else {
        log('❌ MongoDB not enabled in config', 'red');
        allTestsPassed = false;
      }

      if (deployConfig.dependencies?.nginx?.enabled) {
        log('✅ Nginx reverse proxy configured', 'green');
      } else {
        log('❌ Nginx not configured', 'red');
        allTestsPassed = false;
      }

      if (deployConfig.lightsail?.bucket?.enabled) {
        log('✅ S3 bucket configured for media storage', 'green');
      } else {
        log('❌ S3 bucket not configured', 'red');
        allTestsPassed = false;
      }

      // Check environment variables
      const envVars = deployConfig.application?.environment_variables;
      const requiredEnvVars = ['NODE_ENV', 'MONGODB_URI', 'JWT_SECRET', 'AWS_S3_BUCKET'];
      let envCount = 0;
      
      for (const envVar of requiredEnvVars) {
        if (envVars && envVars[envVar]) {
          envCount++;
        }
      }

      if (envCount === requiredEnvVars.length) {
        log('✅ All required environment variables configured', 'green');
      } else {
        log(`⚠️  Only ${envCount}/${requiredEnvVars.length} required environment variables configured`, 'yellow');
      }

      // Check instance size
      const instanceSize = deployConfig.lightsail?.bundle_id;
      if (instanceSize === 'medium_3_0') {
        log('✅ Instance size: medium_3_0 (4GB RAM) - Perfect for full-stack app', 'green');
      } else {
        log(`⚠️  Instance size: ${instanceSize} - Consider medium_3_0 for better performance`, 'yellow');
      }

    } else {
      log('❌ Deployment configuration file not found', 'red');
      allTestsPassed = false;
    }

  } catch (error) {
    log(`❌ Error parsing deployment config: ${error.message}`, 'red');
    allTestsPassed = false;
  }

  log('\n🔧 Checking GitHub Actions Workflow...', 'blue');

  try {
    if (fs.existsSync('.github/workflows/deploy-react.yml')) {
      const workflowContent = fs.readFileSync('.github/workflows/deploy-react.yml', 'utf8');
      
      if (workflowContent.includes('deployment-nodejs.config.yml')) {
        log('✅ Workflow uses correct Node.js config file', 'green');
      } else {
        log('❌ Workflow not configured for Node.js deployment', 'red');
        allTestsPassed = false;
      }

      if (workflowContent.includes('Gymgram Full-Stack Deployment')) {
        log('✅ Workflow configured for full-stack deployment', 'green');
      } else {
        log('❌ Workflow title not updated for full-stack', 'red');
        allTestsPassed = false;
      }

      if (workflowContent.includes('server/**') && workflowContent.includes('client/**')) {
        log('✅ Workflow triggers on both server and client changes', 'green');
      } else {
        log('❌ Workflow not configured to trigger on both server and client changes', 'red');
        allTestsPassed = false;
      }

    } else {
      log('❌ GitHub Actions workflow file not found', 'red');
      allTestsPassed = false;
    }

  } catch (error) {
    log(`❌ Error checking workflow: ${error.message}`, 'red');
    allTestsPassed = false;
  }

  log('\n💰 Cost Estimation...', 'blue');
  log('• Lightsail Instance (medium_3_0): ~$40/month', 'yellow');
  log('• S3 Bucket (small_1_0): ~$5/month', 'yellow');
  log('• Data Transfer: ~$1-10/month', 'yellow');
  log('• Total Estimated: ~$46-55/month', 'yellow');

  log('\n🏗️ Architecture Overview...', 'blue');
  log('• Frontend: React build served by Nginx', 'yellow');
  log('• Backend: Node.js/Express managed by PM2', 'yellow');
  log('• Database: MongoDB 7.0 with authentication', 'yellow');
  log('• Storage: AWS S3 for media files', 'yellow');
  log('• Proxy: Nginx (/api → Node.js, / → React)', 'yellow');

  // Final summary
  log('\n📊 Deployment Check Summary', 'bold');
  log('='.repeat(50), 'blue');

  if (allTestsPassed) {
    log('🎉 Deployment configuration is ready!', 'green');
    log('\nNext steps:', 'blue');
    log('1. Push your code to GitHub: git push origin main', 'yellow');
    log('2. GitHub Actions will automatically:', 'yellow');
    log('   - Create Lightsail instance', 'yellow');
    log('   - Set up MongoDB database', 'yellow');
    log('   - Build React frontend', 'yellow');
    log('   - Start Node.js backend', 'yellow');
    log('   - Configure Nginx proxy', 'yellow');
    log('3. Access your app at: http://gymgram-app.lightsail.aws.com', 'yellow');
  } else {
    log('❌ Some configuration issues found. Please fix the issues above.', 'red');
  }

  log('\n💪 Ready to deploy Gymgram!', 'green');
  
  process.exit(allTestsPassed ? 0 : 1);
}

// Simple YAML parser fallback if js-yaml not available
if (!fs.existsSync('node_modules/js-yaml')) {
  console.log('⚠️  js-yaml not installed, using basic config check...\n');
  
  const yaml = {
    load: (content) => {
      // Basic YAML parsing for our config check
      const lines = content.split('\n');
      const config = {};
      let current = config;
      const stack = [config];
      
      for (const line of lines) {
        if (line.trim().startsWith('#') || !line.trim()) continue;
        
        const indent = line.match(/^\s*/)[0].length;
        const [key, ...valueParts] = line.trim().split(':');
        const value = valueParts.join(':').trim();
        
        if (value) {
          current[key] = value;
        } else {
          current[key] = {};
          current = current[key];
        }
      }
      
      return config;
    }
  };
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Deployment check error:', error);
  process.exit(1);
});

// Run the check
main().catch((error) => {
  console.error('Deployment check failed:', error);
  process.exit(1);
});
