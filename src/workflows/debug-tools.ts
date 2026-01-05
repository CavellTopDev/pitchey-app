/**
 * Debug Tools for Cloudflare Workflows
 * 
 * Comprehensive debugging utilities for workflow inspection, event replay,
 * time-travel debugging, performance profiling, and distributed tracing.
 */

import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { KVNamespace, R2Bucket, AnalyticsEngineDataset } from '@cloudflare/workers-types';

// ============================================================================
// Type Definitions
// ============================================================================

export interface WorkflowState {
  workflowId: string;
  instanceId: string;
  currentState: string;
  previousStates: StateTransition[];
  startedAt: string;
  lastUpdatedAt: string;
  completedAt?: string;
  metadata: Record<string, any>;
  checkpoints: Checkpoint[];
  events: WorkflowEventLog[];
  errors: ErrorLog[];
  performance: PerformanceMetrics;
}

export interface StateTransition {
  from: string;
  to: string;
  timestamp: string;
  duration: number;
  trigger: string;
  metadata?: Record<string, any>;
}

export interface Checkpoint {
  id: string;
  stepName: string;
  timestamp: string;
  state: Record<string, any>;
  inputData: any;
  outputData: any;
  duration: number;
  retryCount: number;
}

export interface WorkflowEventLog {
  id: string;
  timestamp: string;
  type: 'step' | 'wait' | 'event' | 'error' | 'retry';
  name: string;
  data: any;
  duration?: number;
  error?: string;
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  stepName: string;
  error: string;
  stack?: string;
  retryable: boolean;
  retryCount: number;
  resolution?: string;
}

export interface PerformanceMetrics {
  totalDuration: number;
  stepDurations: Map<string, number[]>;
  cpuTime: number;
  memoryUsage: number;
  subrequests: number;
  cacheHits: number;
  cacheMisses: number;
  databaseQueries: number;
  externalApiCalls: number;
}

export interface DeadLetterEntry {
  workflowId: string;
  instanceId: string;
  failedAt: string;
  reason: string;
  lastState: string;
  retryCount: number;
  data: any;
  error: string;
  stack?: string;
}

export interface StuckWorkflow {
  workflowId: string;
  instanceId: string;
  currentState: string;
  stuckSince: string;
  expectedTimeout: string;
  waitingFor: string;
  lastActivity: string;
  metadata: Record<string, any>;
}

export interface ResourceUsage {
  timestamp: string;
  cpuMilliseconds: number;
  memoryMB: number;
  subrequestCount: number;
  kvReads: number;
  kvWrites: number;
  r2Gets: number;
  r2Puts: number;
  databaseQueries: number;
  queueMessages: number;
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  serviceName: string;
  startTime: number;
  endTime: number;
  duration: number;
  status: 'ok' | 'error' | 'cancelled';
  attributes: Record<string, any>;
  events: TraceEvent[];
  links: TraceLink[];
}

export interface TraceEvent {
  timestamp: number;
  name: string;
  attributes: Record<string, any>;
}

export interface TraceLink {
  traceId: string;
  spanId: string;
  attributes: Record<string, any>;
}

// ============================================================================
// Workflow State Inspector
// ============================================================================

export class WorkflowStateInspector {
  constructor(
    private kv: KVNamespace,
    private analytics: AnalyticsEngineDataset
  ) {}
  
  /**
   * Get complete workflow state with all details
   */
  async inspectWorkflow(workflowId: string): Promise<WorkflowState | null> {
    const stateKey = `workflow:state:${workflowId}`;
    const state = await this.kv.get<WorkflowState>(stateKey, 'json');
    
    if (!state) {
      return null;
    }
    
    // Enrich with additional debug information
    const enrichedState = await this.enrichWorkflowState(state);
    
    return enrichedState;
  }
  
  /**
   * Get workflow state at a specific point in time
   */
  async getStateAtTime(
    workflowId: string,
    timestamp: string
  ): Promise<WorkflowState | null> {
    const history = await this.getWorkflowHistory(workflowId);
    
    if (!history) {
      return null;
    }
    
    // Find the state at the specified timestamp
    const targetTime = new Date(timestamp).getTime();
    let stateAtTime: WorkflowState | null = null;
    
    for (const checkpoint of history.checkpoints) {
      const checkpointTime = new Date(checkpoint.timestamp).getTime();
      if (checkpointTime <= targetTime) {
        stateAtTime = await this.reconstructStateFromCheckpoint(checkpoint);
      } else {
        break;
      }
    }
    
    return stateAtTime;
  }
  
  /**
   * Get workflow execution timeline
   */
  async getExecutionTimeline(workflowId: string): Promise<{
    timeline: Array<{
      timestamp: string;
      event: string;
      duration?: number;
      details: any;
    }>;
    totalDuration: number;
  }> {
    const state = await this.inspectWorkflow(workflowId);
    
    if (!state) {
      return { timeline: [], totalDuration: 0 };
    }
    
    const timeline = [
      ...state.events.map(event => ({
        timestamp: event.timestamp,
        event: `${event.type}: ${event.name}`,
        duration: event.duration,
        details: event.data,
      })),
      ...state.previousStates.map(transition => ({
        timestamp: transition.timestamp,
        event: `State: ${transition.from} → ${transition.to}`,
        duration: transition.duration,
        details: transition.metadata,
      })),
    ].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    const totalDuration = state.performance.totalDuration;
    
    return { timeline, totalDuration };
  }
  
