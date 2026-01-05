import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { URLS } from './fixtures/test-data';

test.describe('Authentication Flows', () => {
  let authHelper: AuthHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
  });

  test.describe('Portal Selection', () => {
    test('should display portal selection page', async ({ page }) => {
      await page.goto(URLS.portalSelect);
      
      await expect(page.locator('[data-testid="creator-portal"]')).toBeVisible();
      await expect(page.locator('[data-testid="investor-portal"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-portal"]')).toBeVisible();
    });

    test('should navigate to correct login pages', async ({ page }) => {
      await page.goto(URLS.portalSelect);
      
      // Test creator portal navigation
      await page.click('[data-testid="creator-portal"]');
      await expect(page).toHaveURL(/creator.*login/);
      
      await page.goBack();
      
      // Test investor portal navigation
      await page.click('[data-testid="investor-portal"]');
      await expect(page).toHaveURL(/investor.*login/);
      
      await page.goBack();
      
      // Test production portal navigation
      await page.click('[data-testid="production-portal"]');
      await expect(page).toHaveURL(/production.*login/);
    });
  });

  test.describe('Creator Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      await authHelper.loginAsCreator();
      await authHelper.verifyAuthenticated('creator');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto(URLS.creatorLogin);
      
      await page.fill('[data-testid="email-input"]', 'invalid@email.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });

    test('should logout successfully', async () => {
      await authHelper.loginAsCreator();
      await authHelper.logout();
      await authHelper.verifyNotAuthenticated();
    });

    test('should redirect to login when accessing protected routes', async ({ page }) => {
      await page.goto('/creator/dashboard');
      await expect(page).toHaveURL(/login/);
    });
  });

  test.describe('Investor Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      await authHelper.loginAsInvestor();
      await authHelper.verifyAuthenticated('investor');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto(URLS.investorLogin);
      
      await page.fill('[data-testid="email-input"]', 'invalid@email.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });

    test('should logout successfully', async () => {
      await authHelper.loginAsInvestor();
      await authHelper.logout();
      await authHelper.verifyNotAuthenticated();
    });
  });

  test.describe('Production Authentication', () => {
    test('should login successfully with valid credentials', async () => {
      await authHelper.loginAsProduction();
      await authHelper.verifyAuthenticated('production');
    });

    test('should show error with invalid credentials', async ({ page }) => {
      await page.goto(URLS.productionLogin);
      
      await page.fill('[data-testid="email-input"]', 'invalid@email.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    });

    test('should logout successfully', async () => {
      await authHelper.loginAsProduction();
      await authHelper.logout();
      await authHelper.verifyNotAuthenticated();
    });
  });

  test.describe('Access Control', () => {
    test('creator cannot access investor dashboard', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      await page.goto('/investor/dashboard');
      await expect(page).toHaveURL(/creator/);
    });

    test('investor cannot access creator dashboard', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.goto('/creator/dashboard');
      await expect(page).toHaveURL(/investor/);
    });

    test('investor cannot create pitches', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.goto('/create-pitch');
      await expect(page).not.toHaveURL(/create-pitch/);
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      await page.reload();
      await authHelper.verifyAuthenticated('creator');
    });

    test('should handle expired sessions gracefully', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Simulate token expiration by clearing localStorage
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      
      await page.reload();
      await authHelper.verifyNotAuthenticated();
    });
  });
});