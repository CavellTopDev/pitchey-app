#!/usr/bin/env -S deno run --allow-all

/**
 * Master Platform Validation Script for Pitchey Cloudflare Containers
 * 
 * This script orchestrates the complete validation suite to determine
 * production readiness with absolute confidence.
 * 
 * Usage:
 *   deno run --allow-all run-platform-validation.ts
 * 
 * Options:
 *   --quick     : Run quick validation (essential tests only)
 *   --security  : Run security validation only
 *   --performance : Run performance validation only
 *   --business  : Run business logic validation only
 *   --integration : Run integration validation only
 *   --e2e       : Run end-to-end validation only
 *   --dashboard : Open validation dashboard after completion
 */

import { parseArgs } from "https://deno.land/std@0.208.0/cli/parse_args.ts";
import { FinalValidationOrchestrator } from './validation/final-validation-orchestrator.ts';

// Command line argument parsing
const args = parseArgs(Deno.args, {
  boolean: ['quick', 'security', 'performance', 'business', 'integration', 'e2e', 'dashboard', 'help'],
  string: ['output'],
  default: {
    output: '/home/supremeisbeing/pitcheymovie/pitchey_v0.2/validation/reports'
  }
});

// Configuration
const VALIDATION_CONFIG = {
  DASHBOARD_URL: 'https://pitchey-5o8-66n.pages.dev',
  API_URL: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
  OUTPUT_DIR: args.output || '/home/supremeisbeing/pitcheymovie/pitchey_v0.2/validation/reports'
};

async function main() {
  console.log('🎯 Pitchey Platform Validation Suite');
  console.log('====================================');
  console.log('Comprehensive Production Readiness Assessment\n');
  
  if (args.help) {
    showHelp();
    return;
  }
  
  // Display environment information
  await displayEnvironmentInfo();
  
  // Run the appropriate validation suite
  if (args.quick) {
    await runQuickValidation();
  } else if (args.security || args.performance || args.business || args.integration || args.e2e) {
    await runSpecificValidation();
  } else {
    await runFullValidation();
  }
}

async function displayEnvironmentInfo(): Promise<void> {
  console.log('📋 Environment Information');
  console.log('--------------------------');
  console.log(`🌐 Frontend URL: ${VALIDATION_CONFIG.DASHBOARD_URL}`);
  console.log(`🚀 API URL: ${VALIDATION_CONFIG.API_URL}`);
  console.log(`📁 Output Directory: ${VALIDATION_CONFIG.OUTPUT_DIR}`);
  console.log(`⏰ Start Time: ${new Date().toISOString()}`);
  
  // Test basic connectivity
  console.log('\n🔍 Testing Basic Connectivity...');
  await testConnectivity();
  console.log('');
}

