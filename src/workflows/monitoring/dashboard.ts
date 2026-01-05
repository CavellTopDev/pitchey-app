/**
 * Cloudflare Workflows Monitoring Dashboard
 * Real-time metrics and analytics for workflow execution
 */

import { WorkflowEntrypoint, WorkflowEvent } from 'cloudflare:workers';

interface WorkflowMetrics {
  workflow_id: string;
  workflow_type: 'investment' | 'production' | 'nda';
  state: string;
  started_at: Date;
  updated_at: Date;
  duration_ms: number;
  status: 'running' | 'completed' | 'failed' | 'timeout';
  error?: string;
  metadata: Record<string, any>;
}

interface AggregatedMetrics {
  total_workflows: number;
  active_workflows: number;
  completed_workflows: number;
  failed_workflows: number;
  average_duration_ms: number;
  success_rate: number;
  workflows_by_type: Record<string, number>;
  workflows_by_state: Record<string, number>;
  hourly_throughput: number[];
  error_rate: number;
  p50_duration: number;
  p95_duration: number;
  p99_duration: number;
}

export class WorkflowMonitoringDashboard {
  private analytics: AnalyticsEngineDataset;
  private kv: KVNamespace;
  private readonly METRICS_TTL = 300; // 5 minutes cache

  constructor(analytics: AnalyticsEngineDataset, kv: KVNamespace) {
    this.analytics = analytics;
    this.kv = kv;
  }

  /**
   * Record workflow start event
   */
  async recordWorkflowStart(
    workflowId: string,
    workflowType: 'investment' | 'production' | 'nda',
    initialState: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const metric: WorkflowMetrics = {
      workflow_id: workflowId,
      workflow_type: workflowType,
      state: initialState,
      started_at: new Date(),
      updated_at: new Date(),
      duration_ms: 0,
      status: 'running',
      metadata
    };

    // Store in KV for quick retrieval
    await this.kv.put(
      `workflow:${workflowId}`,
      JSON.stringify(metric),
      { expirationTtl: 86400 * 7 } // Keep for 7 days
    );

    // Send to Analytics Engine
    this.analytics.writeDataPoint({
      indexes: [workflowType],
      blobs: [workflowId, initialState],
      doubles: [Date.now()],
      event: 'workflow_start'
    });

    // Increment active workflows counter
    await this.incrementCounter('active_workflows');
  }

  /**
   * Record workflow state transition
   */
  async recordStateTransition(
    workflowId: string,
    fromState: string,
    toState: string,
    duration: number
  ): Promise<void> {
    // Get existing metric
    const metricData = await this.kv.get(`workflow:${workflowId}`);
    if (!metricData) return;

    const metric: WorkflowMetrics = JSON.parse(metricData);
    
    // Update metric
    metric.state = toState;
    metric.updated_at = new Date();
    metric.duration_ms += duration;

    // Store updated metric
    await this.kv.put(
      `workflow:${workflowId}`,
      JSON.stringify(metric),
      { expirationTtl: 86400 * 7 }
    );

    // Send transition event to Analytics
    this.analytics.writeDataPoint({
      indexes: [metric.workflow_type, fromState, toState],
      doubles: [duration, Date.now()],
      blobs: [workflowId],
      event: 'state_transition'
    });

    // Track state-specific metrics
    await this.trackStateMetrics(metric.workflow_type, toState, duration);
  }

  /**
   * Record workflow completion
   */
  async recordWorkflowComplete(
    workflowId: string,
    finalState: string,
    success: boolean
  ): Promise<void> {
    const metricData = await this.kv.get(`workflow:${workflowId}`);
    if (!metricData) return;

    const metric: WorkflowMetrics = JSON.parse(metricData);
    
    // Calculate total duration
    const totalDuration = Date.now() - metric.started_at.getTime();
    
    // Update metric
    metric.state = finalState;
    metric.status = success ? 'completed' : 'failed';
    metric.duration_ms = totalDuration;
    metric.updated_at = new Date();

    // Store final metric
    await this.kv.put(
      `workflow:${workflowId}`,
      JSON.stringify(metric),
      { expirationTtl: 86400 * 30 } // Keep completed workflows for 30 days
    );

    // Send completion event
    this.analytics.writeDataPoint({
      indexes: [metric.workflow_type, success ? 'success' : 'failure'],
      doubles: [totalDuration, Date.now()],
      blobs: [workflowId, finalState],
      event: 'workflow_complete'
    });

    // Update counters
    await this.decrementCounter('active_workflows');
    await this.incrementCounter(success ? 'completed_workflows' : 'failed_workflows');
    
    // Update success rate
    await this.updateSuccessRate(metric.workflow_type, success);
    
    // Track duration percentiles
    await this.trackDurationPercentile(metric.workflow_type, totalDuration);
  }

