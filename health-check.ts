#!/usr/bin/env -S deno run --allow-net

/**
 * Production Health Check Script
 * Validates all Pitchey services and reports to monitoring
 */

const ENDPOINTS = [
  "https://pitchey-backend-fresh.deno.dev/api/health",
  "https://pitchey-5o8.pages.dev",
  "https://pitchey-api-prod.ndlovucavelle.workers.dev/health"
];

const CRITICAL_APIS = [
  "https://pitchey-backend-fresh.deno.dev/api/auth/status",
  "https://pitchey-backend-fresh.deno.dev/api/pitches/featured",
  "https://pitchey-backend-fresh.deno.dev/api/user/notifications"
];

async function checkEndpoint(url: string): Promise<{url: string, status: number, responseTime: number, error?: string}> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, { 
      method: 'GET',
      headers: { 'User-Agent': 'Pitchey-HealthCheck/1.0' }
    });
    
    const responseTime = performance.now() - startTime;
    
    return {
      url,
      status: response.status,
      responseTime: Math.round(responseTime)
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      url,
      status: 0,
      responseTime: Math.round(responseTime),
      error: error.message
    };
  }
}

async function runHealthChecks(): Promise<void> {
  console.log("🏥 Running Pitchey Health Checks\n");
  
  const allChecks = [...ENDPOINTS, ...CRITICAL_APIS];
  const results = await Promise.all(allChecks.map(checkEndpoint));
  
  let healthyCount = 0;
  let criticalIssues = 0;
  
  for (const result of results) {
    const statusEmoji = result.status === 200 ? "✅" : result.status === 0 ? "🔴" : "⚠️";
    const timeColor = result.responseTime > 2000 ? "🐌" : result.responseTime > 1000 ? "⏰" : "⚡";
    
    console.log(`${statusEmoji} ${result.url}`);
    console.log(`   Status: ${result.status} | Response Time: ${timeColor} ${result.responseTime}ms`);
    
    if (result.error) {
      console.log(`   Error: ${result.error}`);
      criticalIssues++;
    }
    
    if (result.status === 200 && result.responseTime < 2000) {
      healthyCount++;
    } else if (result.status !== 200) {
      criticalIssues++;
    }
    
    console.log();
  }
  
  const overallHealth = (healthyCount / allChecks.length) * 100;
  
  console.log(`📊 Overall Health: ${overallHealth.toFixed(1)}% (${healthyCount}/${allChecks.length} healthy)`);
  console.log(`🚨 Critical Issues: ${criticalIssues}`);
  
  if (criticalIssues > 0) {
    console.log("\n🔔 Consider investigating critical issues immediately");
  }
  
  if (overallHealth < 90) {
    console.log("\n⚠️  System health below 90% - review required");
  } else {
    console.log("\n✅ System health looks good!");
  }
}

// Run health checks
await runHealthChecks();
