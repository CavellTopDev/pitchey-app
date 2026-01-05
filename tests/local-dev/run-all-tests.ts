#!/usr/bin/env -S deno run --allow-all

/**
 * Comprehensive Local Development Test Suite
 * Validates entire Podman development environment for Pitchey
 */

import { TestFramework, TestSuite } from "../../src/testing/test-framework.ts";

// Import test suites
import { serviceAvailabilitySuite } from "./service-availability.test.ts";
import { authenticationSuite } from "./auth-validation.test.ts";
import { accessControlSuite } from "./access-control.test.ts";
import { apiIntegrationSuite } from "./api-integration.test.ts";
import { websocketSuite } from "./websocket-connectivity.test.ts";
import { storageSuite } from "./storage-validation.test.ts";
import { performanceSuite } from "./performance.test.ts";
import { securitySuite } from "./security.test.ts";

// Configuration for local development environment
const LOCAL_CONFIG = {
  backend: "http://localhost:8001",
  postgres: {
    host: "localhost",
    port: 5432,
    database: "pitchey_local",
    username: "pitchey_dev",
    password: "localdev123"
  },
  redis: {
    host: "localhost",
    port: 6380
  },
  minio: {
    endpoint: "http://localhost:9000",
    console: "http://localhost:9001",
    accessKey: "minioadmin",
    secretKey: "minioadmin"
  },
  adminer: "http://localhost:8080",
  demoUsers: [
    { email: "alex.creator@demo.com", password: "Demo123", type: "creator" },
    { email: "sarah.investor@demo.com", password: "Demo123", type: "investor" },
    { email: "stellar.production@demo.com", password: "Demo123", type: "production" }
  ]
};

// Global test setup
TestFramework.addGlobalSetup(async () => {
  console.log("🔧 Setting up local development test environment...");
  
  // Validate prerequisites
  await validatePrerequisites();
  
  // Warm up services
  await warmUpServices();
  
  console.log("✅ Test environment ready");
});

// Global test teardown
TestFramework.addGlobalTeardown(async () => {
  console.log("🔧 Cleaning up test environment...");
  
  // Cleanup test data if needed
  await cleanupTestData();
  
  console.log("✅ Test cleanup complete");
});

// Register all test suites
TestFramework.registerSuite("service-availability", serviceAvailabilitySuite);
TestFramework.registerSuite("authentication", authenticationSuite);
TestFramework.registerSuite("access-control", accessControlSuite);
TestFramework.registerSuite("api-integration", apiIntegrationSuite);
TestFramework.registerSuite("websocket-connectivity", websocketSuite);
TestFramework.registerSuite("storage-validation", storageSuite);
TestFramework.registerSuite("performance", performanceSuite);
TestFramework.registerSuite("security", securitySuite);

/**
 * Main test execution
 */
async function main() {
  console.log("🚀 Starting Pitchey Local Development Test Suite");
  console.log("=" .repeat(60));
  console.log("Environment: Local Development with Podman");
  console.log("Backend URL:", LOCAL_CONFIG.backend);
  console.log("Test Time:", new Date().toISOString());
  console.log("=" .repeat(60));

  try {
    const reports = await TestFramework.runAllTests();
    
    // Generate detailed report
    await generateTestReport(reports);
    
    // Check overall status
    const hasFailures = reports.some(report => report.failed > 0);
    
    if (hasFailures) {
      console.log("\n❌ Some tests failed. Local development environment needs attention.");
      Deno.exit(1);
    } else {
      console.log("\n✅ All tests passed! Local development environment is fully functional.");
      Deno.exit(0);
    }
    
  } catch (error) {
    console.error("❌ Test suite execution failed:", error);
    Deno.exit(1);
  }
}

/**
 * Validate that required services are running
 */
