import { Page, expect, BrowserContext } from '@playwright/test';
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

  /**
   * Login with Better Auth session-based authentication
   */
  async login(user: typeof TEST_USERS.creator) {
    console.log(`Logging in as ${user.portal}: ${user.email}`);
    
    // Clear any existing authentication state
    await this.page.context().clearCookies();
    
    // Navigate directly to the portal login page
    await this.page.goto(`/${user.portal}/login`);
    
    // Wait for page to fully load
    await this.page.waitForLoadState('networkidle');
    
    // Fill login form with flexible selectors
    const emailInput = this.page.locator('input[type="email"], [data-testid="email-input"], [name="email"]').first();
    const passwordInput = this.page.locator('input[type="password"], [data-testid="password-input"], [name="password"]').first();
    const submitButton = this.page.locator('button[type="submit"], [data-testid="login-button"], button:has-text("Sign In"), button:has-text("Login")').first();
    
    await expect(emailInput).toBeVisible();
    await emailInput.fill(user.email);
    
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill(user.password);
    
    // Submit the form
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    
    // Wait for successful authentication
    // Better Auth will set cookies and redirect to dashboard
    await this.page.waitForURL(`**/${user.portal}/dashboard`, { timeout: 15000 });
    
    // Verify authentication by checking for dashboard elements
    await expect(
      this.page.locator('[data-testid="user-menu"], [data-testid="dashboard-title"], .user-menu, nav').first()
    ).toBeVisible({ timeout: 10000 });
    
    console.log(`✓ Successfully logged in as ${user.portal}`);
  }

  /**
   * Login using pre-stored authentication state (faster)
   */
  async loginWithStoredAuth(portal: 'creator' | 'investor' | 'production') {
    const authFile = `e2e/.auth/${portal}.json`;
    
    try {
      // Apply stored authentication state
      const { storageState } = require(`../../${authFile}`);
      await this.page.context().addCookies(storageState.cookies);
      
      // Navigate to dashboard
      await this.page.goto(`/${portal}/dashboard`);
      
      // Verify authentication still valid
      await this.verifyAuthenticated(portal);
      
      console.log(`✓ Used stored authentication for ${portal}`);
    } catch (error) {
      console.warn(`Stored auth failed for ${portal}, falling back to fresh login:`, error);
      await this.login(TEST_USERS[portal]);
    }
  }

  /**
   * Better Auth logout - calls the API endpoint and clears cookies
   */
  async logout() {
    console.log('Logging out...');
    
    try {
      // Try clicking user menu and logout button
      const userMenu = this.page.locator('[data-testid="user-menu"], .user-menu, [data-testid="profile-menu"]').first();
      
      if (await userMenu.isVisible()) {
        await userMenu.click();
        
        const logoutButton = this.page.locator('[data-testid="logout-button"], [data-testid="sign-out"], button:has-text("Logout"), button:has-text("Sign Out")').first();
        
        if (await logoutButton.isVisible()) {
          await logoutButton.click();
        }
      }
    } catch (error) {
      console.warn('UI logout failed, trying API logout:', error);
    }
    
    // Ensure logout by calling Better Auth API directly
    try {
      await this.page.request.post('/api/auth/sign-out', {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.warn('API logout failed:', error);
    }
    
    // Clear all cookies and storage
    await this.page.context().clearCookies();
    await this.page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Navigate to home page
    await this.page.goto('/');
    
    console.log('✓ Logged out successfully');
  }

  async verifyAuthenticated(portal: string) {
    console.log(`Verifying authentication for ${portal}`);
    
    // Check URL
    await expect(this.page).toHaveURL(new RegExp(`${portal}/dashboard`));
    
    // Check for authenticated UI elements
    const authIndicators = [
      '[data-testid="user-menu"]',
      '[data-testid="dashboard-title"]', 
      '.user-menu',
      'nav[data-testid="main-nav"]',
      '.dashboard-header'
    ];
    
    let found = false;
    for (const selector of authIndicators) {
      const element = this.page.locator(selector);
      if (await element.isVisible()) {
        await expect(element).toBeVisible();
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error(`No authentication indicators found for ${portal} portal`);
    }
    
    console.log(`✓ Authentication verified for ${portal}`);
  }

  async verifyNotAuthenticated() {
    console.log('Verifying user is not authenticated');
    
    // Should not be on any protected dashboard
    await expect(this.page).not.toHaveURL(/\/(creator|investor|production)\/dashboard/);
    
    // Should not see authenticated UI elements
    const authElements = this.page.locator('[data-testid="user-menu"], .user-menu');
    
    if (await authElements.count() > 0) {
      await expect(authElements.first()).not.toBeVisible();
    }
    
    console.log('✓ User is not authenticated');
  }

  /**
   * Get current authentication status from Better Auth
   */
  async getAuthStatus() {
    try {
      const response = await this.page.request.get('/api/auth/session');
      const data = await response.json();
      return {
        isAuthenticated: response.ok() && data.user,
        user: data.user || null,
        session: data.session || null
      };
    } catch (error) {
      return {
        isAuthenticated: false,
        user: null,
        session: null,
        error: error.message
      };
    }
  }

  /**
   * Wait for any pending authentication redirects
   */
  async waitForAuthStabilization() {
    // Better Auth may redirect after login, so wait for navigation to stabilize
    await this.page.waitForLoadState('networkidle');
    
    // Wait a bit more for any JavaScript redirects
    await this.page.waitForTimeout(1000);
  }

  /**
   * Switch to different portal (requires re-authentication)
   */
  async switchPortal(newPortal: 'creator' | 'investor' | 'production') {
    await this.logout();
    await this.login(TEST_USERS[newPortal]);
  }

  /**
   * Verify session persistence across page reloads
   */
  async verifySessionPersistence(portal: string) {
    console.log('Testing session persistence...');
    
    // Reload the page
    await this.page.reload();
    await this.waitForAuthStabilization();
    
    // Verify still authenticated
    await this.verifyAuthenticated(portal);
    
    console.log('✓ Session persisted across reload');
  }
}