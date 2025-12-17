#!/usr/bin/env deno run --allow-net --allow-read --allow-write --allow-env
/**
 * Alert Manager for Pitchey Performance Monitoring
 * Evaluates metrics against thresholds and sends alerts
 */

interface AlertConfig {
  alerting: {
    enabled: boolean;
    channels: {
      webhook?: { enabled: boolean; url: string; timeout: number; retry_attempts: number };
      email?: { enabled: boolean; [key: string]: any };
      slack?: { enabled: boolean; webhook_url: string; channel: string };
    };
    global_settings: {
      cooldown_period_minutes: number;
      escalation_after_minutes: number;
      auto_resolve_after_minutes: number;
    };
  };
  thresholds: any;
  endpoint_specific_thresholds: any;
  alert_rules: any;
}

interface Alert {
  id: string;
  rule: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: string;
  endpoint?: string;
  value: number;
  threshold: number;
  status: 'firing' | 'resolved';
  runbook?: string;
  metadata: any;
}

interface ActiveAlert extends Alert {
  first_seen: string;
  last_updated: string;
  notification_count: number;
  escalated: boolean;
}

class AlertManager {
  private config: AlertConfig;
  private activeAlerts: Map<string, ActiveAlert>;
  private alertHistory: Alert[];
  private configFile: string;
  private alertsFile: string;

  constructor(configFile = './alerting-config.json') {
    this.configFile = configFile;
    this.alertsFile = './alerts-state.json';
    this.activeAlerts = new Map();
    this.alertHistory = [];
  }

  async loadConfig(): Promise<void> {
    try {
      const configText = await Deno.readTextFile(this.configFile);
      // Replace environment variables in config
      const expandedConfig = this.expandEnvironmentVariables(configText);
      this.config = JSON.parse(expandedConfig);
    } catch (error) {
      throw new Error(`Failed to load alerting config: ${error.message}`);
    }
  }

