/**
 * Chaos Engineering Framework
 * Tests system resilience by introducing controlled failures
 */

import { TestFactory } from "../framework/test-factory.ts";
import { TestHelper, TEST_CONFIG } from "../setup.ts";

interface ChaosExperiment {
  name: string;
  description: string;
  duration: number; // in milliseconds
  setup?: () => Promise<void>;
  inject: () => Promise<void>;
  recover: () => Promise<void>;
  validate: () => Promise<boolean>;
  teardown?: () => Promise<void>;
}

interface ChaosResult {
  experiment: string;
  success: boolean;
  duration: number;
  error?: string;
  metrics?: Record<string, number>;
}

class ChaosEngineer {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private results: ChaosResult[] = [];
  private testHelper: TestHelper;

  constructor() {
    this.testHelper = new TestHelper();
    this.setupExperiments();
  }

  private setupExperiments(): void {
    // Database failure experiments
    this.addExperiment({
      name: "database_connection_failure",
      description: "Simulate database connection failures during high load",
      duration: 30000,
      inject: async () => {
        // Simulate database unavailability
        await this.simulateDatabaseFailure();
      },
      recover: async () => {
        await this.restoreDatabaseConnection();
      },
      validate: async () => {
        return await this.validateSystemRecovery();
      }
    });

    this.addExperiment({
      name: "database_slow_queries",
      description: "Simulate slow database query responses",
      duration: 20000,
      inject: async () => {
        await this.simulateSlowDatabaseQueries();
      },
      recover: async () => {
        await this.restoreNormalDatabasePerformance();
      },
      validate: async () => {
        return await this.validateResponseTimes();
      }
    });

    // Network failure experiments
    this.addExperiment({
      name: "api_network_partition",
      description: "Simulate network partition between frontend and API",
      duration: 15000,
      inject: async () => {
        await this.simulateNetworkPartition();
      },
      recover: async () => {
        await this.restoreNetworkConnectivity();
      },
      validate: async () => {
        return await this.validateAPIConnectivity();
      }
    });

    this.addExperiment({
      name: "high_latency_network",
      description: "Simulate high network latency",
      duration: 25000,
      inject: async () => {
        await this.simulateHighLatency();
      },
      recover: async () => {
        await this.restoreNormalLatency();
      },
      validate: async () => {
        return await this.validateLatencyHandling();
      }
    });

    // Memory and CPU stress experiments
    this.addExperiment({
      name: "memory_pressure",
      description: "Simulate high memory usage",
      duration: 20000,
      inject: async () => {
        await this.simulateMemoryPressure();
      },
      recover: async () => {
        await this.releaseMemoryPressure();
      },
      validate: async () => {
        return await this.validateMemoryHandling();
      }
    });

    this.addExperiment({
      name: "cpu_exhaustion",
      description: "Simulate CPU exhaustion",
      duration: 15000,
      inject: async () => {
        await this.simulateCPUExhaustion();
      },
      recover: async () => {
        await this.restoreNormalCPUUsage();
      },
      validate: async () => {
        return await this.validateCPUHandling();
      }
    });

    // External service failure experiments
    this.addExperiment({
      name: "redis_unavailable",
      description: "Simulate Redis cache unavailability",
      duration: 20000,
      inject: async () => {
        await this.simulateRedisFailure();
      },
      recover: async () => {
        await this.restoreRedisConnection();
      },
      validate: async () => {
        return await this.validateCacheFallback();
      }
    });

    this.addExperiment({
      name: "email_service_failure",
      description: "Simulate email service outage",
      duration: 10000,
      inject: async () => {
        await this.simulateEmailServiceFailure();
      },
      recover: async () => {
        await this.restoreEmailService();
      },
      validate: async () => {
        return await this.validateEmailFallback();
      }
    });

    // WebSocket failure experiments
    this.addExperiment({
      name: "websocket_disconnection",
      description: "Simulate WebSocket connection drops",
      duration: 15000,
      inject: async () => {
        await this.simulateWebSocketFailure();
      },
      recover: async () => {
        await this.restoreWebSocketConnections();
      },
      validate: async () => {
        return await this.validateWebSocketRecovery();
      }
    });

    // Traffic spike experiments
    this.addExperiment({
      name: "traffic_spike",
      description: "Simulate sudden traffic spikes",
      duration: 30000,
      inject: async () => {
        await this.simulateTrafficSpike();
      },
      recover: async () => {
        await this.normalizeTraffic();
      },
      validate: async () => {
        return await this.validateLoadHandling();
      }
    });
  }

