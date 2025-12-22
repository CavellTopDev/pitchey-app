/**
 * Notification Worker - Background processing for notification queues
 * Handles email sending, status updates, and retry logic
 */

import type { DatabaseService } from '../types/worker-types.ts';
import { createNotificationService, type NotificationService } from '../services/notification.service.ts';
import { createEmailService, getDefaultEmailConfig } from '../services/email.service.ts';
import type { MessagingService } from '../services/messaging.service.ts';
import { eq, and, or, desc, asc, like, isNull, isNotNull, sql, inArray, gte, lte } from 'drizzle-orm';

// Redis service interface
interface RedisService {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
  del: (key: string) => Promise<void>;
  rpush: (key: string, value: string) => Promise<void>;
  lpop: (key: string) => Promise<string | null>;
  llen: (key: string) => Promise<number>;
  hget: (hash: string, field: string) => Promise<string | null>;
  hset: (hash: string, field: string, value: string) => Promise<void>;
  sadd: (set: string, member: string) => Promise<void>;
  smembers: (set: string) => Promise<string[]>;
  publish: (channel: string, message: string) => Promise<void>;
  subscribe: (channel: string, callback: (message: string) => void) => Promise<void>;
}

// Worker configuration
interface NotificationWorkerConfig {
  processingInterval: number;  // How often to check queues (ms)
  batchSize: number;          // How many items to process per batch
  maxRetries: number;         // Maximum retry attempts
  retryDelayMs: number;       // Base retry delay
  maxRetryDelayMs: number;    // Maximum retry delay
  concurrency: number;        // How many notifications to process concurrently
  workerTimeout: number;      // Worker operation timeout (ms)
  enableMetrics: boolean;     // Whether to collect metrics
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// Worker metrics
interface WorkerMetrics {
  processed: number;
  failed: number;
  retried: number;
  totalProcessingTime: number;
  averageProcessingTime: number;
  queueSizes: Record<string, number>;
  lastProcessedAt: string;
  uptime: number;
  startedAt: string;
}

// Job interface
interface NotificationJob {
  id: string;
  notificationId: number;
  userId: number;
  channel: 'email' | 'push' | 'sms';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  scheduledAt: Date;
  createdAt: Date;
  metadata?: Record<string, any>;
}

// Worker status
type WorkerStatus = 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';

export class NotificationWorker {
  private db: DatabaseService;
  private redis: RedisService;
  private notificationService: NotificationService;
  private config: NotificationWorkerConfig;
  private status: WorkerStatus = 'stopped';
  private processingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private metrics: WorkerMetrics;
  private startedAt: Date = new Date();
  private isShuttingDown: boolean = false;

  constructor(
    db: DatabaseService,
    redis: RedisService,
    messaging: MessagingService,
    env: any,
    config: Partial<NotificationWorkerConfig> = {}
  ) {
    this.db = db;
    this.redis = redis;
    
    // Initialize services
    const emailService = createEmailService(getDefaultEmailConfig(env));
    this.notificationService = createNotificationService(db, redis, emailService, messaging);
    
    // Configure worker
    this.config = {
      processingInterval: 5000,
      batchSize: 10,
      maxRetries: 3,
      retryDelayMs: 1000,
      maxRetryDelayMs: 30000,
      concurrency: 5,
      workerTimeout: 30000,
      enableMetrics: true,
      logLevel: 'info',
      ...config
    };

    // Initialize metrics
    this.metrics = {
      processed: 0,
      failed: 0,
      retried: 0,
      totalProcessingTime: 0,
      averageProcessingTime: 0,
      queueSizes: {},
      lastProcessedAt: '',
      uptime: 0,
      startedAt: this.startedAt.toISOString()
    };

    this.log('info', 'Notification worker initialized', { config: this.config });
  }

  // ============================================================================
  // WORKER LIFECYCLE
  // ============================================================================

