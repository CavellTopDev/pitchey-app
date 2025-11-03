import { Page, expect } from '@playwright/test';
import { TEST_USERS, URLS } from '../fixtures/test-data';

export class AuthHelper {
  constructor(private page: Page) {}

  async loginAsCreator() {
    await this.login(TEST_USERS.creator);
  }

  async loginAsInvestor() {
    await this.login(TEST_USERS.investor);
  }

  async loginAsProduction() {
    await this.login(TEST_USERS.production);
  }

  async login(user: typeof TEST_USERS.creator) {
    // Navigate to portal selection
    await this.page.goto(URLS.portalSelect);
    
    // Select the appropriate portal
    await this.page.click(`[data-testid="${user.portal}-portal"]`);
    
    // Fill login form
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    
    // Submit login
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login (dashboard should load)
    await this.page.waitForURL(`**/${user.portal}/dashboard`);
    
    // Verify we're logged in by checking for user info or logout button
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  async logout() {
    // Click user menu
    await this.page.click('[data-testid="user-menu"]');
    
    // Click logout
    await this.page.click('[data-testid="logout-button"]');
    
    // Wait for redirect to portal selection or home
    await this.page.waitForURL(/portal-select|\/$/);
  }

  async verifyAuthenticated(portal: string) {
    // Should be on the dashboard
    await expect(this.page).toHaveURL(new RegExp(`${portal}/dashboard`));
    
    // Should see user menu
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible();
  }

  async verifyNotAuthenticated() {
    // Should not be on any dashboard
    await expect(this.page).not.toHaveURL(/dashboard/);
    
    // Should not see user menu
    await expect(this.page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  }
}