  private expandEnvironmentVariables(text: string): string {
    return text.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      return Deno.env.get(envVar) || match;
    });
  }

  async loadAlertState(): Promise<void> {
    try {
      const stateText = await Deno.readTextFile(this.alertsFile);
      const state = JSON.parse(stateText);
      
      // Restore active alerts
      if (state.activeAlerts) {
        this.activeAlerts.clear();
        for (const [key, alert] of Object.entries(state.activeAlerts)) {
          this.activeAlerts.set(key, alert as ActiveAlert);
        }
      }
      
      if (state.alertHistory) {
        this.alertHistory = state.alertHistory;
      }
    } catch (error) {
      // File doesn't exist or is corrupted, start fresh
      console.log('Starting with clean alert state');
    }
  }

  async saveAlertState(): Promise<void> {
    const state = {
      activeAlerts: Object.fromEntries(this.activeAlerts),
      alertHistory: this.alertHistory.slice(-1000), // Keep last 1000 alerts
      lastSaved: new Date().toISOString(),
    };
    
    await Deno.writeTextFile(this.alertsFile, JSON.stringify(state, null, 2));
  }

  private generateAlertId(rule: string, endpoint?: string): string {
    const base = endpoint ? `${rule}-${endpoint}` : rule;
    return base.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  }

  private evaluateThreshold(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  async evaluateMetrics(metrics: any, endpointMetrics: any[]): Promise<Alert[]> {
    if (!this.config.alerting.enabled) {
      return [];
    }

    const newAlerts: Alert[] = [];
    const now = new Date().toISOString();

    // Check global response time thresholds
    if (metrics.responseTime.avg24h > this.config.thresholds.response_time.critical.value) {
      newAlerts.push({
        id: this.generateAlertId('critical_response_time'),
        rule: 'critical_response_time',
        severity: 'critical',
        message: `Critical response time detected: ${metrics.responseTime.avg24h}ms (threshold: ${this.config.thresholds.response_time.critical.value}ms)`,
        timestamp: now,
        value: metrics.responseTime.avg24h,
        threshold: this.config.thresholds.response_time.critical.value,
        status: 'firing',
        runbook: this.config.alert_rules.critical_response_time.runbook,
        metadata: { type: 'global_response_time', metric: metrics.responseTime }
      });
    } else if (metrics.responseTime.avg24h > this.config.thresholds.response_time.warning.value) {
      newAlerts.push({
        id: this.generateAlertId('high_response_time'),
        rule: 'high_response_time',
        severity: 'warning',
        message: `Average response time is ${metrics.responseTime.avg24h}ms (threshold: ${this.config.thresholds.response_time.warning.value}ms)`,
        timestamp: now,
        value: metrics.responseTime.avg24h,
        threshold: this.config.thresholds.response_time.warning.value,
        status: 'firing',
        runbook: this.config.alert_rules.high_response_time.runbook,
        metadata: { type: 'global_response_time', metric: metrics.responseTime }
      });
    }

    // Check P95 response time
    if (metrics.responseTime.p95 > this.config.thresholds.response_time.p95_critical.value) {
      newAlerts.push({
        id: this.generateAlertId('p95_response_time_critical'),
        rule: 'p95_response_time_critical',
        severity: 'critical',
        message: `P95 response time critical: ${metrics.responseTime.p95}ms (threshold: ${this.config.thresholds.response_time.p95_critical.value}ms)`,
        timestamp: now,
        value: metrics.responseTime.p95,
        threshold: this.config.thresholds.response_time.p95_critical.value,
        status: 'firing',
        metadata: { type: 'p95_response_time' }
      });
    }

    // Check error rate
    if (metrics.errorRate.avg24h > this.config.thresholds.error_rate.critical.value) {
      newAlerts.push({
        id: this.generateAlertId('critical_error_rate'),
        rule: 'critical_error_rate',
        severity: 'critical',
        message: `Critical error rate: ${metrics.errorRate.avg24h}% (threshold: ${this.config.thresholds.error_rate.critical.value}%)`,
        timestamp: now,
        value: metrics.errorRate.avg24h,
        threshold: this.config.thresholds.error_rate.critical.value,
        status: 'firing',
        runbook: this.config.alert_rules.critical_error_rate.runbook,
        metadata: { type: 'error_rate', metric: metrics.errorRate }
      });
    } else if (metrics.errorRate.avg24h > this.config.thresholds.error_rate.warning.value) {
      newAlerts.push({
        id: this.generateAlertId('high_error_rate'),
        rule: 'high_error_rate', 
        severity: 'warning',
        message: `Error rate is ${metrics.errorRate.avg24h}% (threshold: ${this.config.thresholds.error_rate.warning.value}%)`,
        timestamp: now,
        value: metrics.errorRate.avg24h,
        threshold: this.config.thresholds.error_rate.warning.value,
        status: 'firing',
        runbook: this.config.alert_rules.high_error_rate.runbook,
        metadata: { type: 'error_rate', metric: metrics.errorRate }
      });
    }

    // Check cache performance
    if (metrics.cachePerformance.hitRate < this.config.thresholds.cache_performance.hit_rate_critical.value) {
      newAlerts.push({
        id: this.generateAlertId('critical_cache_failure'),
        rule: 'critical_cache_failure',
        severity: 'critical',
        message: `Cache system failure: hit rate ${metrics.cachePerformance.hitRate}% (threshold: ${this.config.thresholds.cache_performance.hit_rate_critical.value}%)`,
        timestamp: now,
        value: metrics.cachePerformance.hitRate,
        threshold: this.config.thresholds.cache_performance.hit_rate_critical.value,
        status: 'firing',
        runbook: this.config.alert_rules.critical_cache_failure.runbook,
        metadata: { type: 'cache_performance', metric: metrics.cachePerformance }
      });
    } else if (metrics.cachePerformance.hitRate < this.config.thresholds.cache_performance.hit_rate_warning.value) {
      newAlerts.push({
        id: this.generateAlertId('low_cache_hit_rate'),
        rule: 'low_cache_hit_rate',
        severity: 'warning',
        message: `Cache hit rate is ${metrics.cachePerformance.hitRate}% (threshold: ${this.config.thresholds.cache_performance.hit_rate_warning.value}%)`,
        timestamp: now,
        value: metrics.cachePerformance.hitRate,
        threshold: this.config.thresholds.cache_performance.hit_rate_warning.value,
        status: 'firing',
        runbook: this.config.alert_rules.low_cache_hit_rate.runbook,
        metadata: { type: 'cache_performance', metric: metrics.cachePerformance }
      });
    }

    // Check endpoint health
    const unhealthyPercent = (metrics.endpointHealth.unhealthy / metrics.endpointHealth.total) * 100;
    const degradedPercent = (metrics.endpointHealth.degraded / metrics.endpointHealth.total) * 100;

    if (unhealthyPercent > this.config.thresholds.endpoint_health.critical_threshold.value) {
      newAlerts.push({
        id: this.generateAlertId('system_outage'),
        rule: 'system_outage',
        severity: 'critical',
        message: `Major outage: ${unhealthyPercent.toFixed(1)}% of endpoints are unhealthy`,
        timestamp: now,
        value: unhealthyPercent,
        threshold: this.config.thresholds.endpoint_health.critical_threshold.value,
        status: 'firing',
        runbook: this.config.alert_rules.system_outage.runbook,
        metadata: { type: 'system_health', endpointHealth: metrics.endpointHealth }
      });
    } else if (degradedPercent > this.config.thresholds.endpoint_health.degraded_threshold.value) {
      newAlerts.push({
        id: this.generateAlertId('endpoint_degradation'),
        rule: 'endpoint_degradation',
        severity: 'warning',
        message: `${degradedPercent.toFixed(1)}% of endpoints are degraded`,
        timestamp: now,
        value: degradedPercent,
        threshold: this.config.thresholds.endpoint_health.degraded_threshold.value,
        status: 'firing',
        runbook: this.config.alert_rules.endpoint_degradation.runbook,
        metadata: { type: 'endpoint_health', endpointHealth: metrics.endpointHealth }
      });
    }

    // Check individual endpoint thresholds
    for (const endpointMetric of endpointMetrics) {
      const endpoint = endpointMetric.endpoint;
      const thresholds = this.config.endpoint_specific_thresholds[endpoint];
      
      if (!thresholds) continue;

      // Endpoint response time
      if (thresholds.response_time_critical && endpointMetric.responseTime > thresholds.response_time_critical) {
        newAlerts.push({
          id: this.generateAlertId('endpoint_response_time_critical', endpoint),
          rule: 'endpoint_response_time_critical',
          severity: 'critical',
          message: `${endpoint}: Critical response time ${endpointMetric.responseTime}ms (threshold: ${thresholds.response_time_critical}ms)`,
          timestamp: now,
          endpoint,
          value: endpointMetric.responseTime,
          threshold: thresholds.response_time_critical,
          status: 'firing',
          metadata: { type: 'endpoint_response_time', endpointMetric }
        });
      } else if (thresholds.response_time_warning && endpointMetric.responseTime > thresholds.response_time_warning) {
        newAlerts.push({
          id: this.generateAlertId('endpoint_response_time_warning', endpoint),
          rule: 'endpoint_response_time_warning',
          severity: 'warning',
          message: `${endpoint}: Slow response time ${endpointMetric.responseTime}ms (threshold: ${thresholds.response_time_warning}ms)`,
          timestamp: now,
          endpoint,
          value: endpointMetric.responseTime,
          threshold: thresholds.response_time_warning,
          status: 'firing',
          metadata: { type: 'endpoint_response_time', endpointMetric }
        });
      }

      // Endpoint error rate
      if (thresholds.error_rate_critical !== undefined && endpointMetric.errorRate > thresholds.error_rate_critical) {
        newAlerts.push({
          id: this.generateAlertId('endpoint_error_rate_critical', endpoint),
          rule: 'endpoint_error_rate_critical',
          severity: 'critical',
          message: `${endpoint}: Critical error rate ${endpointMetric.errorRate}% (threshold: ${thresholds.error_rate_critical}%)`,
          timestamp: now,
          endpoint,
          value: endpointMetric.errorRate,
          threshold: thresholds.error_rate_critical,
          status: 'firing',
          metadata: { type: 'endpoint_error_rate', endpointMetric }
        });
      }

      // Endpoint cache hit rate
      if (thresholds.cache_hit_rate_warning && endpointMetric.cacheHitRate < thresholds.cache_hit_rate_warning) {
        newAlerts.push({
          id: this.generateAlertId('endpoint_cache_performance', endpoint),
          rule: 'endpoint_cache_performance',
          severity: 'warning',
          message: `${endpoint}: Low cache hit rate ${endpointMetric.cacheHitRate}% (threshold: ${thresholds.cache_hit_rate_warning}%)`,
          timestamp: now,
          endpoint,
          value: endpointMetric.cacheHitRate,
          threshold: thresholds.cache_hit_rate_warning,
          status: 'firing',
          metadata: { type: 'endpoint_cache', endpointMetric }
        });
      }
    }

    return newAlerts;
  }

  private async sendAlert(alert: Alert, channels: string[]): Promise<boolean> {
    const promises: Promise<boolean>[] = [];

    for (const channel of channels) {
      if (channel === 'webhook' && this.config.alerting.channels.webhook?.enabled) {
        promises.push(this.sendWebhookAlert(alert));
      } else if (channel === 'email' && this.config.alerting.channels.email?.enabled) {
        promises.push(this.sendEmailAlert(alert));
      } else if (channel === 'slack' && this.config.alerting.channels.slack?.enabled) {
        promises.push(this.sendSlackAlert(alert));
      }
    }

    const results = await Promise.allSettled(promises);
    return results.some(result => result.status === 'fulfilled' && result.value);
  }

  private async sendWebhookAlert(alert: Alert): Promise<boolean> {
    const config = this.config.alerting.channels.webhook!;
    
    const payload = {
      alert_id: alert.id,
      rule: alert.rule,
      severity: alert.severity,
      status: alert.status,
      message: alert.message,
      timestamp: alert.timestamp,
      endpoint: alert.endpoint,
      value: alert.value,
      threshold: alert.threshold,
      runbook: alert.runbook,
      metadata: alert.metadata,
      dashboard_url: 'file://./performance-dashboard.html'
    };

    let attempt = 0;
    while (attempt < config.retry_attempts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.timeout);

        const response = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'PitcheyAlertManager/1.0'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`✅ Webhook alert sent: ${alert.id}`);
          return true;
        } else {
          console.error(`❌ Webhook failed (${response.status}): ${alert.id}`);
        }
      } catch (error) {
        console.error(`❌ Webhook attempt ${attempt + 1} failed:`, error.message);
      }
      
      attempt++;
      if (attempt < config.retry_attempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      }
    }

    return false;
  }

  private async sendEmailAlert(alert: Alert): Promise<boolean> {
    // Email implementation would go here
    console.log(`📧 Email alert (not implemented): ${alert.id}`);
    return false;
  }

  private async sendSlackAlert(alert: Alert): Promise<boolean> {
    const config = this.config.alerting.channels.slack!;
    
    const emoji = alert.severity === 'critical' ? '🚨' : 
                 alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    
    const color = alert.severity === 'critical' ? 'danger' : 
                 alert.severity === 'warning' ? 'warning' : 'good';

    const payload = {
      channel: config.channel,
      username: 'Pitchey Alert Manager',
      icon_emoji: ':warning:',
      attachments: [
        {
          color,
          title: `${emoji} ${alert.rule.replace(/_/g, ' ').toUpperCase()}`,
          text: alert.message,
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Value', value: `${alert.value}${alert.metadata?.type?.includes('time') ? 'ms' : ''}`, short: true },
            { title: 'Threshold', value: `${alert.threshold}${alert.metadata?.type?.includes('time') ? 'ms' : ''}`, short: true },
            { title: 'Endpoint', value: alert.endpoint || 'Global', short: true }
          ],
          footer: 'Pitchey Performance Monitor',
          ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }
      ]
    };

    try {
      const response = await fetch(config.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        console.log(`✅ Slack alert sent: ${alert.id}`);
        return true;
      } else {
        console.error(`❌ Slack alert failed (${response.status}): ${alert.id}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Slack alert error:`, error.message);
      return false;
    }
  }

  async processAlerts(alerts: Alert[]): Promise<void> {
    const now = new Date();
    const currentTime = now.getTime();

    // Process new alerts
    for (const alert of alerts) {
      const existingAlert = this.activeAlerts.get(alert.id);
      
      if (existingAlert) {
        // Update existing alert
        existingAlert.last_updated = alert.timestamp;
        existingAlert.value = alert.value;
        
        // Check if escalation is needed
        const timeSinceFirst = currentTime - new Date(existingAlert.first_seen).getTime();
        const escalationTime = this.config.alerting.global_settings.escalation_after_minutes * 60 * 1000;
        
        if (!existingAlert.escalated && timeSinceFirst > escalationTime && alert.severity === 'critical') {
          existingAlert.escalated = true;
          existingAlert.message = `ESCALATED: ${alert.message}`;
          await this.sendAlert(existingAlert, ['webhook', 'email', 'slack']);
          console.log(`📈 Escalated alert: ${alert.id}`);
        }
      } else {
        // New alert
        const activeAlert: ActiveAlert = {
          ...alert,
          first_seen: alert.timestamp,
          last_updated: alert.timestamp,
          notification_count: 0,
          escalated: false
        };

        this.activeAlerts.set(alert.id, activeAlert);
        
        // Send notification
        const channels = alert.severity === 'critical' ? ['webhook', 'email'] : ['webhook'];
        const sent = await this.sendAlert(alert, channels);
        
        if (sent) {
          activeAlert.notification_count++;
        }

        console.log(`🚨 New ${alert.severity} alert: ${alert.id} - ${alert.message}`);
      }
    }

    // Check for resolved alerts
    const alertIds = new Set(alerts.map(a => a.id));
    const resolvedAlerts: string[] = [];
    
    for (const [alertId, activeAlert] of this.activeAlerts) {
      if (!alertIds.has(alertId)) {
        // Alert is resolved
        const resolvedAlert: Alert = {
          ...activeAlert,
          status: 'resolved',
          message: `RESOLVED: ${activeAlert.message}`,
          timestamp: now.toISOString()
        };

        this.alertHistory.push(resolvedAlert);
        resolvedAlerts.push(alertId);
        
        // Send resolution notification
        await this.sendAlert(resolvedAlert, ['webhook']);
        console.log(`✅ Resolved alert: ${alertId}`);
      }
    }

    // Remove resolved alerts from active list
    for (const alertId of resolvedAlerts) {
      this.activeAlerts.delete(alertId);
    }

    // Auto-resolve old alerts
    const autoResolveTime = this.config.alerting.global_settings.auto_resolve_after_minutes * 60 * 1000;
    const autoResolvedAlerts: string[] = [];
    
    for (const [alertId, activeAlert] of this.activeAlerts) {
      const timeSinceUpdate = currentTime - new Date(activeAlert.last_updated).getTime();
      
      if (timeSinceUpdate > autoResolveTime) {
        const resolvedAlert: Alert = {
          ...activeAlert,
          status: 'resolved',
          message: `AUTO-RESOLVED: ${activeAlert.message}`,
          timestamp: now.toISOString()
        };

        this.alertHistory.push(resolvedAlert);
        autoResolvedAlerts.push(alertId);
        console.log(`⏰ Auto-resolved stale alert: ${alertId}`);
      }
    }

    // Remove auto-resolved alerts
    for (const alertId of autoResolvedAlerts) {
      this.activeAlerts.delete(alertId);
    }

    // Save state
    await this.saveAlertState();
  }

  getActiveAlerts(): ActiveAlert[] {
    return Array.from(this.activeAlerts.values());
  }

  getAlertHistory(limit = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  async getAlertSummary(): Promise<any> {
    const active = this.getActiveAlerts();
    const history = this.getAlertHistory();
    
    const summary = {
      active_alerts: {
        total: active.length,
        critical: active.filter(a => a.severity === 'critical').length,
        warning: active.filter(a => a.severity === 'warning').length,
        info: active.filter(a => a.severity === 'info').length
      },
      recent_history: {
        total_last_24h: history.filter(a => 
          new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length,
        resolved_last_24h: history.filter(a => 
          a.status === 'resolved' && 
          new Date(a.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000
        ).length
      },
      top_alerts: active.slice(0, 5).map(a => ({
        id: a.id,
        rule: a.rule,
        severity: a.severity,
        message: a.message,
        first_seen: a.first_seen
      }))
    };

    return summary;
  }
}

// CLI Interface
if (import.meta.main) {
  const configFile = Deno.args[0] || './alerting-config.json';
  const metricsFile = Deno.args[1] || './dashboard-data/latest-metrics.json';
  
  const alertManager = new AlertManager(configFile);
  
  try {
    // Load configuration and state
    await alertManager.loadConfig();
    await alertManager.loadAlertState();
    
    // Load latest metrics
    let metrics, endpointMetrics;
    try {
      const metricsData = JSON.parse(await Deno.readTextFile(metricsFile));
      metrics = metricsData.metrics;
      endpointMetrics = metricsData.endpointMetrics;
    } catch (error) {
      console.error('❌ Could not load metrics file:', error.message);
      Deno.exit(1);
    }

    // Evaluate and process alerts
    console.log('🔍 Evaluating performance metrics against alert thresholds...');
    const alerts = await alertManager.evaluateMetrics(metrics, endpointMetrics);
    
    if (alerts.length > 0) {
      console.log(`⚠️  Found ${alerts.length} alerts to process`);
      await alertManager.processAlerts(alerts);
    } else {
      console.log('✅ No alerts triggered');
      // Still process to check for resolved alerts
      await alertManager.processAlerts([]);
    }

    // Print summary
    const summary = await alertManager.getAlertSummary();
    console.log('\n📊 Alert Summary:');
    console.log(`Active: ${summary.active_alerts.total} (${summary.active_alerts.critical}C/${summary.active_alerts.warning}W)`);
    console.log(`Resolved (24h): ${summary.recent_history.resolved_last_24h}`);

    if (summary.active_alerts.total > 0) {
      console.log('\n🚨 Active Alerts:');
      summary.top_alerts.forEach((alert: any) => {
        const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
        console.log(`  ${icon} ${alert.rule}: ${alert.message}`);
      });
    }

  } catch (error) {
    console.error('❌ Alert manager failed:', error.message);
    Deno.exit(1);
  }
}