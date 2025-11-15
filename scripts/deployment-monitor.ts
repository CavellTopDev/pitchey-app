#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Post-Deployment Monitoring Script
 * Monitors system health after deployment and sends alerts if issues are detected
 */

interface MonitoringConfig {
  url: string;
  duration: number; // seconds
  interval: number; // seconds
  alertWebhook?: string;
  thresholds: {
    responseTime: number; // ms
    errorRate: number; // percentage
    availabilityTarget: number; // percentage
  };
}

interface HealthMetric {
  timestamp: string;
  responseTime: number;
  statusCode: number;
  success: boolean;
  endpoint: string;
}

interface MonitoringReport {
  startTime: string;
  endTime: string;
  duration: number;
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  availability: number;
  averageResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  alerts: Alert[];
  metrics: HealthMetric[];
}

interface Alert {
  type: "error_rate" | "response_time" | "availability" | "endpoint_down";
  severity: "warning" | "critical";
  message: string;
  timestamp: string;
  details: any;
}

class DeploymentMonitor {
  private config: MonitoringConfig;
  private metrics: HealthMetric[] = [];
  private alerts: Alert[] = [];
  private isRunning = false;
  
  constructor(config: MonitoringConfig) {
    this.config = config;
  }
  
  async startMonitoring(): Promise<MonitoringReport> {
    console.log("📊 Starting post-deployment monitoring...");
    console.log(`URL: ${this.config.url}`);
    console.log(`Duration: ${this.config.duration}s`);
    console.log(`Interval: ${this.config.interval}s`);
    
    const startTime = new Date();
    this.isRunning = true;
    
    // Monitor critical endpoints
    const endpoints = [
      "/api/health",
      "/api/version",
      "/",
      "/api/pitches/public",
      "/api/pitches/search"
    ];
    
    const endTime = Date.now() + (this.config.duration * 1000);
    let checkCount = 0;
    
    while (Date.now() < endTime && this.isRunning) {
      console.log(`\\n🔍 Monitoring check #${++checkCount} at ${new Date().toISOString()}`);
      
      // Check all endpoints
      for (const endpoint of endpoints) {
        await this.checkEndpoint(endpoint);
      }
      
      // Analyze metrics and generate alerts
      this.analyzeMetrics();
      
      // Send immediate alerts if critical issues detected
      await this.processAlerts();
      
      // Wait before next check
      if (Date.now() < endTime) {
        await new Promise(resolve => setTimeout(resolve, this.config.interval * 1000));
      }
    }
    
    // Generate final report
    const report = this.generateReport(startTime, new Date());
    await this.sendFinalReport(report);
    
    return report;
  }
  
