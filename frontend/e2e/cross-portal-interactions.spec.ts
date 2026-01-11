import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { TEST_USERS, TEST_PITCHES } from './fixtures/test-data';

// Use the first pitch for testing
const TEST_PITCH = TEST_PITCHES.actionThriller;

test.describe('Cross-Portal Interactions', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
  });

  test.describe('Creator → Investor → Production Workflow', () => {
    test('Complete pitch lifecycle: Create → Browse → NDA → Investment → Production Partnership', async ({ page }) => {
      // Step 1: Creator creates a pitch
      console.log('Step 1: Creator creates pitch...');
      await authHelper.loginAsCreator();
      
      // Create a new pitch
      await page.click('[data-testid="create-pitch-button"]');
      
      // Fill comprehensive pitch details
      await page.fill('[data-testid="title-input"]', `${TEST_PITCH.title} - Cross Portal Test`);
      await page.fill('[data-testid="logline-input"]', TEST_PITCH.logline);
      await page.fill('[data-testid="synopsis-input"]', TEST_PITCH.synopsis);
      await page.selectOption('[data-testid="genre-select"]', TEST_PITCH.genre);
      await page.fill('[data-testid="themes-input"]', TEST_PITCH.themes);
      await page.selectOption('[data-testid="format-select"]', TEST_PITCH.format);
      await page.fill('[data-testid="budget-input"]', TEST_PITCH.budget);
      await page.fill('[data-testid="target-audience-input"]', TEST_PITCH.targetAudience);
      await page.fill('[data-testid="world-input"]', TEST_PITCH.world);

      // Save and publish
      await page.click('[data-testid="save-draft-button"]');
      await pageHelper.waitForNotification('success');
      
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');
      
      // Store pitch ID for later use
      const pitchUrl = page.url();
      const pitchId = pitchUrl.match(/pitch\/(\d+)/)?.[1];
      
      console.log(`✓ Creator published pitch with ID: ${pitchId}`);

      // Step 2: Investor discovers and requests NDA
      console.log('Step 2: Investor discovers pitch and requests NDA...');
      await authHelper.switchPortal('investor');
      
      // Browse pitches and find the one we just created
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Search for our test pitch
      await page.fill('[data-testid="search-bar"]', 'Cross Portal Test');
      await page.press('[data-testid="search-bar"]', 'Enter');
      await pageHelper.waitForPageLoad();
      
      // Click on the pitch
      const pitchCard = page.locator('[data-testid="pitch-card"]').filter({ 
        hasText: 'Cross Portal Test' 
      }).first();
      await expect(pitchCard).toBeVisible();
      await pitchCard.click();
      
      // Request NDA
      await page.click('[data-testid="request-nda-button"]');
      await page.fill('[data-testid="request-reason"]', 'Interested in potential investment opportunity for this action film project');
      await page.fill('[data-testid="investment-amount"]', '5000000');
      await page.click('[data-testid="submit-nda-request"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Investor requested NDA access');

      // Step 3: Creator approves NDA request
      console.log('Step 3: Creator approves NDA request...');
      await authHelper.switchPortal('creator');
      
      // Navigate to NDA management
      await page.click('[data-testid="nda-management-link"]');
      
      // Find pending NDA request
      const pendingNDA = page.locator('[data-testid="nda-request"]').filter({ 
        hasText: 'Pending' 
      }).first();
      
      await expect(pendingNDA).toBeVisible();
      await pendingNDA.click();
      
      // Approve the NDA
      await page.click('[data-testid="approve-nda-button"]');
      await page.fill('[data-testid="approval-message"]', 'Approved - Thank you for your interest in our project');
      await page.click('[data-testid="confirm-approval"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Creator approved NDA request');

      // Step 4: Investor accesses full pitch and invests
      console.log('Step 4: Investor accesses full pitch and makes investment...');
      await authHelper.switchPortal('investor');
      
      // Go to NDA history to find approved pitch
      await page.click('[data-testid="nda-history-link"]');
      
      const approvedNDA = page.locator('[data-testid="nda-request"]').filter({ 
        hasText: 'Approved' 
      }).first();
      
      await expect(approvedNDA).toBeVisible();
      await approvedNDA.click();
      
      // Should now see full pitch details
      await expect(page.locator('[data-testid="full-synopsis"]')).toBeVisible();
      await expect(page.locator('[data-testid="financial-details"]')).toBeVisible();
      
      // Make investment
      await page.click('[data-testid="invest-button"]');
      await page.fill('[data-testid="investment-amount"]', '3000000');
      await page.selectOption('[data-testid="investment-type"]', 'equity');
      await page.fill('[data-testid="terms"]', 'Strategic investment with potential for sequel development');
      await page.click('[data-testid="submit-investment"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Investor made investment');

      // Step 5: Production company partners on project
      console.log('Step 5: Production company creates partnership...');
      await authHelper.switchPortal('production');
      
      // Browse for investment opportunities
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Search for funded projects
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="filter-funded-projects"]');
      await page.click('[data-testid="apply-filters"]');
      
      // Find our test pitch
      await page.fill('[data-testid="search-bar"]', 'Cross Portal Test');
      await page.press('[data-testid="search-bar"]', 'Enter');
      await pageHelper.waitForPageLoad();
      
      const fundedPitch = page.locator('[data-testid="pitch-card"]').filter({ 
        hasText: 'Cross Portal Test' 
      }).first();
      await expect(fundedPitch).toBeVisible();
      await fundedPitch.click();
      
      // Request production partnership
      await page.click('[data-testid="request-partnership-button"]');
      await page.fill('[data-testid="proposal-message"]', 'Our production company would like to partner on this exciting action project');
      await page.fill('[data-testid="proposed-budget"]', '10000000');
      await page.selectOption('[data-testid="partnership-type"]', 'co-production');
      await page.fill('[data-testid="timeline"]', 'Q3 2024 production start');
      await page.click('[data-testid="submit-partnership-request"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Production company requested partnership');

      // Step 6: Verify all parties can see the complete project
      console.log('Step 6: Verifying all parties can see project status...');
      
      // Creator should see investment and partnership requests
      await authHelper.switchPortal('creator');
      await page.click('[data-testid="manage-pitches-link"]');
      
      const fundedPitchRow = page.locator('[data-testid="pitch-row"]').filter({ 
        hasText: 'Cross Portal Test' 
      }).first();
      await expect(fundedPitchRow).toContainText('Funded');
      
      // Investor should see active investment
      await authHelper.switchPortal('investor');
      await page.click('[data-testid="investment-history-link"]');
      
      const activeInvestment = page.locator('[data-testid="investment-row"]').filter({ 
        hasText: 'Cross Portal Test' 
      }).first();
      await expect(activeInvestment).toBeVisible();
      await expect(activeInvestment).toContainText('Active');
      
      // Production company should see partnership status
      await authHelper.switchPortal('production');
      await page.click('[data-testid="partnerships-link"]');
      
      const partnershipRequest = page.locator('[data-testid="partnership-row"]').filter({ 
        hasText: 'Cross Portal Test' 
      }).first();
      await expect(partnershipRequest).toBeVisible();
      await expect(partnershipRequest).toContainText('Pending');
      
      console.log('✓ Complete cross-portal workflow verified');
    });
  });

  test.describe('Real-time Notifications Across Portals', () => {
    test('should receive notifications when actions happen in other portals', async ({ page, context }) => {
      // This test simulates real-time notifications using multiple browser contexts
      
      // Create second browser context for investor
      const investorContext = await context.browser()?.newContext();
      const investorPage = investorContext ? await investorContext.newPage() : page;
      const investorAuthHelper = new AuthHelper(investorPage);
      
      try {
        // Login creator in main context
        await authHelper.loginAsCreator();
        
        // Login investor in second context  
        await investorAuthHelper.loginAsInvestor();
        
        // Check WebSocket connections
        await pageHelper.checkWebSocketConnection();
        
        // Creator publishes a pitch
        await page.click('[data-testid="create-pitch-button"]');
        await page.fill('[data-testid="title-input"]', 'Real-time Notification Test');
        await page.fill('[data-testid="logline-input"]', 'Testing cross-portal notifications');
        await page.click('[data-testid="publish-pitch-button"]');
        await page.click('[data-testid="confirm-publish-button"]');
        await pageHelper.waitForNotification('success');
        
        // Investor should receive notification about new pitch
        await investorPage.waitForTimeout(2000); // Wait for WebSocket message
        
        const notificationBell = investorPage.locator('[data-testid="notification-bell"]');
        await expect(notificationBell).toHaveClass(/.*has-notifications.*/);
        
        // Click notification to see details
        await notificationBell.click();
        const notificationDropdown = investorPage.locator('[data-testid="notification-dropdown"]');
        await expect(notificationDropdown).toContainText('New pitch published');
        
        console.log('✓ Cross-portal notifications working');
        
      } finally {
        // Cleanup second context
        if (investorContext) {
          await investorContext.close();
        }
      }
    });
  });

  test.describe('Follow/Unfollow Workflow', () => {
    test('should allow investor to follow creator and receive updates', async ({ page }) => {
      // Step 1: Investor follows creator
      console.log('Step 1: Investor follows creator...');
      await authHelper.loginAsInvestor();
      
      // Browse creators
      await page.click('[data-testid="browse-creators-link"]');
      
      // Find test creator
      const creatorCard = page.locator('[data-testid="creator-card"]').filter({ 
        hasText: TEST_USERS.creator.name 
      }).first();
      
      if (await creatorCard.count() === 0) {
        // If creator card not visible, search for them
        await page.fill('[data-testid="creator-search"]', TEST_USERS.creator.name);
        await page.press('[data-testid="creator-search"]', 'Enter');
      }
      
      await expect(creatorCard).toBeVisible();
      await creatorCard.click();
      
      // Follow creator
      const followButton = page.locator('[data-testid="follow-button"]');
      await followButton.click();
      await pageHelper.waitForNotification('success');
      
      // Verify following status
      await expect(followButton).toContainText('Following');
      
      console.log('✓ Investor is now following creator');

      // Step 2: Creator creates new pitch
      console.log('Step 2: Creator creates new pitch...');
      await authHelper.switchPortal('creator');
      
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', 'Follow Notification Test');
      await page.fill('[data-testid="logline-input"]', 'This should notify followers');
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Creator published new pitch');

      // Step 3: Investor receives follower notification
      console.log('Step 3: Checking investor receives notification...');
      await authHelper.switchPortal('investor');
      
      // Check for notification
      const notificationBell = page.locator('[data-testid="notification-bell"]');
      
      // Wait for notification to arrive
      await page.waitForTimeout(3000);
      
      await notificationBell.click();
      const notificationDropdown = page.locator('[data-testid="notification-dropdown"]');
      await expect(notificationDropdown).toContainText('creator you follow published a new pitch');
      
      console.log('✓ Follower notification received');

      // Step 4: Investor can unfollow
      console.log('Step 4: Testing unfollow...');
      await page.click('[data-testid="following-link"]');
      
      const followingCard = page.locator('[data-testid="following-card"]').filter({ 
        hasText: TEST_USERS.creator.name 
      }).first();
      await expect(followingCard).toBeVisible();
      
      await followingCard.locator('[data-testid="unfollow-button"]').click();
      await page.click('[data-testid="confirm-unfollow"]');
      await pageHelper.waitForNotification('success');
      
      // Verify unfollowed
      await expect(followingCard).not.toBeVisible();
      
      console.log('✓ Successfully unfollowed creator');
    });
  });

  test.describe('NDA Approval Workflow', () => {
    test('should handle complete NDA workflow with notifications', async ({ page }) => {
      let pitchTitle = 'NDA Workflow Test Pitch';
      
      // Step 1: Creator creates pitch
      await authHelper.loginAsCreator();
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', pitchTitle);
      await page.fill('[data-testid="logline-input"]', 'Testing complete NDA approval workflow');
      await page.fill('[data-testid="synopsis-input"]', 'A comprehensive test of the NDA system');
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Creator published pitch for NDA testing');

      // Step 2: Investor requests NDA
      await authHelper.switchPortal('investor');
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Find and click on our test pitch
      await page.fill('[data-testid="search-bar"]', pitchTitle);
      await page.press('[data-testid="search-bar"]', 'Enter');
      await pageHelper.waitForPageLoad();
      
      const testPitch = page.locator('[data-testid="pitch-card"]').filter({ 
        hasText: pitchTitle 
      }).first();
      await expect(testPitch).toBeVisible();
      await testPitch.click();
      
      // Request NDA
      await page.click('[data-testid="request-nda-button"]');
      await page.fill('[data-testid="request-reason"]', 'I am very interested in this project and would like to review the full details');
      await page.fill('[data-testid="investment-amount"]', '2000000');
      await page.click('[data-testid="submit-nda-request"]');
      await pageHelper.waitForNotification('success');
      
      // Verify NDA status
      await expect(page.locator('[data-testid="nda-status"]')).toContainText('Pending');
      
      console.log('✓ Investor requested NDA');

      // Step 3: Creator reviews and approves NDA
      await authHelper.switchPortal('creator');
      
      // Check for notification about NDA request
      const notificationBell = page.locator('[data-testid="notification-bell"]');
      await notificationBell.click();
      
      const ndasNotification = page.locator('[data-testid="notification-item"]').filter({ 
        hasText: 'NDA request' 
      }).first();
      
      if (await ndasNotification.count() > 0) {
        await ndasNotification.click();
      } else {
        // Navigate manually to NDA management
        await page.click('[data-testid="nda-management-link"]');
      }
      
      // Find and approve the NDA request
      const pendingRequest = page.locator('[data-testid="nda-request"]').filter({ 
        hasText: 'Pending' 
      }).first();
      await expect(pendingRequest).toBeVisible();
      await pendingRequest.click();
      
      // Review investor details
      await expect(page.locator('[data-testid="investor-details"]')).toContainText(TEST_USERS.investor.name);
      await expect(page.locator('[data-testid="requested-amount"]')).toContainText('$2,000,000');
      
      // Approve NDA
      await page.click('[data-testid="approve-nda-button"]');
      await page.fill('[data-testid="approval-message"]', 'Welcome! I look forward to discussing this project with you.');
      await page.click('[data-testid="confirm-approval"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Creator approved NDA request');

      // Step 4: Investor accesses full pitch content
      await authHelper.switchPortal('investor');
      
      // Navigate to NDA history
      await page.click('[data-testid="nda-history-link"]');
      
      const approvedNDA = page.locator('[data-testid="nda-row"]').filter({ 
        hasText: 'Approved' 
      }).and(page.locator('[data-testid="nda-row"]').filter({ 
        hasText: pitchTitle 
      })).first();
      
      await expect(approvedNDA).toBeVisible();
      await approvedNDA.click();
      
      // Verify access to full content
      await expect(page.locator('[data-testid="full-synopsis"]')).toBeVisible();
      await expect(page.locator('[data-testid="financial-details"]')).toBeVisible();
      await expect(page.locator('[data-testid="production-notes"]')).toBeVisible();
      
      // Should be able to download documents if any
      const downloadSection = page.locator('[data-testid="download-documents"]');
      if (await downloadSection.count() > 0) {
        await expect(downloadSection).toBeVisible();
      }
      
      console.log('✓ Investor can access full pitch content');

      // Step 5: Test NDA rejection workflow (create another request)
      await page.click('[data-testid="request-another-nda"]');
      await page.fill('[data-testid="request-reason"]', 'Follow-up request for additional details');
      await page.click('[data-testid="submit-nda-request"]');
      await pageHelper.waitForNotification('success');
      
      // Creator rejects this one
      await authHelper.switchPortal('creator');
      await page.click('[data-testid="nda-management-link"]');
      
      const secondRequest = page.locator('[data-testid="nda-request"]').filter({ 
        hasText: 'Follow-up request' 
      }).first();
      await expect(secondRequest).toBeVisible();
      await secondRequest.click();
      
      await page.click('[data-testid="reject-nda-button"]');
      await page.fill('[data-testid="rejection-reason"]', 'Thank you for your interest, but we are not accepting additional NDAs at this time.');
      await page.click('[data-testid="confirm-rejection"]');
      await pageHelper.waitForNotification('success');
      
      // Investor should see rejection
      await authHelper.switchPortal('investor');
      await page.click('[data-testid="nda-history-link"]');
      
      const rejectedNDA = page.locator('[data-testid="nda-row"]').filter({ 
        hasText: 'Rejected' 
      }).first();
      await expect(rejectedNDA).toBeVisible();
      
      console.log('✓ Complete NDA approval/rejection workflow tested');
    });
  });

  test.describe('Investment and Partnership Flow', () => {
    test('should handle investment flow with production partnership', async ({ page }) => {
      let pitchTitle = 'Investment Partnership Test';
      
      // Setup: Creator creates fundable pitch
      await authHelper.loginAsCreator();
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', pitchTitle);
      await page.fill('[data-testid="logline-input"]', 'A pitch designed to test investment and partnership workflows');
      await page.fill('[data-testid="synopsis-input"]', 'Comprehensive testing of the investment pipeline');
      await page.selectOption('[data-testid="genre-select"]', 'Action');
      await page.fill('[data-testid="budget-input"]', '15000000');
      await page.click('[data-testid="seeking-investment"]'); // Mark as seeking investment
      await page.click('[data-testid="publish-pitch-button"]');
      await page.click('[data-testid="confirm-publish-button"]');
      await pageHelper.waitForNotification('success');

      // Fast-track NDA approval for testing
      await authHelper.switchPortal('investor');
      await page.click('[data-testid="browse-pitches-button"]');
      await page.fill('[data-testid="search-bar"]', pitchTitle);
      await page.press('[data-testid="search-bar"]', 'Enter');
      await pageHelper.waitForPageLoad();
      
      const investmentPitch = page.locator('[data-testid="pitch-card"]').filter({ 
        hasText: pitchTitle 
      }).first();
      await investmentPitch.click();
      
      await page.click('[data-testid="request-nda-button"]');
      await page.fill('[data-testid="request-reason"]', 'Investment evaluation');
      await page.fill('[data-testid="investment-amount"]', '5000000');
      await page.click('[data-testid="submit-nda-request"]');
      await pageHelper.waitForNotification('success');

      // Creator auto-approves for testing
      await authHelper.switchPortal('creator');
      await page.click('[data-testid="nda-management-link"]');
      const pendingNDA = page.locator('[data-testid="nda-request"]').filter({ hasText: 'Pending' }).first();
      await pendingNDA.click();
      await page.click('[data-testid="approve-nda-button"]');
      await page.fill('[data-testid="approval-message"]', 'Approved for investment evaluation');
      await page.click('[data-testid="confirm-approval"]');
      await pageHelper.waitForNotification('success');

      // Investor makes investment
      await authHelper.switchPortal('investor');
      await page.click('[data-testid="nda-history-link"]');
      const approvedNDA = page.locator('[data-testid="nda-row"]').filter({ hasText: 'Approved' }).first();
      await approvedNDA.click();
      
      await page.click('[data-testid="invest-button"]');
      await page.fill('[data-testid="investment-amount"]', '4000000');
      await page.selectOption('[data-testid="investment-type"]', 'equity');
      await page.fill('[data-testid="equity-percentage"]', '25');
      await page.fill('[data-testid="terms"]', 'Strategic investment with marketing support');
      await page.click('[data-testid="submit-investment"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Investment completed');

      // Production company sees funded project
      await authHelper.switchPortal('production');
      await page.click('[data-testid="browse-pitches-button"]');
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="filter-funded-projects"]');
      await page.click('[data-testid="apply-filters"]');
      
      await page.fill('[data-testid="search-bar"]', pitchTitle);
      await page.press('[data-testid="search-bar"]', 'Enter');
      await pageHelper.waitForPageLoad();
      
      const fundedProject = page.locator('[data-testid="pitch-card"]').filter({ 
        hasText: pitchTitle 
      }).first();
      await expect(fundedProject).toContainText('Funded');
      await fundedProject.click();
      
      // Request production partnership
      await page.click('[data-testid="request-partnership-button"]');
      await page.fill('[data-testid="proposal-message"]', 'We would like to handle production for this funded project');
      await page.fill('[data-testid="proposed-budget"]', '15000000');
      await page.selectOption('[data-testid="partnership-type"]', 'production-services');
      await page.fill('[data-testid="timeline"]', '18 months from green light');
      await page.click('[data-testid="submit-partnership-request"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Production partnership requested');

      // Creator sees the funded status and partnership request
      await authHelper.switchPortal('creator');
      await page.click('[data-testid="manage-pitches-link"]');
      
      const fundedPitchRow = page.locator('[data-testid="pitch-row"]').filter({ 
        hasText: pitchTitle 
      }).first();
      await expect(fundedPitchRow).toContainText('Funded');
      
      // Check partnership requests
      await fundedPitchRow.click();
      await page.click('[data-testid="partnerships-tab"]');
      
      const partnershipRequest = page.locator('[data-testid="partnership-request"]').first();
      await expect(partnershipRequest).toBeVisible();
      
      // Accept partnership
      await partnershipRequest.click();
      await page.click('[data-testid="accept-partnership"]');
      await page.fill('[data-testid="acceptance-message"]', 'We accept your production proposal');
      await page.click('[data-testid="confirm-acceptance"]');
      await pageHelper.waitForNotification('success');
      
      console.log('✓ Partnership accepted');

      // Verify all parties see the complete project
      await page.click('[data-testid="project-status-tab"]');
      await expect(page.locator('[data-testid="project-status"]')).toContainText('In Development');
      await expect(page.locator('[data-testid="funding-status"]')).toContainText('Funded');
      await expect(page.locator('[data-testid="production-status"]')).toContainText('Partnership Active');
      
      console.log('✓ Complete investment and partnership workflow verified');
    });
  });
});