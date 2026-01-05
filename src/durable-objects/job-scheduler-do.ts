/**
 * Job Scheduler Durable Object
 * Manages scheduled jobs and cron-like tasks
 */

export class JobScheduler {
  private state: DurableObjectState;
  private env: any;
  private scheduledJobs: Map<string, ScheduledJob>;
  private activeJobs: Map<string, ActiveJob>;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.scheduledJobs = new Map();
    this.activeJobs = new Map();
    
    // Initialize from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.list();
      stored.forEach((value, key) => {
        if (key.toString().startsWith('scheduled:')) {
          this.scheduledJobs.set(key.toString().replace('scheduled:', ''), value as ScheduledJob);
        }
      });
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/schedule':
          return await this.scheduleJob(request);
        case '/cancel':
          return await this.cancelJob(request);
        case '/list':
          return await this.listJobs();
        case '/trigger':
          return await this.triggerJob(request);
        case '/status':
          return await this.getJobStatus(request);
        case '/history':
          return await this.getJobHistory(request);
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async alarm(): Promise<void> {
    // Check and execute scheduled jobs
    const now = Date.now();
    
    for (const [jobId, job] of this.scheduledJobs) {
      if (this.shouldExecuteJob(job, now)) {
        await this.executeJob(jobId, job);
        
        // Update next run time if recurring
        if (job.recurring) {
          job.lastRun = now;
          job.nextRun = this.calculateNextRun(job);
          await this.state.storage.put(`scheduled:${jobId}`, job);
        } else {
          // Remove one-time jobs after execution
          this.scheduledJobs.delete(jobId);
          await this.state.storage.delete(`scheduled:${jobId}`);
        }
      }
    }

    // Schedule next alarm
    const nextAlarmTime = this.getNextAlarmTime();
    if (nextAlarmTime) {
      await this.state.storage.setAlarm(nextAlarmTime);
    }
  }