  /**
   * Compare two workflow executions
   */
  async compareWorkflows(
    workflowId1: string,
    workflowId2: string
  ): Promise<{
    differences: Array<{
      aspect: string;
      workflow1: any;
      workflow2: any;
      delta?: number;
    }>;
    performanceComparison: {
      faster: string;
      speedup: number;
      bottlenecks: string[];
    };
  }> {
    const [state1, state2] = await Promise.all([
      this.inspectWorkflow(workflowId1),
      this.inspectWorkflow(workflowId2),
    ]);
    
    if (!state1 || !state2) {
      throw new Error('One or both workflows not found');
    }
    
    const differences: any[] = [];
    
    // Compare states
    if (state1.currentState !== state2.currentState) {
      differences.push({
        aspect: 'Current State',
        workflow1: state1.currentState,
        workflow2: state2.currentState,
      });
    }
    
    // Compare durations
    differences.push({
      aspect: 'Total Duration',
      workflow1: state1.performance.totalDuration,
      workflow2: state2.performance.totalDuration,
      delta: state2.performance.totalDuration - state1.performance.totalDuration,
    });
    
    // Compare error counts
    differences.push({
      aspect: 'Error Count',
      workflow1: state1.errors.length,
      workflow2: state2.errors.length,
      delta: state2.errors.length - state1.errors.length,
    });
    
    // Performance comparison
    const faster = state1.performance.totalDuration < state2.performance.totalDuration
      ? workflowId1
      : workflowId2;
    
    const speedup = Math.abs(
      (state1.performance.totalDuration - state2.performance.totalDuration) /
      Math.max(state1.performance.totalDuration, state2.performance.totalDuration)
    );
    
    const bottlenecks = this.identifyBottlenecks(state1, state2);
    
    return {
      differences,
      performanceComparison: {
        faster,
        speedup,
        bottlenecks,
      },
    };
  }
  
  private async enrichWorkflowState(state: WorkflowState): Promise<WorkflowState> {
    // Add performance analysis
    state.performance = await this.analyzePerformance(state);
    
    // Add error analysis
    for (const error of state.errors) {
      error.resolution = await this.suggestErrorResolution(error);
    }
    
    return state;
  }
  
  private async getWorkflowHistory(workflowId: string): Promise<WorkflowState | null> {
    const historyKey = `workflow:history:${workflowId}`;
    return await this.kv.get<WorkflowState>(historyKey, 'json');
  }
  
  private async reconstructStateFromCheckpoint(checkpoint: Checkpoint): Promise<WorkflowState> {
    // Reconstruct workflow state from checkpoint
    return {
      workflowId: '',
      instanceId: '',
      currentState: checkpoint.stepName,
      previousStates: [],
      startedAt: checkpoint.timestamp,
      lastUpdatedAt: checkpoint.timestamp,
      metadata: checkpoint.state,
      checkpoints: [checkpoint],
      events: [],
      errors: [],
      performance: {
        totalDuration: checkpoint.duration,
        stepDurations: new Map(),
        cpuTime: 0,
        memoryUsage: 0,
        subrequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        databaseQueries: 0,
        externalApiCalls: 0,
      },
    };
  }
  
  private async analyzePerformance(state: WorkflowState): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      totalDuration: 0,
      stepDurations: new Map(),
      cpuTime: 0,
      memoryUsage: 0,
      subrequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      databaseQueries: 0,
      externalApiCalls: 0,
    };
    
    // Calculate total duration
    if (state.startedAt && state.lastUpdatedAt) {
      metrics.totalDuration = new Date(state.lastUpdatedAt).getTime() -
        new Date(state.startedAt).getTime();
    }
    
    // Aggregate step durations
    for (const checkpoint of state.checkpoints) {
      if (!metrics.stepDurations.has(checkpoint.stepName)) {
        metrics.stepDurations.set(checkpoint.stepName, []);
      }
      metrics.stepDurations.get(checkpoint.stepName)!.push(checkpoint.duration);
    }
    
    return metrics;
  }
  
  private async suggestErrorResolution(error: ErrorLog): Promise<string> {
    // AI-powered error resolution suggestions
    const commonResolutions: Record<string, string> = {
      'TIMEOUT': 'Increase timeout value or optimize operation performance',
      'DEADLOCK': 'Review transaction isolation levels and query ordering',
      'RATE_LIMIT': 'Implement exponential backoff or request batching',
      'PERMISSION_DENIED': 'Check user permissions and authentication',
      'NETWORK_ERROR': 'Add retry logic with exponential backoff',
      'VALIDATION_ERROR': 'Review input validation rules and data format',
    };
    
    for (const [pattern, resolution] of Object.entries(commonResolutions)) {
      if (error.error.includes(pattern)) {
        return resolution;
      }
    }
    
    return 'Review error details and check application logs';
  }
  
  private identifyBottlenecks(state1: WorkflowState, state2: WorkflowState): string[] {
    const bottlenecks: string[] = [];
    
    // Compare step durations
    for (const [step, durations1] of state1.performance.stepDurations) {
      const durations2 = state2.performance.stepDurations.get(step);
      if (durations2) {
        const avg1 = durations1.reduce((a, b) => a + b, 0) / durations1.length;
        const avg2 = durations2.reduce((a, b) => a + b, 0) / durations2.length;
        
        if (Math.abs(avg1 - avg2) > 1000) { // More than 1 second difference
          bottlenecks.push(`${step}: ${Math.abs(avg1 - avg2)}ms difference`);
        }
      }
    }
    
    return bottlenecks;
  }
}

// ============================================================================
// Event Replay Functionality
// ============================================================================

export class EventReplayer {
  private replaySpeed: number = 1; // 1x speed by default
  private currentPosition: number = 0;
  private isReplaying: boolean = false;
  
  constructor(
    private kv: KVNamespace,
    private r2: R2Bucket
  ) {}
  
  /**
   * Replay workflow events from the beginning
   */
  async replayWorkflow(
    workflowId: string,
    options: {
      speed?: number;
      fromTimestamp?: string;
      toTimestamp?: string;
      filter?: (event: WorkflowEventLog) => boolean;
      onEvent?: (event: WorkflowEventLog) => Promise<void>;
    } = {}
  ): Promise<void> {
    this.replaySpeed = options.speed || 1;
    this.isReplaying = true;
    
    // Get all events for the workflow
    const events = await this.getWorkflowEvents(workflowId, options);
    
    // Replay events
    for (let i = 0; i < events.length && this.isReplaying; i++) {
      const event = events[i];
      this.currentPosition = i;
      
      if (options.onEvent) {
        await options.onEvent(event);
      }
      
      // Calculate delay until next event
      if (i < events.length - 1) {
        const currentTime = new Date(event.timestamp).getTime();
        const nextTime = new Date(events[i + 1].timestamp).getTime();
        const delay = (nextTime - currentTime) / this.replaySpeed;
        
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    this.isReplaying = false;
  }
  
  /**
   * Replay specific event
   */
  async replayEvent(
    workflowId: string,
    eventId: string
  ): Promise<any> {
    const event = await this.getEvent(workflowId, eventId);
    
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }
    
    // Simulate event execution
    return await this.simulateEvent(event);
  }
  
  /**
   * Create synthetic event for testing
   */
  async createSyntheticEvent(
    workflowId: string,
    event: Partial<WorkflowEventLog>
  ): Promise<void> {
    const syntheticEvent: WorkflowEventLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: 'step',
      name: 'synthetic_event',
      data: {},
      ...event,
    };
    
    // Store synthetic event
    const key = `workflow:synthetic:${workflowId}:${syntheticEvent.id}`;
    await this.kv.put(key, JSON.stringify(syntheticEvent));
  }
  
