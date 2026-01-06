import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';

test.describe('Production Workflows', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    
    // Login as production company before each test
    await authHelper.loginAsProduction();
  });

  test.describe('Dashboard', () => {
    test('should display production dashboard with key metrics', async ({ page }) => {
      await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Production Dashboard');
      
      // Check for key dashboard components
      await expect(page.locator('[data-testid="active-projects"]')).toBeVisible();
      await expect(page.locator('[data-testid="partnership-opportunities"]')).toBeVisible();
      await expect(page.locator('[data-testid="budget-overview"]')).toBeVisible();
      
      // Check for navigation links
      await expect(page.locator('[data-testid="browse-pitches-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-management-link"]')).toBeVisible();
    });

    test('should show production analytics', async ({ page }) => {
      const analyticsSection = page.locator('[data-testid="production-analytics"]');
      await expect(analyticsSection).toBeVisible();
      
      // Check for specific metrics
      await expect(page.locator('[data-testid="projects-in-development"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-budget-allocated"]')).toBeVisible();
      await expect(page.locator('[data-testid="partnership-revenue"]')).toBeVisible();
    });

    test('should display recent activity', async ({ page }) => {
      const activitySection = page.locator('[data-testid="recent-activity"]');
      await expect(activitySection).toBeVisible();
    });

    test('should allow logout functionality', async () => {
      await authHelper.logout();
      await authHelper.verifyNotAuthenticated();
    });
  });

  test.describe('Browse and Evaluate Pitches', () => {
    test('should display pitch marketplace for production companies', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      await expect(page.locator('[data-testid="pitch-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-filters"]')).toBeVisible();
      await expect(page.locator('[data-testid="budget-analyzer"]')).toBeVisible();
    });

    test('should filter pitches by production requirements', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Open production-specific filters
      await page.click('[data-testid="production-filter-toggle"]');
      
      // Set budget range suitable for production
      await page.fill('[data-testid="budget-min"]', '5000000');
      await page.fill('[data-testid="budget-max"]', '50000000');
      
      // Select genres the production company specializes in
      await page.check('[data-testid="genre-action"]');
      await page.check('[data-testid="genre-thriller"]');
      
      // Filter by production timeline
      await page.selectOption('[data-testid="timeline-filter"]', 'within-12-months');
      
      await page.click('[data-testid="apply-filters-button"]');
      
      // Verify filtered results
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('$5M - $50M');
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Action');
    });

    test('should evaluate pitch feasibility', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Click on a pitch to view details
      await page.click('[data-testid="pitch-card"]:first-child');
      
      // Should see production-specific evaluation tools
      await expect(page.locator('[data-testid="feasibility-analyzer"]')).toBeVisible();
      await expect(page.locator('[data-testid="budget-breakdown"]')).toBeVisible();
      await expect(page.locator('[data-testid="market-analysis"]')).toBeVisible();
      await expect(page.locator('[data-testid="risk-assessment"]')).toBeVisible();
    });

    test('should request production partnership', async ({ page }) => {
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Click on a suitable pitch
      await page.click('[data-testid="pitch-card"]:first-child');
      
      // Request partnership
      await page.click('[data-testid="request-partnership-button"]');
      
      // Fill partnership proposal form
      await page.fill('[data-testid="proposal-message"]', 'We are interested in partnering on this project. Our production company has experience in similar genres.');
      await page.fill('[data-testid="proposed-budget"]', '25000000');
      await page.selectOption('[data-testid="partnership-type"]', 'co-production');
      await page.fill('[data-testid="timeline"]', 'Q2 2024 start date');
      
      await page.click('[data-testid="submit-partnership-request"]');
      await pageHelper.waitForNotification('success');
      
      // Verify request was sent
      await expect(page.locator('[data-testid="partnership-status"]')).toContainText('Request Sent');
    });
  });

  test.describe('Project Management', () => {
    test('should view active production projects', async ({ page }) => {
      await page.click('[data-testid="project-management-link"]');
      
      await expect(page.locator('[data-testid="projects-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-status-filter"]')).toBeVisible();
      await expect(page.locator('[data-testid="timeline-view"]')).toBeVisible();
    });

    test('should create new production project', async ({ page }) => {
      await page.click('[data-testid="project-management-link"]');
      
      // Create new project
      await page.click('[data-testid="create-project-button"]');
      
      // Fill project form
      await page.fill('[data-testid="project-title"]', 'Test Production Project');
      await page.fill('[data-testid="project-description"]', 'A comprehensive test of the production project system');
      await page.selectOption('[data-testid="project-type"]', 'feature-film');
      await page.fill('[data-testid="estimated-budget"]', '15000000');
      await page.fill('[data-testid="target-start-date"]', '2024-06-01');
      await page.fill('[data-testid="estimated-duration"]', '120');
      
      await page.click('[data-testid="create-project-button"]');
      await pageHelper.waitForNotification('success');
      
      // Verify project appears in list
      await expect(page.locator('[data-testid="projects-table"]')).toContainText('Test Production Project');
    });

    test('should update project status', async ({ page }) => {
      await page.click('[data-testid="project-management-link"]');
      
      // Click on first project
      await page.click('[data-testid="project-row"]:first-child');
      
      // Update status
      await page.selectOption('[data-testid="project-status-select"]', 'in-pre-production');
      await page.click('[data-testid="update-status-button"]');
      await pageHelper.waitForNotification('success');
      
      // Verify status update
      await expect(page.locator('[data-testid="current-status"]')).toContainText('Pre-Production');
    });

    test('should track project budget and expenses', async ({ page }) => {
      await page.click('[data-testid="project-management-link"]');
      
      // Click on a project
      await page.click('[data-testid="project-row"]:first-child');
      
      // Navigate to budget tracking
      await page.click('[data-testid="budget-tab"]');
      
      await expect(page.locator('[data-testid="budget-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="expense-tracking"]')).toBeVisible();
      await expect(page.locator('[data-testid="budget-vs-actual-chart"]')).toBeVisible();
    });
  });

  test.describe('Partnership Management', () => {
    test('should view partnership opportunities', async ({ page }) => {
      await page.click('[data-testid="partnerships-link"]');
      
      await expect(page.locator('[data-testid="partnerships-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="partnership-filters"]')).toBeVisible();
    });

    test('should respond to partnership requests', async ({ page }) => {
      await page.click('[data-testid="partnerships-link"]');
      
      // Click on pending partnership request
      const pendingRequest = page.locator('[data-testid="partnership-row"]').filter({ hasText: 'Pending' }).first();
      
      if (await pendingRequest.count() > 0) {
        await pendingRequest.click();
        
        // Respond to request
        await page.click('[data-testid="respond-button"]');
        
        // Accept partnership
        await page.click('[data-testid="accept-partnership"]');
        await page.fill('[data-testid="response-message"]', 'We accept this partnership proposal. Looking forward to working together.');
        await page.click('[data-testid="send-response"]');
        
        await pageHelper.waitForNotification('success');
      }
    });

    test('should negotiate partnership terms', async ({ page }) => {
      await page.click('[data-testid="partnerships-link"]');
      
      // Click on partnership in negotiation
      await page.click('[data-testid="partnership-row"]:first-child');
      
      // Open negotiation panel
      await page.click('[data-testid="negotiate-terms-button"]');
      
      // Update terms
      await page.fill('[data-testid="counter-budget"]', '30000000');
      await page.fill('[data-testid="counter-timeline"]', 'Q3 2024');
      await page.fill('[data-testid="additional-terms"]', 'Require creative control approval');
      
      await page.click('[data-testid="submit-counter-offer"]');
      await pageHelper.waitForNotification('success');
    });
  });

  test.describe('Analytics and Reporting', () => {
    test('should view production analytics dashboard', async ({ page }) => {
      await page.click('[data-testid="analytics-link"]');
      
      await expect(page.locator('[data-testid="production-metrics"]')).toBeVisible();
      await expect(page.locator('[data-testid="financial-overview"]')).toBeVisible();
      await expect(page.locator('[data-testid="project-timeline-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="roi-analysis"]')).toBeVisible();
    });

    test('should generate production reports', async ({ page }) => {
      await page.click('[data-testid="analytics-link"]');
      
      // Generate quarterly report
      await page.click('[data-testid="generate-report-button"]');
      await page.selectOption('[data-testid="report-type"]', 'quarterly');
      await page.selectOption('[data-testid="report-period"]', 'Q1-2024');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-report"]');
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('production-report');
    });

    test('should track market trends', async ({ page }) => {
      await page.click('[data-testid="analytics-link"]');
      
      // Navigate to market analysis
      await page.click('[data-testid="market-trends-tab"]');
      
      await expect(page.locator('[data-testid="genre-trends-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="budget-trends-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="market-opportunities"]')).toBeVisible();
    });
  });

  test.describe('Resource Management', () => {
    test('should manage production resources', async ({ page }) => {
      await page.click('[data-testid="resources-link"]');
      
      await expect(page.locator('[data-testid="crew-management"]')).toBeVisible();
      await expect(page.locator('[data-testid="equipment-inventory"]')).toBeVisible();
      await expect(page.locator('[data-testid="location-scouting"]')).toBeVisible();
    });

    test('should schedule production timeline', async ({ page }) => {
      await page.click('[data-testid="resources-link"]');
      
      // Navigate to scheduling
      await page.click('[data-testid="scheduling-tab"]');
      
      await expect(page.locator('[data-testid="production-calendar"]')).toBeVisible();
      await expect(page.locator('[data-testid="milestone-tracker"]')).toBeVisible();
    });
  });

  test.describe('Communication and Collaboration', () => {
    test('should communicate with project stakeholders', async ({ page }) => {
      await page.click('[data-testid="project-management-link"]');
      
      // Click on a project
      await page.click('[data-testid="project-row"]:first-child');
      
      // Navigate to communications
      await page.click('[data-testid="communications-tab"]');
      
      await expect(page.locator('[data-testid="stakeholder-list"]')).toBeVisible();
      await expect(page.locator('[data-testid="message-center"]')).toBeVisible();
    });

    test('should send project updates', async ({ page }) => {
      await page.click('[data-testid="project-management-link"]');
      
      // Click on a project
      await page.click('[data-testid="project-row"]:first-child');
      
      // Send update
      await page.click('[data-testid="send-update-button"]');
      await page.fill('[data-testid="update-title"]', 'Weekly Progress Update');
      await page.fill('[data-testid="update-message"]', 'Pre-production is proceeding on schedule. Casting sessions completed.');
      
      await page.click('[data-testid="send-update"]');
      await pageHelper.waitForNotification('success');
    });
  });

  test.describe('Settings and Configuration', () => {
    test('should access production company settings', async ({ page }) => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      await expect(page.locator('[data-testid="company-profile"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-preferences"]')).toBeVisible();
      await expect(page.locator('[data-testid="notification-settings"]')).toBeVisible();
    });

    test('should update production preferences', async ({ page }) => {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="settings-link"]');
      
      // Update preferences
      await page.check('[data-testid="genre-action"]');
      await page.check('[data-testid="genre-drama"]');
      await page.fill('[data-testid="preferred-budget-range"]', '10000000-75000000');
      await page.selectOption('[data-testid="production-scale"]', 'medium-large');
      
      await page.click('[data-testid="save-preferences-button"]');
      await pageHelper.waitForNotification('success');
    });
  });

  test.describe('Access Control Verification', () => {
    test('should not be able to create pitches as investor would', async ({ page }) => {
      // Try to navigate to investor-specific features
      await page.goto('/investor/dashboard');
      
      // Should be redirected or show access denied
      await expect(page).not.toHaveURL(/investor/);
    });

    test('should see production-specific features only', async ({ page }) => {
      // Should see production navigation items
      await expect(page.locator('[data-testid="project-management-nav"]')).toBeVisible();
      await expect(page.locator('[data-testid="partnerships-nav"]')).toBeVisible();
      
      // Should not see creator-specific items
      await expect(page.locator('[data-testid="create-pitch-nav"]')).not.toBeVisible();
    });
  });
});