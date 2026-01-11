import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';

test.describe('Visual Regression Testing - Comprehensive Portal Coverage', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: ensure logged out
    try {
      await authHelper.logout();
    } catch (error) {
      console.warn('Cleanup logout failed:', error);
    }
  });

  test.describe('Creator Portal Visual Regression', () => {
    test('creator dashboard visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await page.goto('/creator/dashboard');
      await pageHelper.waitForPageLoad();
      
      // Wait for all dashboard components to load
      await page.waitForTimeout(2000);
      
      // Hide dynamic content that changes frequently
      await page.addStyleTag({
        content: `
          [data-testid="last-login"],
          [data-testid="current-time"],
          .timestamp,
          .time-ago {
            visibility: hidden !important;
          }
        `
      });
      
      // Take screenshot of full dashboard
      await expect(page).toHaveScreenshot('creator-dashboard-full.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1000
      });
      
      // Take screenshot of key sections
      const dashboardSections = [
        '[data-testid="dashboard-header"]',
        '[data-testid="quick-stats"]',
        '[data-testid="recent-pitches"]',
        '[data-testid="nda-requests"]',
        '[data-testid="analytics-preview"]'
      ];
      
      for (const section of dashboardSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          const sectionName = section.replace(/\[data-testid="([^"]+)"\]/, '$1');
          await expect(element).toHaveScreenshot(`creator-${sectionName}.png`, {
            threshold: 0.2
          });
        }
      }
    });

    test('creator pitch management visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      // Hide dynamic content
      await page.addStyleTag({
        content: `
          .last-modified,
          .created-at,
          .updated-at {
            visibility: hidden !important;
          }
        `
      });
      
      // Screenshot of pitch management interface
      await expect(page).toHaveScreenshot('creator-pitches-management.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1500
      });
      
      // Test different tabs if they exist
      const tabs = ['published', 'drafts', 'under-review'];
      for (const tab of tabs) {
        const tabElement = page.locator(`[data-testid="${tab}-tab"]`);
        if (await tabElement.count() > 0) {
          await tabElement.click();
          await pageHelper.waitForPageLoad();
          
          await expect(page.locator('[data-testid="pitch-list"]')).toHaveScreenshot(
            `creator-pitches-${tab}.png`,
            { threshold: 0.2 }
          );
        }
      }
    });

    test('creator analytics visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await page.goto('/creator/analytics');
      await pageHelper.waitForPageLoad();
      
      // Wait for charts to render
      await page.waitForTimeout(3000);
      
      // Hide dynamic numbers that change
      await page.addStyleTag({
        content: `
          .metric-number,
          .chart-value,
          .percentage-change {
            visibility: hidden !important;
          }
        `
      });
      
      // Screenshot analytics dashboard
      await expect(page).toHaveScreenshot('creator-analytics-dashboard.png', {
        fullPage: true,
        threshold: 0.3,
        maxDiffPixels: 2000
      });
      
      // Test analytics components individually
      const analyticsComponents = [
        '[data-testid="pitch-performance-chart"]',
        '[data-testid="engagement-metrics"]',
        '[data-testid="follower-growth"]',
        '[data-testid="nda-analytics"]'
      ];
      
      for (const component of analyticsComponents) {
        const element = page.locator(component);
        if (await element.count() > 0) {
          const componentName = component.replace(/\[data-testid="([^"]+)"\]/, '$1');
          await expect(element).toHaveScreenshot(`creator-${componentName}.png`, {
            threshold: 0.3
          });
        }
      }
    });

    test('creator profile visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await page.goto('/creator/profile');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('creator-profile.png', {
        fullPage: true,
        threshold: 0.2
      });
    });

    test('creator settings visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await page.goto('/creator/settings');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('creator-settings.png', {
        fullPage: true,
        threshold: 0.2
      });
    });
  });

  test.describe('Investor Portal Visual Regression', () => {
    test('investor dashboard visual consistency', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await page.goto('/investor/dashboard');
      await pageHelper.waitForPageLoad();
      
      // Wait for dashboard components
      await page.waitForTimeout(2000);
      
      // Hide dynamic content
      await page.addStyleTag({
        content: `
          [data-testid="market-prices"],
          [data-testid="portfolio-value"],
          .real-time-data,
          .timestamp {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('investor-dashboard-full.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1000
      });
      
      // Key investor dashboard sections
      const investorSections = [
        '[data-testid="portfolio-overview"]',
        '[data-testid="recent-investments"]',
        '[data-testid="market-opportunities"]',
        '[data-testid="watchlist-preview"]'
      ];
      
      for (const section of investorSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          const sectionName = section.replace(/\[data-testid="([^"]+)"\]/, '$1');
          await expect(element).toHaveScreenshot(`investor-${sectionName}.png`, {
            threshold: 0.2
          });
        }
      }
    });

    test('investor portfolio visual consistency', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await page.goto('/investor/portfolio');
      await pageHelper.waitForPageLoad();
      
      // Wait for portfolio data
      await page.waitForTimeout(2000);
      
      // Hide dynamic financial data
      await page.addStyleTag({
        content: `
          .investment-value,
          .current-value,
          .percentage-return,
          .roi-value {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('investor-portfolio.png', {
        fullPage: true,
        threshold: 0.3,
        maxDiffPixels: 1500
      });
    });

    test('investor discover visual consistency', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Try investor-specific discover page first
      await page.goto('/investor/discover');
      
      // Fallback to general browse if investor discover doesn't exist
      if (page.url().includes('404') || await page.locator('[data-testid="not-found"]').count() > 0) {
        await page.goto('/browse');
      }
      
      await pageHelper.waitForPageLoad();
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('investor-discover.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1000
      });
      
      // Test filter interface
      const filterToggle = page.locator('[data-testid="filter-toggle"], [data-testid="advanced-filters"]');
      if (await filterToggle.count() > 0) {
        await filterToggle.click();
        await page.waitForTimeout(1000);
        
        await expect(page.locator('[data-testid="filter-panel"]')).toHaveScreenshot(
          'investor-filters.png',
          { threshold: 0.2 }
        );
      }
    });

    test('investor analytics visual consistency', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await page.goto('/investor/analytics');
      await pageHelper.waitForPageLoad();
      
      // Wait for analytics to load
      await page.waitForTimeout(3000);
      
      // Hide dynamic financial data
      await page.addStyleTag({
        content: `
          .financial-metric,
          .roi-percentage,
          .investment-return {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('investor-analytics.png', {
        fullPage: true,
        threshold: 0.3,
        maxDiffPixels: 2000
      });
    });

    test('investor NDA history visual consistency', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await page.goto('/investor/nda-history');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('investor-nda-history.png', {
        fullPage: true,
        threshold: 0.2
      });
    });
  });

  test.describe('Production Portal Visual Regression', () => {
    test('production dashboard visual consistency', async ({ page }) => {
      await authHelper.loginAsProduction();
      await page.goto('/production/dashboard');
      await pageHelper.waitForPageLoad();
      
      // Wait for dashboard components
      await page.waitForTimeout(2000);
      
      // Hide dynamic content
      await page.addStyleTag({
        content: `
          .project-deadline,
          .budget-remaining,
          .timeline-progress,
          .timestamp {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('production-dashboard-full.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1000
      });
      
      // Production dashboard sections
      const productionSections = [
        '[data-testid="active-projects"]',
        '[data-testid="pipeline-overview"]',
        '[data-testid="team-status"]',
        '[data-testid="production-metrics"]'
      ];
      
      for (const section of productionSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          const sectionName = section.replace(/\[data-testid="([^"]+)"\]/, '$1');
          await expect(element).toHaveScreenshot(`production-${sectionName}.png`, {
            threshold: 0.2
          });
        }
      }
    });

    test('production projects visual consistency', async ({ page }) => {
      await authHelper.loginAsProduction();
      await page.goto('/production/projects');
      await pageHelper.waitForPageLoad();
      
      await page.waitForTimeout(2000);
      
      // Hide dynamic project data
      await page.addStyleTag({
        content: `
          .project-budget,
          .days-remaining,
          .completion-percentage {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('production-projects.png', {
        fullPage: true,
        threshold: 0.3,
        maxDiffPixels: 1500
      });
      
      // Test project status tabs
      const projectTabs = ['active', 'development', 'post-production', 'completed'];
      for (const tab of projectTabs) {
        const tabElement = page.locator(`[data-testid="${tab}-tab"]`);
        if (await tabElement.count() > 0) {
          await tabElement.click();
          await pageHelper.waitForPageLoad();
          
          await expect(page.locator('[data-testid="project-list"]')).toHaveScreenshot(
            `production-projects-${tab}.png`,
            { threshold: 0.3 }
          );
        }
      }
    });

    test('production submissions visual consistency', async ({ page }) => {
      await authHelper.loginAsProduction();
      await page.goto('/production/submissions');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('production-submissions.png', {
        fullPage: true,
        threshold: 0.2
      });
    });

    test('production analytics visual consistency', async ({ page }) => {
      await authHelper.loginAsProduction();
      await page.goto('/production/analytics');
      await pageHelper.waitForPageLoad();
      
      // Wait for charts
      await page.waitForTimeout(3000);
      
      // Hide dynamic production metrics
      await page.addStyleTag({
        content: `
          .production-cost,
          .efficiency-metric,
          .revenue-projection {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('production-analytics.png', {
        fullPage: true,
        threshold: 0.3,
        maxDiffPixels: 2000
      });
    });
  });

  test.describe('Public Pages Visual Regression', () => {
    test('homepage visual consistency', async ({ page }) => {
      await page.goto('/');
      await pageHelper.waitForPageLoad();
      
      // Wait for all homepage components
      await page.waitForTimeout(2000);
      
      // Hide dynamic content
      await page.addStyleTag({
        content: `
          [data-testid="user-count"],
          [data-testid="pitch-count"],
          .dynamic-stat,
          .counter {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('homepage-full.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1000
      });
      
      // Test key homepage sections
      const homepageSections = [
        '[data-testid="hero-section"]',
        '[data-testid="platform-features"]',
        '[data-testid="how-it-works"]',
        '[data-testid="testimonials"]',
        '[data-testid="featured-pitches"]'
      ];
      
      for (const section of homepageSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          const sectionName = section.replace(/\[data-testid="([^"]+)"\]/, '$1');
          await expect(element).toHaveScreenshot(`homepage-${sectionName}.png`, {
            threshold: 0.2
          });
        }
      }
    });

    test('browse page visual consistency', async ({ page }) => {
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      
      // Wait for content to load
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('browse-public.png', {
        fullPage: true,
        threshold: 0.2,
        maxDiffPixels: 1000
      });
      
      // Test browse tabs
      const browseTabs = ['trending', 'new', 'featured', 'top-rated'];
      for (const tab of browseTabs) {
        const tabElement = page.locator(`[data-testid="${tab}-tab"]`);
        if (await tabElement.count() > 0) {
          await tabElement.click();
          await pageHelper.waitForPageLoad();
          
          await expect(page.locator('[data-testid="pitch-grid"]')).toHaveScreenshot(
            `browse-${tab}.png`,
            { threshold: 0.2 }
          );
        }
      }
    });

    test('search page visual consistency', async ({ page }) => {
      await page.goto('/search');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('search-page.png', {
        fullPage: true,
        threshold: 0.2
      });
      
      // Test search with results
      const searchBar = page.locator('[data-testid="search-bar"], input[type="search"]');
      if (await searchBar.count() > 0) {
        await searchBar.fill('action');
        await page.press('[data-testid="search-bar"]', 'Enter');
        await pageHelper.waitForPageLoad();
        
        await expect(page).toHaveScreenshot('search-results.png', {
          fullPage: true,
          threshold: 0.2
        });
      }
    });

    test('portal selection visual consistency', async ({ page }) => {
      await page.goto('/portal-select');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('portal-selection.png', {
        fullPage: true,
        threshold: 0.2
      });
    });
  });

  test.describe('Responsive Design Visual Regression', () => {
    test('mobile homepage visual consistency', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await pageHelper.waitForPageLoad();
      
      // Wait for mobile layout
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('homepage-mobile.png', {
        fullPage: true,
        threshold: 0.2
      });
    });

    test('tablet dashboard visual consistency', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await authHelper.loginAsCreator();
      await page.goto('/creator/dashboard');
      await pageHelper.waitForPageLoad();
      
      await page.waitForTimeout(2000);
      
      // Hide dynamic content
      await page.addStyleTag({
        content: `
          .timestamp,
          .time-ago,
          .last-updated {
            visibility: hidden !important;
          }
        `
      });
      
      await expect(page).toHaveScreenshot('dashboard-tablet.png', {
        fullPage: true,
        threshold: 0.2
      });
    });

    test('mobile navigation visual consistency', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await authHelper.loginAsCreator();
      await page.goto('/creator/dashboard');
      await pageHelper.waitForPageLoad();
      
      // Open mobile menu if it exists
      const mobileMenuToggle = page.locator('[data-testid="mobile-menu-toggle"], .mobile-nav-toggle');
      if (await mobileMenuToggle.count() > 0) {
        await mobileMenuToggle.click();
        await page.waitForTimeout(500);
        
        await expect(page.locator('[data-testid="mobile-navigation"]')).toHaveScreenshot(
          'mobile-navigation.png',
          { threshold: 0.2 }
        );
      }
    });
  });

  test.describe('Form and Modal Visual Regression', () => {
    test('login forms visual consistency', async ({ page }) => {
      const loginPages = [
        '/creator/login',
        '/investor/login',
        '/production/login'
      ];
      
      for (const loginPage of loginPages) {
        await page.goto(loginPage);
        await pageHelper.waitForPageLoad();
        
        const portalType = loginPage.split('/')[1];
        await expect(page).toHaveScreenshot(`${portalType}-login.png`, {
          threshold: 0.2
        });
      }
    });

    test('pitch creation form visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('pitch-creation-form.png', {
        fullPage: true,
        threshold: 0.2
      });
    });

    test('NDA request modal visual consistency', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      
      // Find a pitch and try to trigger NDA request modal
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      if (await pitchCards.count() > 0) {
        await pitchCards.first().click();
        await pageHelper.waitForPageLoad();
        
        const ndaButton = page.locator('[data-testid="request-nda-button"], button:has-text("Request NDA")');
        if (await ndaButton.count() > 0) {
          await ndaButton.click();
          await page.waitForTimeout(1000);
          
          const ndaModal = page.locator('[data-testid="nda-request-modal"], .nda-modal');
          if (await ndaModal.count() > 0) {
            await expect(ndaModal).toHaveScreenshot('nda-request-modal.png', {
              threshold: 0.2
            });
          }
        }
      }
    });
  });

  test.describe('Error States Visual Regression', () => {
    test('404 page visual consistency', async ({ page }) => {
      await page.goto('/non-existent-page');
      await pageHelper.waitForPageLoad();
      
      await expect(page).toHaveScreenshot('404-page.png', {
        threshold: 0.2
      });
    });

    test('unauthorized access visual consistency', async ({ page }) => {
      // Try to access protected page without authentication
      await page.goto('/creator/dashboard');
      
      // Should redirect to login or show unauthorized message
      await page.waitForTimeout(2000);
      
      if (page.url().includes('/login')) {
        await expect(page).toHaveScreenshot('unauthorized-redirect.png', {
          threshold: 0.2
        });
      } else {
        const unauthorizedMessage = page.locator('[data-testid="unauthorized"], .unauthorized');
        if (await unauthorizedMessage.count() > 0) {
          await expect(unauthorizedMessage).toHaveScreenshot('unauthorized-message.png', {
            threshold: 0.2
          });
        }
      }
    });
  });

  test.describe('Loading States Visual Regression', () => {
    test('loading spinners visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Intercept network requests to simulate slow loading
      await page.route('**/api/**', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.continue();
      });
      
      await page.goto('/creator/analytics');
      
      // Capture loading state
      const loadingSpinner = page.locator('[data-testid="loading-spinner"], .loading, .spinner');
      if (await loadingSpinner.count() > 0) {
        await expect(loadingSpinner.first()).toHaveScreenshot('loading-spinner.png', {
          threshold: 0.2
        });
      }
      
      // Wait for content to load and clear route intercept
      await page.unroute('**/api/**');
      await pageHelper.waitForPageLoad();
    });

    test('skeleton screens visual consistency', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Look for skeleton loading states
      await page.goto('/creator/dashboard');
      
      const skeletonElements = page.locator('[data-testid="skeleton-loader"], .skeleton');
      if (await skeletonElements.count() > 0) {
        await expect(skeletonElements.first()).toHaveScreenshot('skeleton-loader.png', {
          threshold: 0.2
        });
      }
    });
  });
});