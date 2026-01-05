/**
 * Base Container Class
 * 
 * Provides common functionality for all container services including:
 * - Lifecycle management
 * - SQLite state persistence
 * - HTTP communication
 * - Error handling and logging
 * - Scale-to-zero optimization
 */

import { ContainerConfig, ContainerHealth, ContainerStatus, IContainer, JobResult } from './index';

export abstract class BaseContainer implements IContainer {
  public readonly name: string;
  public readonly config: ContainerConfig;
  
  protected status: ContainerStatus = 'idle';
  protected startTime: number = 0;
  protected lastActivity: number = 0;
  protected errorCount: number = 0;
  protected jobs = new Map<string, JobResult>();
  protected sleepTimer: number | null = null;
  
  // SQLite database for state persistence
  protected db: any = null; // Will be initialized based on environment
  
  constructor(name: string, config: ContainerConfig) {
    this.name = name;
    this.config = config;
    this.initializeDatabase();
  }
  
  // Abstract methods that must be implemented by subclasses
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onError(error: Error): Promise<void>;
  protected abstract processJobInternal<T>(jobType: string, payload: any): Promise<T>;
  
  // Lifecycle methods
  async start(): Promise<void> {
    try {
      if (this.status === 'running') {
        return;
      }
      
      this.status = 'starting';
      this.startTime = Date.now();
      this.log('info', 'Starting container');
      
      await this.onStart();
      
      this.status = 'running';
      this.lastActivity = Date.now();
      this.resetSleepTimer();
      
      this.log('info', 'Container started successfully');
    } catch (error) {
      this.status = 'error';
      this.errorCount++;
      this.log('error', 'Failed to start container', error);
      await this.onError(error as Error);
      throw error;
    }
  }
  