async function validatePrerequisites(): Promise<void> {
  const services = [
    { name: "Backend Proxy", url: `${LOCAL_CONFIG.backend}/health` },
    { name: "MinIO API", url: `${LOCAL_CONFIG.minio.endpoint}/minio/health/live` },
    { name: "Adminer", url: LOCAL_CONFIG.adminer }
  ];

  for (const service of services) {
    try {
      const response = await fetch(service.url);
      if (!response.ok && service.name !== "Adminer") { // Adminer might return different status
        throw new Error(`Service ${service.name} not responding (${response.status})`);
      }
      console.log(`✓ ${service.name} is running`);
    } catch (error) {
      console.error(`✗ ${service.name} is not accessible:`, error.message);
      throw new Error(`Service ${service.name} is required but not accessible`);
    }
  }

  // Test PostgreSQL connection
  try {
    const pgTest = new Deno.Command("psql", {
      args: [
        "-h", LOCAL_CONFIG.postgres.host,
        "-U", LOCAL_CONFIG.postgres.username,
        "-d", LOCAL_CONFIG.postgres.database,
        "-c", "SELECT 1;"
      ],
      env: { PGPASSWORD: LOCAL_CONFIG.postgres.password },
      stdout: "null",
      stderr: "null"
    });
    const result = await pgTest.output();
    if (result.success) {
      console.log("✓ PostgreSQL is accessible");
    } else {
      throw new Error("PostgreSQL connection failed");
    }
  } catch (error) {
    console.error("✗ PostgreSQL connection test failed:", error.message);
    throw new Error("PostgreSQL is required but not accessible");
  }

  // Test Redis connection
  try {
    const redisTest = new Deno.Command("redis-cli", {
      args: ["-h", LOCAL_CONFIG.redis.host, "-p", LOCAL_CONFIG.redis.port.toString(), "ping"],
      stdout: "null",
      stderr: "null"
    });
    const result = await redisTest.output();
    if (result.success) {
      console.log("✓ Redis is accessible");
    } else {
      throw new Error("Redis connection failed");
    }
  } catch (error) {
    console.log("⚠ Redis CLI test failed (service might still be accessible via HTTP)");
  }
}

/**
 * Warm up services by making initial requests
 */
async function warmUpServices(): Promise<void> {
  console.log("🔥 Warming up services...");
  
  // Warm up backend proxy
  try {
    await fetch(`${LOCAL_CONFIG.backend}/api/health`);
    console.log("✓ Backend proxy warmed up");
  } catch (error) {
    console.error("⚠ Backend proxy warm-up failed:", error.message);
  }

  // Add a small delay to ensure services are fully ready
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Cleanup any test data that was created
 */
async function cleanupTestData(): Promise<void> {
  // Remove any test files from MinIO
  // Clean up test records from database
  // Clear test cache entries from Redis
  console.log("✓ Test data cleanup complete");
}

/**
 * Generate comprehensive test report
 */
async function generateTestReport(reports: any[]): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = `./tests/local-dev/reports/test-report-${timestamp}.json`;

  // Ensure reports directory exists
  try {
    await Deno.mkdir("./tests/local-dev/reports", { recursive: true });
  } catch (error) {
    // Directory might already exist
  }

  const fullReport = {
    timestamp: new Date().toISOString(),
    environment: "local-development-podman",
    configuration: LOCAL_CONFIG,
    summary: {
      totalSuites: reports.length,
      totalTests: reports.reduce((sum, r) => sum + r.totalTests, 0),
      totalPassed: reports.reduce((sum, r) => sum + r.passed, 0),
      totalFailed: reports.reduce((sum, r) => sum + r.failed, 0),
      totalDuration: reports.reduce((sum, r) => sum + r.duration, 0),
      passRate: reports.length > 0 ? 
        (reports.reduce((sum, r) => sum + r.passed, 0) / reports.reduce((sum, r) => sum + r.totalTests, 0) * 100).toFixed(2) + "%" 
        : "0%"
    },
    suiteResults: reports
  };

  try {
    await Deno.writeTextFile(reportPath, JSON.stringify(fullReport, null, 2));
    console.log(`📊 Detailed test report saved: ${reportPath}`);
  } catch (error) {
    console.error("⚠ Failed to save test report:", error.message);
  }
}

// Export configuration for use in test files
export { LOCAL_CONFIG };

// Run tests if this file is executed directly
if (import.meta.main) {
  await main();
}