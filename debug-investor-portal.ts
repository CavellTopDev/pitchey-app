#!/usr/bin/env -S deno run --allow-all

// Comprehensive Investor Portal Debugging Script
// Tracks all requests, responses, and identifies failures

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const API_URL = "http://localhost:8001";
const FRONTEND_URL = "http://localhost:5173";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

// Log levels
const log = {
  info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  debug: (msg: string) => console.log(`${colors.magenta}[DEBUG]${colors.reset} ${msg}`),
  request: (method: string, url: string) => console.log(`${colors.cyan}[${method}]${colors.reset} ${url}`),
};

// Store for tracking requests
const requestLog: any[] = [];
const issues: any[] = [];

// Test investor credentials
const INVESTOR_EMAIL = "sarah.investor@demo.com";
const INVESTOR_PASSWORD = "Demo123";

async function testInvestorPortal() {
  console.log(`${colors.cyan}${"=".repeat(60)}`);
  console.log(`INVESTOR PORTAL COMPREHENSIVE DEBUG`);
  console.log(`${"=".repeat(60)}${colors.reset}\n`);

  // 1. Test Backend Health
  log.info("Testing backend health...");
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    if (healthResponse.ok) {
      log.success("Backend is running");
    } else {
      log.error(`Backend health check failed: ${healthResponse.status}`);
      issues.push({ type: "backend", issue: "Health check failed", status: healthResponse.status });
    }
  } catch (error) {
    log.error(`Cannot connect to backend: ${error.message}`);
    issues.push({ type: "connection", issue: "Backend unreachable", error: error.message });
    return;
  }

  // 2. Test Investor Login
  log.info("\nTesting investor login...");
  log.request("POST", "/api/auth/investor/login");
  
  let token = "";
  try {
    const loginResponse = await fetch(`${API_URL}/api/auth/investor/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: INVESTOR_EMAIL,
        password: INVESTOR_PASSWORD,
      }),
    });

    const loginData = await loginResponse.json();
    requestLog.push({
      endpoint: "/api/auth/investor/login",
      method: "POST",
      status: loginResponse.status,
      response: loginData,
    });

    if (loginResponse.ok && loginData.success) {
      token = loginData.data.token;
      log.success(`Login successful - Token: ${token.substring(0, 20)}...`);
      log.debug(`User ID: ${loginData.data.user.id}`);
      log.debug(`User Type: ${loginData.data.user.userType}`);
    } else {
      log.error(`Login failed: ${JSON.stringify(loginData)}`);
      issues.push({ 
        type: "auth", 
        issue: "Login failed", 
        response: loginData,
        expectedFields: ["token", "user"],
        receivedFields: Object.keys(loginData.data || {})
      });
      return;
    }
  } catch (error) {
    log.error(`Login request failed: ${error.message}`);
    issues.push({ type: "auth", issue: "Login request failed", error: error.message });
    return;
  }

  // 3. Test All Investor Endpoints
  const investorEndpoints = [
    { path: "/api/investor/dashboard", method: "GET", description: "Main dashboard" },
    { path: "/api/investor/profile", method: "GET", description: "User profile" },
    { path: "/api/investor/portfolio", method: "GET", description: "Investment portfolio" },
    { path: "/api/investor/portfolio/summary", method: "GET", description: "Portfolio summary" },
    { path: "/api/investor/opportunities", method: "GET", description: "Investment opportunities" },
    { path: "/api/investor/analytics", method: "GET", description: "Portfolio analytics" },
    { path: "/api/investor/investments", method: "GET", description: "Investment history" },
    { path: "/api/investor/watchlist", method: "GET", description: "Watchlist" },
    { path: "/api/investor/saved", method: "GET", description: "Saved pitches" },
    { path: "/api/investor/following", method: "GET", description: "Following activity" },
    { path: "/api/investor/notifications", method: "GET", description: "Notifications" },
    { path: "/api/investor/ndas", method: "GET", description: "NDA status" },
    { path: "/api/investor/recommendations", method: "GET", description: "AI recommendations" },
    { path: "/api/investor/tax/2024", method: "GET", description: "Tax documents" },
  ];

  log.info("\nTesting investor endpoints...\n");
  
  for (const endpoint of investorEndpoints) {
    log.request(endpoint.method, endpoint.path);
    
    try {
      const response = await fetch(`${API_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      requestLog.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        status: response.status,
        description: endpoint.description,
        response: data,
      });

      if (response.ok) {
        log.success(`✅ ${endpoint.description}: ${response.status}`);
        
        // Check response structure
        if (data.success === false) {
          log.warning(`   Response indicates failure: ${data.error || data.message}`);
          issues.push({
            type: "response_structure",
            endpoint: endpoint.path,
            issue: "Success=false in 200 response",
            data: data,
          });
        }
        
        // Verify expected data structure
        validateResponseStructure(endpoint.path, data);
        
      } else if (response.status === 404) {
        log.error(`❌ ${endpoint.description}: NOT FOUND`);
        issues.push({
          type: "missing_endpoint",
          endpoint: endpoint.path,
          issue: "Endpoint does not exist",
          status: 404,
        });
      } else if (response.status === 403) {
        log.error(`❌ ${endpoint.description}: FORBIDDEN`);
        issues.push({
          type: "authorization",
          endpoint: endpoint.path,
          issue: "Access denied",
          status: 403,
        });
      } else {
        log.error(`❌ ${endpoint.description}: ${response.status}`);
        log.debug(`   Response: ${JSON.stringify(data)}`);
        issues.push({
          type: "error",
          endpoint: endpoint.path,
          issue: `Unexpected status: ${response.status}`,
          response: data,
        });
      }
    } catch (error) {
      log.error(`❌ ${endpoint.description}: REQUEST FAILED`);
      log.debug(`   Error: ${error.message}`);
      issues.push({
        type: "request_failure",
        endpoint: endpoint.path,
        issue: "Request failed",
        error: error.message,
      });
    }
  }

  // 4. Test Frontend-Backend Data Mapping
  log.info("\n\nTesting data structure consistency...\n");
  
  // Check dashboard data structure
  const dashboardResponse = requestLog.find(r => r.endpoint === "/api/investor/dashboard");
  if (dashboardResponse && dashboardResponse.status === 200) {
    log.info("Checking dashboard data structure...");
    const expectedFields = ["portfolio", "watchlist", "recentActivity", "recommendations"];
    const actualFields = Object.keys(dashboardResponse.response.data || {});
    
    const missingFields = expectedFields.filter(f => !actualFields.includes(f));
    if (missingFields.length > 0) {
      log.warning(`Missing fields in dashboard: ${missingFields.join(", ")}`);
      issues.push({
        type: "data_structure",
        endpoint: "/api/investor/dashboard",
        issue: "Missing expected fields",
        expected: expectedFields,
        actual: actualFields,
        missing: missingFields,
      });
    }
  }

  // 5. Generate Report
  generateReport();
}

