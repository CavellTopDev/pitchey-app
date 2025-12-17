/**
 * Visual Regression Testing
 * Tests UI consistency across browsers and screen sizes
 */

import { test, expect, type Page } from '@playwright/test';

const VIEWPORT_SIZES = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Desktop', width: 1920, height: 1080 },
  { name: 'Large Desktop', width: 2560, height: 1440 }
];

const TEST_ROUTES = [
  { name: 'Landing Page', path: '/', authenticated: false },
  { name: 'Creator Login', path: '/creator/login', authenticated: false },
  { name: 'Investor Login', path: '/investor/login', authenticated: false },
  { name: 'Production Login', path: '/production/login', authenticated: false },
  { name: 'Browse Pitches', path: '/browse', authenticated: false },
  { name: 'Creator Dashboard', path: '/creator/dashboard', authenticated: true },
  { name: 'Investor Dashboard', path: '/investor/dashboard', authenticated: true },
  { name: 'Create Pitch', path: '/create-pitch', authenticated: true },
  { name: 'Profile Page', path: '/profile', authenticated: true },
  { name: 'Messages', path: '/messages', authenticated: true },
  { name: 'NDA Management', path: '/ndas', authenticated: true }
];

class VisualTestHelper {
  constructor(private page: Page) {}

  async loginAsCreator() {
    await this.page.goto('/creator/login');
    await this.page.fill('[data-testid="email-input"]', 'alex.creator@demo.com');
    await this.page.fill('[data-testid="password-input"]', 'Demo123');
    await this.page.click('[data-testid="login-button"]');
    await this.page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  async capturePageScreenshot(name: string, options?: any) {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1000); // Allow animations to complete
    
    return await this.page.screenshot({
      fullPage: true,
      clip: options?.clip,
      ...options
    });
  }

  async captureElementScreenshot(selector: string, name: string) {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    
    return await element.screenshot();
  }

  async testInteractiveStates(selector: string, stateName: string) {
    const element = this.page.locator(selector);
    await expect(element).toBeVisible();
    
    // Capture default state
    await element.screenshot({ path: `screenshots/${stateName}-default.png` });
    
    // Capture hover state
    await element.hover();
    await this.page.waitForTimeout(500);
    await element.screenshot({ path: `screenshots/${stateName}-hover.png` });
    
    // Capture focus state (if focusable)
    try {
      await element.focus();
      await this.page.waitForTimeout(500);
      await element.screenshot({ path: `screenshots/${stateName}-focus.png` });
    } catch {
      // Element not focusable, skip focus state
    }
    
    // Capture active state (if clickable)
    try {
      await element.dispatchEvent('mousedown');
      await this.page.waitForTimeout(200);
      await element.screenshot({ path: `screenshots/${stateName}-active.png` });
      await element.dispatchEvent('mouseup');
    } catch {
      // Element not clickable, skip active state
    }
  }

  async testComponentStates(componentSelector: string, componentName: string) {
    const component = this.page.locator(componentSelector);
    await expect(component).toBeVisible();
    
    // Test different component states if they exist
    const states = ['loading', 'error', 'empty', 'success'];
    
    for (const state of states) {
      const stateElement = component.locator(`[data-testid*="${state}"]`);
      if (await stateElement.isVisible()) {
        await stateElement.screenshot({ 
          path: `screenshots/${componentName}-${state}.png` 
        });
      }
    }
  }
}

// ==================== VISUAL REGRESSION TESTS ====================

