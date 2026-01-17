/**
 * JobQueueDO - Manage job queues with priority and batching
 * Provides durable job queue management with priority scheduling and batch processing
 */

import type { Env } from '../worker-integrated';

export interface Job {
  id: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  data: Record<string, any>;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  attempts: number;
  maxAttempts: number;
  timeout: number; // in milliseconds
  delay?: number; // delay before execution in milliseconds
  scheduledAt?: Date; // for delayed jobs
  retryCount: number;
  retryBackoff: 'linear' | 'exponential' | 'fixed';
  retryDelay: number; // base retry delay in milliseconds
  error?: {
    message: string;
    stack?: string;
    timestamp: Date;
  };
  result?: any;
  tags: string[];
  dependencies?: string[]; // job IDs that must complete first
  metadata: Record<string, any>;
}

export interface JobProcessor {
  type: string;
  handler: (job: Job) => Promise<any>;
  concurrency: number;
  timeout: number;
  retryPolicy?: {
    maxAttempts: number;
    backoff: 'linear' | 'exponential' | 'fixed';
    delay: number;
  };
}

export interface QueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  totalProcessed: number;
  averageProcessingTime: number;
  throughput: number; // jobs per minute
  errorRate: number;
}

export interface BatchConfig {
  enabled: boolean;
  minSize: number;
  maxSize: number;
  maxWaitTime: number; // milliseconds
  triggerThreshold: number;
}

/**
 * Job Queue Durable Object
 * Manages job queues with priority scheduling, batching, and fault tolerance
 */
