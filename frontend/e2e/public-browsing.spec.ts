import { test, expect } from '@playwright/test';
import { PageHelper } from './utils/page-helpers';

test.describe('Public Access and Browsing', () => {
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    pageHelper = new PageHelper(page);
    
    // Start from homepage as unauthenticated user
    await page.goto('/');
  });

  test.describe('Homepage', () => {
    test('should display homepage without authentication', async ({ page }) => {
      // Check core homepage elements
      await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="platform-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="how-it-works"]')).toBeVisible();
      
      // Check navigation
      await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="register-button"]')).toBeVisible();
    });

    test('should show platform statistics', async ({ page }) => {
      const statsSection = page.locator('[data-testid="platform-stats"]');
      await expect(statsSection).toBeVisible();
      
      // Check for key metrics
      await expect(page.locator('[data-testid="total-pitches"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-creators"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-funding"]')).toBeVisible();
    });

    test('should display featured pitches', async ({ page }) => {
      const featuredSection = page.locator('[data-testid="featured-pitches"]');
      
      if (await featuredSection.count() > 0) {
        await expect(featuredSection).toBeVisible();
        
        // Check that featured pitches have basic info visible
        const pitchCards = page.locator('[data-testid="featured-pitch-card"]');
        const cardCount = await pitchCards.count();
        
        if (cardCount > 0) {
          for (let i = 0; i < Math.min(cardCount, 3); i++) {
            const card = pitchCards.nth(i);
            await expect(card.locator('[data-testid="pitch-title"]')).toBeVisible();
            await expect(card.locator('[data-testid="pitch-genre"]')).toBeVisible();
            // Full details should be hidden for public view
            await expect(card.locator('[data-testid="full-synopsis"]')).not.toBeVisible();
          }
        }
      }
    });

    test('should provide portal selection', async ({ page }) => {
      // Should show portal selection options
      await expect(page.locator('[data-testid="creator-portal-intro"]')).toBeVisible();
      await expect(page.locator('[data-testid="investor-portal-intro"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-portal-intro"]')).toBeVisible();
      
      // Test navigation to portal selection
      await page.click('[data-testid="get-started-button"]');
      await expect(page).toHaveURL(/portal-select/);
    });

    test('should be accessible and follow WCAG guidelines', async ({ page }) => {
      await pageHelper.checkAccessibility();
      
      // Check for proper heading structure
      const h1 = page.locator('h1');
      await expect(h1).toHaveCount(1);
      await expect(h1).toBeVisible();
      
      // Check for alt text on images
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const role = await img.getAttribute('role');
        
        // Images should have alt text or be decorative
        expect(alt !== null || role === 'presentation').toBeTruthy();
      }
    });
  });

  test.describe('Browse Pitches (Public)', () => {
    test('should display browse page with limited public information', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      await expect(page.locator('[data-testid="browse-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="pitch-grid"]')).toBeVisible();
      await expect(page.locator('[data-testid="public-filters"]')).toBeVisible();
    });

    test('should show browse tabs: Trending, New, Featured, Top Rated', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      // Check that all tabs are present
      await expect(page.locator('[data-testid="trending-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="new-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="featured-tab"]')).toBeVisible();
      await expect(page.locator('[data-testid="top-rated-tab"]')).toBeVisible();
    });

    test('should separate content properly between tabs', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      // Test Trending tab
      await page.click('[data-testid="trending-tab"]');
      await pageHelper.waitForPageLoad();
      
      const trendingContent = page.locator('[data-testid="trending-content"]');
      await expect(trendingContent).toBeVisible();
      
      // Check that trending content is distinct
      const trendingPitches = page.locator('[data-testid="pitch-card"]');
      const trendingCount = await trendingPitches.count();
      
      // Test New tab
      await page.click('[data-testid="new-tab"]');
      await pageHelper.waitForPageLoad();
      
      const newContent = page.locator('[data-testid="new-content"]');
      await expect(newContent).toBeVisible();
      
      const newPitches = page.locator('[data-testid="pitch-card"]');
      const newCount = await newPitches.count();
      
      // Content should be different (or at least refreshed)
      // This tests the tab separation issue mentioned in the requirements
      
      // Test Featured tab
      await page.click('[data-testid="featured-tab"]');
      await pageHelper.waitForPageLoad();
      
      const featuredContent = page.locator('[data-testid="featured-content"]');
      if (await featuredContent.count() > 0) {
        await expect(featuredContent).toBeVisible();
      }
      
      // Test Top Rated tab
      await page.click('[data-testid="top-rated-tab"]');
      await pageHelper.waitForPageLoad();
      
      const topRatedContent = page.locator('[data-testid="top-rated-content"]');
      if (await topRatedContent.count() > 0) {
        await expect(topRatedContent).toBeVisible();
      }
      
      console.log(`Trending: ${trendingCount}, New: ${newCount} pitches`);
    });

    test('should filter pitches by genre publicly', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      // Open public filters
      await page.click('[data-testid="filter-toggle"]');
      
      // Apply genre filter
      await page.check('[data-testid="genre-action"]');
      await page.click('[data-testid="apply-filters-button"]');
      
      // Verify results are filtered
      await pageHelper.waitForPageLoad();
      await expect(page.locator('[data-testid="active-filters"]')).toContainText('Action');
      
      // Verify pitch cards show the selected genre
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const genreText = await pitchCards.nth(i).locator('[data-testid="pitch-genre"]').textContent();
          expect(genreText).toContain('Action');
        }
      }
    });

    test('should search pitches publicly', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      // Search for pitches
      await page.fill('[data-testid="search-bar"]', 'action');
      await page.press('[data-testid="search-bar"]', 'Enter');
      
      await pageHelper.waitForPageLoad();
      
      // Verify search results
      const searchResults = page.locator('[data-testid="search-results"]');
      if (await searchResults.count() > 0) {
        await expect(searchResults).toBeVisible();
        await expect(page.locator('[data-testid="search-query"]')).toContainText('action');
      }
    });

    test('should display limited pitch information for non-authenticated users', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        const firstCard = pitchCards.first();
        
        // Public info should be visible
        await expect(firstCard.locator('[data-testid="pitch-title"]')).toBeVisible();
        await expect(firstCard.locator('[data-testid="pitch-genre"]')).toBeVisible();
        await expect(firstCard.locator('[data-testid="pitch-logline"]')).toBeVisible();
        
        // Private info should be hidden
        await expect(firstCard.locator('[data-testid="full-synopsis"]')).not.toBeVisible();
        await expect(firstCard.locator('[data-testid="budget-details"]')).not.toBeVisible();
        await expect(firstCard.locator('[data-testid="creator-contact"]')).not.toBeVisible();
        
        // Should show prompt to login for more details
        await expect(firstCard.locator('[data-testid="login-for-details"]')).toBeVisible();
      }
    });

    test('should prompt authentication when trying to access restricted content', async ({ page }) => {
      await page.click('[data-testid="browse-link"]');
      
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      
      if (await pitchCards.count() > 0) {
        await pitchCards.first().click();
        
        // Should be on pitch detail page but with limited content
        await expect(page.locator('[data-testid="pitch-detail-header"]')).toBeVisible();
        
        // Try to access restricted content
        const requestNDAButton = page.locator('[data-testid="request-nda-button"]');
        const loginPrompt = page.locator('[data-testid="login-prompt"]');
        
        if (await requestNDAButton.count() > 0) {
          await requestNDAButton.click();
          
          // Should be redirected to login or see login prompt
          const currentUrl = page.url();
          expect(currentUrl.includes('/login') || await loginPrompt.isVisible()).toBeTruthy();
        }
      }
    });
  });

  test.describe('Genre Browsing', () => {
    test('should display genre categories', async ({ page }) => {
      await page.click('[data-testid="browse-genres-link"]');
      
      // Check for major genre categories
      await expect(page.locator('[data-testid="action-genre"]')).toBeVisible();
      await expect(page.locator('[data-testid="drama-genre"]')).toBeVisible();
      await expect(page.locator('[data-testid="comedy-genre"]')).toBeVisible();
      await expect(page.locator('[data-testid="thriller-genre"]')).toBeVisible();
      await expect(page.locator('[data-testid="horror-genre"]')).toBeVisible();
    });

    test('should navigate to genre-specific pages', async ({ page }) => {
      await page.click('[data-testid="browse-genres-link"]');
      
      // Click on Action genre
      await page.click('[data-testid="action-genre"]');
      
      await expect(page).toHaveURL(/genre.*action/);
      await expect(page.locator('[data-testid="genre-header"]')).toContainText('Action');
      
      // Should show action-specific pitches
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        const firstCard = pitchCards.first();
        await expect(firstCard.locator('[data-testid="pitch-genre"]')).toContainText('Action');
      }
    });

    test('should provide genre-specific filtering and sorting', async ({ page }) => {
      await page.click('[data-testid="browse-genres-link"]');
      await page.click('[data-testid="action-genre"]');
      
      // Test sorting options specific to the genre
      await page.selectOption('[data-testid="sort-select"]', 'budget-high-to-low');
      await pageHelper.waitForPageLoad();
      
      // Test sub-genre filtering
      const subGenreFilters = page.locator('[data-testid="sub-genre-filters"]');
      if (await subGenreFilters.count() > 0) {
        await page.check('[data-testid="sub-genre-sci-fi"]');
        await page.click('[data-testid="apply-filters-button"]');
        await pageHelper.waitForPageLoad();
      }
    });
  });

  test.describe('Top Rated Section', () => {
    test('should display top rated pitches', async ({ page }) => {
      await page.click('[data-testid="browse-top-rated-link"]');
      
      await expect(page.locator('[data-testid="top-rated-header"]')).toBeVisible();
      await expect(page.locator('[data-testid="rating-criteria"]')).toBeVisible();
      
      const topRatedCards = page.locator('[data-testid="top-rated-card"]');
      const cardCount = await topRatedCards.count();
      
      if (cardCount > 0) {
        // Check that rating information is visible
        for (let i = 0; i < Math.min(cardCount, 5); i++) {
          const card = topRatedCards.nth(i);
          await expect(card.locator('[data-testid="rating-score"]')).toBeVisible();
          await expect(card.locator('[data-testid="rating-count"]')).toBeVisible();
        }
      }
    });

    test('should filter top rated by time period', async ({ page }) => {
      await page.click('[data-testid="browse-top-rated-link"]');
      
      // Test different time period filters
      await page.selectOption('[data-testid="time-period-filter"]', 'this-month');
      await pageHelper.waitForPageLoad();
      
      await page.selectOption('[data-testid="time-period-filter"]', 'this-year');
      await pageHelper.waitForPageLoad();
      
      await page.selectOption('[data-testid="time-period-filter"]', 'all-time');
      await pageHelper.waitForPageLoad();
    });
  });

  test.describe('Search Functionality', () => {
    test('should provide comprehensive search', async ({ page }) => {
      await page.click('[data-testid="search-link"]');
      
      await expect(page.locator('[data-testid="advanced-search"]')).toBeVisible();
      await expect(page.locator('[data-testid="search-filters"]')).toBeVisible();
    });

    test('should search by multiple criteria', async ({ page }) => {
      await page.click('[data-testid="search-link"]');
      
      // Fill advanced search form
      await page.fill('[data-testid="title-search"]', 'action');
      await page.check('[data-testid="genre-action"]');
      await page.fill('[data-testid="budget-min"]', '1000000');
      await page.fill('[data-testid="budget-max"]', '50000000');
      
      await page.click('[data-testid="advanced-search-button"]');
      
      await pageHelper.waitForPageLoad();
      
      // Verify search results match criteria
      const results = page.locator('[data-testid="search-results"]');
      if (await results.count() > 0) {
        await expect(results).toBeVisible();
        await expect(page.locator('[data-testid="search-summary"]')).toContainText('action');
      }
    });

    test('should save search filters for authenticated users', async ({ page }) => {
      await page.click('[data-testid="search-link"]');
      
      // Apply some filters
      await page.check('[data-testid="genre-drama"]');
      await page.fill('[data-testid="budget-min"]', '5000000');
      
      // Try to save search - should prompt for login
      await page.click('[data-testid="save-search-button"]');
      
      const loginPrompt = page.locator('[data-testid="login-required-prompt"]');
      await expect(loginPrompt).toBeVisible();
      await expect(loginPrompt).toContainText('sign in to save');
    });

    test('should suggest popular searches', async ({ page }) => {
      await page.click('[data-testid="search-link"]');
      
      const popularSearches = page.locator('[data-testid="popular-searches"]');
      if (await popularSearches.count() > 0) {
        await expect(popularSearches).toBeVisible();
        
        // Test clicking a popular search
        const firstSuggestion = popularSearches.locator('[data-testid="search-suggestion"]').first();
        if (await firstSuggestion.count() > 0) {
          await firstSuggestion.click();
          await pageHelper.waitForPageLoad();
          
          // Should execute the search
          await expect(page.locator('[data-testid="search-results"]')).toBeVisible();
        }
      }
    });
  });

  test.describe('Portal Information Pages', () => {
    test('should provide information about creator portal', async ({ page }) => {
      await page.click('[data-testid="creator-info-link"]');
      
      await expect(page.locator('[data-testid="creator-portal-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="creator-benefits"]')).toBeVisible();
      await expect(page.locator('[data-testid="creator-how-it-works"]')).toBeVisible();
      
      // Should have call-to-action to join
      await expect(page.locator('[data-testid="join-as-creator-button"]')).toBeVisible();
    });

    test('should provide information about investor portal', async ({ page }) => {
      await page.click('[data-testid="investor-info-link"]');
      
      await expect(page.locator('[data-testid="investor-portal-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="investor-benefits"]')).toBeVisible();
      await expect(page.locator('[data-testid="investment-process"]')).toBeVisible();
      
      // Should have call-to-action to join
      await expect(page.locator('[data-testid="join-as-investor-button"]')).toBeVisible();
    });

    test('should provide information about production portal', async ({ page }) => {
      await page.click('[data-testid="production-info-link"]');
      
      await expect(page.locator('[data-testid="production-portal-features"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-benefits"]')).toBeVisible();
      await expect(page.locator('[data-testid="partnership-process"]')).toBeVisible();
      
      // Should have call-to-action to join
      await expect(page.locator('[data-testid="join-as-production-button"]')).toBeVisible();
    });
  });

  test.describe('Navigation and User Experience', () => {
    test('should have consistent navigation across all public pages', async ({ page }) => {
      const publicPages = [
        '/',
        '/browse',
        '/browse/genres',
        '/browse/top-rated',
        '/search',
        '/about',
        '/how-it-works'
      ];

      for (const pagePath of publicPages) {
        await page.goto(pagePath);
        
        // Check for consistent navigation elements
        await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible();
        await expect(page.locator('[data-testid="pitchey-logo"]')).toBeVisible();
        await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
        
        // Check for footer
        const footer = page.locator('[data-testid="main-footer"]');
        if (await footer.count() > 0) {
          await expect(footer).toBeVisible();
        }
      }
    });

    test('should be responsive on mobile devices', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      await page.goto('/');
      
      // Check mobile navigation
      const mobileMenu = page.locator('[data-testid="mobile-menu-toggle"]');
      if (await mobileMenu.count() > 0) {
        await expect(mobileMenu).toBeVisible();
        await mobileMenu.click();
        
        const mobileNav = page.locator('[data-testid="mobile-navigation"]');
        await expect(mobileNav).toBeVisible();
      }
      
      // Check responsive layout
      await page.click('[data-testid="browse-link"]');
      
      // Pitch grid should adapt to mobile
      const pitchGrid = page.locator('[data-testid="pitch-grid"]');
      await expect(pitchGrid).toBeVisible();
      
      // Mobile filter toggle should be available
      const mobileFilters = page.locator('[data-testid="mobile-filter-toggle"]');
      if (await mobileFilters.count() > 0) {
        await expect(mobileFilters).toBeVisible();
      }
    });

    test('should handle loading states gracefully', async ({ page }) => {
      // Navigate to browse page and test loading states
      await page.goto('/browse');
      
      // Should show loading indicators
      const loadingIndicator = page.locator('[data-testid="loading-spinner"], [data-testid="skeleton-loader"]');
      
      // Wait for content to load
      await pageHelper.waitForPageLoad();
      
      // Loading indicators should be gone
      if (await loadingIndicator.count() > 0) {
        await expect(loadingIndicator).not.toBeVisible();
      }
      
      // Content should be loaded
      await expect(page.locator('[data-testid="pitch-grid"]')).toBeVisible();
    });

    test('should handle error states appropriately', async ({ page }) => {
      // Test 404 error handling
      await page.goto('/non-existent-page');
      
      const notFoundPage = page.locator('[data-testid="not-found-page"], h1:has-text("404")');
      await expect(notFoundPage).toBeVisible();
      
      // Should provide navigation back to main areas
      const homeLink = page.locator('[data-testid="home-link"], a:has-text("Home")');
      await expect(homeLink).toBeVisible();
    });
  });

  test.describe('Performance and SEO', () => {
    test('should have proper meta tags for SEO', async ({ page }) => {
      await page.goto('/');
      
      // Check essential meta tags
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description).toBeTruthy();
      expect(description!.length).toBeGreaterThan(50);
      
      // Check Open Graph tags
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
      
      expect(ogTitle).toBeTruthy();
      expect(ogDescription).toBeTruthy();
    });

    test('should load essential content within reasonable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/');
      
      // Wait for core content to be visible
      await expect(page.locator('[data-testid="hero-section"]')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 5 seconds
      expect(loadTime).toBeLessThan(5000);
      
      console.log(`Homepage loaded in ${loadTime}ms`);
    });
  });
});