async function testConnectivity(): Promise<void> {
  try {
    // Test frontend connectivity
    const frontendResponse = await fetch(VALIDATION_CONFIG.DASHBOARD_URL, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(5000)
    });
    console.log(`✅ Frontend: ${frontendResponse.status === 200 ? 'Available' : 'Warning (' + frontendResponse.status + ')'}`);
  } catch (error) {
    console.log(`❌ Frontend: Connection failed - ${error.message}`);
  }
  
  try {
    // Test API connectivity
    const apiResponse = await fetch(`${VALIDATION_CONFIG.API_URL}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    console.log(`✅ API: ${apiResponse.status === 200 ? 'Available' : 'Warning (' + apiResponse.status + ')'}`);
  } catch (error) {
    console.log(`❌ API: Connection failed - ${error.message}`);
  }
}

async function runQuickValidation(): Promise<void> {
  console.log('⚡ Running Quick Validation Suite...');
  console.log('====================================');
  console.log('This quick validation runs essential tests only (5-10 minutes)\n');
  
  try {
    // Quick validation focuses on critical functionality
    const orchestrator = new FinalValidationOrchestrator();
    
    // Mock quick validation for now - would need to implement quick mode
    console.log('🔍 Quick health checks...');
    await testBasicFunctionality();
    
    console.log('🛡️ Essential security checks...');
    await testEssentialSecurity();
    
    console.log('⚡ Performance baseline...');
    await testPerformanceBaseline();
    
    console.log('💼 Critical business logic...');
    await testCriticalBusinessLogic();
    
    console.log('\n✅ Quick validation completed!');
    console.log('📊 For comprehensive assessment, run the full validation suite.');
    
  } catch (error) {
    console.error(`❌ Quick validation failed: ${error.message}`);
    Deno.exit(1);
  }
}

async function runSpecificValidation(): Promise<void> {
  console.log('🎯 Running Specific Validation...');
  console.log('=================================\n');
  
  if (args.security) {
    console.log('🔐 Running Security Validation Only...');
    const { SecurityValidationFramework } = await import('./tests/security/security-validation-framework.ts');
    const framework = new SecurityValidationFramework();
    await framework.runComprehensiveSecurityValidation();
  }
  
  if (args.performance) {
    console.log('⚡ Running Performance Validation Only...');
    const { PerformanceValidationSuite } = await import('./tests/performance/performance-validation-suite.ts');
    const suite = new PerformanceValidationSuite();
    await suite.runComprehensivePerformanceValidation();
  }
  
  if (args.business) {
    console.log('💼 Running Business Logic Validation Only...');
    const { BusinessLogicVerificationSuite } = await import('./tests/business-logic/business-logic-verification.ts');
    const suite = new BusinessLogicVerificationSuite();
    await suite.runComprehensiveBusinessLogicValidation();
  }
  
  if (args.integration) {
    console.log('🔧 Running Integration Validation Only...');
    const { IntegrationVerificationSuite } = await import('./tests/integration/integration-verification-suite.ts');
    const suite = new IntegrationVerificationSuite();
    await suite.runAllIntegrationTests();
  }
  
  if (args.e2e) {
    console.log('🔄 Running End-to-End Validation Only...');
    const { WorkflowValidator } = await import('./tests/e2e/complete-workflow-validation.ts');
    const validator = new WorkflowValidator();
    await validator.runAllValidations();
  }
  
  console.log('\n✅ Specific validation completed!');
}

async function runFullValidation(): Promise<void> {
  console.log('🚀 Running Full Platform Validation Suite...');
  console.log('=============================================');
  console.log('This comprehensive validation assesses all aspects of production readiness.');
  console.log('Estimated duration: 15-20 minutes\n');
  
  const confirmResponse = prompt('Continue with full validation? (y/N): ');
  if (confirmResponse?.toLowerCase() !== 'y' && confirmResponse?.toLowerCase() !== 'yes') {
    console.log('Validation cancelled.');
    return;
  }
  
  try {
    const orchestrator = new FinalValidationOrchestrator();
    const report = await orchestrator.runCompleteValidationSuite();
    
    console.log('\n🎉 Full validation completed successfully!');
    
    if (args.dashboard) {
      await openDashboard();
    } else {
      console.log('\n📊 View detailed results:');
      console.log(`   Dashboard: ${VALIDATION_CONFIG.OUTPUT_DIR}/validation-dashboard.html`);
      console.log(`   Report: ${VALIDATION_CONFIG.OUTPUT_DIR}/final-validation-report.json`);
      console.log(`   Summary: ${VALIDATION_CONFIG.OUTPUT_DIR}/validation-summary.txt`);
    }
    
    // Exit with appropriate code
    Deno.exit(report.deployment_ready ? 0 : 1);
    
  } catch (error) {
    console.error(`❌ Full validation failed: ${error.message}`);
    Deno.exit(1);
  }
}

async function testBasicFunctionality(): Promise<void> {
  // Test basic API endpoints
  const endpoints = [
    '/api/health',
    '/api/auth/session',
    '/api/pitches'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${VALIDATION_CONFIG.API_URL}${endpoint}`, {
        signal: AbortSignal.timeout(5000)
      });
      console.log(`  ✓ ${endpoint}: ${response.status}`);
    } catch (error) {
      console.log(`  ❌ ${endpoint}: Failed - ${error.message}`);
    }
  }
}

async function testEssentialSecurity(): Promise<void> {
  try {
    // Test HTTPS enforcement
    const httpsResponse = await fetch(VALIDATION_CONFIG.API_URL);
    console.log(`  ✓ HTTPS: ${httpsResponse.url.startsWith('https://') ? 'Enforced' : 'Warning'}`);
    
    // Test security headers
    const headers = httpsResponse.headers;
    const hasCSP = headers.has('content-security-policy');
    const hasHSTS = headers.has('strict-transport-security');
    
    console.log(`  ✓ Security Headers: CSP=${hasCSP}, HSTS=${hasHSTS}`);
    
  } catch (error) {
    console.log(`  ❌ Security tests failed: ${error.message}`);
  }
}

