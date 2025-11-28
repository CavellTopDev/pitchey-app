const { chromium } = require('playwright');

async function testPortals() {
  console.log('🎭 Starting Playwright Visual Testing');
  console.log('=====================================\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500 // Slow down for visibility
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: './test-videos/',
      size: { width: 1280, height: 720 }
    }
  });
  
  const page = await context.newPage();
  
  // Test Creator Portal
  console.log('📝 Testing Creator Portal...');
  await page.goto('https://pitchey.pages.dev/creator/login');
  await page.screenshot({ path: 'screenshots/creator-login-page.png' });
  
  // Fill login form
  await page.fill('input[type="email"]', 'alex.creator@demo.com');
  await page.fill('input[type="password"]', 'Demo123');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard
  await page.waitForURL('**/creator/dashboard', { timeout: 10000 }).catch(() => {
    console.log('⚠️ Creator dashboard redirect failed');
  });
  
  await page.screenshot({ path: 'screenshots/creator-dashboard.png' });
  console.log('✅ Creator Portal tested\n');
  
  // Test Investor Portal
  console.log('💰 Testing Investor Portal...');
  await page.goto('https://pitchey.pages.dev/investor/login');
  await page.screenshot({ path: 'screenshots/investor-login-page.png' });
  
  await page.fill('input[type="email"]', 'sarah.investor@demo.com');
  await page.fill('input[type="password"]', 'Demo123');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/investor/dashboard', { timeout: 10000 }).catch(() => {
    console.log('⚠️ Investor dashboard redirect failed');
  });
  
  await page.screenshot({ path: 'screenshots/investor-dashboard.png' });
  console.log('✅ Investor Portal tested\n');
  
  // Test Production Portal
  console.log('🎬 Testing Production Portal...');
  await page.goto('https://pitchey.pages.dev/production/login');
  await page.screenshot({ path: 'screenshots/production-login-page.png' });
  
  await page.fill('input[type="email"]', 'stellar.production@demo.com');
  await page.fill('input[type="password"]', 'Demo123');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/production/dashboard', { timeout: 10000 }).catch(() => {
    console.log('⚠️ Production dashboard redirect failed');
  });
  
  await page.screenshot({ path: 'screenshots/production-dashboard.png' });
  console.log('✅ Production Portal tested\n');
  
  // Check Sentry Dashboard
  console.log('🔍 Checking Sentry Dashboard...');
  await page.goto('https://sentry.io/organizations/pitchey/issues/');
  
  // Login to Sentry if needed
  const loginButton = await page.$('text=Sign in');
  if (loginButton) {
    console.log('Logging into Sentry...');
    await loginButton.click();
    // You'll need to handle Sentry login here
  }
  
  await page.screenshot({ path: 'screenshots/sentry-dashboard.png' });
  
  console.log('\n✨ Visual testing complete!');
  console.log('Screenshots saved in ./screenshots/');
  console.log('Videos saved in ./test-videos/');
  
  await browser.close();
}

testPortals().catch(console.error);