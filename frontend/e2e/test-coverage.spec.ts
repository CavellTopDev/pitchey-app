import { test, expect } from '@playwright/test';
import { TEST_USERS, URLS } from './fixtures/test-data';

interface APIEndpoint {
  endpoint: string;
  method: string;
  portal: string;
  category: string;
  tested: boolean;
  testFile?: string;
}

test.describe('API Endpoint Coverage Report', () => {
  let apiEndpointsCovered: APIEndpoint[] = [];

  test.beforeEach(async ({ page }) => {
    // Track all API calls during tests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/')) {
        const endpoint = url.replace(/.*\/api/, '/api');
        const method = request.method();
        
        // Categorize endpoints
        let category = 'other';
        let portal = 'general';
        
        if (endpoint.includes('/auth/')) category = 'authentication';
        else if (endpoint.includes('/dashboard/')) category = 'dashboard';
        else if (endpoint.includes('/ndas/')) category = 'nda-management';
        else if (endpoint.includes('/saved-pitches')) category = 'saved-pitches';
        else if (endpoint.includes('/notifications/')) category = 'notifications';
        else if (endpoint.includes('/pitches/')) category = 'pitches';
        else if (endpoint.includes('/users/')) category = 'users';
        
        if (endpoint.includes('creator')) portal = 'creator';
        else if (endpoint.includes('investor')) portal = 'investor';
        else if (endpoint.includes('production')) portal = 'production';

        // Add to coverage list if not already present
        const existingEndpoint = apiEndpointsCovered.find(
          ep => ep.endpoint === endpoint && ep.method === method
        );
        
        if (!existingEndpoint) {
          apiEndpointsCovered.push({
            endpoint,
            method,
            portal,
            category,
            tested: true,
            testFile: test.info().title
          });
        }
      }
    });
  });

  test('Track NDA workflow API coverage', async ({ page }) => {
    await test.step('Test NDA endpoints as investor', async () => {
      // Login as investor
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');

      // Navigate to NDA history to trigger API calls
      await page.goto(URLS.investorNDAHistory);
      await page.waitForTimeout(2000);

      // Navigate to marketplace and try to request NDA
      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      if (await pitch.count() > 0) {
        await pitch.click();
        const ndaButton = page.locator('[data-testid="request-nda-button"]');
        if (await ndaButton.count() > 0) {
          await ndaButton.click();
          // Fill form but don't submit to avoid side effects
          await page.fill('[data-testid="nda-investment-interest"]', '1000000');
          await page.fill('[data-testid="nda-message"]', 'Test message');
        }
      }
    });

    await test.step('Test NDA endpoints as creator', async () => {
      // Switch to creator
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');

      // Navigate to NDA management
      await page.goto(URLS.creatorNDAManagement);
      await page.waitForTimeout(2000);
    });
  });

  test('Track saved pitches API coverage', async ({ page }) => {
    await test.step('Test saved pitches endpoints', async () => {
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');

      // Go to saved pitches to trigger GET endpoint
      await page.goto(URLS.investorWatchlist);
      await page.waitForTimeout(2000);

      // Go to marketplace to trigger save/unsave endpoints
      await page.goto(URLS.marketplace);
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      if (await pitch.count() > 0) {
        const saveButton = pitch.locator('[data-testid="save-pitch-button"]');
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test('Track dashboard API coverage', async ({ page }) => {
    const portals = [
      { portal: 'creator', loginUrl: URLS.creatorLogin, dashboardUrl: URLS.creatorDashboard },
      { portal: 'investor', loginUrl: URLS.investorLogin, dashboardUrl: URLS.investorDashboard },
      { portal: 'production', loginUrl: URLS.productionLogin, dashboardUrl: URLS.productionDashboard }
    ];

    for (const { portal, loginUrl, dashboardUrl } of portals) {
      await test.step(`Test ${portal} dashboard APIs`, async () => {
        const user = TEST_USERS[portal as keyof typeof TEST_USERS];
        
        await page.goto(loginUrl);
        await page.fill('[data-testid="email-input"]', user.email);
        await page.fill('[data-testid="password-input"]', user.password);
        await page.click('[data-testid="login-button"]');
        await page.waitForURL(`**/${portal}/dashboard`);
        await page.waitForTimeout(3000); // Allow all dashboard API calls to complete
      });
    }
  });

  test('Track notification API coverage', async ({ page }) => {
    await test.step('Test notification endpoints', async () => {
      await page.goto(URLS.creatorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.creator.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.creator.password);
      await page.click('[data-testid="login-button"]');

      // Click notifications bell to trigger unread notifications API
      const notificationsBell = page.locator('[data-testid="notifications-bell"]');
      if (await notificationsBell.count() > 0) {
        await notificationsBell.click();
        await page.waitForTimeout(1000);

        // Try to mark a notification as read
        const notification = page.locator('[data-testid="notification-item"]').first();
        if (await notification.count() > 0) {
          await notification.click();
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test('Track pitch browsing API coverage', async ({ page }) => {
    await test.step('Test pitch endpoints', async () => {
      await page.goto(URLS.investorLogin);
      await page.fill('[data-testid="email-input"]', TEST_USERS.investor.email);
      await page.fill('[data-testid="password-input"]', TEST_USERS.investor.password);
      await page.click('[data-testid="login-button"]');

      // Browse marketplace to trigger pitch listing API
      await page.goto(URLS.marketplace);
      await page.waitForTimeout(2000);

      // Click on a pitch to trigger pitch details API
      const pitch = page.locator('[data-testid="pitch-card"]').first();
      if (await pitch.count() > 0) {
        await pitch.click();
        await page.waitForTimeout(2000);
      }

      // Try search functionality if available
      await page.goto(URLS.search);
      const searchBox = page.locator('[data-testid="search-input"]');
      if (await searchBox.count() > 0) {
        await searchBox.fill('action');
        await page.press('[data-testid="search-input"]', 'Enter');
        await page.waitForTimeout(2000);
      }
    });
  });

  test.afterAll(async ({}, testInfo) => {
    // Generate coverage report
    const expectedEndpoints: APIEndpoint[] = [
      // Authentication endpoints
      { endpoint: '/api/auth/session', method: 'GET', portal: 'general', category: 'authentication', tested: false },
      { endpoint: '/api/auth/sign-in', method: 'POST', portal: 'general', category: 'authentication', tested: false },
      { endpoint: '/api/auth/sign-out', method: 'POST', portal: 'general', category: 'authentication', tested: false },
      
      // Dashboard endpoints
      { endpoint: '/api/dashboard/creator/stats', method: 'GET', portal: 'creator', category: 'dashboard', tested: false },
      { endpoint: '/api/dashboard/investor/stats', method: 'GET', portal: 'investor', category: 'dashboard', tested: false },
      { endpoint: '/api/dashboard/production/stats', method: 'GET', portal: 'production', category: 'dashboard', tested: false },
      
      // NDA endpoints
      { endpoint: '/api/ndas/active', method: 'GET', portal: 'general', category: 'nda-management', tested: false },
      { endpoint: '/api/ndas/signed', method: 'GET', portal: 'general', category: 'nda-management', tested: false },
      { endpoint: '/api/ndas/incoming-requests', method: 'GET', portal: 'creator', category: 'nda-management', tested: false },
      { endpoint: '/api/ndas/outgoing-requests', method: 'GET', portal: 'investor', category: 'nda-management', tested: false },
      { endpoint: '/api/ndas/request', method: 'POST', portal: 'investor', category: 'nda-management', tested: false },
      
      // Saved pitches endpoints  
      { endpoint: '/api/saved-pitches', method: 'GET', portal: 'investor', category: 'saved-pitches', tested: false },
      { endpoint: '/api/saved-pitches', method: 'POST', portal: 'investor', category: 'saved-pitches', tested: false },
      { endpoint: '/api/saved-pitches', method: 'DELETE', portal: 'investor', category: 'saved-pitches', tested: false },
      
      // Notification endpoints
      { endpoint: '/api/notifications/unread', method: 'GET', portal: 'general', category: 'notifications', tested: false },
      
      // Pitch endpoints
      { endpoint: '/api/pitches', method: 'GET', portal: 'general', category: 'pitches', tested: false },
    ];

    // Mark tested endpoints
    for (const expectedEp of expectedEndpoints) {
      const testedEndpoint = apiEndpointsCovered.find(
        ep => ep.endpoint.includes(expectedEp.endpoint.replace('/api', '')) && 
              ep.method === expectedEp.method
      );
      if (testedEndpoint) {
        expectedEp.tested = true;
        expectedEp.testFile = testedEndpoint.testFile;
      }
    }

    // Calculate coverage statistics
    const totalExpected = expectedEndpoints.length;
    const totalTested = expectedEndpoints.filter(ep => ep.tested).length;
    const coveragePercentage = ((totalTested / totalExpected) * 100).toFixed(2);

    // Group by category
    const categoryStats = expectedEndpoints.reduce((acc, ep) => {
      if (!acc[ep.category]) {
        acc[ep.category] = { total: 0, tested: 0 };
      }
      acc[ep.category].total++;
      if (ep.tested) acc[ep.category].tested++;
      return acc;
    }, {} as Record<string, { total: number; tested: number }>);

    // Generate HTML report
    const htmlReport = `
<!DOCTYPE html>
<html>
<head>
    <title>API Endpoint Coverage Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .coverage-high { color: #28a745; }
        .coverage-medium { color: #ffc107; }
        .coverage-low { color: #dc3545; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f8f9fa; }
        .tested { background-color: #d4edda; }
        .not-tested { background-color: #f8d7da; }
        .category-section { margin-bottom: 30px; }
    </style>
</head>
<body>
    <h1>API Endpoint Coverage Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    <div class="summary">
        <h2>Coverage Summary</h2>
        <p><strong>Overall Coverage: <span class="${coveragePercentage >= 80 ? 'coverage-high' : coveragePercentage >= 60 ? 'coverage-medium' : 'coverage-low'}">${coveragePercentage}%</span></strong></p>
        <p>Total Endpoints: ${totalExpected} | Tested: ${totalTested} | Not Tested: ${totalExpected - totalTested}</p>
    </div>

    <h2>Coverage by Category</h2>
    <table>
        <tr><th>Category</th><th>Tested</th><th>Total</th><th>Percentage</th></tr>
        ${Object.entries(categoryStats).map(([category, stats]) => {
          const percentage = ((stats.tested / stats.total) * 100).toFixed(1);
          return `<tr>
            <td>${category}</td>
            <td>${stats.tested}</td>
            <td>${stats.total}</td>
            <td class="${percentage >= 80 ? 'coverage-high' : percentage >= 60 ? 'coverage-medium' : 'coverage-low'}">${percentage}%</td>
          </tr>`;
        }).join('')}
    </table>

    ${Object.entries(categoryStats).map(([category, stats]) => `
    <div class="category-section">
        <h3>${category.toUpperCase()}</h3>
        <table>
            <tr><th>Endpoint</th><th>Method</th><th>Portal</th><th>Status</th><th>Test File</th></tr>
            ${expectedEndpoints
              .filter(ep => ep.category === category)
              .map(ep => `
                <tr class="${ep.tested ? 'tested' : 'not-tested'}">
                    <td>${ep.endpoint}</td>
                    <td>${ep.method}</td>
                    <td>${ep.portal}</td>
                    <td>${ep.tested ? '✅ Tested' : '❌ Not Tested'}</td>
                    <td>${ep.testFile || 'N/A'}</td>
                </tr>
              `).join('')}
        </table>
    </div>
    `).join('')}

    <h2>Actually Tested Endpoints</h2>
    <p>The following endpoints were called during test execution:</p>
    <table>
        <tr><th>Endpoint</th><th>Method</th><th>Portal</th><th>Category</th><th>Test File</th></tr>
        ${apiEndpointsCovered.map(ep => `
            <tr>
                <td>${ep.endpoint}</td>
                <td>${ep.method}</td>
                <td>${ep.portal}</td>
                <td>${ep.category}</td>
                <td>${ep.testFile}</td>
            </tr>
        `).join('')}
    </table>

    <h2>Recommendations</h2>
    <ul>
        ${totalTested < totalExpected ? `<li>Add tests for the ${totalExpected - totalTested} untested endpoints listed above</li>` : ''}
        ${parseFloat(coveragePercentage) < 90 ? '<li>Aim for 90%+ endpoint coverage for production confidence</li>' : ''}
        <li>Consider adding error scenario tests for critical endpoints</li>
        <li>Add performance tests for high-traffic endpoints</li>
    </ul>
</body>
</html>`;

    // Write the report
    await testInfo.attach('coverage-report.html', {
      body: htmlReport,
      contentType: 'text/html'
    });

    // Also write JSON data for CI/CD integration
    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalEndpoints: totalExpected,
        testedEndpoints: totalTested,
        coveragePercentage: parseFloat(coveragePercentage)
      },
      categoryStats,
      expectedEndpoints,
      actualEndpoints: apiEndpointsCovered
    };

    await testInfo.attach('coverage-report.json', {
      body: JSON.stringify(jsonReport, null, 2),
      contentType: 'application/json'
    });

    // Log summary to console
    console.log(`\n📊 API Coverage Report Generated:`);
    console.log(`   Overall Coverage: ${coveragePercentage}%`);
    console.log(`   Tested: ${totalTested}/${totalExpected} endpoints`);
    
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const percentage = ((stats.tested / stats.total) * 100).toFixed(1);
      console.log(`   ${category}: ${percentage}% (${stats.tested}/${stats.total})`);
    });

    if (parseFloat(coveragePercentage) < 80) {
      console.warn(`⚠️  Coverage below 80% - consider adding more tests`);
    } else {
      console.log(`✅ Good coverage achieved!`);
    }
  });
});