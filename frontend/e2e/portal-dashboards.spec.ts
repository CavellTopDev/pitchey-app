import { test, expect } from '@playwright/test';
import { TEST_USERS, URLS } from './fixtures/test-data';

test.describe('Portal Dashboards Data Validation', () => {
  test('Creator dashboard loads with complete data and functionality', async ({ page }) => {
    await test.step('Login and navigate to creator dashboard', async () => {
      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/creator/dashboard');
    });

    await test.step('Verify dashboard header and navigation', async () => {
      // Check dashboard title
      await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
      await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Creator Dashboard');

      // Verify user profile section
      await expect(page.locator('[data-testid="user-profile-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-name"]')).toContainText(TEST_USERS.creator.name);

      // Check main navigation elements
      await expect(page.locator('[data-testid="nav-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-pitches"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-analytics"]')).toBeVisible();
      await expect(page.locator('[data-testid="nav-nda-management"]')).toBeVisible();
    });

    await test.step('Verify statistics cards load correctly', async () => {
      // Total pitches stat
      const totalPitchesCard = page.locator('[data-testid="stat-total-pitches"]');
      await expect(totalPitchesCard).toBeVisible();
      await expect(totalPitchesCard.locator('[data-testid="stat-value"]')).toBeVisible();
      
      // Active NDAs stat
      const activeNDAsCard = page.locator('[data-testid="stat-active-ndas"]');
      await expect(activeNDAsCard).toBeVisible();
      await expect(activeNDAsCard.locator('[data-testid="stat-value"]')).toBeVisible();

      // Total views stat
      const totalViewsCard = page.locator('[data-testid="stat-total-views"]');
      await expect(totalViewsCard).toBeVisible();
      await expect(totalViewsCard.locator('[data-testid="stat-value"]')).toBeVisible();

      // Pending requests stat
      const pendingRequestsCard = page.locator('[data-testid="stat-pending-requests"]');
      await expect(pendingRequestsCard).toBeVisible();
      await expect(pendingRequestsCard.locator('[data-testid="stat-value"]')).toBeVisible();
    });

    await test.step('Verify recent activity section', async () => {
      const recentActivitySection = page.locator('[data-testid="recent-activity-section"]');
      await expect(recentActivitySection).toBeVisible();

      // Check if there are activity items or empty state
      const activityItems = page.locator('[data-testid="activity-item"]');
      const emptyState = page.locator('[data-testid="empty-activity-state"]');
      
      const hasActivity = await activityItems.count() > 0;
      const hasEmptyState = await emptyState.count() > 0;
      
      expect(hasActivity || hasEmptyState).toBe(true);

      if (hasActivity) {
        // Verify activity item structure
        const firstActivity = activityItems.first();
        await expect(firstActivity.locator('[data-testid="activity-type"]')).toBeVisible();
        await expect(firstActivity.locator('[data-testid="activity-timestamp"]')).toBeVisible();
      }
    });

    await test.step('Verify quick actions section', async () => {
      const quickActionsSection = page.locator('[data-testid="quick-actions-section"]');
      await expect(quickActionsSection).toBeVisible();

      // Check for quick action buttons
      await expect(page.locator('[data-testid="quick-action-create-pitch"]')).toBeVisible();
      await expect(page.locator('[data-testid="quick-action-view-analytics"]')).toBeVisible();
      await expect(page.locator('[data-testid="quick-action-manage-ndas"]')).toBeVisible();
    });

    await test.step('Verify notifications section', async () => {
      // Check notifications bell
      const notificationsBell = page.locator('[data-testid="notifications-bell"]');
      await expect(notificationsBell).toBeVisible();

      // Click to open notifications dropdown
      await notificationsBell.click();
      await expect(page.locator('[data-testid="notifications-dropdown"]')).toBeVisible();

      // Verify unread count or empty state
      const unreadNotifications = page.locator('[data-testid="notification-item"]');
      const emptyNotifications = page.locator('[data-testid="empty-notifications"]');
      
      const hasNotifications = await unreadNotifications.count() > 0;
      const hasEmptyState = await emptyNotifications.count() > 0;
      
      expect(hasNotifications || hasEmptyState).toBe(true);
    });

    await test.step('Test quick action functionality', async () => {
      // Test create pitch quick action
      await page.click('[data-testid="quick-action-create-pitch"]');
      await page.waitForURL('**/create-pitch');
      await expect(page.locator('[data-testid="create-pitch-form"]')).toBeVisible();

      // Go back to dashboard
      await page.goto(URLS.creatorDashboard);
      
      // Test view analytics quick action
      await page.click('[data-testid="quick-action-view-analytics"]');
      await page.waitForURL('**/creator/analytics');
      await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();

      // Go back to dashboard
      await page.goto(URLS.creatorDashboard);
      
      // Test manage NDAs quick action
      await page.click('[data-testid="quick-action-manage-ndas"]');
      await page.waitForURL('**/creator/nda-management');
      await expect(page.locator('[data-testid="nda-management-tabs"]')).toBeVisible();
    });
  });

  test('Investor dashboard shows portfolio and investment data', async ({ page }) => {
    await test.step('Login and navigate to investor dashboard', async () => {
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/investor/dashboard');
    });

    await test.step('Verify investor-specific statistics', async () => {
      // Portfolio value
      const portfolioValueCard = page.locator('[data-testid="stat-portfolio-value"]');
      await expect(portfolioValueCard).toBeVisible();
      const portfolioValue = await portfolioValueCard.locator('[data-testid="stat-value"]').textContent();
      expect(portfolioValue).toBeTruthy();

      // Active investments
      const activeInvestmentsCard = page.locator('[data-testid="stat-active-investments"]');
      await expect(activeInvestmentsCard).toBeVisible();

      // Total ROI
      const totalROICard = page.locator('[data-testid="stat-total-roi"]');
      await expect(totalROICard).toBeVisible();

      // Signed NDAs
      const signedNDAsCard = page.locator('[data-testid="stat-signed-ndas"]');
      await expect(signedNDAsCard).toBeVisible();
    });

    await test.step('Verify portfolio overview section', async () => {
      const portfolioSection = page.locator('[data-testid="portfolio-overview-section"]');
      await expect(portfolioSection).toBeVisible();

      // Check for portfolio items or empty state
      const portfolioItems = page.locator('[data-testid="portfolio-item"]');
      const emptyPortfolio = page.locator('[data-testid="empty-portfolio-state"]');
      
      const hasPortfolio = await portfolioItems.count() > 0;
      const hasEmptyState = await emptyPortfolio.count() > 0;
      
      expect(hasPortfolio || hasEmptyState).toBe(true);

      if (hasPortfolio) {
        const firstItem = portfolioItems.first();
        await expect(firstItem.locator('[data-testid="investment-title"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="investment-amount"]')).toBeVisible();
        await expect(firstItem.locator('[data-testid="investment-status"]')).toBeVisible();
      }
    });

    await test.step('Verify market trends section', async () => {
      const marketTrendsSection = page.locator('[data-testid="market-trends-section"]');
      if (await marketTrendsSection.count() > 0) {
        await expect(marketTrendsSection).toBeVisible();
        await expect(marketTrendsSection.locator('[data-testid="trends-chart"]')).toBeVisible();
      }
    });

    await test.step('Test investor quick actions', async () => {
      // Discover new pitches
      await page.click('[data-testid="quick-action-discover-pitches"]');
      await page.waitForURL('**/investor/discover');
      await expect(page.locator('[data-testid="pitch-discovery-page"]')).toBeVisible();

      await page.goto(URLS.investorDashboard);

      // View portfolio
      await page.click('[data-testid="quick-action-view-portfolio"]');
      await page.waitForURL('**/investor/portfolio');
      await expect(page.locator('[data-testid="portfolio-page"]')).toBeVisible();
    });
  });

  test('Production dashboard displays project and submission data', async ({ page }) => {
    await test.step('Login and navigate to production dashboard', async () => {
      await page.goto(URLS.productionLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.production.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.production.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/production/dashboard');
    });

    await test.step('Verify production-specific statistics', async () => {
      // Active projects
      const activeProjectsCard = page.locator('[data-testid="stat-active-projects"]');
      await expect(activeProjectsCard).toBeVisible();

      // Submissions this month
      const submissionsCard = page.locator('[data-testid="stat-monthly-submissions"]');
      await expect(submissionsCard).toBeVisible();

      // Projects in development
      const developmentCard = page.locator('[data-testid="stat-projects-development"]');
      await expect(developmentCard).toBeVisible();

      // Total revenue
      const revenueCard = page.locator('[data-testid="stat-total-revenue"]');
      await expect(revenueCard).toBeVisible();
    });

    await test.step('Verify project pipeline section', async () => {
      const pipelineSection = page.locator('[data-testid="project-pipeline-section"]');
      await expect(pipelineSection).toBeVisible();

      // Check for pipeline items or empty state
      const pipelineItems = page.locator('[data-testid="pipeline-item"]');
      const emptyPipeline = page.locator('[data-testid="empty-pipeline-state"]');
      
      const hasPipeline = await pipelineItems.count() > 0;
      const hasEmptyState = await emptyPipeline.count() > 0;
      
      expect(hasPipeline || hasEmptyState).toBe(true);

      if (hasPipeline) {
        const firstProject = pipelineItems.first();
        await expect(firstProject.locator('[data-testid="project-title"]')).toBeVisible();
        await expect(firstProject.locator('[data-testid="project-stage"]')).toBeVisible();
        await expect(firstProject.locator('[data-testid="project-budget"]')).toBeVisible();
      }
    });

    await test.step('Verify recent submissions section', async () => {
      const submissionsSection = page.locator('[data-testid="recent-submissions-section"]');
      await expect(submissionsSection).toBeVisible();

      const submissionItems = page.locator('[data-testid="submission-item"]');
      const emptySubmissions = page.locator('[data-testid="empty-submissions-state"]');
      
      const hasSubmissions = await submissionItems.count() > 0;
      const hasEmptyState = await emptySubmissions.count() > 0;
      
      expect(hasSubmissions || hasEmptyState).toBe(true);
    });

    await test.step('Test production quick actions', async () => {
      // Review submissions
      await page.click('[data-testid="quick-action-review-submissions"]');
      await page.waitForURL('**/production/submissions');
      await expect(page.locator('[data-testid="submissions-page"]')).toBeVisible();

      await page.goto(URLS.productionDashboard);

      // View projects
      await page.click('[data-testid="quick-action-view-projects"]');
      await page.waitForURL('**/production/projects');
      await expect(page.locator('[data-testid="projects-page"]')).toBeVisible();
    });
  });

  test('Dashboard API endpoints and real-time updates', async ({ page }) => {
    await test.step('Validate dashboard API calls', async () => {
      const apiCalls = {
        dashboardStats: false,
        recentActivity: false,
        notifications: false,
        quickStats: false
      };

      page.on('response', response => {
        const url = response.url();
        if (url.includes('/api/dashboard/stats')) apiCalls.dashboardStats = true;
        if (url.includes('/api/dashboard/activity')) apiCalls.recentActivity = true;
        if (url.includes('/api/notifications/unread')) apiCalls.notifications = true;
        if (url.includes('/api/dashboard/quick-stats')) apiCalls.quickStats = true;
      });

      // Login as creator and trigger dashboard load
      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/creator/dashboard');

      // Wait for all API calls to complete
      await page.waitForTimeout(3000);

      // Verify critical API endpoints were called
      expect(apiCalls.dashboardStats || apiCalls.quickStats).toBe(true);
      expect(apiCalls.notifications).toBe(true);
    });

    await test.step('Test real-time updates via WebSocket', async () => {
      // Login as creator
      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/creator/dashboard');

      // Get initial notification count
      const notificationsBell = page.locator('[data-testid="notifications-bell"]');
      const initialBadge = page.locator('[data-testid="notification-badge"]');
      const initialCount = await initialBadge.textContent() || '0';

      // Wait for potential WebSocket updates
      await page.waitForTimeout(5000);

      // Check if WebSocket connection is established
      const wsIndicator = page.locator('[data-testid="websocket-status"]');
      if (await wsIndicator.count() > 0) {
        await expect(wsIndicator).toHaveText('connected');
      }
    });
  });

  test('Dashboard responsive design and mobile optimization', async ({ page }) => {
    await test.step('Test dashboard on mobile viewport', async () => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/investor/dashboard');

      // Verify mobile navigation
      const mobileNav = page.locator('[data-testid="mobile-nav-toggle"]');
      if (await mobileNav.count() > 0) {
        await expect(mobileNav).toBeVisible();
        await mobileNav.click();
        await expect(page.locator('[data-testid="mobile-nav-menu"]')).toBeVisible();
      }

      // Verify stats cards are stacked properly
      const statsCards = page.locator('[data-testid^="stat-"]');
      const firstCard = statsCards.first();
      const secondCard = statsCards.nth(1);
      
      if (await statsCards.count() > 1) {
        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();
        
        if (firstCardBox && secondCardBox) {
          // On mobile, cards should be stacked (second card below first)
          expect(secondCardBox.y).toBeGreaterThan(firstCardBox.y + firstCardBox.height - 10);
        }
      }
    });

    await test.step('Test dashboard on tablet viewport', async () => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();

      // Verify tablet layout
      const statsGrid = page.locator('[data-testid="stats-grid"]');
      await expect(statsGrid).toBeVisible();

      // Stats should be in a 2x2 grid on tablet
      const statsCards = page.locator('[data-testid^="stat-"]');
      if (await statsCards.count() >= 2) {
        const firstCard = await statsCards.first().boundingBox();
        const secondCard = await statsCards.nth(1).boundingBox();
        
        if (firstCard && secondCard) {
          // Cards should be side by side
          expect(Math.abs(firstCard.y - secondCard.y)).toBeLessThan(50);
        }
      }
    });
  });

  test('Dashboard error handling and loading states', async ({ page }) => {
    await test.step('Handle API failures gracefully', async () => {
      // Mock API failures
      await page.route('**/api/dashboard/stats', route => {
        route.fulfill({ status: 500, body: 'Internal Server Error' });
      });

      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/investor/dashboard');

      // Verify error states are displayed
      const errorStates = page.locator('[data-testid="stats-error"], [data-testid="dashboard-error"]');
      await expect(errorStates.first()).toBeVisible();
    });

    await test.step('Verify loading states', async () => {
      // Slow down API responses to see loading states
      await page.route('**/api/dashboard/**', route => {
        setTimeout(() => route.continue(), 2000);
      });

      await page.goto(URLS.creatorDashboard);

      // Should see loading indicators
      const loadingIndicators = page.locator('[data-testid="loading-stats"], [data-testid="dashboard-loading"]');
      await expect(loadingIndicators.first()).toBeVisible();

      // Wait for loading to complete
      await page.waitForTimeout(3000);
      await expect(loadingIndicators.first()).not.toBeVisible();
    });
  });
});