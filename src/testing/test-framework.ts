/**
 * Comprehensive Testing Framework
 * Provides automated testing capabilities for the Pitchey API
 */

import { telemetry } from "../utils/telemetry.ts";

export interface TestCase {
  id: string;
  name: string;
  description: string;
  category: "unit" | "integration" | "e2e" | "performance" | "security";
  priority: "low" | "medium" | "high" | "critical";
  timeout: number;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  test: () => Promise<TestResult>;
}

export interface TestResult {
  success: boolean;
  duration: number;
  message?: string;
  details?: any;
  error?: Error;
  metrics?: Record<string, number>;
}

export interface TestSuite {
  name: string;
  description: string;
  tests: TestCase[];
  beforeAll?: () => Promise<void>;
  afterAll?: () => Promise<void>;
}

export interface TestReport {
  suite: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  results: Array<{
    testId: string;
    name: string;
    success: boolean;
    duration: number;
    message?: string;
    error?: string;
  }>;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

export class TestFramework {
  private static suites = new Map<string, TestSuite>();
  private static globalSetup: (() => Promise<void>)[] = [];
  private static globalTeardown: (() => Promise<void>)[] = [];

  /**
   * Register a test suite
   */
  static registerSuite(name: string, suite: TestSuite): void {
    this.suites.set(name, suite);
  }

  /**
   * Add global setup function
   */
  static addGlobalSetup(setup: () => Promise<void>): void {
    this.globalSetup.push(setup);
  }

  /**
   * Add global teardown function
   */
  static addGlobalTeardown(teardown: () => Promise<void>): void {
    this.globalTeardown.push(teardown);
  }

  /**
   * Run all test suites
   */
  static async runAllTests(): Promise<TestReport[]> {
    console.log('🧪 Starting comprehensive test suite...');
    const reports: TestReport[] = [];

    try {
      // Run global setup
      console.log('🔧 Running global setup...');
      for (const setup of this.globalSetup) {
        await setup();
      }

      // Run each test suite
      for (const [suiteName, suite] of this.suites) {
        console.log(`\n🧪 Running test suite: ${suiteName}`);
        const report = await this.runSuite(suiteName, suite);
        reports.push(report);
        
        this.printSuiteReport(report);
      }

      // Run global teardown
      console.log('\n🔧 Running global teardown...');
      for (const teardown of this.globalTeardown) {
        await teardown();
      }

      this.printOverallReport(reports);
      return reports;

    } catch (error) {
      console.error('❌ Test suite execution failed:', error);
      telemetry.logger.error("Test suite execution failed", error);
      throw error;
    }
  }

  /**
   * Run a specific test suite
   */
  static async runSuite(name: string, suite: TestSuite): Promise<TestReport> {
    const startTime = Date.now();
    const results: TestReport['results'] = [];

    try {
      // Run suite setup
      if (suite.beforeAll) {
        await suite.beforeAll();
      }

      // Run individual tests
      for (const test of suite.tests) {
        console.log(`  ▶️ ${test.name}`);
        
        try {
          const result = await this.runTest(test);
          
          results.push({
            testId: test.id,
            name: test.name,
            success: result.success,
            duration: result.duration,
            message: result.message,
            error: result.error?.message
          });

          if (result.success) {
            console.log(`    ✅ PASS (${result.duration}ms)`);
          } else {
            console.log(`    ❌ FAIL (${result.duration}ms): ${result.message}`);
          }

        } catch (error) {
          results.push({
            testId: test.id,
            name: test.name,
            success: false,
            duration: 0,
            message: "Test execution error",
            error: error.message
          });
          console.log(`    ❌ ERROR: ${error.message}`);
        }
      }

      // Run suite teardown
      if (suite.afterAll) {
        await suite.afterAll();
      }

    } catch (error) {
      console.error(`❌ Suite setup/teardown failed for ${name}:`, error);
    }

    const duration = Date.now() - startTime;
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      suite: name,
      totalTests: results.length,
      passed,
      failed,
      skipped: 0,
      duration,
      results
    };
  }

  /**
   * Run an individual test
   */
  private static async runTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Run test setup
      if (test.setup) {
        await test.setup();
      }

