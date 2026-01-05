/**
 * BatchProcessingWorkflow - Parallel job processing with dependency management
 * 
 * Features:
 * - Parallel job execution with configurable concurrency
 * - Dependency resolution and ordering
 * - Progress tracking and status updates
 * - Error handling with retry logic
 * - Resource allocation and optimization
 * - Completion notifications
 */

import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from "cloudflare:workers";

// Job interfaces
interface BatchJob {
  id: string;
  type: 'video-processing' | 'document-generation' | 'ai-analysis' | 'data-migration' | 'bulk-update';
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  payload: Record<string, any>;
  dependencies: string[]; // job IDs this job depends on
  estimatedDuration: number; // seconds
  resourceRequirements: {
    cpu: number; // cores
    memory: number; // MB
    storage: number; // MB
  };
  retryConfig: {
    maxRetries: number;
    backoffMultiplier: number;
    maxBackoffMs: number;
  };
  timeout: number; // seconds
  metadata: {
    userId?: string;
    projectId?: string;
    batchId: string;
    tags: string[];
    createdAt: string;
  };
}

interface BatchConfig {
  batchId: string;
  maxConcurrency: number;
  resourceLimits: {
    totalCpu: number;
    totalMemory: number;
    totalStorage: number;
  };
  timeoutMs: number;
  notificationConfig: {
    webhookUrl?: string;
    emailNotifications: boolean;
    slackChannel?: string;
  };
  retryPolicy: 'fail-fast' | 'best-effort' | 'retry-all';
  completionThreshold: number; // percentage of jobs that must succeed
}

interface JobResult {
  jobId: string;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  result?: any;
  error?: string;
  executionTime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  retryCount: number;
  completedAt: string;
}

interface BatchStatus {
  batchId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  runningJobs: number;
  pendingJobs: number;
  progress: number; // 0-100
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  resourceUsage: {
    cpu: number;
    memory: number;
    storage: number;
  };
  errors: string[];
}

interface WorkflowParams {
  jobs: BatchJob[];
  config: BatchConfig;
  userId?: string;
}

export class BatchProcessingWorkflow extends WorkflowEntrypoint<{}, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep) {
    const { jobs, config, userId } = event.payload;
    
