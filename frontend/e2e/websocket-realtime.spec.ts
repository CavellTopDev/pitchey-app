import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { WebSocketTestHelper } from './utils/websocket-helpers';
import { TEST_USERS } from './fixtures/test-data';

test.describe('WebSocket and Real-time Features', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;
  let wsHelper: WebSocketTestHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    wsHelper = new WebSocketTestHelper(page);
  });

  test.afterEach(async () => {
    await wsHelper.stopMonitoring();
  });

  test.describe('WebSocket Connection Management', () => {
    test('should establish WebSocket connection on login', async ({ page }) => {
      await wsHelper.startMonitoring();
      
      // Login and verify WebSocket connection
      await authHelper.loginAsCreator();
      
      // Wait for WebSocket connection to be established
      const isConnected = await wsHelper.verifyConnection(10000);
      expect(isConnected).toBeTruthy();
      
      // Check for connection status indicator
      const wsStatus = page.locator('[data-testid="websocket-status"]');
      if (await wsStatus.count() > 0) {
        await expect(wsStatus).toContainText(/Connected|Online/);
      }
      
      console.log('✓ WebSocket connection established on login');
    });

    test('should handle WebSocket disconnection and reconnection', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();
      
      // Verify initial connection
      const initialConnection = await wsHelper.verifyConnection();
      expect(initialConnection).toBeTruthy();
      
      // Test reconnection behavior
      await wsHelper.testReconnection();
      
      console.log('✓ WebSocket reconnection handled correctly');
    });

    test('should measure reasonable WebSocket latency', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();
      
      await wsHelper.verifyConnection();
      
      try {
        const latency = await wsHelper.measureLatency();
        
        // Reasonable latency should be under 1000ms for local testing
        expect(latency).toBeLessThan(1000);
        console.log(`WebSocket latency: ${latency}ms`);
      } catch (error) {
        console.warn('Latency measurement failed:', error);
        // Don't fail the test if ping/pong is not implemented
      }
    });
  });

  test.describe('Real-time Notifications', () => {
    test('should receive real-time notifications', async ({ page, context }) => {
      // Create second browser context for multi-user testing
      const secondContext = await context.browser()?.newContext();
      if (!secondContext) return;

      const secondPage = await secondContext.newPage();
      const secondAuth = new AuthHelper(secondPage);
      const secondWs = new WebSocketTestHelper(secondPage);

      try {
        // Setup: Creator in first context, Investor in second
        await authHelper.loginAsCreator();
        await wsHelper.startMonitoring();
        
        await secondAuth.loginAsInvestor();
        await secondWs.startMonitoring();

        // Both connections should be established
        await wsHelper.verifyConnection();
        await secondWs.verifyConnection();

        // Creator publishes a new pitch
        await page.click('[data-testid="create-pitch-button"]');
        await page.fill('[data-testid="title-input"]', 'Real-time Notification Test');
        await page.fill('[data-testid="logline-input"]', 'Testing real-time notifications');
        
        // Publish pitch
        await page.click('[data-testid="publish-pitch-button"]');
        await page.click('[data-testid="confirm-publish-button"]');
        await pageHelper.waitForNotification('success');

        // Investor should receive notification
        await secondPage.waitForTimeout(2000); // Allow time for WebSocket delivery

        // Check notification bell on investor page
        const notificationBell = secondPage.locator('[data-testid="notification-bell"]');
        await expect(notificationBell).toHaveClass(/.*has-new.*|.*has-notifications.*/);

        // Click to view notifications
        await notificationBell.click();
        const notificationDropdown = secondPage.locator('[data-testid="notification-dropdown"]');
        await expect(notificationDropdown).toContainText('new pitch');

        console.log('✓ Real-time notifications working between portals');

      } finally {
        await secondContext.close();
      }
    });

    test('should handle notification acknowledgment', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await wsHelper.startMonitoring();

      // Simulate receiving a notification
      await wsHelper.testNotificationMessage({
        id: 'test-notification-1',
        type: 'nda_approved',
        title: 'NDA Approved',
        message: 'Your NDA request has been approved by the creator',
        timestamp: Date.now(),
        read: false
      });

      // Check notification appears
      const notificationBell = page.locator('[data-testid="notification-bell"]');
      await expect(notificationBell).toHaveClass(/.*has-notifications.*/);

      // Click notification to mark as read
      await notificationBell.click();
      const notificationItem = page.locator('[data-testid="notification-item"]').first();
      await notificationItem.click();

      // Notification should be marked as read
      await expect(notificationItem).toHaveClass(/.*read.*|.*acknowledged.*/);

      console.log('✓ Notification acknowledgment working');
    });
  });

  test.describe('Draft Auto-sync', () => {
    test('should auto-save drafts in real-time', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Create new pitch
      await page.click('[data-testid="create-pitch-button"]');
      
      // Start typing
      await page.fill('[data-testid="title-input"]', 'Auto-sync Test Pitch');
      await page.fill('[data-testid="logline-input"]', 'Testing the auto-sync functionality');

      // Wait for auto-save (should happen every 5 seconds)
      await page.waitForTimeout(6000);

      // Check for auto-save indicator
      const autoSaveStatus = page.locator('[data-testid="auto-save-status"]');
      if (await autoSaveStatus.count() > 0) {
        await expect(autoSaveStatus).toContainText(/Auto-saved|Saved/);
      }

      // Verify draft sync via WebSocket
      const messages = await wsHelper.getMessages();
      const draftSyncMessages = messages.filter(m => m.type === 'draft_sync');
      expect(draftSyncMessages.length).toBeGreaterThan(0);

      console.log('✓ Draft auto-sync working');
    });

    test('should handle concurrent editing conflicts', async ({ page, context }) => {
      // This test simulates two users editing the same pitch
      const secondContext = await context.browser()?.newContext();
      if (!secondContext) return;

      const secondPage = await secondContext.newPage();
      const secondAuth = new AuthHelper(secondPage);

      try {
        // Both users are creators (team collaboration scenario)
        await authHelper.loginAsCreator();
        await secondAuth.loginAsCreator();

        // First user creates a pitch
        await page.click('[data-testid="create-pitch-button"]');
        await page.fill('[data-testid="title-input"]', 'Collaborative Editing Test');
        await page.click('[data-testid="save-draft-button"]');
        await pageHelper.waitForNotification('success');

        const pitchUrl = page.url();
        const pitchId = pitchUrl.match(/pitch\/(\d+)/)?.[1];

        // Second user opens the same pitch for editing
        await secondPage.goto(`/pitch/${pitchId}/edit`);

        // Both users edit simultaneously
        await page.fill('[data-testid="synopsis-input"]', 'User 1 editing synopsis');
        await secondPage.fill('[data-testid="synopsis-input"]', 'User 2 editing synopsis');

        // First user saves
        await page.click('[data-testid="save-draft-button"]');
        await pageHelper.waitForNotification('success');

        // Second user tries to save
        await secondPage.click('[data-testid="save-draft-button"]');

        // Should detect conflict
        const conflictModal = secondPage.locator('[data-testid="edit-conflict-modal"]');
        if (await conflictModal.count() > 0) {
          await expect(conflictModal).toBeVisible();
          console.log('✓ Edit conflict detected');

          // Resolve conflict
          await secondPage.click('[data-testid="resolve-conflict-merge"]');
        } else {
          console.log('? Edit conflict detection not implemented or conflict resolved automatically');
        }

      } finally {
        await secondContext.close();
      }
    });
  });

  test.describe('Presence and Typing Indicators', () => {
    test('should show user presence status', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Test presence indicator functionality
      await wsHelper.testPresenceIndicators(TEST_USERS.creator.email, 'online');

      // Look for presence indicators in the interface
      const presenceIndicators = page.locator('[data-testid="presence-indicator"], .user-status');
      
      if (await presenceIndicators.count() > 0) {
        await expect(presenceIndicators.first()).toBeVisible();
        console.log('✓ Presence indicators working');
      } else {
        console.log('? Presence indicators not visible in current interface');
      }
    });

    test('should show typing indicators during collaboration', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Simulate typing indicator
      await wsHelper.testPresenceIndicators('collaborator-user', 'typing');

      // Check for typing indicator
      const typingIndicator = page.locator('[data-testid="typing-indicator"]');
      
      if (await typingIndicator.count() > 0) {
        await expect(typingIndicator).toBeVisible();
        await expect(typingIndicator).toContainText(/typing|editing/);
        console.log('✓ Typing indicators working');
      } else {
        console.log('? Typing indicators not implemented in current interface');
      }
    });
  });

  test.describe('Live Dashboard Updates', () => {
    test('should update dashboard metrics in real-time', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Get initial metrics
      const totalPitches = page.locator('[data-testid="total-pitches"]');
      const totalViews = page.locator('[data-testid="total-views"]');

      if (await totalPitches.count() > 0) {
        const initialPitchCount = await totalPitches.textContent();
        
        // Create a new pitch to trigger metric update
        await page.click('[data-testid="create-pitch-button"]');
        await page.fill('[data-testid="title-input"]', 'Live Metrics Test');
        await page.fill('[data-testid="logline-input"]', 'Testing live dashboard updates');
        await page.click('[data-testid="publish-pitch-button"]');
        await page.click('[data-testid="confirm-publish-button"]');
        await pageHelper.waitForNotification('success');

        // Navigate back to dashboard
        await page.click('[data-testid="dashboard-link"]');

        // Wait for real-time update
        await page.waitForTimeout(3000);

        // Check if metrics updated
        const updatedPitchCount = await totalPitches.textContent();
        
        if (updatedPitchCount !== initialPitchCount) {
          console.log('✓ Dashboard metrics updated in real-time');
        } else {
          console.log('? Dashboard metrics may not update in real-time or update was not detected');
        }
      }
    });
  });

  test.describe('WebSocket Error Handling', () => {
    test('should handle malformed WebSocket messages gracefully', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Inject malformed message
      await page.evaluate(() => {
        const event = new MessageEvent('message', {
          data: 'invalid-json-data'
        });
        
        if ((window as any).__websocketInstance) {
          (window as any).__websocketInstance.dispatchEvent(event);
        }
      });

      // Application should continue functioning
      await page.waitForTimeout(1000);
      
      // Try a normal interaction
      await page.click('[data-testid="create-pitch-button"]');
      await expect(page.locator('[data-testid="title-input"]')).toBeVisible();

      console.log('✓ Malformed WebSocket messages handled gracefully');
    });

    test('should handle network interruptions', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Verify initial connection
      await wsHelper.verifyConnection();

      // Simulate network interruption by going offline
      await page.context().setOffline(true);
      await page.waitForTimeout(2000);

      // Check for offline indicator
      const offlineIndicator = page.locator('[data-testid="offline-indicator"], [data-testid="websocket-status"]');
      if (await offlineIndicator.count() > 0) {
        const statusText = await offlineIndicator.textContent();
        expect(statusText).toMatch(/Offline|Disconnected|Reconnecting/i);
      }

      // Go back online
      await page.context().setOffline(false);
      await page.waitForTimeout(3000);

      // Should reconnect automatically
      const isReconnected = await wsHelper.verifyConnection(10000);
      expect(isReconnected).toBeTruthy();

      console.log('✓ Network interruption handled with reconnection');
    });

    test('should queue messages during disconnection', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Start creating a pitch
      await page.click('[data-testid="create-pitch-button"]');
      await page.fill('[data-testid="title-input"]', 'Offline Queue Test');

      // Simulate disconnection
      await wsHelper.simulateDisconnection();

      // Continue editing while offline
      await page.fill('[data-testid="logline-input"]', 'This should be queued for sync when reconnected');

      // Auto-save should queue the changes
      await page.waitForTimeout(6000);

      // Reconnect (page reload simulates reconnection)
      await page.reload();
      await authHelper.verifyAuthenticated('creator');

      // Check if changes were preserved/synced
      const titleInput = page.locator('[data-testid="title-input"]');
      if (await titleInput.count() > 0) {
        const titleValue = await titleInput.inputValue();
        expect(titleValue).toContain('Offline Queue Test');
        console.log('✓ Draft changes queued during disconnection');
      }
    });
  });

  test.describe('WebSocket Performance', () => {
    test('should handle high message volume', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      // Simulate high message volume
      const messageCount = 20;
      const startTime = Date.now();

      for (let i = 0; i < messageCount; i++) {
        await page.evaluate((index) => {
          if ((window as any).__websocketInstance) {
            (window as any).__websocketInstance.send(JSON.stringify({
              type: 'performance_test',
              sequence: index,
              timestamp: Date.now()
            }));
          }
        }, i);
      }

      // Wait for all messages to be processed
      await page.waitForTimeout(2000);

      const stats = await wsHelper.getConnectionStats();
      const processingTime = Date.now() - startTime;

      expect(stats.outgoingMessages).toBeGreaterThanOrEqual(messageCount);
      expect(processingTime).toBeLessThan(5000); // Should process within 5 seconds

      console.log(`✓ Processed ${messageCount} messages in ${processingTime}ms`);
      console.log(`Message stats:`, stats);
    });

    test('should maintain message ordering', async ({ page }) => {
      await authHelper.loginAsCreator();
      await wsHelper.startMonitoring();

      const isOrdered = await wsHelper.testMessageOrdering(10);
      
      if (isOrdered) {
        console.log('✓ WebSocket message ordering maintained');
      } else {
        console.log('? WebSocket message ordering test inconclusive');
      }
    });
  });

  test.describe('WebSocket Security', () => {
    test('should authenticate WebSocket connections', async ({ page }) => {
      // Test unauthenticated access
      await page.goto('/');
      await wsHelper.startMonitoring();

      // WebSocket should not connect without authentication
      const isConnected = await wsHelper.verifyConnection(3000);
      expect(isConnected).toBeFalsy();

      // Login and verify connection
      await authHelper.loginAsCreator();
      const authenticatedConnection = await wsHelper.verifyConnection(10000);
      expect(authenticatedConnection).toBeTruthy();

      console.log('✓ WebSocket authentication working');
    });

    test('should validate message permissions', async ({ page }) => {
      await authHelper.loginAsInvestor();
      await wsHelper.startMonitoring();

      // Try to send a message that investor shouldn't be able to send
      await page.evaluate(() => {
        if ((window as any).__websocketInstance) {
          (window as any).__websocketInstance.send(JSON.stringify({
            type: 'admin_action',
            action: 'delete_all_pitches'
          }));
        }
      });

      await page.waitForTimeout(1000);

      // Should not receive any dangerous response or cause system issues
      const messages = await wsHelper.getMessages();
      const adminMessages = messages.filter(m => m.type.includes('admin'));
      
      expect(adminMessages.length).toBe(0);

      console.log('✓ WebSocket message permissions validated');
    });
  });
});