  /**
   * Start the notification worker
   */
  async start(): Promise<void> {
    if (this.status !== 'stopped') {
      throw new Error(`Worker cannot start from status: ${this.status}`);
    }

    this.log('info', 'Starting notification worker...');
    this.status = 'starting';

    try {
      // Start queue processors for different channels and priorities
      await this.startQueueProcessors();
      
      // Start metrics collection
      if (this.config.enableMetrics) {
        await this.startMetricsCollection();
      }

      // Start health monitoring
      await this.startHealthMonitoring();

      this.status = 'running';
      this.startedAt = new Date();
      this.log('info', 'Notification worker started successfully');

    } catch (error) {
      this.status = 'error';
      this.log('error', 'Failed to start notification worker', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the notification worker gracefully
   */
  async stop(): Promise<void> {
    if (this.status === 'stopped' || this.status === 'stopping') {
      return;
    }

    this.log('info', 'Stopping notification worker...');
    this.status = 'stopping';
    this.isShuttingDown = true;

    try {
      // Stop all processing intervals
      for (const [name, interval] of this.processingIntervals) {
        clearInterval(interval);
        this.log('debug', `Stopped processor: ${name}`);
      }
      this.processingIntervals.clear();

      // Wait for current operations to complete (with timeout)
      await this.waitForCurrentOperations();

      this.status = 'stopped';
      this.log('info', 'Notification worker stopped successfully');

    } catch (error) {
      this.status = 'error';
      this.log('error', 'Error stopping notification worker', { error: error.message });
      throw error;
    }
  }

  /**
   * Pause the worker (stop processing but keep connections)
   */
  async pause(): Promise<void> {
    if (this.status !== 'running') {
      throw new Error(`Cannot pause worker from status: ${this.status}`);
    }

    this.log('info', 'Pausing notification worker...');
    this.status = 'paused';

    // Stop processing but keep infrastructure running
    for (const [name, interval] of this.processingIntervals) {
      if (name.includes('queue_processor')) {
        clearInterval(interval);
        this.processingIntervals.delete(name);
      }
    }

    this.log('info', 'Notification worker paused');
  }

  /**
   * Resume the worker from paused state
   */
  async resume(): Promise<void> {
    if (this.status !== 'paused') {
      throw new Error(`Cannot resume worker from status: ${this.status}`);
    }

    this.log('info', 'Resuming notification worker...');
    
    // Restart queue processors
    await this.startQueueProcessors();
    
    this.status = 'running';
    this.log('info', 'Notification worker resumed');
  }

  // ============================================================================
  // QUEUE PROCESSING
  // ============================================================================

  /**
   * Start queue processors for different channels and priorities
   */
  private async startQueueProcessors(): Promise<void> {
    const channels = ['email', 'push', 'sms'];
    const priorities = ['urgent', 'high', 'normal', 'low'];

    for (const channel of channels) {
      for (const priority of priorities) {
        const processorName = `queue_processor_${channel}_${priority}`;
        const interval = setInterval(
          () => this.processQueue(channel as any, priority),
          this.config.processingInterval
        );
        this.processingIntervals.set(processorName, interval);
      }
    }

    // Start retry processor
    const retryInterval = setInterval(
      () => this.processRetryQueue(),
      this.config.processingInterval * 2 // Check retries less frequently
    );
    this.processingIntervals.set('retry_processor', retryInterval);

    // Start failed job cleanup
    const cleanupInterval = setInterval(
      () => this.cleanupFailedJobs(),
      60000 // Every minute
    );
    this.processingIntervals.set('cleanup_processor', cleanupInterval);

    this.log('info', 'Queue processors started', { 
      channels: channels.length, 
      priorities: priorities.length 
    });
  }

  /**
   * Process specific queue
   */
  private async processQueue(channel: 'email' | 'push' | 'sms', priority: string): Promise<void> {
    if (this.isShuttingDown || this.status !== 'running') {
      return;
    }

    const queueKey = `notification_queue:${priority}:${channel}`;
    
    try {
      // Get batch of jobs
      const jobs = await this.getJobBatch(queueKey);
      if (jobs.length === 0) {
        return;
      }

      this.log('debug', `Processing ${jobs.length} jobs from ${queueKey}`);

      // Process jobs concurrently but with limit
      const chunks = this.chunkArray(jobs, this.config.concurrency);
      
      for (const chunk of chunks) {
        if (this.isShuttingDown) break;
        
        await Promise.allSettled(
          chunk.map(job => this.processJob(job))
        );
      }

      // Update queue size metric
      this.metrics.queueSizes[queueKey] = await this.redis.llen(queueKey);

    } catch (error) {
      this.log('error', `Error processing queue ${queueKey}`, { error: error.message });
    }
  }

  /**
   * Get batch of jobs from queue
   */
  private async getJobBatch(queueKey: string): Promise<NotificationJob[]> {
    const jobs: NotificationJob[] = [];
    
    for (let i = 0; i < this.config.batchSize; i++) {
      const jobJson = await this.redis.lpop(queueKey);
      if (!jobJson) break;
      
      try {
        const job: NotificationJob = JSON.parse(jobJson);
        
        // Check if job should be processed now
        if (job.scheduledAt <= new Date()) {
          jobs.push(job);
        } else {
          // Put back in queue for later processing
          await this.redis.rpush(queueKey, jobJson);
          break; // Stop processing this batch
        }
      } catch (error) {
        this.log('error', 'Failed to parse job from queue', { jobJson, error: error.message });
      }
    }

    return jobs;
  }

  /**
   * Process individual notification job
   */
  private async processJob(job: NotificationJob): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorMessage = '';

    try {
      this.log('debug', `Processing job ${job.id}`, { 
        channel: job.channel, 
        type: job.type, 
        attempt: job.attempts + 1 
      });

      // Create delivery record
      const [delivery] = await this.db
        .insert('notification_deliveries')
        .values({
          notificationId: job.notificationId,
          channel: job.channel,
          status: 'sending',
          attempts: job.attempts + 1,
          maxAttempts: job.maxAttempts,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .execute();

      // Process based on channel
      switch (job.channel) {
        case 'email':
          success = await this.processEmailJob(job, delivery.id);
          break;
        case 'push':
          success = await this.processPushJob(job, delivery.id);
          break;
        case 'sms':
          success = await this.processSMSJob(job, delivery.id);
          break;
        default:
          throw new Error(`Unknown channel: ${job.channel}`);
      }

      // Update delivery status
      await this.db
        .update('notification_deliveries')
        .set({
          status: success ? 'sent' : 'failed',
          sentAt: success ? new Date() : null,
          errorMessage: success ? null : errorMessage,
          updatedAt: new Date()
        })
        .where(eq('id', delivery.id))
        .execute();

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.metrics.processed++;
      this.metrics.totalProcessingTime += processingTime;
      this.metrics.averageProcessingTime = this.metrics.totalProcessingTime / this.metrics.processed;
      this.metrics.lastProcessedAt = new Date().toISOString();

      // Log job result
      await this.logJobResult(job, delivery.id, success, processingTime, errorMessage);

      this.log('debug', `Job ${job.id} ${success ? 'completed' : 'failed'}`, { 
        processingTime,
        errorMessage: success ? undefined : errorMessage
      });

    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.metrics.failed++;
      
      this.log('error', `Job ${job.id} failed`, { error: errorMessage });
    }

    // Handle retries
    if (!success && job.attempts < job.maxAttempts) {
      await this.scheduleRetry(job, errorMessage);
    }
  }

  // ============================================================================
  // CHANNEL-SPECIFIC PROCESSING
  // ============================================================================

  /**
   * Process email notification job
   */
  private async processEmailJob(job: NotificationJob, deliveryId: number): Promise<boolean> {
    try {
      // Get user email
      const [user] = await this.db
        .select({ email: 'email', firstName: 'first_name', lastName: 'last_name' })
        .from('users')
        .where(eq('id', job.userId))
        .execute();

      if (!user?.email) {
        throw new Error('User email not found');
      }

      // Send email via notification service
      const result = await this.notificationService.sendEmailNotification(
        job.data,
        deliveryId
      );

      return result.success;
    } catch (error) {
      this.log('error', `Email job failed: ${error.message}`, { jobId: job.id });
      return false;
    }
  }

  /**
   * Process push notification job
   */
  private async processPushJob(job: NotificationJob, deliveryId: number): Promise<boolean> {
    try {
      // Implement push notification logic
      // This would integrate with FCM, APNs, etc.
      this.log('info', 'Push notification would be sent', { 
        jobId: job.id,
        userId: job.userId,
        title: job.data.title 
      });
      
      return true;
    } catch (error) {
      this.log('error', `Push job failed: ${error.message}`, { jobId: job.id });
      return false;
    }
  }

  /**
   * Process SMS notification job
   */
  private async processSMSJob(job: NotificationJob, deliveryId: number): Promise<boolean> {
    try {
      // Implement SMS logic
      // This would integrate with Twilio, AWS SNS, etc.
      this.log('info', 'SMS notification would be sent', { 
        jobId: job.id,
        userId: job.userId,
        message: job.data.message 
      });
      
      return true;
    } catch (error) {
      this.log('error', `SMS job failed: ${error.message}`, { jobId: job.id });
      return false;
    }
  }

  // ============================================================================
  // RETRY LOGIC
  // ============================================================================

  /**
   * Schedule job retry with exponential backoff
   */
  private async scheduleRetry(job: NotificationJob, errorMessage: string): Promise<void> {
    try {
      const retryAttempt = job.attempts + 1;
      const delay = Math.min(
        this.config.retryDelayMs * Math.pow(2, retryAttempt - 1),
        this.config.maxRetryDelayMs
      );

      const retryJob: NotificationJob = {
        ...job,
        attempts: retryAttempt,
        scheduledAt: new Date(Date.now() + delay),
        metadata: {
          ...job.metadata,
          lastError: errorMessage,
          retryScheduledAt: new Date().toISOString()
        }
      };

      // Add to retry queue
      await this.redis.rpush('notification_queue:retry', JSON.stringify(retryJob));
      this.metrics.retried++;

      this.log('debug', `Scheduled retry for job ${job.id}`, { 
        attempt: retryAttempt,
        delay,
        scheduledAt: retryJob.scheduledAt 
      });

    } catch (error) {
      this.log('error', `Failed to schedule retry for job ${job.id}`, { error: error.message });
    }
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (this.isShuttingDown || this.status !== 'running') {
      return;
    }

    try {
      const retryJobs = await this.getJobBatch('notification_queue:retry');
      
      for (const job of retryJobs) {
        if (this.isShuttingDown) break;

        // Move back to appropriate priority queue
        const queueKey = `notification_queue:${job.priority}:${job.channel}`;
        await this.redis.rpush(queueKey, JSON.stringify(job));
      }

      if (retryJobs.length > 0) {
        this.log('debug', `Moved ${retryJobs.length} jobs from retry queue`);
      }

    } catch (error) {
      this.log('error', 'Error processing retry queue', { error: error.message });
    }
  }

  // ============================================================================
  // MONITORING AND CLEANUP
  // ============================================================================

  /**
   * Start metrics collection
   */
  private async startMetricsCollection(): Promise<void> {
    const metricsInterval = setInterval(
      () => this.collectMetrics(),
      10000 // Every 10 seconds
    );
    this.processingIntervals.set('metrics_collector', metricsInterval);
  }

  /**
   * Start health monitoring
   */
  private async startHealthMonitoring(): Promise<void> {
    const healthInterval = setInterval(
      () => this.performHealthCheck(),
      30000 // Every 30 seconds
    );
    this.processingIntervals.set('health_monitor', healthInterval);
  }

  /**
   * Collect worker metrics
   */
  private async collectMetrics(): Promise<void> {
    try {
      this.metrics.uptime = Date.now() - this.startedAt.getTime();

      // Collect queue sizes
      const channels = ['email', 'push', 'sms'];
      const priorities = ['urgent', 'high', 'normal', 'low'];

      for (const channel of channels) {
        for (const priority of priorities) {
          const queueKey = `notification_queue:${priority}:${channel}`;
          this.metrics.queueSizes[queueKey] = await this.redis.llen(queueKey);
        }
      }

      // Store metrics in Redis for monitoring
      await this.redis.set(
        'notification_worker_metrics',
        JSON.stringify(this.metrics),
        60 // TTL of 60 seconds
      );

    } catch (error) {
      this.log('error', 'Error collecting metrics', { error: error.message });
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Check database connectivity
      await this.db.select().from('users').limit(1).execute();

      // Check Redis connectivity
      await this.redis.set('health_check', Date.now().toString(), 10);

      // Update health status
      await this.redis.set(
        'notification_worker_health',
        JSON.stringify({
          status: this.status,
          lastHealthCheck: new Date().toISOString(),
          uptime: this.metrics.uptime,
          processedCount: this.metrics.processed
        }),
        120 // TTL of 2 minutes
      );

    } catch (error) {
      this.log('error', 'Health check failed', { error: error.message });
      this.status = 'error';
    }
  }

  /**
   * Clean up old failed jobs
   */
  private async cleanupFailedJobs(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      // Delete old failed delivery records
      const deletedCount = await this.db
        .delete('notification_deliveries')
        .where(
          and(
            eq('status', 'failed'),
            lte('created_at', cutoffDate)
          )
        )
        .returning({ id: 'id' })
        .execute();

      if (deletedCount.length > 0) {
        this.log('info', `Cleaned up ${deletedCount.length} old failed jobs`);
      }

    } catch (error) {
      this.log('error', 'Error cleaning up failed jobs', { error: error.message });
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Log job result for debugging and analytics
   */
  private async logJobResult(
    job: NotificationJob,
    deliveryId: number,
    success: boolean,
    processingTime: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.db
        .insert('notification_logs')
        .values({
          notificationId: job.notificationId,
          deliveryId,
          level: success ? 'info' : 'error',
          message: success ? 'Job completed successfully' : `Job failed: ${errorMessage}`,
          context: {
            jobId: job.id,
            channel: job.channel,
            type: job.type,
            attempt: job.attempts + 1,
            processingTime
          },
          processingTime,
          errorDetails: errorMessage ? { message: errorMessage } : null,
          createdAt: new Date()
        })
        .execute();
    } catch (error) {
      this.log('error', 'Failed to log job result', { error: error.message });
    }
  }

  /**
   * Wait for current operations to complete
   */
  private async waitForCurrentOperations(timeoutMs: number = 30000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      // Check if any operations are still running
      // This is a simplified implementation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (this.processingIntervals.size === 0) {
        break;
      }
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Enhanced logging
   */
  private log(level: string, message: string, metadata?: any): void {
    if (this.shouldLog(level)) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        component: 'NotificationWorker',
        message,
        metadata,
        workerId: `worker_${process.pid}`
      };
      
      console.log(JSON.stringify(logEntry));
    }
  }

  /**
   * Check if log level should be output
   */
  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel] || 1;
    const messageLevel = levels[level] || 1;
    return messageLevel >= currentLevel;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Get worker status
   */
  getStatus(): { status: WorkerStatus; metrics: WorkerMetrics } {
    return {
      status: this.status,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get queue sizes
   */
  async getQueueSizes(): Promise<Record<string, number>> {
    const sizes: Record<string, number> = {};
    const channels = ['email', 'push', 'sms'];
    const priorities = ['urgent', 'high', 'normal', 'low'];

    for (const channel of channels) {
      for (const priority of priorities) {
        const queueKey = `notification_queue:${priority}:${channel}`;
        sizes[queueKey] = await this.redis.llen(queueKey);
      }
    }

    // Add retry queue
    sizes['notification_queue:retry'] = await this.redis.llen('notification_queue:retry');

    return sizes;
  }

  /**
   * Force process specific queue (for testing/debugging)
   */
  async processQueueManually(channel: 'email' | 'push' | 'sms', priority: string): Promise<void> {
    if (this.status !== 'running') {
      throw new Error('Worker is not running');
    }
    
    await this.processQueue(channel, priority);
  }
}

// Export worker factory
export function createNotificationWorker(
  db: DatabaseService,
  redis: RedisService,
  messaging: MessagingService,
  env: any,
  config?: Partial<NotificationWorkerConfig>
): NotificationWorker {
  return new NotificationWorker(db, redis, messaging, env, config);
}

export type { NotificationWorkerConfig, WorkerMetrics, NotificationJob, WorkerStatus };