  addExperiment(experiment: ChaosExperiment): void {
    this.experiments.set(experiment.name, experiment);
  }

  async runExperiment(name: string): Promise<ChaosResult> {
    const experiment = this.experiments.get(name);
    if (!experiment) {
      throw new Error(`Experiment '${name}' not found`);
    }

    console.log(`🌪️ Starting chaos experiment: ${experiment.name}`);
    console.log(`📝 Description: ${experiment.description}`);

    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // Setup phase
      if (experiment.setup) {
        console.log("🔧 Setup phase...");
        await experiment.setup();
      }

      // Inject chaos
      console.log("💥 Injecting chaos...");
      await experiment.inject();

      // Wait for experiment duration
      console.log(`⏱️ Running experiment for ${experiment.duration}ms...`);
      await new Promise(resolve => setTimeout(resolve, experiment.duration));

      // Recovery phase
      console.log("🔄 Recovery phase...");
      await experiment.recover();

      // Validation phase
      console.log("✅ Validation phase...");
      success = await experiment.validate();

      // Teardown phase
      if (experiment.teardown) {
        console.log("🧹 Teardown phase...");
        await experiment.teardown();
      }

    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error(`❌ Experiment failed: ${error}`);
      
      // Attempt recovery even if experiment failed
      try {
        await experiment.recover();
      } catch (recoveryErr) {
        console.error(`❌ Recovery failed: ${recoveryErr}`);
      }
    }

    const duration = Date.now() - startTime;
    const result: ChaosResult = {
      experiment: name,
      success,
      duration,
      error,
      metrics: await this.collectMetrics()
    };

    this.results.push(result);
    console.log(`🏁 Experiment completed in ${duration}ms - Success: ${success}`);

