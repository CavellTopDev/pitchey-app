/**
 * Load Testing Harness for Cloudflare Workflows
 * 
 * Comprehensive load testing framework for simulating concurrent workflows,
 * stress testing scenarios, performance benchmarking, and bottleneck identification.
 */

import type { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { KVNamespace, R2Bucket, AnalyticsEngineDataset } from '@cloudflare/workers-types';
import { PerformanceManager, PERFORMANCE_TARGETS } from './performance-config';
import { DebugManager } from './debug-tools';

// ============================================================================
// Type Definitions
// ============================================================================

export interface LoadTestConfig {
  name: string;
  description: string;
  workflowType: 'investment' | 'production' | 'nda' | 'mixed';
  duration: number; // seconds
  rampUpTime: number; // seconds
  targetConcurrency: number;
  targetRPS: number; // requests per second
  scenarios: TestScenario[];
  dataGenerators: DataGenerator[];
  successCriteria: SuccessCriteria;
  monitoring: MonitoringConfig;
}

export interface TestScenario {
  name: string;
  weight: number; // Percentage of total load
  workflow: string;
  data: () => any;
  validations: Validation[];
  expectedDuration?: number;
  expectedOutcome?: string;
}

export interface DataGenerator {
  name: string;
  type: 'sequential' | 'random' | 'csv' | 'synthetic';
  config: any;
  generate: () => any;
}

export interface Validation {
  name: string;
  check: (response: any) => boolean;
  errorMessage: string;
}

export interface SuccessCriteria {
  maxErrorRate: number; // percentage
  maxP95Latency: number; // milliseconds
  maxP99Latency: number; // milliseconds
  minThroughput: number; // requests per second
  maxConcurrentWorkflows: number;
}

export interface MonitoringConfig {
  metricsInterval: number; // seconds
  snapshotInterval: number; // seconds
  verboseLogging: boolean;
  tracesSampleRate: number; // 0-1
  exportMetrics: boolean;
  exportDestination?: string;
}

export interface LoadTestResult {
  testName: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  throughput: {
    average: number;
    peak: number;
    percentiles: {
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  latency: {
    min: number;
    max: number;
    average: number;
    percentiles: {
      p50: number;
      p75: number;
      p90: number;
      p95: number;
      p99: number;
    };
  };
  concurrency: {
    average: number;
    peak: number;
  };
  errors: ErrorSummary[];
  bottlenecks: Bottleneck[];
  resourceUsage: ResourceMetrics;
  recommendations: string[];
  passed: boolean;
}

export interface ErrorSummary {
  error: string;
  count: number;
  percentage: number;
  firstOccurrence: string;
  lastOccurrence: string;
  affectedScenarios: string[];
}

export interface Bottleneck {
  component: string;
  metric: string;
  value: number;
  threshold: number;
  impact: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface ResourceMetrics {
  cpu: {
    average: number;
    peak: number;
    p95: number;
  };
  memory: {
    average: number;
    peak: number;
    p95: number;
  };
  io: {
    kvReads: number;
    kvWrites: number;
    r2Gets: number;
    r2Puts: number;
    databaseQueries: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    requestCount: number;
  };
}

// ============================================================================
// Load Test Scenarios
// ============================================================================

export const PREDEFINED_SCENARIOS = {
  // Baseline performance test
  BASELINE: {
    name: 'Baseline Performance Test',
    description: 'Establish baseline performance metrics',
    workflowType: 'mixed' as const,
    duration: 300, // 5 minutes
    rampUpTime: 30,
    targetConcurrency: 100,
    targetRPS: 50,
    scenarios: [
      {
        name: 'Investment Interest',
        weight: 33,
        workflow: 'InvestmentDealWorkflow',
        data: () => generateInvestmentData(),
        validations: [
          {
            name: 'State Transition',
            check: (res) => res.state === 'QUALIFICATION',
            errorMessage: 'Failed to transition to QUALIFICATION state',
          },
        ],
        expectedDuration: 2000,
      },
      {
        name: 'Production Interest',
        weight: 33,
        workflow: 'ProductionDealWorkflow',
        data: () => generateProductionData(),
        validations: [
          {
            name: 'Meeting Scheduled',
            check: (res) => res.meetingScheduled !== undefined,
            errorMessage: 'Failed to schedule meeting',
          },
        ],
        expectedDuration: 1500,
      },
      {
        name: 'NDA Request',
        weight: 34,
        workflow: 'NDAWorkflow',
        data: () => generateNDAData(),
        validations: [
          {
            name: 'NDA Sent',
            check: (res) => res.status === 'PENDING',
            errorMessage: 'Failed to send NDA',
          },
        ],
        expectedDuration: 500,
      },
    ],
    dataGenerators: [],
    successCriteria: {
      maxErrorRate: 1,
      maxP95Latency: PERFORMANCE_TARGETS.P95_LATENCY_MS,
      maxP99Latency: PERFORMANCE_TARGETS.P99_LATENCY_MS,
      minThroughput: 40,
      maxConcurrentWorkflows: 100,
    },
    monitoring: {
      metricsInterval: 5,
      snapshotInterval: 30,
      verboseLogging: false,
      tracesSampleRate: 0.1,
      exportMetrics: true,
    },
  } as LoadTestConfig,
  
  // Stress test
  STRESS: {
    name: 'Stress Test',
    description: 'Find breaking point and maximum capacity',
    workflowType: 'mixed' as const,
    duration: 600, // 10 minutes
    rampUpTime: 120,
    targetConcurrency: 1000,
    targetRPS: 500,
    scenarios: [], // Use same as baseline
    dataGenerators: [],
    successCriteria: {
      maxErrorRate: 5,
      maxP95Latency: 500,
      maxP99Latency: 1000,
      minThroughput: 300,
      maxConcurrentWorkflows: 1000,
    },
    monitoring: {
      metricsInterval: 2,
      snapshotInterval: 10,
      verboseLogging: true,
      tracesSampleRate: 0.01,
      exportMetrics: true,
    },
  } as LoadTestConfig,
  
  // Spike test
  SPIKE: {
    name: 'Spike Test',
    description: 'Test sudden traffic spikes',
    workflowType: 'mixed' as const,
    duration: 300,
    rampUpTime: 5, // Very quick ramp
    targetConcurrency: 2000,
    targetRPS: 1000,
    scenarios: [],
    dataGenerators: [],
    successCriteria: {
      maxErrorRate: 10,
      maxP95Latency: 1000,
      maxP99Latency: 2000,
      minThroughput: 500,
      maxConcurrentWorkflows: 2000,
    },
    monitoring: {
      metricsInterval: 1,
      snapshotInterval: 5,
      verboseLogging: true,
      tracesSampleRate: 0.001,
      exportMetrics: true,
    },
  } as LoadTestConfig,
  
  // Endurance test
  ENDURANCE: {
    name: 'Endurance Test',
    description: 'Long-running stability test',
    workflowType: 'mixed' as const,
    duration: 3600, // 1 hour
    rampUpTime: 300,
    targetConcurrency: 500,
    targetRPS: 200,
    scenarios: [],
    dataGenerators: [],
    successCriteria: {
      maxErrorRate: 0.5,
      maxP95Latency: 200,
      maxP99Latency: 500,
      minThroughput: 150,
      maxConcurrentWorkflows: 500,
    },
    monitoring: {
      metricsInterval: 30,
      snapshotInterval: 300,
      verboseLogging: false,
      tracesSampleRate: 0.001,
      exportMetrics: true,
    },
  } as LoadTestConfig,
  
  // Chaos test
  CHAOS: {
    name: 'Chaos Test',
    description: 'Test with random failures and delays',
    workflowType: 'mixed' as const,
    duration: 900, // 15 minutes
    rampUpTime: 60,
    targetConcurrency: 300,
    targetRPS: 100,
    scenarios: [],
    dataGenerators: [],
    successCriteria: {
      maxErrorRate: 20, // Higher tolerance for chaos
      maxP95Latency: 2000,
      maxP99Latency: 5000,
      minThroughput: 50,
      maxConcurrentWorkflows: 300,
    },
    monitoring: {
      metricsInterval: 5,
      snapshotInterval: 30,
      verboseLogging: true,
      tracesSampleRate: 0.1,
      exportMetrics: true,
    },
  } as LoadTestConfig,
};

// ============================================================================
// Load Test Runner
// ============================================================================

export class LoadTestRunner {
  private activeWorkflows: Map<string, WorkflowExecution> = new Map();
  private metrics: MetricsCollector;
  private isRunning: boolean = false;
  private abortController: AbortController | null = null;
  
  constructor(
    private kv: KVNamespace,
    private r2: R2Bucket,
    private analytics: AnalyticsEngineDataset,
    private performanceManager: PerformanceManager,
    private debugManager: DebugManager
  ) {
    this.metrics = new MetricsCollector(analytics);
  }
  
  /**
   * Run a load test
   */
  async runTest(config: LoadTestConfig): Promise<LoadTestResult> {
    console.log(`Starting load test: ${config.name}`);
    
    this.isRunning = true;
    this.abortController = new AbortController();
    
    const startTime = Date.now();
    const result: LoadTestResult = {
      testName: config.name,
      startTime: new Date(startTime).toISOString(),
      endTime: '',
      duration: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      errorRate: 0,
      throughput: {
        average: 0,
        peak: 0,
        percentiles: { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
      },
      latency: {
        min: Infinity,
        max: 0,
        average: 0,
        percentiles: { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
      },
      concurrency: {
        average: 0,
        peak: 0,
      },
      errors: [],
      bottlenecks: [],
      resourceUsage: {
        cpu: { average: 0, peak: 0, p95: 0 },
        memory: { average: 0, peak: 0, p95: 0 },
        io: {
          kvReads: 0,
          kvWrites: 0,
          r2Gets: 0,
          r2Puts: 0,
          databaseQueries: 0,
        },
        network: {
          bytesIn: 0,
          bytesOut: 0,
          requestCount: 0,
        },
      },
      recommendations: [],
      passed: false,
    };
    
    try {
      // Start monitoring
      this.startMonitoring(config);
      
      // Ramp up phase
      await this.rampUp(config);
      
      // Main test execution
      await this.executeTest(config, result);
      
      // Ramp down
      await this.rampDown();
      
    } catch (error) {
      console.error('Load test failed:', error);
      result.errors.push({
        error: String(error),
        count: 1,
        percentage: 100,
        firstOccurrence: new Date().toISOString(),
        lastOccurrence: new Date().toISOString(),
        affectedScenarios: ['all'],
      });
    } finally {
      this.isRunning = false;
      
      // Collect final metrics
      const endTime = Date.now();
      result.endTime = new Date(endTime).toISOString();
      result.duration = endTime - startTime;
      
      // Analyze results
      await this.analyzeResults(config, result);
      
      // Generate report
      await this.generateReport(result);
      
      // Clean up
      await this.cleanup();
    }
    
    return result;
  }
  
  /**
   * Abort running test
   */
  abort(): void {
    console.log('Aborting load test...');
    this.abortController?.abort();
    this.isRunning = false;
  }
  
  /**
   * Run multiple test scenarios
   */
  async runScenarios(scenarios: LoadTestConfig[]): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = [];
    
    for (const scenario of scenarios) {
      if (!this.isRunning) break;
      
      console.log(`Running scenario: ${scenario.name}`);
      const result = await this.runTest(scenario);
      results.push(result);
      
      // Cool down between scenarios
      await this.coolDown(30000); // 30 seconds
    }
    
    return results;
  }
  
  /**
   * Compare multiple test results
   */
  compareResults(results: LoadTestResult[]): {
    bestPerformer: string;
    comparison: Array<{
      metric: string;
      values: Record<string, number>;
      winner: string;
    }>;
    insights: string[];
  } {
    const comparison: any[] = [];
    const insights: string[] = [];
    
    // Compare key metrics
    const metrics = [
      { name: 'Error Rate', getter: (r: LoadTestResult) => r.errorRate, lower: true },
      { name: 'P95 Latency', getter: (r: LoadTestResult) => r.latency.percentiles.p95, lower: true },
      { name: 'Throughput', getter: (r: LoadTestResult) => r.throughput.average, lower: false },
      { name: 'Peak Concurrency', getter: (r: LoadTestResult) => r.concurrency.peak, lower: false },
    ];
    
    for (const metric of metrics) {
      const values: Record<string, number> = {};
      let bestValue = metric.lower ? Infinity : -Infinity;
      let winner = '';
      
      for (const result of results) {
        const value = metric.getter(result);
        values[result.testName] = value;
        
        if ((metric.lower && value < bestValue) || (!metric.lower && value > bestValue)) {
          bestValue = value;
          winner = result.testName;
        }
      }
      
      comparison.push({
        metric: metric.name,
        values,
        winner,
      });
    }
    
    // Determine overall best performer
    const scores: Record<string, number> = {};
    for (const comp of comparison) {
      if (!scores[comp.winner]) scores[comp.winner] = 0;
      scores[comp.winner]++;
    }
    
    const bestPerformer = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0][0];
    
    // Generate insights
    for (const result of results) {
      if (result.errorRate > 5) {
        insights.push(`${result.testName} has high error rate (${result.errorRate.toFixed(2)}%)`);
      }
      
      if (result.latency.percentiles.p95 > 1000) {
        insights.push(`${result.testName} has high P95 latency (${result.latency.percentiles.p95}ms)`);
      }
      
      if (result.bottlenecks.length > 0) {
        const critical = result.bottlenecks.filter(b => b.impact === 'high');
        if (critical.length > 0) {
          insights.push(`${result.testName} has ${critical.length} critical bottlenecks`);
        }
      }
    }
    
    return {
      bestPerformer,
      comparison,
      insights,
    };
  }
  
  private async rampUp(config: LoadTestConfig): Promise<void> {
    console.log(`Ramping up over ${config.rampUpTime} seconds...`);
    
    const steps = Math.min(config.rampUpTime, 100);
    const stepDuration = (config.rampUpTime * 1000) / steps;
    const concurrencyPerStep = config.targetConcurrency / steps;
    
    for (let i = 1; i <= steps; i++) {
      if (this.abortController?.signal.aborted) break;
      
      const targetConcurrency = Math.floor(concurrencyPerStep * i);
      await this.adjustConcurrency(targetConcurrency);
      
      await new Promise(resolve => setTimeout(resolve, stepDuration));
    }
  }
  
  private async executeTest(
    config: LoadTestConfig,
    result: LoadTestResult
  ): Promise<void> {
    const testDuration = config.duration * 1000;
    const testEndTime = Date.now() + testDuration;
    
    // Start virtual users
    const virtualUsers: Promise<void>[] = [];
    for (let i = 0; i < config.targetConcurrency; i++) {
      virtualUsers.push(this.runVirtualUser(config, result, testEndTime));
      
      // Stagger user starts
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    // Wait for test to complete
    await Promise.allSettled(virtualUsers);
  }
  
  private async runVirtualUser(
    config: LoadTestConfig,
    result: LoadTestResult,
    endTime: number
  ): Promise<void> {
    while (Date.now() < endTime && !this.abortController?.signal.aborted) {
      // Select scenario based on weight
      const scenario = this.selectScenario(config.scenarios);
      
      // Execute workflow
      const execution = await this.executeWorkflow(scenario, result);
      
      // Track execution
      this.activeWorkflows.set(execution.id, execution);
      
      // Update metrics
      this.metrics.recordExecution(execution);
      
      // Think time between requests
      const thinkTime = this.calculateThinkTime(config.targetRPS, config.targetConcurrency);
      await new Promise(resolve => setTimeout(resolve, thinkTime));
    }
  }
  
  private selectScenario(scenarios: TestScenario[]): TestScenario {
    const random = Math.random() * 100;
    let cumulativeWeight = 0;
    
    for (const scenario of scenarios) {
      cumulativeWeight += scenario.weight;
      if (random <= cumulativeWeight) {
        return scenario;
      }
    }
    
    return scenarios[scenarios.length - 1];
  }
  
  private async executeWorkflow(
    scenario: TestScenario,
    result: LoadTestResult
  ): Promise<WorkflowExecution> {
    const execution: WorkflowExecution = {
      id: crypto.randomUUID(),
      scenario: scenario.name,
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      success: false,
      error: undefined,
      response: undefined,
    };
    
    try {
      // Generate test data
      const data = scenario.data();
      
      // Execute workflow (simulated)
      const response = await this.invokeWorkflow(scenario.workflow, data);
      
      // Validate response
      for (const validation of scenario.validations) {
        if (!validation.check(response)) {
          throw new Error(validation.errorMessage);
        }
      }
      
      execution.success = true;
      execution.response = response;
      result.successfulRequests++;
      
    } catch (error: any) {
      execution.success = false;
      execution.error = error.message;
      result.failedRequests++;
      
      // Track error
      this.trackError(result, error, scenario.name);
    } finally {
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      result.totalRequests++;
      
      // Update latency metrics
      this.updateLatencyMetrics(result, execution.duration);
    }
    
    return execution;
  }
  
  private async invokeWorkflow(workflow: string, data: any): Promise<any> {
    // Simulate workflow invocation
    // In a real implementation, this would call the actual workflow API
    
    // Simulate processing time
    const processingTime = Math.random() * 100 + 50; // 50-150ms
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional errors
    if (Math.random() < 0.01) { // 1% error rate
      throw new Error('Simulated workflow error');
    }
    
    // Return mock response
    return {
      workflowId: crypto.randomUUID(),
      state: 'COMPLETED',
      data: data,
      timestamp: new Date().toISOString(),
    };
  }
  
  private async rampDown(): Promise<void> {
    console.log('Ramping down...');
    
    // Gradually stop virtual users
    const steps = 10;
    const activeCount = this.activeWorkflows.size;
    const reductionPerStep = Math.ceil(activeCount / steps);
    
    for (let i = 0; i < steps; i++) {
      const toStop = Math.min(reductionPerStep, this.activeWorkflows.size);
      const workflows = Array.from(this.activeWorkflows.values()).slice(0, toStop);
      
      for (const workflow of workflows) {
        this.activeWorkflows.delete(workflow.id);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  private async adjustConcurrency(target: number): Promise<void> {
    const current = this.activeWorkflows.size;
    const diff = target - current;
    
    if (diff > 0) {
      // Add more virtual users
      console.log(`Adding ${diff} virtual users`);
    } else if (diff < 0) {
      // Remove virtual users
      console.log(`Removing ${Math.abs(diff)} virtual users`);
    }
  }
  
  private calculateThinkTime(targetRPS: number, concurrency: number): number {
    const baseThinkTime = (concurrency / targetRPS) * 1000;
    // Add some randomness
    const jitter = baseThinkTime * 0.2 * (Math.random() - 0.5);
    return Math.max(0, baseThinkTime + jitter);
  }
  
  private trackError(result: LoadTestResult, error: Error, scenario: string): void {
    const errorKey = error.message;
    let errorSummary = result.errors.find(e => e.error === errorKey);
    
    if (!errorSummary) {
      errorSummary = {
        error: errorKey,
        count: 0,
        percentage: 0,
        firstOccurrence: new Date().toISOString(),
        lastOccurrence: new Date().toISOString(),
        affectedScenarios: [],
      };
      result.errors.push(errorSummary);
    }
    
    errorSummary.count++;
    errorSummary.lastOccurrence = new Date().toISOString();
    if (!errorSummary.affectedScenarios.includes(scenario)) {
      errorSummary.affectedScenarios.push(scenario);
    }
  }
  
  private updateLatencyMetrics(result: LoadTestResult, duration: number): void {
    result.latency.min = Math.min(result.latency.min, duration);
    result.latency.max = Math.max(result.latency.max, duration);
    
    // Update average (running average)
    const n = result.totalRequests;
    result.latency.average = ((result.latency.average * (n - 1)) + duration) / n;
  }
  
  private startMonitoring(config: LoadTestConfig): void {
    // Start metrics collection
    this.metrics.start();
    
    // Set up monitoring intervals
    if (config.monitoring.metricsInterval > 0) {
      setInterval(() => {
        this.collectMetrics();
      }, config.monitoring.metricsInterval * 1000);
    }
    
    if (config.monitoring.snapshotInterval > 0) {
      setInterval(() => {
        this.takeSnapshot();
      }, config.monitoring.snapshotInterval * 1000);
    }
  }
  
  private collectMetrics(): void {
    const metrics = this.metrics.getCurrentMetrics();
    console.log('Current metrics:', metrics);
  }
  
  private takeSnapshot(): void {
    // Take performance snapshot
    console.log('Taking performance snapshot');
  }
  
  private async analyzeResults(config: LoadTestConfig, result: LoadTestResult): Promise<void> {
    // Calculate final metrics
    result.errorRate = (result.failedRequests / result.totalRequests) * 100;
    
    // Calculate percentiles
    const latencies = this.metrics.getLatencies();
    result.latency.percentiles = this.calculatePercentiles(latencies);
    
    const throughputs = this.metrics.getThroughputs();
    result.throughput.average = this.average(throughputs);
    result.throughput.peak = Math.max(...throughputs);
    result.throughput.percentiles = this.calculatePercentiles(throughputs);
    
    // Identify bottlenecks
    result.bottlenecks = await this.identifyBottlenecks(result);
    
    // Generate recommendations
    result.recommendations = this.generateRecommendations(config, result);
    
    // Check success criteria
    result.passed = this.checkSuccessCriteria(config.successCriteria, result);
  }
  
  private calculatePercentiles(values: number[]): {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  } {
    if (values.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    
    return {
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p75: sorted[Math.floor(sorted.length * 0.75)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }
  
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  private async identifyBottlenecks(result: LoadTestResult): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];
    
    // Check latency bottlenecks
    if (result.latency.percentiles.p95 > PERFORMANCE_TARGETS.P95_LATENCY_MS) {
      bottlenecks.push({
        component: 'Latency',
        metric: 'P95',
        value: result.latency.percentiles.p95,
        threshold: PERFORMANCE_TARGETS.P95_LATENCY_MS,
        impact: 'high',
        suggestion: 'Optimize slow operations or add caching',
      });
    }
    
    // Check throughput bottlenecks
    if (result.throughput.average < PERFORMANCE_TARGETS.MAX_WORKFLOWS_PER_SECOND * 0.5) {
      bottlenecks.push({
        component: 'Throughput',
        metric: 'Average RPS',
        value: result.throughput.average,
        threshold: PERFORMANCE_TARGETS.MAX_WORKFLOWS_PER_SECOND * 0.5,
        impact: 'medium',
        suggestion: 'Scale up resources or optimize processing',
      });
    }
    
    // Check error rate bottlenecks
    if (result.errorRate > PERFORMANCE_TARGETS.MAX_ERROR_RATE_PERCENT) {
      bottlenecks.push({
        component: 'Reliability',
        metric: 'Error Rate',
        value: result.errorRate,
        threshold: PERFORMANCE_TARGETS.MAX_ERROR_RATE_PERCENT,
        impact: 'high',
        suggestion: 'Fix errors and improve error handling',
      });
    }
    
    // Check resource bottlenecks
    if (result.resourceUsage.cpu.p95 > 80) {
      bottlenecks.push({
        component: 'CPU',
        metric: 'P95 Usage',
        value: result.resourceUsage.cpu.p95,
        threshold: 80,
        impact: 'medium',
        suggestion: 'Optimize CPU-intensive operations',
      });
    }
    
    if (result.resourceUsage.memory.p95 > 90) {
      bottlenecks.push({
        component: 'Memory',
        metric: 'P95 Usage',
        value: result.resourceUsage.memory.p95,
        threshold: 90,
        impact: 'high',
        suggestion: 'Reduce memory usage or increase limits',
      });
    }
    
    return bottlenecks;
  }
  
  private generateRecommendations(config: LoadTestConfig, result: LoadTestResult): string[] {
    const recommendations: string[] = [];
    
    // Performance recommendations
    if (result.latency.percentiles.p95 > config.successCriteria.maxP95Latency) {
      recommendations.push(
        `P95 latency (${result.latency.percentiles.p95}ms) exceeds target (${config.successCriteria.maxP95Latency}ms). ` +
        `Consider implementing caching, optimizing database queries, or adding more workers.`
      );
    }
    
    // Throughput recommendations
    if (result.throughput.average < config.successCriteria.minThroughput) {
      recommendations.push(
        `Average throughput (${result.throughput.average.toFixed(2)} RPS) below target (${config.successCriteria.minThroughput} RPS). ` +
        `Consider horizontal scaling or optimizing workflow processing.`
      );
    }
    
    // Error rate recommendations
    if (result.errorRate > config.successCriteria.maxErrorRate) {
      const topErrors = result.errors.sort((a, b) => b.count - a.count).slice(0, 3);
      recommendations.push(
        `Error rate (${result.errorRate.toFixed(2)}%) exceeds target (${config.successCriteria.maxErrorRate}%). ` +
        `Top errors: ${topErrors.map(e => e.error).join(', ')}. ` +
        `Implement retry logic and improve error handling.`
      );
    }
    
    // Resource recommendations
    if (result.resourceUsage.cpu.p95 > 70) {
      recommendations.push(
        `High CPU usage detected (P95: ${result.resourceUsage.cpu.p95}%). ` +
        `Profile CPU-intensive operations and consider optimization or parallelization.`
      );
    }
    
    if (result.resourceUsage.memory.p95 > 80) {
      recommendations.push(
        `High memory usage detected (P95: ${result.resourceUsage.memory.p95}%). ` +
        `Review memory allocations and implement proper cleanup.`
      );
    }
    
    // Bottleneck-specific recommendations
    for (const bottleneck of result.bottlenecks) {
      if (bottleneck.impact === 'high' && !recommendations.includes(bottleneck.suggestion)) {
        recommendations.push(bottleneck.suggestion);
      }
    }
    
    // General optimization recommendations
    if (result.concurrency.peak > config.targetConcurrency * 1.2) {
      recommendations.push(
        `Peak concurrency (${result.concurrency.peak}) exceeded target by >20%. ` +
        `Implement request queuing or rate limiting to smooth load.`
      );
    }
    
    return recommendations;
  }
  
  private checkSuccessCriteria(criteria: SuccessCriteria, result: LoadTestResult): boolean {
    return (
      result.errorRate <= criteria.maxErrorRate &&
      result.latency.percentiles.p95 <= criteria.maxP95Latency &&
      result.latency.percentiles.p99 <= criteria.maxP99Latency &&
      result.throughput.average >= criteria.minThroughput &&
      result.concurrency.peak <= criteria.maxConcurrentWorkflows
    );
  }
  
  private async generateReport(result: LoadTestResult): Promise<void> {
    // Generate detailed HTML report
    const report = this.generateHTMLReport(result);
    
    // Save to R2
    await this.r2.put(
      `load-tests/${result.testName}-${Date.now()}.html`,
      report
    );
    
    // Export metrics to analytics
    await this.exportMetrics(result);
    
    console.log(`Load test report generated: ${result.testName}`);
    console.log(`Passed: ${result.passed}`);
    console.log(`Error rate: ${result.errorRate.toFixed(2)}%`);
    console.log(`P95 latency: ${result.latency.percentiles.p95}ms`);
    console.log(`Throughput: ${result.throughput.average.toFixed(2)} RPS`);
  }
  
  private generateHTMLReport(result: LoadTestResult): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Load Test Report: ${result.testName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { background: #333; color: white; padding: 20px; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
          .metric { background: #f5f5f5; padding: 15px; border-radius: 5px; }
          .metric h3 { margin-top: 0; color: #666; font-size: 14px; }
          .metric .value { font-size: 24px; font-weight: bold; }
          .passed { color: #4caf50; }
          .failed { color: #f44336; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; }
          .chart { margin: 20px 0; }
          .recommendation { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
          .bottleneck { background: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Load Test Report: ${result.testName}</h1>
          <p>Duration: ${(result.duration / 1000).toFixed(2)}s | 
             Start: ${result.startTime} | 
             End: ${result.endTime} | 
             Status: <span class="${result.passed ? 'passed' : 'failed'}">${result.passed ? 'PASSED' : 'FAILED'}</span>
          </p>
        </div>
        
        <div class="summary">
          <div class="metric">
            <h3>Total Requests</h3>
            <div class="value">${result.totalRequests.toLocaleString()}</div>
          </div>
          <div class="metric">
            <h3>Error Rate</h3>
            <div class="value ${result.errorRate > 5 ? 'failed' : 'passed'}">${result.errorRate.toFixed(2)}%</div>
          </div>
          <div class="metric">
            <h3>P95 Latency</h3>
            <div class="value">${result.latency.percentiles.p95}ms</div>
          </div>
          <div class="metric">
            <h3>Throughput</h3>
            <div class="value">${result.throughput.average.toFixed(2)} RPS</div>
          </div>
        </div>
        
        <h2>Latency Distribution</h2>
        <table>
          <tr>
            <th>Percentile</th>
            <th>Latency (ms)</th>
          </tr>
          <tr><td>Min</td><td>${result.latency.min}</td></tr>
          <tr><td>P50</td><td>${result.latency.percentiles.p50}</td></tr>
          <tr><td>P75</td><td>${result.latency.percentiles.p75}</td></tr>
          <tr><td>P90</td><td>${result.latency.percentiles.p90}</td></tr>
          <tr><td>P95</td><td>${result.latency.percentiles.p95}</td></tr>
          <tr><td>P99</td><td>${result.latency.percentiles.p99}</td></tr>
          <tr><td>Max</td><td>${result.latency.max}</td></tr>
        </table>
        
        ${result.errors.length > 0 ? `
          <h2>Errors</h2>
          <table>
            <tr>
              <th>Error</th>
              <th>Count</th>
              <th>Percentage</th>
              <th>Affected Scenarios</th>
            </tr>
            ${result.errors.map(e => `
              <tr>
                <td>${e.error}</td>
                <td>${e.count}</td>
                <td>${e.percentage.toFixed(2)}%</td>
                <td>${e.affectedScenarios.join(', ')}</td>
              </tr>
            `).join('')}
          </table>
        ` : ''}
        
        ${result.bottlenecks.length > 0 ? `
          <h2>Bottlenecks</h2>
          ${result.bottlenecks.map(b => `
            <div class="bottleneck">
              <strong>${b.component} - ${b.metric}</strong><br>
              Value: ${b.value} (Threshold: ${b.threshold})<br>
              Impact: ${b.impact}<br>
              Suggestion: ${b.suggestion}
            </div>
          `).join('')}
        ` : ''}
        
        ${result.recommendations.length > 0 ? `
          <h2>Recommendations</h2>
          ${result.recommendations.map(r => `
            <div class="recommendation">${r}</div>
          `).join('')}
        ` : ''}
        
        <h2>Resource Usage</h2>
        <table>
          <tr>
            <th>Resource</th>
            <th>Average</th>
            <th>Peak</th>
            <th>P95</th>
          </tr>
          <tr>
            <td>CPU (%)</td>
            <td>${result.resourceUsage.cpu.average.toFixed(1)}</td>
            <td>${result.resourceUsage.cpu.peak.toFixed(1)}</td>
            <td>${result.resourceUsage.cpu.p95.toFixed(1)}</td>
          </tr>
          <tr>
            <td>Memory (%)</td>
            <td>${result.resourceUsage.memory.average.toFixed(1)}</td>
            <td>${result.resourceUsage.memory.peak.toFixed(1)}</td>
            <td>${result.resourceUsage.memory.p95.toFixed(1)}</td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }
  
  private async exportMetrics(result: LoadTestResult): Promise<void> {
    // Export to analytics engine
    this.analytics.writeDataPoint({
      blobs: [result.testName],
      doubles: [
        result.totalRequests,
        result.errorRate,
        result.latency.percentiles.p95,
        result.throughput.average,
      ],
      indexes: [result.passed ? 'passed' : 'failed'],
    });
  }
  
  private async coolDown(duration: number): Promise<void> {
    console.log(`Cooling down for ${duration / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, duration));
  }
  
  private async cleanup(): Promise<void> {
    // Clear active workflows
    this.activeWorkflows.clear();
    
    // Reset metrics
    this.metrics.reset();
    
    // Clear abort controller
    this.abortController = null;
  }
}

// ============================================================================
// Metrics Collector
// ============================================================================

class MetricsCollector {
  private latencies: number[] = [];
  private throughputs: number[] = [];
  private errors: Map<string, number> = new Map();
  private startTime: number = 0;
  private requestCounts: number[] = [];
  private lastRequestTime: number = 0;
  
  constructor(private analytics: AnalyticsEngineDataset) {}
  
  start(): void {
    this.startTime = Date.now();
    this.reset();
  }
  
  reset(): void {
    this.latencies = [];
    this.throughputs = [];
    this.errors.clear();
    this.requestCounts = [];
    this.lastRequestTime = 0;
  }
  
  recordExecution(execution: WorkflowExecution): void {
    // Record latency
    this.latencies.push(execution.duration);
    
    // Update throughput
    const now = Date.now();
    if (this.lastRequestTime > 0) {
      const timeDiff = (now - this.lastRequestTime) / 1000;
      const throughput = 1 / timeDiff;
      this.throughputs.push(throughput);
    }
    this.lastRequestTime = now;
    
    // Track errors
    if (!execution.success && execution.error) {
      this.errors.set(execution.error, (this.errors.get(execution.error) || 0) + 1);
    }
  }
  
  getCurrentMetrics(): {
    requestCount: number;
    errorCount: number;
    avgLatency: number;
    currentThroughput: number;
  } {
    const requestCount = this.latencies.length;
    const errorCount = Array.from(this.errors.values()).reduce((a, b) => a + b, 0);
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;
    const currentThroughput = this.throughputs.length > 0
      ? this.throughputs[this.throughputs.length - 1]
      : 0;
    
    return {
      requestCount,
      errorCount,
      avgLatency,
      currentThroughput,
    };
  }
  
  getLatencies(): number[] {
    return [...this.latencies];
  }
  
  getThroughputs(): number[] {
    return [...this.throughputs];
  }
  
  getErrors(): Map<string, number> {
    return new Map(this.errors);
  }
}

// ============================================================================
// Helper Types and Interfaces
// ============================================================================

interface WorkflowExecution {
  id: string;
  scenario: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
  response?: any;
}

// ============================================================================
// Data Generators
// ============================================================================

function generateInvestmentData(): any {
  return {
    investorId: `investor_${Math.floor(Math.random() * 1000)}`,
    pitchId: `pitch_${Math.floor(Math.random() * 100)}`,
    creatorId: `creator_${Math.floor(Math.random() * 50)}`,
    proposedAmount: Math.floor(Math.random() * 1000000) + 10000,
    investmentType: ['equity', 'debt', 'convertible', 'revenue_share'][Math.floor(Math.random() * 4)],
    message: 'Interested in this investment opportunity',
    ndaAccepted: true,
  };
}

function generateProductionData(): any {
  return {
    companyId: `company_${Math.floor(Math.random() * 100)}`,
    companyName: `Production Company ${Math.floor(Math.random() * 100)}`,
    pitchId: `pitch_${Math.floor(Math.random() * 100)}`,
    budget: Math.floor(Math.random() * 10000000) + 100000,
    productionTimeline: '12-18 months',
    territory: ['worldwide', 'domestic', 'international'][Math.floor(Math.random() * 3)],
  };
}

function generateNDAData(): any {
  return {
    requesterId: `user_${Math.floor(Math.random() * 1000)}`,
    requesterType: ['investor', 'production', 'partner'][Math.floor(Math.random() * 3)],
    requesterEmail: `user${Math.floor(Math.random() * 1000)}@example.com`,
    requesterName: `User ${Math.floor(Math.random() * 1000)}`,
    creatorId: `creator_${Math.floor(Math.random() * 50)}`,
    pitchId: `pitch_${Math.floor(Math.random() * 100)}`,
    templateId: `template_${Math.floor(Math.random() * 10)}`,
    durationMonths: 24,
  };
}

// ============================================================================
// Export Load Test Module
// ============================================================================

export default {
  LoadTestRunner,
  PREDEFINED_SCENARIOS,
  generateInvestmentData,
  generateProductionData,
  generateNDAData,
};