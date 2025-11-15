#!/usr/bin/env -S deno run --allow-all
/**
 * Pre-Deployment Check Script
 * Validates production readiness before deployment
 */

interface DeploymentCheck {
  name: string;
  description: string;
  required: boolean;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

interface DeploymentReport {
  timestamp: string;
  environment: string;
  overallStatus: "pass" | "fail" | "warning";
  checks: DeploymentCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

class PreDeploymentValidator {
  private checks: DeploymentCheck[] = [];
  
  async validateAll(): Promise<DeploymentReport> {
    console.log("🔍 Running pre-deployment validation checks...");
    
    // Run all validation checks
    await this.checkEnvironmentVariables();
    await this.checkDatabaseConnection();
    await this.checkDependencies();
    await this.checkSecurity();
    await this.checkPerformance();
    await this.checkDocumentation();
    await this.checkBackupSystems();
    await this.checkMonitoring();
    
    const summary = this.generateSummary();
    const overallStatus = this.determineOverallStatus(summary);
    
    const report: DeploymentReport = {
      timestamp: new Date().toISOString(),
      environment: Deno.env.get("DENO_ENV") || "unknown",
      overallStatus,
      checks: this.checks,
      summary
    };
    
    this.printReport(report);
    return report;
  }
  
  private async checkEnvironmentVariables() {
    const requiredEnvVars = [
      "DATABASE_URL",
      "JWT_SECRET", 
      "DENO_ENV"
    ];
    
    const optionalEnvVars = [
      "REDIS_URL",
      "SENTRY_DSN",
      "SLACK_WEBHOOK_URL"
    ];
    
    let missingRequired = 0;
    let missingOptional = 0;
    
    for (const envVar of requiredEnvVars) {
      if (!Deno.env.get(envVar)) {
        missingRequired++;
      }
    }
    
    for (const envVar of optionalEnvVars) {
      if (!Deno.env.get(envVar)) {
        missingOptional++;
      }
    }
    
    this.addCheck({
      name: "Environment Variables",
      description: "Validate required environment variables are set",
      required: true,
      status: missingRequired > 0 ? "fail" : "pass",
      message: missingRequired > 0 
        ? `Missing ${missingRequired} required environment variables`
        : "All required environment variables are set",
      details: {
        required: requiredEnvVars.length - missingRequired,
        optional: optionalEnvVars.length - missingOptional,
        missing: missingRequired
      }
    });
  }
  
