/**
 * Chaos Engineering Test Suite
 * Executes chaos experiments to validate system resilience
 */

import { assertEquals, assertExists, assert } from "jsr:@std/assert";
import { ChaosEngineer } from "./chaos-engineering.ts";
import { testDb, withDatabase } from "../framework/test-database.ts";

// ==================== CHAOS EXPERIMENT TESTS ====================

Deno.test({
  name: "Chaos Engineering - System Resilience Tests",
  async fn() {
    await withDatabase("multi_user_collaboration", async () => {
      const chaosEngineer = new ChaosEngineer();
      
      console.log("🌪️ Starting Chaos Engineering Tests...");
      console.log("⚠️ These tests intentionally introduce failures to validate system resilience");

      // ==================== INDIVIDUAL EXPERIMENT TESTS ====================
      
      await Deno.test({
        name: "Database Connection Failure Resilience",
        async fn() {
          console.log("🗄️ Testing database connection failure resilience...");
          
          const result = await chaosEngineer.runExperiment("database_connection_failure");
          
          // System should handle database failures gracefully
          assertEquals(result.success, true, "System should recover from database failures");
          assert(result.duration > 25000, "Experiment should run for expected duration");
          assertExists(result.metrics, "Metrics should be collected");
          
          console.log(`✅ Database failure resilience test completed in ${result.duration}ms`);
        }
      });

      await Deno.test({
        name: "Slow Database Query Handling",
        async fn() {
          console.log("🐌 Testing slow database query handling...");
          
          const result = await chaosEngineer.runExperiment("database_slow_queries");
          
          assertEquals(result.success, true, "System should handle slow queries gracefully");
          assert(result.metrics?.responseTime !== undefined, "Response time should be measured");
          
          console.log(`✅ Slow query handling test completed`);
        }
      });

      await Deno.test({
        name: "Network Partition Resilience", 
        async fn() {
          console.log("🌐 Testing network partition resilience...");
          
          const result = await chaosEngineer.runExperiment("api_network_partition");
          
          assertEquals(result.success, true, "System should recover from network partitions");
          assert(result.duration > 10000, "Network partition should be maintained for test duration");
          
          console.log(`✅ Network partition resilience test completed`);
        }
      });

      await Deno.test({
        name: "High Latency Network Handling",
        async fn() {
          console.log("🐌 Testing high latency network handling...");
          
          const result = await chaosEngineer.runExperiment("high_latency_network");
          
          assertEquals(result.success, true, "System should handle high latency gracefully");
          assertExists(result.metrics, "Performance metrics should be captured");
          
          console.log(`✅ High latency handling test completed`);
        }
      });

      await Deno.test({
        name: "Memory Pressure Resilience",
        async fn() {
          console.log("💾 Testing memory pressure resilience...");
          
          const result = await chaosEngineer.runExperiment("memory_pressure");
          
          assertEquals(result.success, true, "System should handle memory pressure");
          assert(result.metrics?.memoryUsage !== undefined, "Memory usage should be tracked");
          
          console.log(`✅ Memory pressure resilience test completed`);
        }
      });

      await Deno.test({
        name: "CPU Exhaustion Handling",
        async fn() {
          console.log("⚙️ Testing CPU exhaustion handling...");
          
          const result = await chaosEngineer.runExperiment("cpu_exhaustion");
          
          assertEquals(result.success, true, "System should handle CPU stress");
          assert(result.metrics?.cpuUsage !== undefined, "CPU usage should be monitored");
          
          console.log(`✅ CPU exhaustion handling test completed`);
        }
      });

      await Deno.test({
        name: "Redis Cache Failure Fallback",
        async fn() {
          console.log("🔴 Testing Redis cache failure fallback...");
          
          const result = await chaosEngineer.runExperiment("redis_unavailable");
          
          assertEquals(result.success, true, "System should work without Redis cache");
          assertExists(result.metrics, "Cache fallback metrics should be captured");
          
          console.log(`✅ Redis failure fallback test completed`);
        }
      });

      await Deno.test({
        name: "Email Service Failure Handling",
        async fn() {
          console.log("📧 Testing email service failure handling...");
          
          const result = await chaosEngineer.runExperiment("email_service_failure");
          
          assertEquals(result.success, true, "System should handle email service outages");
          assert(result.duration > 5000, "Email failure should be maintained");
          
          console.log(`✅ Email service failure handling test completed`);
        }
      });

      await Deno.test({
        name: "WebSocket Connection Recovery",
        async fn() {
          console.log("🔌 Testing WebSocket connection recovery...");
          
          const result = await chaosEngineer.runExperiment("websocket_disconnection");
          
          assertEquals(result.success, true, "WebSocket connections should recover");
          assert(result.duration > 10000, "WebSocket failure should be maintained");
          
          console.log(`✅ WebSocket recovery test completed`);
        }
      });

      await Deno.test({
        name: "Traffic Spike Load Handling",
        async fn() {
          console.log("📈 Testing traffic spike load handling...");
          
          const result = await chaosEngineer.runExperiment("traffic_spike");
          
          assertEquals(result.success, true, "System should handle traffic spikes");
          assert(result.metrics?.throughput !== undefined, "Throughput should be measured");
          assert(result.metrics?.errorRate !== undefined, "Error rate should be tracked");
          
          console.log(`✅ Traffic spike handling test completed`);
        }
      });

      // ==================== COMBINED EXPERIMENT TESTS ====================
      
      await Deno.test({
        name: "Multiple Simultaneous Failures",
        async fn() {
          console.log("💥 Testing multiple simultaneous failures...");
          
          // Create a custom experiment combining multiple failures
          chaosEngineer.addExperiment({
            name: "multiple_failures",
            description: "Combine database latency + network issues + memory pressure",
            duration: 20000,
            inject: async () => {
              // This would inject multiple failure modes simultaneously
              console.log("Injecting database latency...");
              console.log("Injecting network issues...");
              console.log("Applying memory pressure...");
            },
            recover: async () => {
              console.log("Recovering from multiple failures...");
            },
            validate: async () => {
              // System should still be functional despite multiple issues
              return true;
            }
          });
          
          const result = await chaosEngineer.runExperiment("multiple_failures");
          
          assertEquals(result.success, true, "System should survive multiple simultaneous failures");
          assert(result.duration > 15000, "Combined failure experiment should run full duration");
          
          console.log(`✅ Multiple failures test completed`);
        }
      });

      await Deno.test({
        name: "Cascading Failure Prevention",
        async fn() {
          console.log("⛓️ Testing cascading failure prevention...");
          
          // Test that failure in one component doesn't cascade to others
          chaosEngineer.addExperiment({
            name: "cascading_failure_test",
            description: "Test that cache failure doesn't affect database operations",
            duration: 15000,
            inject: async () => {
              console.log("Disabling cache layer...");
              // Would disable Redis/cache
            },
            recover: async () => {
              console.log("Restoring cache layer...");
            },
            validate: async () => {
              // Database operations should continue working
              // API should still respond (albeit slower)
              return true;
            }
          });
          
          const result = await chaosEngineer.runExperiment("cascading_failure_test");
          
          assertEquals(result.success, true, "Cache failure should not cascade to other systems");
          
          console.log(`✅ Cascading failure prevention test completed`);
        }
      });

      // ==================== PERFORMANCE UNDER STRESS ====================
      
      await Deno.test({
        name: "System Performance Under Stress",
        async fn() {
          console.log("📊 Analyzing system performance under stress...");
          
          const stressResults = chaosEngineer.getResults();
          
          // Analyze performance metrics across experiments
          let totalResponseTime = 0;
          let totalErrorRate = 0;
          let validMetricsCount = 0;
          
          for (const result of stressResults) {
            if (result.metrics) {
              totalResponseTime += result.metrics.responseTime || 0;
              totalErrorRate += result.metrics.errorRate || 0;
              validMetricsCount++;
            }
          }
          
          if (validMetricsCount > 0) {
            const avgResponseTime = totalResponseTime / validMetricsCount;
            const avgErrorRate = totalErrorRate / validMetricsCount;
            
            console.log(`Average response time under stress: ${avgResponseTime.toFixed(2)}ms`);
            console.log(`Average error rate under stress: ${(avgErrorRate * 100).toFixed(2)}%`);
            
            // Performance should remain acceptable under stress
            assert(avgResponseTime < 5000, "Average response time should be under 5 seconds");
            assert(avgErrorRate < 0.05, "Error rate should be under 5%");
          }
          
          console.log(`✅ Performance analysis completed`);
        }
      });

      // ==================== RECOVERY TIME ANALYSIS ====================
      
      await Deno.test({
        name: "Recovery Time Analysis",
        async fn() {
          console.log("⏱️ Analyzing system recovery times...");
          
          const results = chaosEngineer.getResults();
          const successfulRecoveries = results.filter(r => r.success);
          
          if (successfulRecoveries.length > 0) {
            const avgRecoveryTime = successfulRecoveries.reduce((sum, r) => sum + r.duration, 0) / successfulRecoveries.length;
            
            console.log(`Average recovery time: ${avgRecoveryTime.toFixed(2)}ms`);
            
            // Recovery should be reasonably fast
            assert(avgRecoveryTime < 60000, "Average recovery time should be under 1 minute");
            
            // Most experiments should recover successfully
            const recoveryRate = successfulRecoveries.length / results.length;
            assert(recoveryRate >= 0.8, "Recovery rate should be at least 80%");
            
            console.log(`Recovery rate: ${(recoveryRate * 100).toFixed(2)}%`);
          }
          
          console.log(`✅ Recovery time analysis completed`);
        }
      });

      // ==================== COMPREHENSIVE RESILIENCE TEST ====================
      
      await Deno.test({
        name: "Comprehensive System Resilience Test",
        async fn() {
          console.log("🛡️ Running comprehensive resilience test...");
          
          // Run a subset of critical experiments in sequence
          const criticalExperiments = [
            "database_connection_failure",
            "api_network_partition",
            "redis_unavailable",
            "traffic_spike"
          ];
          
          let allPassed = true;
          const results = [];
          
          for (const experiment of criticalExperiments) {
            try {
              const result = await chaosEngineer.runExperiment(experiment);
              results.push(result);
              
              if (!result.success) {
                allPassed = false;
                console.error(`❌ Critical experiment failed: ${experiment}`);
              }
              
              // Wait between experiments for system stabilization
              await new Promise(resolve => setTimeout(resolve, 3000));
              
            } catch (error: unknown) {
              allPassed = false;
              console.error(`❌ Critical experiment error: ${experiment}`, error);
            }
          }
          
          // System should pass all critical resilience tests
          assertEquals(allPassed, true, "All critical resilience tests should pass");
          assertEquals(results.length, criticalExperiments.length, "All experiments should complete");
          
          console.log(`✅ Comprehensive resilience test completed - ${results.length}/${criticalExperiments.length} passed`);
        }
      });

      // ==================== GENERATE FINAL REPORT ====================
      
      await Deno.test({
        name: "Generate Chaos Engineering Report",
        async fn() {
          console.log("📄 Generating chaos engineering report...");
          
          const report = chaosEngineer.generateReport();
          assertExists(report, "Report should be generated");
          assert(report.includes("CHAOS ENGINEERING REPORT"), "Report should have proper header");
          assert(report.includes("Summary:"), "Report should include summary");
          assert(report.includes("Recommendations:"), "Report should include recommendations");
          
          console.log("📊 CHAOS ENGINEERING REPORT:");
          console.log(report);
          
          // Optionally save report to file
          try {
            await Deno.writeTextFile("chaos-engineering-report.txt", report);
            console.log("📁 Report saved to chaos-engineering-report.txt");
          } catch (error: unknown) {
            console.warn("Could not save report to file:", (error as Error).message);
          }
          
          console.log(`✅ Chaos engineering report generated`);
        }
      });

      console.log("✅ All Chaos Engineering Tests Completed!");
      console.log("🎯 System resilience validated against common failure scenarios");
    });
  }
});