  private async checkEndpoint(endpoint: string) {
    const url = `${this.config.url}${endpoint}`;
    const startTime = Date.now();
    
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Deployment-Monitor/1.0",
          "Accept": "application/json"
        }
      });
      
      const responseTime = Date.now() - startTime;
      
      const metric: HealthMetric = {
        timestamp: new Date().toISOString(),
        responseTime,
        statusCode: response.status,
        success: response.status >= 200 && response.status < 400,
        endpoint
      };
      
      this.metrics.push(metric);
      
      const icon = metric.success ? "✅" : "❌";
      console.log(`${icon} ${endpoint} - ${response.status} (${responseTime}ms)`);
      
      // Check for response time threshold
      if (responseTime > this.config.thresholds.responseTime) {
        this.addAlert({
          type: "response_time",
          severity: "warning",
          message: `Slow response time: ${responseTime}ms > ${this.config.thresholds.responseTime}ms`,
          timestamp: new Date().toISOString(),
          details: { endpoint, responseTime, threshold: this.config.thresholds.responseTime }
        });
      }
      
      // Check for endpoint failure
      if (!metric.success) {
        this.addAlert({
          type: "endpoint_down",
          severity: response.status >= 500 ? "critical" : "warning",
          message: `Endpoint failure: ${endpoint} returned ${response.status}`,
          timestamp: new Date().toISOString(),
          details: { endpoint, statusCode: response.status }
        });
      }
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const metric: HealthMetric = {
        timestamp: new Date().toISOString(),
        responseTime,
        statusCode: 0,
        success: false,
        endpoint
      };
      
      this.metrics.push(metric);
      
      console.log(`❌ ${endpoint} - ERROR: ${error.message}`);
      
      this.addAlert({
        type: "endpoint_down",
        severity: "critical",
        message: `Endpoint unreachable: ${endpoint} - ${error.message}`,
        timestamp: new Date().toISOString(),
        details: { endpoint, error: error.message }
      });
    }
  }
  
  private analyzeMetrics() {
    if (this.metrics.length === 0) return;
    
    // Analyze recent metrics (last 10 checks)
    const recentMetrics = this.metrics.slice(-10);
    
    // Calculate error rate
    const errors = recentMetrics.filter(m => !m.success).length;
    const errorRate = (errors / recentMetrics.length) * 100;
    
    if (errorRate > this.config.thresholds.errorRate) {
      this.addAlert({
        type: "error_rate",
        severity: errorRate > 50 ? "critical" : "warning",
        message: `High error rate: ${errorRate.toFixed(1)}% > ${this.config.thresholds.errorRate}%`,
        timestamp: new Date().toISOString(),
        details: { errorRate, threshold: this.config.thresholds.errorRate, sampleSize: recentMetrics.length }
      });
    }
    
    // Calculate availability
    const availability = ((recentMetrics.length - errors) / recentMetrics.length) * 100;
    
    if (availability < this.config.thresholds.availabilityTarget) {
      this.addAlert({
        type: "availability",
        severity: availability < 90 ? "critical" : "warning",
        message: `Low availability: ${availability.toFixed(1)}% < ${this.config.thresholds.availabilityTarget}%`,
        timestamp: new Date().toISOString(),
        details: { availability, target: this.config.thresholds.availabilityTarget }
      });
    }
  }
  
  private addAlert(alert: Alert) {
    // Avoid duplicate alerts within 1 minute
    const oneMinuteAgo = Date.now() - 60000;
    const recentSimilarAlert = this.alerts.find(a => 
      a.type === alert.type && 
      new Date(a.timestamp).getTime() > oneMinuteAgo &&
      JSON.stringify(a.details) === JSON.stringify(alert.details)
    );
    
    if (!recentSimilarAlert) {
      this.alerts.push(alert);
      
      const severityIcon = alert.severity === "critical" ? "🚨" : "⚠️";
      console.log(`${severityIcon} ALERT: ${alert.message}`);
    }
  }
  
  private async processAlerts() {
    // Send immediate alerts for critical issues
    const criticalAlerts = this.alerts.filter(a => 
      a.severity === "critical" && 
      Date.now() - new Date(a.timestamp).getTime() < 30000 // Last 30 seconds
    );
    
    if (criticalAlerts.length > 0 && this.config.alertWebhook) {
      await this.sendImmediateAlert(criticalAlerts);
    }
  }
  
  private async sendImmediateAlert(alerts: Alert[]) {
    if (!this.config.alertWebhook) return;
    
    try {
      const message = {
        text: `🚨 CRITICAL: Deployment monitoring detected ${alerts.length} critical issue(s)`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*🚨 CRITICAL DEPLOYMENT ALERTS*\\n` +
                    `URL: ${this.config.url}\\n` +
                    `Time: ${new Date().toISOString()}\\n` +
                    `Issues: ${alerts.length}`
            }
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: alerts.map(a => `• ${a.message}`).join("\\n")
            }
          }
        ]
      };
      
      const response = await fetch(this.config.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });
      
      if (response.ok) {
        console.log("📢 Critical alert sent successfully");
      } else {
        console.warn(`⚠️ Failed to send alert: ${response.status}`);
      }
      
    } catch (error) {
      console.error(`❌ Alert sending failed: ${error.message}`);
    }
  }
  
  private generateReport(startTime: Date, endTime: Date): MonitoringReport {
    const totalChecks = this.metrics.length;
    const successfulChecks = this.metrics.filter(m => m.success).length;
    const failedChecks = totalChecks - successfulChecks;
    
    const availability = totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;
    const errorRate = totalChecks > 0 ? (failedChecks / totalChecks) * 100 : 0;
    
    const responseTimes = this.metrics.filter(m => m.success).map(m => m.responseTime);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
    
    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      duration: this.config.duration,
      totalChecks,
      successfulChecks,
      failedChecks,
      availability,
      averageResponseTime,
      maxResponseTime,
      errorRate,
      alerts: this.alerts,
      metrics: this.metrics
    };
  }
  
  private async sendFinalReport(report: MonitoringReport) {
    console.log("\\n" + "=".repeat(80));
    console.log("📊 POST-DEPLOYMENT MONITORING REPORT");
    console.log("=".repeat(80));
    console.log(`🌐 URL: ${this.config.url}`);
    console.log(`⏰ Duration: ${report.duration}s (${report.startTime} - ${report.endTime})`);
    console.log(`📈 Total Checks: ${report.totalChecks}`);
    console.log(`✅ Successful: ${report.successfulChecks}`);
    console.log(`❌ Failed: ${report.failedChecks}`);
    console.log(`📊 Availability: ${report.availability.toFixed(2)}%`);
    console.log(`⚡ Avg Response Time: ${report.averageResponseTime.toFixed(0)}ms`);
    console.log(`⚡ Max Response Time: ${report.maxResponseTime}ms`);
    console.log(`🚨 Error Rate: ${report.errorRate.toFixed(2)}%`);
    console.log(`🔔 Total Alerts: ${report.alerts.length}`);
    
    if (report.alerts.length > 0) {
      console.log("\\n🚨 ALERTS:");
      for (const alert of report.alerts) {
        const icon = alert.severity === "critical" ? "🚨" : "⚠️";
        console.log(`${icon} [${alert.type.toUpperCase()}] ${alert.message}`);
      }
    }
    
    // Determine overall health
    const isHealthy = report.availability >= this.config.thresholds.availabilityTarget &&
                     report.errorRate <= this.config.thresholds.errorRate &&
                     report.averageResponseTime <= this.config.thresholds.responseTime;
    
    console.log("\\n" + "=".repeat(80));
    if (isHealthy) {
      console.log("✅ DEPLOYMENT MONITORING: HEALTHY");
      console.log("The deployed system is performing within acceptable thresholds.");
    } else {
      console.log("⚠️ DEPLOYMENT MONITORING: ISSUES DETECTED");
      console.log("The deployed system has performance issues that need attention.");
    }
    console.log("=".repeat(80));
    
    // Send final report via webhook
    if (this.config.alertWebhook) {
      await this.sendFinalSlackReport(report, isHealthy);
    }
    
    // Save report to file
    await Deno.writeTextFile(
      "deployment-monitoring-report.json",
      JSON.stringify(report, null, 2)
    );
    
    console.log("\\n📄 Detailed report saved to deployment-monitoring-report.json");
  }
  
  private async sendFinalSlackReport(report: MonitoringReport, isHealthy: boolean) {
    try {
      const color = isHealthy ? "good" : "warning";
      const icon = isHealthy ? "✅" : "⚠️";
      
      const message = {
        text: `${icon} Post-deployment monitoring completed`,
        attachments: [
          {
            color,
            title: "📊 Deployment Monitoring Report",
            fields: [
              {
                title: "URL",
                value: this.config.url,
                short: true
              },
              {
                title: "Duration",
                value: `${report.duration}s`,
                short: true
              },
              {
                title: "Availability",
                value: `${report.availability.toFixed(2)}%`,
                short: true
              },
              {
                title: "Avg Response Time",
                value: `${report.averageResponseTime.toFixed(0)}ms`,
                short: true
              },
              {
                title: "Error Rate",
                value: `${report.errorRate.toFixed(2)}%`,
                short: true
              },
              {
                title: "Total Alerts",
                value: report.alerts.length.toString(),
                short: true
              }
            ],
            footer: "Deployment Monitor",
            ts: Math.floor(Date.now() / 1000)
          }
        ]
      };
      
      const response = await fetch(this.config.alertWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      });
      
      if (response.ok) {
        console.log("📢 Final report sent to Slack");
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to send final report: ${error.message}`);
    }
  }
  
  stop() {
    this.isRunning = false;
    console.log("🛑 Monitoring stopped");
  }
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;
  
  // Parse command line arguments
  let url = "";
  let duration = 300; // 5 minutes default
  let alertWebhook = Deno.env.get("SLACK_WEBHOOK_URL");
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case "--url":
        url = value;
        break;
      case "--duration":
        duration = parseInt(value);
        break;
      case "--alert-webhook":
        alertWebhook = value;
        break;
    }
  }
  
  if (!url) {
    console.error("❌ Usage: deployment-monitor.ts --url <URL> [--duration <seconds>] [--alert-webhook <webhook_url>]");
    console.error("   Example: deployment-monitor.ts --url https://api.example.com --duration 300");
    Deno.exit(1);
  }
  
  const config: MonitoringConfig = {
    url: url.replace(/\\/$/, ""), // Remove trailing slash
    duration,
    interval: 30, // 30 seconds between checks
    alertWebhook,
    thresholds: {
      responseTime: 2000, // 2 seconds
      errorRate: 10, // 10%
      availabilityTarget: 95 // 95%
    }
  };
  
  console.log("📊 Deployment Monitoring Service");
  console.log("=================================");
  
  const monitor = new DeploymentMonitor(config);
  
  // Handle graceful shutdown
  const handleShutdown = () => {
    console.log("\\n🛑 Received shutdown signal");
    monitor.stop();
    Deno.exit(0);
  };
  
  Deno.addSignalListener("SIGINT", handleShutdown);
  Deno.addSignalListener("SIGTERM", handleShutdown);
  
  try {
    const report = await monitor.startMonitoring();
    
    // Exit with error code if issues detected
    const hasIssues = report.availability < config.thresholds.availabilityTarget ||
                     report.errorRate > config.thresholds.errorRate ||
                     report.alerts.some(a => a.severity === "critical");
    
    Deno.exit(hasIssues ? 1 : 0);
    
  } catch (error) {
    console.error("❌ Monitoring failed:", error);
    Deno.exit(2);
  }
}