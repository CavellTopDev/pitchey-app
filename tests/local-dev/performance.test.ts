/**
 * Performance Test Suite
 * Tests response times, throughput, and resource usage
 */

import { TestSuite, TestFramework } from "../../src/testing/test-framework.ts";
import { LOCAL_CONFIG } from "./run-all-tests.ts";

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const performanceSuite: TestSuite = {
  name: "Performance Tests",
  description: "Validate response times, throughput, and system performance",
  
  tests: [
    {
      id: "api_response_time_test",
      name: "API endpoint response times",
      description: "Test that API endpoints respond within acceptable time limits",
      category: "performance",
      priority: "high",
      timeout: 30000,
      test: async () => {
        const endpoints = [
          { name: "Health Check", url: `${LOCAL_CONFIG.backend}/health`, maxTime: 200 },
          { name: "API Health", url: `${LOCAL_CONFIG.backend}/api/health`, maxTime: 500 },
          { name: "Browse Pitches", url: `${LOCAL_CONFIG.backend}/api/pitches/browse`, maxTime: 1000 },
          { name: "Search", url: `${LOCAL_CONFIG.backend}/api/search?q=test`, maxTime: 1500 }
        ];

        const results = [];

        try {
          for (const endpoint of endpoints) {
            const measurements = [];
            
            // Take 5 measurements for each endpoint
            for (let i = 0; i < 5; i++) {
              const startTime = performance.now();
              
              try {
                const response = await fetch(endpoint.url);
                const endTime = performance.now();
                const responseTime = endTime - startTime;
                
                measurements.push({
                  attempt: i + 1,
                  responseTime: Math.round(responseTime),
                  status: response.status,
                  success: response.ok
                });

                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 100));
                
              } catch (error: unknown) {
                measurements.push({
                  attempt: i + 1,
                  responseTime: -1,
                  status: 0,
                  success: false,
                  error: (error as Error).message
                });
              }
            }

            // Calculate statistics
            const successfulMeasurements = measurements.filter(m => m.success && m.responseTime > 0);
            const avgResponseTime = successfulMeasurements.length > 0 
              ? Math.round(successfulMeasurements.reduce((sum, m) => sum + m.responseTime, 0) / successfulMeasurements.length)
              : -1;
            
            const maxResponseTime = successfulMeasurements.length > 0
              ? Math.max(...successfulMeasurements.map(m => m.responseTime))
              : -1;

            const minResponseTime = successfulMeasurements.length > 0
              ? Math.min(...successfulMeasurements.map(m => m.responseTime))
              : -1;

            const withinLimit = avgResponseTime > 0 && avgResponseTime <= endpoint.maxTime;
            const successRate = (successfulMeasurements.length / measurements.length) * 100;

            results.push({
              endpoint: endpoint.name,
              url: endpoint.url,
              maxAllowed: endpoint.maxTime + "ms",
              avgResponseTime: avgResponseTime + "ms",
              minResponseTime: minResponseTime + "ms", 
              maxResponseTime: maxResponseTime + "ms",
              successRate: successRate.toFixed(1) + "%",
              withinLimit,
              measurements
            });
          }

          const failedEndpoints = results.filter(r => !r.withinLimit || r.successRate !== "100.0%");
          const overallSuccess = failedEndpoints.length === 0;

          return {
            success: overallSuccess,
            duration: 0,
            message: overallSuccess ? 
              "All API endpoints within performance limits" : 
              `${failedEndpoints.length} endpoint(s) exceeded performance limits`,
            details: {
              results,
              summary: {
                totalEndpoints: endpoints.length,
                withinLimits: results.filter(r => r.withinLimit).length,
                averageResponseTime: Math.round(
                  results
                    .filter(r => r.avgResponseTime !== "-1ms")
                    .reduce((sum, r) => sum + parseInt(r.avgResponseTime), 0) / 
                  results.filter(r => r.avgResponseTime !== "-1ms").length || 1
                ) + "ms"
              },
              failedEndpoints: failedEndpoints.map(e => ({
                name: e.endpoint,
                avgTime: e.avgResponseTime,
                limit: e.maxAllowed,
                successRate: e.successRate
              }))
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `API response time test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "concurrent_request_handling",
      name: "Concurrent request handling",
      description: "Test system performance under concurrent load",
      category: "performance", 
      priority: "high",
      timeout: 45000,
      test: async () => {
        const concurrency = 10;
        const requestsPerClient = 5;
        const testUrl = `${LOCAL_CONFIG.backend}/api/health`;

        try {
          const startTime = performance.now();
          const allRequests = [];

          // Create concurrent clients
          for (let client = 0; client < concurrency; client++) {
            for (let req = 0; req < requestsPerClient; req++) {
              const requestPromise = (async () => {
                const requestStart = performance.now();
                
                try {
                  const response = await fetch(testUrl);
                  const requestEnd = performance.now();
                  
                  return {
                    client,
                    request: req,
                    success: response.ok,
                    status: response.status,
                    responseTime: Math.round(requestEnd - requestStart),
                    timestamp: requestEnd
                  };
                } catch (error: unknown) {
                  const requestEnd = performance.now();
                  return {
                    client,
                    request: req,
                    success: false,
                    status: 0,
                    responseTime: Math.round(requestEnd - requestStart),
                    timestamp: requestEnd,
                    error: (error as Error).message
                  };
                }
              })();

              allRequests.push(requestPromise);
            }
          }

          // Execute all requests concurrently
          const results = await Promise.all(allRequests);
          const endTime = performance.now();
          const totalDuration = Math.round(endTime - startTime);

          // Analyze results
          const successfulRequests = results.filter(r => r.success);
          const failedRequests = results.filter(r => !r.success);
          const avgResponseTime = Math.round(
            successfulRequests.reduce((sum, r) => sum + r.responseTime, 0) / successfulRequests.length
          );
          const maxResponseTime = Math.max(...results.map(r => r.responseTime));
          const minResponseTime = Math.min(...results.map(r => r.responseTime));
          
          const throughput = Math.round((results.length / totalDuration) * 1000); // requests per second
          const successRate = (successfulRequests.length / results.length) * 100;

          // Performance thresholds
          const performanceGood = 
            successRate >= 95 && 
            avgResponseTime <= 1000 && 
            maxResponseTime <= 3000;

          return {
            success: performanceGood,
            duration: totalDuration,
            message: performanceGood ? 
              "Concurrent request handling performance good" : 
              "Performance issues detected under concurrent load",
            details: {
              testConfig: {
                concurrentClients: concurrency,
                requestsPerClient,
                totalRequests: results.length
              },
              performance: {
                totalDuration: totalDuration + "ms",
                avgResponseTime: avgResponseTime + "ms",
                minResponseTime: minResponseTime + "ms",
                maxResponseTime: maxResponseTime + "ms",
                throughput: throughput + " req/sec",
                successRate: successRate.toFixed(1) + "%"
              },
              results: {
                successful: successfulRequests.length,
                failed: failedRequests.length,
                failureReasons: failedRequests.slice(0, 5).map(r => r.error || `Status: ${r.status}`)
              },
              thresholds: {
                successRateThreshold: "95%",
                avgResponseThreshold: "1000ms", 
                maxResponseThreshold: "3000ms",
                meetsThresholds: performanceGood
              }
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Concurrent request handling test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "database_query_performance",
      name: "Database query performance",
      description: "Test database query response times and efficiency",
      category: "performance",
      priority: "medium",
      timeout: 20000,
      test: async () => {
        try {
          const testQueries = [
            {
              name: "Simple Health Check",
              endpoint: `${LOCAL_CONFIG.backend}/api/health`,
              expectedMaxTime: 300
            },
            {
              name: "Pitch Browse Query",
              endpoint: `${LOCAL_CONFIG.backend}/api/pitches/browse`,
              expectedMaxTime: 1000
            },
            {
              name: "Search Query",
              endpoint: `${LOCAL_CONFIG.backend}/api/search?q=drama`,
              expectedMaxTime: 1500
            }
          ];

          const queryResults = [];

          for (const query of testQueries) {
            const measurements = [];

            // Run each query 3 times
            for (let i = 0; i < 3; i++) {
              const startTime = performance.now();

              try {
                const response = await fetch(query.endpoint);
                const endTime = performance.now();
                const queryTime = Math.round(endTime - startTime);

                measurements.push({
                  attempt: i + 1,
                  queryTime,
                  status: response.status,
                  success: response.ok
                });

                // Parse response to check data volume
                if (response.ok) {
                  try {
                    const data = await response.json();
                    const dataSize = JSON.stringify(data).length;
                    measurements[measurements.length - 1].dataSize = dataSize;
                  } catch (parseError) {
                    // Continue without data size info
                  }
                }

                await new Promise(resolve => setTimeout(resolve, 500));

              } catch (error: unknown) {
                measurements.push({
                  attempt: i + 1,
                  queryTime: -1,
                  status: 0,
                  success: false,
                  error: (error as Error).message
                });
              }
            }

            // Calculate query statistics
            const successfulQueries = measurements.filter(m => m.success && m.queryTime > 0);
            const avgQueryTime = successfulQueries.length > 0 
              ? Math.round(successfulQueries.reduce((sum, m) => sum + m.queryTime, 0) / successfulQueries.length)
              : -1;

            const withinExpected = avgQueryTime > 0 && avgQueryTime <= query.expectedMaxTime;
            const avgDataSize = successfulQueries.length > 0
              ? Math.round(successfulQueries
                  .filter(m => m.dataSize)
                  .reduce((sum, m) => sum + m.dataSize, 0) / 
                successfulQueries.filter(m => m.dataSize).length || 1)
              : 0;

            queryResults.push({
              queryName: query.name,
              avgQueryTime: avgQueryTime + "ms",
              expectedMax: query.expectedMaxTime + "ms",
              withinExpected,
              avgDataSize: avgDataSize + " bytes",
              successfulAttempts: successfulQueries.length,
              totalAttempts: measurements.length,
              measurements
            });
          }

          const slowQueries = queryResults.filter(q => !q.withinExpected);
          const overallSuccess = slowQueries.length === 0 && 
            queryResults.every(q => q.successfulAttempts > 0);

          return {
            success: overallSuccess,
            duration: 0,
            message: overallSuccess ? 
              "Database query performance within acceptable limits" : 
              `${slowQueries.length} queries exceeded expected performance`,
            details: {
              queryResults,
              summary: {
                totalQueries: testQueries.length,
                withinLimits: queryResults.filter(q => q.withinExpected).length,
                slowQueries: slowQueries.map(q => ({
                  name: q.queryName,
                  avgTime: q.avgQueryTime,
                  expected: q.expectedMax
                }))
              },
              performanceProfile: {
                fastestAvg: Math.min(...queryResults
                  .filter(q => q.avgQueryTime !== "-1ms")
                  .map(q => parseInt(q.avgQueryTime))) + "ms",
                slowestAvg: Math.max(...queryResults
                  .filter(q => q.avgQueryTime !== "-1ms")
                  .map(q => parseInt(q.avgQueryTime))) + "ms"
              }
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Database query performance test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    },

    {
      id: "memory_usage_monitoring",
      name: "Memory usage monitoring",
      description: "Monitor system memory usage during operations",
      category: "performance",
      priority: "medium",
      timeout: 15000,
      test: async () => {
        try {
          // Get initial memory baseline
          const initialMemory = Deno.memoryUsage();
          const baselineHeap = initialMemory.heapUsed;
          const baselineExternal = initialMemory.external;

          // Perform memory-intensive operations
          const operations = [];
          
          // Operation 1: Multiple API calls
          for (let i = 0; i < 10; i++) {
            operations.push(
              fetch(`${LOCAL_CONFIG.backend}/api/health`)
                .then(res => res.json())
                .catch(() => null)
            );
          }

          await Promise.all(operations);
          const afterApiMemory = Deno.memoryUsage();

          // Operation 2: Create large data structures
          const largeData = new Array(10000).fill(0).map((_, i) => ({
            id: i,
            data: `Test data item ${i}`,
            timestamp: Date.now(),
            properties: {
              index: i,
              category: i % 10,
              description: `Description for item ${i}`
            }
          }));

          const afterDataMemory = Deno.memoryUsage();

          // Clear large data and force garbage collection hint
          largeData.length = 0;
          
          // Wait a moment for potential GC
          await new Promise(resolve => setTimeout(resolve, 2000));
          const finalMemory = Deno.memoryUsage();

          // Calculate memory usage changes
          const apiCallMemoryIncrease = afterApiMemory.heapUsed - baselineHeap;
          const dataCreationMemoryIncrease = afterDataMemory.heapUsed - afterApiMemory.heapUsed;
          const finalMemoryChange = finalMemory.heapUsed - baselineHeap;

          // Memory thresholds (in bytes)
          const memoryLeakThreshold = 10 * 1024 * 1024; // 10MB
          const maxMemoryIncrease = 50 * 1024 * 1024; // 50MB

          const memoryPerformanceGood = 
            Math.abs(finalMemoryChange) < memoryLeakThreshold &&
            afterDataMemory.heapUsed < (baselineHeap + maxMemoryIncrease);

          return {
            success: memoryPerformanceGood,
            duration: 0,
            message: memoryPerformanceGood ? 
              "Memory usage within acceptable limits" : 
              "Potential memory performance issues detected",
            details: {
              memoryMeasurements: {
                baseline: formatBytes(baselineHeap),
                afterApiCalls: formatBytes(afterApiMemory.heapUsed),
                afterDataCreation: formatBytes(afterDataMemory.heapUsed),
                final: formatBytes(finalMemory.heapUsed)
              },
              memoryChanges: {
                apiCallsImpact: formatBytes(apiCallMemoryIncrease),
                dataCreationImpact: formatBytes(dataCreationMemoryIncrease),
                overallChange: formatBytes(finalMemoryChange)
              },
              thresholds: {
                memoryLeakThreshold: formatBytes(memoryLeakThreshold),
                maxMemoryIncrease: formatBytes(maxMemoryIncrease),
                meetsThresholds: memoryPerformanceGood
              },
              systemInfo: {
                rss: formatBytes(finalMemory.rss),
                heapTotal: formatBytes(finalMemory.heapTotal),
                external: formatBytes(finalMemory.external)
              }
            }
          };

        } catch (error: unknown) {
          return {
            success: false,
            duration: 0,
            message: `Memory usage monitoring test failed: ${(error as Error).message}`,
            error
          };
        }
      }
    }
  ]
};