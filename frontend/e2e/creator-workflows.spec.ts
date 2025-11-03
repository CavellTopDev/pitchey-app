import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { TEST_PITCH, TEST_CHARACTER } from './fixtures/test-data';

test.describe('Creator Workflows', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    
    // Login as creator before each test
    await authHelper.loginAsCreator();
  });

  test.describe('Dashboard', () => {
    test('should display creator dashboard with key metrics', async ({ page }) => {
      await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Creator Dashboard');
      
      // Check for key dashboard components
      await expect(page.locator('[data-testid="total-pitches"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-views"]')).toBeVisible();
      await expect(page.locator('[data-testid="active-ndas"]')).toBeVisible();
      
      // Check for navigation links
      await expect(page.locator('[data-testid="create-pitch-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="manage-pitches-link"]')).toBeVisible();
    });

    test('should display recent activity', async ({ page }) => {
      const activitySection = page.locator('[data-testid="recent-activity"]');
      await expect(activitySection).toBeVisible();
    });

    test('should show analytics charts', async ({ page }) => {
      const analyticsSection = page.locator('[data-testid="analytics-section"]');
      await expect(analyticsSection).toBeVisible();
    });
  });

  test.describe('Pitch Creation', () => {
    test('should create a new pitch successfully', async ({ page }) => {
      // Navigate to create pitch
      await page.click('[data-testid="create-pitch-button"]');
      await expect(page).toHaveURL(/create-pitch/);

      // Fill basic information
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.fill('[data-testid="logline-input"]', TEST_PITCH.logline);
      await page.fill('[data-testid="synopsis-input"]', TEST_PITCH.synopsis);
      
      // Select genre
      await page.selectOption('[data-testid="genre-select"]', TEST_PITCH.genre);
      
      // Fill themes as free text
      await page.fill('[data-testid="themes-input"]', TEST_PITCH.themes);
      
      // Select format
      await page.selectOption('[data-testid="format-select"]', TEST_PITCH.format);
      
      // Fill budget
      await page.fill('[data-testid="budget-input"]', TEST_PITCH.budget);
      
      // Fill target audience
      await page.fill('[data-testid="target-audience-input"]', TEST_PITCH.targetAudience);
      
      // Fill world field
      await page.fill('[data-testid="world-input"]', TEST_PITCH.world);

      // Save as draft first
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');

      // Verify draft was saved
      await expect(page.locator('[data-testid="draft-status"]')).toContainText('Draft saved');
    });

    test('should validate required fields', async ({ page }) => {
      await page.click('[data-testid="create-pitch-button"]');
      
      // Try to save without filling required fields
      await page.click('[data-testid="save-draft-button"]');
      
      // Should show validation errors
      await expect(page.locator('[data-testid="title-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="logline-error"]')).toBeVisible();
    });

    test('should auto-save draft periodically', async ({ page }) => {
      await page.click('[data-testid="create-pitch-button"]');
      
      // Fill some content
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      
      // Wait for auto-save (5 seconds according to specs)
      await page.waitForTimeout(6000);
      
      // Should see auto-save indicator
      await expect(page.locator('[data-testid="auto-save-status"]')).toContainText('Auto-saved');
    });
  });

  test.describe('Character Management', () => {
    test.beforeEach(async ({ page }) => {
      // Create a pitch first
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
    });

    test('should add a new character', async ({ page }) => {
      // Navigate to character management section
      await page.click('[data-testid="characters-tab"]');
      
      // Add new character
      await page.click('[data-testid="add-character-button"]');
      
      // Fill character form
      await page.fill('[data-testid="character-name-input"]', TEST_CHARACTER.name);
      await page.fill('[data-testid="character-description-input"]', TEST_CHARACTER.description);
      await page.selectOption('[data-testid="character-role-select"]', TEST_CHARACTER.role);
      await page.fill('[data-testid="character-arc-input"]', TEST_CHARACTER.arc);
      
      // Save character
      await page.click('[data-testid="save-character-button"]');
      await pageHelper.waitForNotification('success');
      
      // Verify character appears in list
      await expect(page.locator('[data-testid="character-list"]')).toContainText(TEST_CHARACTER.name);
    });

    test('should edit existing character', async ({ page }) => {
      // First add a character
      await page.click('[data-testid="characters-tab"]');
      await page.click('[data-testid="add-character-button"]');
      await page.fill('[data-testid="character-name-input"]', TEST_CHARACTER.name);
      await page.click('[data-testid="save-character-button"]');
      await pageHelper.waitForNotification('success');
      
      // Edit the character
      await page.click('[data-testid="edit-character-button"]');
      await page.fill('[data-testid="character-name-input"]', 'Updated Character Name');
      await page.click('[data-testid="save-character-button"]');
      await pageHelper.waitForNotification('success');
      
      // Verify update
      await expect(page.locator('[data-testid="character-list"]')).toContainText('Updated Character Name');
    });

    test('should reorder characters', async ({ page }) => {
      // Add multiple characters first
      await page.click('[data-testid="characters-tab"]');
      
      for (let i = 1; i <= 3; i++) {
        await page.click('[data-testid="add-character-button"]');
        await page.fill('[data-testid="character-name-input"]', `Character ${i}`);
        await page.click('[data-testid="save-character-button"]');
        await pageHelper.waitForNotification('success');
      }
      
      // Test drag and drop reordering
      const firstCharacter = page.locator('[data-testid="character-item"]:first-child');
      const secondCharacter = page.locator('[data-testid="character-item"]:nth-child(2)');
      
      await firstCharacter.dragTo(secondCharacter);
      
      // Verify order changed
      await expect(page.locator('[data-testid="character-item"]:first-child')).toContainText('Character 2');
    });

    test('should delete character', async ({ page }) => {
      // Add a character first
      await page.click('[data-testid="characters-tab"]');
      await page.click('[data-testid="add-character-button"]');
      await page.fill('[data-testid="character-name-input"]', TEST_CHARACTER.name);
      await page.click('[data-testid="save-character-button"]');
      await pageHelper.waitForNotification('success');
      
      // Delete the character
      await page.click('[data-testid="delete-character-button"]');
      await page.click('[data-testid="confirm-delete-button"]');
      await pageHelper.waitForNotification('success');
      
      // Verify character is removed
      await expect(page.locator('[data-testid="character-list"]')).not.toContainText(TEST_CHARACTER.name);
    });
  });

  test.describe('File Uploads', () => {
    test.beforeEach(async ({ page }) => {
      // Create a pitch first
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
    });

    test('should upload multiple files', async ({ page }) => {
      // Navigate to documents section
      await page.click('[data-testid="documents-tab"]');
      
      // Create test files
      const testFiles = [
        { name: 'script.pdf', content: 'Test script content' },
        { name: 'treatment.docx', content: 'Test treatment content' }
      ];
      
      // Upload files
      await page.click('[data-testid="upload-files-button"]');
      
      // Simulate file selection (in real test, you'd use actual files)
      await page.setInputFiles('[data-testid="file-input"]', testFiles.map(f => ({
        name: f.name,
        mimeType: f.name.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from(f.content)
      })));
      
      // Wait for upload completion
      await expect(page.locator('[data-testid="upload-progress"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-complete"]')).toBeVisible();
      
      // Verify files appear in list
      await expect(page.locator('[data-testid="document-list"]')).toContainText('script.pdf');
      await expect(page.locator('[data-testid="document-list"]')).toContainText('treatment.docx');
    });

    test('should show upload progress', async ({ page }) => {
      await page.click('[data-testid="documents-tab"]');
      await page.click('[data-testid="upload-files-button"]');
      
      // Start upload
      await page.setInputFiles('[data-testid="file-input"]', [{
        name: 'large-file.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.alloc(1024 * 1024) // 1MB file
      }]);
      
      // Should show progress bar
      await expect(page.locator('[data-testid="upload-progress-bar"]')).toBeVisible();
      await expect(page.locator('[data-testid="upload-percentage"]')).toBeVisible();
    });
  });

  test.describe('Pitch Management', () => {
    test('should view all pitches', async ({ page }) => {
      await page.click('[data-testid="manage-pitches-link"]');
      
      await expect(page.locator('[data-testid="pitches-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="pitch-search"]')).toBeVisible();
      await expect(page.locator('[data-testid="pitch-filters"]')).toBeVisible();
    });

    test('should edit existing pitch', async ({ page }) => {
      // First create a pitch
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
      
      // Go to manage pitches
      await page.click('[data-testid="manage-pitches-link"]');
      
      // Edit the pitch
      await page.click('[data-testid="edit-pitch-button"]');
      
      // Update title
      await page.fill('[data-testid="title-input"]', 'Updated ' + TEST_PITCH.title);
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
    });

    test('should publish pitch', async ({ page }) => {
      // Create and save a complete pitch
      await page.click('[data-testid="create-pitch-button"]');
      
      // Fill all required fields
      await page.fill('[data-testid="title-input"]', TEST_PITCH.title);
      await page.fill('[data-testid="logline-input"]', TEST_PITCH.logline);
      await page.fill('[data-testid="synopsis-input"]', TEST_PITCH.synopsis);
      await page.selectOption('[data-testid="genre-select"]', TEST_PITCH.genre);
      
      // Save as draft first
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
      
      // Publish pitch
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');
      
      // Verify published status
      await expect(page.locator('[data-testid="pitch-status"]')).toContainText('Published');
    });
  });

  test.describe('Analytics', () => {
    test('should display pitch analytics', async ({ page }) => {
      await page.click('[data-testid="analytics-link"]');
      
      await expect(page.locator('[data-testid="views-chart"]')).toBeVisible();
      await expect(page.locator('[data-testid="engagement-metrics"]')).toBeVisible();
      await expect(page.locator('[data-testid="nda-requests-chart"]')).toBeVisible();
    });

    test('should filter analytics by date range', async ({ page }) => {
      await page.click('[data-testid="analytics-link"]');
      
      // Change date range
      await page.click('[data-testid="date-range-filter"]');
      await page.click('[data-testid="last-30-days"]');
      
      // Charts should update
      await expect(page.locator('[data-testid="views-chart"]')).toBeVisible();
    });

    test('should export analytics data', async ({ page }) => {
      await page.click('[data-testid="analytics-link"]');
      
      // Start download
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-analytics-button"]');
      const download = await downloadPromise;
      
      // Verify download
      expect(download.suggestedFilename()).toContain('analytics');
    });
  });
});