  /**
   * Record workflow error
   */
  async recordWorkflowError(
    workflowId: string,
    error: Error,
    state: string
  ): Promise<void> {
    const metricData = await this.kv.get(`workflow:${workflowId}`);
    if (!metricData) return;

    const metric: WorkflowMetrics = JSON.parse(metricData);
    
    // Update metric with error
    metric.status = 'failed';
    metric.error = error.message;
    metric.state = state;
    metric.updated_at = new Date();

    // Store error metric
    await this.kv.put(
      `workflow:${workflowId}`,
      JSON.stringify(metric),
      { expirationTtl: 86400 * 30 }
    );

    // Send error event
    this.analytics.writeDataPoint({
      indexes: [metric.workflow_type, 'error', state],
      blobs: [workflowId, error.message, error.stack || ''],
      doubles: [Date.now()],
      event: 'workflow_error'
    });

    // Track error rate
    await this.incrementErrorRate(metric.workflow_type);
  }

  /**
   * Get real-time dashboard metrics
   */
  async getDashboardMetrics(): Promise<AggregatedMetrics> {
    // Check cache first
    const cached = await this.kv.get('dashboard_metrics', { type: 'json' });
    if (cached) {
      return cached as AggregatedMetrics;
    }

    // Calculate fresh metrics
    const metrics = await this.calculateAggregatedMetrics();
    
    // Cache the result
    await this.kv.put(
      'dashboard_metrics',
      JSON.stringify(metrics),
      { expirationTtl: this.METRICS_TTL }
    );

    return metrics;
  }

