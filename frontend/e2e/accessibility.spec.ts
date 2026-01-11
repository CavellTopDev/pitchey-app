import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { injectAxe, checkA11y, getViolations, reportViolations } from 'axe-playwright';

test.describe('Accessibility Tests', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    
    // Inject axe-core for accessibility testing
    await injectAxe(page);
  });

  test.describe('WCAG Compliance', () => {
    test('homepage should meet WCAG 2.1 AA standards', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Check accessibility
      await checkA11y(page, null, {
        detailedReport: true,
        detailedReportOptions: { html: true },
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa']
      });
    });

    test('portal selection should be accessible', async ({ page }) => {
      await page.goto('/portal-select');
      await page.waitForLoadState('networkidle');
      
      // Check that portal selection cards are properly labeled
      await expect(page.locator('[data-testid="creator-portal"]')).toHaveAttribute('role', 'button');
      await expect(page.locator('[data-testid="investor-portal"]')).toHaveAttribute('role', 'button');
      await expect(page.locator('[data-testid="production-portal"]')).toHaveAttribute('role', 'button');
      
      // Check accessibility compliance
      await checkA11y(page, null, {
        tags: ['wcag2a', 'wcag2aa']
      });
    });

    test('login forms should be accessible across all portals', async ({ page }) => {
      const portals = ['creator', 'investor', 'production'];
      
      for (const portal of portals) {
        await page.goto(`/${portal}/login`);
        await page.waitForLoadState('networkidle');
        
        // Check form accessibility
        const emailInput = page.locator('input[type="email"]');
        const passwordInput = page.locator('input[type="password"]');
        const submitButton = page.locator('button[type="submit"]');
        
        // Labels should be properly associated
        await expect(emailInput).toHaveAttribute('aria-describedby');
        await expect(passwordInput).toHaveAttribute('aria-describedby');
        
        // Buttons should be accessible
        await expect(submitButton).toBeVisible();
        
        // Run full accessibility audit
        await checkA11y(page, null, {
          tags: ['wcag2a', 'wcag2aa'],
          rules: {
            'color-contrast': { enabled: true },
            'focus-order-semantics': { enabled: true },
            'label': { enabled: true }
          }
        });
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate homepage with keyboard only', async ({ page }) => {
      await page.goto('/');
      
      // Tab through main navigation
      await page.keyboard.press('Tab');
      let focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT'].includes(focused)).toBeTruthy();
      
      // Continue tabbing to verify tab order
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const currentFocus = await page.evaluate(() => ({
          tag: document.activeElement?.tagName,
          text: document.activeElement?.textContent?.trim() || '',
          role: document.activeElement?.getAttribute('role')
        }));
        
        // Focus should be visible
        const focusedElement = page.locator(':focus');
        if (await focusedElement.count() > 0) {
          const boundingBox = await focusedElement.boundingBox();
          expect(boundingBox).toBeTruthy();
        }
      }
    });

    test('should navigate creator dashboard with keyboard', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Test keyboard navigation in dashboard
      await page.keyboard.press('Tab');
      
      // Should be able to access all interactive elements
      const interactiveElements = page.locator('button, a, input, select, [tabindex="0"]');
      const count = await interactiveElements.count();
      
      expect(count).toBeGreaterThan(5); // Should have multiple interactive elements
      
      // Test specific dashboard navigation
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter'); // Activate focused element
      
      // Check that focus management works after interactions
      const focusedAfterInteraction = page.locator(':focus');
      await expect(focusedAfterInteraction).toBeVisible();
    });

    test('should handle modal keyboard navigation', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Open create pitch modal/page
      await page.click('[data-testid="create-pitch-button"]');
      
      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();
      
      // Test escape key functionality
      await page.keyboard.press('Escape');
      
      // If modal, it should close; if page, check for escape handling
      const currentUrl = page.url();
      console.log('Current URL after escape:', currentUrl);
    });

    test('should provide skip links', async ({ page }) => {
      await page.goto('/');
      
      // First tab should focus skip link
      await page.keyboard.press('Tab');
      
      const skipLink = page.locator('[data-testid="skip-to-content"], a:has-text("Skip to content")');
      
      if (await skipLink.count() > 0) {
        await expect(skipLink).toBeFocused();
        
        // Activate skip link
        await page.keyboard.press('Enter');
        
        // Should jump to main content
        const mainContent = page.locator('main, [data-testid="main-content"], #main-content');
        await expect(mainContent).toBeFocused();
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA labels and roles', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      await page.waitForLoadState('networkidle');
      
      // Check for proper ARIA landmarks
      await expect(page.locator('main, [role="main"]')).toBeVisible();
      await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
      
      // Check pitch cards have proper labels
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = pitchCards.nth(i);
          
          // Should have accessible name
          const ariaLabel = await card.getAttribute('aria-label');
          const ariaLabelledBy = await card.getAttribute('aria-labelledby');
          
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    });

    test('should announce dynamic content changes', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Apply filter - should announce changes
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="genre-action"]');
      await page.click('[data-testid="apply-filters"]');
      
      // Check for ARIA live region updates
      const liveRegion = page.locator('[aria-live], [data-testid="status-updates"]');
      
      if (await liveRegion.count() > 0) {
        await expect(liveRegion).toBeVisible();
      }
      
      // Check that results count is announced
      const resultsCount = page.locator('[data-testid="results-count"], [aria-live="polite"]');
      
      if (await resultsCount.count() > 0) {
        await expect(resultsCount).toBeVisible();
      }
    });

    test('should provide descriptive error messages', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      await page.click('[data-testid="create-pitch-button"]');
      
      // Try to submit empty form
      await page.click('[data-testid="save-draft-button"]');
      
      // Error messages should be properly associated
      const titleError = page.locator('[data-testid="title-error"], [id*="title"][role="alert"]');
      
      if (await titleError.count() > 0) {
        await expect(titleError).toBeVisible();
        
        const titleInput = page.locator('[data-testid="title-input"]');
        const describedBy = await titleInput.getAttribute('aria-describedby');
        
        expect(describedBy).toContain('error');
      }
    });
  });

  test.describe('Color and Contrast', () => {
    test('should meet color contrast requirements', async ({ page }) => {
      await page.goto('/');
      
      // Test color contrast using axe
      await checkA11y(page, null, {
        rules: {
          'color-contrast': { enabled: true }
        }
      });
    });

    test('should not rely solely on color for information', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Check status indicators have text/icons, not just color
      const statusIndicators = page.locator('[data-testid*="status"], .status');
      const count = await statusIndicators.count();
      
      for (let i = 0; i < count; i++) {
        const indicator = statusIndicators.nth(i);
        const text = await indicator.textContent();
        const ariaLabel = await indicator.getAttribute('aria-label');
        
        // Should have text content or aria-label, not rely on color alone
        expect(text || ariaLabel).toBeTruthy();
      }
    });
  });

  test.describe('Form Accessibility', () => {
    test('should have accessible pitch creation form', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      await page.click('[data-testid="create-pitch-button"]');
      
      // Check form structure
      const formElements = page.locator('input, textarea, select');
      const count = await formElements.count();
      
      for (let i = 0; i < count; i++) {
        const element = formElements.nth(i);
        
        // Each form element should have a label
        const id = await element.getAttribute('id');
        const ariaLabel = await element.getAttribute('aria-label');
        const ariaLabelledBy = await element.getAttribute('aria-labelledby');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
      
      // Run full form accessibility check
      await checkA11y(page, 'form', {
        tags: ['wcag2a', 'wcag2aa']
      });
    });

    test('should handle form errors accessibly', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      await page.click('[data-testid="create-pitch-button"]');
      
      // Submit invalid form
      await page.fill('[data-testid="title-input"]', ''); // Empty title
      await page.click('[data-testid="save-draft-button"]');
      
      // Check error handling
      const errorSummary = page.locator('[role="alert"], [data-testid="error-summary"]');
      
      if (await errorSummary.count() > 0) {
        await expect(errorSummary).toBeVisible();
        await expect(errorSummary).toBeFocused(); // Should focus error summary
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('should be accessible on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/');
      
      // Check mobile navigation
      const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
      
      if (await mobileMenu.count() > 0) {
        // Should be accessible via keyboard
        await mobileMenu.focus();
        await page.keyboard.press('Enter');
        
        const mobileNav = page.locator('[data-testid="mobile-navigation"]');
        await expect(mobileNav).toBeVisible();
        
        // Check mobile navigation accessibility
        await checkA11y(page, '[data-testid="mobile-navigation"]', {
          tags: ['wcag2a', 'wcag2aa']
        });
      }
    });

    test('should handle touch interactions accessibly', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await authHelper.loginAsInvestor();
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Test touch targets are large enough (44x44px minimum)
      const touchTargets = page.locator('button, a, input[type="checkbox"], input[type="radio"]');
      const count = await touchTargets.count();
      
      for (let i = 0; i < Math.min(count, 10); i++) {
        const target = touchTargets.nth(i);
        const box = await target.boundingBox();
        
        if (box) {
          expect(box.width).toBeGreaterThanOrEqual(44);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });

  test.describe('Animation and Motion', () => {
    test('should respect reduced motion preferences', async ({ page }) => {
      // Simulate reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      
      await page.goto('/');
      
      // Check that animations are disabled or reduced
      const animatedElements = page.locator('.animate, [class*="animate"], [class*="transition"]');
      const count = await animatedElements.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const element = animatedElements.nth(i);
        const computedStyle = await element.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            animationDuration: style.animationDuration,
            transitionDuration: style.transitionDuration
          };
        });
        
        // Should have no animation or very short duration
        expect(
          computedStyle.animationDuration === '0s' || 
          computedStyle.transitionDuration === '0s' ||
          computedStyle.animationDuration === '0.01s' ||
          computedStyle.transitionDuration === '0.01s'
        ).toBeTruthy();
      }
    });

    test('should not trigger vestibular disorders', async ({ page }) => {
      await page.goto('/');
      
      // Check for potentially problematic animations
      await checkA11y(page, null, {
        rules: {
          'motion-duration': { enabled: true },
          'no-autoplay-audio': { enabled: true }
        }
      });
    });
  });

  test.describe('Focus Management', () => {
    test('should manage focus properly in single page app', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate between pages/views
      await page.click('[data-testid="analytics-link"]');
      
      // Focus should be managed after navigation
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
      
      // Should have proper page title
      const title = await page.title();
      expect(title).toContain('Analytics');
    });

    test('should handle modal focus correctly', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Look for modals in the interface
      const modalTriggers = page.locator('[data-testid*="modal"], button:has-text("Upload"), button:has-text("Delete")');
      
      if (await modalTriggers.count() > 0) {
        await modalTriggers.first().click();
        
        // Modal should trap focus
        const modal = page.locator('[role="dialog"], [data-testid*="modal"]');
        
        if (await modal.count() > 0) {
          await expect(modal).toBeVisible();
          
          // First focusable element in modal should be focused
          const firstFocusable = modal.locator('button, input, select, textarea, [tabindex="0"]').first();
          
          if (await firstFocusable.count() > 0) {
            await expect(firstFocusable).toBeFocused();
          }
        }
      }
    });
  });

  test.describe('Assistive Technology Compatibility', () => {
    test('should work with screen readers', async ({ page }) => {
      await page.goto('/');
      
      // Test semantic structure
      await expect(page.locator('h1')).toBeVisible();
      
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      
      expect(headingCount).toBeGreaterThan(0);
      
      // Check heading hierarchy
      let previousLevel = 0;
      for (let i = 0; i < Math.min(headingCount, 10); i++) {
        const heading = headings.nth(i);
        const tagName = await heading.evaluate(el => el.tagName);
        const level = parseInt(tagName.substring(1));
        
        // Heading levels shouldn't skip more than one level
        if (previousLevel > 0) {
          expect(level - previousLevel).toBeLessThanOrEqual(1);
        }
        
        previousLevel = level;
      }
    });

    test('should provide comprehensive accessibility information', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Generate detailed accessibility report
      const violations = await getViolations(page, null, {
        tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
        includeTags: ['best-practice']
      });
      
      if (violations && violations.length > 0) {
        console.log('Accessibility violations found:');
        reportViolations(violations);
        
        // Fail test if critical violations found
        const criticalViolations = violations.filter(v => 
          ['critical', 'serious'].includes(v.impact)
        );
        
        expect(criticalViolations.length).toBe(0);
      }
    });
  });
});