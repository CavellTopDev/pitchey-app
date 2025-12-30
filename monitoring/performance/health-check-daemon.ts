#!/usr/bin/env deno run --allow-net --allow-read --allow-write
/**
 * Automated Health Check Daemon for Pitchey Cloudflare Worker
 * Runs continuous health monitoring every 5 minutes
 */

interface HealthCheckResult {
  timestamp: string;
  endpoint: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  httpStatus: number;
  responseTime: number;
  cacheStatus: string;
  errorMessage?: string;
  details: {
    dnsResolution: boolean;
    sslHandshake: boolean;
    serverResponse: boolean;
    contentValid: boolean;
  };
}

interface HealthCheckConfig {
  endpoint: string;
  expectedStatus: number;
  timeoutMs: number;
  healthyThresholdMs: number;
  degradedThresholdMs: number;
  contentCheck?: (response: Response, body: string) => boolean;
  description: string;
}

class HealthCheckDaemon {
  private apiUrl: string;
  private logDir: string;
  private interval: number;
  private isRunning: boolean;
  private alertWebhook?: string;

  constructor(apiUrl = 'https://pitchey-api-prod.ndlovucavelle.workers.dev', intervalMinutes = 5) {
    this.apiUrl = apiUrl;
    this.logDir = './health-logs';
    this.interval = intervalMinutes * 60 * 1000; // Convert to milliseconds
    this.isRunning = false;
    this.alertWebhook = Deno.env.get('WEBHOOK_URL'); // Optional webhook for alerts
  }

  private async ensureLogDir() {
    try {
      await Deno.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      if (!(error instanceof Deno.errors.AlreadyExists)) {
        throw error;
      }
    }
  }

  private getHealthCheckConfigs(): HealthCheckConfig[] {
    return [
      {
        endpoint: '/api/health',
        expectedStatus: 200,
        timeoutMs: 5000,
        healthyThresholdMs: 100,
        degradedThresholdMs: 500,
        description: 'Basic health endpoint',
        contentCheck: (response, body) => {
          try {
            const data = JSON.parse(body);
            return data.status === 'healthy';
          } catch {
            return false;
          }
        }
      },
      {
        endpoint: '/api/health/detailed',
        expectedStatus: 200,
        timeoutMs: 10000,
        healthyThresholdMs: 200,
        degradedThresholdMs: 1000,
        description: 'Detailed health with database check',
        contentCheck: (response, body) => {
          try {
            const data = JSON.parse(body);
            return data.database === 'connected' && data.cache === 'operational';
          } catch {
            return false;
          }
        }
      },
      {
        endpoint: '/api/pitches/browse/enhanced?limit=5',
        expectedStatus: 200,
        timeoutMs: 8000,
        healthyThresholdMs: 300,
        degradedThresholdMs: 1500,
        description: 'Main browse endpoint performance',
        contentCheck: (response, body) => {
          try {
            const data = JSON.parse(body);
            return Array.isArray(data.pitches) && data.pitches.length > 0;
          } catch {
            return false;
          }
        }
      },
      {
        endpoint: '/api/pitches?limit=10',
        expectedStatus: 200,
        timeoutMs: 8000,
        healthyThresholdMs: 300,
        degradedThresholdMs: 1500,
        description: 'Pitch listing endpoint',
        contentCheck: (response, body) => {
          try {
            const data = JSON.parse(body);
            return Array.isArray(data.pitches);
          } catch {
            return false;
          }
        }
      },
      {
        endpoint: '/api/auth/check',
        expectedStatus: 401, // Should be unauthorized without token
        timeoutMs: 3000,
        healthyThresholdMs: 50,
        degradedThresholdMs: 200,
        description: 'Authentication system check'
      },
    ];
  }

  private async performHealthCheck(config: HealthCheckConfig): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const url = `${this.apiUrl}${config.endpoint}`;
    