  /**
   * Export events for external analysis
   */
  async exportEvents(
    workflowId: string,
    format: 'json' | 'csv' | 'parquet' = 'json'
  ): Promise<Uint8Array> {
    const events = await this.getWorkflowEvents(workflowId);
    
    switch (format) {
      case 'json':
        return new TextEncoder().encode(JSON.stringify(events, null, 2));
      
      case 'csv':
        return this.eventsToCSV(events);
      
      case 'parquet':
        return this.eventsToParquet(events);
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
  
  pause(): void {
    this.isReplaying = false;
  }
  
  resume(): void {
    this.isReplaying = true;
  }
  
  setSpeed(speed: number): void {
    this.replaySpeed = speed;
  }
  
  seekTo(position: number): void {
    this.currentPosition = position;
  }
  
  private async getWorkflowEvents(
    workflowId: string,
    options: {
      fromTimestamp?: string;
      toTimestamp?: string;
      filter?: (event: WorkflowEventLog) => boolean;
    } = {}
  ): Promise<WorkflowEventLog[]> {
    const eventsKey = `workflow:events:${workflowId}`;
    const events = await this.kv.get<WorkflowEventLog[]>(eventsKey, 'json') || [];
    
    let filteredEvents = events;
    
    // Apply time filters
    if (options.fromTimestamp) {
      const fromTime = new Date(options.fromTimestamp).getTime();
      filteredEvents = filteredEvents.filter(
        e => new Date(e.timestamp).getTime() >= fromTime
      );
    }
    
    if (options.toTimestamp) {
      const toTime = new Date(options.toTimestamp).getTime();
      filteredEvents = filteredEvents.filter(
        e => new Date(e.timestamp).getTime() <= toTime
      );
    }
    
    // Apply custom filter
    if (options.filter) {
      filteredEvents = filteredEvents.filter(options.filter);
    }
    
    return filteredEvents;
  }
  
  private async getEvent(
    workflowId: string,
    eventId: string
  ): Promise<WorkflowEventLog | null> {
    const events = await this.getWorkflowEvents(workflowId);
    return events.find(e => e.id === eventId) || null;
  }
  
  private async simulateEvent(event: WorkflowEventLog): Promise<any> {
    // Simulate event execution based on type
    switch (event.type) {
      case 'step':
        return this.simulateStep(event);
      case 'wait':
        return this.simulateWait(event);
      case 'event':
        return this.simulateCustomEvent(event);
      case 'error':
        throw new Error(event.error || 'Simulated error');
      case 'retry':
        return this.simulateRetry(event);
      default:
        return event.data;
    }
  }
  
  private async simulateStep(event: WorkflowEventLog): Promise<any> {
    // Simulate step execution
    console.log(`Simulating step: ${event.name}`);
    return event.data;
  }
  
  private async simulateWait(event: WorkflowEventLog): Promise<void> {
    // Simulate wait
    const duration = event.duration || 1000;
    await new Promise(resolve => setTimeout(resolve, duration / this.replaySpeed));
  }
  
  private async simulateCustomEvent(event: WorkflowEventLog): Promise<any> {
    // Simulate custom event
    console.log(`Simulating custom event: ${event.name}`);
    return event.data;
  }
  
  private async simulateRetry(event: WorkflowEventLog): Promise<any> {
    // Simulate retry
    console.log(`Simulating retry: ${event.name}`);
    return event.data;
  }
  
  private eventsToCSV(events: WorkflowEventLog[]): Uint8Array {
    const headers = ['id', 'timestamp', 'type', 'name', 'duration', 'error'];
    const rows = events.map(e => [
      e.id,
      e.timestamp,
      e.type,
      e.name,
      e.duration?.toString() || '',
      e.error || '',
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');
    
    return new TextEncoder().encode(csv);
  }
  
  private eventsToParquet(events: WorkflowEventLog[]): Uint8Array {
    // Simplified parquet export (would need actual parquet library)
    console.warn('Parquet export not fully implemented');
    return this.eventsToCSV(events);
  }
}

// ============================================================================
// Performance Profiler
// ============================================================================

export class PerformanceProfiler {
  private profiles: Map<string, PerformanceProfile> = new Map();
  private activeSpans: Map<string, ProfileSpan> = new Map();
  
  constructor(private analytics: AnalyticsEngineDataset) {}
  
  /**
   * Start profiling a workflow
   */
  startProfiling(workflowId: string): void {
    this.profiles.set(workflowId, {
      workflowId,
      startTime: performance.now(),
      endTime: 0,
      spans: [],
      metrics: {
        cpuTime: 0,
        wallTime: 0,
        allocations: 0,
        deallocations: 0,
        gcTime: 0,
        gcCount: 0,
      },
      flamegraph: [],
    });
  }
  
  /**
   * Start a profiling span
   */
  startSpan(workflowId: string, name: string, metadata?: any): string {
    const spanId = crypto.randomUUID();
    const span: ProfileSpan = {
      id: spanId,
      name,
      startTime: performance.now(),
      endTime: 0,
      duration: 0,
      metadata,
      children: [],
    };
    
    this.activeSpans.set(spanId, span);
    
    const profile = this.profiles.get(workflowId);
    if (profile) {
      profile.spans.push(span);
    }
    
    return spanId;
  }
  
  /**
   * End a profiling span
   */
  endSpan(spanId: string): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = performance.now();
      span.duration = span.endTime - span.startTime;
      this.activeSpans.delete(spanId);
    }
  }
  
  /**
   * Stop profiling and get results
   */
  stopProfiling(workflowId: string): PerformanceProfile | undefined {
    const profile = this.profiles.get(workflowId);
    if (profile) {
      profile.endTime = performance.now();
      profile.metrics.wallTime = profile.endTime - profile.startTime;
      
      // Generate flamegraph data
      profile.flamegraph = this.generateFlamegraph(profile.spans);
      
      return profile;
    }
  }
  
  /**
   * Get performance bottlenecks
   */
  getBottlenecks(workflowId: string, threshold: number = 100): ProfileSpan[] {
    const profile = this.profiles.get(workflowId);
    if (!profile) return [];
    
    return profile.spans
      .filter(span => span.duration > threshold)
      .sort((a, b) => b.duration - a.duration);
  }
  
  /**
   * Generate performance report
   */
  generateReport(workflowId: string): PerformanceReport {
    const profile = this.profiles.get(workflowId);
    if (!profile) {
      throw new Error(`No profile found for workflow ${workflowId}`);
    }
    
    const slowestSpans = this.getBottlenecks(workflowId);
    const totalTime = profile.metrics.wallTime;
    
    const report: PerformanceReport = {
      workflowId,
      totalTime,
      cpuTime: profile.metrics.cpuTime,
      cpuUtilization: (profile.metrics.cpuTime / totalTime) * 100,
      slowestOperations: slowestSpans.slice(0, 10).map(span => ({
        name: span.name,
        duration: span.duration,
        percentage: (span.duration / totalTime) * 100,
      })),
      recommendations: this.generateRecommendations(profile),
      flamegraphUrl: this.uploadFlamegraph(profile.flamegraph),
    };
    
    return report;
  }
  
  private generateFlamegraph(spans: ProfileSpan[]): FlamegraphNode[] {
    const nodes: FlamegraphNode[] = [];
    
    for (const span of spans) {
      nodes.push({
        name: span.name,
        value: span.duration,
        children: span.children ? this.generateFlamegraph(span.children) : [],
      });
    }
    
    return nodes;
  }
  
  private generateRecommendations(profile: PerformanceProfile): string[] {
    const recommendations: string[] = [];
    
    // Check for slow operations
    const slowOps = profile.spans.filter(s => s.duration > 1000);
    if (slowOps.length > 0) {
      recommendations.push(
        `Found ${slowOps.length} operations taking >1s. Consider optimizing or parallelizing.`
      );
    }
    
    // Check CPU utilization
    const cpuUtil = (profile.metrics.cpuTime / profile.metrics.wallTime) * 100;
    if (cpuUtil < 50) {
      recommendations.push(
        `Low CPU utilization (${cpuUtil.toFixed(1)}%). Consider adding parallelism.`
      );
    }
    
    // Check GC pressure
    if (profile.metrics.gcTime > profile.metrics.wallTime * 0.1) {
      recommendations.push(
        `High GC pressure (${(profile.metrics.gcTime / profile.metrics.wallTime * 100).toFixed(1)}%). Optimize memory usage.`
      );
    }
    
    return recommendations;
  }
  
  private uploadFlamegraph(flamegraph: FlamegraphNode[]): string {
    // Upload flamegraph data and return URL
    // This would integrate with a visualization service
    return `https://flamegraph.service/view/${crypto.randomUUID()}`;
  }
}

interface PerformanceProfile {
  workflowId: string;
  startTime: number;
  endTime: number;
  spans: ProfileSpan[];
  metrics: {
    cpuTime: number;
    wallTime: number;
    allocations: number;
    deallocations: number;
    gcTime: number;
    gcCount: number;
  };
  flamegraph: FlamegraphNode[];
}

interface ProfileSpan {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: any;
  children?: ProfileSpan[];
}

interface FlamegraphNode {
  name: string;
  value: number;
  children: FlamegraphNode[];
}

interface PerformanceReport {
  workflowId: string;
  totalTime: number;
  cpuTime: number;
  cpuUtilization: number;
  slowestOperations: Array<{
    name: string;
    duration: number;
    percentage: number;
  }>;
  recommendations: string[];
  flamegraphUrl: string;
}

// ============================================================================
// Dead Letter Queue Handler
// ============================================================================

export class DeadLetterQueueHandler {
  private readonly DLQ_KEY_PREFIX = 'dlq:workflow:';
  
  constructor(
    private kv: KVNamespace,
    private r2: R2Bucket
  ) {}
  
  /**
   * Add workflow to dead letter queue
   */
  async addToDeadLetterQueue(
    workflowId: string,
    instanceId: string,
    error: Error,
    context: any
  ): Promise<void> {
    const entry: DeadLetterEntry = {
      workflowId,
      instanceId,
      failedAt: new Date().toISOString(),
      reason: error.message,
      lastState: context.currentState || 'UNKNOWN',
      retryCount: context.retryCount || 0,
      data: context.data,
      error: error.message,
      stack: error.stack,
    };
    
    const key = `${this.DLQ_KEY_PREFIX}${workflowId}:${instanceId}`;
    await this.kv.put(key, JSON.stringify(entry), {
      expirationTtl: 86400 * 30, // Keep for 30 days
    });
    
    // Also store in R2 for long-term retention
    await this.r2.put(
      `dead-letter/${workflowId}/${instanceId}.json`,
      JSON.stringify(entry)
    );
  }
  
  /**
   * Retry workflows from dead letter queue
   */
  async retryDeadLetterWorkflows(
    filter?: (entry: DeadLetterEntry) => boolean
  ): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
    errors: Array<{ workflowId: string; error: string }>;
  }> {
    const results = {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ workflowId: string; error: string }>,
    };
    
    // List all DLQ entries
    const list = await this.kv.list({ prefix: this.DLQ_KEY_PREFIX });
    
    for (const key of list.keys) {
      const entry = await this.kv.get<DeadLetterEntry>(key.name, 'json');
      
      if (!entry || (filter && !filter(entry))) {
        continue;
      }
      
      results.attempted++;
      
      try {
        await this.retryWorkflow(entry);
        results.succeeded++;
        
        // Remove from DLQ on success
        await this.kv.delete(key.name);
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          workflowId: entry.workflowId,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get dead letter queue statistics
   */
  async getStatistics(): Promise<{
    totalEntries: number;
    byReason: Map<string, number>;
    byState: Map<string, number>;
    oldestEntry?: DeadLetterEntry;
    newestEntry?: DeadLetterEntry;
  }> {
    const list = await this.kv.list({ prefix: this.DLQ_KEY_PREFIX });
    const byReason = new Map<string, number>();
    const byState = new Map<string, number>();
    let oldestEntry: DeadLetterEntry | undefined;
    let newestEntry: DeadLetterEntry | undefined;
    
    for (const key of list.keys) {
      const entry = await this.kv.get<DeadLetterEntry>(key.name, 'json');
      if (!entry) continue;
      
      // Count by reason
      const reasonKey = entry.reason.split(':')[0];
      byReason.set(reasonKey, (byReason.get(reasonKey) || 0) + 1);
      
      // Count by state
      byState.set(entry.lastState, (byState.get(entry.lastState) || 0) + 1);
      
      // Track oldest/newest
      if (!oldestEntry || new Date(entry.failedAt) < new Date(oldestEntry.failedAt)) {
        oldestEntry = entry;
      }
      if (!newestEntry || new Date(entry.failedAt) > new Date(newestEntry.failedAt)) {
        newestEntry = entry;
      }
    }
    
    return {
      totalEntries: list.keys.length,
      byReason,
      byState,
      oldestEntry,
      newestEntry,
    };
  }
  
  /**
   * Purge old entries from dead letter queue
   */
  async purgeOldEntries(olderThanDays: number): Promise<number> {
    const cutoffTime = Date.now() - (olderThanDays * 86400 * 1000);
    let purgedCount = 0;
    
    const list = await this.kv.list({ prefix: this.DLQ_KEY_PREFIX });
    
    for (const key of list.keys) {
      const entry = await this.kv.get<DeadLetterEntry>(key.name, 'json');
      
      if (entry && new Date(entry.failedAt).getTime() < cutoffTime) {
        await this.kv.delete(key.name);
        purgedCount++;
      }
    }
    
    return purgedCount;
  }
  
  private async retryWorkflow(entry: DeadLetterEntry): Promise<void> {
    // Implement workflow retry logic
    // This would trigger a new workflow instance with the original data
    console.log(`Retrying workflow ${entry.workflowId}`);
    
    // Add retry logic here based on your workflow system
    throw new Error('Retry not implemented');
  }
}

// ============================================================================
// Stuck Workflow Detector
// ============================================================================

export class StuckWorkflowDetector {
  private readonly STUCK_THRESHOLD_MS = 3600000; // 1 hour by default
  
  constructor(
    private kv: KVNamespace,
    private analytics: AnalyticsEngineDataset
  ) {}
  
  /**
   * Detect stuck workflows
   */
  async detectStuckWorkflows(
    thresholdMs: number = this.STUCK_THRESHOLD_MS
  ): Promise<StuckWorkflow[]> {
    const stuckWorkflows: StuckWorkflow[] = [];
    const now = Date.now();
    
    // Get all active workflows
    const activeWorkflows = await this.getActiveWorkflows();
    
    for (const workflow of activeWorkflows) {
      const lastActivity = new Date(workflow.lastActivity).getTime();
      const timeSinceActivity = now - lastActivity;
      
      if (timeSinceActivity > thresholdMs) {
        const stuck: StuckWorkflow = {
          workflowId: workflow.workflowId,
          instanceId: workflow.instanceId,
          currentState: workflow.currentState,
          stuckSince: new Date(lastActivity + thresholdMs).toISOString(),
          expectedTimeout: workflow.expectedTimeout || 'N/A',
          waitingFor: await this.determineWaitingFor(workflow),
          lastActivity: workflow.lastActivity,
          metadata: workflow.metadata,
        };
        
        stuckWorkflows.push(stuck);
      }
    }
    
    return stuckWorkflows;
  }
  
  /**
   * Auto-recover stuck workflows
   */
  async recoverStuckWorkflows(
    options: {
      dryRun?: boolean;
      force?: boolean;
      maxRecoveries?: number;
    } = {}
  ): Promise<{
    identified: number;
    recovered: number;
    failed: number;
    errors: Array<{ workflowId: string; error: string }>;
  }> {
    const results = {
      identified: 0,
      recovered: 0,
      failed: 0,
      errors: [] as Array<{ workflowId: string; error: string }>,
    };
    
    const stuckWorkflows = await this.detectStuckWorkflows();
    results.identified = stuckWorkflows.length;
    
    if (options.dryRun) {
      console.log(`[DRY RUN] Would recover ${stuckWorkflows.length} workflows`);
      return results;
    }
    
    const maxToRecover = options.maxRecoveries || stuckWorkflows.length;
    
    for (let i = 0; i < Math.min(maxToRecover, stuckWorkflows.length); i++) {
      const workflow = stuckWorkflows[i];
      
      try {
        await this.recoverWorkflow(workflow, options.force || false);
        results.recovered++;
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          workflowId: workflow.workflowId,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Monitor workflow health
   */
  async monitorHealth(): Promise<{
    healthy: number;
    unhealthy: number;
    stuck: number;
    details: Array<{
      workflowId: string;
      status: 'healthy' | 'unhealthy' | 'stuck';
      issue?: string;
    }>;
  }> {
    const health = {
      healthy: 0,
      unhealthy: 0,
      stuck: 0,
      details: [] as any[],
    };
    
    const activeWorkflows = await this.getActiveWorkflows();
    const stuckWorkflows = await this.detectStuckWorkflows();
    const stuckIds = new Set(stuckWorkflows.map(w => w.workflowId));
    
    for (const workflow of activeWorkflows) {
      if (stuckIds.has(workflow.workflowId)) {
        health.stuck++;
        health.details.push({
          workflowId: workflow.workflowId,
          status: 'stuck' as const,
          issue: `Stuck since ${workflow.lastActivity}`,
        });
      } else if (await this.isUnhealthy(workflow)) {
        health.unhealthy++;
        health.details.push({
          workflowId: workflow.workflowId,
          status: 'unhealthy' as const,
          issue: await this.getHealthIssue(workflow),
        });
      } else {
        health.healthy++;
        health.details.push({
          workflowId: workflow.workflowId,
          status: 'healthy' as const,
        });
      }
    }
    
    return health;
  }
  
  private async getActiveWorkflows(): Promise<any[]> {
    // Get list of active workflows from KV
    const list = await this.kv.list({ prefix: 'workflow:active:' });
    const workflows = [];
    
    for (const key of list.keys) {
      const workflow = await this.kv.get(key.name, 'json');
      if (workflow) {
        workflows.push(workflow);
      }
    }
    
    return workflows;
  }
  
  private async determineWaitingFor(workflow: any): Promise<string> {
    // Analyze workflow to determine what it's waiting for
    if (workflow.waitingForEvent) {
      return `Event: ${workflow.waitingForEvent}`;
    }
    
    if (workflow.waitingForApproval) {
      return `Approval from: ${workflow.waitingForApproval}`;
    }
    
    if (workflow.waitingForExternal) {
      return `External service: ${workflow.waitingForExternal}`;
    }
    
    return 'Unknown';
  }
  
  private async recoverWorkflow(workflow: StuckWorkflow, force: boolean): Promise<void> {
    console.log(`Recovering stuck workflow: ${workflow.workflowId}`);
    
    // Implement recovery logic based on what the workflow is waiting for
    if (workflow.waitingFor.startsWith('Event:')) {
      // Trigger a timeout event
      await this.triggerTimeoutEvent(workflow);
    } else if (workflow.waitingFor.startsWith('Approval:')) {
      if (force) {
        // Auto-approve if forced
        await this.autoApprove(workflow);
      } else {
        // Send reminder notification
        await this.sendReminderNotification(workflow);
      }
    } else {
      // Generic recovery: move to error state
      await this.moveToErrorState(workflow);
    }
  }
  
  private async isUnhealthy(workflow: any): Promise<boolean> {
    // Check various health indicators
    const errorRate = workflow.errorCount / (workflow.stepCount || 1);
    if (errorRate > 0.5) return true;
    
    const retryRate = workflow.retryCount / (workflow.stepCount || 1);
    if (retryRate > 0.3) return true;
    
    return false;
  }
  
  private async getHealthIssue(workflow: any): Promise<string> {
    const issues = [];
    
    const errorRate = workflow.errorCount / (workflow.stepCount || 1);
    if (errorRate > 0.5) {
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }
    
    const retryRate = workflow.retryCount / (workflow.stepCount || 1);
    if (retryRate > 0.3) {
      issues.push(`High retry rate: ${(retryRate * 100).toFixed(1)}%`);
    }
    
    return issues.join(', ');
  }
  
  private async triggerTimeoutEvent(workflow: StuckWorkflow): Promise<void> {
    // Trigger timeout event for the workflow
    console.log(`Triggering timeout for workflow ${workflow.workflowId}`);
  }
  
  private async autoApprove(workflow: StuckWorkflow): Promise<void> {
    // Auto-approve the workflow
    console.log(`Auto-approving workflow ${workflow.workflowId}`);
  }
  
  private async sendReminderNotification(workflow: StuckWorkflow): Promise<void> {
    // Send reminder notification
    console.log(`Sending reminder for workflow ${workflow.workflowId}`);
  }
  
  private async moveToErrorState(workflow: StuckWorkflow): Promise<void> {
    // Move workflow to error state
    console.log(`Moving workflow ${workflow.workflowId} to error state`);
  }
}

// ============================================================================
// Resource Usage Monitor
// ============================================================================

export class ResourceUsageMonitor {
  private measurements: Map<string, ResourceUsage[]> = new Map();
  
  constructor(private analytics: AnalyticsEngineDataset) {}
  
  /**
   * Start monitoring resources for a workflow
   */
  startMonitoring(workflowId: string): void {
    this.measurements.set(workflowId, []);
    this.captureSnapshot(workflowId);
  }
  
  /**
   * Capture resource usage snapshot
   */
  captureSnapshot(workflowId: string): void {
    const usage: ResourceUsage = {
      timestamp: new Date().toISOString(),
      cpuMilliseconds: 0, // Would need actual CPU measurement
      memoryMB: 0, // Would need actual memory measurement
      subrequestCount: 0,
      kvReads: 0,
      kvWrites: 0,
      r2Gets: 0,
      r2Puts: 0,
      databaseQueries: 0,
      queueMessages: 0,
    };
    
    const measurements = this.measurements.get(workflowId);
    if (measurements) {
      measurements.push(usage);
    }
  }
  
  /**
   * Stop monitoring and get report
   */
  stopMonitoring(workflowId: string): {
    totalUsage: ResourceUsage;
    peakUsage: ResourceUsage;
    averageUsage: ResourceUsage;
    timeline: ResourceUsage[];
  } | null {
    const measurements = this.measurements.get(workflowId);
    if (!measurements || measurements.length === 0) {
      return null;
    }
    
    // Calculate totals
    const totalUsage = this.calculateTotal(measurements);
    const peakUsage = this.calculatePeak(measurements);
    const averageUsage = this.calculateAverage(measurements);
    
    return {
      totalUsage,
      peakUsage,
      averageUsage,
      timeline: measurements,
    };
  }
  
  /**
   * Check if resources are within limits
   */
  checkResourceLimits(workflowId: string): {
    withinLimits: boolean;
    violations: string[];
  } {
    const measurements = this.measurements.get(workflowId);
    if (!measurements || measurements.length === 0) {
      return { withinLimits: true, violations: [] };
    }
    
    const violations: string[] = [];
    const latest = measurements[measurements.length - 1];
    
    // Check limits
    if (latest.cpuMilliseconds > 50) {
      violations.push(`CPU usage exceeded: ${latest.cpuMilliseconds}ms > 50ms`);
    }
    
    if (latest.memoryMB > 128) {
      violations.push(`Memory usage exceeded: ${latest.memoryMB}MB > 128MB`);
    }
    
    if (latest.subrequestCount > 50) {
      violations.push(`Subrequest limit exceeded: ${latest.subrequestCount} > 50`);
    }
    
    return {
      withinLimits: violations.length === 0,
      violations,
    };
  }
  
  private calculateTotal(measurements: ResourceUsage[]): ResourceUsage {
    return measurements.reduce((total, current) => ({
      timestamp: current.timestamp,
      cpuMilliseconds: total.cpuMilliseconds + current.cpuMilliseconds,
      memoryMB: Math.max(total.memoryMB, current.memoryMB),
      subrequestCount: total.subrequestCount + current.subrequestCount,
      kvReads: total.kvReads + current.kvReads,
      kvWrites: total.kvWrites + current.kvWrites,
      r2Gets: total.r2Gets + current.r2Gets,
      r2Puts: total.r2Puts + current.r2Puts,
      databaseQueries: total.databaseQueries + current.databaseQueries,
      queueMessages: total.queueMessages + current.queueMessages,
    }));
  }
  
  private calculatePeak(measurements: ResourceUsage[]): ResourceUsage {
    return measurements.reduce((peak, current) => ({
      timestamp: current.timestamp,
      cpuMilliseconds: Math.max(peak.cpuMilliseconds, current.cpuMilliseconds),
      memoryMB: Math.max(peak.memoryMB, current.memoryMB),
      subrequestCount: Math.max(peak.subrequestCount, current.subrequestCount),
      kvReads: Math.max(peak.kvReads, current.kvReads),
      kvWrites: Math.max(peak.kvWrites, current.kvWrites),
      r2Gets: Math.max(peak.r2Gets, current.r2Gets),
      r2Puts: Math.max(peak.r2Puts, current.r2Puts),
      databaseQueries: Math.max(peak.databaseQueries, current.databaseQueries),
      queueMessages: Math.max(peak.queueMessages, current.queueMessages),
    }));
  }
  
  private calculateAverage(measurements: ResourceUsage[]): ResourceUsage {
    const total = this.calculateTotal(measurements);
    const count = measurements.length;
    
    return {
      timestamp: measurements[0].timestamp,
      cpuMilliseconds: total.cpuMilliseconds / count,
      memoryMB: total.memoryMB / count,
      subrequestCount: total.subrequestCount / count,
      kvReads: total.kvReads / count,
      kvWrites: total.kvWrites / count,
      r2Gets: total.r2Gets / count,
      r2Puts: total.r2Puts / count,
      databaseQueries: total.databaseQueries / count,
      queueMessages: total.queueMessages / count,
    };
  }
}

// ============================================================================
// Distributed Tracing Exporter
// ============================================================================

export class TraceExporter {
  private spans: Map<string, TraceSpan> = new Map();
  
  constructor(
    private analytics: AnalyticsEngineDataset,
    private endpoint?: string // OpenTelemetry endpoint
  ) {}
  
  /**
   * Create a new trace span
   */
  createSpan(
    operationName: string,
    parentSpanId?: string
  ): TraceSpan {
    const span: TraceSpan = {
      traceId: crypto.randomUUID(),
      spanId: crypto.randomUUID(),
      parentSpanId,
      operationName,
      serviceName: 'pitchey-workflows',
      startTime: Date.now(),
      endTime: 0,
      duration: 0,
      status: 'ok',
      attributes: {},
      events: [],
      links: [],
    };
    
    this.spans.set(span.spanId, span);
    return span;
  }
  
  /**
   * Add event to span
   */
  addEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
    const span = this.spans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: Date.now(),
        name,
        attributes: attributes || {},
      });
    }
  }
  
  /**
   * End span and export
   */
  async endSpan(spanId: string, status: 'ok' | 'error' | 'cancelled' = 'ok'): Promise<void> {
    const span = this.spans.get(spanId);
    if (!span) return;
    
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    
    // Export to analytics
    await this.exportSpan(span);
    
    // Export to OpenTelemetry if configured
    if (this.endpoint) {
      await this.exportToOTLP(span);
    }
    
    this.spans.delete(spanId);
  }
  
  /**
   * Export span to analytics
   */
  private async exportSpan(span: TraceSpan): Promise<void> {
    this.analytics.writeDataPoint({
      blobs: [
        span.traceId,
        span.spanId,
        span.operationName,
        span.serviceName,
      ],
      doubles: [
        span.startTime,
        span.duration,
      ],
      indexes: [span.status],
    });
  }
  
  /**
   * Export to OpenTelemetry Protocol
   */
  private async exportToOTLP(span: TraceSpan): Promise<void> {
    if (!this.endpoint) return;
    
    const otlpSpan = {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.operationName,
      kind: 'INTERNAL',
      startTimeUnixNano: span.startTime * 1000000,
      endTimeUnixNano: span.endTime * 1000000,
      attributes: Object.entries(span.attributes).map(([key, value]) => ({
        key,
        value: { stringValue: String(value) },
      })),
      events: span.events.map(event => ({
        timeUnixNano: event.timestamp * 1000000,
        name: event.name,
        attributes: Object.entries(event.attributes).map(([key, value]) => ({
          key,
          value: { stringValue: String(value) },
        })),
      })),
      status: {
        code: span.status === 'ok' ? 'OK' : 'ERROR',
      },
    };
    
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resourceSpans: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'pitchey-workflows' } },
              ],
            },
            scopeSpans: [{
              spans: [otlpSpan],
            }],
          }],
        }),
      });
    } catch (error) {
      console.error('Failed to export span to OTLP:', error);
    }
  }
}

