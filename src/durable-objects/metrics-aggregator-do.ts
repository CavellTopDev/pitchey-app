/**
 * MetricsAggregatorDO - Aggregate metrics across all containers
 * Real-time metrics collection, aggregation, and alerting system
 */

import type { Env } from '../worker-integrated';

export interface MetricPoint {
  timestamp: Date;
  metric: string;
  value: number;
  labels: Record<string, string>;
  source: string; // container ID, service name, etc.
  type: 'gauge' | 'counter' | 'histogram' | 'summary';
  unit?: string;
  metadata?: Record<string, any>;
}

export interface AggregatedMetric {
  metric: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'percentile';
  value: number;
  count: number;
  labels: Record<string, string>;
  confidence: number;
  lastUpdated: Date;
}

export interface MetricsQuery {
  metrics: string[];
  labels?: Record<string, string>;
  timeRange: {
    start: Date;
    end: Date;
  };
  aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p90' | 'p95' | 'p99';
  groupBy?: string[];
  interval?: number; // seconds for time series
  limit?: number;
}

export interface MetricsAlert {
  id: string;
  name: string;
  metric: string;
  condition: {
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration: number; // seconds
    aggregation: 'sum' | 'avg' | 'min' | 'max';
  };
  labels?: Record<string, string>;
  notifications: AlertNotification[];
  status: 'active' | 'paused' | 'resolved' | 'acknowledged';
  triggered: boolean;
  triggeredAt?: Date;
  resolvedAt?: Date;
  lastEvaluated: Date;
  evaluationCount: number;
  falsePositiveCount: number;
}

export interface AlertNotification {
  type: 'email' | 'webhook' | 'slack' | 'pagerduty' | 'sms';
  target: string; // email, URL, phone number, etc.
  template?: string;
  cooldown: number; // seconds between notifications
  lastSent?: Date;
}

export interface MetricsDashboard {
  id: string;
  name: string;
  description: string;
  panels: DashboardPanel[];
  timeRange: {
    relative?: string; // '1h', '24h', '7d', '30d'
    absolute?: { start: Date; end: Date };
  };
  refreshInterval: number; // seconds
  variables: DashboardVariable[];
  createdBy: string;
  createdAt: Date;
  lastModified: Date;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'pie' | 'gauge' | 'stat' | 'table' | 'heatmap';
  position: { x: number; y: number; w: number; h: number };
  query: MetricsQuery;
  visualization: {
    legend: boolean;
    tooltip: boolean;
    threshold?: { value: number; color: string }[];
    colors?: string[];
    format?: string;
  };
  options?: Record<string, any>;
}

export interface DashboardVariable {
  name: string;
  type: 'query' | 'constant' | 'interval' | 'datasource';
  label: string;
  query?: string;
  options?: string[];
  defaultValue?: string;
  multiValue: boolean;
}

export interface MetricRetentionPolicy {
  resolution: number; // seconds
  retention: number; // seconds
  aggregations: string[];
}

export interface MetricsIndex {
  metric: string;
  labelKeys: Set<string>;
  labelValues: Map<string, Set<string>>;
  firstSeen: Date;
  lastSeen: Date;
  cardinality: number;
  sampleCount: number;
}

/**
 * Metrics Aggregator Durable Object
 * Collects, aggregates, and provides real-time metrics with alerting
 */
