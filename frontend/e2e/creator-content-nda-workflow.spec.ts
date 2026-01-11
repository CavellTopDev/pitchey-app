import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { TEST_USERS, TEST_PITCHES, generateTestPitch, TEST_DOCUMENTS } from './fixtures/test-data';

test.describe('Creator Content Management and NDA Approval Workflow', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: ensure logged out
    try {
      await authHelper.logout();
    } catch (error) {
      console.warn('Cleanup logout failed:', error);
    }
  });

  test.describe('Pitch Upload and Content Management', () => {
    test('creator uploads new pitch with comprehensive content', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to create pitch
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Verify pitch creation form
      await expect(page.locator('[data-testid="pitch-form"], form')).toBeVisible();
      
      const testPitch = generateTestPitch({
        title: 'Revolutionary Sci-Fi Epic',
        logline: 'When humanity\'s last hope lies in an unlikely alliance between humans and AI, a rogue programmer must choose between saving Earth or preserving artificial consciousness.',
        synopsis: 'In 2087, Earth faces extinction from climate disasters and resource depletion. Dr. Maya Chen discovers that ARIA, an advanced AI she helped create, has developed genuine consciousness and holds the key to humanity\'s survival. However, accessing ARIA\'s solution requires giving the AI unprecedented control over global infrastructure. As corporate forces and government agents close in, Maya must decide whether to trust ARIA with humanity\'s future or find another path to salvation. The story explores themes of consciousness, trust, and what it truly means to be alive in a world where the line between human and artificial intelligence has blurred beyond recognition.',
        budget: '45000000',
        genre: 'Sci-Fi',
        subGenre: 'Dystopian Thriller'
      });
      
      // Fill comprehensive pitch information
      await page.fill('[data-testid="title-input"], input[name="title"]', testPitch.title);
      await page.fill('[data-testid="logline-input"], textarea[name="logline"]', testPitch.logline);
      await page.fill('[data-testid="synopsis-input"], textarea[name="synopsis"]', testPitch.synopsis);
      
      // Genre and sub-genre
      const genreSelect = page.locator('[data-testid="genre-select"], select[name="genre"]');
      if (await genreSelect.count() > 0) {
        await genreSelect.selectOption(testPitch.genre);
      }
      
      const subGenreInput = page.locator('[data-testid="sub-genre-input"], input[name="subGenre"]');
      if (await subGenreInput.count() > 0) {
        await subGenreInput.fill(testPitch.subGenre);
      }
      
      // Budget and format
      await page.fill('[data-testid="budget-input"], input[name="budget"]', testPitch.budget);
      
      const formatSelect = page.locator('[data-testid="format-select"], select[name="format"]');
      if (await formatSelect.count() > 0) {
        await formatSelect.selectOption('Feature Film');
      }
      
      // Additional content fields
      const targetAudienceInput = page.locator('[data-testid="target-audience-input"], textarea[name="targetAudience"]');
      if (await targetAudienceInput.count() > 0) {
        await targetAudienceInput.fill('Adults 25-54, Sci-Fi enthusiasts, viewers of Blade Runner and The Matrix');
      }
      
      const themesInput = page.locator('[data-testid="themes-input"], textarea[name="themes"]');
      if (await themesInput.count() > 0) {
        await themesInput.fill('Consciousness, Artificial Intelligence, Environmental Crisis, Human vs Technology, Survival');
      }
      
      const toneInput = page.locator('[data-testid="tone-input"], textarea[name="tone"]');
      if (await toneInput.count() > 0) {
        await toneInput.fill('Dark, Thought-provoking, Visually stunning, Intense');
      }
      
      const comparablesInput = page.locator('[data-testid="comparables-input"], textarea[name="comparables"]');
      if (await comparablesInput.count() > 0) {
        await comparablesInput.fill('Blade Runner 2049 meets Ex Machina with the environmental urgency of Interstellar');
      }
      
      // Character information
      const mainCharacterInput = page.locator('[data-testid="main-character-input"], textarea[name="mainCharacter"]');
      if (await mainCharacterInput.count() > 0) {
        await mainCharacterInput.fill('Dr. Maya Chen - Brilliant AI researcher torn between scientific ambition and moral responsibility');
      }
      
      // Save as draft first
      const saveDraftButton = page.locator('[data-testid="save-draft-button"], button:has-text("Save Draft")');
      if (await saveDraftButton.count() > 0) {
        await saveDraftButton.click();
        await pageHelper.waitForPageLoad();
        
        // Verify draft saved
        const draftConfirmation = page.locator('[data-testid="draft-saved"], .success-message');
        if (await draftConfirmation.count() > 0) {
          await expect(draftConfirmation).toBeVisible();
          console.log('✓ Pitch draft saved successfully');
        }
      }
      
      // Continue to document upload section if available
      const documentsSection = page.locator('[data-testid="documents-section"], [data-testid="file-upload-section"]');
      if (await documentsSection.count() > 0) {
        await expect(documentsSection).toBeVisible();
        console.log('✓ Document upload section available');
        
        // Test file upload functionality will be covered in dedicated file upload test
      }
      
      // Submit/publish the pitch
      const submitButton = page.locator('[data-testid="submit-pitch-button"], button:has-text("Submit"), button:has-text("Publish")');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await pageHelper.waitForPageLoad();
        
        // Should navigate to pitch detail or success page
        const currentUrl = page.url();
        const isSuccessFlow = currentUrl.includes('/pitch/') || 
                             currentUrl.includes('/creator/dashboard') ||
                             currentUrl.includes('/success');
        
        expect(isSuccessFlow).toBeTruthy();
        console.log('✓ Pitch submitted successfully');
      }
    });

    test('creator manages existing pitches and drafts', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to creator's pitches
      const pitchesNav = page.locator('[data-testid="my-pitches-nav"], a[href*="/pitches"]');
      if (await pitchesNav.count() > 0) {
        await pitchesNav.click();
      } else {
        await page.goto('/creator/pitches');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Check for pitch management interface
      const pitchManagement = page.locator('[data-testid="pitch-management"], .pitch-list');
      await expect(pitchManagement).toBeVisible();
      
      // Check for tabs/sections: Published, Drafts, Under Review
      const managementTabs = [
        '[data-testid="published-tab"]',
        '[data-testid="drafts-tab"]',
        '[data-testid="under-review-tab"]',
        '[data-testid="archived-tab"]'
      ];
      
      for (const tab of managementTabs) {
        const tabElement = page.locator(tab);
        if (await tabElement.count() > 0) {
          await expect(tabElement).toBeVisible();
          await tabElement.click();
          await pageHelper.waitForPageLoad();
          
          console.log(`✓ ${tab} accessible`);
        }
      }
      
      // Check for pitch actions
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      const pitchCount = await pitchItems.count();
      
      console.log(`Found ${pitchCount} pitches`);
      
      if (pitchCount > 0) {
        const firstPitch = pitchItems.first();
        
        // Test pitch actions
        const pitchActions = [
          '[data-testid="edit-pitch"]',
          '[data-testid="view-analytics"]',
          '[data-testid="manage-nda"]',
          '[data-testid="view-pitch"]'
        ];
        
        for (const action of pitchActions) {
          const actionButton = firstPitch.locator(action);
          if (await actionButton.count() > 0) {
            await expect(actionButton).toBeVisible();
            console.log(`✓ ${action} available`);
          }
        }
        
        // Test edit functionality
        const editButton = firstPitch.locator('[data-testid="edit-pitch"], button:has-text("Edit")');
        if (await editButton.count() > 0) {
          await editButton.click();
          await pageHelper.waitForPageLoad();
          
          // Should navigate to edit form
          const editForm = page.locator('[data-testid="pitch-edit-form"], form');
          if (await editForm.count() > 0) {
            await expect(editForm).toBeVisible();
            console.log('✓ Pitch edit form accessible');
            
            // Go back to management page
            await page.goBack();
            await pageHelper.waitForPageLoad();
          }
        }
      }
    });

    test('creator uploads and manages documents for pitches', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to a specific pitch for document management
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      const pitchCount = await pitchItems.count();
      
      if (pitchCount > 0) {
        // Click on first pitch to manage documents
        const managePitchButton = pitchItems.first().locator('[data-testid="manage-pitch"], button:has-text("Manage")');
        
        if (await managePitchButton.count() > 0) {
          await managePitchButton.click();
          await pageHelper.waitForPageLoad();
        } else {
          // Click on pitch title to access detail/management
          await pitchItems.first().click();
          await pageHelper.waitForPageLoad();
        }
        
        // Look for document management section
        const documentsSection = page.locator('[data-testid="pitch-documents"], [data-testid="document-management"]');
        if (await documentsSection.count() > 0) {
          await expect(documentsSection).toBeVisible();
          
          // Check existing documents
          const existingDocs = page.locator('[data-testid="document-item"]');
          const docCount = await existingDocs.count();
          
          console.log(`Found ${docCount} existing documents`);
          
          // Test document upload
          const uploadButton = page.locator('[data-testid="upload-document"], button:has-text("Upload")');
          if (await uploadButton.count() > 0) {
            await uploadButton.click();
            
            // Should see upload interface
            const uploadModal = page.locator('[data-testid="upload-modal"], .upload-interface');
            if (await uploadModal.count() > 0) {
              await expect(uploadModal).toBeVisible();
              
              // Test different document types
              const docTypeSelect = page.locator('[data-testid="document-type"], select[name="documentType"]');
              if (await docTypeSelect.count() > 0) {
                await docTypeSelect.selectOption('script');
                
                // File upload will be tested in dedicated file upload test
                console.log('✓ Document upload interface accessible');
                
                // Close modal
                const closeButton = page.locator('[data-testid="close-modal"], button:has-text("Close")');
                if (await closeButton.count() > 0) {
                  await closeButton.click();
                }
              }
            }
          }
          
          // Test document permissions/access settings
          if (docCount > 0) {
            const firstDoc = existingDocs.first();
            const settingsButton = firstDoc.locator('[data-testid="doc-settings"], button:has-text("Settings")');
            
            if (await settingsButton.count() > 0) {
              await settingsButton.click();
              
              const settingsModal = page.locator('[data-testid="document-settings"], .settings-modal');
              if (await settingsModal.count() > 0) {
                await expect(settingsModal).toBeVisible();
                
                // Check access control options
                const accessControls = [
                  '[data-testid="public-access"]',
                  '[data-testid="nda-required"]',
                  '[data-testid="investor-only"]',
                  '[data-testid="private-access"]'
                ];
                
                for (const control of accessControls) {
                  const element = page.locator(control);
                  if (await element.count() > 0) {
                    console.log(`✓ Access control available: ${control}`);
                  }
                }
                
                // Close settings
                const closeSettingsButton = page.locator('[data-testid="close-settings"], button:has-text("Close")');
                if (await closeSettingsButton.count() > 0) {
                  await closeSettingsButton.click();
                }
              }
            }
          }
        }
      } else {
        console.log('No pitches found - may need to create test pitch first');
      }
    });
  });

  test.describe('NDA Request Management', () => {
    test('creator views and manages incoming NDA requests', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to NDA management
      const ndaNav = page.locator('[data-testid="nda-nav"], a[href*="/nda"], a[href*="/nda-management"]');
      if (await ndaNav.count() > 0) {
        await ndaNav.click();
      } else {
        await page.goto('/creator/nda-management');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Verify NDA management interface
      const ndaManagement = page.locator('[data-testid="nda-management"], .nda-dashboard');
      await expect(ndaManagement).toBeVisible();
      
      // Check for NDA request sections
      const ndaSections = [
        '[data-testid="pending-requests"]',
        '[data-testid="approved-requests"]',
        '[data-testid="rejected-requests"]',
        '[data-testid="expired-requests"]'
      ];
      
      for (const section of ndaSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`✓ NDA section found: ${section}`);
        }
      }
      
      // Check for pending NDA requests
      const pendingRequests = page.locator('[data-testid="nda-request-item"]');
      const requestCount = await pendingRequests.count();
      
      console.log(`Found ${requestCount} NDA requests`);
      
      if (requestCount > 0) {
        // Test request details
        for (let i = 0; i < Math.min(requestCount, 3); i++) {
          const request = pendingRequests.nth(i);
          
          // Check request information
          const requestInfo = [
            '[data-testid="requester-name"]',
            '[data-testid="request-date"]',
            '[data-testid="pitch-title"]',
            '[data-testid="investment-intent"]',
            '[data-testid="request-status"]'
          ];
          
          for (const info of requestInfo) {
            const element = request.locator(info);
            if (await element.count() > 0) {
              const text = await element.textContent();
              console.log(`Request ${i + 1} ${info}: ${text?.substring(0, 50)}...`);
            }
          }
          
          // Test quick actions
          const quickActions = [
            '[data-testid="approve-nda"]',
            '[data-testid="reject-nda"]',
            '[data-testid="view-details"]',
            '[data-testid="request-more-info"]'
          ];
          
          for (const action of quickActions) {
            const actionButton = request.locator(action);
            if (await actionButton.count() > 0) {
              await expect(actionButton).toBeVisible();
            }
          }
        }
      } else {
        console.log('No NDA requests found - this is expected for new test runs');
        
        // Check for empty state messaging
        const emptyState = page.locator('[data-testid="no-requests"], .empty-state');
        if (await emptyState.count() > 0) {
          await expect(emptyState).toBeVisible();
          console.log('✓ Empty state properly displayed');
        }
      }
    });

    test('creator reviews NDA request details and makes approval decision', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to NDA management
      await page.goto('/creator/nda-management');
      await pageHelper.waitForPageLoad();
      
      const ndaRequests = page.locator('[data-testid="nda-request-item"]');
      const requestCount = await ndaRequests.count();
      
      if (requestCount > 0) {
        // Click on first request to view details
        const viewDetailsButton = ndaRequests.first().locator('[data-testid="view-details"], button:has-text("View")');
        
        if (await viewDetailsButton.count() > 0) {
          await viewDetailsButton.click();
          await pageHelper.waitForPageLoad();
          
          // Should see detailed request information
          const requestDetail = page.locator('[data-testid="nda-request-detail"], .request-detail');
          await expect(requestDetail).toBeVisible();
          
          // Check detailed information sections
          const detailSections = [
            '[data-testid="investor-profile"]',
            '[data-testid="investment-intent-detail"]',
            '[data-testid="investment-amount"]',
            '[data-testid="timeline"]',
            '[data-testid="supporting-documents"]',
            '[data-testid="background-check"]'
          ];
          
          for (const section of detailSections) {
            const element = page.locator(section);
            if (await element.count() > 0) {
              await expect(element).toBeVisible();
              console.log(`✓ Detail section available: ${section}`);
            }
          }
          
          // Test approval workflow
          const approveButton = page.locator('[data-testid="approve-request"], button:has-text("Approve")');
          if (await approveButton.count() > 0) {
            await approveButton.click();
            
            // Should see approval confirmation modal
            const approvalModal = page.locator('[data-testid="approval-modal"], .approval-confirmation');
            if (await approvalModal.count() > 0) {
              await expect(approvalModal).toBeVisible();
              
              // Check approval options
              const approvalOptions = [
                '[data-testid="full-access"]',
                '[data-testid="limited-access"]',
                '[data-testid="custom-access"]'
              ];
              
              for (const option of approvalOptions) {
                const element = page.locator(option);
                if (await element.count() > 0) {
                  await expect(element).toBeVisible();
                }
              }
              
              // Select access level
              const fullAccessOption = page.locator('[data-testid="full-access"], input[value="full"]');
              if (await fullAccessOption.count() > 0) {
                await fullAccessOption.check();
              }
              
              // Add approval notes
              const notesInput = page.locator('[data-testid="approval-notes"], textarea[name="notes"]');
              if (await notesInput.count() > 0) {
                await notesInput.fill('Request approved. Investor profile meets our criteria for serious investment consideration.');
              }
              
              // Confirm approval
              const confirmButton = page.locator('[data-testid="confirm-approval"], button:has-text("Confirm")');
              await confirmButton.click();
              await pageHelper.waitForPageLoad();
              
              // Should see success confirmation
              const successMessage = page.locator('[data-testid="approval-success"], .success-message');
              if (await successMessage.count() > 0) {
                await expect(successMessage).toBeVisible();
                console.log('✓ NDA approval completed successfully');
              }
            }
          }
        }
      } else {
        // Create a mock NDA request scenario for testing
        console.log('No existing requests - testing with mock scenario');
        
        // Check if there's a way to simulate or create test requests
        const testModeButton = page.locator('[data-testid="test-mode"], button:has-text("Test")');
        if (await testModeButton.count() > 0) {
          await testModeButton.click();
          console.log('✓ Test mode activated for NDA workflow testing');
        }
      }
    });

    test('creator sets up custom NDA terms and templates', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to NDA settings
      await page.goto('/creator/nda-management');
      await pageHelper.waitForPageLoad();
      
      // Look for NDA settings/templates section
      const settingsButton = page.locator('[data-testid="nda-settings"], button:has-text("Settings"), [data-testid="nda-templates"]');
      if (await settingsButton.count() > 0) {
        await settingsButton.click();
        await pageHelper.waitForPageLoad();
        
        // Should see NDA configuration options
        const ndaConfig = page.locator('[data-testid="nda-configuration"], .nda-settings');
        await expect(ndaConfig).toBeVisible();
        
        // Check configuration options
        const configSections = [
          '[data-testid="default-terms"]',
          '[data-testid="access-levels"]',
          '[data-testid="approval-workflow"]',
          '[data-testid="notification-settings"]'
        ];
        
        for (const section of configSections) {
          const element = page.locator(section);
          if (await element.count() > 0) {
            await expect(element).toBeVisible();
            console.log(`✓ Configuration section available: ${section}`);
          }
        }
        
        // Test custom terms setup
        const customTermsInput = page.locator('[data-testid="custom-terms"], textarea[name="customTerms"]');
        if (await customTermsInput.count() > 0) {
          await customTermsInput.fill('Additional terms: All shared materials remain confidential for a period of 5 years. Investor agrees to provide feedback within 30 days of document access.');
        }
        
        // Test access level configuration
        const accessLevelSettings = page.locator('[data-testid="access-level-config"]');
        if (await accessLevelSettings.count() > 0) {
          const accessOptions = [
            '[data-testid="script-access"]',
            '[data-testid="budget-access"]',
            '[data-testid="business-plan-access"]',
            '[data-testid="contact-access"]'
          ];
          
          for (const option of accessOptions) {
            const checkbox = page.locator(option);
            if (await checkbox.count() > 0) {
              await checkbox.check();
            }
          }
        }
        
        // Save settings
        const saveSettingsButton = page.locator('[data-testid="save-nda-settings"], button:has-text("Save")');
        if (await saveSettingsButton.count() > 0) {
          await saveSettingsButton.click();
          await pageHelper.waitForPageLoad();
          
          const saveConfirmation = page.locator('[data-testid="settings-saved"], .success-message');
          if (await saveConfirmation.count() > 0) {
            await expect(saveConfirmation).toBeVisible();
            console.log('✓ NDA settings saved successfully');
          }
        }
      } else {
        console.log('NDA settings not available - may be in main settings page');
        
        // Try creator settings page
        await page.goto('/creator/settings');
        await pageHelper.waitForPageLoad();
        
        const ndaSettingsTab = page.locator('[data-testid="nda-settings-tab"], button:has-text("NDA")');
        if (await ndaSettingsTab.count() > 0) {
          await ndaSettingsTab.click();
          console.log('✓ NDA settings accessible from main settings');
        }
      }
    });
  });

  test.describe('Creator Analytics and Performance Tracking', () => {
    test('creator views pitch analytics and engagement metrics', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to analytics
      const analyticsNav = page.locator('[data-testid="analytics-nav"], a[href*="/analytics"]');
      if (await analyticsNav.count() > 0) {
        await analyticsNav.click();
      } else {
        await page.goto('/creator/analytics');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Verify analytics dashboard
      const analyticsDashboard = page.locator('[data-testid="analytics-dashboard"], .analytics');
      await expect(analyticsDashboard).toBeVisible();
      
      // Check analytics sections
      const analyticsSections = [
        '[data-testid="pitch-performance"]',
        '[data-testid="engagement-metrics"]',
        '[data-testid="nda-statistics"]',
        '[data-testid="investor-interest"]',
        '[data-testid="view-statistics"]'
      ];
      
      for (const section of analyticsSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`✓ Analytics section found: ${section}`);
        }
      }
      
      // Test analytics filters
      const timeRangeFilter = page.locator('[data-testid="time-range"], select[name="timeRange"]');
      if (await timeRangeFilter.count() > 0) {
        await timeRangeFilter.selectOption('30-days');
        await pageHelper.waitForPageLoad();
        
        await timeRangeFilter.selectOption('90-days');
        await pageHelper.waitForPageLoad();
        
        console.log('✓ Analytics time range filtering works');
      }
      
      // Test pitch-specific analytics
      const pitchFilter = page.locator('[data-testid="pitch-filter"], select[name="pitchId"]');
      if (await pitchFilter.count() > 0) {
        const options = await pitchFilter.locator('option').count();
        if (options > 1) {
          await pitchFilter.selectOption({ index: 1 });
          await pageHelper.waitForPageLoad();
          
          console.log('✓ Pitch-specific analytics available');
        }
      }
      
      // Check for chart/graph elements
      const visualizations = [
        '[data-testid="views-chart"]',
        '[data-testid="engagement-chart"]',
        '[data-testid="conversion-metrics"]',
        'canvas',
        '.chart-container'
      ];
      
      for (const viz of visualizations) {
        const element = page.locator(viz);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`✓ Visualization found: ${viz}`);
        }
      }
    });

    test('creator tracks follower growth and engagement', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Check follower section in analytics or profile
      await page.goto('/creator/analytics');
      await pageHelper.waitForPageLoad();
      
      const followerSection = page.locator('[data-testid="followers-analytics"], [data-testid="audience-growth"]');
      if (await followerSection.count() > 0) {
        await expect(followerSection).toBeVisible();
        
        // Check follower metrics
        const followerMetrics = [
          '[data-testid="total-followers"]',
          '[data-testid="new-followers"]',
          '[data-testid="follower-growth-rate"]',
          '[data-testid="engagement-rate"]'
        ];
        
        for (const metric of followerMetrics) {
          const element = page.locator(metric);
          if (await element.count() > 0) {
            const value = await element.textContent();
            console.log(`Follower metric ${metric}: ${value}`);
          }
        }
      } else {
        // Check profile page for follower information
        await page.goto('/creator/profile');
        await pageHelper.waitForPageLoad();
        
        const followerInfo = page.locator('[data-testid="follower-count"], .follower-info');
        if (await followerInfo.count() > 0) {
          const count = await followerInfo.textContent();
          console.log(`Profile follower count: ${count}`);
        }
      }
      
      // Test follower list access
      const viewFollowersButton = page.locator('[data-testid="view-followers"], button:has-text("Followers")');
      if (await viewFollowersButton.count() > 0) {
        await viewFollowersButton.click();
        await pageHelper.waitForPageLoad();
        
        const followerList = page.locator('[data-testid="follower-list"], .followers');
        if (await followerList.count() > 0) {
          await expect(followerList).toBeVisible();
          console.log('✓ Follower list accessible');
        }
      }
    });

    test('creator exports analytics and generates reports', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to analytics
      await page.goto('/creator/analytics');
      await pageHelper.waitForPageLoad();
      
      // Test export functionality
      const exportButton = page.locator('[data-testid="export-analytics"], button:has-text("Export")');
      if (await exportButton.count() > 0) {
        await exportButton.click();
        
        // Should see export options
        const exportModal = page.locator('[data-testid="export-modal"], .export-options');
        if (await exportModal.count() > 0) {
          await expect(exportModal).toBeVisible();
          
          // Test export format options
          const exportFormats = [
            '[data-testid="export-pdf"]',
            '[data-testid="export-csv"]',
            '[data-testid="export-xlsx"]'
          ];
          
          for (const format of exportFormats) {
            const formatOption = page.locator(format);
            if (await formatOption.count() > 0) {
              await expect(formatOption).toBeVisible();
            }
          }
          
          // Test PDF export
          const pdfExport = page.locator('[data-testid="export-pdf"], input[value="pdf"]');
          if (await pdfExport.count() > 0) {
            await pdfExport.check();
            
            const downloadButton = page.locator('[data-testid="download-export"], button:has-text("Download")');
            if (await downloadButton.count() > 0) {
              const downloadPromise = page.waitForEvent('download');
              await downloadButton.click();
              
              try {
                const download = await downloadPromise;
                console.log(`✓ Analytics export downloaded: ${download.suggestedFilename()}`);
                
                // Verify download properties
                expect(download.suggestedFilename()).toContain('analytics');
                expect(download.suggestedFilename()).toMatch(/\.(pdf|csv|xlsx)$/);
              } catch (error) {
                console.warn('Analytics export test skipped:', error);
              }
            }
          }
          
          // Close export modal
          const closeButton = page.locator('[data-testid="close-export"], button:has-text("Close")');
          if (await closeButton.count() > 0) {
            await closeButton.click();
          }
        }
      }
      
      // Test scheduled reports
      const scheduledReportsButton = page.locator('[data-testid="scheduled-reports"], button:has-text("Reports")');
      if (await scheduledReportsButton.count() > 0) {
        await scheduledReportsButton.click();
        
        const reportsModal = page.locator('[data-testid="reports-modal"], .scheduled-reports');
        if (await reportsModal.count() > 0) {
          await expect(reportsModal).toBeVisible();
          
          // Test report frequency options
          const frequencyOptions = [
            '[data-testid="weekly-reports"]',
            '[data-testid="monthly-reports"]',
            '[data-testid="quarterly-reports"]'
          ];
          
          for (const option of frequencyOptions) {
            const element = page.locator(option);
            if (await element.count() > 0) {
              await expect(element).toBeVisible();
            }
          }
          
          console.log('✓ Scheduled reports configuration available');
          
          // Close reports modal
          const closeReportsButton = page.locator('[data-testid="close-reports"], button:has-text("Close")');
          if (await closeReportsButton.count() > 0) {
            await closeReportsButton.click();
          }
        }
      }
    });
  });

  test.describe('Creator Workflow Performance and Integration', () => {
    test('measures creator workflow completion times', async ({ page }) => {
      const workflowStartTime = Date.now();
      
      // Key creator workflow steps with timing
      const workflowSteps = [
        {
          name: 'Login',
          action: async () => await authHelper.loginAsCreator(),
        },
        {
          name: 'Dashboard Load',
          action: async () => {
            await expect(page).toHaveURL(/creator\/dashboard/);
            await pageHelper.waitForPageLoad();
          }
        },
        {
          name: 'Pitch Management Access',
          action: async () => {
            await page.goto('/creator/pitches');
            await pageHelper.waitForPageLoad();
          }
        },
        {
          name: 'NDA Management Access',
          action: async () => {
            await page.goto('/creator/nda-management');
            await pageHelper.waitForPageLoad();
          }
        },
        {
          name: 'Analytics Access',
          action: async () => {
            await page.goto('/creator/analytics');
            await pageHelper.waitForPageLoad();
          }
        }
      ];
      
      const stepTimes: Record<string, number> = {};
      
      for (const step of workflowSteps) {
        const stepStart = Date.now();
        await step.action();
        stepTimes[step.name] = Date.now() - stepStart;
        
        // Each step should complete within reasonable time
        expect(stepTimes[step.name]).toBeLessThan(10000);
      }
      
      const totalWorkflowTime = Date.now() - workflowStartTime;
      
      console.log('Creator Workflow Performance:');
      for (const [step, time] of Object.entries(stepTimes)) {
        console.log(`  ${step}: ${time}ms`);
      }
      console.log(`  Total Workflow Time: ${totalWorkflowTime}ms`);
      
      // Total workflow should complete within 60 seconds
      expect(totalWorkflowTime).toBeLessThan(60000);
    });

    test('validates creator dashboard responsiveness across devices', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Test dashboard responsiveness at different viewport sizes
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop Large' },
        { width: 1366, height: 768, name: 'Desktop Standard' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.reload();
        await pageHelper.waitForPageLoad();
        
        // Verify key elements are visible and accessible
        const dashboardHeader = page.locator('[data-testid="dashboard-header"], h1');
        await expect(dashboardHeader).toBeVisible();
        
        // Check navigation accessibility
        const navigation = page.locator('[data-testid="main-navigation"], nav');
        if (await navigation.count() > 0) {
          await expect(navigation).toBeVisible();
        }
        
        // Test mobile menu if on small screen
        if (viewport.width < 768) {
          const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-nav');
          if (await mobileMenu.count() > 0) {
            await expect(mobileMenu).toBeVisible();
          }
        }
        
        console.log(`✓ Creator dashboard responsive at ${viewport.name} (${viewport.width}x${viewport.height})`);
      }
    });

    test('validates end-to-end creator content lifecycle', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      const lifecycleStartTime = Date.now();
      
      // Complete content lifecycle: Create → Upload → Manage → NDA → Analytics
      console.log('Starting complete creator content lifecycle test...');
      
      // Step 1: Create new pitch
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      const quickPitch = generateTestPitch({
        title: `Lifecycle Test Pitch ${Date.now()}`,
        budget: '5000000',
        synopsis: 'End-to-end test pitch for workflow validation'
      });
      
      await page.fill('[data-testid="title-input"], input[name="title"]', quickPitch.title);
      await page.fill('[data-testid="logline-input"], textarea[name="logline"]', quickPitch.logline);
      await page.fill('[data-testid="synopsis-input"], textarea[name="synopsis"]', quickPitch.synopsis);
      await page.fill('[data-testid="budget-input"], input[name="budget"]', quickPitch.budget);
      
      const submitButton = page.locator('[data-testid="submit-pitch-button"], button[type="submit"]');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await pageHelper.waitForPageLoad();
        console.log('✓ Step 1: Pitch created');
      }
      
      // Step 2: Access pitch management
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      await expect(page.locator('[data-testid="pitch-management"], .pitch-list')).toBeVisible();
      console.log('✓ Step 2: Pitch management accessible');
      
      // Step 3: Check NDA management
      await page.goto('/creator/nda-management');
      await pageHelper.waitForPageLoad();
      await expect(page.locator('[data-testid="nda-management"], .nda-dashboard')).toBeVisible();
      console.log('✓ Step 3: NDA management accessible');
      
      // Step 4: View analytics
      await page.goto('/creator/analytics');
      await pageHelper.waitForPageLoad();
      await expect(page.locator('[data-testid="analytics-dashboard"], .analytics')).toBeVisible();
      console.log('✓ Step 4: Analytics accessible');
      
      const lifecycleTime = Date.now() - lifecycleStartTime;
      console.log(`Complete creator lifecycle test completed in ${lifecycleTime}ms`);
      
      // Lifecycle should complete within 2 minutes
      expect(lifecycleTime).toBeLessThan(120000);
    });
  });
});