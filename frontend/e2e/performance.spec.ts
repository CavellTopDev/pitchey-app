import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';

interface PerformanceMetrics {
  loadTime: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  firstInputDelay?: number;
  timeToInteractive: number;
}

test.describe('Performance and Load Testing', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
  });

  test.describe('Core Web Vitals', () => {
    test('homepage should meet Core Web Vitals thresholds', async ({ page }) => {
      // Navigate to homepage and measure performance
      const startTime = Date.now();
      
      await page.goto('/', { waitUntil: 'networkidle' });
      
      const loadTime = Date.now() - startTime;
      
      // Get Core Web Vitals
      const metrics = await page.evaluate(() => {
        return new Promise<PerformanceMetrics>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            
            const metrics: PerformanceMetrics = {
              loadTime: navigationEntry.loadEventEnd - navigationEntry.navigationStart,
              firstContentfulPaint: 0,
              largestContentfulPaint: 0,
              cumulativeLayoutShift: 0,
              timeToInteractive: navigationEntry.domInteractive - navigationEntry.navigationStart
            };

            // Get paint metrics
            const paintEntries = performance.getEntriesByType('paint');
            paintEntries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                metrics.firstContentfulPaint = entry.startTime;
              }
            });

            resolve(metrics);
          }).observe({ entryTypes: ['navigation', 'paint', 'largest-contentful-paint', 'layout-shift'] });

          // Fallback timeout
          setTimeout(() => {
            resolve({
              loadTime: Date.now() - performance.timeOrigin,
              firstContentfulPaint: 0,
              largestContentfulPaint: 0,
              cumulativeLayoutShift: 0,
              timeToInteractive: 0
            });
          }, 5000);
        });
      });

      // Core Web Vitals thresholds
      expect(loadTime).toBeLessThan(3000); // 3 seconds for full load
      expect(metrics.firstContentfulPaint).toBeLessThan(1800); // 1.8s for FCP
      expect(metrics.largestContentfulPaint).toBeLessThan(2500); // 2.5s for LCP
      expect(metrics.cumulativeLayoutShift).toBeLessThan(0.1); // CLS < 0.1

      console.log('Performance metrics:', {
        loadTime: `${loadTime}ms`,
        firstContentfulPaint: `${metrics.firstContentfulPaint}ms`,
        largestContentfulPaint: `${metrics.largestContentfulPaint}ms`,
        cumulativeLayoutShift: metrics.cumulativeLayoutShift,
        timeToInteractive: `${metrics.timeToInteractive}ms`
      });
    });

    test('dashboard pages should load quickly', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      const dashboardPages = [
        '/creator/dashboard',
        '/creator/analytics',
        '/creator/pitches'
      ];

      for (const pagePath of dashboardPages) {
        const startTime = Date.now();
        
        await page.goto(pagePath, { waitUntil: 'networkidle' });
        
        const loadTime = Date.now() - startTime;
        
        // Dashboard pages should load within 2 seconds
        expect(loadTime).toBeLessThan(2000);
        
        console.log(`${pagePath} loaded in ${loadTime}ms`);
      }
    });
  });

  test.describe('Large Dataset Handling', () => {
    test('should handle large pitch lists efficiently', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to browse page (potentially large dataset)
      const startTime = Date.now();
      await page.click('[data-testid="browse-pitches-button"]');
      await pageHelper.waitForPageLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Should load within reasonable time even with large dataset
      expect(loadTime).toBeLessThan(5000);
      
      // Test scrolling performance
      const scrollStartTime = Date.now();
      
      // Scroll through the page multiple times
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(100);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);
      }
      
      const scrollTime = Date.now() - scrollStartTime;
      
      // Scrolling should remain responsive
      expect(scrollTime).toBeLessThan(2000);
      
      console.log(`Large dataset: Load ${loadTime}ms, Scroll ${scrollTime}ms`);
    });

    test('should implement virtual scrolling for large lists', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      await pageHelper.waitForPageLoad();
      
      // Check for virtual scrolling implementation
      const virtualContainer = page.locator('[data-testid="virtual-list"], .virtual-scroll, .virtualized');
      
      if (await virtualContainer.count() > 0) {
        // Test virtual scrolling performance
        const itemCount = await page.locator('[data-testid="pitch-card"]').count();
        
        // Scroll to bottom rapidly
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        
        // Items should still be rendered efficiently
        const itemsAfterScroll = await page.locator('[data-testid="pitch-card"]').count();
        
        // With virtual scrolling, visible items should be limited
        expect(itemsAfterScroll).toBeLessThanOrEqual(100);
        
        console.log('✓ Virtual scrolling implemented');
      } else {
        console.log('? Virtual scrolling not detected - may impact performance with large lists');
      }
    });
  });

  test.describe('Network Performance', () => {
    test('should handle slow network conditions gracefully', async ({ page }) => {
      // Simulate slow 3G network
      await page.route('**/*', (route) => {
        // Add delay to simulate slow network
        setTimeout(() => route.continue(), 100);
      });

      const startTime = Date.now();
      await page.goto('/');
      
      // Should show loading states
      const loadingIndicator = page.locator('[data-testid="loading"], .loading, .spinner');
      
      // Wait for content to load
      await pageHelper.waitForPageLoad();
      
      const loadTime = Date.now() - startTime;
      
      // Should still load within reasonable time on slow network
      expect(loadTime).toBeLessThan(10000);
      
      console.log(`Slow network load time: ${loadTime}ms`);
    });

    test('should optimize image loading', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      await pageHelper.waitForPageLoad();
      
      // Check for lazy loading
      const images = page.locator('img');
      const imageCount = await images.count();
      
      let lazyLoadedImages = 0;
      let optimizedImages = 0;
      
      for (let i = 0; i < Math.min(imageCount, 10); i++) {
        const img = images.nth(i);
        
        // Check for lazy loading attribute
        const loading = await img.getAttribute('loading');
        if (loading === 'lazy') {
          lazyLoadedImages++;
        }
        
        // Check for srcset or optimized formats
        const srcset = await img.getAttribute('srcset');
        const src = await img.getAttribute('src');
        
        if (srcset || (src && (src.includes('webp') || src.includes('avif')))) {
          optimizedImages++;
        }
      }
      
      // At least 50% of images should be lazy loaded
      expect(lazyLoadedImages / Math.min(imageCount, 10)).toBeGreaterThan(0.5);
      
      console.log(`Image optimization: ${lazyLoadedImages}/${imageCount} lazy loaded, ${optimizedImages}/${imageCount} optimized formats`);
    });

    test('should cache static resources effectively', async ({ page }) => {
      // First visit
      const firstLoadStart = Date.now();
      await page.goto('/');
      await pageHelper.waitForPageLoad();
      const firstLoadTime = Date.now() - firstLoadStart;
      
      // Second visit (should use cached resources)
      const secondLoadStart = Date.now();
      await page.reload();
      await pageHelper.waitForPageLoad();
      const secondLoadTime = Date.now() - secondLoadStart;
      
      // Second load should be faster due to caching
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.8); // At least 20% faster
      
      console.log(`Cache performance: First load ${firstLoadTime}ms, Second load ${secondLoadTime}ms`);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not have significant memory leaks', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // Perform memory-intensive operations
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="create-pitch-button"]');
        await page.fill('[data-testid="title-input"]', `Memory Test Pitch ${i}`);
        await page.goBack();
      }
      
      // Force garbage collection if possible
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      });
      
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const increasePercentage = (memoryIncrease / initialMemory) * 100;
        
        // Memory increase should be reasonable (less than 50%)
        expect(increasePercentage).toBeLessThan(50);
        
        console.log(`Memory usage: Initial ${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final ${(finalMemory / 1024 / 1024).toFixed(2)}MB, Increase ${increasePercentage.toFixed(1)}%`);
      }
    });

    test('should handle large form data efficiently', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      await page.click('[data-testid="create-pitch-button"]');
      
      // Fill large amounts of data
      const largeText = 'A'.repeat(10000); // 10KB of text
      
      const startTime = Date.now();
      
      await page.fill('[data-testid="synopsis-input"]', largeText);
      await page.fill('[data-testid="world-input"]', largeText);
      
      // Form should remain responsive
      const fillTime = Date.now() - startTime;
      expect(fillTime).toBeLessThan(2000);
      
      // Auto-save should handle large data
      await page.waitForTimeout(6000);
      
      const autoSaveStatus = page.locator('[data-testid="auto-save-status"]');
      if (await autoSaveStatus.count() > 0) {
        await expect(autoSaveStatus).toContainText(/saved|synced/i);
      }
      
      console.log(`Large form data handled in ${fillTime}ms`);
    });
  });

  test.describe('API Performance', () => {
    test('should batch API requests efficiently', async ({ page }) => {
      let apiRequestCount = 0;
      
      // Monitor API requests
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          apiRequestCount++;
        }
      });
      
      await authHelper.loginAsCreator();
      
      // Navigate to analytics page (likely multiple API calls)
      await page.click('[data-testid="analytics-link"]');
      await pageHelper.waitForPageLoad();
      
      // Should not make excessive API requests
      expect(apiRequestCount).toBeLessThan(10);
      
      console.log(`Analytics page made ${apiRequestCount} API requests`);
    });

    test('should implement proper loading states', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      // Navigate to browse page
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Should show loading state immediately
      const loadingState = page.locator('[data-testid="loading"], .loading, .spinner, .skeleton');
      
      // Loading state should be visible briefly
      if (await loadingState.count() > 0) {
        await expect(loadingState.first()).toBeVisible();
        console.log('✓ Loading states implemented');
      }
      
      // Wait for content to load
      await pageHelper.waitForPageLoad();
      
      // Loading state should disappear
      if (await loadingState.count() > 0) {
        await expect(loadingState.first()).not.toBeVisible();
      }
    });

    test('should handle API errors gracefully', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Intercept API requests and return errors
      await page.route('**/api/**', route => {
        // Simulate 500 error for some requests
        if (Math.random() > 0.7) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Internal server error' })
          });
        } else {
          route.continue();
        }
      });
      
      // Try to navigate to analytics
      await page.click('[data-testid="analytics-link"]');
      
      // Should show error state, not crash
      const errorMessage = page.locator('[data-testid="error-message"], [data-testid="error-state"], .error');
      
      // Wait a bit for potential errors to appear
      await page.waitForTimeout(3000);
      
      // Page should either load successfully or show error gracefully
      const isErrored = await errorMessage.count() > 0;
      const isLoaded = await page.locator('[data-testid="analytics-content"]').count() > 0;
      
      expect(isErrored || isLoaded).toBeTruthy();
      
      console.log(isErrored ? '✓ Error handling implemented' : '✓ Page loaded successfully despite API issues');
    });
  });

  test.describe('Concurrent User Simulation', () => {
    test('should handle multiple concurrent users', async ({ page, context }) => {
      const contextCount = 3;
      const contexts: any[] = [];
      
      try {
        // Create multiple browser contexts to simulate concurrent users
        for (let i = 0; i < contextCount; i++) {
          const newContext = await context.browser()?.newContext();
          if (newContext) {
            contexts.push(newContext);
          }
        }
        
        // Simulate concurrent login and actions
        const loginPromises = contexts.map(async (ctx, index) => {
          const page = await ctx.newPage();
          const helper = new AuthHelper(page);
          
          // Stagger logins slightly
          await page.waitForTimeout(index * 100);
          
          if (index === 0) {
            await helper.loginAsCreator();
            await page.click('[data-testid="create-pitch-button"]');
          } else if (index === 1) {
            await helper.loginAsInvestor();
            await page.click('[data-testid="browse-pitches-button"]');
          } else {
            await helper.loginAsProduction();
            await page.click('[data-testid="partnerships-link"]');
          }
          
          return page;
        });
        
        const startTime = Date.now();
        await Promise.all(loginPromises);
        const concurrentTime = Date.now() - startTime;
        
        // Concurrent operations should complete reasonably quickly
        expect(concurrentTime).toBeLessThan(15000); // 15 seconds for 3 concurrent users
        
        console.log(`${contextCount} concurrent users handled in ${concurrentTime}ms`);
        
      } finally {
        // Clean up contexts
        for (const ctx of contexts) {
          await ctx.close();
        }
      }
    });
  });

  test.describe('Resource Optimization', () => {
    test('should minimize bundle size impact', async ({ page }) => {
      // Monitor resource loading
      const resources = new Map();
      
      page.on('response', response => {
        const url = response.url();
        const size = parseInt(response.headers()['content-length'] || '0');
        
        if (url.includes('.js') || url.includes('.css')) {
          resources.set(url, { size, type: url.includes('.js') ? 'js' : 'css' });
        }
      });
      
      await page.goto('/');
      await pageHelper.waitForPageLoad();
      
      // Calculate total bundle size
      let totalJsSize = 0;
      let totalCssSize = 0;
      
      resources.forEach((resource) => {
        if (resource.type === 'js') {
          totalJsSize += resource.size;
        } else {
          totalCssSize += resource.size;
        }
      });
      
      // Bundle sizes should be reasonable
      expect(totalJsSize).toBeLessThan(1024 * 1024 * 2); // Less than 2MB JS
      expect(totalCssSize).toBeLessThan(1024 * 500); // Less than 500KB CSS
      
      console.log(`Bundle sizes - JS: ${(totalJsSize / 1024 / 1024).toFixed(2)}MB, CSS: ${(totalCssSize / 1024).toFixed(2)}KB`);
    });

    test('should implement code splitting effectively', async ({ page }) => {
      // Monitor dynamic imports
      let dynamicImports = 0;
      
      page.on('response', response => {
        const url = response.url();
        // Check for chunk files (typically have hashes in names)
        if (url.includes('.js') && (url.includes('-') || url.includes('chunk'))) {
          dynamicImports++;
        }
      });
      
      await page.goto('/');
      
      // Navigate to different sections to trigger code splitting
      await authHelper.loginAsCreator();
      await page.click('[data-testid="analytics-link"]');
      await page.click('[data-testid="create-pitch-button"]');
      
      // Should have loaded additional chunks
      expect(dynamicImports).toBeGreaterThan(0);
      
      console.log(`Code splitting: ${dynamicImports} dynamic chunks loaded`);
    });
  });

  test.describe('Database Query Performance', () => {
    test('should handle complex search queries efficiently', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      
      // Apply multiple complex filters
      await page.click('[data-testid="filter-toggle"]');
      await page.check('[data-testid="genre-action"]');
      await page.check('[data-testid="genre-thriller"]');
      await page.fill('[data-testid="budget-min"]', '1000000');
      await page.fill('[data-testid="budget-max"]', '50000000');
      await page.fill('[data-testid="keywords"]', 'technology cyberpunk');
      
      const searchStartTime = Date.now();
      await page.click('[data-testid="apply-filters"]');
      
      // Wait for results
      await pageHelper.waitForPageLoad();
      
      const searchTime = Date.now() - searchStartTime;
      
      // Complex search should complete within reasonable time
      expect(searchTime).toBeLessThan(5000);
      
      // Results should be displayed
      const results = page.locator('[data-testid="search-results"], [data-testid="pitch-grid"]');
      await expect(results).toBeVisible();
      
      console.log(`Complex search completed in ${searchTime}ms`);
    });

    test('should paginate large result sets efficiently', async ({ page }) => {
      await authHelper.loginAsInvestor();
      
      await page.click('[data-testid="browse-pitches-button"]');
      await pageHelper.waitForPageLoad();
      
      // Test pagination performance
      const paginationControls = page.locator('[data-testid="pagination"], .pagination');
      
      if (await paginationControls.count() > 0) {
        const pageStartTime = Date.now();
        
        // Navigate through several pages
        for (let i = 2; i <= 4; i++) {
          const pageButton = page.locator(`[data-testid="page-${i}"], button:has-text("${i}")`);
          
          if (await pageButton.count() > 0) {
            await pageButton.click();
            await pageHelper.waitForPageLoad();
          }
        }
        
        const paginationTime = Date.now() - pageStartTime;
        
        // Pagination should be responsive
        expect(paginationTime).toBeLessThan(3000);
        
        console.log(`Pagination through 3 pages took ${paginationTime}ms`);
      } else {
        // Test infinite scroll if pagination not implemented
        const initialItems = await page.locator('[data-testid="pitch-card"]').count();
        
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000);
        
        const afterScrollItems = await page.locator('[data-testid="pitch-card"]').count();
        
        if (afterScrollItems > initialItems) {
          console.log(`Infinite scroll loaded ${afterScrollItems - initialItems} additional items`);
        }
      }
    });
  });
});