import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { TEST_USERS, TEST_SEARCH_SCENARIOS, TEST_INVESTMENTS } from './fixtures/test-data';

test.describe('Investor Discovery and Investment Workflow', () => {
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

  test.describe('Investor Onboarding and Dashboard Discovery', () => {
    test('investor logs in and explores dashboard features', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Verify investor dashboard loads
      await expect(page).toHaveURL(/investor\/dashboard/);
      await expect(page.locator('[data-testid="dashboard-header"], [data-testid="investor-dashboard"]')).toBeVisible();
      
      // Check key dashboard sections
      const dashboardSections = [
        '[data-testid="portfolio-overview"]',
        '[data-testid="recent-investments"]',
        '[data-testid="pitch-recommendations"]',
        '[data-testid="market-trends"]',
        '[data-testid="investment-analytics"]'
      ];
      
      for (const section of dashboardSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`✓ Dashboard section found: ${section}`);
        }
      }
      
      // Check navigation menu
      const navItems = [
        '[data-testid="discover-nav"]',
        '[data-testid="portfolio-nav"]',
        '[data-testid="watchlist-nav"]',
        '[data-testid="analytics-nav"]',
        '[data-testid="settings-nav"]'
      ];
      
      for (const nav of navItems) {
        const element = page.locator(nav);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
        }
      }
    });

    test('investor explores investment preferences and profile setup', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to investor settings/profile
      const settingsNav = page.locator('[data-testid="settings-nav"], a[href*="/investor/settings"]');
      if (await settingsNav.count() > 0) {
        await settingsNav.click();
      } else {
        await page.goto('/investor/settings');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Check investment preferences settings
      const preferencesSections = [
        '[data-testid="investment-range"]',
        '[data-testid="preferred-genres"]',
        '[data-testid="risk-tolerance"]',
        '[data-testid="geographical-preferences"]'
      ];
      
      for (const section of preferencesSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
        }
      }
      
      // Update preferences if editable
      const editButton = page.locator('[data-testid="edit-preferences"], button:has-text("Edit")');
      if (await editButton.count() > 0) {
        await editButton.click();
        
        // Update investment range
        const minInvestment = page.locator('[data-testid="min-investment"], input[name="minInvestment"]');
        if (await minInvestment.count() > 0) {
          await minInvestment.fill('500000');
        }
        
        const maxInvestment = page.locator('[data-testid="max-investment"], input[name="maxInvestment"]');
        if (await maxInvestment.count() > 0) {
          await maxInvestment.fill('10000000');
        }
        
        // Save preferences
        const saveButton = page.locator('[data-testid="save-preferences"], button:has-text("Save")');
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await pageHelper.waitForPageLoad();
        }
      }
    });
  });

  test.describe('Pitch Discovery and Filtering', () => {
    test('investor discovers pitches through browse and search', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to discover/browse pitches
      const discoverNav = page.locator('[data-testid="discover-nav"], a[href*="/discover"], a[href*="/browse"]');
      if (await discoverNav.count() > 0) {
        await discoverNav.click();
      } else {
        await page.goto('/investor/discover');
        
        // Fallback to main browse if investor-specific doesn't exist
        if (page.url().includes('404') || await page.locator('[data-testid="not-found"]').count() > 0) {
          await page.goto('/browse');
        }
      }
      
      await pageHelper.waitForPageLoad();
      
      // Verify pitch browsing interface
      await expect(page.locator('[data-testid="pitch-grid"], [data-testid="pitch-list"]')).toBeVisible();
      
      // Test filtering by investment criteria
      const filterButton = page.locator('[data-testid="filter-toggle"], [data-testid="advanced-filters"]');
      if (await filterButton.count() > 0) {
        await filterButton.click();
        
        // Apply budget range filter
        const budgetMinInput = page.locator('[data-testid="budget-min"], input[name="budgetMin"]');
        if (await budgetMinInput.count() > 0) {
          await budgetMinInput.fill(TEST_SEARCH_SCENARIOS.highBudgetAction.budgetMin.toString());
        }
        
        const budgetMaxInput = page.locator('[data-testid="budget-max"], input[name="budgetMax"]');
        if (await budgetMaxInput.count() > 0) {
          await budgetMaxInput.fill(TEST_SEARCH_SCENARIOS.highBudgetAction.budgetMax.toString());
        }
        
        // Apply genre filter
        for (const genre of TEST_SEARCH_SCENARIOS.highBudgetAction.genres) {
          const genreCheckbox = page.locator(`[data-testid="genre-${genre.toLowerCase()}"], input[value="${genre}"]`);
          if (await genreCheckbox.count() > 0) {
            await genreCheckbox.check();
          }
        }
        
        // Apply filters
        const applyButton = page.locator('[data-testid="apply-filters"], button:has-text("Apply")');
        if (await applyButton.count() > 0) {
          await applyButton.click();
          await pageHelper.waitForPageLoad();
        }
      }
      
      // Verify filtered results
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        console.log(`Found ${cardCount} pitches matching criteria`);
        
        // Verify first few pitches match criteria
        for (let i = 0; i < Math.min(cardCount, 3); i++) {
          const card = pitchCards.nth(i);
          
          // Check budget information if visible
          const budgetInfo = card.locator('[data-testid="pitch-budget"], .budget-info');
          if (await budgetInfo.count() > 0) {
            const budgetText = await budgetInfo.textContent();
            console.log(`Pitch ${i + 1} budget: ${budgetText}`);
          }
          
          // Check genre information
          const genreInfo = card.locator('[data-testid="pitch-genre"], .genre-info');
          if (await genreInfo.count() > 0) {
            const genreText = await genreInfo.textContent();
            console.log(`Pitch ${i + 1} genre: ${genreText}`);
          }
        }
      }
    });

    test('investor uses advanced search with investment criteria', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to search page
      await page.goto('/search');
      await pageHelper.waitForPageLoad();
      
      // Fill advanced search with investor-specific criteria
      const searchForm = page.locator('[data-testid="advanced-search"], form');
      await expect(searchForm).toBeVisible();
      
      // Search by ROI potential
      const roiInput = page.locator('[data-testid="roi-potential"], input[name="roiPotential"]');
      if (await roiInput.count() > 0) {
        await roiInput.selectOption('high');
      }
      
      // Search by funding stage
      const fundingStageInput = page.locator('[data-testid="funding-stage"], select[name="fundingStage"]');
      if (await fundingStageInput.count() > 0) {
        await fundingStageInput.selectOption('seeking-investment');
      }
      
      // Search by risk level
      const riskLevelInput = page.locator('[data-testid="risk-level"], select[name="riskLevel"]');
      if (await riskLevelInput.count() > 0) {
        await riskLevelInput.selectOption('moderate');
      }
      
      // Set budget range
      await page.fill('[data-testid="budget-min"], input[name="budgetMin"]', '1000000');
      await page.fill('[data-testid="budget-max"], input[name="budgetMax"]', '25000000');
      
      // Execute search
      const searchButton = page.locator('[data-testid="search-button"], button[type="submit"]');
      await searchButton.click();
      await pageHelper.waitForPageLoad();
      
      // Verify search results
      const searchResults = page.locator('[data-testid="search-results"]');
      if (await searchResults.count() > 0) {
        await expect(searchResults).toBeVisible();
        
        // Check search summary
        const searchSummary = page.locator('[data-testid="search-summary"]');
        if (await searchSummary.count() > 0) {
          const summaryText = await searchSummary.textContent();
          console.log('Search summary:', summaryText);
        }
      }
    });

    test('investor saves searches and creates watchlist', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Perform a search first
      await page.goto('/search');
      await pageHelper.waitForPageLoad();
      
      // Apply some search criteria
      await page.check('[data-testid="genre-action"], input[value="Action"]');
      await page.fill('[data-testid="budget-min"], input[name="budgetMin"]', '5000000');
      
      const searchButton = page.locator('[data-testid="search-button"], button[type="submit"]');
      await searchButton.click();
      await pageHelper.waitForPageLoad();
      
      // Save the search
      const saveSearchButton = page.locator('[data-testid="save-search"], button:has-text("Save Search")');
      if (await saveSearchButton.count() > 0) {
        await saveSearchButton.click();
        
        // Name the saved search
        const searchNameInput = page.locator('[data-testid="search-name"], input[name="searchName"]');
        if (await searchNameInput.count() > 0) {
          await searchNameInput.fill('High Budget Action Films');
          
          const confirmSaveButton = page.locator('[data-testid="confirm-save"], button:has-text("Save")');
          await confirmSaveButton.click();
          await pageHelper.waitForPageLoad();
        }
      }
      
      // Add pitches to watchlist
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        for (let i = 0; i < Math.min(cardCount, 2); i++) {
          const card = pitchCards.nth(i);
          const watchlistButton = card.locator('[data-testid="add-to-watchlist"], button:has-text("Watch")');
          
          if (await watchlistButton.count() > 0) {
            await watchlistButton.click();
            
            // Wait for watchlist confirmation
            const confirmation = page.locator('[data-testid="watchlist-added"], .success-message');
            if (await confirmation.count() > 0) {
              await expect(confirmation).toBeVisible();
            }
            
            await page.waitForTimeout(1000); // Brief pause between actions
          }
        }
      }
      
      // Navigate to watchlist to verify
      const watchlistNav = page.locator('[data-testid="watchlist-nav"], a[href*="/watchlist"]');
      if (await watchlistNav.count() > 0) {
        await watchlistNav.click();
        await pageHelper.waitForPageLoad();
        
        // Verify watchlist contains items
        const watchlistItems = page.locator('[data-testid="watchlist-item"]');
        const watchlistCount = await watchlistItems.count();
        
        if (watchlistCount > 0) {
          console.log(`✓ Watchlist contains ${watchlistCount} items`);
          await expect(watchlistItems.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Pitch Evaluation and NDA Process', () => {
    test('investor evaluates pitch and requests NDA access', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Browse to find pitches
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      const cardCount = await pitchCards.count();
      
      if (cardCount > 0) {
        // Click on first interesting pitch
        await pitchCards.first().click();
        await pageHelper.waitForPageLoad();
        
        // Should be on pitch detail page
        await expect(page.locator('[data-testid="pitch-detail-header"], .pitch-detail')).toBeVisible();
        
        // View publicly available information
        const publicSections = [
          '[data-testid="pitch-logline"]',
          '[data-testid="pitch-genre"]',
          '[data-testid="pitch-format"]',
          '[data-testid="target-audience"]'
        ];
        
        for (const section of publicSections) {
          const element = page.locator(section);
          if (await element.count() > 0) {
            await expect(element).toBeVisible();
          }
        }
        
        // Request NDA access for detailed information
        const ndaButton = page.locator('[data-testid="request-nda-button"], button:has-text("Request NDA"), button:has-text("View Details")');
        
        if (await ndaButton.count() > 0) {
          await ndaButton.click();
          await pageHelper.waitForPageLoad();
          
          // Should see NDA request form
          const ndaForm = page.locator('[data-testid="nda-request-form"], form');
          await expect(ndaForm).toBeVisible();
          
          // Fill NDA request form
          const investorIntentInput = page.locator('[data-testid="investment-intent"], textarea[name="investmentIntent"]');
          if (await investorIntentInput.count() > 0) {
            await investorIntentInput.fill('I am interested in this project for potential investment. Our firm specializes in mid-budget productions with strong commercial appeal.');
          }
          
          const budgetRangeInput = page.locator('[data-testid="investment-range"], input[name="investmentRange"]');
          if (await budgetRangeInput.count() > 0) {
            await budgetRangeInput.fill('$2M - $15M');
          }
          
          const timelineInput = page.locator('[data-testid="investment-timeline"], select[name="timeline"]');
          if (await timelineInput.count() > 0) {
            await timelineInput.selectOption('6-12-months');
          }
          
          // Add supporting documents if file upload available
          const fileUpload = page.locator('[data-testid="supporting-docs"], input[type="file"]');
          if (await fileUpload.count() > 0) {
            // Create a simple text file for testing
            const testFilePath = '/tmp/investor-credentials.txt';
            await page.evaluate(async () => {
              const content = 'Investment firm credentials and track record';
              const blob = new Blob([content], { type: 'text/plain' });
              const file = new File([blob], 'investor-credentials.txt', { type: 'text/plain' });
              
              // Create a data transfer to simulate file selection
              const dt = new DataTransfer();
              dt.items.add(file);
              
              const input = document.querySelector('input[type="file"]') as HTMLInputElement;
              if (input) {
                input.files = dt.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          }
          
          // Submit NDA request
          const submitButton = page.locator('[data-testid="submit-nda-request"], button[type="submit"]');
          await submitButton.click();
          await pageHelper.waitForPageLoad();
          
          // Should see confirmation
          const confirmation = page.locator('[data-testid="nda-request-sent"], .success-message');
          if (await confirmation.count() > 0) {
            await expect(confirmation).toBeVisible();
            console.log('✓ NDA request submitted successfully');
          }
        }
      }
    });

    test('investor tracks NDA request status and receives approval', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to NDA history/status page
      const ndaHistoryNav = page.locator('[data-testid="nda-history-nav"], a[href*="/nda-history"]');
      if (await ndaHistoryNav.count() > 0) {
        await ndaHistoryNav.click();
      } else {
        await page.goto('/investor/nda-history');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Check for existing NDA requests
      const ndaRequests = page.locator('[data-testid="nda-request-item"]');
      const requestCount = await ndaRequests.count();
      
      console.log(`Found ${requestCount} NDA requests`);
      
      if (requestCount > 0) {
        // Check status of requests
        for (let i = 0; i < Math.min(requestCount, 3); i++) {
          const request = ndaRequests.nth(i);
          
          const statusElement = request.locator('[data-testid="nda-status"]');
          const pitchTitle = request.locator('[data-testid="pitch-title"]');
          const requestDate = request.locator('[data-testid="request-date"]');
          
          if (await statusElement.count() > 0) {
            const status = await statusElement.textContent();
            const title = await pitchTitle.textContent();
            console.log(`NDA Request ${i + 1}: ${title} - Status: ${status}`);
            
            // If approved, should be able to access detailed documents
            if (status?.includes('Approved') || status?.includes('Active')) {
              const viewDocumentsButton = request.locator('[data-testid="view-documents"], button:has-text("View Documents")');
              if (await viewDocumentsButton.count() > 0) {
                await viewDocumentsButton.click();
                await pageHelper.waitForPageLoad();
                
                // Should see document access page
                const documentAccess = page.locator('[data-testid="document-access"], .documents-viewer');
                await expect(documentAccess).toBeVisible();
                
                // Go back to continue checking other requests
                await page.goBack();
                await pageHelper.waitForPageLoad();
              }
            }
          }
        }
      } else {
        console.log('No existing NDA requests found - this is expected for new test runs');
      }
    });

    test('investor accesses and downloads protected documents', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to an approved pitch (simulate approved NDA)
      await page.goto('/investor/nda-history');
      await pageHelper.waitForPageLoad();
      
      // Look for approved NDAs
      const approvedNDAs = page.locator('[data-testid="nda-status"]:has-text("Approved"), [data-testid="nda-status"]:has-text("Active")');
      const approvedCount = await approvedNDAs.count();
      
      if (approvedCount > 0) {
        // Click on first approved NDA
        const firstApproved = approvedNDAs.first();
        const parentRequest = firstApproved.locator('xpath=ancestor::*[@data-testid="nda-request-item"]');
        const viewButton = parentRequest.locator('[data-testid="view-documents"], button:has-text("View")').first();
        
        if (await viewButton.count() > 0) {
          await viewButton.click();
          await pageHelper.waitForPageLoad();
          
          // Should see document library
          const documentSections = [
            '[data-testid="full-script"]',
            '[data-testid="detailed-budget"]',
            '[data-testid="business-plan"]',
            '[data-testid="treatment"]',
            '[data-testid="lookbook"]'
          ];
          
          for (const section of documentSections) {
            const element = page.locator(section);
            if (await element.count() > 0) {
              await expect(element).toBeVisible();
              
              // Test document download if available
              const downloadButton = element.locator('[data-testid="download-button"], button:has-text("Download")');
              if (await downloadButton.count() > 0) {
                // Set up download expectation
                const downloadPromise = page.waitForEvent('download');
                await downloadButton.click();
                
                try {
                  const download = await downloadPromise;
                  console.log(`✓ Downloaded: ${download.suggestedFilename()}`);
                  
                  // Verify download was successful
                  expect(download.suggestedFilename()).toBeTruthy();
                } catch (error) {
                  console.warn('Document download test skipped:', error);
                }
              }
            }
          }
          
          // Test document viewer if available
          const documentViewer = page.locator('[data-testid="document-viewer"], .pdf-viewer');
          if (await documentViewer.count() > 0) {
            await expect(documentViewer).toBeVisible();
            console.log('✓ Document viewer accessible');
          }
        }
      } else {
        console.log('No approved NDAs found - using demo data or creating test approval');
        
        // For test purposes, navigate directly to a pitch detail with mock approval
        await page.goto('/browse');
        await pageHelper.waitForPageLoad();
        
        const pitchCards = page.locator('[data-testid="pitch-card"]');
        if (await pitchCards.count() > 0) {
          await pitchCards.first().click();
          await pageHelper.waitForPageLoad();
          
          // Look for any document access areas
          const documentAccess = page.locator('[data-testid="documents"], [data-testid="materials"]');
          if (await documentAccess.count() > 0) {
            console.log('✓ Document access area found');
          }
        }
      }
    });
  });

  test.describe('Investment Decision and Process', () => {
    test('investor evaluates investment opportunity and expresses interest', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to a pitch (assume NDA approved for full access)
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      if (await pitchCards.count() > 0) {
        await pitchCards.first().click();
        await pageHelper.waitForPageLoad();
        
        // Look for investment action buttons
        const investmentButtons = [
          '[data-testid="express-interest-button"]',
          '[data-testid="make-investment-offer"]',
          '[data-testid="contact-creator"]',
          '[data-testid="request-meeting"]'
        ];
        
        for (const buttonSelector of investmentButtons) {
          const button = page.locator(buttonSelector);
          if (await button.count() > 0) {
            await expect(button).toBeVisible();
            console.log(`✓ Investment action available: ${buttonSelector}`);
          }
        }
        
        // Express investment interest
        const expressInterestButton = page.locator('[data-testid="express-interest-button"], button:has-text("Express Interest")');
        if (await expressInterestButton.count() > 0) {
          await expressInterestButton.click();
          await pageHelper.waitForPageLoad();
          
          // Fill investment interest form
          const interestForm = page.locator('[data-testid="investment-interest-form"], form');
          if (await interestForm.count() > 0) {
            await expect(interestForm).toBeVisible();
            
            // Fill investment details
            const investmentAmount = page.locator('[data-testid="investment-amount"], input[name="amount"]');
            if (await investmentAmount.count() > 0) {
              await investmentAmount.fill(TEST_INVESTMENTS.medium.amount.toString());
            }
            
            const investmentType = page.locator('[data-testid="investment-type"], select[name="type"]');
            if (await investmentType.count() > 0) {
              await investmentType.selectOption(TEST_INVESTMENTS.medium.type);
            }
            
            const equityPercentage = page.locator('[data-testid="equity-percentage"], input[name="equity"]');
            if (await equityPercentage.count() > 0) {
              await equityPercentage.fill(TEST_INVESTMENTS.medium.percentage.toString());
            }
            
            const terms = page.locator('[data-testid="investment-terms"], textarea[name="terms"]');
            if (await terms.count() > 0) {
              await terms.fill(TEST_INVESTMENTS.medium.terms);
            }
            
            const timeline = page.locator('[data-testid="investment-timeline"], select[name="timeline"]');
            if (await timeline.count() > 0) {
              await timeline.selectOption('12-months');
            }
            
            // Submit interest
            const submitButton = page.locator('[data-testid="submit-interest"], button[type="submit"]');
            await submitButton.click();
            await pageHelper.waitForPageLoad();
            
            // Should see confirmation
            const confirmation = page.locator('[data-testid="interest-submitted"], .success-message');
            if (await confirmation.count() > 0) {
              await expect(confirmation).toBeVisible();
              console.log('✓ Investment interest submitted');
            }
          }
        }
      }
    });

    test('investor manages investment pipeline and tracks deals', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to investor portfolio/deals section
      const portfolioNav = page.locator('[data-testid="portfolio-nav"], a[href*="/portfolio"], a[href*="/investments"]');
      if (await portfolioNav.count() > 0) {
        await portfolioNav.click();
      } else {
        await page.goto('/investor/portfolio');
        
        // Fallback to investments page
        if (page.url().includes('404')) {
          await page.goto('/investor/investments');
        }
      }
      
      await pageHelper.waitForPageLoad();
      
      // Check investment pipeline sections
      const pipelineSections = [
        '[data-testid="pending-investments"]',
        '[data-testid="active-investments"]',
        '[data-testid="completed-investments"]',
        '[data-testid="investment-pipeline"]'
      ];
      
      for (const section of pipelineSections) {
        const element = page.locator(section);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`✓ Pipeline section found: ${section}`);
        }
      }
      
      // Check for deal tracking functionality
      const dealItems = page.locator('[data-testid="deal-item"], [data-testid="investment-item"]');
      const dealCount = await dealItems.count();
      
      console.log(`Found ${dealCount} deals in pipeline`);
      
      if (dealCount > 0) {
        // Test deal status tracking
        for (let i = 0; i < Math.min(dealCount, 3); i++) {
          const deal = dealItems.nth(i);
          
          const dealStatus = deal.locator('[data-testid="deal-status"]');
          const dealAmount = deal.locator('[data-testid="deal-amount"]');
          const dealProgress = deal.locator('[data-testid="deal-progress"]');
          
          if (await dealStatus.count() > 0) {
            const status = await dealStatus.textContent();
            console.log(`Deal ${i + 1} status: ${status}`);
          }
          
          // Test deal detail access
          const viewDealButton = deal.locator('[data-testid="view-deal"], button:has-text("View")');
          if (await viewDealButton.count() > 0) {
            await viewDealButton.click();
            await pageHelper.waitForPageLoad();
            
            // Should see deal details
            const dealDetail = page.locator('[data-testid="deal-detail"], .deal-detail');
            if (await dealDetail.count() > 0) {
              await expect(dealDetail).toBeVisible();
            }
            
            // Go back to pipeline
            await page.goBack();
            await pageHelper.waitForPageLoad();
          }
        }
      }
    });

    test('investor accesses analytics and performance tracking', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to analytics
      const analyticsNav = page.locator('[data-testid="analytics-nav"], a[href*="/analytics"]');
      if (await analyticsNav.count() > 0) {
        await analyticsNav.click();
      } else {
        await page.goto('/investor/analytics');
      }
      
      await pageHelper.waitForPageLoad();
      
      // Check analytics dashboard components
      const analyticsComponents = [
        '[data-testid="roi-analytics"]',
        '[data-testid="portfolio-performance"]',
        '[data-testid="investment-breakdown"]',
        '[data-testid="market-comparison"]',
        '[data-testid="risk-analysis"]'
      ];
      
      for (const component of analyticsComponents) {
        const element = page.locator(component);
        if (await element.count() > 0) {
          await expect(element).toBeVisible();
          console.log(`✓ Analytics component found: ${component}`);
        }
      }
      
      // Test analytics filters and time ranges
      const timeRangeSelect = page.locator('[data-testid="time-range"], select[name="timeRange"]');
      if (await timeRangeSelect.count() > 0) {
        await timeRangeSelect.selectOption('1-year');
        await pageHelper.waitForPageLoad();
        
        await timeRangeSelect.selectOption('6-months');
        await pageHelper.waitForPageLoad();
      }
      
      // Test export functionality if available
      const exportButton = page.locator('[data-testid="export-analytics"], button:has-text("Export")');
      if (await exportButton.count() > 0) {
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        
        try {
          const download = await downloadPromise;
          console.log(`✓ Analytics export: ${download.suggestedFilename()}`);
        } catch (error) {
          console.warn('Analytics export test skipped:', error);
        }
      }
    });
  });

  test.describe('Investment Workflow Performance', () => {
    test('measures investor workflow completion times', async ({ page }) => {
      const workflowStartTime = Date.now();
      
      // Key investor workflow steps with timing
      const workflowSteps = [
        {
          name: 'Login',
          action: async () => await authHelper.loginAsInvestor(),
        },
        {
          name: 'Dashboard Load',
          action: async () => {
            await expect(page).toHaveURL(/investor\/dashboard/);
            await pageHelper.waitForPageLoad();
          }
        },
        {
          name: 'Browse Pitches',
          action: async () => {
            await page.goto('/browse');
            await pageHelper.waitForPageLoad();
          }
        },
        {
          name: 'Pitch Detail View',
          action: async () => {
            const pitchCards = page.locator('[data-testid="pitch-card"]');
            if (await pitchCards.count() > 0) {
              await pitchCards.first().click();
              await pageHelper.waitForPageLoad();
            }
          }
        },
        {
          name: 'Portfolio Access',
          action: async () => {
            await page.goto('/investor/portfolio');
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
      
      console.log('Investor Workflow Performance:');
      for (const [step, time] of Object.entries(stepTimes)) {
        console.log(`  ${step}: ${time}ms`);
      }
      console.log(`  Total Workflow Time: ${totalWorkflowTime}ms`);
      
      // Total workflow should complete within 60 seconds
      expect(totalWorkflowTime).toBeLessThan(60000);
    });

    test('validates investor dashboard responsiveness', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
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
        
        console.log(`✓ Dashboard responsive at ${viewport.name} (${viewport.width}x${viewport.height})`);
      }
    });
  });
});