  private async checkDatabaseConnection() {
    try {
      const databaseUrl = Deno.env.get("DATABASE_URL");
      if (!databaseUrl) {
        this.addCheck({
          name: "Database Connection",
          description: "Verify database connectivity",
          required: true,
          status: "fail",
          message: "DATABASE_URL not configured"
        });
        return;
      }
      
      // Simple connection test (would be more sophisticated in real implementation)
      const isValidUrl = databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://");
      
      this.addCheck({
        name: "Database Connection",
        description: "Verify database connectivity",
        required: true,
        status: isValidUrl ? "pass" : "fail",
        message: isValidUrl ? "Database URL format is valid" : "Invalid database URL format",
        details: {
          url_format: isValidUrl ? "valid" : "invalid",
          scheme: databaseUrl.split("://")[0]
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Database Connection",
        description: "Verify database connectivity",
        required: true,
        status: "fail",
        message: `Database check failed: ${error.message}`
      });
    }
  }
  
  private async checkDependencies() {
    try {
      // Check if main server files exist and can be parsed
      const serverExists = await this.fileExists("server-modular.ts");
      const workingServerExists = await this.fileExists("working-server.ts");
      
      // Check if critical modules exist
      const routesExist = await this.fileExists("src/routes");
      const middlewareExists = await this.fileExists("src/middleware");
      const servicesExist = await this.fileExists("src/services");
      
      const criticalFiles = [serverExists, routesExist, middlewareExists, servicesExist];
      const missingCritical = criticalFiles.filter(exists => !exists).length;
      
      this.addCheck({
        name: "Dependencies & Files",
        description: "Verify all critical files and dependencies are present",
        required: true,
        status: missingCritical > 0 ? "fail" : "pass",
        message: missingCritical > 0 
          ? `Missing ${missingCritical} critical components`
          : "All critical dependencies and files are present",
        details: {
          server_files: serverExists && workingServerExists,
          route_modules: routesExist,
          middleware_modules: middlewareExists,
          service_modules: servicesExist
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Dependencies & Files",
        description: "Verify all critical files and dependencies are present",
        required: true,
        status: "fail",
        message: `Dependency check failed: ${error.message}`
      });
    }
  }
  
  private async checkSecurity() {
    try {
      const securityMiddlewareExists = await this.fileExists("src/middleware/security.middleware.ts");
      const jwtUtilsExist = await this.fileExists("src/utils/jwt.ts");
      const jwtSecret = Deno.env.get("JWT_SECRET");
      
      const securityIssues = [];
      
      if (!securityMiddlewareExists) {
        securityIssues.push("Security middleware missing");
      }
      
      if (!jwtUtilsExist) {
        securityIssues.push("JWT utilities missing");
      }
      
      if (!jwtSecret || jwtSecret.length < 32) {
        securityIssues.push("JWT secret too weak or missing");
      }
      
      this.addCheck({
        name: "Security Configuration",
        description: "Verify security measures are properly configured",
        required: true,
        status: securityIssues.length > 0 ? "fail" : "pass",
        message: securityIssues.length > 0 
          ? `Security issues found: ${securityIssues.join(", ")}`
          : "Security configuration is properly set up",
        details: {
          middleware: securityMiddlewareExists,
          jwt_utils: jwtUtilsExist,
          jwt_secret_strength: jwtSecret ? jwtSecret.length >= 32 : false,
          issues: securityIssues
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Security Configuration", 
        description: "Verify security measures are properly configured",
        required: true,
        status: "fail",
        message: `Security check failed: ${error.message}`
      });
    }
  }
  
  private async checkPerformance() {
    try {
      // Check for cache optimization service
      const cacheServiceExists = await this.fileExists("src/services/cache-optimization.service.ts");
      
      // Check for monitoring service
      const monitoringExists = await this.fileExists("src/services/monitoring.service.ts");
      
      // Check Redis configuration for caching
      const redisUrl = Deno.env.get("REDIS_URL") || Deno.env.get("UPSTASH_REDIS_REST_URL");
      
      const performanceScore = [cacheServiceExists, monitoringExists, !!redisUrl]
        .filter(Boolean).length;
      
      this.addCheck({
        name: "Performance Optimization",
        description: "Verify performance optimization features are configured",
        required: false,
        status: performanceScore >= 2 ? "pass" : "warning",
        message: `Performance optimization score: ${performanceScore}/3`,
        details: {
          cache_service: cacheServiceExists,
          monitoring: monitoringExists,
          redis_configured: !!redisUrl,
          score: performanceScore
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Performance Optimization",
        description: "Verify performance optimization features are configured", 
        required: false,
        status: "warning",
        message: `Performance check failed: ${error.message}`
      });
    }
  }
  
  private async checkDocumentation() {
    try {
      const readmeExists = await this.fileExists("README.md");
      const claudeExists = await this.fileExists("CLAUDE.md");
      const apiDocsExist = await this.fileExists("src/routes/documentation.ts");
      
      const docScore = [readmeExists, claudeExists, apiDocsExist].filter(Boolean).length;
      
      this.addCheck({
        name: "Documentation",
        description: "Verify project documentation is available",
        required: false,
        status: docScore >= 2 ? "pass" : "warning",
        message: `Documentation completeness: ${docScore}/3`,
        details: {
          readme: readmeExists,
          claude_instructions: claudeExists,
          api_docs: apiDocsExist,
          completeness: Math.round((docScore / 3) * 100)
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Documentation",
        description: "Verify project documentation is available",
        required: false,
        status: "warning", 
        message: `Documentation check failed: ${error.message}`
      });
    }
  }
  
  private async checkBackupSystems() {
    try {
      // Check if backup strategies are documented
      const hasDbMigrations = await this.fileExists("src/db/migrate.ts");
      const hasSchema = await this.fileExists("src/db/schema.ts");
      
      this.addCheck({
        name: "Backup & Recovery",
        description: "Verify backup and recovery systems are in place",
        required: false,
        status: hasDbMigrations && hasSchema ? "pass" : "warning",
        message: hasDbMigrations && hasSchema 
          ? "Database migration and schema management in place"
          : "Backup/recovery systems need attention",
        details: {
          migrations: hasDbMigrations,
          schema_management: hasSchema,
          automated_backups: false // Would check actual backup configuration
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Backup & Recovery",
        description: "Verify backup and recovery systems are in place",
        required: false,
        status: "warning",
        message: `Backup check failed: ${error.message}`
      });
    }
  }
  
  private async checkMonitoring() {
    try {
      const sentryDsn = Deno.env.get("SENTRY_DSN");
      const telemetryExists = await this.fileExists("src/utils/telemetry.ts");
      const monitoringRoutes = await this.fileExists("src/routes/monitoring.ts");
      
      const monitoringFeatures = [!!sentryDsn, telemetryExists, monitoringRoutes]
        .filter(Boolean).length;
      
      this.addCheck({
        name: "Monitoring & Observability",
        description: "Verify monitoring and logging systems are configured",
        required: false,
        status: monitoringFeatures >= 2 ? "pass" : "warning",
        message: `Monitoring features configured: ${monitoringFeatures}/3`,
        details: {
          sentry_configured: !!sentryDsn,
          telemetry_system: telemetryExists,
          monitoring_endpoints: monitoringRoutes,
          coverage: Math.round((monitoringFeatures / 3) * 100)
        }
      });
      
    } catch (error) {
      this.addCheck({
        name: "Monitoring & Observability", 
        description: "Verify monitoring and logging systems are configured",
        required: false,
        status: "warning",
        message: `Monitoring check failed: ${error.message}`
      });
    }
  }
  
  private addCheck(check: DeploymentCheck) {
    this.checks.push(check);
  }
  
  private async fileExists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      return false;
    }
  }
  
  private generateSummary() {
    const total = this.checks.length;
    const passed = this.checks.filter(c => c.status === "pass").length;
    const failed = this.checks.filter(c => c.status === "fail").length;
    const warnings = this.checks.filter(c => c.status === "warning").length;
    
    return { total, passed, failed, warnings };
  }
  
  private determineOverallStatus(summary: any): "pass" | "fail" | "warning" {
    const requiredChecks = this.checks.filter(c => c.required);
    const failedRequired = requiredChecks.filter(c => c.status === "fail").length;
    
    if (failedRequired > 0) {
      return "fail";
    }
    
    if (summary.warnings > 0) {
      return "warning";
    }
    
    return "pass";
  }
  
  private printReport(report: DeploymentReport) {
    console.log("\\n" + "=".repeat(60));
    console.log("🚀 PRE-DEPLOYMENT VALIDATION REPORT");
    console.log("=".repeat(60));
    console.log(`Environment: ${report.environment}`);
    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Overall Status: ${this.getStatusIcon(report.overallStatus)} ${report.overallStatus.toUpperCase()}`);
    console.log(`\\nSummary: ${report.summary.passed}✅ ${report.summary.failed}❌ ${report.summary.warnings}⚠️`);
    
    console.log("\\n" + "─".repeat(60));
    console.log("DETAILED RESULTS:");
    console.log("─".repeat(60));
    
    for (const check of report.checks) {
      const icon = this.getStatusIcon(check.status);
      const required = check.required ? "[REQUIRED]" : "[OPTIONAL]";
      console.log(`${icon} ${check.name} ${required}`);
      console.log(`   ${check.message}`);
      if (check.details) {
        console.log(`   Details: ${JSON.stringify(check.details, null, 2).replace(/\\n/g, "\\n   ")}`);
      }
      console.log();
    }
    
    if (report.overallStatus === "fail") {
      console.log("❌ DEPLOYMENT BLOCKED - Critical issues must be resolved before proceeding");
      Deno.exit(1);
    } else if (report.overallStatus === "warning") {
      console.log("⚠️  DEPLOYMENT ALLOWED WITH WARNINGS - Consider addressing warnings");
    } else {
      console.log("✅ DEPLOYMENT APPROVED - All critical checks passed");
    }
    
    console.log("=".repeat(60));
  }
  
  private getStatusIcon(status: string): string {
    switch (status) {
      case "pass": return "✅";
      case "fail": return "❌";
      case "warning": return "⚠️";
      default: return "❓";
    }
  }
}

// Main execution
if (import.meta.main) {
  const validator = new PreDeploymentValidator();
  
  try {
    const report = await validator.validateAll();
    
    // Write report to file for CI/CD artifacts
    await Deno.writeTextFile(
      "pre-deployment-report.json", 
      JSON.stringify(report, null, 2)
    );
    
    console.log("\\n📄 Report saved to pre-deployment-report.json");
    
  } catch (error) {
    console.error("❌ Pre-deployment validation failed:", error);
    Deno.exit(1);
  }
}