    const result: HealthCheckResult = {
      timestamp: new Date().toISOString(),
      endpoint: config.endpoint,
      status: 'unhealthy',
      httpStatus: 0,
      responseTime: 0,
      cacheStatus: 'NONE',
      details: {
        dnsResolution: false,
        sslHandshake: false,
        serverResponse: false,
        contentValid: false,
      }
    };

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PitcheyHealthDaemon/1.0',
        },
      });

      clearTimeout(timeoutId);
      
      const responseTime = performance.now() - startTime;
      result.responseTime = Math.round(responseTime * 100) / 100;
      result.httpStatus = response.status;
      result.cacheStatus = response.headers.get('x-cache-status') || 'NONE';

      // Basic connection checks
      result.details.dnsResolution = true;
      result.details.sslHandshake = url.startsWith('https');
      result.details.serverResponse = response.status > 0;

      // Check if status matches expected
      const statusOk = response.status === config.expectedStatus;
      
      // Content validation
      let contentValid = true;
      if (config.contentCheck && statusOk) {
        try {
          const body = await response.text();
          contentValid = config.contentCheck(response, body);
        } catch (error) {
          contentValid = false;
          result.errorMessage = `Content validation failed: ${error.message}`;
        }
      }
      result.details.contentValid = contentValid;

      // Determine overall health status
      if (!statusOk) {
        result.status = 'unhealthy';
        result.errorMessage = `HTTP status ${response.status}, expected ${config.expectedStatus}`;
      } else if (!contentValid) {
        result.status = 'degraded';
        result.errorMessage = result.errorMessage || 'Content validation failed';
      } else if (responseTime <= config.healthyThresholdMs) {
        result.status = 'healthy';
      } else if (responseTime <= config.degradedThresholdMs) {
        result.status = 'degraded';
        result.errorMessage = `Slow response: ${responseTime}ms`;
      } else {
        result.status = 'unhealthy';
        result.errorMessage = `Very slow response: ${responseTime}ms`;
      }

    } catch (error) {
      const responseTime = performance.now() - startTime;
      result.responseTime = Math.round(responseTime * 100) / 100;
      result.status = 'unhealthy';
      
      if (error.name === 'AbortError') {
        result.errorMessage = `Timeout after ${config.timeoutMs}ms`;
      } else if (error.message.includes('DNS')) {
        result.errorMessage = `DNS resolution failed: ${error.message}`;
      } else if (error.message.includes('SSL') || error.message.includes('certificate')) {
        result.details.dnsResolution = true;
        result.errorMessage = `SSL handshake failed: ${error.message}`;
      } else {
        result.errorMessage = error.message;
      }
    }

    return result;
  }

  private async logHealthCheck(results: HealthCheckResult[]) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = `${this.logDir}/health-${date}.jsonl`;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      results,
      summary: this.calculateSummary(results),
    };

    // Append to JSONL file
    await Deno.writeTextFile(logFile, JSON.stringify(logEntry) + '\n', { append: true });

    // Also write to latest.json for easy access
    const latestFile = `${this.logDir}/latest.json`;
    await Deno.writeTextFile(latestFile, JSON.stringify(logEntry, null, 2));
  }

  private calculateSummary(results: HealthCheckResult[]) {
    const healthy = results.filter(r => r.status === 'healthy').length;
    const degraded = results.filter(r => r.status === 'degraded').length;
    const unhealthy = results.filter(r => r.status === 'unhealthy').length;
    
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    const cacheHits = results.filter(r => r.cacheStatus === 'HIT').length;
    
    return {
      total: results.length,
      healthy,
      degraded,
      unhealthy,
      healthRate: Math.round((healthy / results.length) * 100),
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      cacheHitRate: Math.round((cacheHits / results.length) * 100),
    };
  }

  private async sendAlert(results: HealthCheckResult[], summary: any) {
    const criticalIssues = results.filter(r => r.status === 'unhealthy');
    
    if (criticalIssues.length === 0) return;

    const alertMessage = {
      timestamp: new Date().toISOString(),
      severity: criticalIssues.length > 1 ? 'critical' : 'warning',
      summary: `${criticalIssues.length}/${results.length} health checks failed`,
      details: criticalIssues.map(issue => ({
        endpoint: issue.endpoint,
        error: issue.errorMessage,
        responseTime: issue.responseTime,
      })),
      overallHealth: `${summary.healthy}H/${summary.degraded}D/${summary.unhealthy}U`,
      avgResponseTime: summary.avgResponseTime,
    };

    // Log alert locally
    console.log('🚨 ALERT:', JSON.stringify(alertMessage, null, 2));

    // Send to webhook if configured
    if (this.alertWebhook) {
      try {
        await fetch(this.alertWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alertMessage),
        });
      } catch (error) {
        console.error('Failed to send webhook alert:', error.message);
      }
    }
  }

  private printStatus(results: HealthCheckResult[], summary: any) {
    const timestamp = new Date().toLocaleString();
    
    console.log(`\n🏥 Health Check - ${timestamp}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    results.forEach(result => {
      const icon = result.status === 'healthy' ? '✅' : 
                   result.status === 'degraded' ? '⚠️' : '❌';
      const cache = result.cacheStatus === 'HIT' ? '💾' : result.cacheStatus === 'MISS' ? '🚫' : '❓';
      
      console.log(`${icon} ${result.endpoint} ${cache} ${result.responseTime}ms`);
      if (result.errorMessage) {
        console.log(`   └─ ${result.errorMessage}`);
      }
    });

    console.log('─────────────────────────────────────────────');
    console.log(`📊 Summary: ${summary.healthy}H/${summary.degraded}D/${summary.unhealthy}U | Avg: ${summary.avgResponseTime}ms | Cache: ${summary.cacheHitRate}%`);
    
    if (summary.unhealthy > 0) {
      console.log('🚨 Unhealthy endpoints detected!');
    } else if (summary.degraded > 0) {
      console.log('⚠️  Some endpoints showing degraded performance');
    } else {
      console.log('✅ All systems healthy');
    }
  }

  async runSingleCheck(): Promise<void> {
    await this.ensureLogDir();
    
    const configs = this.getHealthCheckConfigs();
    const results: HealthCheckResult[] = [];

    for (const config of configs) {
      const result = await this.performHealthCheck(config);
      results.push(result);
      
      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const summary = this.calculateSummary(results);
    
    await this.logHealthCheck(results);
    this.printStatus(results, summary);
    
    // Send alerts for critical issues
    await this.sendAlert(results, summary);
  }

  async startDaemon(): Promise<void> {
    if (this.isRunning) {
      console.log('Health check daemon is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting health check daemon (interval: ${this.interval / 60000} minutes)`);
    console.log(`📡 Monitoring: ${this.apiUrl}`);
    console.log('📁 Logs will be saved to:', this.logDir);
    
    // Handle graceful shutdown
    const signalHandler = () => {
      console.log('\n🛑 Stopping health check daemon...');
      this.isRunning = false;
      Deno.exit(0);
    };
    
    Deno.addSignalListener('SIGINT', signalHandler);
    Deno.addSignalListener('SIGTERM', signalHandler);

    // Run initial check
    await this.runSingleCheck();

    // Start interval
    while (this.isRunning) {
      await new Promise(resolve => setTimeout(resolve, this.interval));
      if (this.isRunning) {
        await this.runSingleCheck();
      }
    }
  }

  stop(): void {
    this.isRunning = false;
  }
}

// CLI Interface
if (import.meta.main) {
  const args = Deno.args;
  const apiUrl = Deno.env.get('API_URL') || 'https://pitchey-api-prod.ndlovucavelle.workers.dev';
  const interval = parseInt(Deno.env.get('HEALTH_CHECK_INTERVAL') || '5');
  
  const daemon = new HealthCheckDaemon(apiUrl, interval);
  
  if (args.includes('--once') || args.includes('-o')) {
    // Run single check
    try {
      await daemon.runSingleCheck();
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      Deno.exit(1);
    }
  } else {
    // Run as daemon
    try {
      await daemon.startDaemon();
    } catch (error) {
      console.error('❌ Health check daemon failed:', error.message);
      Deno.exit(1);
    }
  }
}