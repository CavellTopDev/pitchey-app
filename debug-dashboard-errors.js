const { chromium } = require('playwright');

const API_URL = 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
const BASE_URL = 'https://7990cec7.pitchey-5o8.pages.dev';

const credentials = {
  creator: { email: 'alex.creator@demo.com', password: 'Demo123' },
  production: { email: 'stellar.production@demo.com', password: 'Demo123' }
};

async function debugDashboardErrors() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  page.on('pageerror', err => {
    errors.push({
      text: err.message,
      stack: err.stack
    });
  });

  console.log('🔍 Debugging Dashboard Errors\n');
  
  // Test Creator Dashboard
  console.log('👤 CREATOR DASHBOARD:');
  await page.goto(BASE_URL);
  
  // Login as creator
  await page.goto(`${BASE_URL}/creator/login`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"], input[name="email"], #email', credentials.creator.email);
  await page.fill('input[type="password"], input[name="password"], #password', credentials.creator.password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  
  await page.waitForTimeout(2000);
  
  // Navigate to dashboard
  errors.length = 0; // Clear previous errors
  await page.goto(`${BASE_URL}/creator/dashboard`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('  ❌ Errors found:');
    errors.forEach(err => {
      console.log(`     ${err.text}`);
      if (err.location) {
        console.log(`        at ${err.location.url}:${err.location.lineNumber}`);
      }
    });
  } else {
    console.log('  ✅ No errors');
  }
  
  // Check page content
  const pageContent = await page.content();
  const hasErrorBoundary = pageContent.includes('Something went wrong') || 
                           pageContent.includes('Error') ||
                           pageContent.includes('error');
  
  if (hasErrorBoundary) {
    console.log('  ⚠️  Error boundary triggered or error message in page');
  }
  
  // Test Production Analytics & Pipeline
  console.log('\n🏢 PRODUCTION PAGES:');
  await page.goto(BASE_URL);
  
  // Login as production
  await page.goto(`${BASE_URL}/production/login`);
  await page.waitForLoadState('networkidle');
  
  await page.fill('input[type="email"], input[name="email"], #email', credentials.production.email);
  await page.fill('input[type="password"], input[name="password"], #password', credentials.production.password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
  
  await page.waitForTimeout(2000);
  
  // Test Pipeline
  console.log('\n  Pipeline Page:');
  errors.length = 0;
  await page.goto(`${BASE_URL}/production/pipeline`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('  ❌ Errors found:');
    errors.forEach(err => {
      console.log(`     ${err.text}`);
      if (err.location) {
        console.log(`        at ${err.location.url}:${err.location.lineNumber}`);
      }
    });
  } else {
    console.log('  ✅ No errors');
  }
  
  // Test Analytics
  console.log('\n  Analytics Page:');
  errors.length = 0;
  await page.goto(`${BASE_URL}/production/analytics`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  if (errors.length > 0) {
    console.log('  ❌ Errors found:');
    errors.forEach(err => {
      console.log(`     ${err.text}`);
      if (err.location) {
        console.log(`        at ${err.location.url}:${err.location.lineNumber}`);
      }
    });
  } else {
    console.log('  ✅ No errors');
  }
  
  await browser.close();
  
  console.log('\n✅ Debug complete');
}

debugDashboardErrors().catch(console.error);