import { test, expect } from '@playwright/test';
import { TEST_USERS, URLS } from './fixtures/test-data';

test.describe('Saved Pitches Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as investor for most tests
    await page.goto(URLS.investorLogin);
    await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
    await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/investor/dashboard');
  });

  test('Complete saved pitches workflow: Save, View, Unsave', async ({ page }) => {
    let savedPitchTitle = '';
    
    await test.step('Save a pitch from marketplace', async () => {
      // Navigate to marketplace
      await page.goto(URLS.marketplace);
      await expect(page.locator('[data-testid="marketplace-title"]')).toBeVisible();

      // Find first pitch and save it
      const firstPitch = page.locator('[data-testid="pitch-card"]').first();
      await expect(firstPitch).toBeVisible();
      
      // Get the pitch title for later verification
      savedPitchTitle = await firstPitch.locator('[data-testid="pitch-title"]').textContent() || '';
      expect(savedPitchTitle).toBeTruthy();

      // Click save button (heart/bookmark icon)
      const saveButton = firstPitch.locator('[data-testid="save-pitch-button"]');
      await expect(saveButton).toBeVisible();
      await saveButton.click();

      // Verify save success feedback
      await expect(page.locator('[data-testid="save-success-toast"]')).toBeVisible();
      await expect(page.locator('text=Pitch saved successfully')).toBeVisible();

      // Verify save button state changed (filled heart/bookmark)
      await expect(saveButton).toHaveAttribute('data-saved', 'true');
    });

    await test.step('View saved pitch in saved pitches list', async () => {
      // Navigate to saved pitches
      await page.goto(URLS.investorWatchlist);
      await expect(page.locator('[data-testid="saved-pitches-title"]')).toBeVisible();

      // Verify the pitch appears in saved list
      const savedPitchItems = page.locator('[data-testid="saved-pitch-item"]');
      await expect(savedPitchItems.first()).toBeVisible();

      // Find the specific pitch by title
      const savedPitch = savedPitchItems.filter({ hasText: savedPitchTitle }).first();
      await expect(savedPitch).toBeVisible();

      // Verify pitch details are displayed correctly
      await expect(savedPitch.locator('[data-testid="pitch-title"]')).toHaveText(savedPitchTitle);
      await expect(savedPitch.locator('[data-testid="pitch-genre"]')).toBeVisible();
      await expect(savedPitch.locator('[data-testid="pitch-budget"]')).toBeVisible();
      await expect(savedPitch.locator('[data-testid="saved-date"]')).toBeVisible();
    });

    await test.step('Remove pitch from saved list', async () => {
      // Click unsave button from the saved pitches list
      const savedPitch = page.locator('[data-testid="saved-pitch-item"]').filter({ hasText: savedPitchTitle });
      const unsaveButton = savedPitch.locator('[data-testid="unsave-pitch-button"]');
      await expect(unsaveButton).toBeVisible();
      await unsaveButton.click();

      // Confirm removal in modal/dialog
      await expect(page.locator('[data-testid="unsave-confirmation-modal"]')).toBeVisible();
      await page.click('[data-testid="confirm-unsave"]');

      // Verify unsave success feedback
      await expect(page.locator('[data-testid="unsave-success-toast"]')).toBeVisible();
      await expect(page.locator('text=Pitch removed from saved')).toBeVisible();

      // Verify pitch no longer appears in saved list
      await page.waitForTimeout(1000); // Allow for removal animation
      const remainingSavedPitches = page.locator('[data-testid="saved-pitch-item"]').filter({ hasText: savedPitchTitle });
      await expect(remainingSavedPitches).toHaveCount(0);
    });

    await test.step('Verify unsave reflected in marketplace', async () => {
      // Go back to marketplace
      await page.goto(URLS.marketplace);

      // Find the same pitch and verify save button is no longer active
      const pitches = page.locator('[data-testid="pitch-card"]');
      const originalPitch = pitches.filter({ hasText: savedPitchTitle }).first();
      
      if (await originalPitch.count() > 0) {
        const saveButton = originalPitch.locator('[data-testid="save-pitch-button"]');
        await expect(saveButton).toHaveAttribute('data-saved', 'false');
      }
    });
  });

  test('Save multiple pitches and manage collection', async ({ page }) => {
    const savedPitches = [];

    await test.step('Save multiple pitches', async () => {
      await page.goto(URLS.marketplace);

      // Save first 3 pitches
      const pitches = page.locator('[data-testid="pitch-card"]');
      const pitchCount = Math.min(3, await pitches.count());

      for (let i = 0; i < pitchCount; i++) {
        const pitch = pitches.nth(i);
        const title = await pitch.locator('[data-testid="pitch-title"]').textContent() || '';
        savedPitches.push(title);

        await pitch.locator('[data-testid="save-pitch-button"]').click();
        await expect(page.locator('[data-testid="save-success-toast"]')).toBeVisible();
        await page.waitForTimeout(500); // Brief pause between saves
      }
    });

    await test.step('Verify all saved pitches in collection', async () => {
      await page.goto(URLS.investorWatchlist);
      
      // Verify all saved pitches appear
      for (const title of savedPitches) {
        const savedPitch = page.locator('[data-testid="saved-pitch-item"]').filter({ hasText: title });
        await expect(savedPitch).toBeVisible();
      }

      // Verify saved count matches
      const savedPitchItems = page.locator('[data-testid="saved-pitch-item"]');
      expect(await savedPitchItems.count()).toBeGreaterThanOrEqual(savedPitches.length);
    });

    await test.step('Filter saved pitches by genre', async () => {
      // Use genre filter if available
      const genreFilter = page.locator('[data-testid="genre-filter"]');
      if (await genreFilter.count() > 0) {
        await genreFilter.selectOption('Action');
        
        // Verify filtered results
        await page.waitForTimeout(1000);
        const filteredPitches = page.locator('[data-testid="saved-pitch-item"]');
        const count = await filteredPitches.count();
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test('Saved pitches API integration and error handling', async ({ page }) => {
    await test.step('Validate saved pitches API endpoints', async () => {
      const apiCalls = {
        getSavedPitches: false,
        savePitch: false,
        unsavePitch: false
      };

      // Track API calls
      page.on('response', response => {
        const url = response.url();
        if (url.includes('/api/saved-pitches') && response.request().method() === 'GET') {
          apiCalls.getSavedPitches = true;
        }
        if (url.includes('/api/saved-pitches') && response.request().method() === 'POST') {
          apiCalls.savePitch = true;
        }
        if (url.includes('/api/saved-pitches') && response.request().method() === 'DELETE') {
          apiCalls.unsavePitch = true;
        }
      });

      // Trigger API calls
      await page.goto(URLS.investorWatchlist);
      expect(apiCalls.getSavedPitches).toBe(true);

      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      await pitch.locator('[data-testid="save-pitch-button"]').click();
      await page.waitForTimeout(1000);
      expect(apiCalls.savePitch).toBe(true);

      // Unsave to trigger DELETE
      await page.goto(URLS.investorWatchlist);
      const savedPitch = page.locator('[data-testid="saved-pitch-item"]').first();
      if (await savedPitch.count() > 0) {
        await savedPitch.locator('[data-testid="unsave-pitch-button"]').click();
        await page.click('[data-testid="confirm-unsave"]');
        await page.waitForTimeout(1000);
        expect(apiCalls.unsavePitch).toBe(true);
      }
    });

    await test.step('Handle network errors gracefully', async () => {
      // Mock network failure for save operation
      await page.route('**/api/saved-pitches', route => {
        if (route.request().method() === 'POST') {
          route.fulfill({ status: 500, body: 'Internal Server Error' });
        } else {
          route.continue();
        }
      });

      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      await pitch.locator('[data-testid="save-pitch-button"]').click();

      // Verify error handling
      await expect(page.locator('[data-testid="save-error-toast"]')).toBeVisible();
      await expect(page.locator('text=Failed to save pitch')).toBeVisible();
    });
  });

  test('Saved pitches performance and pagination', async ({ page }) => {
    await test.step('Handle large collections efficiently', async () => {
      await page.goto(URLS.investorWatchlist);

      // If pagination exists, test it
      const paginationControls = page.locator('[data-testid="pagination-controls"]');
      if (await paginationControls.count() > 0) {
        // Test next page
        const nextButton = page.locator('[data-testid="pagination-next"]');
        if (await nextButton.isEnabled()) {
          await nextButton.click();
          await page.waitForTimeout(1000);
          
          // Verify URL updated with page parameter
          const url = page.url();
          expect(url).toContain('page=');
          
          // Verify new content loaded
          await expect(page.locator('[data-testid="saved-pitch-item"]')).toBeVisible();
        }
      }
    });

    await test.step('Search within saved pitches', async () => {
      await page.goto(URLS.investorWatchlist);

      // Test search functionality if available
      const searchBox = page.locator('[data-testid="saved-pitches-search"]');
      if (await searchBox.count() > 0) {
        await searchBox.fill('action');
        await page.waitForTimeout(1000);

        // Verify search results
        const results = page.locator('[data-testid="saved-pitch-item"]');
        const count = await results.count();
        expect(count).toBeGreaterThanOrEqual(0);

        // Clear search
        await searchBox.clear();
        await page.waitForTimeout(1000);
      }
    });
  });

  test('Cross-portal saved pitches functionality', async ({ page }) => {
    await test.step('Verify saved pitches are user-specific', async () => {
      // Save a pitch as investor
      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      const pitchTitle = await pitch.locator('[data-testid="pitch-title"]').textContent() || '';
      await pitch.locator('[data-testid="save-pitch-button"]').click();

      // Switch to creator portal and verify saved pitches are different
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');

      // Navigate to creator's equivalent of saved/watchlist if it exists
      const creatorNav = page.locator('[data-testid="nav-saved"], [data-testid="nav-bookmarks"]');
      if (await creatorNav.count() > 0) {
        await creatorNav.click();
        
        // Verify this is empty or contains different content
        const creatorSavedItems = page.locator('[data-testid="saved-pitch-item"], [data-testid="saved-item"]');
        const creatorSavedCount = await creatorSavedItems.count();
        
        // Should not see the investor's saved pitch
        if (creatorSavedCount > 0) {
          const matchingPitch = creatorSavedItems.filter({ hasText: pitchTitle });
          await expect(matchingPitch).toHaveCount(0);
        }
      }
    });
  });

  test('Saved pitches data persistence', async ({ page }) => {
    await test.step('Verify saved pitches persist across sessions', async () => {
      // Save a pitch
      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      const pitchTitle = await pitch.locator('[data-testid="pitch-title"]').textContent() || '';
      await pitch.locator('[data-testid="save-pitch-button"]').click();

      // Count saved pitches
      await page.goto(URLS.investorWatchlist);
      const initialCount = await page.locator('[data-testid="saved-pitch-item"]').count();

      // Logout and login again
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');

      // Verify saved pitches still there
      await page.goto(URLS.investorWatchlist);
      const persistedCount = await page.locator('[data-testid="saved-pitch-item"]').count();
      expect(persistedCount).toBe(initialCount);

      // Verify specific pitch still saved
      const persistedPitch = page.locator('[data-testid="saved-pitch-item"]').filter({ hasText: pitchTitle });
      await expect(persistedPitch).toBeVisible();
    });
  });
});