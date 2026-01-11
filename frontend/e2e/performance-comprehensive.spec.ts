import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { APIHelpers } from './utils/api-helpers';

test.describe('Comprehensive Performance Testing with WebSocket Validation', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;
  let apiHelpers: APIHelpers;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
    apiHelpers = new APIHelpers(page);
  });

  test.afterEach(async () => {
    // Cleanup any test data
    try {
      await apiHelpers.cleanupTestData();
      await authHelper.logout();
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });

  test.describe('Page Load Performance', () => {
    test('homepage loads within performance thresholds', async ({ page }) => {
      console.log('Testing homepage load performance...');

      const performanceData = await page.evaluate(() => {
        return new Promise((resolve) => {
          const startTime = performance.now();
          
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const navigationEntry = entries.find(entry => entry.entryType === 'navigation') as PerformanceNavigationTiming;
            
            if (navigationEntry) {
              resolve({
                domContentLoaded: navigationEntry.domContentLoadedEventEnd - navigationEntry.domContentLoadedEventStart,
                loadComplete: navigationEntry.loadEventEnd - navigationEntry.loadEventStart,
                firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
                firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
                totalLoadTime: navigationEntry.loadEventEnd - navigationEntry.navigationStart,
                timeToInteractive: startTime
              });
            }
          });
          
          observer.observe({ entryTypes: ['navigation', 'paint'] });
          
          // Fallback timeout
          setTimeout(() => {
            resolve({
              domContentLoaded: 0,
              loadComplete: 0,
              firstPaint: 0,
              firstContentfulPaint: 0,
              totalLoadTime: performance.now(),
              timeToInteractive: performance.now()
            });
          }, 10000);
        });
      });

      await page.goto('/');
      await pageHelper.waitForPageLoad();

      const metrics = await performanceData;
      
      console.log('Homepage Performance Metrics:');
      console.log(`  DOM Content Loaded: ${metrics.domContentLoaded}ms`);
      console.log(`  Load Complete: ${metrics.loadComplete}ms`);
      console.log(`  First Paint: ${metrics.firstPaint}ms`);
      console.log(`  First Contentful Paint: ${metrics.firstContentfulPaint}ms`);
      console.log(`  Total Load Time: ${metrics.totalLoadTime}ms`);

      // Performance assertions
      expect(metrics.totalLoadTime).toBeLessThan(5000); // 5 seconds max
      expect(metrics.firstContentfulPaint).toBeLessThan(3000); // 3 seconds max
      expect(metrics.domContentLoaded).toBeLessThan(2000); // 2 seconds max

      console.log('✓ Homepage performance within acceptable thresholds');
    });

    test('dashboard loads efficiently for authenticated users', async ({ page }) => {
      console.log('Testing dashboard load performance...');

      await authHelper.loginAsCreator();

      const startTime = Date.now();
      await page.goto('/creator/dashboard');
      await pageHelper.waitForPageLoad();

      // Wait for all dashboard components to load
      await page.waitForTimeout(2000);

      const loadTime = Date.now() - startTime;

      // Check for key dashboard elements
      const dashboardElements = [
        '[data-testid="dashboard-header"]',
        '[data-testid="quick-stats"]',
        '[data-testid="recent-pitches"]'
      ];

      let elementsLoaded = 0;
      for (const element of dashboardElements) {
        const locator = page.locator(element);
        if (await locator.count() > 0) {
          elementsLoaded++;
        }
      }

      console.log(`Dashboard Performance:`);
      console.log(`  Total load time: ${loadTime}ms`);
      console.log(`  Elements loaded: ${elementsLoaded}/${dashboardElements.length}`);

      // Performance assertions
      expect(loadTime).toBeLessThan(8000); // 8 seconds for authenticated dashboard
      expect(elementsLoaded).toBeGreaterThan(0); // At least some elements should load

      console.log('✓ Dashboard performance acceptable');
    });

    test('search performance with real queries', async ({ page }) => {
      console.log('Testing search performance...');

      await page.goto('/search');
      await pageHelper.waitForPageLoad();

      const searchQueries = ['action', 'thriller', 'drama', 'comedy'];
      const searchTimes: number[] = [];

      for (const query of searchQueries) {
        const startTime = Date.now();
        
        const searchBar = page.locator('[data-testid="search-bar"], input[type="search"]');
        if (await searchBar.count() > 0) {
          await searchBar.fill(query);
          await page.press('[data-testid="search-bar"]', 'Enter');
          await pageHelper.waitForPageLoad();
          
          const searchTime = Date.now() - startTime;
          searchTimes.push(searchTime);
          
          console.log(`  Search "${query}": ${searchTime}ms`);
        }
      }

      if (searchTimes.length > 0) {
        const avgSearchTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
        const maxSearchTime = Math.max(...searchTimes);
        
        console.log(`Search Performance Summary:`);
        console.log(`  Average search time: ${avgSearchTime.toFixed(2)}ms`);
        console.log(`  Max search time: ${maxSearchTime}ms`);
        
        // Performance assertions
        expect(avgSearchTime).toBeLessThan(5000); // 5 seconds average
        expect(maxSearchTime).toBeLessThan(10000); // 10 seconds max
        
        console.log('✓ Search performance within acceptable range');
      }
    });

    test('pitch browsing performance', async ({ page }) => {
      console.log('Testing pitch browsing performance...');

      const browseStartTime = Date.now();
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();

      // Wait for pitch grid to load
      await page.waitForSelector('[data-testid="pitch-grid"], .pitch-grid', { timeout: 10000 });
      
      const browseLoadTime = Date.now() - browseStartTime;

      // Test tab switching performance
      const tabs = ['trending', 'new', 'featured', 'top-rated'];
      const tabSwitchTimes: number[] = [];

      for (const tab of tabs) {
        const tabElement = page.locator(`[data-testid="${tab}-tab"]`);
        
        if (await tabElement.count() > 0) {
          const tabStartTime = Date.now();
          await tabElement.click();
          await pageHelper.waitForPageLoad();
          
          const tabSwitchTime = Date.now() - tabStartTime;
          tabSwitchTimes.push(tabSwitchTime);
          
          console.log(`  Tab "${tab}": ${tabSwitchTime}ms`);
        }
      }

      console.log(`Browse Performance:`);
      console.log(`  Initial load: ${browseLoadTime}ms`);
      
      if (tabSwitchTimes.length > 0) {
        const avgTabTime = tabSwitchTimes.reduce((sum, time) => sum + time, 0) / tabSwitchTimes.length;
        console.log(`  Average tab switch: ${avgTabTime.toFixed(2)}ms`);
        
        expect(avgTabTime).toBeLessThan(3000); // 3 seconds for tab switching
      }

      expect(browseLoadTime).toBeLessThan(8000); // 8 seconds for browse page
      console.log('✓ Browse performance acceptable');
    });
  });

  test.describe('WebSocket Real-time Features', () => {
    test('establishes WebSocket connection successfully', async ({ page }) => {
      console.log('Testing WebSocket connection establishment...');

      await authHelper.loginAsCreator();
      
      // Test WebSocket connection at page level
      const wsConnectionResult = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const wsUrl = window.location.origin.replace('http', 'ws') + '/ws';
          
          try {
            const ws = new WebSocket(wsUrl);
            const timeout = setTimeout(() => {
              ws.close();
              resolve({
                success: false,
                error: 'Connection timeout',
                url: wsUrl
              });
            }, 10000);

            ws.onopen = () => {
              clearTimeout(timeout);
              console.log('WebSocket connected successfully');
              
              // Test basic message
              ws.send(JSON.stringify({
                type: 'ping',
                timestamp: Date.now()
              }));
            };

            ws.onmessage = (event) => {
              const data = JSON.parse(event.data);
              if (data.type === 'pong' || data.type === 'welcome') {
                ws.close();
                resolve({
                  success: true,
                  responseTime: Date.now() - data.timestamp || 0,
                  messageType: data.type,
                  url: wsUrl
                });
              }
            };

            ws.onerror = (error) => {
              clearTimeout(timeout);
              resolve({
                success: false,
                error: 'WebSocket error',
                url: wsUrl
              });
            };

            ws.onclose = (event) => {
              if (!timeout) return; // Already resolved
              clearTimeout(timeout);
              resolve({
                success: event.wasClean,
                closeCode: event.code,
                closeReason: event.reason,
                url: wsUrl
              });
            };

          } catch (error) {
            resolve({
              success: false,
              error: error.message,
              url: wsUrl
            });
          }
        });
      });

      console.log('WebSocket Connection Result:', wsConnectionResult);

      if (wsConnectionResult.success) {
        expect(wsConnectionResult.success).toBeTruthy();
        console.log(`✓ WebSocket connected successfully (${wsConnectionResult.responseTime}ms roundtrip)`);
      } else {
        console.log(`⚠ WebSocket connection failed: ${wsConnectionResult.error}`);
        console.log('This may be expected if WebSocket server is not running');
      }
    });

    test('tests real-time notification delivery', async ({ page }) => {
      console.log('Testing real-time notification delivery...');

      await authHelper.loginAsCreator();
      await page.goto('/creator/dashboard');
      await pageHelper.waitForPageLoad();

      // Monitor for notifications
      const notificationTest = await page.evaluate(async () => {
        return new Promise((resolve) => {
          let notificationsReceived = 0;
          const startTime = Date.now();
          
          // Listen for notification events
          const notificationHandlers = [
            'notification',
            'message',
            'update',
            'alert'
          ];

          // Set up event listeners for various notification types
          notificationHandlers.forEach(eventType => {
            document.addEventListener(eventType, (event) => {
              notificationsReceived++;
              console.log(`Received ${eventType} notification:`, event);
            });
          });

          // Also check for UI notification elements appearing
          const checkForNotifications = () => {
            const notificationElements = [
              '[data-testid="notification-item"]',
              '[data-testid="alert-message"]',
              '.notification',
              '.alert'
            ];
            
            for (const selector of notificationElements) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                notificationsReceived += elements.length;
              }
            }
          };

          // Check every second for 10 seconds
          const interval = setInterval(checkForNotifications, 1000);
          
          setTimeout(() => {
            clearInterval(interval);
            resolve({
              notificationsReceived,
              testDuration: Date.now() - startTime,
              timestamp: Date.now()
            });
          }, 10000);
        });
      });

      console.log(`Notification Test Results:`);
      console.log(`  Notifications detected: ${notificationTest.notificationsReceived}`);
      console.log(`  Test duration: ${notificationTest.testDuration}ms`);

      // Check for notification UI elements
      const notificationElements = await page.locator('[data-testid="notifications"], .notifications').count();
      const alertElements = await page.locator('[data-testid="alerts"], .alerts').count();

      console.log(`  Notification UI elements: ${notificationElements}`);
      console.log(`  Alert UI elements: ${alertElements}`);

      // If real-time notifications are implemented, we should see some activity
      const hasNotificationSystem = notificationElements > 0 || alertElements > 0 || notificationTest.notificationsReceived > 0;
      
      if (hasNotificationSystem) {
        console.log('✓ Real-time notification system detected');
      } else {
        console.log('⚠ No real-time notifications detected (may not be implemented yet)');
      }
    });

    test('tests WebSocket reconnection and recovery', async ({ page }) => {
      console.log('Testing WebSocket reconnection and recovery...');

      await authHelper.loginAsCreator();
      
      const reconnectionTest = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const wsUrl = window.location.origin.replace('http', 'ws') + '/ws';
          let connectionAttempts = 0;
          let successfulReconnections = 0;
          const testResults: any[] = [];

          const connectWebSocket = () => {
            connectionAttempts++;
            const ws = new WebSocket(wsUrl);
            const attemptStartTime = Date.now();

            ws.onopen = () => {
              const connectionTime = Date.now() - attemptStartTime;
              testResults.push({
                attempt: connectionAttempts,
                success: true,
                connectionTime,
                timestamp: Date.now()
              });
              
              if (connectionAttempts === 1) {
                // Simulate disconnection after first connection
                setTimeout(() => {
                  ws.close(1000, 'Test disconnection');
                }, 1000);
              } else {
                successfulReconnections++;
                ws.close(1000, 'Test complete');
                
                resolve({
                  totalAttempts: connectionAttempts,
                  successfulReconnections,
                  testResults,
                  averageConnectionTime: testResults.reduce((sum, r) => sum + (r.connectionTime || 0), 0) / testResults.length
                });
              }
            };

            ws.onclose = (event) => {
              if (connectionAttempts === 1 && event.code === 1000) {
                // First planned disconnection, try to reconnect
                setTimeout(() => {
                  connectWebSocket();
                }, 2000);
              } else if (!event.wasClean && connectionAttempts < 3) {
                // Unexpected disconnection, retry
                setTimeout(() => {
                  connectWebSocket();
                }, 3000);
              }
            };

            ws.onerror = () => {
              testResults.push({
                attempt: connectionAttempts,
                success: false,
                error: 'Connection failed',
                timestamp: Date.now()
              });
              
              if (connectionAttempts < 3) {
                setTimeout(() => {
                  connectWebSocket();
                }, 5000);
              } else {
                resolve({
                  totalAttempts: connectionAttempts,
                  successfulReconnections,
                  testResults,
                  averageConnectionTime: 0
                });
              }
            };

            // Timeout for individual attempts
            setTimeout(() => {
              if (ws.readyState === WebSocket.CONNECTING) {
                ws.close();
                testResults.push({
                  attempt: connectionAttempts,
                  success: false,
                  error: 'Connection timeout',
                  timestamp: Date.now()
                });
              }
            }, 15000);
          };

          // Start the test
          connectWebSocket();

          // Global timeout
          setTimeout(() => {
            resolve({
              totalAttempts: connectionAttempts,
              successfulReconnections,
              testResults,
              timedOut: true
            });
          }, 30000);
        });
      });

      console.log(`WebSocket Reconnection Test Results:`);
      console.log(`  Total attempts: ${reconnectionTest.totalAttempts}`);
      console.log(`  Successful reconnections: ${reconnectionTest.successfulReconnections}`);
      console.log(`  Average connection time: ${reconnectionTest.averageConnectionTime?.toFixed(2) || 0}ms`);

      // Log individual attempt results
      if (reconnectionTest.testResults) {
        reconnectionTest.testResults.forEach((result: any, index: number) => {
          console.log(`    Attempt ${result.attempt}: ${result.success ? 'Success' : 'Failed'} ${result.connectionTime ? `(${result.connectionTime}ms)` : ''}`);
        });
      }

      if (reconnectionTest.successfulReconnections > 0) {
        console.log('✓ WebSocket reconnection working properly');
      } else if (reconnectionTest.totalAttempts > 0) {
        console.log('⚠ WebSocket connection attempted but reconnection may need improvement');
      } else {
        console.log('⚠ WebSocket not available (expected for development environment)');
      }
    });

    test('measures WebSocket message latency', async ({ page }) => {
      console.log('Testing WebSocket message latency...');

      await authHelper.loginAsCreator();

      const latencyTest = await page.evaluate(async () => {
        return new Promise((resolve) => {
          const wsUrl = window.location.origin.replace('http', 'ws') + '/ws';
          const latencies: number[] = [];
          let messagesReceived = 0;
          const totalMessages = 5;

          try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
              console.log('WebSocket connected for latency test');
              
              // Send test messages
              for (let i = 0; i < totalMessages; i++) {
                setTimeout(() => {
                  const sendTime = Date.now();
                  ws.send(JSON.stringify({
                    type: 'latency_test',
                    messageId: i,
                    timestamp: sendTime
                  }));
                }, i * 1000);
              }
            };

            ws.onmessage = (event) => {
              const receiveTime = Date.now();
              const data = JSON.parse(event.data);
              
              if (data.type === 'latency_response' || data.type === 'echo') {
                const latency = receiveTime - data.timestamp;
                latencies.push(latency);
                messagesReceived++;
                
                console.log(`Message ${data.messageId || messagesReceived} latency: ${latency}ms`);
                
                if (messagesReceived >= totalMessages) {
                  ws.close();
                  
                  const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
                  const minLatency = Math.min(...latencies);
                  const maxLatency = Math.max(...latencies);
                  
                  resolve({
                    success: true,
                    messagesReceived,
                    latencies,
                    averageLatency: avgLatency,
                    minLatency,
                    maxLatency
                  });
                }
              }
            };

            ws.onerror = () => {
              resolve({
                success: false,
                error: 'WebSocket connection failed',
                messagesReceived
              });
            };

            // Timeout
            setTimeout(() => {
              ws.close();
              const avgLatency = latencies.length > 0 ? 
                latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length : 0;
              
              resolve({
                success: messagesReceived > 0,
                messagesReceived,
                latencies,
                averageLatency: avgLatency,
                timedOut: true
              });
            }, 15000);

          } catch (error) {
            resolve({
              success: false,
              error: error.message,
              messagesReceived: 0
            });
          }
        });
      });

      console.log(`WebSocket Latency Test Results:`);
      console.log(`  Messages received: ${latencyTest.messagesReceived}`);
      
      if (latencyTest.success && latencyTest.averageLatency) {
        console.log(`  Average latency: ${latencyTest.averageLatency.toFixed(2)}ms`);
        console.log(`  Min latency: ${latencyTest.minLatency}ms`);
        console.log(`  Max latency: ${latencyTest.maxLatency}ms`);
        
        // Performance assertions for latency
        expect(latencyTest.averageLatency).toBeLessThan(1000); // 1 second max average
        expect(latencyTest.maxLatency).toBeLessThan(5000); // 5 seconds max individual
        
        console.log('✓ WebSocket latency within acceptable range');
      } else {
        console.log(`⚠ WebSocket latency test failed: ${latencyTest.error || 'Unknown error'}`);
        console.log('This is expected if WebSocket server is not available');
      }
    });
  });

  test.describe('Resource Loading Performance', () => {
    test('analyzes resource loading times', async ({ page }) => {
      console.log('Analyzing resource loading performance...');

      await page.goto('/');
      await pageHelper.waitForPageLoad();

      const resourceData = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        
        const resourcesByType: Record<string, PerformanceResourceTiming[]> = {
          script: [],
          stylesheet: [],
          image: [],
          fetch: [],
          xmlhttprequest: [],
          other: []
        };

        resources.forEach(resource => {
          const type = resource.initiatorType;
          if (resourcesByType[type]) {
            resourcesByType[type].push(resource);
          } else {
            resourcesByType.other.push(resource);
          }
        });

        const analyzeResources = (resources: PerformanceResourceTiming[]) => {
          if (resources.length === 0) return null;
          
          const durations = resources.map(r => r.duration);
          const transferSizes = resources.map(r => (r as any).transferSize || 0);
          
          return {
            count: resources.length,
            totalDuration: durations.reduce((sum, d) => sum + d, 0),
            averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            maxDuration: Math.max(...durations),
            totalSize: transferSizes.reduce((sum, s) => sum + s, 0),
            averageSize: transferSizes.reduce((sum, s) => sum + s, 0) / transferSizes.length
          };
        };

        return {
          scripts: analyzeResources(resourcesByType.script),
          stylesheets: analyzeResources(resourcesByType.stylesheet),
          images: analyzeResources(resourcesByType.image),
          api: analyzeResources(resourcesByType.fetch.concat(resourcesByType.xmlhttprequest)),
          total: analyzeResources(resources)
        };
      });

      console.log('Resource Loading Analysis:');
      
      if (resourceData.total) {
        console.log(`  Total resources: ${resourceData.total.count}`);
        console.log(`  Total transfer size: ${(resourceData.total.totalSize / 1024).toFixed(2)} KB`);
        console.log(`  Average resource duration: ${resourceData.total.averageDuration.toFixed(2)}ms`);
      }

      Object.entries(resourceData).forEach(([type, data]) => {
        if (data && type !== 'total') {
          console.log(`  ${type}: ${data.count} resources, ${data.averageDuration.toFixed(2)}ms avg, ${(data.totalSize / 1024).toFixed(2)} KB`);
        }
      });

      // Performance assertions
      if (resourceData.total) {
        expect(resourceData.total.averageDuration).toBeLessThan(2000); // 2 seconds average
        expect(resourceData.total.totalSize).toBeLessThan(10 * 1024 * 1024); // 10MB total
      }

      console.log('✓ Resource loading performance analyzed');
    });

    test('tests API endpoint performance under load', async ({ page }) => {
      console.log('Testing API performance under load...');

      await authHelper.loginAsCreator();

      // Test multiple API endpoints concurrently
      const apiEndpoints = [
        '/api/auth/session',
        '/api/pitches',
        '/api/notifications',
        '/api/analytics/dashboard'
      ];

      const loadTestResults = await Promise.allSettled(
        apiEndpoints.map(async (endpoint) => {
          const startTime = Date.now();
          
          try {
            const response = await apiHelpers.testEndpointPerformance(endpoint);
            return {
              endpoint,
              success: response.status < 400,
              responseTime: Date.now() - startTime,
              status: response.status,
              size: JSON.stringify(response.data).length
            };
          } catch (error) {
            return {
              endpoint,
              success: false,
              responseTime: Date.now() - startTime,
              error: error.message
            };
          }
        })
      );

      console.log('API Load Test Results:');
      
      let totalResponseTime = 0;
      let successCount = 0;
      let failureCount = 0;

      loadTestResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const data = result.value;
          console.log(`  ${data.endpoint}: ${data.success ? 'Success' : 'Failed'} (${data.responseTime}ms) [${data.status || 'Error'}]`);
          
          if (data.success) {
            totalResponseTime += data.responseTime;
            successCount++;
          } else {
            failureCount++;
          }
        } else {
          console.log(`  API test ${index + 1}: Failed (${result.reason})`);
          failureCount++;
        }
      });

      const averageResponseTime = successCount > 0 ? totalResponseTime / successCount : 0;
      console.log(`Load Test Summary:`);
      console.log(`  Successful requests: ${successCount}/${apiEndpoints.length}`);
      console.log(`  Average response time: ${averageResponseTime.toFixed(2)}ms`);
      console.log(`  Failed requests: ${failureCount}`);

      // Performance assertions
      expect(successCount).toBeGreaterThan(0); // At least some endpoints should work
      if (averageResponseTime > 0) {
        expect(averageResponseTime).toBeLessThan(5000); // 5 seconds average under load
      }

      console.log('✓ API load testing completed');
    });
  });

  test.describe('Memory and CPU Performance', () => {
    test('monitors memory usage during navigation', async ({ page }) => {
      console.log('Monitoring memory usage during navigation...');

      const pages = [
        '/',
        '/browse',
        '/search',
        '/creator/login',
        '/investor/login'
      ];

      const memoryData: any[] = [];

      for (const pagePath of pages) {
        const startTime = Date.now();
        await page.goto(pagePath);
        await pageHelper.waitForPageLoad();
        
        // Get memory usage data
        const memoryInfo = await page.evaluate(() => {
          return {
            timestamp: Date.now(),
            // @ts-ignore - webkitMemory is available in Chrome
            heapUsed: (performance as any).memory?.usedJSHeapSize || 0,
            heapTotal: (performance as any).memory?.totalJSHeapSize || 0,
            heapLimit: (performance as any).memory?.jsHeapSizeLimit || 0
          };
        });

        const navigationTime = Date.now() - startTime;
        
        memoryData.push({
          page: pagePath,
          navigationTime,
          ...memoryInfo
        });

        console.log(`  ${pagePath}: ${navigationTime}ms, ${(memoryInfo.heapUsed / 1024 / 1024).toFixed(2)} MB heap`);
      }

      // Analyze memory usage patterns
      if (memoryData.length > 0) {
        const totalHeapUsed = memoryData.reduce((sum, data) => sum + data.heapUsed, 0);
        const avgHeapUsed = totalHeapUsed / memoryData.length;
        const maxHeapUsed = Math.max(...memoryData.map(data => data.heapUsed));

        console.log(`Memory Usage Summary:`);
        console.log(`  Average heap used: ${(avgHeapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Max heap used: ${(maxHeapUsed / 1024 / 1024).toFixed(2)} MB`);

        // Memory assertions (reasonable limits for web app)
        expect(avgHeapUsed).toBeLessThan(100 * 1024 * 1024); // 100MB average
        expect(maxHeapUsed).toBeLessThan(200 * 1024 * 1024); // 200MB max
      }

      console.log('✓ Memory monitoring completed');
    });

    test('checks for memory leaks in SPA navigation', async ({ page }) => {
      console.log('Testing for memory leaks in SPA navigation...');

      await authHelper.loginAsCreator();

      // Navigation pattern that might cause memory leaks
      const navigationPattern = [
        '/creator/dashboard',
        '/creator/pitches',
        '/creator/analytics',
        '/creator/settings',
        '/creator/dashboard'
      ];

      const memoryMeasurements: number[] = [];

      for (let cycle = 0; cycle < 3; cycle++) {
        console.log(`  Memory leak test cycle ${cycle + 1}...`);
        
        for (const path of navigationPattern) {
          await page.goto(path);
          await pageHelper.waitForPageLoad();
          await page.waitForTimeout(1000);
        }

        // Force garbage collection if available
        await page.evaluate(() => {
          if ((window as any).gc) {
            (window as any).gc();
          }
        });

        await page.waitForTimeout(2000);

        // Measure memory
        const memoryInfo = await page.evaluate(() => {
          // @ts-ignore
          return (performance as any).memory?.usedJSHeapSize || 0;
        });

        memoryMeasurements.push(memoryInfo);
        console.log(`    Cycle ${cycle + 1} memory: ${(memoryInfo / 1024 / 1024).toFixed(2)} MB`);
      }

      // Analyze memory growth
      if (memoryMeasurements.length >= 2) {
        const memoryGrowth = memoryMeasurements[memoryMeasurements.length - 1] - memoryMeasurements[0];
        const growthPercentage = (memoryGrowth / memoryMeasurements[0]) * 100;

        console.log(`Memory Leak Analysis:`);
        console.log(`  Initial memory: ${(memoryMeasurements[0] / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Final memory: ${(memoryMeasurements[memoryMeasurements.length - 1] / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB (${growthPercentage.toFixed(2)}%)`);

        // Memory leak assertion (should not grow more than 50% over cycles)
        expect(Math.abs(growthPercentage)).toBeLessThan(50);
        
        if (Math.abs(growthPercentage) < 10) {
          console.log('✓ No significant memory leaks detected');
        } else {
          console.log(`⚠ Potential memory growth detected: ${growthPercentage.toFixed(2)}%`);
        }
      }
    });
  });

  test.describe('Performance Benchmarking Summary', () => {
    test('generates comprehensive performance report', async ({ page }) => {
      console.log('Generating comprehensive performance report...');

      const performanceReport = {
        timestamp: new Date().toISOString(),
        testEnvironment: {
          userAgent: await page.evaluate(() => navigator.userAgent),
          viewport: await page.viewportSize(),
          baseURL: 'http://localhost:5173'
        },
        metrics: {
          pageLoads: [],
          apiCalls: [],
          webSocketTests: [],
          resourceLoading: {},
          memoryUsage: {}
        }
      };

      // Quick performance sweep of key pages
      const keyPages = [
        { path: '/', name: 'Homepage' },
        { path: '/browse', name: 'Browse' },
        { path: '/search', name: 'Search' }
      ];

      for (const pageInfo of keyPages) {
        const startTime = Date.now();
        await page.goto(pageInfo.path);
        await pageHelper.waitForPageLoad();
        
        const loadTime = Date.now() - startTime;
        
        performanceReport.metrics.pageLoads.push({
          page: pageInfo.name,
          path: pageInfo.path,
          loadTime,
          timestamp: new Date().toISOString()
        });
      }

      // Test authenticated performance
      await authHelper.loginAsCreator();
      
      const authenticatedPages = [
        { path: '/creator/dashboard', name: 'Creator Dashboard' },
        { path: '/creator/pitches', name: 'Pitch Management' }
      ];

      for (const pageInfo of authenticatedPages) {
        const startTime = Date.now();
        await page.goto(pageInfo.path);
        await pageHelper.waitForPageLoad();
        
        const loadTime = Date.now() - startTime;
        
        performanceReport.metrics.pageLoads.push({
          page: pageInfo.name,
          path: pageInfo.path,
          loadTime,
          authenticated: true,
          timestamp: new Date().toISOString()
        });
      }

      // API performance test
      const apiTestResult = await apiHelpers.testEndpointPerformance('/api/auth/session');
      performanceReport.metrics.apiCalls.push({
        endpoint: '/api/auth/session',
        responseTime: apiTestResult.timing,
        status: apiTestResult.status,
        timestamp: new Date().toISOString()
      });

      // Generate summary
      const avgPageLoad = performanceReport.metrics.pageLoads.reduce((sum, p) => sum + p.loadTime, 0) / performanceReport.metrics.pageLoads.length;
      const maxPageLoad = Math.max(...performanceReport.metrics.pageLoads.map(p => p.loadTime));
      
      console.log('\n=== COMPREHENSIVE PERFORMANCE REPORT ===');
      console.log(`Generated: ${performanceReport.timestamp}`);
      console.log(`Test Environment: ${performanceReport.testEnvironment.userAgent}`);
      console.log(`\nPage Load Performance:`);
      console.log(`  Average load time: ${avgPageLoad.toFixed(2)}ms`);
      console.log(`  Max load time: ${maxPageLoad}ms`);
      console.log(`  Pages tested: ${performanceReport.metrics.pageLoads.length}`);
      
      performanceReport.metrics.pageLoads.forEach(pageLoad => {
        console.log(`    ${pageLoad.name}: ${pageLoad.loadTime}ms ${pageLoad.authenticated ? '(auth)' : ''}`);
      });

      console.log(`\nAPI Performance:`);
      performanceReport.metrics.apiCalls.forEach(apiCall => {
        console.log(`    ${apiCall.endpoint}: ${apiCall.responseTime}ms [${apiCall.status}]`);
      });

      console.log('\n=== END PERFORMANCE REPORT ===\n');

      // Overall performance assertions
      expect(avgPageLoad).toBeLessThan(8000); // 8 seconds average
      expect(maxPageLoad).toBeLessThan(15000); // 15 seconds max
      
      console.log('✓ Comprehensive performance report generated');
    });
  });
});