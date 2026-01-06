import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';

test.describe('Investor Workflows', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    
    // Login as investor before each test
    await authHelper.loginAsInvestor();
  });

  test.describe('Dashboard', () => {
    test('should display investor dashboard with key metrics', async ({ page }) => {
      await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Investor Dashboard');
      
      // Check for key dashboard components
      await expect(page.locator('[data-testid="portfolio-value"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-investments"]')).toBeVisible();
      await expect(page.locator('[data-testid="pending-ndas"]')).toBeVisible();
      
      // Check for navigation links
      await expect(page.locator('[data-testid="browse-pitches-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="investment-history-link"]')).toBeVisible();
    });

    test('should show investment opportunities', async ({ page }) => {
      const opportunitiesSection = page.locator('[data-testid="investment-opportunities"]');
      await expect(opportunitiesSection).toBeVisible();
    });

    test('should display portfolio analytics', async ({ page }) => {
      const analyticsSection = page.locator('[data-testid="portfolio-analytics"]');
      await expect(analyticsSection).toBeVisible();
    });

    test('should allow logout functionality', async () => {
      await authHelper.logout();
      await authHelper.verifyNotAuthenticated();
    });
  });

  test.describe('Browse Pitches', () => {
    test('should display pitch marketplace', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      await expect(page.locator('[data-testid="pitch-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible();
    });

    test('should filter pitches by genre', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Open filter panel
      await page.click('[data-testid="filter-toggle"]');
      
      // Select genre filter
      await page.check('[data-testid="genre-action"]');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="results-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Action');
    });

    test('should filter pitches by budget range', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Open filter panel
      await page.click('[data-testid="filter-toggle"]');
      
      // Set budget range
      await page.fill('[data-testid="budget-min"]', '1000000');
      await page.fill('[data-testid="budget-max"]', '10000000');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('$1M - $10M');
    });

    test('should search pitches by keyword', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Search for pitches
      await page.fill('[data-testid="search-bar"]', 'action thriller');
      await page.press('[data-testid="search-bar"]', 'Enter');
      
      // Verify search results
      await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-query"]')).toContainText('action thriller');
    });

    test('should sort pitches by different criteria', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Sort by newest
      await page.selectOption('[data-testid="sort-select"]', 'newest');
      await pageHelper.waitForPageLoad();
      
      // Sort by budget
      await page.selectOption('[data-testid="sort-select"]', 'budget');
      await pageHelper.waitForPageLoad();
      
      // Sort by popularity
      await page.selectOption('[data-testid="sort-select"]', 'popularity');
      await pageHelper.waitForPageLoad();
    });

    test('should save search filters', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Apply some filters
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="genre-action"]');
      await page.fill('[data-testid="budget-min"]', '5000000');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Save the search
      await page.click('[data-testid="save-search-button"]');
      await page.fill('[data-testid="search-name-input"]', 'High Budget Action Films');
      await page.click('[data-testid="confirm-save-button"]');
      
      // Verify saved search appears
      await expect(page.locator('[data-testid="saved-searches"]')).toContainText('High Budget Action Films');
    });
  });

  test.describe('NDA Workflow', () => {
    test('should request NDA for a pitch', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Click on a pitch
      await page.click('[data-testid="pitch-card"]:first-child');
      
      // Request NDA
      await page.click('[data-testid="request-nda-button"]');
      
      // Fill NDA request form
      await page.fill('[data-testid="request-reason"]', 'Interested in potential investment opportunity');
      await page.fill('[data-testid="investment-amount"]', '2000000');
      await page.click('[data-testid="submit-nda-request"]');
      
      await pageHelper.waitForNotification('success');
      
      // Verify NDA status
      await expect(page.locator('[data-testid="nda-status"]')).toContainText('Pending');
    });

    test('should view NDA history', async ({ page }) => {
      await page.click('[data-testid="nda-history-link"]');
      
      await expect(page.locator('[data-testid="nda-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="nda-status-filter"]')).toBeVisible();
    });

    test('should filter NDA requests by status', async ({ page }) => {
      await page.click('[data-testid="nda-history-link"]');
      
      // Filter by pending requests
      await page.selectOption('[data-testid="nda-status-filter"]', 'pending');
      
      // Verify filtered results
      const rows = page.locator('[data-testid="nda-table"] tbody tr');
      const rowCount = await rows.count();
      
      if (rowCount > 0) {
        for (let i = 0; i < rowCount; i++) {
          await expect(rows.nth(i).locator('[data-testid="status-cell"]')).toContainText('Pending');
        }
      }
    });

    test('should access approved pitch content', async ({ page }) => {
      // This test assumes there's an approved NDA
      await page.click('[data-testid="nda-history-link"]');
      
      // Click on approved NDA
      const approvedRow = page.locator('[data-testid="nda-table"] tr').filter({ hasText: 'Approved' }).first();
      
      if (await approvedRow.count() > 0) {
        await approvedRow.click();
        
        // Should be able to view full pitch details
        await expect(page.locator('[data-testid="full-synopsis"]')).toBeVisible();
        await expect(page.locator('[data-testid="financial-details"]')).toBeVisible();
        await expect(page.locator('[data-testid="download-documents"]')).toBeVisible();
      }
    });
  });

  test.describe('Investment Tracking', () => {
    test('should view investment portfolio', async ({ page }) => {
      await page.click('[data-testid="investment-history-link"]');
      
      await expect(page.locator('[data-testid="portfolio-summary"]')).toBeVisible();
      await expect(page.locator('[data-testid="investment-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="performance-chart"]')).toBeVisible();
    });

    test('should track investment performance', async ({ page }) => {
      await page.click('[data-testid="investment-history-link"]');
      
      // View detailed performance
      await page.click('[data-testid="detailed-performance-button"]');
      
      await expect(page.locator('[data-testid="roi-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="timeline-chart"]')).toBeVisible();
    });

    test('should make new investment', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Click on a pitch with approved NDA
      await page.click('[data-testid="pitch-card"]:first-child');
      
      // If NDA is approved, should see invest button
      const investButton = page.locator('[data-testid="invest-button"]');
      
      if (await investButton.isVisible()) {
        await investButton.click();
        
        // Fill investment form
        await page.fill('[data-testid="investment-amount"]', '1000000');
        await page.selectOption('[data-testid="investment-type"]', 'equity');
        await page.fill('[data-testid="terms"]', 'Standard equity investment terms');
        
        await page.click('[data-testid="submit-investment"]');
        await pageHelper.waitForNotification('success');
      }
    });
  });

  test.describe('Notifications', () => {
    test('should display notification bell', async ({ page }) => {
      await expect(page.locator('[data-testid="notification-bell"]')).toBeVisible();
    });

    test('should show notification dropdown', async ({ page }) => {
      await page.click('[data-testid="notification-bell"]');
      await expect(page.locator('[data-testid="notification-dropdown"]')).toBeVisible();
    });

    test('should mark notifications as read', async ({ page }) => {
      await page.click('[data-testid="notification-bell"]');
      
      const unreadNotifications = page.locator('[data-testid="unread-notification"]');
      const count = await unreadNotifications.count();
      
      if (count > 0) {
        await unreadNotifications.first().click();
        await expect(unreadNotifications.first().locator('[data-testid="read-indicator"]')).toBeVisible();
      }
    });
  });

  test.describe('Settings and Profile', () => {
    test('should access investor profile settings', async ({ page }) => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      await expect(page.locator('[data-testid="profile-form"]')).toBeVisible();
      await expect(page.locator('[data-testid="investment-preferences"]')).toBeVisible();
      await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    });

    test('should update investment preferences', async ({ page }) => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      // Update preferences
      await page.check('[data-testid="genre-action"]');
      await page.check('[data-testid="genre-drama"]');
      await page.fill('[data-testid="min-budget"]', '1000000');
      await page.fill('[data-testid="max-budget"]', '50000000');
      
      await page.click('[data-testid="save-preferences-button"]');
      await pageHelper.waitForNotification('success');
    });

    test('should configure notification preferences', async ({ page }) => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      // Navigate to notifications tab
      await page.click('[data-testid="notifications-tab"]');
      
      // Update notification settings
      await page.check('[data-testid="email-nda-updates"]');
      await page.check('[data-testid="push-new-pitches"]');
      await page.uncheck('[data-testid="email-marketing"]');
      
      await page.click('[data-testid="save-notifications-button"]');
      await pageHelper.waitForNotification('success');
    });
  });

  test.describe('Access Control Verification', () => {
    test('should not be able to create pitches', async ({ page }) => {
      // Try to navigate to create pitch
      await page.goto('/create-pitch');
      
      // Should be redirected or show access denied
      await expect(page).not.toHaveURL(/create-pitch/);
      await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();
    });

    test('should not see creator-specific features', async ({ page }) => {
      // Should not see creator navigation items
      await expect(page.locator('[data-testid="create-pitch-nav"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="manage-pitches-nav"]')).not.toBeVisible();
    });
  });
});