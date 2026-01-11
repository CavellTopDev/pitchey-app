import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from './fixtures/test-data';

const authFiles = {
  creator: 'e2e/.auth/creator.json',
  investor: 'e2e/.auth/investor.json', 
  production: 'e2e/.auth/production.json'
};

// Setup authentication for all three portals
for (const [portal, user] of Object.entries(TEST_USERS)) {
  setup(`authenticate ${portal}`, async ({ page }) => {
    console.log(`Setting up authentication for ${portal} portal...`);
    
    try {
      // Navigate to the specific portal login
      await page.goto(`/${portal}/login`);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Better Auth login flow
      await page.fill('input[type="email"], [data-testid="email-input"]', user.email);
      await page.fill('input[type="password"], [data-testid="password-input"]', user.password);
      
      // Submit the form
      await page.click('button[type="submit"], [data-testid="login-button"]');
      
      // Wait for successful authentication
      // Better Auth should redirect to dashboard and set cookies
      await page.waitForURL(`**/${portal}/dashboard`, { timeout: 15000 });
      
      // Verify authentication by checking for user-specific elements
      await expect(page.locator('[data-testid="user-menu"], [data-testid="dashboard-title"]')).toBeVisible();
      
      // Store the authentication state (cookies)
      await page.context().storageState({ path: authFiles[portal as keyof typeof authFiles] });
      
      console.log(`✓ Authentication stored for ${portal} portal`);
      
      // Take a screenshot for verification
      await page.screenshot({ 
        path: `e2e/.auth/${portal}-dashboard.png`,
        fullPage: false 
      });
      
    } catch (error) {
      console.error(`Failed to authenticate ${portal} portal:`, error);
      
      // Take screenshot of failure for debugging
      await page.screenshot({ 
        path: `e2e/.auth/${portal}-login-failed.png`,
        fullPage: true 
      });
      
      throw error;
    }
  });
}