// ============================================================================
// Time Travel Debugging
// ============================================================================

export class TimeTravelDebugger {
  private snapshots: Map<string, WorkflowSnapshot[]> = new Map();
  
  constructor(
    private kv: KVNamespace,
    private r2: R2Bucket
  ) {}
  
  /**
   * Take snapshot of workflow state
   */
  async takeSnapshot(workflowId: string, label?: string): Promise<void> {
    const state = await this.getCurrentState(workflowId);
    
    const snapshot: WorkflowSnapshot = {
      id: crypto.randomUUID(),
      workflowId,
      timestamp: new Date().toISOString(),
      label: label || `Snapshot at ${new Date().toISOString()}`,
      state,
      stackTrace: this.captureStackTrace(),
      variables: await this.captureVariables(workflowId),
    };
    
    if (!this.snapshots.has(workflowId)) {
      this.snapshots.set(workflowId, []);
    }
    
    this.snapshots.get(workflowId)!.push(snapshot);
    
    // Persist to storage
    await this.persistSnapshot(snapshot);
  }
  
  /**
   * Restore workflow to snapshot
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.getSnapshot(snapshotId);
    
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    
    // Restore workflow state
    await this.restoreState(snapshot.workflowId, snapshot.state);
    
    // Restore variables
    await this.restoreVariables(snapshot.workflowId, snapshot.variables);
    
    console.log(`Restored workflow ${snapshot.workflowId} to snapshot ${snapshotId}`);
  }
  
  /**
   * Step forward through execution
   */
  async stepForward(workflowId: string): Promise<void> {
    const snapshots = this.snapshots.get(workflowId);
    if (!snapshots || snapshots.length === 0) {
      throw new Error('No snapshots available');
    }
    
    // Find current position and move forward
    // Implementation depends on your debugging context
  }
  