export class JobQueueDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;
  
  // In-memory state
  private jobs: Map<string, Job> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private runningJobs: Map<string, Promise<any>> = new Map();
  private queueStats: QueueStats = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0,
    averageProcessingTime: 0,
    throughput: 0,
    errorRate: 0
  };
  
  // Queue management
  private processingInterval?: number;
  private batchProcessor?: Map<string, NodeJS.Timeout> = new Map();
  private batchQueues: Map<string, Job[]> = new Map();
  
  // Configuration
  private defaultBatchConfig: BatchConfig = {
    enabled: true,
    minSize: 5,
    maxSize: 50,
    maxWaitTime: 30000, // 30 seconds
    triggerThreshold: 80 // trigger at 80% of maxSize
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    this.initializeQueue();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (true) {
        case method === 'POST' && path === '/jobs':
          return this.addJob(request);
        
        case method === 'POST' && path === '/jobs/batch':
          return this.addJobBatch(request);
        
        case method === 'GET' && path.startsWith('/jobs/'):
          return this.getJob(path.split('/')[2]);
        
        case method === 'DELETE' && path.startsWith('/jobs/'):
          return this.cancelJob(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/retry'):
          return this.retryJob(path.split('/')[2]);
        
        case method === 'GET' && path === '/jobs':
          return this.listJobs(url.searchParams);
        
        case method === 'GET' && path === '/stats':
          return this.getStats();
        
        case method === 'POST' && path === '/processors':
          return this.registerProcessor(request);
        
        case method === 'GET' && path === '/processors':
          return this.listProcessors();
        
        case method === 'POST' && path === '/process':
          return this.processJobs();
        
        case method === 'POST' && path === '/batch/config':
          return this.configureBatch(request);
        
        case method === 'GET' && path === '/batch/config':
          return this.getBatchConfig();
        
        case method === 'POST' && path === '/cleanup':
          return this.cleanup();
        
        case method === 'GET' && path === '/health':
          return this.getHealth();
        
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('JobQueueDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Add a new job to the queue
   */
  private async addJob(request: Request): Promise<Response> {
    const data = await request.json() as {
      id?: string;
      type?: string;
      priority?: Job['priority'];
      data?: Record<string, any>;
      maxAttempts?: number;
      timeout?: number;
      delay?: number;
      retryBackoff?: Job['retryBackoff'];
      retryDelay?: number;
      tags?: string[];
      dependencies?: string[];
      metadata?: Record<string, any>;
    };
    const jobId = data.id || crypto.randomUUID();

    const job: Job = {
      id: jobId,
      type: data.type || '',
      priority: data.priority || 'normal',
      status: 'pending',
      data: data.data || {},
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: data.maxAttempts || 3,
      timeout: data.timeout || 300000, // 5 minutes default
      delay: data.delay,
      scheduledAt: data.delay ? new Date(Date.now() + data.delay) : new Date(),
      retryCount: 0,
      retryBackoff: data.retryBackoff || 'exponential',
      retryDelay: data.retryDelay || 1000,
      tags: data.tags || [],
      dependencies: data.dependencies || [],
      metadata: data.metadata || {}
    };

    await this.saveJob(job);
    this.queueStats.pending++;

    // Check for batch processing
    if (this.shouldBatchProcess(job.type)) {
      await this.addToBatch(job);
    } else {
      // Trigger immediate processing for high priority jobs
      if (job.priority === 'critical' || job.priority === 'high') {
        this.scheduleProcessing();
      }
    }

    return Response.json({
      success: true,
      jobId,
      message: 'Job added to queue',
      estimatedProcessingTime: this.estimateProcessingTime(job)
    });
  }

  /**
   * Add multiple jobs in batch
   */
  private async addJobBatch(request: Request): Promise<Response> {
    const body = await request.json() as { jobs?: any[] };
    const jobData = body.jobs || [];
    const jobs: Job[] = [];

    for (const data of jobData) {
      const jobId = data.id || crypto.randomUUID();
      
      const job: Job = {
        id: jobId,
        type: data.type,
        priority: data.priority || 'normal',
        status: 'pending',
        data: data.data || {},
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: data.maxAttempts || 3,
        timeout: data.timeout || 300000,
        delay: data.delay,
        scheduledAt: data.delay ? new Date(Date.now() + data.delay) : new Date(),
        retryCount: 0,
        retryBackoff: data.retryBackoff || 'exponential',
        retryDelay: data.retryDelay || 1000,
        tags: data.tags || [],
        dependencies: data.dependencies || [],
        metadata: data.metadata || {}
      };

      jobs.push(job);
      await this.saveJob(job);
    }

    this.queueStats.pending += jobs.length;

    return Response.json({
      success: true,
      jobIds: jobs.map(j => j.id),
      count: jobs.length,
      message: 'Jobs added to queue'
    });
  }

  /**
   * Get job details
   */
  private async getJob(jobId: string): Promise<Response> {
    const job = await this.loadJob(jobId);
    
    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    return Response.json({
      success: true,
      job: this.sanitizeJob(job)
    });
  }

  /**
   * Cancel a job
   */
  private async cancelJob(jobId: string): Promise<Response> {
    const job = await this.loadJob(jobId);
    
    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    if (job.status === 'running') {
      // Try to cancel running job
      const runningPromise = this.runningJobs.get(jobId);
      if (runningPromise) {
        // Note: JavaScript doesn't have built-in promise cancellation
        // This would need to be implemented with AbortController
        this.runningJobs.delete(jobId);
      }
    }

    job.status = 'cancelled';
    job.completedAt = new Date();
    
    await this.saveJob(job);
    this.updateStats('cancelled');

    return Response.json({
      success: true,
      message: `Job ${jobId} cancelled`
    });
  }

  /**
   * Retry a failed job
   */
  private async retryJob(jobId: string): Promise<Response> {
    const job = await this.loadJob(jobId);
    
    if (!job) {
      return new Response('Job not found', { status: 404 });
    }

    if (job.status !== 'failed') {
      return new Response('Only failed jobs can be retried', { status: 400 });
    }

    job.status = 'pending';
    job.retryCount++;
    job.attempts = 0;
    job.scheduledAt = new Date();
    delete job.error;
    delete job.failedAt;

    await this.saveJob(job);
    this.queueStats.pending++;
    this.queueStats.failed--;

    this.scheduleProcessing();

    return Response.json({
      success: true,
      message: `Job ${jobId} queued for retry`
    });
  }

  /**
   * List jobs with filtering and pagination
   */
  private async listJobs(params: URLSearchParams): Promise<Response> {
    const status = params.get('status');
    const type = params.get('type');
    const priority = params.get('priority');
    const tag = params.get('tag');
    const limit = parseInt(params.get('limit') || '50');
    const offset = parseInt(params.get('offset') || '0');

    const allJobs = await this.storage.list({ prefix: 'job:' });
    const jobs: Job[] = [];

    for (const [key, value] of allJobs) {
      const job = value as Job;

      // Apply filters
      if (status && job.status !== status) continue;
      if (type && job.type !== type) continue;
      if (priority && job.priority !== priority) continue;
      if (tag && !job.tags.includes(tag)) continue;

      jobs.push(this.sanitizeJob(job) as Job);
    }

    // Sort by priority and creation time
    jobs.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Apply pagination
    const paginatedJobs = jobs.slice(offset, offset + limit);

    return Response.json({
      success: true,
      jobs: paginatedJobs,
      total: jobs.length,
      offset,
      limit
    });
  }

  /**
   * Get queue statistics
   */
  private async getStats(): Promise<Response> {
    // Refresh stats from storage
    await this.refreshStats();

    return Response.json({
      success: true,
      stats: this.queueStats,
      queueSize: this.jobs.size,
      runningJobs: this.runningJobs.size,
      batchQueues: Object.fromEntries(
        Array.from(this.batchQueues.entries()).map(([type, jobs]) => [
          type, 
          { count: jobs.length, oldestJob: jobs[0]?.createdAt }
        ])
      )
    });
  }

  /**
   * Register a job processor
   */
  private async registerProcessor(request: Request): Promise<Response> {
    const data = await request.json() as {
      type?: string;
      handler?: (job: Job) => Promise<any>;
      concurrency?: number;
      timeout?: number;
      retryPolicy?: JobProcessor['retryPolicy'];
    };

    const processor: JobProcessor = {
      type: data.type || '',
      handler: data.handler || (async () => ({})),
      concurrency: data.concurrency || 1,
      timeout: data.timeout || 300000,
      retryPolicy: data.retryPolicy
    };

    this.processors.set(processor.type, processor);

    return Response.json({
      success: true,
      message: `Processor registered for type: ${processor.type}`
    });
  }

  /**
   * List registered processors
   */
  private async listProcessors(): Promise<Response> {
    const processors = Array.from(this.processors.values()).map(p => ({
      type: p.type,
      concurrency: p.concurrency,
      timeout: p.timeout,
      retryPolicy: p.retryPolicy
    }));

    return Response.json({
      success: true,
      processors
    });
  }

  /**
   * Process jobs in the queue
   */
  private async processJobs(): Promise<Response> {
    let processedCount = 0;
    
    // Get ready jobs
    const readyJobs = await this.getReadyJobs();
    
    for (const job of readyJobs) {
      if (this.canProcessJob(job)) {
        await this.executeJob(job);
        processedCount++;
      }
    }

    return Response.json({
      success: true,
      processedCount,
      message: `Processed ${processedCount} jobs`
    });
  }

  /**
   * Configure batch processing
   */
  private async configureBatch(request: Request): Promise<Response> {
    const config = await request.json() as Partial<BatchConfig>;

    this.defaultBatchConfig = {
      ...this.defaultBatchConfig,
      ...config
    };

    await this.storage.put('batch:config', this.defaultBatchConfig);

    return Response.json({
      success: true,
      config: this.defaultBatchConfig,
      message: 'Batch configuration updated'
    });
  }

  /**
   * Get batch configuration
   */
  private async getBatchConfig(): Promise<Response> {
    return Response.json({
      success: true,
      config: this.defaultBatchConfig
    });
  }

  /**
   * Initialize queue from storage
   */
  private async initializeQueue(): Promise<void> {
    // Load existing jobs
    const storedJobs = await this.storage.list({ prefix: 'job:' });

    for (const [key, value] of storedJobs) {
      const job = value as Job;
      this.jobs.set(job.id, job);
    }

    // Load batch configuration
    const batchConfig = await this.storage.get<BatchConfig>('batch:config');
    if (batchConfig) {
      this.defaultBatchConfig = batchConfig;
    }

    // Refresh stats
    await this.refreshStats();

    // Start processing
    this.startProcessing();
  }

  /**
   * Start processing loop
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      try {
        await this.processJobs();
        await this.processBatches();
      } catch (error) {
        console.error('Processing error:', error);
      }
    }, 5000) as any; // Process every 5 seconds
  }

  /**
   * Get jobs ready for processing
   */
  private async getReadyJobs(): Promise<Job[]> {
    const now = new Date();
    const readyJobs: Job[] = [];

    for (const job of this.jobs.values()) {
      if (job.status === 'pending' && 
          job.scheduledAt && 
          job.scheduledAt <= now &&
          this.areDependenciesMet(job)) {
        readyJobs.push(job);
      }
    }

    // Sort by priority
    return this.sortJobsByPriority(readyJobs);
  }

  /**
   * Check if job dependencies are met
   */
  private areDependenciesMet(job: Job): boolean {
    if (!job.dependencies || job.dependencies.length === 0) {
      return true;
    }

    return job.dependencies.every(depId => {
      const depJob = this.jobs.get(depId);
      return depJob && depJob.status === 'completed';
    });
  }

  /**
   * Check if job can be processed (concurrency limits)
   */
  private canProcessJob(job: Job): boolean {
    const processor = this.processors.get(job.type);
    if (!processor) return false;

    // Count running jobs of this type
    let runningJobsOfType = 0;
    for (const runningJobId of this.runningJobs.keys()) {
      const runningJob = this.jobs.get(runningJobId);
      if (runningJob && runningJob.type === job.type) {
        runningJobsOfType++;
      }
    }

    return runningJobsOfType < processor.concurrency;
  }

  /**
   * Execute a job
   */
  private async executeJob(job: Job): Promise<void> {
    const processor = this.processors.get(job.type);
    if (!processor) {
      throw new Error(`No processor found for job type: ${job.type}`);
    }

    job.status = 'running';
    job.startedAt = new Date();
    job.attempts++;
    
    await this.saveJob(job);
    this.updateStats('started');

    const timeoutMs = job.timeout || processor.timeout;
    
    const executionPromise = Promise.race([
      this.executeJobWithProcessor(job, processor),
      this.createTimeoutPromise(timeoutMs)
    ]);

    this.runningJobs.set(job.id, executionPromise);

    try {
      const result = await executionPromise;
      
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      
      await this.saveJob(job);
      this.updateStats('completed');
      
    } catch (error) {
      job.error = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date()
      };

      if (job.attempts < job.maxAttempts) {
        await this.scheduleRetry(job);
      } else {
        job.status = 'failed';
        job.failedAt = new Date();
        await this.saveJob(job);
        this.updateStats('failed');
      }
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  /**
   * Execute job with processor (simulated)
   */
  private async executeJobWithProcessor(job: Job, processor: JobProcessor): Promise<any> {
    // In a real implementation, this would call the actual processor function
    // For now, simulate processing based on job type
    
    const processingTime = Math.random() * 5000 + 1000; // 1-6 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Simulated processing error');
    }
    
    return {
      processed: true,
      timestamp: new Date(),
      processingTime,
      data: job.data
    };
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Job execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Schedule job retry with backoff
   */
  private async scheduleRetry(job: Job): Promise<void> {
    let delay: number;
    
    switch (job.retryBackoff) {
      case 'linear':
        delay = job.retryDelay * job.attempts;
        break;
      case 'exponential':
        delay = job.retryDelay * Math.pow(2, job.attempts - 1);
        break;
      case 'fixed':
      default:
        delay = job.retryDelay;
    }

    job.status = 'retrying';
    job.scheduledAt = new Date(Date.now() + delay);
    job.retryCount++;
    
    await this.saveJob(job);

    // Schedule retry
    setTimeout(() => {
      job.status = 'pending';
      this.saveJob(job);
    }, delay);
  }

  /**
   * Sort jobs by priority and creation time
   */
  private sortJobsByPriority(jobs: Job[]): Job[] {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    
    return jobs.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  /**
   * Check if job type should use batch processing
   */
  private shouldBatchProcess(jobType: string): boolean {
    const batchableTypes = ['email', 'notification', 'analytics', 'report'];
    return this.defaultBatchConfig.enabled && batchableTypes.includes(jobType);
  }

  /**
   * Add job to batch queue
   */
  private async addToBatch(job: Job): Promise<void> {
    if (!this.batchQueues.has(job.type)) {
      this.batchQueues.set(job.type, []);
    }

    const batch = this.batchQueues.get(job.type)!;
    batch.push(job);

    // Check if batch should be triggered
    if (batch.length >= this.defaultBatchConfig.triggerThreshold ||
        batch.length >= this.defaultBatchConfig.maxSize) {
      await this.processBatch(job.type);
    } else if (batch.length === 1) {
      // Start timer for max wait time
      this.batchProcessor?.set(job.type, setTimeout(() => {
        this.processBatch(job.type);
      }, this.defaultBatchConfig.maxWaitTime));
    }
  }

  /**
   * Process all pending batches
   */
  private async processBatches(): Promise<void> {
    for (const [jobType, batch] of this.batchQueues.entries()) {
      if (batch.length >= this.defaultBatchConfig.minSize) {
        await this.processBatch(jobType);
      }
    }
  }

  /**
   * Process a specific batch
   */
  private async processBatch(jobType: string): Promise<void> {
    const batch = this.batchQueues.get(jobType);
    if (!batch || batch.length === 0) return;

    // Clear the timeout
    const timeout = this.batchProcessor?.get(jobType);
    if (timeout) {
      clearTimeout(timeout);
      this.batchProcessor?.delete(jobType);
    }

    // Take jobs for processing
    const jobsToProcess = batch.splice(0, this.defaultBatchConfig.maxSize);
    
    try {
      // Process batch (simulated)
      for (const job of jobsToProcess) {
        job.status = 'running';
        job.startedAt = new Date();
        await this.saveJob(job);
      }

      // Simulate batch processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mark all as completed
      for (const job of jobsToProcess) {
        job.status = 'completed';
        job.completedAt = new Date();
        job.result = { processed: true, batch: true };
        await this.saveJob(job);
        this.updateStats('completed');
      }

    } catch (error) {
      // Mark all as failed
      for (const job of jobsToProcess) {
        job.status = 'failed';
        job.failedAt = new Date();
        job.error = {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        };
        await this.saveJob(job);
        this.updateStats('failed');
      }
    }
  }

  /**
   * Update queue statistics
   */
  private updateStats(event: string): void {
    switch (event) {
      case 'started':
        this.queueStats.pending--;
        this.queueStats.running++;
        break;
      case 'completed':
        this.queueStats.running--;
        this.queueStats.completed++;
        this.queueStats.totalProcessed++;
        break;
      case 'failed':
        this.queueStats.running--;
        this.queueStats.failed++;
        this.queueStats.totalProcessed++;
        break;
      case 'cancelled':
        if (this.queueStats.pending > 0) this.queueStats.pending--;
        break;
    }
  }

  /**
   * Refresh statistics from storage
   */
  private async refreshStats(): Promise<void> {
    const stats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      totalProcessed: 0,
      averageProcessingTime: 0,
      throughput: 0,
      errorRate: 0
    };

    let totalProcessingTime = 0;
    let processedCount = 0;

    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending':
        case 'retrying':
          stats.pending++;
          break;
        case 'running':
          stats.running++;
          break;
        case 'completed':
          stats.completed++;
          processedCount++;
          if (job.startedAt && job.completedAt) {
            totalProcessingTime += job.completedAt.getTime() - job.startedAt.getTime();
          }
          break;
        case 'failed':
          stats.failed++;
          processedCount++;
          break;
      }
    }

    stats.totalProcessed = processedCount;
    if (processedCount > 0) {
      stats.averageProcessingTime = totalProcessingTime / processedCount;
      stats.errorRate = stats.failed / processedCount;
    }

    // Calculate throughput (jobs per minute in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentJobs = Array.from(this.jobs.values()).filter(
      job => job.completedAt && job.completedAt > oneHourAgo
    );
    stats.throughput = recentJobs.length;

    this.queueStats = stats;
  }

  /**
   * Estimate processing time for a job
   */
  private estimateProcessingTime(job: Job): string {
    // Simple estimation based on queue size and job priority
    const queuePosition = this.getQueuePosition(job);
    const avgProcessingTime = this.queueStats.averageProcessingTime || 5000;
    const estimatedMs = queuePosition * avgProcessingTime;
    
    if (estimatedMs < 60000) {
      return `${Math.ceil(estimatedMs / 1000)} seconds`;
    } else {
      return `${Math.ceil(estimatedMs / 60000)} minutes`;
    }
  }

  /**
   * Get queue position for a job
   */
  private getQueuePosition(job: Job): number {
    const pendingJobs = Array.from(this.jobs.values()).filter(
      j => j.status === 'pending' && j.createdAt <= job.createdAt
    );
    
    const sorted = this.sortJobsByPriority(pendingJobs);
    return sorted.findIndex(j => j.id === job.id) + 1;
  }

  /**
   * Schedule immediate processing
   */
  private scheduleProcessing(): void {
    // Use a short timeout to avoid overwhelming the system
    setTimeout(() => {
      this.processJobs();
    }, 100);
  }

  /**
   * Cleanup completed and old jobs
   */
  private async cleanup(): Promise<Response> {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
    let cleanedCount = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') &&
          job.completedAt && job.completedAt < cutoffDate) {
        
        await this.storage.delete(`job:${jobId}`);
        this.jobs.delete(jobId);
        cleanedCount++;
      }
    }

    await this.refreshStats();

    return Response.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} old jobs`
    });
  }

  /**
   * Get queue health status
   */
  private async getHealth(): Promise<Response> {
    const health = {
      status: 'healthy',
      queueSize: this.jobs.size,
      runningJobs: this.runningJobs.size,
      errorRate: this.queueStats.errorRate,
      throughput: this.queueStats.throughput,
      issues: [] as string[]
    };

    // Check for issues
    if (this.queueStats.errorRate > 0.2) {
      health.issues.push('High error rate detected');
    }

    if (this.queueStats.pending > 1000) {
      health.issues.push('Large queue backlog');
    }

    if (this.runningJobs.size === 0 && this.queueStats.pending > 0) {
      health.issues.push('No jobs processing despite pending queue');
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
   * Load job from storage with caching
   */
  private async loadJob(jobId: string): Promise<Job | null> {
    if (this.jobs.has(jobId)) {
      return this.jobs.get(jobId)!;
    }

    const job = await this.storage.get<Job>(`job:${jobId}`);
    if (job) {
      this.jobs.set(jobId, job);
      return job;
    }

    return null;
  }

  /**
   * Save job to storage and update cache
   */
  private async saveJob(job: Job): Promise<void> {
    await this.storage.put(`job:${job.id}`, job);
    this.jobs.set(job.id, job);
  }

  /**
   * Sanitize job for external access
   */
  private sanitizeJob(job: Job): Partial<Job> {
    return {
      id: job.id,
      type: job.type,
      priority: job.priority,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      retryCount: job.retryCount,
      error: job.error,
      tags: job.tags,
      metadata: job.metadata
    };
  }
}