function validateResponseStructure(endpoint: string, data: any) {
  const expectedStructures: Record<string, string[]> = {
    "/api/investor/dashboard": ["portfolio", "watchlist", "recentActivity", "recommendations"],
    "/api/investor/portfolio": ["investments", "totalValue", "performance"],
    "/api/investor/opportunities": ["opportunities", "total", "filters"],
    "/api/investor/analytics": ["portfolioValue", "diversification", "performanceHistory", "insights"],
    "/api/investor/investments": ["investments", "total"],
  };

  const expected = expectedStructures[endpoint];
  if (expected) {
    const actual = Object.keys(data.data || data || {});
    const missing = expected.filter(field => !actual.some(a => a === field));
    
    if (missing.length > 0) {
      log.warning(`   ⚠️ Missing fields: ${missing.join(", ")}`);
      issues.push({
        type: "missing_fields",
        endpoint: endpoint,
        issue: "Response missing expected fields",
        missing: missing,
        expected: expected,
        actual: actual,
      });
    }
  }
}

function generateReport() {
  console.log(`\n${colors.cyan}${"=".repeat(60)}`);
  console.log(`DEBUGGING REPORT`);
  console.log(`${"=".repeat(60)}${colors.reset}\n`);

  // Summary
  const endpointStats = {
    total: requestLog.length,
    successful: requestLog.filter(r => r.status === 200).length,
    notFound: requestLog.filter(r => r.status === 404).length,
    errors: requestLog.filter(r => r.status >= 400).length,
  };

  log.info("Endpoint Statistics:");
  console.log(`  Total endpoints tested: ${endpointStats.total}`);
  console.log(`  Successful (200): ${endpointStats.successful}`);
  console.log(`  Not Found (404): ${endpointStats.notFound}`);
  console.log(`  Errors (4xx/5xx): ${endpointStats.errors}`);

  // Issues Summary
  if (issues.length > 0) {
    console.log(`\n${colors.red}ISSUES FOUND: ${issues.length}${colors.reset}\n`);
    
    // Group issues by type
    const issuesByType = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [type, typeIssues] of Object.entries(issuesByType)) {
      console.log(`\n${colors.yellow}${type.toUpperCase()} ISSUES (${typeIssues.length}):${colors.reset}`);
      
      typeIssues.forEach((issue, index) => {
        console.log(`\n  ${index + 1}. ${issue.endpoint || issue.issue}`);
        if (issue.missing) {
          console.log(`     Missing fields: ${issue.missing.join(", ")}`);
        }
        if (issue.error) {
          console.log(`     Error: ${issue.error}`);
        }
        if (issue.status) {
          console.log(`     Status: ${issue.status}`);
        }
      });
    }
  } else {
    console.log(`\n${colors.green}No issues found!${colors.reset}`);
  }

  // Missing Endpoints
  const missingEndpoints = issues.filter(i => i.type === "missing_endpoint");
  if (missingEndpoints.length > 0) {
    console.log(`\n${colors.red}MISSING ENDPOINTS:${colors.reset}`);
    missingEndpoints.forEach(e => {
      console.log(`  - ${e.endpoint}`);
    });
  }

  // Write detailed JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: endpointStats,
    issues: issues,
    requestLog: requestLog,
    recommendations: generateRecommendations(),
  };

  Deno.writeTextFileSync(
    "investor-portal-debug-report.json",
    JSON.stringify(report, null, 2)
  );
  
  console.log(`\n${colors.green}📄 Detailed report saved to: investor-portal-debug-report.json${colors.reset}`);
}

function generateRecommendations(): string[] {
  const recommendations: string[] = [];
  
  const missingEndpoints = issues.filter(i => i.type === "missing_endpoint");
  if (missingEndpoints.length > 0) {
    recommendations.push(`Implement ${missingEndpoints.length} missing endpoints in backend`);
  }
  
  const dataStructureIssues = issues.filter(i => i.type === "data_structure" || i.type === "missing_fields");
  if (dataStructureIssues.length > 0) {
    recommendations.push("Align backend response structures with frontend expectations");
  }
  
  const authIssues = issues.filter(i => i.type === "authorization");
  if (authIssues.length > 0) {
    recommendations.push("Review role-based access control for investor endpoints");
  }
  
  return recommendations;
}

// Run the debugging
await testInvestorPortal();