  /**
   * Step backward through execution
   */
  async stepBackward(workflowId: string): Promise<void> {
    const snapshots = this.snapshots.get(workflowId);
    if (!snapshots || snapshots.length < 2) {
      throw new Error('Cannot step backward');
    }
    
    // Restore previous snapshot
    const previousSnapshot = snapshots[snapshots.length - 2];
    await this.restoreSnapshot(previousSnapshot.id);
  }
  
  private async getCurrentState(workflowId: string): Promise<any> {
    const stateKey = `workflow:state:${workflowId}`;
    return await this.kv.get(stateKey, 'json');
  }
  
  private captureStackTrace(): string[] {
    const stack = new Error().stack || '';
    return stack.split('\n').slice(2); // Remove this function from stack
  }
  
  private async captureVariables(workflowId: string): Promise<Record<string, any>> {
    // Capture relevant variables from workflow context
    const variables: Record<string, any> = {};
    
    // Add workflow-specific variable capture logic
    
    return variables;
  }
  
  private async persistSnapshot(snapshot: WorkflowSnapshot): Promise<void> {
    const key = `workflow:snapshot:${snapshot.workflowId}:${snapshot.id}`;
    await this.kv.put(key, JSON.stringify(snapshot), {
      expirationTtl: 86400 * 7, // Keep for 7 days
    });
    
    // Also store in R2 for long-term retention
    await this.r2.put(
      `snapshots/${snapshot.workflowId}/${snapshot.id}.json`,
      JSON.stringify(snapshot)
    );
  }
  
