#!/usr/bin/env -S deno run --allow-net --allow-env

/**
 * Sentry Configuration & Alert Setup Script
 * Creates comprehensive monitoring rules for production Pitchey deployment
 */

interface AlertRule {
  name: string;
  conditions: {
    metric: string;
    threshold: number;
    timeWindow: string;
  };
  actions: string[];
  severity: "low" | "medium" | "high" | "critical";
}

interface PerformanceBudget {
  metric: string;
  target: number;
  warning: number;
  critical: number;
  description: string;
}

// Recommended Sentry Alert Rules for Pitchey
const ALERT_RULES: AlertRule[] = [
  {
    name: "High Error Rate",
    conditions: {
      metric: "error_rate",
      threshold: 5, // 5% error rate
      timeWindow: "5m"
    },
    actions: ["email", "slack"],
    severity: "high"
  },
  {
    name: "API Response Time Degradation", 
    conditions: {
      metric: "p95_response_time",
      threshold: 2000, // 2 seconds
      timeWindow: "5m"
    },
    actions: ["email"],
    severity: "medium"
  },
  {
    name: "Database Query Performance",
    conditions: {
      metric: "database_query_duration",
      threshold: 1000, // 1 second
      timeWindow: "1m"
    },
    actions: ["email"],
    severity: "medium"
  },
  {
    name: "Critical System Error",
    conditions: {
      metric: "fatal_errors",
      threshold: 1, // Any fatal error
      timeWindow: "1m"
    },
    actions: ["email", "slack", "pagerduty"],
    severity: "critical"
  },
  {
    name: "Authentication Failures",
    conditions: {
      metric: "auth_failure_rate",
      threshold: 10, // 10% auth failure rate
      timeWindow: "5m"
    },
    actions: ["email"],
    severity: "medium"
  },
  {
    name: "WebSocket Connection Failures",
    conditions: {
      metric: "websocket_error_rate", 
      threshold: 15, // 15% WebSocket error rate
      timeWindow: "5m"
    },
    actions: ["email"],
    severity: "medium"
  }
];

// Performance Budgets for Key Metrics
const PERFORMANCE_BUDGETS: PerformanceBudget[] = [
  {
    metric: "Page Load Time",
    target: 2000, // 2 seconds
    warning: 3000, // 3 seconds
    critical: 5000, // 5 seconds
    description: "Frontend page load performance"
  },
  {
    metric: "API Response Time (P95)",
    target: 500, // 500ms
    warning: 1000, // 1 second
    critical: 2000, // 2 seconds
    description: "Backend API response time 95th percentile"
  },
  {
    metric: "Database Query Duration",
    target: 100, // 100ms
    warning: 500, // 500ms
    critical: 1000, // 1 second
    description: "Database query execution time"
  },
  {
    metric: "Time to Interactive (TTI)",
    target: 3000, // 3 seconds
    warning: 5000, // 5 seconds
    critical: 8000, // 8 seconds
    description: "Frontend interactivity performance"
  }
];

// Key Dashboard Widgets Configuration
const DASHBOARD_CONFIG = {
  name: "Pitchey Production Monitoring",
  widgets: [
    {
      type: "error_rate_chart",
      title: "Error Rate Trends",
      timeframe: "24h",
      breakdown: ["endpoint", "user_type", "environment"]
    },
    {
      type: "performance_chart", 
      title: "API Response Times",
      timeframe: "4h",
      metrics: ["p50", "p95", "p99"]
    },
    {
      type: "user_activity",
      title: "Active Users by Portal",
      timeframe: "1h", 
      breakdown: ["creator", "investor", "production"]
    },
    {
      type: "database_performance",
      title: "Database Metrics",
      timeframe: "4h",
      metrics: ["query_duration", "connection_count", "slow_queries"]
    },
    {
      type: "feature_usage",
      title: "Feature Adoption",
      timeframe: "7d",
      features: ["pitch_creation", "nda_requests", "investments", "messaging"]
    }
  ]
};

