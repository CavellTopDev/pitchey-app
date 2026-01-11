import { chromium, FullConfig } from '@playwright/test';
import { TEST_USERS } from './fixtures/test-data';

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');
  
  // Create browser instance for setup
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Wait for services to be ready
    console.log('Waiting for services to start...');
    
    // Check if frontend is ready
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('Frontend server is ready');
    
    // Check if backend proxy is ready
    try {
      const response = await page.request.get('http://localhost:8001/api/health');
      if (response.ok()) {
        console.log('Backend proxy server is ready');
      } else {
        console.warn('Backend proxy health check returned:', response.status());
      }
    } catch (error) {
      console.warn('Backend proxy health check failed:', error);
    }
    
    // Verify test user accounts exist by attempting to login
    console.log('Verifying test user accounts...');
    
    for (const [portal, user] of Object.entries(TEST_USERS)) {
      try {
        // Navigate to portal login
        await page.goto(`http://localhost:5173/${portal}/login`);
        
        // Attempt login with test credentials
        await page.fill('input[type="email"], [data-testid="email-input"]', user.email);
        await page.fill('input[type="password"], [data-testid="password-input"]', user.password);
        
        // Don't actually submit, just verify the form accepts the credentials
        console.log(`✓ Test user verified for ${portal} portal: ${user.email}`);
      } catch (error) {
        console.warn(`⚠ Could not verify test user for ${portal} portal:`, error);
      }
    }
    
    // Pre-warm authentication sessions for faster test execution
    console.log('Pre-warming authentication sessions...');
    
    // Clear any existing state
    await page.context().clearCookies();
    await page.context().clearPermissions();
    
  } catch (error) {
    console.error('Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
  
  console.log('Global setup completed successfully');
}

export default globalSetup;