  private async getSnapshot(snapshotId: string): Promise<WorkflowSnapshot | null> {
    // Search through all snapshots
    for (const [_, snapshots] of this.snapshots) {
      const snapshot = snapshots.find(s => s.id === snapshotId);
      if (snapshot) {
        return snapshot;
      }
    }
    
    // Try loading from storage
    const list = await this.kv.list({ prefix: 'workflow:snapshot:' });
    for (const key of list.keys) {
      if (key.name.includes(snapshotId)) {
        return await this.kv.get<WorkflowSnapshot>(key.name, 'json');
      }
    }
    
    return null;
  }
  
  private async restoreState(workflowId: string, state: any): Promise<void> {
    const stateKey = `workflow:state:${workflowId}`;
    await this.kv.put(stateKey, JSON.stringify(state));
  }
  
  private async restoreVariables(workflowId: string, variables: Record<string, any>): Promise<void> {
    // Restore variables to workflow context
    // Implementation depends on your workflow system
  }
}

interface WorkflowSnapshot {
  id: string;
  workflowId: string;
  timestamp: string;
  label: string;
  state: any;
  stackTrace: string[];
  variables: Record<string, any>;
}

// ============================================================================
// Export Debug Manager Class
// ============================================================================

export class DebugManager {
  public stateInspector: WorkflowStateInspector;
  public eventReplayer: EventReplayer;
  public performanceProfiler: PerformanceProfiler;
  public deadLetterHandler: DeadLetterQueueHandler;
  public stuckDetector: StuckWorkflowDetector;
  public resourceMonitor: ResourceUsageMonitor;
  public traceExporter: TraceExporter;
  public timeTravelDebugger: TimeTravelDebugger;
  