  private async scheduleJob(request: Request): Promise<Response> {
    const jobConfig = await request.json() as ScheduledJobConfig;
    
    const jobId = crypto.randomUUID();
    const scheduledJob: ScheduledJob = {
      id: jobId,
      name: jobConfig.name,
      type: jobConfig.type,
      schedule: jobConfig.schedule,
      payload: jobConfig.payload,
      recurring: jobConfig.recurring !== false,
      enabled: true,
      createdAt: new Date().toISOString(),
      nextRun: this.calculateNextRun(jobConfig)
    };

    this.scheduledJobs.set(jobId, scheduledJob);
    await this.state.storage.put(`scheduled:${jobId}`, scheduledJob);

    // Set alarm for next execution
    if (scheduledJob.nextRun) {
      const currentAlarm = await this.state.storage.getAlarm();
      if (!currentAlarm || scheduledJob.nextRun < currentAlarm) {
        await this.state.storage.setAlarm(scheduledJob.nextRun);
      }
    }

    return new Response(JSON.stringify({ jobId, scheduled: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async cancelJob(request: Request): Promise<Response> {
    const { jobId } = await request.json() as any;
    
    if (!this.scheduledJobs.has(jobId)) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    this.scheduledJobs.delete(jobId);
    await this.state.storage.delete(`scheduled:${jobId}`);

    return new Response(JSON.stringify({ jobId, cancelled: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async listJobs(): Promise<Response> {
    const jobs = Array.from(this.scheduledJobs.values()).map(job => ({
      ...job,
      active: this.activeJobs.has(job.id)
    }));

    return new Response(JSON.stringify(jobs), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async triggerJob(request: Request): Promise<Response> {
    const { jobId } = await request.json() as any;
    
    const job = this.scheduledJobs.get(jobId);
    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const executionId = await this.executeJob(jobId, job);
    
    return new Response(JSON.stringify({ jobId, executionId, triggered: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getJobStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');

    if (!jobId) {
      return new Response(JSON.stringify({ error: 'Job ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const scheduled = this.scheduledJobs.get(jobId);
    const active = this.activeJobs.get(jobId);
    
    if (!scheduled && !active) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      scheduled,
      active,
      isRunning: !!active
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getJobHistory(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const jobId = url.searchParams.get('id');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    let historyKey = jobId ? `history:${jobId}:*` : 'history:*';
    const history = await this.state.storage.list({ prefix: historyKey, limit });

    const entries = Array.from(history.entries()).map(([key, value]) => ({
      key: key.toString(),
      ...(value as any)
    }));

    return new Response(JSON.stringify(entries), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async executeJob(jobId: string, job: ScheduledJob): Promise<string> {
    const executionId = crypto.randomUUID();
    
    const activeJob: ActiveJob = {
      id: executionId,
      jobId,
      startedAt: new Date().toISOString(),
      status: 'running'
    };

    this.activeJobs.set(jobId, activeJob);

    try {
      // Execute job based on type
      let result: any;
      switch (job.type) {
        case 'container':
          result = await this.executeContainerJob(job);
          break;
        case 'webhook':
          result = await this.executeWebhookJob(job);
          break;
        case 'queue':
          result = await this.executeQueueJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      activeJob.status = 'completed';
      activeJob.completedAt = new Date().toISOString();
      activeJob.result = result;
    } catch (error: any) {
      activeJob.status = 'failed';
      activeJob.completedAt = new Date().toISOString();
      activeJob.error = error.message;
    }

    // Store in history
    await this.state.storage.put(`history:${jobId}:${executionId}`, activeJob);
    
    // Remove from active jobs
    this.activeJobs.delete(jobId);

    return executionId;
  }

  private async executeContainerJob(job: ScheduledJob): Promise<any> {
    // Submit job to container orchestrator
    const orchestratorId = this.env.CONTAINER_ORCHESTRATOR.idFromName('main');
    const orchestrator = this.env.CONTAINER_ORCHESTRATOR.get(orchestratorId);
    
    const response = await orchestrator.fetch(
      new Request('https://orchestrator/job/submit', {
        method: 'POST',
        body: JSON.stringify(job.payload)
      })
    );
    
    return await response.json();
  }

  private async executeWebhookJob(job: ScheduledJob): Promise<any> {
    const { url, method = 'POST', headers = {}, body } = job.payload;
    
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    
    return {
      status: response.status,
      statusText: response.statusText
    };
  }

  private async executeQueueJob(job: ScheduledJob): Promise<any> {
    const { queueName, message } = job.payload;
    
    if (this.env[queueName]) {
      await this.env[queueName].send(message);
      return { queued: true };
    } else {
      throw new Error(`Queue ${queueName} not found`);
    }
  }

  private shouldExecuteJob(job: ScheduledJob, now: number): boolean {
    if (!job.enabled) return false;
    if (!job.nextRun) return false;
    return now >= job.nextRun;
  }

  private calculateNextRun(job: ScheduledJobConfig | ScheduledJob): number | null {
    if (!job.schedule) return null;

    const now = Date.now();
    
    // Handle cron expression
    if (job.schedule.includes(' ')) {
      // Simple cron parser (would need full implementation)
      return this.parseCronExpression(job.schedule, now);
    }

    // Handle interval (e.g., "5m", "1h", "24h")
    const match = job.schedule.match(/^(\d+)([smhd])$/);
    if (match) {
      const [, value, unit] = match;
      const multipliers: Record<string, number> = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
      };
      return now + parseInt(value) * multipliers[unit];
    }

    return null;
  }

  private parseCronExpression(cron: string, after: number): number | null {
    // Simplified cron parser - in production would use a proper library
    // For now, just schedule 5 minutes from now
    return after + 5 * 60 * 1000;
  }

  private getNextAlarmTime(): number | null {
    let nextTime: number | null = null;
    
    for (const job of this.scheduledJobs.values()) {
      if (job.enabled && job.nextRun) {
        if (!nextTime || job.nextRun < nextTime) {
          nextTime = job.nextRun;
        }
      }
    }
    
    return nextTime;
  }
}

interface ScheduledJobConfig {
  name: string;
  type: 'container' | 'webhook' | 'queue';
  schedule: string; // cron expression or interval
  payload: any;
  recurring?: boolean;
}

interface ScheduledJob extends ScheduledJobConfig {
  id: string;
  enabled: boolean;
  createdAt: string;
  lastRun?: number;
  nextRun: number | null;
}

interface ActiveJob {
  id: string;
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}