function generateSentryConfigGuide(): string {
  return `
# Sentry Configuration Guide for Pitchey Production

## 🚨 Alert Rules Setup

Copy these configurations into your Sentry project settings:

### Error Rate Alerts
${ALERT_RULES.map(rule => `
**${rule.name}** (${rule.severity})
- Metric: ${rule.conditions.metric}
- Threshold: ${rule.conditions.threshold}
- Time Window: ${rule.conditions.timeWindow}
- Actions: ${rule.actions.join(', ')}
`).join('')}

## 📊 Performance Budgets

Set these targets in your monitoring dashboard:

${PERFORMANCE_BUDGETS.map(budget => `
**${budget.metric}**
- Target: ${budget.target}ms
- Warning: ${budget.warning}ms  
- Critical: ${budget.critical}ms
- ${budget.description}
`).join('')}

## 📈 Recommended Dashboard Widgets

Configure these widgets in your Sentry dashboard:

${DASHBOARD_CONFIG.widgets.map(widget => `
**${widget.title}** (${widget.type})
- Timeframe: ${widget.timeframe}
${widget.breakdown ? `- Breakdown: ${widget.breakdown.join(', ')}` : ''}
${widget.metrics ? `- Metrics: ${widget.metrics.join(', ')}` : ''}
${widget.features ? `- Features: ${widget.features.join(', ')}` : ''}
`).join('')}

## 🔧 Team Configuration

1. **Add Team Members**: Invite developers to Sentry project
2. **Notification Channels**: Configure email, Slack, PagerDuty
3. **Alert Ownership**: Assign alert rules to specific team members
4. **Escalation Rules**: Set up escalation for critical alerts

## 📱 Integration Setup

### Slack Integration:
1. Install Sentry app in Slack workspace
2. Connect to #alerts or #engineering channel
3. Configure alert formatting preferences

### Email Notifications:
- Configure digest emails (daily/weekly summaries)
- Set individual alert email preferences
- Create escalation email lists

## 🎯 Custom Tags for Filtering

Add these custom tags to your Sentry events:

- \`user_type\`: creator, investor, production
- \`portal\`: dashboard, browse, pitch_detail
- \`feature\`: auth, pitch_mgmt, nda, messaging, investment
- \`api_version\`: v1, v2 (for API versioning)
- \`deployment_env\`: production, staging

## 🔍 Search Queries for Common Issues

Save these as bookmark searches in Sentry:

1. **Authentication Errors**: \`event.type:error AND message:"auth*"\`
2. **Database Issues**: \`event.type:error AND message:"database*" OR message:"sql*"\`
3. **API Timeouts**: \`event.type:error AND message:"timeout*"\`
4. **WebSocket Errors**: \`event.type:error AND message:"websocket*"\`
5. **Payment Issues**: \`event.type:error AND message:"payment*" OR message:"stripe*"\`

## 📋 Weekly Review Checklist

- [ ] Review error trends and patterns
- [ ] Check performance budget compliance
- [ ] Analyze user experience metrics  
- [ ] Review security-related alerts
- [ ] Update alert thresholds based on traffic patterns
`;
}

function generateHealthCheckScript(): string {
  return `#!/usr/bin/env -S deno run --allow-net

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
  console.log("🏥 Running Pitchey Health Checks\\n");
  
  const allChecks = [...ENDPOINTS, ...CRITICAL_APIS];
  const results = await Promise.all(allChecks.map(checkEndpoint));
  
  let healthyCount = 0;
  let criticalIssues = 0;
  
  for (const result of results) {
    const statusEmoji = result.status === 200 ? "✅" : result.status === 0 ? "🔴" : "⚠️";
    const timeColor = result.responseTime > 2000 ? "🐌" : result.responseTime > 1000 ? "⏰" : "⚡";
    
    console.log(\`\${statusEmoji} \${result.url}\`);
    console.log(\`   Status: \${result.status} | Response Time: \${timeColor} \${result.responseTime}ms\`);
    
    if (result.error) {
      console.log(\`   Error: \${result.error}\`);
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
  
  console.log(\`📊 Overall Health: \${overallHealth.toFixed(1)}% (\${healthyCount}/\${allChecks.length} healthy)\`);
  console.log(\`🚨 Critical Issues: \${criticalIssues}\`);
  
  if (criticalIssues > 0) {
    console.log("\\n🔔 Consider investigating critical issues immediately");
  }
  
  if (overallHealth < 90) {
    console.log("\\n⚠️  System health below 90% - review required");
  } else {
    console.log("\\n✅ System health looks good!");
  }
}

// Run health checks
await runHealthChecks();
`;
}

// Generate configuration files
console.log("🔧 Generating Sentry Configuration...\n");

const configGuide = generateSentryConfigGuide();
const healthCheckScript = generateHealthCheckScript();

console.log("📋 Sentry Configuration Guide:");
console.log("=====================================");
console.log(configGuide);

console.log("\n🏥 Generated Health Check Script");
console.log("Save this as 'health-check.ts' for monitoring");

// Save files
await Deno.writeTextFile("SENTRY_CONFIGURATION_GUIDE.md", configGuide);
await Deno.writeTextFile("health-check.ts", healthCheckScript);

console.log("\n✅ Files created:");
console.log("- SENTRY_CONFIGURATION_GUIDE.md");
console.log("- health-check.ts");
console.log("\n🚀 Next steps:");
console.log("1. Review and implement Sentry alert rules");
console.log("2. Set up team notifications");
console.log("3. Configure monitoring dashboard");
console.log("4. Schedule health-check.ts to run every 5 minutes");