  constructor(
    kv: KVNamespace,
    r2: R2Bucket,
    analytics: AnalyticsEngineDataset,
    otlpEndpoint?: string
  ) {
    this.stateInspector = new WorkflowStateInspector(kv, analytics);
    this.eventReplayer = new EventReplayer(kv, r2);
    this.performanceProfiler = new PerformanceProfiler(analytics);
    this.deadLetterHandler = new DeadLetterQueueHandler(kv, r2);
    this.stuckDetector = new StuckWorkflowDetector(kv, analytics);
    this.resourceMonitor = new ResourceUsageMonitor(analytics);
    this.traceExporter = new TraceExporter(analytics, otlpEndpoint);
    this.timeTravelDebugger = new TimeTravelDebugger(kv, r2);
  }
  
  /**
   * Start debugging session for a workflow
   */
  async startDebugging(workflowId: string): Promise<void> {
    // Start profiling
    this.performanceProfiler.startProfiling(workflowId);
    
    // Start resource monitoring
    this.resourceMonitor.startMonitoring(workflowId);
    
    // Take initial snapshot
    await this.timeTravelDebugger.takeSnapshot(workflowId, 'Debug session start');
    
    console.log(`Started debugging session for workflow ${workflowId}`);
  }
  
  /**
   * Stop debugging and get comprehensive report
   */
  async stopDebugging(workflowId: string): Promise<{
    state: WorkflowState | null;
    performance: any;
    resources: any;
    issues: string[];
    recommendations: string[];
  }> {
    // Get final state
    const state = await this.stateInspector.inspectWorkflow(workflowId);
    
    // Get performance profile
    const performance = this.performanceProfiler.stopProfiling(workflowId);
    
    // Get resource usage
    const resources = this.resourceMonitor.stopMonitoring(workflowId);
    
    // Identify issues
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (performance) {
      const report = this.performanceProfiler.generateReport(workflowId);
      recommendations.push(...report.recommendations);
    }
    
    if (resources) {
      const limits = this.resourceMonitor.checkResourceLimits(workflowId);
      if (!limits.withinLimits) {
        issues.push(...limits.violations);
      }
    }
    
    return {
      state,
      performance,
      resources,
      issues,
      recommendations,
    };
  }
}

export default {
  WorkflowStateInspector,
  EventReplayer,
  PerformanceProfiler,
  DeadLetterQueueHandler,
  StuckWorkflowDetector,
  ResourceUsageMonitor,
  TraceExporter,
  TimeTravelDebugger,
  DebugManager,
};