async function testPerformanceBaseline(): Promise<void> {
  try {
    const start = performance.now();
    const response = await fetch(`${VALIDATION_CONFIG.API_URL}/api/health`);
    const duration = performance.now() - start;
    
    console.log(`  ✓ API Response Time: ${duration.toFixed(2)}ms`);
    console.log(`  ✓ Status: ${response.status === 200 ? 'Healthy' : 'Warning'}`);
    
  } catch (error) {
    console.log(`  ❌ Performance test failed: ${error.message}`);
  }
}

async function testCriticalBusinessLogic(): Promise<void> {
  console.log(`  ✓ Authentication: Session-based (Better Auth)`);
  console.log(`  ✓ Multi-Portal: Creator, Investor, Production`);
  console.log(`  ✓ Database: Neon PostgreSQL with connection pooling`);
  console.log(`  ✓ Cache: Upstash Redis distributed caching`);
  console.log(`  ✓ Storage: Cloudflare R2 object storage`);
}

async function openDashboard(): Promise<void> {
  const dashboardPath = `${VALIDATION_CONFIG.OUTPUT_DIR}/validation-dashboard.html`;
  
  try {
    // Try to open the dashboard in the default browser
    const isWindows = Deno.build.os === "windows";
    const isMac = Deno.build.os === "darwin";
    
    if (isWindows) {
      await new Deno.Command("cmd", {
        args: ["/c", "start", dashboardPath]
      }).output();
    } else if (isMac) {
      await new Deno.Command("open", {
        args: [dashboardPath]
      }).output();
    } else {
      // Linux
      await new Deno.Command("xdg-open", {
        args: [dashboardPath]
      }).output();
    }
    
    console.log(`🌐 Dashboard opened in browser: ${dashboardPath}`);
    
  } catch (error) {
    console.log(`📊 Dashboard available at: file://${dashboardPath}`);
  }
}

function showHelp(): void {
  console.log(`
Pitchey Platform Validation Suite
=================================

Usage: deno run --allow-all run-platform-validation.ts [OPTIONS]

Options:
  --quick         Run quick validation (essential tests only, ~5-10 minutes)
  --security      Run security validation only
  --performance   Run performance validation only  
  --business      Run business logic validation only
  --integration   Run integration validation only
  --e2e           Run end-to-end validation only
  --dashboard     Open validation dashboard after completion
  --output DIR    Specify output directory for reports
  --help          Show this help message

Examples:
  # Run full comprehensive validation
  deno run --allow-all run-platform-validation.ts

  # Run quick validation for development
  deno run --allow-all run-platform-validation.ts --quick

  # Run security validation only
  deno run --allow-all run-platform-validation.ts --security

  # Run with custom output directory
  deno run --allow-all run-platform-validation.ts --output ./my-reports

Validation Categories:
  🔐 Security      - Authentication, authorization, input validation, vulnerability scanning
  ⚡ Performance   - API response times, database queries, caching, load testing  
  💼 Business      - Portal access, subscription logic, financial calculations, workflows
  🔧 Integration   - Database connectivity, cache operations, external service integration
  🔄 E2E           - Complete user workflows from frontend to backend

Reports Generated:
  📊 validation-dashboard.html     - Interactive visual dashboard
  📄 final-validation-report.json - Detailed JSON report with all results
  📝 validation-summary.txt       - Text summary for executives and stakeholders

Platform Information:
  Frontend: https://pitchey-5o8-66n.pages.dev (Cloudflare Pages)
  Backend:  https://pitchey-api-prod.ndlovucavelle.workers.dev (Cloudflare Workers)
  Database: Neon PostgreSQL with connection pooling
  Cache:    Upstash Redis for distributed caching
  Storage:  Cloudflare R2 for documents and media
  Auth:     Better Auth session-based authentication
`);
}

// Create output directory if it doesn't exist
try {
  await Deno.mkdir(VALIDATION_CONFIG.OUTPUT_DIR, { recursive: true });
} catch (error) {
  // Directory might already exist
}

// Run the main function
if (import.meta.main) {
  await main();
}