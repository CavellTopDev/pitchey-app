import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { generateTestEmail, generateTestPitch } from './fixtures/test-data';

test.describe('Guest to User Conversion Journey', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;
  let testUserEmail: string;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    testUserEmail = generateTestEmail('guest-conversion');
    
    // Ensure we start as unauthenticated guest
    await authHelper.logout();
    await page.goto('/');
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: ensure test user is logged out
    try {
      await authHelper.logout();
    } catch (error) {
      console.warn('Cleanup logout failed:', error);
    }
  });

  test.describe('Guest Exploration Phase', () => {
    test('guest browses homepage and explores platform features', async ({ page }) => {
      // Homepage exploration
      await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="platform-features"]')).toBeVisible();
      
      // Check platform statistics are visible
      const statsSection = page.locator('[data-testid="platform-stats"]');
      if (await statsSection.count() > 0) {
        await expect(statsSection).toBeVisible();
        await expect(page.locator('[data-testid="total-pitches"]')).toBeVisible();
        await expect(page.locator('[data-testid="active-creators"]')).toBeVisible();
      }
      
      // Explore featured pitches
      const featuredPitches = page.locator('[data-testid="featured-pitches"]');
      if (await featuredPitches.count() > 0) {
        await expect(featuredPitches).toBeVisible();
        
        const firstPitch = page.locator('[data-testid="featured-pitch-card"]').first();
        if (await firstPitch.count() > 0) {
          await expect(firstPitch.locator('[data-testid="pitch-title"]')).toBeVisible();
          await expect(firstPitch.locator('[data-testid="pitch-genre"]')).toBeVisible();
          
          // Click to view more details - should be public accessible
          await firstPitch.click();
          await pageHelper.waitForPageLoad();
          
          // Should see pitch details but with limited information
          await expect(page.locator('[data-testid="pitch-detail-header"]')).toBeVisible();
          await expect(page.locator('[data-testid="login-for-details"]')).toBeVisible();
        }
      }
    });

    test('guest explores browse section with public content', async ({ page }) => {
      // Navigate to browse section
      await page.click('[data-testid="browse-link"]');
      await pageHelper.waitForPageLoad();
      
      // Verify browse interface
      await expect(page.locator('[data-testid="browse-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="pitch-grid"]')).toBeVisible();
      
      // Test tab navigation
      const tabs = ['trending', 'new', 'featured', 'top-rated'];
      for (const tab of tabs) {
        const tabElement = page.locator(`[data-testid="${tab}-tab"]`);
        if (await tabElement.count() > 0) {
          await tabElement.click();
          await pageHelper.waitForPageLoad();
          
          // Verify content loads for this tab
          const content = page.locator(`[data-testid="${tab}-content"], [data-testid="pitch-grid"]`);
          await expect(content).toBeVisible();
        }
      }
      
      // Test public filtering
      const filterToggle = page.locator('[data-testid="filter-toggle"]');
      if (await filterToggle.count() > 0) {
        await filterToggle.click();
        
        // Apply genre filter
        const actionGenre = page.locator('[data-testid="genre-action"]');
        if (await actionGenre.count() > 0) {
          await actionGenre.check();
          await page.click('[data-testid="apply-filters-button"]');
          await pageHelper.waitForPageLoad();
          
          // Verify filtered results
          await expect(page.locator('[data-testid="active-filters"]')).toContainText('Action');
        }
      }
    });

    test('guest explores genre-specific browsing', async ({ page }) => {
      // Navigate to genres page
      await page.click('[data-testid="browse-genres-link"]');
      await pageHelper.waitForPageLoad();
      
      // Check genre categories are available
      const genres = ['action', 'drama', 'comedy', 'thriller', 'horror'];
      for (const genre of genres) {
        const genreElement = page.locator(`[data-testid="${genre}-genre"]`);
        if (await genreElement.count() > 0) {
          await expect(genreElement).toBeVisible();
        }
      }
      
      // Click on Action genre
      const actionGenre = page.locator('[data-testid="action-genre"]');
      if (await actionGenre.count() > 0) {
        await actionGenre.click();
        await pageHelper.waitForPageLoad();
        
        // Should see action-specific page
        await expect(page).toHaveURL(/genre.*action/);
        await expect(page.locator('[data-testid="genre-header"]')).toContainText('Action');
        
        // Verify action pitches are displayed
        const pitchCards = page.locator('[data-testid="pitch-card"]');
        const cardCount = await pitchCards.count();
        
        if (cardCount > 0) {
          const firstCard = pitchCards.first();
          await expect(firstCard.locator('[data-testid="pitch-genre"]')).toContainText('Action');
        }
      }
    });

    test('guest attempts to access restricted content and sees login prompts', async ({ page }) => {
      // Browse to pitches
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      if (await pitchCards.count() > 0) {
        // Click on first pitch
        await pitchCards.first().click();
        await pageHelper.waitForPageLoad();
        
        // Should see pitch details but limited
        await expect(page.locator('[data-testid="pitch-detail-header"]')).toBeVisible();
        
        // Try to access restricted features
        const restrictedActions = [
          '[data-testid="request-nda-button"]',
          '[data-testid="contact-creator-button"]',
          '[data-testid="save-pitch-button"]',
          '[data-testid="follow-creator-button"]'
        ];
        
        for (const action of restrictedActions) {
          const button = page.locator(action);
          if (await button.count() > 0) {
            await button.click();
            
            // Should see login prompt or be redirected
            const loginPrompt = page.locator('[data-testid="login-prompt"], [data-testid="auth-required"]');
            const isRedirected = page.url().includes('/login') || page.url().includes('/register');
            
            expect(await loginPrompt.count() > 0 || isRedirected).toBeTruthy();
            
            // Navigate back for next test
            if (isRedirected) {
              await page.goBack();
              await pageHelper.waitForPageLoad();
            }
          }
        }
      }
    });
  });

  test.describe('Registration Discovery Phase', () => {
    test('guest discovers "Create Your First Pitch" call-to-action', async ({ page }) => {
      // Look for create pitch CTAs on homepage
      const ctaButtons = [
        '[data-testid="create-first-pitch-cta"]',
        '[data-testid="get-started-button"]',
        '[data-testid="join-creators-button"]'
      ];
      
      for (const cta of ctaButtons) {
        const button = page.locator(cta);
        if (await button.count() > 0) {
          await expect(button).toBeVisible();
          await button.click();
          
          // Should navigate to registration flow
          const currentUrl = page.url();
          const isRegistrationFlow = currentUrl.includes('/register') || 
                                   currentUrl.includes('/portal-select') ||
                                   currentUrl.includes('/creator/register');
          
          expect(isRegistrationFlow).toBeTruthy();
          
          // Go back to test next CTA
          await page.goBack();
          await pageHelper.waitForPageLoad();
        }
      }
    });

    test('guest navigates through portal selection process', async ({ page }) => {
      // Navigate to portal selection
      await page.goto('/portal-select');
      
      // Should see all three portal options
      await expect(page.locator('[data-testid="creator-portal-option"]')).toBeVisible();
      await expect(page.locator('[data-testid="investor-portal-option"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-portal-option"]')).toBeVisible();
      
      // Each portal should have description and benefits
      const portalOptions = page.locator('[data-testid="portal-option"]');
      const optionCount = await portalOptions.count();
      
      for (let i = 0; i < optionCount; i++) {
        const option = portalOptions.nth(i);
        await expect(option.locator('[data-testid="portal-title"]')).toBeVisible();
        await expect(option.locator('[data-testid="portal-description"]')).toBeVisible();
        await expect(option.locator('[data-testid="portal-benefits"]')).toBeVisible();
      }
      
      // Click on Creator portal
      await page.click('[data-testid="creator-portal-option"]');
      
      // Should navigate to creator registration or more info
      await pageHelper.waitForPageLoad();
      const currentUrl = page.url();
      expect(currentUrl.includes('/creator') || currentUrl.includes('/register')).toBeTruthy();
    });

    test('guest views portal-specific information pages', async ({ page }) => {
      const portalInfoPages = [
        { portal: 'creator', testId: 'creator-info-link' },
        { portal: 'investor', testId: 'investor-info-link' },
        { portal: 'production', testId: 'production-info-link' }
      ];
      
      for (const { portal, testId } of portalInfoPages) {
        const infoLink = page.locator(`[data-testid="${testId}"]`);
        
        if (await infoLink.count() > 0) {
          await infoLink.click();
          await pageHelper.waitForPageLoad();
          
          // Should see portal-specific information
          await expect(page.locator(`[data-testid="${portal}-portal-features"]`)).toBeVisible();
          await expect(page.locator(`[data-testid="${portal}-benefits"]`)).toBeVisible();
          
          // Should have join CTA
          await expect(page.locator(`[data-testid="join-as-${portal}-button"]`)).toBeVisible();
          
          await page.goBack();
          await pageHelper.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Registration and Conversion', () => {
    test('guest completes creator registration flow', async ({ page }) => {
      console.log(`Starting creator registration for: ${testUserEmail}`);
      
      // Navigate to creator registration
      await page.goto('/creator/register');
      await pageHelper.waitForPageLoad();
      
      // Fill registration form
      await page.fill('[data-testid="email-input"], input[type="email"]', testUserEmail);
      await page.fill('[data-testid="password-input"], input[type="password"]', 'TestPassword123!');
      await page.fill('[data-testid="confirm-password-input"], input[name="confirmPassword"]', 'TestPassword123!');
      
      // Fill creator-specific fields
      await page.fill('[data-testid="first-name-input"], input[name="firstName"]', 'Test');
      await page.fill('[data-testid="last-name-input"], input[name="lastName"]', 'Creator');
      await page.fill('[data-testid="company-input"], input[name="company"]', 'Test Studios');
      
      // Select experience level
      const experienceSelect = page.locator('[data-testid="experience-select"], select[name="experience"]');
      if (await experienceSelect.count() > 0) {
        await experienceSelect.selectOption('beginner');
      }
      
      // Fill bio
      const bioTextarea = page.locator('[data-testid="bio-textarea"], textarea[name="bio"]');
      if (await bioTextarea.count() > 0) {
        await bioTextarea.fill('Aspiring filmmaker passionate about storytelling and visual arts.');
      }
      
      // Accept terms
      await page.check('[data-testid="terms-checkbox"], input[name="acceptTerms"]');
      
      // Submit registration
      await page.click('[data-testid="register-button"], button[type="submit"]');
      
      // Should navigate to dashboard or onboarding
      await page.waitForURL('**/creator/**', { timeout: 15000 });
      
      // Verify successful registration and login
      const currentUrl = page.url();
      expect(currentUrl.includes('/creator')).toBeTruthy();
      
      console.log('✓ Creator registration completed successfully');
    });

    test('new creator discovers dashboard and initial features', async ({ page }) => {
      // First register a new creator
      await page.goto('/creator/register');
      await pageHelper.waitForPageLoad();
      
      const newUserEmail = generateTestEmail('new-creator-discovery');
      
      await page.fill('input[type="email"]', newUserEmail);
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
      await page.fill('input[name="firstName"]', 'New');
      await page.fill('input[name="lastName"]', 'Creator');
      await page.fill('input[name="company"]', 'Discovery Studios');
      
      // Accept terms and submit
      await page.check('input[name="acceptTerms"]');
      await page.click('button[type="submit"]');
      
      // Wait for dashboard
      await page.waitForURL('**/creator/**', { timeout: 15000 });
      
      // Explore dashboard features
      await expect(page.locator('[data-testid="dashboard-welcome"], [data-testid="dashboard-header"]')).toBeVisible();
      
      // Check for onboarding or getting started elements
      const onboardingElements = [
        '[data-testid="getting-started"]',
        '[data-testid="onboarding-checklist"]',
        '[data-testid="first-time-user"]',
        '[data-testid="welcome-tour"]'
      ];
      
      let foundOnboarding = false;
      for (const element of onboardingElements) {
        if (await page.locator(element).count() > 0) {
          await expect(page.locator(element)).toBeVisible();
          foundOnboarding = true;
          break;
        }
      }
      
      // Check for create pitch CTA
      const createPitchButtons = [
        '[data-testid="create-pitch-button"]',
        '[data-testid="create-first-pitch"]',
        'button:has-text("Create Pitch")',
        'a:has-text("Create Your First Pitch")'
      ];
      
      let foundCreateButton = false;
      for (const button of createPitchButtons) {
        if (await page.locator(button).count() > 0) {
          await expect(page.locator(button)).toBeVisible();
          foundCreateButton = true;
          break;
        }
      }
      
      expect(foundCreateButton).toBeTruthy();
      
      console.log(`✓ New creator dashboard discovery completed. Onboarding: ${foundOnboarding}`);
    });
  });

  test.describe('First Pitch Creation Journey', () => {
    test('new creator creates and saves their first pitch', async ({ page }) => {
      // Register and login as new creator
      await page.goto('/creator/register');
      await pageHelper.waitForPageLoad();
      
      const creatorEmail = generateTestEmail('first-pitch-creator');
      
      // Quick registration
      await page.fill('input[type="email"]', creatorEmail);
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
      await page.fill('input[name="firstName"]', 'FirstPitch');
      await page.fill('input[name="lastName"]', 'Creator');
      await page.fill('input[name="company"]', 'Debut Studios');
      await page.check('input[name="acceptTerms"]');
      await page.click('button[type="submit"]');
      
      // Wait for dashboard
      await page.waitForURL('**/creator/**', { timeout: 15000 });
      
      // Navigate to create pitch
      const createPitchButtons = [
        '[data-testid="create-pitch-button"]',
        '[data-testid="create-first-pitch"]',
        'button:has-text("Create Pitch")',
        'a[href*="/create-pitch"]'
      ];
      
      let navigatedToPitch = false;
      for (const button of createPitchButtons) {
        const element = page.locator(button);
        if (await element.count() > 0) {
          await element.click();
          navigatedToPitch = true;
          break;
        }
      }
      
      if (!navigatedToPitch) {
        // Fallback: direct navigation
        await page.goto('/create-pitch');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Fill pitch form
      const testPitch = generateTestPitch({
        title: 'My First Amazing Pitch',
        budget: '2500000',
        synopsis: 'A heartfelt story about a newcomer to the film industry who discovers the power of storytelling.'
      });
      
      // Basic pitch information
      await page.fill('[data-testid="title-input"], input[name="title"]', testPitch.title);
      await page.fill('[data-testid="logline-input"], textarea[name="logline"]', testPitch.logline);
      await page.fill('[data-testid="synopsis-input"], textarea[name="synopsis"]', testPitch.synopsis);
      
      // Genre selection
      const genreSelect = page.locator('[data-testid="genre-select"], select[name="genre"]');
      if (await genreSelect.count() > 0) {
        await genreSelect.selectOption(testPitch.genre);
      }
      
      // Budget
      await page.fill('[data-testid="budget-input"], input[name="budget"]', testPitch.budget);
      
      // Format
      const formatSelect = page.locator('[data-testid="format-select"], select[name="format"]');
      if (await formatSelect.count() > 0) {
        await formatSelect.selectOption(testPitch.format);
      }
      
      // Target audience
      const audienceInput = page.locator('[data-testid="audience-input"], textarea[name="targetAudience"]');
      if (await audienceInput.count() > 0) {
        await audienceInput.fill(testPitch.targetAudience);
      }
      
      // Save as draft first
      const saveDraftButton = page.locator('[data-testid="save-draft-button"], button:has-text("Save Draft")');
      if (await saveDraftButton.count() > 0) {
        await saveDraftButton.click();
        await pageHelper.waitForPageLoad();
        
        // Should see draft saved confirmation
        const successMessage = page.locator('[data-testid="draft-saved"], .success-message');
        if (await successMessage.count() > 0) {
          await expect(successMessage).toBeVisible();
        }
      }
      
      // Continue to submit/publish
      const submitButton = page.locator('[data-testid="submit-pitch-button"], button:has-text("Submit"), button:has-text("Publish")');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await pageHelper.waitForPageLoad();
        
        // Should navigate to pitch detail or dashboard
        const currentUrl = page.url();
        expect(currentUrl.includes('/pitch/') || currentUrl.includes('/creator')).toBeTruthy();
      }
      
      console.log('✓ First pitch creation completed successfully');
    });

    test('new creator explores post-creation features', async ({ page }) => {
      // Use existing creator account for this test
      await page.goto('/creator/login');
      await page.fill('input[type="email"]', 'alex.creator@demo.com');
      await page.fill('input[type="password"]', 'Demo123');
      await page.click('button[type="submit"]');
      
      await page.waitForURL('**/creator/dashboard', { timeout: 15000 });
      
      // Explore dashboard features after having pitches
      const dashboardFeatures = [
        '[data-testid="my-pitches"]',
        '[data-testid="pitch-analytics"]',
        '[data-testid="nda-requests"]',
        '[data-testid="messages"]',
        '[data-testid="followers"]'
      ];
      
      for (const feature of dashboardFeatures) {
        const element = page.locator(feature);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          
          // Click to explore the feature
          await element.click();
          await pageHelper.waitForPageLoad();
          
          // Verify navigation worked
          const currentUrl = page.url();
          expect(currentUrl.includes('/creator')).toBeTruthy();
          
          // Go back to dashboard
          await page.goBack();
          await pageHelper.waitForPageLoad();
        }
      }
      
      console.log('✓ Post-creation feature exploration completed');
    });
  });

  test.describe('Conversion Success Validation', () => {
    test('converted creator can access all portal features', async ({ page }) => {
      // Login as demo creator
      await authHelper.loginAsCreator();
      
      // Verify access to key creator features
      const creatorFeatures = [
        { name: 'Analytics', url: '/creator/analytics' },
        { name: 'My Pitches', url: '/creator/pitches' },
        { name: 'NDA Management', url: '/creator/nda-management' },
        { name: 'Profile', url: '/creator/profile' },
        { name: 'Settings', url: '/creator/settings' }
      ];
      
      for (const feature of creatorFeatures) {
        await page.goto(feature.url);
        await pageHelper.waitForPageLoad();
        
        // Should not see access denied
        const accessDenied = page.locator('[data-testid="access-denied"], .error-message');
        if (await accessDenied.count() > 0) {
          await expect(accessDenied).not.toBeVisible();
        }
        
        // Should see relevant content for this feature
        const currentUrl = page.url();
        expect(currentUrl.includes(feature.url)).toBeTruthy();
        
        console.log(`✓ ${feature.name} accessible`);
      }
    });

    test('converted creator can interact with platform ecosystem', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Test pitch creation capability
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      await expect(page.locator('[data-testid="pitch-form"], form')).toBeVisible();
      
      // Test browsing capability
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      await expect(page.locator('[data-testid="pitch-grid"]')).toBeVisible();
      
      // Test search capability
      await page.goto('/search');
      await pageHelper.waitForPageLoad();
      
      const searchInput = page.locator('[data-testid="search-bar"], input[type="search"]');
      if (await searchInput.count() > 0) {
        await searchInput.fill('action');
        await page.press('[data-testid="search-bar"]', 'Enter');
        await pageHelper.waitForPageLoad();
        
        // Should see search results
        const results = page.locator('[data-testid="search-results"]');
        if (await results.count() > 0) {
          await expect(results).toBeVisible();
        }
      }
      
      // Test messaging access (if available)
      await page.goto('/messages');
      await pageHelper.waitForPageLoad();
      
      // Should not be blocked from messages page
      const currentUrl = page.url();
      expect(currentUrl.includes('/messages')).toBeTruthy();
      
      console.log('✓ Platform ecosystem interaction validated');
    });

    test('conversion journey performance metrics', async ({ page }) => {
      const journeyStartTime = Date.now();
      
      // Simulate key conversion journey steps with timing
      const steps = [
        { name: 'Homepage Load', action: () => page.goto('/') },
        { name: 'Browse Exploration', action: () => page.goto('/browse') },
        { name: 'Portal Selection', action: () => page.goto('/portal-select') },
        { name: 'Registration Page', action: () => page.goto('/creator/register') }
      ];
      
      const stepTimes: Record<string, number> = {};
      
      for (const step of steps) {
        const stepStart = Date.now();
        await step.action();
        await pageHelper.waitForPageLoad();
        stepTimes[step.name] = Date.now() - stepStart;
        
        // Each step should load within reasonable time
        expect(stepTimes[step.name]).toBeLessThan(5000);
      }
      
      const totalJourneyTime = Date.now() - journeyStartTime;
      
      console.log('Conversion Journey Performance:');
      for (const [step, time] of Object.entries(stepTimes)) {
        console.log(`  ${step}: ${time}ms`);
      }
      console.log(`  Total Journey Time: ${totalJourneyTime}ms`);
      
      // Total journey should complete within 30 seconds
      expect(totalJourneyTime).toBeLessThan(30000);
    });
  });
});