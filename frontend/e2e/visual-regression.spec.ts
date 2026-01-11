import { test, expect } from '@playwright/test';
import { TEST_USERS, URLS } from './fixtures/test-data';
import { setupCompleteMocks } from './fixtures/api-mocks';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Use mocked APIs for consistent visual testing
    await setupCompleteMocks(page);
  });

  test.describe('Portal Dashboards Visual Comparison', () => {
    test('Creator dashboard visual baseline', async ({ page }) => {
      await test.step('Navigate to creator dashboard', async () => {
        await page.goto(URLS.creatorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/creator/dashboard');
      });

      await test.step('Wait for dashboard to fully load', async () => {
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="stat-total-pitches"]')).toBeVisible();
        
        // Wait for any animations to complete
        await page.waitForTimeout(1000);
      });

      await test.step('Capture full dashboard screenshot', async () => {
        await expect(page).toHaveScreenshot('creator-dashboard-full.png', {
          fullPage: true,
          threshold: 0.3 // 30% threshold for acceptable differences
        });
      });

      await test.step('Capture stats section', async () => {
        const statsSection = page.locator('[data-testid="stats-grid"]');
        await expect(statsSection).toHaveScreenshot('creator-dashboard-stats.png', {
          threshold: 0.2
        });
      });

      await test.step('Capture recent activity section', async () => {
        const activitySection = page.locator('[data-testid="recent-activity-section"]');
        await expect(activitySection).toHaveScreenshot('creator-dashboard-activity.png', {
          threshold: 0.2
        });
      });
    });

    test('Investor dashboard visual baseline', async ({ page }) => {
      await test.step('Navigate to investor dashboard', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/investor/dashboard');
      });

      await test.step('Wait for dashboard to fully load', async () => {
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="stat-portfolio-value"]')).toBeVisible();
        await page.waitForTimeout(1000);
      });

      await test.step('Capture full investor dashboard', async () => {
        await expect(page).toHaveScreenshot('investor-dashboard-full.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Capture portfolio overview', async () => {
        const portfolioSection = page.locator('[data-testid="portfolio-overview-section"]');
        if (await portfolioSection.count() > 0) {
          await expect(portfolioSection).toHaveScreenshot('investor-portfolio-overview.png', {
            threshold: 0.2
          });
        }
      });
    });

    test('Production dashboard visual baseline', async ({ page }) => {
      await test.step('Navigate to production dashboard', async () => {
        await page.goto(URLS.productionLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.production.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.production.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/production/dashboard');
      });

      await test.step('Wait for dashboard to fully load', async () => {
        await page.waitForLoadState('networkidle');
        await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="stat-active-projects"]')).toBeVisible();
        await page.waitForTimeout(1000);
      });

      await test.step('Capture full production dashboard', async () => {
        await expect(page).toHaveScreenshot('production-dashboard-full.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Capture project pipeline', async () => {
        const pipelineSection = page.locator('[data-testid="project-pipeline-section"]');
        if (await pipelineSection.count() > 0) {
          await expect(pipelineSection).toHaveScreenshot('production-pipeline.png', {
            threshold: 0.2
          });
        }
      });
    });
  });

  test.describe('NDA Management Visual Comparison', () => {
    test('NDA management interface for creator', async ({ page }) => {
      await test.step('Setup and navigate', async () => {
        await page.goto(URLS.creatorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
        await page.click('[data-testid="login-button"]');
        await page.goto(URLS.creatorNDAManagement);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Capture NDA management page', async () => {
        await expect(page.locator('[data-testid="nda-management-tabs"]')).toBeVisible();
        await expect(page).toHaveScreenshot('creator-nda-management.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Capture incoming requests tab', async () => {
        await page.click('[data-testid="incoming-requests-tab"]');
        await page.waitForTimeout(500);
        const incomingSection = page.locator('[data-testid="incoming-requests-content"]');
        if (await incomingSection.count() > 0) {
          await expect(incomingSection).toHaveScreenshot('creator-incoming-ndas.png', {
            threshold: 0.2
          });
        }
      });

      await test.step('Capture signed NDAs tab', async () => {
        await page.click('[data-testid="signed-ndas-tab"]');
        await page.waitForTimeout(500);
        const signedSection = page.locator('[data-testid="signed-ndas-content"]');
        if (await signedSection.count() > 0) {
          await expect(signedSection).toHaveScreenshot('creator-signed-ndas.png', {
            threshold: 0.2
          });
        }
      });
    });

    test('NDA history interface for investor', async ({ page }) => {
      await test.step('Setup and navigate', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.goto(URLS.investorNDAHistory);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Capture NDA history page', async () => {
        await expect(page.locator('[data-testid="nda-history-tabs"]')).toBeVisible();
        await expect(page).toHaveScreenshot('investor-nda-history.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Capture outgoing requests', async () => {
        await page.click('[data-testid="outgoing-requests-tab"]');
        await page.waitForTimeout(500);
        const outgoingSection = page.locator('[data-testid="outgoing-requests-content"]');
        if (await outgoingSection.count() > 0) {
          await expect(outgoingSection).toHaveScreenshot('investor-outgoing-ndas.png', {
            threshold: 0.2
          });
        }
      });
    });
  });

  test.describe('Marketplace and Saved Pitches Visual Comparison', () => {
    test('Marketplace pitch grid layout', async ({ page }) => {
      await test.step('Navigate to marketplace', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.goto(URLS.marketplace);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Capture marketplace layout', async () => {
        await expect(page.locator('[data-testid="marketplace-title"]')).toBeVisible();
        await expect(page.locator('[data-testid="pitch-card"]').first()).toBeVisible();
        await expect(page).toHaveScreenshot('marketplace-grid.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Capture individual pitch card', async () => {
        const firstPitchCard = page.locator('[data-testid="pitch-card"]').first();
        await expect(firstPitchCard).toHaveScreenshot('pitch-card-design.png', {
          threshold: 0.2
        });
      });
    });

    test('Saved pitches interface', async ({ page }) => {
      await test.step('Navigate to saved pitches', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.goto(URLS.investorWatchlist);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Capture saved pitches page', async () => {
        await expect(page.locator('[data-testid="saved-pitches-title"]')).toBeVisible();
        await expect(page).toHaveScreenshot('saved-pitches-page.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Capture saved pitch item layout', async () => {
        const savedPitchItem = page.locator('[data-testid="saved-pitch-item"]').first();
        if (await savedPitchItem.count() > 0) {
          await expect(savedPitchItem).toHaveScreenshot('saved-pitch-item.png', {
            threshold: 0.2
          });
        }
      });
    });
  });

  test.describe('Responsive Design Visual Tests', () => {
    test('Mobile viewport visual comparison', async ({ page }) => {
      await test.step('Set mobile viewport', async () => {
        await page.setViewportSize({ width: 375, height: 667 });
      });

      await test.step('Mobile creator dashboard', async () => {
        await page.goto(URLS.creatorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/creator/dashboard');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot('mobile-creator-dashboard.png', {
          fullPage: true,
          threshold: 0.3
        });
      });

      await test.step('Mobile marketplace', async () => {
        await page.goto(URLS.marketplace);
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot('mobile-marketplace.png', {
          fullPage: true,
          threshold: 0.3
        });
      });
    });

    test('Tablet viewport visual comparison', async ({ page }) => {
      await test.step('Set tablet viewport', async () => {
        await page.setViewportSize({ width: 768, height: 1024 });
      });

      await test.step('Tablet investor dashboard', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/investor/dashboard');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot('tablet-investor-dashboard.png', {
          fullPage: true,
          threshold: 0.3
        });
      });
    });
  });

  test.describe('Component State Visual Testing', () => {
    test('Button and form states', async ({ page }) => {
      await test.step('Navigate to marketplace', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.goto(URLS.marketplace);
        await page.waitForLoadState('networkidle');
      });

      await test.step('Capture save button states', async () => {
        const firstPitch = page.locator('[data-testid="pitch-card"]').first();
        const saveButton = firstPitch.locator('[data-testid="save-pitch-button"]');
        
        // Normal state
        await expect(saveButton).toHaveScreenshot('save-button-normal.png', {
          threshold: 0.1
        });
        
        // Hover state
        await saveButton.hover();
        await expect(saveButton).toHaveScreenshot('save-button-hover.png', {
          threshold: 0.1
        });
      });
    });

    test('Modal and dialog states', async ({ page }) => {
      await test.step('Navigate and trigger NDA modal', async () => {
        await page.goto(URLS.investorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
        await page.click('[data-testid="login-button"]');
        await page.goto(URLS.marketplace);
        await page.waitForLoadState('networkidle');
        
        const firstPitch = page.locator('[data-testid="pitch-card"]').first();
        await firstPitch.click();
        await page.waitForLoadState('networkidle');
      });

      await test.step('Capture NDA request modal', async () => {
        const ndaButton = page.locator('[data-testid="request-nda-button"]');
        if (await ndaButton.count() > 0) {
          await ndaButton.click();
          const modal = page.locator('[data-testid="nda-request-modal"]');
          await expect(modal).toBeVisible();
          await expect(modal).toHaveScreenshot('nda-request-modal.png', {
            threshold: 0.2
          });
        }
      });
    });
  });

  test.describe('Loading and Error State Visual Tests', () => {
    test('Loading states', async ({ page }) => {
      await test.step('Mock slow API responses', async () => {
        await page.route('**/api/dashboard/**', route => {
          setTimeout(() => {
            route.fulfill({
              status: 200,
              body: JSON.stringify({ message: 'delayed response' }),
              headers: { 'Content-Type': 'application/json' }
            });
          }, 2000);
        });
      });

      await test.step('Capture loading states', async () => {
        await page.goto(URLS.creatorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
        await page.click('[data-testid="login-button"]');
        
        // Try to capture loading state quickly
        await page.waitForTimeout(500);
        const loadingIndicator = page.locator('[data-testid="loading-stats"], [data-testid="dashboard-loading"]');
        if (await loadingIndicator.isVisible()) {
          await expect(loadingIndicator).toHaveScreenshot('dashboard-loading-state.png', {
            threshold: 0.2
          });
        }
      });
    });

    test('Error states', async ({ page }) => {
      await test.step('Mock API errors', async () => {
        await page.route('**/api/dashboard/**', route => {
          route.fulfill({
            status: 500,
            body: JSON.stringify({ error: 'Internal Server Error' }),
            headers: { 'Content-Type': 'application/json' }
          });
        });
      });

      await test.step('Capture error states', async () => {
        await page.goto(URLS.creatorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/creator/dashboard');
        await page.waitForTimeout(2000);
        
        const errorState = page.locator('[data-testid="stats-error"], [data-testid="dashboard-error"]');
        if (await errorState.isVisible()) {
          await expect(errorState).toHaveScreenshot('dashboard-error-state.png', {
            threshold: 0.2
          });
        }
      });
    });
  });

  test.describe('Dark Mode Visual Tests', () => {
    test('Dark mode visual comparison', async ({ page }) => {
      await test.step('Enable dark mode if available', async () => {
        // Try to enable dark mode through settings or system preference
        await page.emulateMedia({ colorScheme: 'dark' });
      });

      await test.step('Dark mode creator dashboard', async () => {
        await page.goto(URLS.creatorLogin);
        await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
        await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL('**/creator/dashboard');
        await page.waitForLoadState('networkidle');
        
        await expect(page).toHaveScreenshot('dark-mode-creator-dashboard.png', {
          fullPage: true,
          threshold: 0.3
        });
      });
    });
  });
});