test.describe('Visual Regression Tests', () => {
  // Configure visual testing
  test.use({
    // Enable visual comparisons
    screenshot: { mode: 'only-on-failure', fullPage: true }
  });

  VIEWPORT_SIZES.forEach(viewport => {
    test.describe(`${viewport.name} - ${viewport.width}x${viewport.height}`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ 
          width: viewport.width, 
          height: viewport.height 
        });
      });

      TEST_ROUTES.forEach(route => {
        test(`${route.name} - Visual Consistency`, async ({ page }) => {
          const helper = new VisualTestHelper(page);
          
          // Authenticate if needed
          if (route.authenticated) {
            await helper.loginAsCreator();
          }
          
          // Navigate to test route
          await page.goto(route.path);
          
          // Wait for page to stabilize
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000); // Allow animations to complete
          
          // Capture full page screenshot
          await expect(page).toHaveScreenshot(
            `${viewport.name.toLowerCase()}-${route.name.toLowerCase().replace(/\s+/g, '-')}.png`
          );
        });
      });

      // Test specific UI components
      test('UI Components Visual Consistency', async ({ page }) => {
        const helper = new VisualTestHelper(page);
        await helper.loginAsCreator();
        
        // Test Dashboard Components
        await page.goto('/creator/dashboard');
        
        // Test navigation header
        await expect(page.locator('[data-testid="main-header"]')).toHaveScreenshot(
          `${viewport.name.toLowerCase()}-header.png`
        );
        
        // Test sidebar navigation
        if (viewport.width >= 768) { // Only on tablet and desktop
          await expect(page.locator('[data-testid="sidebar-nav"]')).toHaveScreenshot(
            `${viewport.name.toLowerCase()}-sidebar.png`
          );
        }
        
        // Test dashboard cards
        await expect(page.locator('[data-testid="stats-cards"]')).toHaveScreenshot(
          `${viewport.name.toLowerCase()}-stats-cards.png`
        );
        
        // Test pitch grid
        await expect(page.locator('[data-testid="recent-pitches"]')).toHaveScreenshot(
          `${viewport.name.toLowerCase()}-pitch-grid.png`
        );
      });

      test('Form Components Visual Consistency', async ({ page }) => {
        const helper = new VisualTestHelper(page);
        
        // Test Login Form
        await page.goto('/creator/login');
        await expect(page.locator('[data-testid="login-form"]')).toHaveScreenshot(
          `${viewport.name.toLowerCase()}-login-form.png`
        );
        
        await helper.loginAsCreator();
        
        // Test Pitch Creation Form
        await page.goto('/create-pitch');
        await expect(page.locator('[data-testid="pitch-form"]')).toHaveScreenshot(
          `${viewport.name.toLowerCase()}-pitch-form.png`
        );
        
        // Test form steps
        const steps = ['basic-info', 'story-details', 'production-details', 'characters', 'review'];
        for (let i = 0; i < steps.length && i < 3; i++) { // Test first 3 steps
          const stepElement = page.locator(`[data-testid="step-${i + 1}"]`);
          if (await stepElement.isVisible()) {
            await expect(stepElement).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-form-step-${i + 1}.png`
            );
          }
        }
      });

      test('Interactive States Visual Consistency', async ({ page }) => {
        const helper = new VisualTestHelper(page);
        await page.goto('/browse');
        
        // Test button states
        const buttonSelectors = [
          '[data-testid="search-button"]',
          '[data-testid="filter-button"]',
          '[data-testid="sort-button"]'
        ];
        
        for (const selector of buttonSelectors) {
          const button = page.locator(selector);
          if (await button.isVisible()) {
            // Default state
            await expect(button).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-button-default.png`
            );
            
            // Hover state
            await button.hover();
            await page.waitForTimeout(300);
            await expect(button).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-button-hover.png`
            );
          }
        }
        
        // Test card hover states
        const pitchCards = page.locator('[data-testid="pitch-card"]');
        const firstCard = pitchCards.first();
        if (await firstCard.isVisible()) {
          // Default card state
          await expect(firstCard).toHaveScreenshot(
            `${viewport.name.toLowerCase()}-card-default.png`
          );
          
          // Hover card state
          await firstCard.hover();
          await page.waitForTimeout(300);
          await expect(firstCard).toHaveScreenshot(
            `${viewport.name.toLowerCase()}-card-hover.png`
          );
        }
      });

      test('Modal and Overlay Visual Consistency', async ({ page }) => {
        const helper = new VisualTestHelper(page);
        await helper.loginAsCreator();
        
        // Test various modals if they exist
        await page.goto('/browse');
        
        // Look for a pitch to test modals
        const pitchCard = page.locator('[data-testid="pitch-card"]').first();
        if (await pitchCard.isVisible()) {
          await pitchCard.click();
          
          // If NDA request modal appears
          const ndaButton = page.locator('[data-testid="request-nda-button"]');
          if (await ndaButton.isVisible()) {
            await ndaButton.click();
            
            const modal = page.locator('[data-testid="nda-request-modal"]');
            await expect(modal).toBeVisible();
            await expect(modal).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-nda-modal.png`
            );
            
            // Close modal
            await page.keyboard.press('Escape');
          }
        }
        
        // Test user menu dropdown
        const userMenu = page.locator('[data-testid="user-menu"]');
        if (await userMenu.isVisible()) {
          await userMenu.click();
          await page.waitForTimeout(300);
          
          const dropdown = page.locator('[data-testid="user-dropdown"]');
          if (await dropdown.isVisible()) {
            await expect(dropdown).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-user-dropdown.png`
            );
          }
        }
      });

      test('Data Loading States Visual Consistency', async ({ page }) => {
        const helper = new VisualTestHelper(page);
        await helper.loginAsCreator();
        
        // Test dashboard with potential loading states
        await page.goto('/creator/dashboard');
        
        // Look for loading indicators
        const loadingElements = [
          '[data-testid="stats-loading"]',
          '[data-testid="pitches-loading"]',
          '[data-testid="notifications-loading"]'
        ];
        
        for (const selector of loadingElements) {
          const element = page.locator(selector);
          if (await element.isVisible()) {
            await expect(element).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-loading-state.png`
            );
          }
        }
        
        // Test empty states
        const emptyElements = [
          '[data-testid="no-pitches"]',
          '[data-testid="no-messages"]',
          '[data-testid="no-notifications"]'
        ];
        
        for (const selector of emptyElements) {
          const element = page.locator(selector);
          if (await element.isVisible()) {
            await expect(element).toHaveScreenshot(
              `${viewport.name.toLowerCase()}-empty-state.png`
            );
          }
        }
      });

      test('Dark Mode Visual Consistency', async ({ page }) => {
        // Test dark mode if supported
        await page.emulateMedia({ colorScheme: 'dark' });
        
        const helper = new VisualTestHelper(page);
        
        // Test key pages in dark mode
        const darkModeRoutes = [
          '/creator/login',
          '/browse',
          '/creator/dashboard'
        ];
        
        for (const route of darkModeRoutes) {
          if (route.includes('dashboard')) {
            await helper.loginAsCreator();
          }
          
          await page.goto(route);
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(1000);
          
          const routeName = route.replace(/[\/]/g, '-').replace(/^-/, '') || 'home';
          await expect(page).toHaveScreenshot(
            `${viewport.name.toLowerCase()}-${routeName}-dark.png`
          );
        }
        
        // Reset to light mode
        await page.emulateMedia({ colorScheme: 'light' });
      });
    });
  });

  // Cross-browser consistency tests
  test.describe('Cross-Browser Consistency', () => {
    const criticalPages = [
      '/creator/login',
      '/browse',
      '/creator/dashboard'
    ];
    
    criticalPages.forEach(pagePath => {
      test(`${pagePath} - Cross-Browser Consistency`, async ({ page, browserName }) => {
        const helper = new VisualTestHelper(page);
        
        if (pagePath.includes('dashboard')) {
          await helper.loginAsCreator();
        }
        
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);
        
        const pageName = pagePath.replace(/[\/]/g, '-').replace(/^-/, '') || 'home';
        await expect(page).toHaveScreenshot(
          `${browserName}-${pageName}.png`
        );
      });
    });
  });

  // Animation and transition tests
  test.describe('Animation and Transitions', () => {
    test('Page Transitions', async ({ page }) => {
      const helper = new VisualTestHelper(page);
      await helper.loginAsCreator();
      
      // Test navigation transitions
      await page.goto('/creator/dashboard');
      
      // Click on browse link and capture transition
      await page.click('[data-testid="browse-link"]');
      await page.waitForTimeout(500); // Capture mid-transition
      await expect(page).toHaveScreenshot('transition-mid.png');
      
      await page.waitForURL('**/browse');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot('transition-complete.png');
    });

    test('Component Animations', async ({ page }) => {
      await page.goto('/browse');
      
      // Test hover animations
      const pitchCard = page.locator('[data-testid="pitch-card"]').first();
      if (await pitchCard.isVisible()) {
        // Before hover
        await expect(pitchCard).toHaveScreenshot('card-before-hover.png');
        
        // During hover transition
        await pitchCard.hover();
        await page.waitForTimeout(150); // Mid-animation
        await expect(pitchCard).toHaveScreenshot('card-mid-hover.png');
        
        // After hover complete
        await page.waitForTimeout(300);
        await expect(pitchCard).toHaveScreenshot('card-after-hover.png');
      }
    });

    test('Modal Animations', async ({ page }) => {
      const helper = new VisualTestHelper(page);
      await helper.loginAsCreator();
      await page.goto('/browse');
      
      const pitchCard = page.locator('[data-testid="pitch-card"]').first();
      if (await pitchCard.isVisible()) {
        await pitchCard.click();
        
        const ndaButton = page.locator('[data-testid="request-nda-button"]');
        if (await ndaButton.isVisible()) {
          // Capture modal opening animation
          await ndaButton.click();
          
          // Mid-animation
          await page.waitForTimeout(150);
          await expect(page).toHaveScreenshot('modal-opening.png');
          
          // Fully opened
          await page.waitForTimeout(300);
          await expect(page).toHaveScreenshot('modal-opened.png');
          
          // Capture modal closing animation
          await page.keyboard.press('Escape');
          
          // Mid-close animation
          await page.waitForTimeout(150);
          await expect(page).toHaveScreenshot('modal-closing.png');
        }
      }
    });
  });

  // Print styles test
  test.describe('Print Styles', () => {
    test('Print Layout Consistency', async ({ page }) => {
      await page.goto('/browse');
      
      // Emulate print media
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(1000);
      
      await expect(page).toHaveScreenshot('print-layout.png');
      
      // Reset to screen media
      await page.emulateMedia({ media: 'screen' });
    });
  });
});

console.log('📸 Visual Regression Tests Configured Successfully!');