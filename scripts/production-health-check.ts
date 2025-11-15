#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Production Health Check Script
 * Performs comprehensive health checks on deployed production API
 */

interface HealthCheckResult {
  endpoint: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime: number;
  statusCode: number;
  message: string;
  details?: any;
}

interface HealthReport {
  timestamp: string;
  baseUrl: string;
  overallHealth: "healthy" | "degraded" | "unhealthy";
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    averageResponseTime: number;
  };
}

class ProductionHealthChecker {
  private baseUrl: string;
  private checks: HealthCheckResult[] = [];
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\\/$/, ""); // Remove trailing slash
  }
  
  async performFullHealthCheck(): Promise<HealthReport> {
    console.log(`🏥 Starting comprehensive health check for: ${this.baseUrl}`);
    
    // Core system endpoints
    await this.checkEndpoint("/api/health", "Health Check", true);
    await this.checkEndpoint("/api/version", "Version Info", true);
    await this.checkEndpoint("/", "Root Endpoint", true);
    
    // Authentication endpoints
    await this.checkEndpoint("/api/auth/login", "Auth Login", false, "POST", {
      email: "test@example.com",
      password: "invalidpassword"
    });
    
    // Public data endpoints
    await this.checkEndpoint("/api/pitches/public", "Public Pitches", true);
    await this.checkEndpoint("/api/pitches/search", "Search Functionality", true);
    await this.checkEndpoint("/api/pitches/trending", "Trending Pitches", true);
    
    // API documentation
    await this.checkEndpoint("/api/docs", "API Documentation", true);
    await this.checkEndpoint("/api/version", "Version Management", true);
    
    // Monitoring endpoints
    await this.checkEndpoint("/api/monitoring/metrics", "System Metrics", true);
    await this.checkEndpoint("/api/monitoring/status", "System Status", true);
    
    // WebSocket connection test
    await this.checkWebSocket("/ws");
    
    // Performance test
    await this.performPerformanceTest();
    
    // Database connectivity test
    await this.checkDatabaseHealth();
    
    const summary = this.calculateSummary();
    const overallHealth = this.determineOverallHealth(summary);
    
    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      baseUrl: this.baseUrl,
      overallHealth,
      checks: this.checks,
      summary
    };
    
    this.printReport(report);
    return report;
  }
  
  private async checkEndpoint(
    endpoint: string, 
    description: string, 
    shouldSucceed: boolean,
    method: string = "GET",
    body?: any
  ) {
    const url = `${this.baseUrl}${endpoint}`;
    const startTime = Date.now();
    
    try {
      const requestInit: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      };
      
      if (body) {
        requestInit.body = JSON.stringify(body);
      }
      
      const response = await fetch(url, requestInit);
      const responseTime = Date.now() - startTime;
      
      let status: "healthy" | "degraded" | "unhealthy";
      let message: string;
      
      if (shouldSucceed) {
        if (response.status >= 200 && response.status < 300) {
          status = responseTime < 1000 ? "healthy" : "degraded";
          message = `${description} responding normally (${responseTime}ms)`;
        } else {
          status = "unhealthy";
          message = `${description} returned ${response.status} ${response.statusText}`;
        }
      } else {
        // For endpoints that should fail (like invalid auth)
        status = response.status >= 400 && response.status < 500 ? "healthy" : "unhealthy";
        message = response.status >= 400 && response.status < 500 
          ? `${description} properly rejecting invalid requests`
          : `${description} not properly handling invalid requests`;
      }
      
      let responseData;
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
      
      this.addCheck({
        endpoint,
        status,
        responseTime,
        statusCode: response.status,
        message,
        details: {
          description,
          method,
          expected_success: shouldSucceed,
          response_size: JSON.stringify(responseData).length
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.addCheck({
        endpoint,
        status: "unhealthy",
        responseTime,
        statusCode: 0,
        message: `${description} failed: ${error.message}`,
        details: {
          description,
          method,
          error: error.message
        }
      });
    }
  }
  
  private async checkWebSocket(endpoint: string) {
    const wsUrl = this.baseUrl.replace("http", "ws") + endpoint;
    const startTime = Date.now();
    
    try {
      const ws = new WebSocket(wsUrl);
      
      const connectionPromise = new Promise((resolve, reject) => {
        ws.onopen = () => resolve("connected");
        ws.onerror = (error) => reject(error);
        
        // Timeout after 5 seconds
        setTimeout(() => reject(new Error("Connection timeout")), 5000);
      });
      
      await connectionPromise;
      const responseTime = Date.now() - startTime;
      
      ws.close();
      
      this.addCheck({
        endpoint,
        status: responseTime < 2000 ? "healthy" : "degraded",
        responseTime,
        statusCode: 101, // WebSocket upgrade status
        message: `WebSocket connection established (${responseTime}ms)`,
        details: {
          description: "WebSocket Connection",
          protocol: "ws",
          connection_time: responseTime
        }
      });
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.addCheck({
        endpoint,
        status: "unhealthy",
        responseTime,
        statusCode: 0,
        message: `WebSocket connection failed: ${error.message}`,
        details: {
          description: "WebSocket Connection",
          protocol: "ws",
          error: error.message
        }
      });
    }
  }
  
  private async performPerformanceTest() {
    console.log("⚡ Running performance test...");
    
    const testUrl = `${this.baseUrl}/api/health`;
    const iterations = 5;
    const responseTimes: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(testUrl);
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
          responseTimes.push(responseTime);
        }
      } catch {
        // Skip failed requests in performance calculation
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (responseTimes.length > 0) {
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const minResponseTime = Math.min(...responseTimes);
      
      const status = avgResponseTime < 500 ? "healthy" : avgResponseTime < 1000 ? "degraded" : "unhealthy";
      
      this.addCheck({
        endpoint: "/api/health (performance)",
        status,
        responseTime: avgResponseTime,
        statusCode: 200,
        message: `Performance test completed (avg: ${avgResponseTime.toFixed(2)}ms)`,
        details: {
          description: "Performance Test",
          iterations,
          average_response_time: avgResponseTime,
          max_response_time: maxResponseTime,
          min_response_time: minResponseTime,
          consistency_score: (1 - ((maxResponseTime - minResponseTime) / avgResponseTime)) * 100
        }
      });
    } else {
      this.addCheck({
        endpoint: "/api/health (performance)",
        status: "unhealthy",
        responseTime: 0,
        statusCode: 0,
        message: "Performance test failed - no successful requests",
        details: {
          description: "Performance Test",
          iterations,
          successful_requests: 0
        }
      });
    }
  }
  
  private async checkDatabaseHealth() {
    const startTime = Date.now();
    
    try {
      // Check if we can get data that requires database access
      const response = await fetch(`${this.baseUrl}/api/pitches/public?limit=1`);
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        const hasData = Array.isArray(data) || (data && typeof data === 'object');
        
        this.addCheck({
          endpoint: "/database (via pitches)",
          status: hasData ? "healthy" : "degraded",
          responseTime,
          statusCode: response.status,
          message: hasData 
            ? `Database connectivity verified (${responseTime}ms)`
            : "Database accessible but may have data issues",
          details: {
            description: "Database Health Check",
            has_data: hasData,
            response_type: typeof data,
            query_performance: responseTime < 500 ? "excellent" : responseTime < 1000 ? "good" : "poor"
          }
        });
      } else {
        this.addCheck({
          endpoint: "/database (via pitches)",
          status: "unhealthy",
          responseTime,
          statusCode: response.status,
          message: `Database health check failed: ${response.status} ${response.statusText}`,
          details: {
            description: "Database Health Check",
            error: `${response.status} ${response.statusText}`
          }
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.addCheck({
        endpoint: "/database (via pitches)",
        status: "unhealthy",
        responseTime,
        statusCode: 0,
        message: `Database health check failed: ${error.message}`,
        details: {
          description: "Database Health Check",
          error: error.message
        }
      });
    }
  }
  
  private addCheck(check: HealthCheckResult) {
    this.checks.push(check);
    
    const icon = check.status === "healthy" ? "✅" : check.status === "degraded" ? "⚠️" : "❌";
    console.log(`${icon} ${check.endpoint} - ${check.message}`);
  }
  
  private calculateSummary() {
    const total = this.checks.length;
    const healthy = this.checks.filter(c => c.status === "healthy").length;
    const degraded = this.checks.filter(c => c.status === "degraded").length;
    const unhealthy = this.checks.filter(c => c.status === "unhealthy").length;
    
    const totalResponseTime = this.checks.reduce((sum, check) => sum + check.responseTime, 0);
    const averageResponseTime = total > 0 ? totalResponseTime / total : 0;
    
    return {
      total,
      healthy,
      degraded,
      unhealthy,
      averageResponseTime
    };
  }
  
  private determineOverallHealth(summary: any): "healthy" | "degraded" | "unhealthy" {
    const healthPercentage = (summary.healthy / summary.total) * 100;
    
    if (summary.unhealthy > 0 && summary.unhealthy >= summary.total * 0.3) {
      return "unhealthy";
    }
    
    if (healthPercentage >= 80) {
      return "healthy";
    } else if (healthPercentage >= 50) {
      return "degraded";
    } else {
      return "unhealthy";
    }
  }
  
  private printReport(report: HealthReport) {
    console.log("\\n" + "=".repeat(80));
    console.log("🏥 PRODUCTION HEALTH CHECK REPORT");
    console.log("=".repeat(80));
    console.log(`🌐 Base URL: ${report.baseUrl}`);
    console.log(`⏰ Timestamp: ${report.timestamp}`);
    console.log(`🎯 Overall Health: ${this.getHealthIcon(report.overallHealth)} ${report.overallHealth.toUpperCase()}`);
    console.log(`📊 Summary: ${report.summary.healthy}✅ ${report.summary.degraded}⚠️ ${report.summary.unhealthy}❌`);
    console.log(`⚡ Average Response Time: ${report.summary.averageResponseTime.toFixed(2)}ms`);
    
    console.log("\\n" + "─".repeat(80));
    console.log("DETAILED HEALTH CHECK RESULTS:");
    console.log("─".repeat(80));
    
    for (const check of report.checks) {
      const icon = this.getHealthIcon(check.status);
      console.log(`${icon} ${check.endpoint}`);
      console.log(`   Status: ${check.status.toUpperCase()}`);
      console.log(`   Response Time: ${check.responseTime}ms`);
      console.log(`   HTTP Status: ${check.statusCode}`);
      console.log(`   Message: ${check.message}`);
      if (check.details) {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2).replace(/\\n/g, "\\n   ")}`);
      }
      console.log();
    }
    
    console.log("─".repeat(80));
    
    if (report.overallHealth === "unhealthy") {
      console.log("🚨 CRITICAL: Production system is unhealthy - immediate attention required!");
      Deno.exit(1);
    } else if (report.overallHealth === "degraded") {
      console.log("⚠️  WARNING: Production system is degraded - monitor closely");
    } else {
      console.log("✅ SUCCESS: Production system is healthy and performing well");
    }
    
    console.log("=".repeat(80));
  }
  
  private getHealthIcon(status: string): string {
    switch (status) {
      case "healthy": return "✅";
      case "degraded": return "⚠️";
      case "unhealthy": return "❌";
      default: return "❓";
    }
  }
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;
  
  if (args.length < 1) {
    console.error("❌ Usage: deno run --allow-net production-health-check.ts <BASE_URL>");
    console.error("   Example: deno run --allow-net production-health-check.ts https://api.example.com");
    Deno.exit(1);
  }
  
  const baseUrl = args[0];
  const checker = new ProductionHealthChecker(baseUrl);
  
  try {
    const report = await checker.performFullHealthCheck();
    
    // Write report to file for CI/CD artifacts
    await Deno.writeTextFile(
      "production-health-report.json",
      JSON.stringify(report, null, 2)
    );
    
    console.log("\\n📄 Health report saved to production-health-report.json");
    
  } catch (error) {
    console.error("❌ Health check failed:", error);
    Deno.exit(1);
  }
}