#!/usr/bin/env -S deno run --allow-net --allow-write --allow-read

/**
 * Production Telemetry Monitor for Pitchey Platform
 * Continuously monitors live URLs and provides detailed insights
 * Runs even without fully configured Sentry
 */

interface ServiceHealth {
  url: string;
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  responseTime: number;
  httpStatus: number;
  lastCheck: Date;
  details?: Record<string, any>;
  issues: string[];
}

interface MonitoringReport {
  timestamp: Date;
  services: ServiceHealth[];
  summary: {
    healthy: number;
    warnings: number;
    errors: number;
    totalServices: number;
  };
  criticalIssues: string[];
  recommendations: string[];
}

class ProductionMonitor {
  private services = [
    {
      url: 'https://pitchey.pages.dev',
      name: 'Frontend (Cloudflare Pages)',
      healthPath: ''
    },
    {
      url: 'https://pitchey-api-production.cavelltheleaddev.workers.dev',
      name: 'Worker API (Edge)',
      healthPath: '/api/health'
    },
    {
      url: 'https://pitchey-backend-fresh.deno.dev',
      name: 'Backend API (Deno Deploy)',
      healthPath: '/api/health'
    }
  ];

  private logFile = 'production-monitoring.log';

  async log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}\n`;
    
    console.log(`${level}: ${message}`);
    
    try {
      await Deno.writeTextFile(this.logFile, logEntry, { append: true });
    } catch (error) {
      console.error(`Failed to write to log file: ${error.message}`);
    }
  }

  async checkServiceHealth(service: any): Promise<ServiceHealth> {
    const startTime = performance.now();
    const fullUrl = service.url + service.healthPath;
    
    const health: ServiceHealth = {
      url: service.url,
      name: service.name,
      status: 'unknown',
      responseTime: 0,
      httpStatus: 0,
      lastCheck: new Date(),
      issues: []
    };

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Pitchey-Production-Monitor/1.0'
        }
      });

      const endTime = performance.now();
      health.responseTime = Math.round(endTime - startTime);
      health.httpStatus = response.status;

      if (response.ok) {
        health.status = 'healthy';
        
        // Try to get additional details for API endpoints
        if (service.healthPath) {
          try {
            const data = await response.json();
            health.details = data;
            
            // Analyze backend specific details
            if (service.name.includes('Backend')) {
              this.analyzeBackendHealth(health, data);
            }
          } catch (error) {
            health.issues.push(`Failed to parse health response: ${error.message}`);
          }
        }
      } else {
        health.status = 'warning';
        health.issues.push(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Performance analysis
      if (health.responseTime > 1000) {
        health.status = 'warning';
        health.issues.push(`Slow response time: ${health.responseTime}ms`);
      }

    } catch (error) {
      health.status = 'error';
      health.issues.push(`Connection failed: ${error.message}`);
      health.responseTime = Math.round(performance.now() - startTime);
    }

    return health;
  }

  private analyzeBackendHealth(health: ServiceHealth, data: any) {
    if (data.data) {
      const backendData = data.data;
      
      // Check environment configuration
      if (backendData.environment === 'development') {
        health.status = 'warning';
        health.issues.push('Backend running in development mode instead of production');
      }

      // Check telemetry status
      if (backendData.telemetry) {
        const telemetry = backendData.telemetry;
        if (!telemetry.initialized) {
          health.status = 'warning';
          health.issues.push('Telemetry not initialized - error tracking disabled');
        }
        
        if (telemetry.environment === 'development') {
          health.issues.push('Telemetry configured for development instead of production');
        }
      }

      // Check Redis status
      if (backendData.redis && !backendData.redis.enabled) {
        health.issues.push('Redis caching disabled - performance impact');
      }

      // Check coverage
      if (backendData.coverage && backendData.coverage !== '29/29 tests') {
        health.status = 'warning';
        health.issues.push(`Incomplete test coverage: ${backendData.coverage}`);
      }
    }
  }

  async checkSecurityVulnerabilities(): Promise<string[]> {
    const vulnerabilities: string[] = [];

    try {
      // Check for exposed database test endpoint
      const response = await fetch('https://pitchey-api-production.cavelltheleaddev.workers.dev/api/db-test');
      
      if (response.ok) {
        vulnerabilities.push('🚨 CRITICAL: Database test endpoint publicly accessible at /api/db-test');
        vulnerabilities.push('This endpoint exposes sensitive database information and should be removed immediately');
      }
    } catch (error) {
      // If blocked by CORS or 404, that's good for security
      this.log('Security check: Database test endpoint properly secured', 'INFO');
    }

    return vulnerabilities;
  }

  async generateReport(): Promise<MonitoringReport> {
    await this.log('Starting production health check...', 'INFO');

    const services: ServiceHealth[] = [];
    
    // Check all services in parallel
    const healthChecks = this.services.map(service => this.checkServiceHealth(service));
    const results = await Promise.all(healthChecks);
    services.push(...results);

    // Check security vulnerabilities
    const vulnerabilities = await this.checkSecurityVulnerabilities();

    // Generate summary
    const summary = {
      healthy: services.filter(s => s.status === 'healthy').length,
      warnings: services.filter(s => s.status === 'warning').length,
      errors: services.filter(s => s.status === 'error').length,
      totalServices: services.length
    };

    // Collect all issues
    const criticalIssues: string[] = [...vulnerabilities];
    services.forEach(service => {
      if (service.status === 'error') {
        criticalIssues.push(`${service.name}: ${service.issues.join(', ')}`);
      }
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    services.forEach(service => {
      if (service.issues.length > 0) {
        service.issues.forEach(issue => {
          if (issue.includes('development mode')) {
            recommendations.push('Configure production environment variables for backend deployment');
          }
          if (issue.includes('Telemetry not initialized')) {
            recommendations.push('Enable Sentry telemetry initialization for production error tracking');
          }
          if (issue.includes('Redis caching disabled')) {
            recommendations.push('Enable Redis caching for improved performance');
          }
        });
      }
    });

    if (vulnerabilities.length > 0) {
      recommendations.push('URGENT: Remove database test endpoint from production worker deployment');
    }

    const report: MonitoringReport = {
      timestamp: new Date(),
      services,
      summary,
      criticalIssues,
      recommendations: [...new Set(recommendations)] // Remove duplicates
    };

    await this.logReport(report);
    return report;
  }

  private async logReport(report: MonitoringReport) {
    await this.log('='.repeat(80), 'INFO');
    await this.log(`Production Health Report - ${report.timestamp.toISOString()}`, 'INFO');
    await this.log('='.repeat(80), 'INFO');

    // Log summary
    await this.log(`Overall Status: ${report.summary.healthy}/${report.summary.totalServices} services healthy`, 'INFO');
    if (report.summary.warnings > 0) {
      await this.log(`Warnings: ${report.summary.warnings} services have issues`, 'WARN');
    }
    if (report.summary.errors > 0) {
      await this.log(`Errors: ${report.summary.errors} services are down`, 'ERROR');
    }

    // Log service details
    for (const service of report.services) {
      const status = service.status.toUpperCase();
      const level = service.status === 'healthy' ? 'INFO' : 
                   service.status === 'warning' ? 'WARN' : 'ERROR';
      
      await this.log(`${service.name}: ${status} (${service.responseTime}ms, HTTP ${service.httpStatus})`, level);
      
      if (service.issues.length > 0) {
        for (const issue of service.issues) {
          await this.log(`  - ${issue}`, level);
        }
      }
    }

    // Log critical issues
    if (report.criticalIssues.length > 0) {
      await this.log('CRITICAL ISSUES:', 'ERROR');
      for (const issue of report.criticalIssues) {
        await this.log(`  ${issue}`, 'ERROR');
      }
    }

    // Log recommendations
    if (report.recommendations.length > 0) {
      await this.log('RECOMMENDATIONS:', 'INFO');
      for (const rec of report.recommendations) {
        await this.log(`  - ${rec}`, 'INFO');
      }
    }

    await this.log('='.repeat(80), 'INFO');
  }

  async startContinuousMonitoring(intervalMinutes: number = 5) {
    await this.log(`Starting continuous monitoring (${intervalMinutes} minute intervals)`, 'INFO');

    // Initial check
    await this.generateReport();

    // Set up interval
    setInterval(async () => {
      await this.generateReport();
    }, intervalMinutes * 60 * 1000);

    // Keep process running
    await new Promise(() => {}); // Run forever
  }

  async runSingleCheck() {
    const report = await this.generateReport();
    
    console.log('\n📊 Production Monitoring Summary:');
    console.log(`✅ Healthy: ${report.summary.healthy}`);
    console.log(`⚠️  Warnings: ${report.summary.warnings}`);
    console.log(`❌ Errors: ${report.summary.errors}`);
    
    if (report.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      report.criticalIssues.forEach(issue => console.log(`  ${issue}`));
    }
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    
    console.log(`\n📝 Detailed logs saved to: ${this.logFile}`);
    
    return report;
  }
}

// Main execution
if (import.meta.main) {
  const monitor = new ProductionMonitor();
  
  const args = Deno.args;
  
  if (args.includes('--continuous')) {
    const interval = parseInt(args[args.indexOf('--interval') + 1] || '5');
    await monitor.startContinuousMonitoring(interval);
  } else {
    await monitor.runSingleCheck();
  }
}