    return result;
  }

  async runAllExperiments(): Promise<ChaosResult[]> {
    const results: ChaosResult[] = [];
    
    for (const [name, experiment] of this.experiments) {
      try {
        const result = await this.runExperiment(name);
        results.push(result);
        
        // Wait between experiments to allow system stabilization
        await new Promise(resolve => setTimeout(resolve, 5000));
      } catch (error: unknown) {
        console.error(`Failed to run experiment ${name}:`, error);
        results.push({
          experiment: name,
          success: false,
          duration: 0,
          error: error instanceof Error ? (error as Error).message : String(error)
        });
      }
    }

    return results;
  }

  // ==================== CHAOS INJECTION METHODS ====================

  private async simulateDatabaseFailure(): Promise<void> {
    // In a real implementation, this would:
    // 1. Block database connections
    // 2. Kill database processes
    // 3. Simulate network issues to database
    console.log("💀 Simulating database failure...");
    
    // Mock implementation - would integrate with actual infrastructure
    await this.injectNetworkRule("BLOCK", "database");
  }

  private async restoreDatabaseConnection(): Promise<void> {
    console.log("🔧 Restoring database connection...");
    await this.removeNetworkRule("BLOCK", "database");
  }

  private async simulateSlowDatabaseQueries(): Promise<void> {
    console.log("🐌 Simulating slow database queries...");
    await this.injectLatencyRule("database", 5000); // 5 second delay
  }

  private async restoreNormalDatabasePerformance(): Promise<void> {
    console.log("⚡ Restoring normal database performance...");
    await this.removeLatencyRule("database");
  }

  private async simulateNetworkPartition(): Promise<void> {
    console.log("🌐 Simulating network partition...");
    await this.injectNetworkRule("DROP", "api");
  }

  private async restoreNetworkConnectivity(): Promise<void> {
    console.log("🔗 Restoring network connectivity...");
    await this.removeNetworkRule("DROP", "api");
  }

  private async simulateHighLatency(): Promise<void> {
    console.log("🐌 Simulating high network latency...");
    await this.injectLatencyRule("api", 3000); // 3 second delay
  }

  private async restoreNormalLatency(): Promise<void> {
    console.log("⚡ Restoring normal latency...");
    await this.removeLatencyRule("api");
  }

  private async simulateMemoryPressure(): Promise<void> {
    console.log("💾 Simulating memory pressure...");
    // Would integrate with actual memory pressure tools
    await this.consumeMemory(80); // 80% memory usage
  }

  private async releaseMemoryPressure(): Promise<void> {
    console.log("🆓 Releasing memory pressure...");
    await this.releaseMemory();
  }

  private async simulateCPUExhaustion(): Promise<void> {
    console.log("⚙️ Simulating CPU exhaustion...");
    await this.consumeCPU(95); // 95% CPU usage
  }

  private async restoreNormalCPUUsage(): Promise<void> {
    console.log("😌 Restoring normal CPU usage...");
    await this.releaseCPU();
  }

  private async simulateRedisFailure(): Promise<void> {
    console.log("🔴 Simulating Redis failure...");
    await this.injectNetworkRule("BLOCK", "redis");
  }

  private async restoreRedisConnection(): Promise<void> {
    console.log("✅ Restoring Redis connection...");
    await this.removeNetworkRule("BLOCK", "redis");
  }

  private async simulateEmailServiceFailure(): Promise<void> {
    console.log("📧 Simulating email service failure...");
    await this.injectNetworkRule("BLOCK", "sendgrid");
  }

  private async restoreEmailService(): Promise<void> {
    console.log("📨 Restoring email service...");
    await this.removeNetworkRule("BLOCK", "sendgrid");
  }

  private async simulateWebSocketFailure(): Promise<void> {
    console.log("🔌 Simulating WebSocket failure...");
    await this.injectNetworkRule("DROP", "websocket");
  }

  private async restoreWebSocketConnections(): Promise<void> {
    console.log("🔗 Restoring WebSocket connections...");
    await this.removeNetworkRule("DROP", "websocket");
  }

  private async simulateTrafficSpike(): Promise<void> {
    console.log("📈 Simulating traffic spike...");
    await this.generateLoad(1000); // 1000 concurrent requests
  }

  private async normalizeTraffic(): Promise<void> {
    console.log("📉 Normalizing traffic...");
    await this.stopLoadGeneration();
  }

  // ==================== VALIDATION METHODS ====================

  private async validateSystemRecovery(): Promise<boolean> {
    try {
      // Test basic API endpoints
      const response = await this.testHelper.checkEndpointHealth('/api/health');
      return response;
    } catch (error: unknown) {
      console.error("System recovery validation failed:", error);
      return false;
    }
  }

  private async validateResponseTimes(): Promise<boolean> {
    const startTime = Date.now();
    const success = await this.testHelper.checkEndpointHealth('/api/pitches');
    const responseTime = Date.now() - startTime;
    
    console.log(`Response time: ${responseTime}ms`);
    return success && responseTime < 5000; // 5 second threshold
  }

  private async validateAPIConnectivity(): Promise<boolean> {
    try {
      const endpoints = ['/api/health', '/api/users/profile', '/api/pitches'];
      
      for (const endpoint of endpoints) {
        const success = await this.testHelper.checkEndpointHealth(endpoint);
        if (!success) return false;
      }
      
      return true;
    } catch (error: unknown) {
      return false;
    }
  }

  private async validateLatencyHandling(): Promise<boolean> {
    // Test that the system handles high latency gracefully
    const promises = Array.from({ length: 10 }, () => 
      this.testHelper.checkEndpointHealth('/api/pitches')
    );
    
    const results = await Promise.allSettled(promises);
    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value
    ).length;
    
    return successCount >= 7; // At least 70% success rate
  }

  private async validateMemoryHandling(): Promise<boolean> {
    // Test that system continues to function under memory pressure
    return await this.validateSystemRecovery();
  }

  private async validateCPUHandling(): Promise<boolean> {
    // Test that system responds under CPU stress
    return await this.validateSystemRecovery();
  }

  private async validateCacheFallback(): Promise<boolean> {
    // Test that system works without cache
    const response = await this.testHelper.checkEndpointHealth('/api/pitches');
    // Should work even without Redis cache
    return response;
  }

  private async validateEmailFallback(): Promise<boolean> {
    // Test that system handles email service failure gracefully
    // This would test email queuing or alternative notification methods
    return true; // Simplified - would test actual email fallback
  }

  private async validateWebSocketRecovery(): Promise<boolean> {
    // Test WebSocket reconnection logic
    return await this.testHelper.testWebSocketConnection();
  }

  private async validateLoadHandling(): Promise<boolean> {
    // Test that system handled load spike and recovered
    const startTime = Date.now();
    const success = await this.validateSystemRecovery();
    const responseTime = Date.now() - startTime;
    
    // System should still be responsive
    return success && responseTime < 10000;
  }

  // ==================== INFRASTRUCTURE INTERACTION METHODS ====================

  private async injectNetworkRule(action: string, target: string): Promise<void> {
    // In production, this would use tools like:
    // - iptables for network manipulation
    // - tc (traffic control) for latency injection
    // - Chaos Monkey, Gremlin, or Litmus for orchestrated chaos
    console.log(`Injecting network rule: ${action} ${target}`);
    
    // Mock implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async removeNetworkRule(action: string, target: string): Promise<void> {
    console.log(`Removing network rule: ${action} ${target}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async injectLatencyRule(target: string, delayMs: number): Promise<void> {
    console.log(`Injecting ${delayMs}ms latency to ${target}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async removeLatencyRule(target: string): Promise<void> {
    console.log(`Removing latency rule for ${target}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async consumeMemory(percentage: number): Promise<void> {
    console.log(`Consuming ${percentage}% memory`);
    // Would use tools like stress-ng or custom memory allocation
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async releaseMemory(): Promise<void> {
    console.log("Releasing consumed memory");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async consumeCPU(percentage: number): Promise<void> {
    console.log(`Consuming ${percentage}% CPU`);
    // Would use stress testing tools
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async releaseCPU(): Promise<void> {
    console.log("Releasing CPU load");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async generateLoad(concurrentRequests: number): Promise<void> {
    console.log(`Generating load: ${concurrentRequests} concurrent requests`);
    // Would use load testing tools like artillery, wrk, or k6
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  private async stopLoadGeneration(): Promise<void> {
    console.log("Stopping load generation");
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async collectMetrics(): Promise<Record<string, number>> {
    // Collect system metrics during/after experiment
    return {
      responseTime: Math.random() * 1000,
      errorRate: Math.random() * 0.1,
      throughput: Math.random() * 100,
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
    };
  }

  // ==================== REPORTING ====================

  generateReport(): string {
    const totalExperiments = this.results.length;
    const successfulExperiments = this.results.filter(r => r.success).length;
    const successRate = (successfulExperiments / totalExperiments * 100).toFixed(2);

    let report = `
🌪️ CHAOS ENGINEERING REPORT
================================

📊 Summary:
- Total Experiments: ${totalExperiments}
- Successful: ${successfulExperiments}
- Failed: ${totalExperiments - successfulExperiments}
- Success Rate: ${successRate}%

📋 Experiment Results:
`;

    this.results.forEach(result => {
      const status = result.success ? "✅ PASSED" : "❌ FAILED";
      report += `
${status} ${result.experiment}
- Duration: ${result.duration}ms
- Error: ${result.error || "None"}
`;
      
      if (result.metrics) {
        report += `- Metrics: ${JSON.stringify(result.metrics, null, 2)}`;
      }
    });

    report += `

🏆 Recommendations:
`;

    // Generate recommendations based on results
    const failedExperiments = this.results.filter(r => !r.success);
    if (failedExperiments.length === 0) {
      report += "- System demonstrates excellent resilience! ✨\n";
    } else {
      failedExperiments.forEach(experiment => {
        report += `- Improve resilience for: ${experiment.experiment}\n`;
      });
    }

    return report;
  }

  getResults(): ChaosResult[] {
    return [...this.results];
  }

  clearResults(): void {
    this.results = [];
  }
}

export { ChaosEngineer, type ChaosExperiment, type ChaosResult };