export class MetricsAggregatorDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;
  
  // In-memory storage for recent metrics
  private recentMetrics: Map<string, MetricPoint[]> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetric> = new Map();
  private alerts: Map<string, MetricsAlert> = new Map();
  private dashboards: Map<string, MetricsDashboard> = new Map();
  private metricsIndex: Map<string, MetricsIndex> = new Map();
  
  // Retention policies by resolution
  private retentionPolicies: MetricRetentionPolicy[] = [
    { resolution: 15, retention: 24 * 60 * 60, aggregations: ['avg', 'min', 'max', 'sum'] }, // 15s for 24h
    { resolution: 60, retention: 7 * 24 * 60 * 60, aggregations: ['avg', 'min', 'max', 'sum'] }, // 1m for 7d
    { resolution: 300, retention: 30 * 24 * 60 * 60, aggregations: ['avg', 'min', 'max', 'sum'] }, // 5m for 30d
    { resolution: 3600, retention: 365 * 24 * 60 * 60, aggregations: ['avg', 'min', 'max'] } // 1h for 1y
  ];
  
  // Background task intervals
  private aggregationInterval?: number;
  private alertEvaluationInterval?: number;
  private cleanupInterval?: number;
  private indexUpdateInterval?: number;
  
  // Configuration
  private maxMetricsInMemory = 10000;
  private maxLabelsPerMetric = 100;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    this.initializeMetricsAggregator();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (true) {
        case method === 'POST' && path === '/metrics':
          return this.ingestMetrics(request);
        
        case method === 'POST' && path === '/metrics/batch':
          return this.ingestMetricsBatch(request);
        
        case method === 'POST' && path === '/query':
          return this.queryMetrics(request);
        
        case method === 'GET' && path === '/metrics':
          return this.listMetrics(url.searchParams);
        
        case method === 'GET' && path === '/metrics/index':
          return this.getMetricsIndex();
        
        case method === 'POST' && path === '/alerts':
          return this.createAlert(request);
        
        case method === 'GET' && path.startsWith('/alerts/'):
          return this.getAlert(path.split('/')[2]);
        
        case method === 'PUT' && path.startsWith('/alerts/'):
          return this.updateAlert(path.split('/')[2], request);
        
        case method === 'DELETE' && path.startsWith('/alerts/'):
          return this.deleteAlert(path.split('/')[2]);
        
        case method === 'GET' && path === '/alerts':
          return this.listAlerts(url.searchParams);
        
        case method === 'POST' && path.endsWith('/acknowledge'):
          return this.acknowledgeAlert(path.split('/')[2]);
        
        case method === 'POST' && path === '/dashboards':
          return this.createDashboard(request);
        
        case method === 'GET' && path.startsWith('/dashboards/'):
          return this.getDashboard(path.split('/')[2]);
        
        case method === 'PUT' && path.startsWith('/dashboards/'):
          return this.updateDashboard(path.split('/')[2], request);
        
        case method === 'DELETE' && path.startsWith('/dashboards/'):
          return this.deleteDashboard(path.split('/')[2]);
        
        case method === 'GET' && path === '/dashboards':
          return this.listDashboards();
        
        case method === 'POST' && path.endsWith('/render'):
          return this.renderDashboard(path.split('/')[2], request);
        
        case method === 'GET' && path === '/health':
          return this.getHealth();
        
        case method === 'POST' && path === '/cleanup':
          return this.cleanup();
        
        case method === 'GET' && path === '/stats':
          return this.getStats();
        
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('MetricsAggregatorDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Ingest metrics data
   */
  private async ingestMetrics(request: Request): Promise<Response> {
    const data = await request.json() as {
      timestamp?: string;
      metric?: string;
      value?: string | number;
      labels?: Record<string, string>;
      source?: string;
      type?: string;
      unit?: string;
      metadata?: Record<string, any>;
    };
    const now = new Date();

    const metricPoint: MetricPoint = {
      timestamp: data.timestamp ? new Date(data.timestamp) : now,
      metric: data.metric || '',
      value: parseFloat(String(data.value || '0')),
      labels: data.labels || {},
      source: data.source || '',
      type: (data.type || 'gauge') as MetricPoint['type'],
      unit: data.unit,
      metadata: data.metadata
    };

    await this.ingestMetricPoint(metricPoint);

    return Response.json({
      success: true,
      ingested: 1,
      timestamp: metricPoint.timestamp.toISOString()
    });
  }

  /**
   * Ingest batch of metrics
   */
  private async ingestMetricsBatch(request: Request): Promise<Response> {
    const body = await request.json() as { metrics?: any[] };
    const metrics = body.metrics || [];
    const now = new Date();
    let ingestedCount = 0;

    for (const data of metrics) {
      const metricPoint: MetricPoint = {
        timestamp: data.timestamp ? new Date(data.timestamp) : now,
        metric: data.metric || '',
        value: parseFloat(String(data.value || '0')),
        labels: data.labels || {},
        source: data.source || '',
        type: (data.type || 'gauge') as MetricPoint['type'],
        unit: data.unit,
        metadata: data.metadata
      };

      await this.ingestMetricPoint(metricPoint);
      ingestedCount++;
    }

    return Response.json({
      success: true,
      ingested: ingestedCount,
      timestamp: now.toISOString()
    });
  }

  /**
   * Query metrics with aggregation
   */
  private async queryMetrics(request: Request): Promise<Response> {
    const query: MetricsQuery = await request.json();
    
    const results = await this.executeQuery(query);

    return Response.json({
      success: true,
      query,
      results,
      executionTime: Date.now() // Would track actual execution time
    });
  }

  /**
   * List available metrics
   */
  private async listMetrics(params: URLSearchParams): Promise<Response> {
    const prefix = params.get('prefix');
    const labelsParam = params.get('labels');
    const labels = labelsParam ? JSON.parse(labelsParam) : undefined;
    const limit = parseInt(params.get('limit') || '100');

    const metrics: string[] = [];
    
    for (const [metric, index] of this.metricsIndex.entries()) {
      // Apply filters
      if (prefix && !metric.startsWith(prefix)) continue;
      
      if (labels) {
        let matchesLabels = true;
        for (const [key, value] of Object.entries(labels as Record<string, string>)) {
          if (!index.labelValues.get(key)?.has(value)) {
            matchesLabels = false;
            break;
          }
        }
        if (!matchesLabels) continue;
      }
      
      metrics.push(metric);
      
      if (metrics.length >= limit) break;
    }

    return Response.json({
      success: true,
      metrics,
      count: metrics.length,
      totalMetrics: this.metricsIndex.size
    });
  }

  /**
   * Get metrics index with cardinality info
   */
  private async getMetricsIndex(): Promise<Response> {
    const index = Array.from(this.metricsIndex.values()).map(idx => ({
      metric: idx.metric,
      labelKeys: Array.from(idx.labelKeys),
      cardinality: idx.cardinality,
      sampleCount: idx.sampleCount,
      firstSeen: idx.firstSeen,
      lastSeen: idx.lastSeen
    }));

    return Response.json({
      success: true,
      index,
      totalMetrics: index.length,
      totalCardinality: index.reduce((sum, idx) => sum + idx.cardinality, 0)
    });
  }

  /**
   * Create metrics alert
   */
  private async createAlert(request: Request): Promise<Response> {
    const data = await request.json() as {
      id?: string;
      name?: string;
      metric?: string;
      condition?: MetricsAlert['condition'];
      labels?: Record<string, string>;
      notifications?: AlertNotification[];
    };

    const alert: MetricsAlert = {
      id: data.id || crypto.randomUUID(),
      name: data.name || '',
      metric: data.metric || '',
      condition: data.condition || { operator: '>', threshold: 0, duration: 60, aggregation: 'avg' },
      labels: data.labels,
      notifications: data.notifications || [],
      status: 'active',
      triggered: false,
      lastEvaluated: new Date(),
      evaluationCount: 0,
      falsePositiveCount: 0
    };

    await this.saveAlert(alert);

    return Response.json({
      success: true,
      alert: this.sanitizeAlert(alert),
      message: 'Alert created successfully'
    });
  }

  /**
   * Create dashboard
   */
  private async createDashboard(request: Request): Promise<Response> {
    const data = await request.json() as {
      id?: string;
      name?: string;
      description?: string;
      panels?: DashboardPanel[];
      timeRange?: MetricsDashboard['timeRange'];
      refreshInterval?: number;
      variables?: DashboardVariable[];
      createdBy?: string;
    };

    const dashboard: MetricsDashboard = {
      id: data.id || crypto.randomUUID(),
      name: data.name || '',
      description: data.description || '',
      panels: data.panels || [],
      timeRange: data.timeRange || { relative: '1h' },
      refreshInterval: data.refreshInterval || 60,
      variables: data.variables || [],
      createdBy: data.createdBy || '',
      createdAt: new Date(),
      lastModified: new Date()
    };

    await this.saveDashboard(dashboard);

    return Response.json({
      success: true,
      dashboard: this.sanitizeDashboard(dashboard),
      message: 'Dashboard created successfully'
    });
  }

  /**
   * Initialize metrics aggregator
   */
  private async initializeMetricsAggregator(): Promise<void> {
    // Load existing alerts
    const storedAlerts = await this.storage.list({ prefix: 'alert:' });
    for (const [key, value] of storedAlerts) {
      const alert = value as MetricsAlert;
      this.alerts.set(alert.id, alert);
    }

    // Load dashboards
    const storedDashboards = await this.storage.list({ prefix: 'dashboard:' });
    for (const [key, value] of storedDashboards) {
      const dashboard = value as MetricsDashboard;
      this.dashboards.set(dashboard.id, dashboard);
    }

    // Load metrics index
    const storedIndex = await this.storage.get<Record<string, MetricsIndex>>('metrics_index');
    if (storedIndex) {
      for (const [metric, index] of Object.entries(storedIndex)) {
        // Reconstruct Sets and Maps
        const reconstructedIndex: MetricsIndex = {
          ...index,
          labelKeys: new Set(index.labelKeys),
          labelValues: new Map(Object.entries(index.labelValues).map(([k, v]) => [k, new Set(v)])),
          firstSeen: new Date(index.firstSeen),
          lastSeen: new Date(index.lastSeen)
        };
        this.metricsIndex.set(metric, reconstructedIndex);
      }
    }

    // Start background tasks
    this.startBackgroundTasks();
  }

  /**
   * Start background aggregation and alert tasks
   */
  private startBackgroundTasks(): void {
    // Metrics aggregation every 15 seconds
    this.aggregationInterval = setInterval(async () => {
      try {
        await this.performAggregation();
      } catch (error) {
        console.error('Aggregation task failed:', error);
      }
    }, 15 * 1000) as any;

    // Alert evaluation every 30 seconds
    this.alertEvaluationInterval = setInterval(async () => {
      try {
        await this.evaluateAlerts();
      } catch (error) {
        console.error('Alert evaluation failed:', error);
      }
    }, 30 * 1000) as any;

    // Cleanup old metrics every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }, 5 * 60 * 1000) as any;

    // Update metrics index every minute
    this.indexUpdateInterval = setInterval(async () => {
      try {
        await this.updateMetricsIndex();
      } catch (error) {
        console.error('Index update failed:', error);
      }
    }, 60 * 1000) as any;
  }

  /**
   * Ingest a single metric point
   */
  private async ingestMetricPoint(metricPoint: MetricPoint): Promise<void> {
    // Add to recent metrics buffer
    const key = this.getMetricKey(metricPoint.metric, metricPoint.labels);
    
    if (!this.recentMetrics.has(key)) {
      this.recentMetrics.set(key, []);
    }
    
    const points = this.recentMetrics.get(key)!;
    points.push(metricPoint);
    
    // Keep only recent points in memory
    if (points.length > 1000) {
      points.shift();
    }

    // Update metrics index
    await this.updateMetricIndex(metricPoint);

    // Store to persistent storage for long-term retention
    await this.storeMetricPoint(metricPoint);
  }

  /**
   * Execute metrics query
   */
  private async executeQuery(query: MetricsQuery): Promise<any[]> {
    const results = [];
    
    for (const metricName of query.metrics) {
      const metricResults = await this.queryMetric(metricName, query);
      results.push({
        metric: metricName,
        data: metricResults
      });
    }

    return results;
  }

  /**
   * Query single metric with aggregation
   */
  private async queryMetric(metricName: string, query: MetricsQuery): Promise<any[]> {
    const results = [];
    const timeStep = query.interval || 60; // Default 1 minute intervals
    
    // Generate time series
    const start = query.timeRange.start.getTime();
    const end = query.timeRange.end.getTime();
    
    for (let t = start; t < end; t += timeStep * 1000) {
      const timestamp = new Date(t);
      const endTime = new Date(Math.min(t + timeStep * 1000, end));
      
      // Find relevant metric points in time range
      const points = await this.getMetricPointsInRange(metricName, query.labels, timestamp, endTime);
      
      if (points.length > 0) {
        const aggregatedValue = this.aggregatePoints(points, query.aggregation);
        
        results.push({
          timestamp: timestamp.toISOString(),
          value: aggregatedValue,
          count: points.length
        });
      }
    }

    return results;
  }

  /**
   * Get metric points in time range
   */
  private async getMetricPointsInRange(
    metricName: string,
    labels: Record<string, string> | undefined,
    start: Date,
    end: Date
  ): Promise<MetricPoint[]> {
    const points: MetricPoint[] = [];
    
    // Search in recent metrics buffer
    for (const [key, metricPoints] of this.recentMetrics.entries()) {
      if (!key.startsWith(metricName)) continue;
      
      for (const point of metricPoints) {
        if (point.timestamp >= start && point.timestamp < end) {
          // Check label filters
          if (this.matchesLabels(point.labels, labels)) {
            points.push(point);
          }
        }
      }
    }

    // Search in persistent storage
    const storageKey = `metric:${metricName}:${start.toISOString().split('T')[0]}`;
    const storedPoints = await this.storage.get<MetricPoint[]>(storageKey) || [];
    
    for (const point of storedPoints) {
      const pointTime = new Date(point.timestamp);
      if (pointTime >= start && pointTime < end) {
        if (this.matchesLabels(point.labels, labels)) {
          points.push(point);
        }
      }
    }

    return points.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Aggregate metric points
   */
  private aggregatePoints(points: MetricPoint[], aggregation: string): number {
    if (points.length === 0) return 0;
    
    const values = points.map(p => p.value).sort((a, b) => a - b);
    
    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'p50':
        return this.percentile(values, 0.5);
      case 'p90':
        return this.percentile(values, 0.9);
      case 'p95':
        return this.percentile(values, 0.95);
      case 'p99':
        return this.percentile(values, 0.99);
      default:
        return values[values.length - 1]; // Last value
    }
  }

  /**
   * Perform metrics aggregation
   */
  private async performAggregation(): Promise<void> {
    const now = new Date();
    
    for (const policy of this.retentionPolicies) {
      const bucketStart = new Date(Math.floor(now.getTime() / (policy.resolution * 1000)) * policy.resolution * 1000);
      const bucketEnd = new Date(bucketStart.getTime() + policy.resolution * 1000);
      
      // Aggregate all metrics for this time bucket
      for (const [metricName, index] of this.metricsIndex.entries()) {
        for (const aggregationType of policy.aggregations) {
          await this.aggregateMetricForPeriod(metricName, bucketStart, bucketEnd, aggregationType, policy.resolution);
        }
      }
    }
  }

  /**
   * Aggregate single metric for time period
   */
  private async aggregateMetricForPeriod(
    metricName: string,
    start: Date,
    end: Date,
    aggregation: string,
    resolution: number
  ): Promise<void> {
    const points = await this.getMetricPointsInRange(metricName, undefined, start, end);
    
    if (points.length === 0) return;

    // Group by label combinations
    const labelGroups = new Map<string, MetricPoint[]>();
    
    for (const point of points) {
      const labelKey = JSON.stringify(point.labels);
      if (!labelGroups.has(labelKey)) {
        labelGroups.set(labelKey, []);
      }
      labelGroups.get(labelKey)!.push(point);
    }

    // Create aggregated metrics for each label combination
    for (const [labelKey, labelPoints] of labelGroups.entries()) {
      const labels = JSON.parse(labelKey);
      const value = this.aggregatePoints(labelPoints, aggregation);
      
      const aggregatedMetric: AggregatedMetric = {
        metric: metricName,
        timeRange: { start, end },
        aggregation: aggregation as any,
        value,
        count: labelPoints.length,
        labels,
        confidence: this.calculateConfidence(labelPoints),
        lastUpdated: new Date()
      };

      // Store aggregated metric
      const storageKey = `aggregated:${resolution}:${metricName}:${aggregation}:${start.toISOString()}:${labelKey}`;
      await this.storage.put(storageKey, aggregatedMetric);
    }
  }

  /**
   * Evaluate alerts
   */
  private async evaluateAlerts(): Promise<void> {
    for (const alert of this.alerts.values()) {
      if (alert.status !== 'active') continue;
      
      await this.evaluateAlert(alert);
    }
  }

  /**
   * Evaluate single alert
   */
  private async evaluateAlert(alert: MetricsAlert): Promise<void> {
    alert.evaluationCount++;
    alert.lastEvaluated = new Date();

    try {
      // Get recent metric values
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - alert.condition.duration * 1000);
      
      const points = await this.getMetricPointsInRange(alert.metric, alert.labels, startTime, endTime);
      
      if (points.length === 0) return;

      const currentValue = this.aggregatePoints(points, alert.condition.aggregation);
      const shouldTrigger = this.evaluateCondition(currentValue, alert.condition);

      if (shouldTrigger && !alert.triggered) {
        // Alert triggered
        alert.triggered = true;
        alert.triggeredAt = new Date();
        
        await this.sendAlertNotifications(alert, currentValue);
        
      } else if (!shouldTrigger && alert.triggered) {
        // Alert resolved
        alert.triggered = false;
        alert.resolvedAt = new Date();
        
        await this.sendResolutionNotifications(alert);
      }

      await this.saveAlert(alert);

    } catch (error) {
      console.error(`Alert evaluation failed for ${alert.id}:`, error);
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateCondition(value: number, condition: MetricsAlert['condition']): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold;
      case '<': return value < condition.threshold;
      case '>=': return value >= condition.threshold;
      case '<=': return value <= condition.threshold;
      case '==': return Math.abs(value - condition.threshold) < 0.0001;
      case '!=': return Math.abs(value - condition.threshold) >= 0.0001;
      default: return false;
    }
  }

  /**
   * Update metrics index
   */
  private async updateMetricIndex(metricPoint: MetricPoint): Promise<void> {
    let index = this.metricsIndex.get(metricPoint.metric);
    
    if (!index) {
      index = {
        metric: metricPoint.metric,
        labelKeys: new Set(),
        labelValues: new Map(),
        firstSeen: metricPoint.timestamp,
        lastSeen: metricPoint.timestamp,
        cardinality: 0,
        sampleCount: 0
      };
      this.metricsIndex.set(metricPoint.metric, index);
    }

    // Update label information
    for (const [key, value] of Object.entries(metricPoint.labels)) {
      index.labelKeys.add(key);
      
      if (!index.labelValues.has(key)) {
        index.labelValues.set(key, new Set());
      }
      index.labelValues.get(key)!.add(value);
    }

    // Update timestamps and counts
    index.lastSeen = metricPoint.timestamp;
    index.sampleCount++;
    
    // Calculate cardinality (unique label combinations)
    index.cardinality = this.calculateCardinality(index.labelValues);
  }

  /**
   * Perform cleanup of old metrics
   */
  private async performCleanup(): Promise<void> {
    const now = new Date();
    
    // Clean up recent metrics buffer
    for (const [key, points] of this.recentMetrics.entries()) {
      const filteredPoints = points.filter(p => 
        now.getTime() - p.timestamp.getTime() < 60 * 60 * 1000 // Keep 1 hour
      );
      
      if (filteredPoints.length === 0) {
        this.recentMetrics.delete(key);
      } else {
        this.recentMetrics.set(key, filteredPoints);
      }
    }

    // Clean up old stored metrics based on retention policies
    for (const policy of this.retentionPolicies) {
      const cutoffTime = new Date(now.getTime() - policy.retention * 1000);
      const prefix = `metric:${policy.resolution}:`;
      
      const oldMetrics = await this.storage.list({ prefix });
      for (const [key, value] of oldMetrics) {
        const metric = value as AggregatedMetric;
        if (metric.timeRange.end < cutoffTime) {
          await this.storage.delete(key);
        }
      }
    }
  }

  /**
   * Update metrics index in storage
   */
  private async updateMetricsIndex(): Promise<void> {
    // Convert Sets and Maps to serializable format
    const indexForStorage: Record<string, any> = {};
    
    for (const [metric, index] of this.metricsIndex.entries()) {
      indexForStorage[metric] = {
        ...index,
        labelKeys: Array.from(index.labelKeys),
        labelValues: Object.fromEntries(
          Array.from(index.labelValues.entries()).map(([k, v]) => [k, Array.from(v)])
        )
      };
    }

    await this.storage.put('metrics_index', indexForStorage);
  }

  /**
   * Helper methods
   */
  private getMetricKey(metric: string, labels: Record<string, string>): string {
    const labelPairs = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${metric}{${labelPairs}}`;
  }

  private matchesLabels(pointLabels: Record<string, string>, queryLabels?: Record<string, string>): boolean {
    if (!queryLabels) return true;
    
    for (const [key, value] of Object.entries(queryLabels)) {
      if (pointLabels[key] !== value) return false;
    }
    
    return true;
  }

  private percentile(values: number[], p: number): number {
    const index = (values.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    
    return values[lower] * (1 - weight) + values[upper] * weight;
  }

  private calculateConfidence(points: MetricPoint[]): number {
    // Simple confidence calculation based on sample size
    return Math.min(1.0, points.length / 100);
  }

  private calculateCardinality(labelValues: Map<string, Set<string>>): number {
    let cardinality = 1;
    for (const values of labelValues.values()) {
      cardinality *= values.size;
    }
    return cardinality;
  }

  private async storeMetricPoint(metricPoint: MetricPoint): Promise<void> {
    const dayKey = metricPoint.timestamp.toISOString().split('T')[0];
    const storageKey = `metric:${metricPoint.metric}:${dayKey}`;
    
    // Get existing points for the day
    const existingPoints = await this.storage.get<MetricPoint[]>(storageKey) || [];
    existingPoints.push(metricPoint);
    
    // Keep only recent points (limit storage per day)
    if (existingPoints.length > 10000) {
      existingPoints.shift();
    }
    
    await this.storage.put(storageKey, existingPoints);
  }

  private async sendAlertNotifications(alert: MetricsAlert, value: number): Promise<void> {
    for (const notification of alert.notifications) {
      const shouldSend = !notification.lastSent || 
        (Date.now() - notification.lastSent.getTime()) > (notification.cooldown * 1000);
      
      if (shouldSend) {
        await this.sendNotification(notification, alert, value, 'triggered');
        notification.lastSent = new Date();
      }
    }
  }

  private async sendResolutionNotifications(alert: MetricsAlert): Promise<void> {
    for (const notification of alert.notifications) {
      await this.sendNotification(notification, alert, 0, 'resolved');
    }
  }

  private async sendNotification(
    notification: AlertNotification,
    alert: MetricsAlert,
    value: number,
    type: 'triggered' | 'resolved'
  ): Promise<void> {
    // Placeholder for notification sending
    console.log(`Sending ${type} notification for alert ${alert.name} to ${notification.target}`);
  }

  // API endpoint implementations
  private async getAlert(alertId: string): Promise<Response> {
    const alert = this.alerts.get(alertId);
    
    if (!alert) {
      return new Response('Alert not found', { status: 404 });
    }

    return Response.json({
      success: true,
      alert: this.sanitizeAlert(alert)
    });
  }

  private async updateAlert(alertId: string, request: Request): Promise<Response> {
    const alert = this.alerts.get(alertId);
    
    if (!alert) {
      return new Response('Alert not found', { status: 404 });
    }

    const updates = await request.json() as {
      name?: string;
      condition?: Partial<MetricsAlert['condition']>;
      notifications?: AlertNotification[];
      status?: MetricsAlert['status'];
    };

    // Update alert properties
    if (updates.name) alert.name = updates.name;
    if (updates.condition) alert.condition = { ...alert.condition, ...updates.condition };
    if (updates.notifications) alert.notifications = updates.notifications;
    if (updates.status) alert.status = updates.status;

    await this.saveAlert(alert);

    return Response.json({
      success: true,
      alert: this.sanitizeAlert(alert),
      message: 'Alert updated successfully'
    });
  }

  private async deleteAlert(alertId: string): Promise<Response> {
    const alert = this.alerts.get(alertId);
    
    if (!alert) {
      return new Response('Alert not found', { status: 404 });
    }

    this.alerts.delete(alertId);
    await this.storage.delete(`alert:${alertId}`);

    return Response.json({
      success: true,
      message: 'Alert deleted successfully'
    });
  }

  private async listAlerts(params: URLSearchParams): Promise<Response> {
    const status = params.get('status');
    const metric = params.get('metric');
    
    const alerts = Array.from(this.alerts.values())
      .filter(alert => {
        if (status && alert.status !== status) return false;
        if (metric && alert.metric !== metric) return false;
        return true;
      })
      .map(alert => this.sanitizeAlert(alert));

    return Response.json({
      success: true,
      alerts,
      count: alerts.length
    });
  }

  private async acknowledgeAlert(alertId: string): Promise<Response> {
    const alert = this.alerts.get(alertId);
    
    if (!alert) {
      return new Response('Alert not found', { status: 404 });
    }

    alert.status = 'acknowledged';
    await this.saveAlert(alert);

    return Response.json({
      success: true,
      message: 'Alert acknowledged'
    });
  }

  private async getDashboard(dashboardId: string): Promise<Response> {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (!dashboard) {
      return new Response('Dashboard not found', { status: 404 });
    }

    return Response.json({
      success: true,
      dashboard: this.sanitizeDashboard(dashboard)
    });
  }

  private async updateDashboard(dashboardId: string, request: Request): Promise<Response> {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (!dashboard) {
      return new Response('Dashboard not found', { status: 404 });
    }

    const updates = await request.json();
    
    // Update dashboard properties
    Object.assign(dashboard, updates, { lastModified: new Date() });

    await this.saveDashboard(dashboard);

    return Response.json({
      success: true,
      dashboard: this.sanitizeDashboard(dashboard),
      message: 'Dashboard updated successfully'
    });
  }

  private async deleteDashboard(dashboardId: string): Promise<Response> {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (!dashboard) {
      return new Response('Dashboard not found', { status: 404 });
    }

    this.dashboards.delete(dashboardId);
    await this.storage.delete(`dashboard:${dashboardId}`);

    return Response.json({
      success: true,
      message: 'Dashboard deleted successfully'
    });
  }

  private async listDashboards(): Promise<Response> {
    const dashboards = Array.from(this.dashboards.values())
      .map(dashboard => this.sanitizeDashboard(dashboard));

    return Response.json({
      success: true,
      dashboards,
      count: dashboards.length
    });
  }

  private async renderDashboard(dashboardId: string, request: Request): Promise<Response> {
    const dashboard = this.dashboards.get(dashboardId);
    
    if (!dashboard) {
      return new Response('Dashboard not found', { status: 404 });
    }

    const body = await request.json() as { timeRange?: any };
    const effectiveTimeRange = body.timeRange || dashboard.timeRange;

    // Render each panel
    const renderedPanels = [];
    
    for (const panel of dashboard.panels) {
      const query = {
        ...panel.query,
        timeRange: this.resolveTimeRange(effectiveTimeRange)
      };
      
      const results = await this.executeQuery(query);
      
      renderedPanels.push({
        id: panel.id,
        title: panel.title,
        type: panel.type,
        data: results,
        visualization: panel.visualization
      });
    }

    return Response.json({
      success: true,
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        panels: renderedPanels
      }
    });
  }

  private async cleanup(): Promise<Response> {
    await this.performCleanup();

    return Response.json({
      success: true,
      message: 'Cleanup completed'
    });
  }

  private async getStats(): Promise<Response> {
    const stats = {
      metricsInMemory: this.recentMetrics.size,
      totalMetrics: this.metricsIndex.size,
      totalAlerts: this.alerts.size,
      triggeredAlerts: Array.from(this.alerts.values()).filter(a => a.triggered).length,
      totalDashboards: this.dashboards.size,
      totalCardinality: Array.from(this.metricsIndex.values())
        .reduce((sum, idx) => sum + idx.cardinality, 0),
      memoryUsage: this.calculateMemoryUsage()
    };

    return Response.json({
      success: true,
      stats
    });
  }

  private async getHealth(): Promise<Response> {
    const health = {
      status: 'healthy',
      metricsIngestionRate: this.calculateIngestionRate(),
      alertsEvaluated: Array.from(this.alerts.values())
        .reduce((sum, alert) => sum + alert.evaluationCount, 0),
      lastAggregation: new Date(),
      issues: [] as string[]
    };

    // Check for issues
    if (this.recentMetrics.size > this.maxMetricsInMemory) {
      health.issues.push('High memory usage');
    }

    const highCardinalityMetrics = Array.from(this.metricsIndex.values())
      .filter(idx => idx.cardinality > 1000);
    if (highCardinalityMetrics.length > 0) {
      health.issues.push(`${highCardinalityMetrics.length} high cardinality metrics`);
    }

    if (health.issues.length > 0) {
      health.status = 'degraded';
    }

    return Response.json({
      success: true,
      health
    });
  }

  /**
   * Storage and utility methods
   */
  private async saveAlert(alert: MetricsAlert): Promise<void> {
    await this.storage.put(`alert:${alert.id}`, alert);
    this.alerts.set(alert.id, alert);
  }

  private async saveDashboard(dashboard: MetricsDashboard): Promise<void> {
    await this.storage.put(`dashboard:${dashboard.id}`, dashboard);
    this.dashboards.set(dashboard.id, dashboard);
  }

  private sanitizeAlert(alert: MetricsAlert): Partial<MetricsAlert> {
    return {
      id: alert.id,
      name: alert.name,
      metric: alert.metric,
      condition: alert.condition,
      status: alert.status,
      triggered: alert.triggered,
      triggeredAt: alert.triggeredAt,
      resolvedAt: alert.resolvedAt,
      lastEvaluated: alert.lastEvaluated
    };
  }

  private sanitizeDashboard(dashboard: MetricsDashboard): Partial<MetricsDashboard> {
    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      panels: dashboard.panels,
      timeRange: dashboard.timeRange,
      refreshInterval: dashboard.refreshInterval,
      createdBy: dashboard.createdBy,
      createdAt: dashboard.createdAt,
      lastModified: dashboard.lastModified
    };
  }

  private resolveTimeRange(timeRange: any): { start: Date; end: Date } {
    if (timeRange.absolute) {
      return {
        start: new Date(timeRange.absolute.start),
        end: new Date(timeRange.absolute.end)
      };
    }

    const now = new Date();
    const duration = this.parseRelativeTime(timeRange.relative);
    
    return {
      start: new Date(now.getTime() - duration),
      end: now
    };
  }

  private parseRelativeTime(relative: string): number {
    const match = relative.match(/^(\d+)([hmd])$/);
    if (!match) return 60 * 60 * 1000; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  private calculateMemoryUsage(): number {
    let usage = 0;
    
    // Estimate memory usage of recent metrics
    for (const points of this.recentMetrics.values()) {
      usage += points.length * 200; // Rough estimate per point
    }
    
    return usage;
  }

  private calculateIngestionRate(): number {
    // Calculate metrics ingestion rate (points per second)
    let recentPoints = 0;
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    for (const points of this.recentMetrics.values()) {
      recentPoints += points.filter(p => p.timestamp > fiveMinutesAgo).length;
    }
    
    return recentPoints / (5 * 60); // Points per second
  }
}