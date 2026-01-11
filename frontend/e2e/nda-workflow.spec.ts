import { test, expect } from '@playwright/test';
import { TEST_USERS, TEST_PITCHES, URLS } from './fixtures/test-data';

test.describe('NDA Management Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure clean state
    await page.goto('/');
  });

  test('End-to-end NDA workflow: Request, Approval, and Tracking', async ({ page }) => {
    // Step 1: Investor browses pitches and requests NDA
    await test.step('Investor requests NDA for a pitch', async () => {
      // Login as investor
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');
      
      // Wait for dashboard
      await page.waitForURL('**/investor/dashboard');
      await expect(page.locator('[data-testid="dashboard-title"]')).toBeVisible();

      // Navigate to marketplace to find a pitch
      await page.click('[data-testid="nav-marketplace"]');
      await page.waitForURL('**/marketplace');

      // Find and click on a specific pitch (look for test pitch or first available)
      const firstPitch = page.locator('[data-testid="pitch-card"]').first();
      await expect(firstPitch).toBeVisible();
      await firstPitch.click();

      // On pitch detail page, request NDA
      await expect(page.locator('[data-testid="pitch-detail-title"]')).toBeVisible();
      const ndaButton = page.locator('[data-testid="request-nda-button"]');
      await expect(ndaButton).toBeVisible();
      await ndaButton.click();

      // Fill NDA request form
      await expect(page.locator('[data-testid="nda-request-modal"]')).toBeVisible();
      await page.fill('[data-testid="nda-investment-interest"]', '2500000');
      await page.fill('[data-testid="nda-message"]', 'Very interested in this project. Would like to review full details.');
      await page.selectOption('[data-testid="nda-timeline"]', '30_days');
      await page.click('[data-testid="submit-nda-request"]');

      // Verify success message
      await expect(page.locator('[data-testid="nda-success-message"]')).toBeVisible();
      await expect(page.locator('text=NDA request submitted successfully')).toBeVisible();
    });

    // Step 2: Verify NDA appears in investor's outgoing requests
    await test.step('Verify NDA in investor outgoing requests', async () => {
      await page.goto(URLS.investorNDAHistory);
      await page.click('[data-testid="outgoing-requests-tab"]');
      
      // Should see the pending NDA request
      const pendingRequest = page.locator('[data-testid="nda-outgoing-item"]').first();
      await expect(pendingRequest).toBeVisible();
      await expect(pendingRequest.locator('[data-testid="nda-status"]')).toHaveText('pending');
      await expect(pendingRequest.locator('text=2500000')).toBeVisible();
    });

    // Step 3: Creator receives and approves NDA request
    await test.step('Creator approves NDA request', async () => {
      // Logout investor
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      await page.waitForURL('/');

      // Login as creator
      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/creator/dashboard');

      // Navigate to NDA management
      await page.goto(URLS.creatorNDAManagement);
      await page.click('[data-testid="incoming-requests-tab"]');

      // Find the incoming NDA request
      const incomingRequest = page.locator('[data-testid="nda-incoming-item"]').first();
      await expect(incomingRequest).toBeVisible();
      await expect(incomingRequest.locator('[data-testid="nda-status"]')).toHaveText('pending');

      // Approve the NDA request
      await incomingRequest.locator('[data-testid="approve-nda-button"]').click();

      // Verify approval modal and confirm
      await expect(page.locator('[data-testid="nda-approval-modal"]')).toBeVisible();
      await page.fill('[data-testid="approval-message"]', 'Approved! Looking forward to discussing this project.');
      await page.click('[data-testid="confirm-approval"]');

      // Verify success message
      await expect(page.locator('text=NDA approved successfully')).toBeVisible();

      // Verify status changed to approved
      await expect(incomingRequest.locator('[data-testid="nda-status"]')).toHaveText('approved');
    });

    // Step 4: Verify both parties can see the signed NDA
    await test.step('Verify signed NDA in both portals', async () => {
      // Check creator's signed NDAs
      await page.click('[data-testid="signed-ndas-tab"]');
      const creatorSignedNDA = page.locator('[data-testid="nda-signed-item"]').first();
      await expect(creatorSignedNDA).toBeVisible();
      await expect(creatorSignedNDA.locator('[data-testid="nda-status"]')).toHaveText('approved');

      // Switch to investor and check their signed NDAs
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');
      await page.waitForURL('**/investor/dashboard');

      await page.goto(URLS.investorNDAHistory);
      await page.click('[data-testid="signed-ndas-tab"]');
      
      const investorSignedNDA = page.locator('[data-testid="nda-signed-item"]').first();
      await expect(investorSignedNDA).toBeVisible();
      await expect(investorSignedNDA.locator('[data-testid="nda-status"]')).toHaveText('approved');
    });
  });

  test('NDA request with rejection flow', async ({ page }) => {
    await test.step('Creator rejects NDA request', async () => {
      // Setup: Have an investor request NDA (simplified version)
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');
      
      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      await pitch.click();
      await page.click('[data-testid="request-nda-button"]');
      await page.fill('[data-testid="nda-investment-interest"]', '1000000');
      await page.fill('[data-testid="nda-message"]', 'Interested in this project');
      await page.click('[data-testid="submit-nda-request"]');

      // Logout and login as creator
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');

      // Go to NDA management and reject
      await page.goto(URLS.creatorNDAManagement);
      await page.click('[data-testid="incoming-requests-tab"]');
      
      const request = page.locator('[data-testid="nda-incoming-item"]').first();
      await request.locator('[data-testid="reject-nda-button"]').click();

      // Fill rejection reason
      await expect(page.locator('[data-testid="nda-rejection-modal"]')).toBeVisible();
      await page.fill('[data-testid="rejection-reason"]', 'Project not currently seeking investment.');
      await page.click('[data-testid="confirm-rejection"]');

      // Verify rejection
      await expect(page.locator('text=NDA request rejected')).toBeVisible();
      await expect(request.locator('[data-testid="nda-status"]')).toHaveText('rejected');
    });
  });

  test('NDA notifications and real-time updates', async ({ page }) => {
    await test.step('Verify notifications are created for NDA events', async () => {
      // Login as investor
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');

      // Check notifications before any NDA activity
      await page.click('[data-testid="notifications-bell"]');
      const initialNotificationCount = await page.locator('[data-testid="notification-item"]').count();

      // Make NDA request
      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      await pitch.click();
      await page.click('[data-testid="request-nda-button"]');
      await page.fill('[data-testid="nda-investment-interest"]', '500000');
      await page.fill('[data-testid="nda-message"]', 'Test notification');
      await page.click('[data-testid="submit-nda-request"]');

      // Wait for notification to appear (WebSocket should update in real-time)
      await page.waitForTimeout(2000); // Give WebSocket time to update

      // Check that notification count increased
      await page.click('[data-testid="notifications-bell"]');
      const newNotificationCount = await page.locator('[data-testid="notification-item"]').count();
      expect(newNotificationCount).toBeGreaterThan(initialNotificationCount);

      // Verify notification content
      const latestNotification = page.locator('[data-testid="notification-item"]').first();
      await expect(latestNotification).toContainText('NDA request submitted');
    });
  });

  test('NDA API endpoints validation', async ({ page }) => {
    await test.step('Validate NDA API responses', async () => {
      // Login as investor
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');

      // Intercept API calls to validate endpoints
      const apiCalls = {
        outgoingRequests: false,
        incomingRequests: false,
        signedNDAs: false,
        activeNDAs: false
      };

      page.on('response', response => {
        const url = response.url();
        if (url.includes('/api/ndas/outgoing-requests')) apiCalls.outgoingRequests = true;
        if (url.includes('/api/ndas/incoming-requests')) apiCalls.incomingRequests = true;
        if (url.includes('/api/ndas/signed')) apiCalls.signedNDAs = true;
        if (url.includes('/api/ndas/active')) apiCalls.activeNDAs = true;
      });

      // Navigate to NDA history to trigger API calls
      await page.goto(URLS.investorNDAHistory);

      // Verify all expected API endpoints were called
      expect(apiCalls.outgoingRequests).toBe(true);
      expect(apiCalls.signedNDAs).toBe(true);
      expect(apiCalls.activeNDAs).toBe(true);
    });
  });

  test('NDA data persistence and reload', async ({ page }) => {
    await test.step('Verify NDA data persists across page reloads', async () => {
      // Login as creator and go to NDA management
      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');

      await page.goto(URLS.creatorNDAManagement);
      
      // Count initial NDAs
      const initialIncomingCount = await page.locator('[data-testid="nda-incoming-item"]').count();
      await page.click('[data-testid="signed-ndas-tab"]');
      const initialSignedCount = await page.locator('[data-testid="nda-signed-item"]').count();

      // Reload page
      await page.reload();

      // Verify counts are the same
      const reloadIncomingCount = await page.locator('[data-testid="nda-incoming-item"]').count();
      expect(reloadIncomingCount).toBe(initialIncomingCount);

      await page.click('[data-testid="signed-ndas-tab"]');
      const reloadSignedCount = await page.locator('[data-testid="nda-signed-item"]').count();
      expect(reloadSignedCount).toBe(initialSignedCount);
    });
  });
});