  async stop(): Promise<void> {
    try {
      if (this.status === 'idle') {
        return;
      }
      
      this.status = 'stopping';
      this.log('info', 'Stopping container');
      
      if (this.sleepTimer) {
        clearTimeout(this.sleepTimer);
        this.sleepTimer = null;
      }
      
      await this.onStop();
      
      this.status = 'idle';
      this.log('info', 'Container stopped');
    } catch (error) {
      this.status = 'error';
      this.errorCount++;
      this.log('error', 'Failed to stop container', error);
      await this.onError(error as Error);
      throw error;
    }
  }
  
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }
  
  async health(): Promise<ContainerHealth> {
    const now = Date.now();
    return {
      status: this.status,
      uptime: this.status === 'running' ? now - this.startTime : 0,
      lastActivity: this.lastActivity,
      errorCount: this.errorCount,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCpuUsage()
    };
  }
  
  // Job processing
  async processJob<T>(jobType: string, payload: any): Promise<JobResult<T>> {
    const jobId = this.generateJobId();
    
    const job: JobResult<T> = {
      jobId,
      status: 'pending',
      startTime: Date.now(),
      metadata: { jobType, containerName: this.name }
    };
    
    this.jobs.set(jobId, job);
    
    try {
      // Ensure container is running
      if (this.status !== 'running') {
        await this.start();
      }
      
      this.updateActivity();
      job.status = 'processing';
      
      this.log('info', `Processing job ${jobId} of type ${jobType}`);
      
      const result = await this.processJobInternal<T>(jobType, payload);
      
      job.status = 'completed';
      job.result = result;
      job.endTime = Date.now();
      
      this.log('info', `Job ${jobId} completed successfully`);
      
      // Persist job result
      await this.persistJobResult(job);
      
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = Date.now();
      
      this.errorCount++;
      this.log('error', `Job ${jobId} failed`, error);
      await this.onError(error as Error);
    }
    
    return job;
  }
  
  async getJobStatus(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      // Try to load from database
      const persistedJob = await this.loadJobResult(jobId);
      if (!persistedJob) {
        throw new Error(`Job ${jobId} not found`);
      }
      return persistedJob;
    }
    return job;
  }
  
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }
    
    job.status = 'failed';
    job.error = 'Job cancelled';
    job.endTime = Date.now();
    
    this.log('info', `Job ${jobId} cancelled`);
    return true;
  }
  
  // HTTP communication
  async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `http://localhost:${this.config.defaultPort}${endpoint}`;
    
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': `${this.name}-container/1.0`
    };
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };
    
    this.updateActivity();
    
    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text() as T;
    } catch (error) {
      this.errorCount++;
      this.log('error', `HTTP request failed: ${url}`, error);
      throw error;
    }
  }
  
  // Protected utility methods
  protected updateActivity(): void {
    this.lastActivity = Date.now();
    this.resetSleepTimer();
  }
  
  protected resetSleepTimer(): void {
    if (this.sleepTimer) {
      clearTimeout(this.sleepTimer);
    }
    
    this.sleepTimer = setTimeout(async () => {
      if (this.status === 'running' && this.jobs.size === 0) {
        this.log('info', 'Scaling to zero due to inactivity');
        await this.stop();
      }
    }, this.config.sleepAfter * 1000) as any;
  }
  
  protected generateJobId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected log(level: 'info' | 'warn' | 'error', message: string, error?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      container: this.name,
      message,
      error: error?.stack || error?.message || error
    };
    
    // Log to console (in production this would go to structured logging)
    console[level](`[${timestamp}] [${this.name}] ${message}`, error || '');
    
    // Persist to database if available
    this.persistLog(logEntry);
  }
  
  protected getMemoryUsage(): number | undefined {
    // In Workers environment, memory tracking is limited
    // This would be implemented based on available APIs
    return undefined;
  }
  
  protected getCpuUsage(): number | undefined {
    // In Workers environment, CPU tracking is limited
    // This would be implemented based on available APIs
    return undefined;
  }
  
  // Database methods (implementation depends on environment)
  private initializeDatabase(): void {
    // In Cloudflare Workers, we might use KV storage or D1 instead of SQLite
    // This is a simplified implementation
    try {
      // Initialize database connection based on environment
      if (typeof globalThis.WebAssembly !== 'undefined') {
        // Workers environment - use KV or other storage
        this.initializeWorkerStorage();
      } else {
        // Node.js environment - use SQLite
        this.initializeSQLite();
      }
    } catch (error) {
      this.log('warn', 'Failed to initialize database, using in-memory storage', error);
    }
  }
  
  private initializeWorkerStorage(): void {
    // Implementation for Cloudflare Workers KV storage
    // This would be bound in wrangler.toml
  }
  
  private initializeSQLite(): void {
    // Implementation for SQLite in Node.js environment
    // Would use better-sqlite3 or similar
  }
  
  private async persistJobResult(job: JobResult): Promise<void> {
    try {
      // Persist job result to storage
      const jobData = JSON.stringify(job);
      
      if (this.db) {
        // Use database
        // await this.db.put(`job:${job.jobId}`, jobData);
      } else {
        // Fallback to memory storage with expiration
        setTimeout(() => {
          this.jobs.delete(job.jobId);
        }, 3600000); // 1 hour
      }
    } catch (error) {
      this.log('warn', 'Failed to persist job result', error);
    }
  }
  
  private async loadJobResult(jobId: string): Promise<JobResult | null> {
    try {
      if (this.db) {
        // Load from database
        // const jobData = await this.db.get(`job:${jobId}`);
        // return jobData ? JSON.parse(jobData) : null;
      }
      return null;
    } catch (error) {
      this.log('warn', 'Failed to load job result', error);
      return null;
    }
  }
  
  private async persistLog(logEntry: any): Promise<void> {
    try {
      if (this.db) {
        // Persist log to database
        // await this.db.put(`log:${Date.now()}`, JSON.stringify(logEntry));
      }
    } catch (error) {
      // Silent fail for logging persistence
    }
  }
}