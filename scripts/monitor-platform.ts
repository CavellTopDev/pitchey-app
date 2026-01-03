#!/usr/bin/env -S deno run --allow-all

/**
 * Platform Monitoring Script
 * Continuous monitoring of Pitchey platform health, performance, and security
 */

import { brightGreen, brightRed, brightYellow, cyan } from "https://deno.land/std@0.210.0/fmt/colors.ts";

const API_URL = "https://pitchey-api-prod.ndlovucavelle.workers.dev";
const FRONTEND_URL = "https://95d9c96c.pitchey-5o8.pages.dev";

interface HealthCheck {
  name: string;
  endpoint: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  expectedStatus: number[];
  timeout: number;
}

interface MetricResult {
  endpoint: string;
  status: number;
  responseTime: number;
  success: boolean;
  error?: string;
  headers?: Headers;
}

class PlatformMonitor {
  private metrics: MetricResult[] = [];
  private startTime = Date.now();
  
  // Health checks to perform
  private healthChecks: HealthCheck[] = [
    {
      name: "API Health",
      endpoint: `${API_URL}/api/health`,
      method: "GET",
      expectedStatus: [200],
      timeout: 5000
    },
    {
      name: "Frontend Health",
      endpoint: FRONTEND_URL,
      method: "GET",
      expectedStatus: [200],
      timeout: 10000
    },
    {
      name: "Auth Endpoint",
      endpoint: `${API_URL}/api/auth/session`,
      method: "GET",
      expectedStatus: [200, 401],
      timeout: 5000
    },
    {
      name: "RBAC Permissions",
      endpoint: `${API_URL}/api/permissions/context`,
      method: "GET",
      expectedStatus: [200, 401],
      timeout: 5000
    },
    {
      name: "Browse Pitches",
      endpoint: `${API_URL}/api/pitches?limit=1`,
      method: "GET",
      expectedStatus: [200],
      timeout: 5000
    }
  ];

  async runHealthChecks(): Promise<void> {
    console.log(cyan("🏥 Running Health Checks...\n"));
    
    for (const check of this.healthChecks) {
      const result = await this.performCheck(check);
      this.metrics.push(result);
      
      const icon = result.success ? "✅" : "❌";
      const color = result.success ? brightGreen : brightRed;
      
      console.log(
        `${icon} ${check.name}: ${color(result.status.toString())} - ${result.responseTime}ms`
      );
      
      if (!result.success && result.error) {
        console.log(`   ${brightRed(result.error)}`);
      }
    }
  }

