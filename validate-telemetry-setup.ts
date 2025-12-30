#!/usr/bin/env -S deno run --allow-net --allow-read

/**
 * Complete Telemetry Setup Validation
 * Validates all aspects of the observability implementation
 */

interface ValidationResult {
  component: string;
  status: "✅ Pass" | "⚠️ Warning" | "❌ Fail";
  details: string;
  recommendation?: string;
}

const BACKEND_URL = "https://pitchey-backend-fresh.deno.dev";
const FRONTEND_URL = "https://pitchey-5o8.pages.dev";

async function validateBackendTelemetry(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  // Check health endpoint
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    const health = await response.json();
    
    if (response.ok) {
      results.push({
        component: "Backend Health Endpoint",
        status: "✅ Pass",
        details: `Responding with status ${response.status}`
      });
      
      // Check telemetry configuration
      const telemetry = health.data?.telemetry;
      if (telemetry) {
        results.push({
          component: "Sentry Configuration",
          status: telemetry.config?.sentryConfigured ? "✅ Pass" : "❌ Fail",
          details: `Sentry configured: ${telemetry.config?.sentryConfigured}, Environment: ${telemetry.environment}`,
          recommendation: !telemetry.config?.sentryConfigured ? "Configure SENTRY_DSN environment variable" : undefined
        });
        
        results.push({
          component: "Telemetry Initialization", 
          status: telemetry.initialized ? "✅ Pass" : "⚠️ Warning",
          details: `Initialized: ${telemetry.initialized}, Sample rate: ${telemetry.config?.sampleRate}`,
          recommendation: !telemetry.initialized ? "Check Sentry DSN format and network connectivity" : undefined
        });
      } else {
        results.push({
          component: "Telemetry Status",
          status: "❌ Fail", 
          details: "No telemetry information in health response",
          recommendation: "Verify telemetry integration in working-server.ts"
        });
      }
      
    } else {
      results.push({
        component: "Backend Health Endpoint",
        status: "❌ Fail",
        details: `Health endpoint returned ${response.status}`,
        recommendation: "Check backend deployment status"
      });
    }
    
  } catch (error) {
    results.push({
      component: "Backend Connectivity",
      status: "❌ Fail",
      details: `Cannot reach backend: ${error.message}`,
      recommendation: "Verify backend deployment and URL"
    });
  }
  
  return results;
}

async function validateFrontendDeployment(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  try {
    const response = await fetch(FRONTEND_URL);
    
    if (response.ok) {
      results.push({
        component: "Frontend Deployment",
        status: "✅ Pass",
        details: `Frontend accessible at ${FRONTEND_URL}`
      });
      
      // Check if page contains expected content
      const content = await response.text();
      const hasPitcheyContent = content.includes("Pitchey") || content.includes("pitch");
      
      results.push({
        component: "Frontend Content",
        status: hasPitcheyContent ? "✅ Pass" : "⚠️ Warning",
        details: hasPitcheyContent ? "Page contains expected Pitchey content" : "Page content may not be fully loaded",
        recommendation: !hasPitcheyContent ? "Verify frontend build and deployment" : undefined
      });
      
    } else {
      results.push({
        component: "Frontend Deployment",
        status: "❌ Fail", 
        details: `Frontend returned ${response.status}`,
        recommendation: "Check Cloudflare Pages deployment"
      });
    }
    
  } catch (error) {
    results.push({
      component: "Frontend Connectivity",
      status: "❌ Fail",
      details: `Cannot reach frontend: ${error.message}`,
      recommendation: "Verify Cloudflare Pages deployment"
    });
  }
  
  return results;
}

