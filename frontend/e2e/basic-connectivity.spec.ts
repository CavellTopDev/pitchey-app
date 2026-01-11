import { test, expect } from '@playwright/test';

test.describe('Basic Connectivity Tests', () => {
  test('should connect to homepage', async ({ page }) => {
    await page.goto('/');
    
    // Should see the main title or navigation
    await expect(page).toHaveTitle(/Pitchey/);
    
    // Take a screenshot for validation
    await page.screenshot({ 
      path: 'test-results/homepage-connectivity.png',
      fullPage: false 
    });
    
    console.log('✓ Homepage loaded successfully');
  });

  test('should connect to browse page', async ({ page }) => {
    await page.goto('/browse');
    
    // Should see browse content
    await expect(page.locator('body')).toBeVisible();
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/browse-connectivity.png',
      fullPage: false 
    });
    
    console.log('✓ Browse page loaded successfully');
  });

  test('should handle marketplace page', async ({ page }) => {
    await page.goto('/marketplace');
    
    // Should load without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Take a screenshot
    await page.screenshot({ 
      path: 'test-results/marketplace-connectivity.png',
      fullPage: false 
    });
    
    console.log('✓ Marketplace page loaded successfully');
  });

  test('should verify backend API connectivity', async ({ page, request }) => {
    // Test API health endpoint
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    
    console.log('✓ Backend API health check passed');
  });
});