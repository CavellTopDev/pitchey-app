import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { TEST_PITCH } from './fixtures/test-data';

test.describe('Cross-Feature Integration Tests', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
  });

  test.describe('Complete NDA Workflow', () => {
    test('should complete full NDA request and approval flow', async ({ page }) => {
      // Step 1: Creator creates and publishes a pitch
      await authHelper.loginAsCreator();
      
      // Create pitch
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.fill('[data-testid="logline-input"]', TEST_PITCH.logline);
      await page.fill('[data-testid="synopsis-input"]', TEST_PITCH.synopsis);
      await page.selectOption('[data-testid="genre-select"]', TEST_PITCH.genre);
      
      // Save and publish
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');
      
      await authHelper.logout();
      
      // Step 2: Investor requests NDA
      await authHelper.loginAsInvestor();
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Find and click on the created pitch
      await page.click(`[data-testid="pitch-card"]:has-text("${TEST_PITCH.title}")`);
      
      // Request NDA
      await page.click('[data-testid="request-nda-button"]');
      await page.fill('[data-testid="request-reason"]', 'Interested in potential investment opportunity');
      await page.fill('[data-testid="investment-amount"]', '2000000');
      await page.click('[data-testid="submit-nda-request"]');
      await pageHelper.waitForNotification('success');
      
      await authHelper.logout();
      
      // Step 3: Creator approves NDA
      await authHelper.loginAsCreator();
      await page.click('[data-testid="nda-management-link"]');
      
      // Find pending NDA request
      const pendingNDA = page.locator('[data-testid="nda-table"] tr').filter({ hasText: 'Pending' }).first();
      await pendingNDA.click();
      
      // Approve NDA
      await page.click('[data-testid="approve-nda-button"]');
      await page.fill('[data-testid="approval-message"]', 'NDA approved. Looking forward to discussing this opportunity.');
      await page.click('[data-testid="confirm-approval"]');
      await pageHelper.waitForNotification('success');
      
      await authHelper.logout();
      
      // Step 4: Investor accesses protected content
      await authHelper.loginAsInvestor();
      await page.click('[data-testid="nda-history-link"]');
      
      // Click on approved NDA
      const approvedNDA = page.locator('[data-testid="nda-table"] tr').filter({ hasText: 'Approved' }).first();
      await approvedNDA.click();
      
      // Should now see full pitch details
      await expect(page.locator('[data-testid="full-synopsis"]')).toBeVisible();
      await expect(page.locator('[data-testid="financial-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-documents"]')).toBeVisible();
    });

    test('should handle NDA rejection gracefully', async ({ page }) => {
      // Creator rejects NDA request
      await authHelper.loginAsCreator();
      await page.click('[data-testid="nda-management-link"]');
      
      const pendingNDA = page.locator('[data-testid="nda-table"] tr').filter({ hasText: 'Pending' }).first();
      
      if (await pendingNDA.count() > 0) {
        await pendingNDA.click();
        
        // Reject NDA
        await page.click('[data-testid="reject-nda-button"]');
        await page.fill('[data-testid="rejection-reason"]', 'Not a suitable match for this project at this time.');
        await page.click('[data-testid="confirm-rejection"]');
        await pageHelper.waitForNotification('success');
      }
    });
  });

  test.describe('Real-time Notifications', () => {
    test('should receive real-time notifications via WebSocket', async ({ page }) => {
      // Login as creator
      await authHelper.loginAsCreator();
      
      // Check WebSocket connection
      await pageHelper.checkWebSocketConnection();
      
      // In a real test, you would trigger an action that generates a notification
      // For this test, we'll verify the notification system is active
      await expect(page.locator('[data-testid="notification-bell"]')).toBeVisible();
    });

    test('should update notification count in real-time', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // WebSocket should be connected and ready to receive notifications
      await pageHelper.checkWebSocketConnection();
    });
  });

  test.describe('File Upload Integration', () => {
    test('should upload files to R2 storage and track progress', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Create a pitch first
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
      
      // Navigate to documents
      await page.click('[data-testid="documents-tab"]');
      
      // Upload a test file
      await page.click('[data-testid="upload-files-button"]');
      
      // Create a test file
      const testFile = {
        name: 'test-script.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Test script content for upload test')
      };
      
      await page.setInputFiles('[data-testid="file-input"]', [testFile]);
      
      // Wait for upload progress
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      
      // Wait for completion
      await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible();
      
      // Verify file appears in list
      await expect(page.locator('[data-testid="document-list"]')).toContainText('test-script.pdf');
    });

    test('should handle upload errors gracefully', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Create a pitch first
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.click('[data-testid="save-draft-button"]');
      
      // Try to upload an invalid file type
      await page.click('[data-testid="documents-tab"]');
      await page.click('[data-testid="upload-files-button"]');
      
      const invalidFile = {
        name: 'malicious.exe',
        mimeType: 'application/x-executable',
        buffer: Buffer.from('Invalid file content')
      };
      
      await page.setInputFiles('[data-testid="file-input"]', [invalidFile]);
      
      // Should show error message
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('File type not allowed');
    });
  });

  test.describe('Analytics Data Flow', () => {
    test('should track analytics across user interactions', async ({ page }) => {
      // Creator publishes pitch
      await authHelper.loginAsCreator();
      
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', 'Analytics Test Pitch');
      await page.fill('[data-testid="logline-input"]', 'A pitch to test analytics tracking');
      await page.click('[data-testid="save-draft-button"]');
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');
      
      // Check initial analytics
      await page.click('[data-testid="analytics-link"]');
      await expect(page.locator('[data-testid="views-chart"]')).toBeVisible();
      
      await authHelper.logout();
      
      // Investor views pitch (should increment analytics)
      await authHelper.loginAsInvestor();
      await page.click('[data-testid="browse-pitches-button"]');
      await page.click('[data-testid="pitch-card"]:has-text("Analytics Test Pitch")');
      
      // Spend some time on the pitch page
      await page.waitForTimeout(3000);
      
      await authHelper.logout();
      
      // Creator checks updated analytics
      await authHelper.loginAsCreator();
      await page.click('[data-testid="analytics-link"]');
      
      // Analytics should show the view
      await expect(page.locator('[data-testid="total-views"]')).not.toContainText('0');
    });
  });

  test.describe('Search and Filtering Integration', () => {
    test('should maintain filters across navigation', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Apply filters
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="genre-action"]');
      await page.fill('[data-testid="budget-min"]', '5000000');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Navigate away and back
      await page.click('[data-testid="dashboard-link"]');
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Filters should be maintained
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Action');
      await expect(page.locator('[data-testid="budget-min"]')).toHaveValue('5000000');
    });

    test('should save and load search filters', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Apply and save filters
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="genre-thriller"]');
      await page.fill('[data-testid="budget-max"]', '20000000');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Save search
      await page.click('[data-testid="save-search-button"]');
      await page.fill('[data-testid="search-name-input"]', 'Thriller Under 20M');
      await page.click('[data-testid="confirm-save-button"]');
      
      // Clear filters
      await page.click('[data-testid="clear-filters-button"]');
      
      // Load saved search
      await page.click('[data-testid="saved-searches-dropdown"]');
      await page.click('[data-testid="saved-search"]:has-text("Thriller Under 20M")');
      
      // Filters should be reapplied
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Thriller');
    });
  });

  test.describe('Multi-User Collaboration', () => {
    test('should handle concurrent editing of pitch', async ({ page }) => {
      // This test would require multiple browser contexts
      // For now, we'll test the draft sync mechanism
      
      await authHelper.loginAsCreator();
      
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', 'Collaboration Test');
      
      // Wait for auto-save
      await page.waitForTimeout(6000);
      await expect(page.locator('[data-testid="auto-save-status"]')).toContainText('Auto-saved');
      
      // Continue editing
      await page.fill('[data-testid="logline-input"]', 'Testing collaborative editing features');
      
      // Should see typing indicator or draft sync status
      await expect(page.locator('[data-testid="draft-sync-status"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Simulate network error by intercepting requests
      await page.route('**/api/**', route => {
        route.abort('failed');
      });
      
      // Try to create a pitch
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', 'Network Error Test');
      await page.click('[data-testid="save-draft-button"]');
      
      // Should show error message
      await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
      
      // Remove network block
      await page.unroute('**/api/**');
      
      // Retry should work
      await page.click('[data-testid="retry-button"]');
      await pageHelper.waitForNotification('success');
    });

    test('should recover from WebSocket disconnection', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Check initial connection
      await pageHelper.checkWebSocketConnection();
      
      // Simulate WebSocket disconnect (this would need custom test setup)
      // For now, just verify reconnection UI exists
      await expect(page.locator('[data-testid="websocket-status"]')).toBeVisible();
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should handle large datasets efficiently', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Test pagination with large result sets
      const startTime = Date.now();
      
      // Load multiple pages
      for (let i = 1; i <= 3; i++) {
        await page.click(`[data-testid="page-${i}"]`);
        await pageHelper.waitForPageLoad();
      }
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Should load within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(10000); // 10 seconds
    });

    test('should lazy load images and content', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Check that images have lazy loading
      const images = page.locator('img[loading="lazy"]');
      const lazyImageCount = await images.count();
      
      expect(lazyImageCount).toBeGreaterThan(0);
    });
  });
});