async function validateAPIEndpoints(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  const endpoints = [
    { path: "/api/pitches/featured", expectedStatus: [200] },
    { path: "/api/auth/status", expectedStatus: [401] }, // Should require auth
    { path: "/api/nonexistent", expectedStatus: [401, 404] } // Should handle gracefully
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint.path}`);
      const isExpected = endpoint.expectedStatus.includes(response.status);
      
      results.push({
        component: `API ${endpoint.path}`,
        status: isExpected ? "✅ Pass" : "⚠️ Warning",
        details: `Returned ${response.status} (expected ${endpoint.expectedStatus.join(' or ')})`,
        recommendation: !isExpected ? "Review API error handling and response codes" : undefined
      });
      
    } catch (error) {
      results.push({
        component: `API ${endpoint.path}`,
        status: "❌ Fail",
        details: `Request failed: ${error.message}`,
        recommendation: "Check API connectivity and error handling"
      });
    }
  }
  
  return results;
}

async function validateConfigurationFiles(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  const requiredFiles = [
    { path: "./src/utils/telemetry.ts", description: "Backend telemetry system" },
    { path: "./frontend/src/utils/telemetry.ts", description: "Frontend telemetry system" },
    { path: "./SENTRY_CONFIGURATION_GUIDE.md", description: "Sentry setup guide" },
    { path: "./TELEMETRY_USAGE_GUIDE.md", description: "Team usage documentation" },
    { path: "./health-check.ts", description: "Health monitoring script" }
  ];
  
  for (const file of requiredFiles) {
    try {
      const stat = await Deno.stat(file.path);
      results.push({
        component: file.description,
        status: "✅ Pass",
        details: `File exists: ${file.path} (${Math.round(stat.size / 1024)}KB)`
      });
    } catch {
      results.push({
        component: file.description,
        status: "❌ Fail", 
        details: `Missing file: ${file.path}`,
        recommendation: `Create ${file.description.toLowerCase()}`
      });
    }
  }
  
  return results;
}

async function runCompleteValidation(): Promise<void> {
  console.log("🔍 Pitchey Telemetry Setup Validation");
  console.log("=" .repeat(50));
  console.log();
  
  const allResults: ValidationResult[] = [];
  
  // Run all validation checks
  console.log("📡 Validating Backend Telemetry...");
  const backendResults = await validateBackendTelemetry();
  allResults.push(...backendResults);
  
  console.log("\n🌐 Validating Frontend Deployment...");
  const frontendResults = await validateFrontendDeployment();
  allResults.push(...frontendResults);
  
  console.log("\n🔌 Validating API Endpoints...");
  const apiResults = await validateAPIEndpoints();
  allResults.push(...apiResults);
  
  console.log("\n📁 Validating Configuration Files...");
  const fileResults = await validateConfigurationFiles();
  allResults.push(...fileResults);
  
  // Summary report
  console.log("\n" + "=" .repeat(50));
  console.log("📋 Validation Summary");
  console.log("=" .repeat(50));
  
  const passCount = allResults.filter(r => r.status === "✅ Pass").length;
  const warnCount = allResults.filter(r => r.status === "⚠️ Warning").length;
  const failCount = allResults.filter(r => r.status === "❌ Fail").length;
  
  console.log(`✅ Passed: ${passCount}`);
  console.log(`⚠️ Warnings: ${warnCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📊 Success Rate: ${Math.round((passCount / allResults.length) * 100)}%`);
  
  console.log("\n📝 Detailed Results:");
  for (const result of allResults) {
    console.log(`${result.status} ${result.component}`);
    console.log(`   ${result.details}`);
    if (result.recommendation) {
      console.log(`   💡 ${result.recommendation}`);
    }
    console.log();
  }
  
  // Overall assessment
  if (failCount === 0 && warnCount === 0) {
    console.log("🎉 Perfect! Telemetry setup is fully operational.");
  } else if (failCount === 0) {
    console.log("✅ Good! Telemetry setup is working with minor warnings.");
  } else if (failCount <= 2) {
    console.log("⚠️ Mostly working, but some issues need attention.");
  } else {
    console.log("❌ Several issues detected. Review recommendations above.");
  }
  
  console.log("\n🚀 Next Steps:");
  console.log("1. Address any failed validations");
  console.log("2. Check Sentry dashboard for incoming events");
  console.log("3. Set up team alerts and notifications");
  console.log("4. Schedule regular health checks");
  
  console.log("\n📊 Monitoring URLs:");
  console.log(`- Backend Health: ${BACKEND_URL}/api/health`);
  console.log(`- Frontend: ${FRONTEND_URL}`);
  console.log(`- Sentry Dashboard: https://sentry.io/organizations/`);
}

// Run complete validation
await runCompleteValidation();