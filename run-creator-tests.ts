#!/usr/bin/env deno run --allow-all

// CREATOR WORKFLOW TEST EXECUTION SCRIPT
// Run comprehensive creator workflow tests with detailed reporting
// Usage: deno run --allow-all run-creator-tests.ts [options]

import { runCreatorWorkflowTests } from "./tests/utilities/test-runner.ts";

interface CliOptions {
  help?: boolean;
  verbose?: boolean;
  e2e?: boolean;
  performance?: boolean;
  edgeCases?: boolean;
  quick?: boolean;
  report?: boolean;
  timeout?: number;
  retries?: boolean;
  cleanup?: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--verbose":
      case "-v":
        options.verbose = true;
        break;
      case "--e2e":
        options.e2e = true;
        break;
      case "--performance":
      case "--perf":
        options.performance = true;
        break;
      case "--edge-cases":
      case "--edge":
        options.edgeCases = true;
        break;
      case "--quick":
      case "-q":
        options.quick = true;
        break;
      case "--no-report":
        options.report = false;
        break;
      case "--timeout":
        options.timeout = parseInt(args[++i]);
        break;
      case "--no-retries":
        options.retries = false;
        break;
      case "--no-cleanup":
        options.cleanup = false;
        break;
    }
  }
  
  return options;
}

function printHelp() {
  console.log(`
🎬 Creator Workflow Test Suite Runner

USAGE:
  deno run --allow-all run-creator-tests.ts [OPTIONS]

OPTIONS:
  -h, --help         Show this help message
  -v, --verbose      Enable verbose output
  -q, --quick        Run only essential tests (faster execution)
  
  Test Categories:
  --e2e              Run only End-to-End tests
  --performance      Run only Performance tests  
  --edge-cases       Run only Edge Case tests
  
  Configuration:
  --timeout <ms>     Set test timeout in milliseconds (default: 60000)
  --no-retries       Disable automatic retry of failed tests
  --no-report        Skip generating HTML report
  --no-cleanup       Skip cleanup after tests

EXAMPLES:
  # Run all tests with verbose output
  deno run --allow-all run-creator-tests.ts --verbose

  # Run only E2E tests quickly
  deno run --allow-all run-creator-tests.ts --e2e --quick

  # Run performance tests with custom timeout
  deno run --allow-all run-creator-tests.ts --performance --timeout 30000

  # Run all tests without cleanup (for debugging)
  deno run --allow-all run-creator-tests.ts --no-cleanup --verbose

REQUIREMENTS:
  - Backend server running on port 8001
  - Database connection configured
  - Demo accounts available (alex.creator@demo.com, etc.)

COVERAGE TARGET: 98%+
TEST CATEGORIES: E2E, Performance, Edge Cases, Error Handling
`);
}

