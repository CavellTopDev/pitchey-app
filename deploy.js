#!/usr/bin/env node

/**
 * Deploy script that redirects to the appropriate wrangler command
 * This is a workaround for Cloudflare Pages running 'wrangler deploy'
 */

const { execSync } = require('child_process');

console.log('🚀 Deploying to Cloudflare Pages...');

try {
  // Run the Pages deploy command
  execSync('npx wrangler pages deploy frontend/dist --project-name=pitchey-5o8-66n', {
    stdio: 'inherit'
  });
  console.log('✅ Deployment successful!');
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  process.exit(1);
}