      // Run the actual test with timeout
      const testPromise = test.test();
      const timeoutPromise = new Promise<TestResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Test timeout (${test.timeout}ms)`)), test.timeout);
      });

      const result = await Promise.race([testPromise, timeoutPromise]);
      
      // Run test teardown
      if (test.teardown) {
        await test.teardown();
      }

      return {
        ...result,
        duration: Date.now() - startTime
      };

    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        message: error.message,
        error
      };
    }
  }

  /**
   * Print suite report
   */
  private static printSuiteReport(report: TestReport): void {
    const passRate = (report.passed / report.totalTests * 100).toFixed(1);
    
    console.log(`\n📊 Suite Results: ${report.suite}`);
    console.log(`   Total: ${report.totalTests} | Passed: ${report.passed} | Failed: ${report.failed}`);
    console.log(`   Pass Rate: ${passRate}% | Duration: ${report.duration}ms`);
    
    if (report.failed > 0) {
      console.log('\n❌ Failed Tests:');
      report.results.filter(r => !r.success).forEach(result => {
        console.log(`   • ${result.name}: ${result.message || result.error}`);
      });
    }
  }

  /**
   * Print overall report
   */
  private static printOverallReport(reports: TestReport[]): void {
    const totalTests = reports.reduce((sum, r) => sum + r.totalTests, 0);
    const totalPassed = reports.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = reports.reduce((sum, r) => sum + r.failed, 0);
    const totalDuration = reports.reduce((sum, r) => sum + r.duration, 0);
    const passRate = totalTests > 0 ? (totalPassed / totalTests * 100).toFixed(1) : '0';

    console.log('\n' + '='.repeat(60));
    console.log('🏁 OVERALL TEST RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${totalPassed} (${passRate}%)`);
    console.log(`Failed: ${totalFailed}`);
    console.log(`Total Duration: ${totalDuration}ms`);
    
    const status = totalFailed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED';
    console.log(`Status: ${status}`);
    console.log('='.repeat(60));
  }

  /**
   * Create API test helper
   */
  static createApiTest(config: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
    expectedStatus: number;
    expectedData?: any;
  }): () => Promise<TestResult> {
    return async () => {
      try {
        const requestInit: RequestInit = {
          method: config.method,
          headers: {
            'Content-Type': 'application/json',
            ...config.headers
          }
        };

        if (config.body) {
          requestInit.body = JSON.stringify(config.body);
        }

        const response = await fetch(config.url, requestInit);
        const data = await response.json().catch(() => null);

        // Check status
        if (response.status !== config.expectedStatus) {
          return {
            success: false,
            duration: 0,
            message: `Expected status ${config.expectedStatus}, got ${response.status}`,
            details: { actualData: data }
          };
        }

        // Check expected data if provided
        if (config.expectedData) {
          const dataMatches = this.deepEqual(data, config.expectedData);
          if (!dataMatches) {
            return {
              success: false,
              duration: 0,
              message: "Response data doesn't match expected",
              details: { expected: config.expectedData, actual: data }
            };
          }
        }

        return {
          success: true,
          duration: 0,
          message: "API test passed",
          details: { response: data, status: response.status }
        };

      } catch (error) {
        return {
          success: false,
          duration: 0,
          message: error.message,
          error
        };
      }
    };
  }

  /**
   * Create performance test helper
   */
  static createPerformanceTest(config: {
    name: string;
    action: () => Promise<void>;
    maxDuration: number;
    iterations?: number;
  }): () => Promise<TestResult> {
    return async () => {
      const iterations = config.iterations || 1;
      const durations: number[] = [];

      try {
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          await config.action();
          durations.push(Date.now() - start);
        }

        const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const minDuration = Math.min(...durations);

        const success = maxDuration <= config.maxDuration;

        return {
          success,
          duration: avgDuration,
          message: success ? 
            `Performance test passed (avg: ${avgDuration.toFixed(2)}ms)` :
            `Performance test failed (max: ${maxDuration}ms > limit: ${config.maxDuration}ms)`,
          metrics: {
            avgDuration,
            maxDuration,
            minDuration,
            iterations
          }
        };

      } catch (error) {
        return {
          success: false,
          duration: 0,
          message: error.message,
          error
        };
      }
    };
  }

  // Helper methods

  private static deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }
    
    if (!a || !b || (typeof a !== "object" && typeof b !== "object")) {
      return a === b;
    }
    
    if (a === null || b === null) return false;
    if (a === undefined || b === undefined) return false;
    
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!this.deepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
}

// Pre-defined test suites

export const healthCheckSuite: TestSuite = {
  name: "Health Check Tests",
  description: "Validate system health and basic functionality",
  tests: [
    {
      id: "health_endpoint",
      name: "Health endpoint responds correctly",
      description: "Check that /api/health returns 200 with valid data",
      category: "integration",
      priority: "critical",
      timeout: 5000,
      test: TestFramework.createApiTest({
        url: "http://localhost:8001/api/health",
        method: "GET",
        expectedStatus: 200
      })
    },
    {
      id: "version_endpoint", 
      name: "Version endpoint responds correctly",
      description: "Check that /api/version returns version info",
      category: "integration",
      priority: "medium",
      timeout: 3000,
      test: TestFramework.createApiTest({
        url: "http://localhost:8001/api/version",
        method: "GET",
        expectedStatus: 200
      })
    }
  ]
};

export const authenticationSuite: TestSuite = {
  name: "Authentication Tests",
  description: "Validate authentication and authorization",
  tests: [
    {
      id: "login_valid_credentials",
      name: "Login with valid credentials",
      description: "Test successful login with demo account",
      category: "integration",
      priority: "critical",
      timeout: 5000,
      test: TestFramework.createApiTest({
        url: "http://localhost:8001/api/auth/login",
        method: "POST",
        body: {
          email: "alex.creator@demo.com",
          password: "Demo123"
        },
        expectedStatus: 200
      })
    },
    {
      id: "login_invalid_credentials",
      name: "Login with invalid credentials",
      description: "Test failed login with wrong credentials",
      category: "integration",
      priority: "high",
      timeout: 5000,
      test: TestFramework.createApiTest({
        url: "http://localhost:8001/api/auth/login",
        method: "POST",
        body: {
          email: "invalid@example.com",
          password: "wrongpassword"
        },
        expectedStatus: 401
      })
    }
  ]
};

export const performanceSuite: TestSuite = {
  name: "Performance Tests",
  description: "Validate system performance and response times",
  tests: [
    {
      id: "health_check_performance",
      name: "Health check response time",
      description: "Health endpoint should respond within 500ms",
      category: "performance",
      priority: "medium",
      timeout: 10000,
      test: TestFramework.createPerformanceTest({
        name: "Health Check",
        action: async () => {
          await fetch("http://localhost:8001/api/health");
        },
        maxDuration: 500,
        iterations: 5
      })
    }
  ]
};