  async performCheck(check: HealthCheck): Promise<MetricResult> {
    const startTime = performance.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), check.timeout);
      
      const response = await fetch(check.endpoint, {
        method: check.method,
        headers: check.headers,
        body: check.body,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const responseTime = Math.round(performance.now() - startTime);
      
      return {
        endpoint: check.endpoint,
        status: response.status,
        responseTime,
        success: check.expectedStatus.includes(response.status),
        headers: response.headers
      };
    } catch (error) {
      return {
        endpoint: check.endpoint,
        status: 0,
        responseTime: Math.round(performance.now() - startTime),
        success: false,
        error: error.message
      };
    }
  }

  async checkSecurityHeaders(): Promise<void> {
    console.log(cyan("\n🔒 Checking Security Headers...\n"));
    
    const response = await fetch(`${API_URL}/api/health`);
    const headers = response.headers;
    
    const securityHeaders = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Strict-Transport-Security',
      'X-XSS-Protection',
      'Referrer-Policy'
    ];
    
    for (const header of securityHeaders) {
      const value = headers.get(header);
      if (value) {
        console.log(`✅ ${header}: ${brightGreen(value.substring(0, 50) + '...')}`);
      } else {
        console.log(`❌ ${header}: ${brightRed('Missing')}`);
      }
    }
  }

  async checkPerformanceMetrics(): Promise<void> {
    console.log(cyan("\n📊 Performance Metrics...\n"));
    
    // Calculate statistics
    const successfulRequests = this.metrics.filter(m => m.success);
    const failedRequests = this.metrics.filter(m => !m.success);
    const responseTimes = successfulRequests.map(m => m.responseTime);
    
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    
    const maxResponseTime = Math.max(...responseTimes, 0);
    const minResponseTime = Math.min(...responseTimes, Infinity);
    
    console.log(`Total Requests: ${this.metrics.length}`);
    console.log(`Successful: ${brightGreen(successfulRequests.length.toString())}`);
    console.log(`Failed: ${failedRequests.length > 0 ? brightRed(failedRequests.length.toString()) : '0'}`);
    console.log(`Success Rate: ${this.calculateSuccessRate()}%`);
    console.log(`\nResponse Times:`);
    console.log(`  Average: ${avgResponseTime}ms`);
    console.log(`  Min: ${minResponseTime === Infinity ? 'N/A' : minResponseTime + 'ms'}`);
    console.log(`  Max: ${maxResponseTime}ms`);
  }

  calculateSuccessRate(): string {
    if (this.metrics.length === 0) return '0';
    const rate = (this.metrics.filter(m => m.success).length / this.metrics.length) * 100;
    return rate.toFixed(1);
  }

  async checkRBACSystem(): Promise<void> {
    console.log(cyan("\n🛡️ RBAC System Check...\n"));
    
    // Test login with demo account
    const loginResponse = await fetch(`${API_URL}/api/auth/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stellar.production@demo.com',
        password: 'Demo123'
      })
    });
    
    if (loginResponse.ok) {
      console.log(`✅ Demo login successful`);
      
      // Get cookies from response
      const cookies = loginResponse.headers.get('set-cookie');
      
      // Check permissions
      const permResponse = await fetch(`${API_URL}/api/permissions/context`, {
        headers: cookies ? { 'Cookie': cookies } : {}
      });
      
      if (permResponse.ok) {
        const perms = await permResponse.json();
        console.log(`✅ Permission context retrieved`);
        if (perms.roles?.length > 0) {
          console.log(`   Roles: ${brightGreen(perms.roles.join(', '))}`);
        }
      } else {
        console.log(`❌ Permission check failed: ${permResponse.status}`);
      }
    } else {
      console.log(`❌ Demo login failed: ${loginResponse.status}`);
    }
  }

  async generateReport(): Promise<void> {
    console.log(cyan("\n📈 Monitoring Report\n"));
    console.log("=" .repeat(50));
    
    const uptime = Date.now() - this.startTime;
    console.log(`Monitoring Duration: ${Math.round(uptime / 1000)}s`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`Success Rate: ${this.calculateSuccessRate()}%`);
    
    // Determine overall health
    const successRate = parseFloat(this.calculateSuccessRate());
    let healthStatus = "";
    let healthColor = brightGreen;
    
    if (successRate >= 95) {
      healthStatus = "🟢 Healthy";
      healthColor = brightGreen;
    } else if (successRate >= 80) {
      healthStatus = "🟡 Degraded";
      healthColor = brightYellow;
    } else {
      healthStatus = "🔴 Critical";
      healthColor = brightRed;
    }
    
    console.log(`\nOverall Status: ${healthColor(healthStatus)}`);
    
    // Recommendations
    console.log(cyan("\n💡 Recommendations:\n"));
    
    const failed = this.metrics.filter(m => !m.success);
    if (failed.length > 0) {
      console.log(`⚠️  Fix failing endpoints:`);
      failed.forEach(f => {
        console.log(`   - ${f.endpoint}`);
      });
    }
    
    const slow = this.metrics.filter(m => m.responseTime > 1000);
    if (slow.length > 0) {
      console.log(`⚠️  Optimize slow endpoints (>1s):`);
      slow.forEach(s => {
        console.log(`   - ${s.endpoint} (${s.responseTime}ms)`);
      });
    }
    
    if (failed.length === 0 && slow.length === 0) {
      console.log(`✅ All systems operational!`);
    }
  }

  async continuousMonitoring(intervalMs: number = 60000): Promise<void> {
    console.log(cyan(`🔄 Starting continuous monitoring (interval: ${intervalMs/1000}s)\n`));
    
    while (true) {
      console.clear();
      console.log(cyan("=".repeat(50)));
      console.log(cyan("   PITCHEY PLATFORM MONITOR"));
      console.log(cyan("=".repeat(50)));
      console.log();
      
      await this.runHealthChecks();
      await this.checkSecurityHeaders();
      await this.checkPerformanceMetrics();
      await this.checkRBACSystem();
      await this.generateReport();
      
      console.log(cyan(`\n⏰ Next check in ${intervalMs/1000} seconds...`));
      console.log(cyan("Press Ctrl+C to stop monitoring"));
      
      // Reset metrics for next iteration
      this.metrics = [];
      
      // Wait for next iteration
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
}

// Main execution
if (import.meta.main) {
  const monitor = new PlatformMonitor();
  
  // Parse command line arguments
  const args = Deno.args;
  
  if (args.includes('--continuous') || args.includes('-c')) {
    // Continuous monitoring mode
    const intervalIndex = args.indexOf('--interval');
    const interval = intervalIndex !== -1 && args[intervalIndex + 1]
      ? parseInt(args[intervalIndex + 1]) * 1000
      : 60000; // Default 60 seconds
    
    await monitor.continuousMonitoring(interval);
  } else {
    // Single run mode
    await monitor.runHealthChecks();
    await monitor.checkSecurityHeaders();
    await monitor.checkPerformanceMetrics();
    await monitor.checkRBACSystem();
    await monitor.generateReport();
  }
}

export { PlatformMonitor };