  /**
   * Get workflow-specific metrics
   */
  async getWorkflowMetrics(workflowId: string): Promise<WorkflowMetrics | null> {
    const data = await this.kv.get(`workflow:${workflowId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get metrics by workflow type
   */
  async getMetricsByType(
    workflowType: 'investment' | 'production' | 'nda'
  ): Promise<{
    active: number;
    completed: number;
    failed: number;
    avg_duration: number;
    success_rate: number;
    error_rate: number;
    state_distribution: Record<string, number>;
  }> {
    // Query Analytics Engine for type-specific metrics
    const query = `
      SELECT 
        COUNT(CASE WHEN status = 'running' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(duration_ms) as avg_duration,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*) as success_rate,
        COUNT(CASE WHEN error IS NOT NULL THEN 1 END) * 100.0 / COUNT(*) as error_rate
      FROM workflows
      WHERE workflow_type = ?
      AND timestamp > ?
    `;

    // For demo, return calculated values
    const active = await this.getCounter(`${workflowType}:active`) || 0;
    const completed = await this.getCounter(`${workflowType}:completed`) || 0;
    const failed = await this.getCounter(`${workflowType}:failed`) || 0;
    const total = active + completed + failed;
    
    return {
      active,
      completed,
      failed,
      avg_duration: await this.getAverageDuration(workflowType),
      success_rate: total > 0 ? (completed / total) * 100 : 0,
      error_rate: total > 0 ? (failed / total) * 100 : 0,
      state_distribution: await this.getStateDistribution(workflowType)
    };
  }

  /**
   * Get workflow funnel metrics
   */
  async getFunnelMetrics(workflowType: 'investment' | 'production' | 'nda'): Promise<{
    stage: string;
    count: number;
    conversion_rate: number;
    avg_time_in_stage: number;
  }[]> {
    const stages = this.getWorkflowStages(workflowType);
    const funnel: any[] = [];
    let previousCount = 0;

    for (const stage of stages) {
      const count = await this.getCounter(`${workflowType}:${stage}:reached`) || 0;
      const avgTime = await this.getAverageDuration(`${workflowType}:${stage}`);
      
      funnel.push({
        stage,
        count,
        conversion_rate: previousCount > 0 ? (count / previousCount) * 100 : 100,
        avg_time_in_stage: avgTime
      });
      
      previousCount = count;
    }

    return funnel;
  }

  /**
   * Get time series metrics
   */
  async getTimeSeriesMetrics(
    workflowType: 'investment' | 'production' | 'nda',
    period: 'hour' | 'day' | 'week' = 'hour'
  ): Promise<{
    timestamp: Date;
    started: number;
    completed: number;
    failed: number;
    active: number;
  }[]> {
    const timeSeries: any[] = [];
    const now = Date.now();
    const intervalMs = period === 'hour' ? 3600000 : period === 'day' ? 86400000 : 604800000;
    const periods = period === 'hour' ? 24 : period === 'day' ? 7 : 4;

    for (let i = 0; i < periods; i++) {
      const timestamp = new Date(now - (i * intervalMs));
      const key = `${workflowType}:timeseries:${Math.floor(timestamp.getTime() / intervalMs)}`;
      
      const data = await this.kv.get(key, { type: 'json' }) || {
        started: 0,
        completed: 0,
        failed: 0,
        active: 0
      };
      
      timeSeries.unshift({
        timestamp,
        ...data
      });
    }

    return timeSeries;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    workflow_type: string;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    avg: number;
  }[]> {
    const types: Array<'investment' | 'production' | 'nda'> = ['investment', 'production', 'nda'];
    const metrics = [];

    for (const type of types) {
      const durations = await this.getDurationSamples(type);
      
      if (durations.length > 0) {
        durations.sort((a, b) => a - b);
        
        metrics.push({
          workflow_type: type,
          p50: this.percentile(durations, 50),
          p75: this.percentile(durations, 75),
          p90: this.percentile(durations, 90),
          p95: this.percentile(durations, 95),
          p99: this.percentile(durations, 99),
          min: Math.min(...durations),
          max: Math.max(...durations),
          avg: durations.reduce((a, b) => a + b, 0) / durations.length
        });
      }
    }

    return metrics;
  }

  /**
   * Get alert conditions
   */
  async checkAlertConditions(): Promise<{
    alert: string;
    severity: 'info' | 'warning' | 'critical';
    value: number;
    threshold: number;
  }[]> {
    const alerts: any[] = [];

    // Check error rate
    const errorRate = await this.getErrorRate();
    if (errorRate > 5) {
      alerts.push({
        alert: 'High error rate',
        severity: errorRate > 10 ? 'critical' : 'warning',
        value: errorRate,
        threshold: 5
      });
    }

    // Check active workflows
    const activeWorkflows = await this.getCounter('active_workflows') || 0;
    if (activeWorkflows > 1000) {
      alerts.push({
        alert: 'High active workflow count',
        severity: activeWorkflows > 5000 ? 'critical' : 'warning',
        value: activeWorkflows,
        threshold: 1000
      });
    }

    // Check p95 duration
    for (const type of ['investment', 'production', 'nda'] as const) {
      const p95 = await this.getPercentileDuration(type, 95);
      const threshold = this.getDurationThreshold(type);
      
      if (p95 > threshold) {
        alerts.push({
          alert: `High P95 duration for ${type} workflows`,
          severity: p95 > threshold * 2 ? 'critical' : 'warning',
          value: p95,
          threshold
        });
      }
    }

    // Check success rate
    const successRate = await this.getSuccessRate();
    if (successRate < 95) {
      alerts.push({
        alert: 'Low success rate',
        severity: successRate < 90 ? 'critical' : 'warning',
        value: successRate,
        threshold: 95
      });
    }

    return alerts;
  }

  // Private helper methods

  private async calculateAggregatedMetrics(): Promise<AggregatedMetrics> {
    const active = await this.getCounter('active_workflows') || 0;
    const completed = await this.getCounter('completed_workflows') || 0;
    const failed = await this.getCounter('failed_workflows') || 0;
    const total = active + completed + failed;

    return {
      total_workflows: total,
      active_workflows: active,
      completed_workflows: completed,
      failed_workflows: failed,
      average_duration_ms: await this.getAverageDuration('all'),
      success_rate: total > 0 ? (completed / total) * 100 : 0,
      workflows_by_type: await this.getWorkflowsByType(),
      workflows_by_state: await this.getWorkflowsByState(),
      hourly_throughput: await this.getHourlyThroughput(),
      error_rate: await this.getErrorRate(),
      p50_duration: await this.getPercentileDuration('all', 50),
      p95_duration: await this.getPercentileDuration('all', 95),
      p99_duration: await this.getPercentileDuration('all', 99)
    };
  }

  private async incrementCounter(key: string): Promise<void> {
    const current = await this.getCounter(key);
    await this.kv.put(`counter:${key}`, String(current + 1));
  }

  private async decrementCounter(key: string): Promise<void> {
    const current = await this.getCounter(key);
    await this.kv.put(`counter:${key}`, String(Math.max(0, current - 1)));
  }

  private async getCounter(key: string): Promise<number> {
    const value = await this.kv.get(`counter:${key}`);
    return value ? parseInt(value, 10) : 0;
  }

  private async trackStateMetrics(
    workflowType: string,
    state: string,
    duration: number
  ): Promise<void> {
    const key = `${workflowType}:${state}`;
    
    // Increment state counter
    await this.incrementCounter(`${key}:reached`);
    
    // Track duration for this state
    const durationsKey = `durations:${key}`;
    const existing = await this.kv.get(durationsKey, { type: 'json' }) || [];
    existing.push(duration);
    
    // Keep last 1000 samples
    if (existing.length > 1000) {
      existing.shift();
    }
    
    await this.kv.put(durationsKey, JSON.stringify(existing));
  }

  private async updateSuccessRate(workflowType: string, success: boolean): Promise<void> {
    const key = `${workflowType}:outcomes`;
    const data = await this.kv.get(key, { type: 'json' }) || { success: 0, total: 0 };
    
    data.total++;
    if (success) data.success++;
    
    await this.kv.put(key, JSON.stringify(data));
  }

  private async trackDurationPercentile(workflowType: string, duration: number): Promise<void> {
    const key = `durations:${workflowType}`;
    const durations = await this.kv.get(key, { type: 'json' }) || [];
    
    durations.push(duration);
    
    // Keep last 10000 samples for percentile calculation
    if (durations.length > 10000) {
      durations.shift();
    }
    
    await this.kv.put(key, JSON.stringify(durations));
  }

  private async incrementErrorRate(workflowType: string): Promise<void> {
    const key = `${workflowType}:errors`;
    const data = await this.kv.get(key, { type: 'json' }) || { errors: 0, total: 0 };
    
    data.errors++;
    data.total++;
    
    await this.kv.put(key, JSON.stringify(data));
  }

  private async getAverageDuration(type: string): Promise<number> {
    const key = type === 'all' ? 'durations:all' : `durations:${type}`;
    const durations = await this.kv.get(key, { type: 'json' }) || [];
    
    if (durations.length === 0) return 0;
    
    return durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
  }

  private async getStateDistribution(workflowType: string): Promise<Record<string, number>> {
    const states = this.getWorkflowStages(workflowType);
    const distribution: Record<string, number> = {};
    
    for (const state of states) {
      distribution[state] = await this.getCounter(`${workflowType}:${state}:reached`) || 0;
    }
    
    return distribution;
  }

  private getWorkflowStages(type: 'investment' | 'production' | 'nda'): string[] {
    switch (type) {
      case 'investment':
        return [
          'INTEREST', 'QUALIFIED', 'PENDING_CREATOR', 'APPROVED',
          'TERM_SHEET', 'SIGNED', 'ESCROW', 'FUNDS_RELEASED', 'COMPLETED'
        ];
      case 'production':
        return [
          'INTEREST', 'MEETING', 'PROPOSAL', 'NEGOTIATION',
          'CONTRACT', 'PRODUCTION', 'COMPLETED'
        ];
      case 'nda':
        return [
          'PENDING', 'RISK_ASSESSMENT', 'REVIEW', 'APPROVED',
          'SIGNED', 'ACCESS_GRANTED'
        ];
      default:
        return [];
    }
  }

  private async getDurationSamples(type: string): Promise<number[]> {
    const key = `durations:${type}`;
    return await this.kv.get(key, { type: 'json' }) || [];
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private async getPercentileDuration(type: string, p: number): Promise<number> {
    const durations = await this.getDurationSamples(type);
    
    if (durations.length === 0) return 0;
    
    durations.sort((a, b) => a - b);
    return this.percentile(durations, p);
  }

  private getDurationThreshold(type: 'investment' | 'production' | 'nda'): number {
    // Return expected P95 duration thresholds in milliseconds
    switch (type) {
      case 'investment':
        return 7 * 24 * 60 * 60 * 1000; // 7 days
      case 'production':
        return 30 * 24 * 60 * 60 * 1000; // 30 days
      case 'nda':
        return 24 * 60 * 60 * 1000; // 24 hours
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  private async getWorkflowsByType(): Promise<Record<string, number>> {
    return {
      investment: await this.getCounter('investment:total') || 0,
      production: await this.getCounter('production:total') || 0,
      nda: await this.getCounter('nda:total') || 0
    };
  }

  private async getWorkflowsByState(): Promise<Record<string, number>> {
    const states: Record<string, number> = {};
    
    // Aggregate states across all workflow types
    for (const type of ['investment', 'production', 'nda']) {
      const stages = this.getWorkflowStages(type as any);
      
      for (const stage of stages) {
        const count = await this.getCounter(`${type}:${stage}:current`) || 0;
        states[stage] = (states[stage] || 0) + count;
      }
    }
    
    return states;
  }

  private async getHourlyThroughput(): Promise<number[]> {
    const throughput: number[] = [];
    const now = Date.now();
    const hourMs = 3600000;
    
    for (let i = 23; i >= 0; i--) {
      const hour = Math.floor((now - (i * hourMs)) / hourMs);
      const count = await this.getCounter(`throughput:hour:${hour}`) || 0;
      throughput.push(count);
    }
    
    return throughput;
  }

  private async getErrorRate(): Promise<number> {
    const errors = await this.getCounter('total:errors') || 0;
    const total = await this.getCounter('total:workflows') || 0;
    
    return total > 0 ? (errors / total) * 100 : 0;
  }

  private async getSuccessRate(): Promise<number> {
    const completed = await this.getCounter('completed_workflows') || 0;
    const total = await this.getCounter('total:workflows') || 0;
    
    return total > 0 ? (completed / total) * 100 : 0;
  }
}

/**
 * Dashboard API endpoints
 */
export class DashboardAPI {
  private dashboard: WorkflowMonitoringDashboard;

  constructor(dashboard: WorkflowMonitoringDashboard) {
    this.dashboard = dashboard;
  }

  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dashboard routes
    if (path === '/api/dashboard/metrics') {
      const metrics = await this.dashboard.getDashboardMetrics();
      return new Response(JSON.stringify(metrics), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/dashboard/workflow/')) {
      const workflowId = path.split('/').pop();
      if (!workflowId) {
        return new Response('Workflow ID required', { status: 400 });
      }
      
      const metrics = await this.dashboard.getWorkflowMetrics(workflowId);
      if (!metrics) {
        return new Response('Workflow not found', { status: 404 });
      }
      
      return new Response(JSON.stringify(metrics), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/dashboard/type/')) {
      const type = path.split('/').pop() as 'investment' | 'production' | 'nda';
      if (!['investment', 'production', 'nda'].includes(type)) {
        return new Response('Invalid workflow type', { status: 400 });
      }
      
      const metrics = await this.dashboard.getMetricsByType(type);
      return new Response(JSON.stringify(metrics), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/dashboard/funnel/')) {
      const type = path.split('/').pop() as 'investment' | 'production' | 'nda';
      if (!['investment', 'production', 'nda'].includes(type)) {
        return new Response('Invalid workflow type', { status: 400 });
      }
      
      const funnel = await this.dashboard.getFunnelMetrics(type);
      return new Response(JSON.stringify(funnel), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/dashboard/timeseries') {
      const type = url.searchParams.get('type') as any;
      const period = url.searchParams.get('period') as any || 'hour';
      
      if (!['investment', 'production', 'nda'].includes(type)) {
        return new Response('Invalid workflow type', { status: 400 });
      }
      
      const timeSeries = await this.dashboard.getTimeSeriesMetrics(type, period);
      return new Response(JSON.stringify(timeSeries), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/dashboard/performance') {
      const performance = await this.dashboard.getPerformanceMetrics();
      return new Response(JSON.stringify(performance), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/dashboard/alerts') {
      const alerts = await this.dashboard.checkAlertConditions();
      return new Response(JSON.stringify(alerts), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}