async function checkPrerequisites(): Promise<boolean> {
  console.log("🔍 Checking prerequisites...");
  
  try {
    // Check if server is running
    const response = await fetch("http://localhost:8001/api/health", {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) {
      console.error("❌ Backend server health check failed");
      return false;
    }
    
    console.log("✅ Backend server is running");

    // Check database connection (if health endpoint includes DB status)
    const healthData = await response.json();
    if (healthData.database === false) {
      console.error("❌ Database connection failed");
      return false;
    }
    
    console.log("✅ Database connection verified");

    // Check demo accounts
    try {
      const loginResponse = await fetch("http://localhost:8001/api/auth/creator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alex.creator@demo.com",
          password: "Demo123"
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (loginResponse.ok) {
        console.log("✅ Demo accounts accessible");
      } else {
        console.warn("⚠️ Demo account login failed - some tests may fail");
      }
    } catch (error) {
      console.warn("⚠️ Could not verify demo accounts");
    }

    return true;
    
  } catch (error) {
    console.error("❌ Prerequisite check failed:", error.message);
    console.error("\nPlease ensure:");
    console.error("1. Backend server is running: PORT=8001 deno run --allow-all working-server.ts");
    console.error("2. Database is connected and seeded");
    console.error("3. Demo accounts are available");
    return false;
  }
}

async function main() {
  const args = Deno.args;
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  console.log("🎬 Creator Workflow Test Suite");
  console.log("===============================");
  console.log(`Started at: ${new Date().toLocaleString()}`);
  console.log(`Deno version: ${Deno.version.deno}`);
  console.log(`TypeScript version: ${Deno.version.typescript}`);
  console.log("");

  // Check prerequisites
  const prereqsPassed = await checkPrerequisites();
  if (!prereqsPassed) {
    console.error("\n❌ Prerequisites not met. Exiting.");
    Deno.exit(1);
  }

  console.log("");

  try {
    // Configure test run based on CLI options
    const testConfig = {
      runE2E: options.quick ? true : (options.e2e ?? true),
      runPerformance: options.quick ? false : (options.performance ?? true),
      runEdgeCases: options.quick ? false : (options.edgeCases ?? true),
      verbose: options.verbose ?? false,
      generateReport: options.report ?? true,
      timeout: options.timeout ?? (options.quick ? 30000 : 60000),
      retryFailures: options.retries ?? true,
      cleanupAfter: options.cleanup ?? true,
      maxConcurrency: options.quick ? 1 : 3,
    };

    if (options.verbose) {
      console.log("Test Configuration:");
      console.log(`  E2E Tests: ${testConfig.runE2E}`);
      console.log(`  Performance Tests: ${testConfig.runPerformance}`);
      console.log(`  Edge Case Tests: ${testConfig.runEdgeCases}`);
      console.log(`  Timeout: ${testConfig.timeout}ms`);
      console.log(`  Retries: ${testConfig.retryFailures}`);
      console.log(`  Generate Report: ${testConfig.generateReport}`);
      console.log("");
    }

    // Run the test suite
    const suite = await runCreatorWorkflowTests(testConfig);

    // Print final summary
    console.log("\n" + "=".repeat(50));
    console.log("🏁 TEST SUITE COMPLETED");
    console.log("=".repeat(50));
    
    const successRate = (suite.passedCount / suite.tests.length) * 100;
    const statusIcon = successRate >= 95 ? "🎉" : successRate >= 80 ? "✅" : "⚠️";
    
    console.log(`${statusIcon} Overall Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`📊 Tests: ${suite.tests.length} total, ${suite.passedCount} passed, ${suite.failedCount} failed, ${suite.skippedCount} skipped`);
    console.log(`⏱️ Duration: ${(suite.totalDuration / 1000).toFixed(2)} seconds`);
    
    if (suite.coveragePercentage >= 98) {
      console.log("🎯 Target coverage achieved (98%+)!");
    } else {
      console.log(`📈 Coverage: ${suite.coveragePercentage.toFixed(1)}% (target: 98%)`);
    }

    // Exit with appropriate code
    if (suite.failedCount > 0) {
      console.log("\n❌ Some tests failed. See details above.");
      Deno.exit(1);
    } else {
      console.log("\n✅ All tests passed successfully!");
      Deno.exit(0);
    }

  } catch (error) {
    console.error("\n💥 Test suite execution failed:");
    console.error(error.message);
    
    if (options.verbose && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }

    console.error("\nTroubleshooting:");
    console.error("1. Verify backend server is running on port 8001");
    console.error("2. Check database connection and demo data");
    console.error("3. Run with --verbose for more details");
    console.error("4. Check network connectivity and permissions");

    Deno.exit(1);
  }
}

// Handle process signals for graceful shutdown
Deno.addSignalListener("SIGINT", () => {
  console.log("\n🛑 Test execution interrupted by user");
  Deno.exit(130);
});

Deno.addSignalListener("SIGTERM", () => {
  console.log("\n🛑 Test execution terminated");
  Deno.exit(143);
});

// Run main function
if (import.meta.main) {
  await main();
}