    try {
      // Step 1: Initialize batch processing
      const batchStatus = await step.do("initialize-batch", async () => {
        console.log(`🚀 Starting batch processing: ${config.batchId}`);
        console.log(`📊 Total jobs: ${jobs.length}, Max concurrency: ${config.maxConcurrency}`);
        
        // Validate jobs and dependencies
        this.validateJobDependencies(jobs);
        
        // Sort jobs by priority and dependencies
        const sortedJobs = this.resolveDependencyOrder(jobs);
        
        const status: BatchStatus = {
          batchId: config.batchId,
          status: 'running',
          totalJobs: jobs.length,
          completedJobs: 0,
          failedJobs: 0,
          runningJobs: 0,
          pendingJobs: jobs.length,
          progress: 0,
          startedAt: new Date().toISOString(),
          resourceUsage: { cpu: 0, memory: 0, storage: 0 },
          errors: []
        };
        
        return { status, sortedJobs };
      });
      
      // Step 2: Resource allocation planning
      const resourcePlan = await step.do("plan-resources", async () => {
        return this.planResourceAllocation(batchStatus.sortedJobs, config);
      });
      
      // Step 3: Execute jobs in parallel batches
      const results = await step.do("execute-jobs", async () => {
        return await this.executeJobsInParallel(
          batchStatus.sortedJobs,
          config,
          resourcePlan,
          step
        );
      });
      
      // Step 4: Process results and handle failures
      const finalStatus = await step.do("process-results", async () => {
        return this.processJobResults(results, config);
      });
      
      // Step 5: Cleanup and notifications
      await step.do("cleanup-and-notify", async () => {
        await this.cleanupResources(config.batchId);
        await this.sendNotifications(finalStatus, config);
        
        console.log(`✅ Batch processing completed: ${config.batchId}`);
        console.log(`📈 Success rate: ${((finalStatus.completedJobs / finalStatus.totalJobs) * 100).toFixed(1)}%`);
        
        return finalStatus;
      });
      
      return finalStatus;
      
    } catch (error) {
      console.error(`❌ Batch processing failed: ${config.batchId}`, error);
      
      // Send failure notification
      await step.do("handle-failure", async () => {
        await this.sendFailureNotification(config, error as Error);
        throw error;
      });
    }
  }
  
  private validateJobDependencies(jobs: BatchJob[]): void {
    const jobIds = new Set(jobs.map(job => job.id));
    
    for (const job of jobs) {
      for (const depId of job.dependencies) {
        if (!jobIds.has(depId)) {
          throw new Error(`Job ${job.id} depends on non-existent job ${depId}`);
        }
      }
    }
    
    // Check for circular dependencies
    this.detectCircularDependencies(jobs);
  }
  
  private detectCircularDependencies(jobs: BatchJob[]): void {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const jobMap = new Map(jobs.map(job => [job.id, job]));
    
    const dfs = (jobId: string): void => {
      if (visiting.has(jobId)) {
        throw new Error(`Circular dependency detected involving job ${jobId}`);
      }
      if (visited.has(jobId)) return;
      
      visiting.add(jobId);
      const job = jobMap.get(jobId);
      
      if (job) {
        for (const depId of job.dependencies) {
          dfs(depId);
        }
      }
      
      visiting.delete(jobId);
      visited.add(jobId);
    };
    
    for (const job of jobs) {
      if (!visited.has(job.id)) {
        dfs(job.id);
      }
    }
  }
  
  private resolveDependencyOrder(jobs: BatchJob[]): BatchJob[] {
    const jobMap = new Map(jobs.map(job => [job.id, job]));
    const result: BatchJob[] = [];
    const visited = new Set<string>();
    
    const visit = (jobId: string): void => {
      if (visited.has(jobId)) return;
      
      const job = jobMap.get(jobId);
      if (!job) return;
      
      // Visit dependencies first
      for (const depId of job.dependencies) {
        visit(depId);
      }
      
      visited.add(jobId);
      result.push(job);
    };
    
    // Sort by priority first, then resolve dependencies
    const prioritizedJobs = [...jobs].sort((a, b) => a.priority - b.priority);
    
    for (const job of prioritizedJobs) {
      visit(job.id);
    }
    
    return result;
  }
  
  private planResourceAllocation(jobs: BatchJob[], config: BatchConfig) {
    const waves: BatchJob[][] = [];
    const completed = new Set<string>();
    let currentWave: BatchJob[] = [];
    let currentResources = { cpu: 0, memory: 0, storage: 0 };
    
    for (const job of jobs) {
      // Check if dependencies are satisfied
      const canStart = job.dependencies.every(depId => completed.has(depId));
      
      if (canStart) {
        // Check resource constraints
        const wouldExceedLimits = 
          currentResources.cpu + job.resourceRequirements.cpu > config.resourceLimits.totalCpu ||
          currentResources.memory + job.resourceRequirements.memory > config.resourceLimits.totalMemory ||
          currentResources.storage + job.resourceRequirements.storage > config.resourceLimits.totalStorage ||
          currentWave.length >= config.maxConcurrency;
        
        if (wouldExceedLimits && currentWave.length > 0) {
          // Start new wave
          waves.push([...currentWave]);
          currentWave.forEach(j => completed.add(j.id));
          currentWave = [];
          currentResources = { cpu: 0, memory: 0, storage: 0 };
        }
        
        currentWave.push(job);
        currentResources.cpu += job.resourceRequirements.cpu;
        currentResources.memory += job.resourceRequirements.memory;
        currentResources.storage += job.resourceRequirements.storage;
      }
    }
    
    if (currentWave.length > 0) {
      waves.push(currentWave);
    }
    
    console.log(`📋 Planned ${waves.length} execution waves`);
    return waves;
  }
  
  private async executeJobsInParallel(
    jobs: BatchJob[],
    config: BatchConfig,
    resourcePlan: BatchJob[][],
    step: WorkflowStep
  ): Promise<JobResult[]> {
    const results: JobResult[] = [];
    const completed = new Set<string>();
    
    for (let waveIndex = 0; waveIndex < resourcePlan.length; waveIndex++) {
      const wave = resourcePlan[waveIndex];
      console.log(`🌊 Executing wave ${waveIndex + 1}/${resourcePlan.length} with ${wave.length} jobs`);
      
      // Execute jobs in current wave in parallel
      const wavePromises = wave.map(async (job) => {
        return await step.do(`execute-job-${job.id}`, async () => {
          return await this.executeSingleJob(job, config);
        });
      });
      
      const waveResults = await Promise.allSettled(wavePromises);
      
      // Process wave results
      for (let i = 0; i < waveResults.length; i++) {
        const result = waveResults[i];
        const job = wave[i];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
          completed.add(job.id);
          
          if (result.value.status === 'completed') {
            console.log(`✅ Job completed: ${job.id}`);
          } else {
            console.log(`❌ Job failed: ${job.id} - ${result.value.error}`);
            
            // Handle failure based on retry policy
            if (config.retryPolicy === 'fail-fast') {
              throw new Error(`Job ${job.id} failed and retry policy is fail-fast`);
            }
          }
        } else {
          console.error(`💥 Job execution error: ${job.id}`, result.reason);
          
          const failedResult: JobResult = {
            jobId: job.id,
            status: 'failed',
            error: result.reason?.message || 'Unknown error',
            executionTime: 0,
            resourceUsage: { cpu: 0, memory: 0, storage: 0 },
            retryCount: 0,
            completedAt: new Date().toISOString()
          };
          
          results.push(failedResult);
          completed.add(job.id);
        }
      }
      
      // Update progress
      const progress = (completed.size / jobs.length) * 100;
      console.log(`📊 Progress: ${progress.toFixed(1)}% (${completed.size}/${jobs.length})`);
    }
    
    return results;
  }
  
  private async executeeSingleJob(job: BatchJob, config: BatchConfig): Promise<JobResult> {
    const startTime = Date.now();
    let retryCount = 0;
    
    while (retryCount <= job.retryConfig.maxRetries) {
      try {
        console.log(`🏃 Executing job: ${job.id} (attempt ${retryCount + 1})`);
        
        // Simulate job execution based on type
        const result = await this.processJobByType(job);
        
        const executionTime = Date.now() - startTime;
        
        return {
          jobId: job.id,
          status: 'completed',
          result,
          executionTime: executionTime / 1000,
          resourceUsage: job.resourceRequirements,
          retryCount,
          completedAt: new Date().toISOString()
        };
        
      } catch (error) {
        retryCount++;
        console.log(`⚠️ Job ${job.id} failed (attempt ${retryCount}): ${error}`);
        
        if (retryCount <= job.retryConfig.maxRetries) {
          const backoffMs = Math.min(
            1000 * Math.pow(job.retryConfig.backoffMultiplier, retryCount - 1),
            job.retryConfig.maxBackoffMs
          );
          
          console.log(`⏳ Retrying job ${job.id} in ${backoffMs}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    // All retries exhausted
    const executionTime = Date.now() - startTime;
    
    return {
      jobId: job.id,
      status: 'failed',
      error: `Job failed after ${job.retryConfig.maxRetries} retries`,
      executionTime: executionTime / 1000,
      resourceUsage: job.resourceRequirements,
      retryCount,
      completedAt: new Date().toISOString()
    };
  }
  
  private async processJobByType(job: BatchJob): Promise<any> {
    // Simulate different job types with realistic processing times
    const processingTime = Math.random() * job.estimatedDuration * 1000;
    
    switch (job.type) {
      case 'video-processing':
        await new Promise(resolve => setTimeout(resolve, processingTime));
        return {
          processedVideoUrl: `https://r2.bucket.dev/processed/${job.id}.mp4`,
          thumbnails: [`thumb1.jpg`, `thumb2.jpg`, `thumb3.jpg`],
          duration: 120,
          resolution: '1920x1080'
        };
        
      case 'document-generation':
        await new Promise(resolve => setTimeout(resolve, processingTime));
        return {
          documentUrl: `https://r2.bucket.dev/docs/${job.id}.pdf`,
          pages: 15,
          signatures: [],
          status: 'generated'
        };
        
      case 'ai-analysis':
        await new Promise(resolve => setTimeout(resolve, processingTime));
        return {
          sentiment: 0.75,
          keywords: ['innovation', 'technology', 'growth'],
          summary: 'Positive analysis with high growth potential',
          confidence: 0.92
        };
        
      case 'data-migration':
        await new Promise(resolve => setTimeout(resolve, processingTime));
        return {
          migratedRecords: Math.floor(Math.random() * 10000),
          errors: [],
          status: 'completed'
        };
        
      case 'bulk-update':
        await new Promise(resolve => setTimeout(resolve, processingTime));
        return {
          updatedRecords: Math.floor(Math.random() * 5000),
          skipped: Math.floor(Math.random() * 100),
          status: 'completed'
        };
        
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }
  
  private processJobResults(results: JobResult[], config: BatchConfig): BatchStatus {
    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const successRate = (completed / results.length) * 100;
    
    const status: BatchStatus = {
      batchId: config.batchId,
      status: successRate >= config.completionThreshold ? 'completed' : 'failed',
      totalJobs: results.length,
      completedJobs: completed,
      failedJobs: failed,
      runningJobs: 0,
      pendingJobs: 0,
      progress: 100,
      completedAt: new Date().toISOString(),
      resourceUsage: {
        cpu: results.reduce((sum, r) => sum + r.resourceUsage.cpu, 0),
        memory: results.reduce((sum, r) => sum + r.resourceUsage.memory, 0),
        storage: results.reduce((sum, r) => sum + r.resourceUsage.storage, 0)
      },
      errors: results.filter(r => r.status === 'failed').map(r => r.error || 'Unknown error')
    };
    
    return status;
  }
  
  private async cleanupResources(batchId: string): Promise<void> {
    console.log(`🧹 Cleaning up resources for batch: ${batchId}`);
    
    // Cleanup temporary files, release locks, etc.
    // Implementation would depend on specific resource types
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate cleanup
  }
  
  private async sendNotifications(status: BatchStatus, config: BatchConfig): Promise<void> {
    const notifications = [];
    
    if (config.notificationConfig.webhookUrl) {
      notifications.push(this.sendWebhookNotification(status, config.notificationConfig.webhookUrl));
    }
    
    if (config.notificationConfig.emailNotifications) {
      notifications.push(this.sendEmailNotification(status));
    }
    
    if (config.notificationConfig.slackChannel) {
      notifications.push(this.sendSlackNotification(status, config.notificationConfig.slackChannel));
    }
    
    await Promise.allSettled(notifications);
  }
  
  private async sendFailureNotification(config: BatchConfig, error: Error): Promise<void> {
    console.error(`📧 Sending failure notification for batch: ${config.batchId}`);
    
    const failureData = {
      batchId: config.batchId,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    // Send notifications (implementation would call external services)
    await Promise.resolve(failureData);
  }
  
  private async sendWebhookNotification(status: BatchStatus, webhookUrl: string): Promise<void> {
    console.log(`📡 Sending webhook notification: ${webhookUrl}`);
    
    // Implementation would make HTTP POST to webhook URL
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'batch_completed',
        data: status
      })
    });
  }
  
  private async sendEmailNotification(status: BatchStatus): Promise<void> {
    console.log(`📧 Sending email notification for batch: ${status.batchId}`);
    
    // Implementation would use email service
    await Promise.resolve();
  }
  
  private async sendSlackNotification(status: BatchStatus, channel: string): Promise<void> {
    console.log(`💬 Sending Slack notification to: ${channel}`);
    
    // Implementation would use Slack API
    await Promise.resolve();
  }
}

export default BatchProcessingWorkflow;