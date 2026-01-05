/**
 * Container Orchestrator Durable Object
 * Manages container lifecycle and job distribution
 */

export class ContainerOrchestrator {
  private state: DurableObjectState;
  private env: any;
  private activeContainers: Map<string, ContainerInfo>;
  private jobQueue: JobRequest[];

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.activeContainers = new Map();
    this.jobQueue = [];
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/container/start':
          return await this.startContainer(request);
        case '/container/stop':
          return await this.stopContainer(request);
        case '/container/status':
          return await this.getContainerStatus(request);
        case '/job/submit':
          return await this.submitJob(request);
        case '/job/status':
          return await this.getJobStatus(request);
        case '/metrics':
          return await this.getMetrics();
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

  private async startContainer(request: Request): Promise<Response> {
    const { containerType, config } = await request.json() as any;
    
    const containerId = crypto.randomUUID();
    const containerInfo: ContainerInfo = {
      id: containerId,
      type: containerType,
      status: 'starting',
      startedAt: new Date().toISOString(),
      config
    };

    this.activeContainers.set(containerId, containerInfo);
    await this.state.storage.put(`container:${containerId}`, containerInfo);

    // Simulate container startup
    setTimeout(async () => {
      containerInfo.status = 'running';
      await this.state.storage.put(`container:${containerId}`, containerInfo);
    }, 2000);

    return new Response(JSON.stringify({ containerId, status: 'starting' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async stopContainer(request: Request): Promise<Response> {
    const { containerId } = await request.json() as any;
    
    const container = this.activeContainers.get(containerId);
    if (!container) {
      return new Response(JSON.stringify({ error: 'Container not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    container.status = 'stopping';
    container.stoppedAt = new Date().toISOString();
    
    await this.state.storage.put(`container:${containerId}`, container);
    this.activeContainers.delete(containerId);

    return new Response(JSON.stringify({ containerId, status: 'stopped' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getContainerStatus(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const containerId = url.searchParams.get('id');

    if (!containerId) {
      // Return all containers
      const containers = Array.from(this.activeContainers.values());
      return new Response(JSON.stringify(containers), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const container = this.activeContainers.get(containerId);
    if (!container) {
      return new Response(JSON.stringify({ error: 'Container not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(container), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async submitJob(request: Request): Promise<Response> {
    const jobRequest = await request.json() as JobRequest;
    
    const jobId = crypto.randomUUID();
    const job: JobInfo = {
      id: jobId,
      ...jobRequest,
      status: 'queued',
      submittedAt: new Date().toISOString()
    };

    this.jobQueue.push(jobRequest);
    await this.state.storage.put(`job:${jobId}`, job);

    // Find available container for job
    const availableContainer = this.findAvailableContainer(jobRequest.type);
    if (availableContainer) {
      await this.assignJobToContainer(job, availableContainer);
    }

    return new Response(JSON.stringify({ jobId, status: 'queued' }), {
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

    const job = await this.state.storage.get<JobInfo>(`job:${jobId}`);
    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(job), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getMetrics(): Promise<Response> {
    const metrics = {
      activeContainers: this.activeContainers.size,
      queuedJobs: this.jobQueue.length,
      containerTypes: this.getContainerTypeMetrics(),
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(metrics), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private findAvailableContainer(jobType: string): ContainerInfo | null {
    for (const container of this.activeContainers.values()) {
      if (container.type === jobType && container.status === 'running') {
        return container;
      }
    }
    return null;
  }

  private async assignJobToContainer(job: JobInfo, container: ContainerInfo): Promise<void> {
    job.status = 'assigned';
    job.containerId = container.id;
    job.assignedAt = new Date().toISOString();
    
    await this.state.storage.put(`job:${job.id}`, job);
    
    // Remove from queue
    const index = this.jobQueue.findIndex(j => j.id === job.id);
    if (index > -1) {
      this.jobQueue.splice(index, 1);
    }
  }

  private getContainerTypeMetrics(): Record<string, number> {
    const metrics: Record<string, number> = {};
    for (const container of this.activeContainers.values()) {
      metrics[container.type] = (metrics[container.type] || 0) + 1;
    }
    return metrics;
  }
}

interface ContainerInfo {
  id: string;
  type: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  startedAt: string;
  stoppedAt?: string;
  config: any;
}

interface JobRequest {
  id?: string;
  type: string;
  payload: any;
  priority?: number;
}

interface JobInfo extends JobRequest {
  id: string;
  status: 'queued' | 'assigned' | 'running' | 'completed' | 'failed';
  submittedAt: string;
  assignedAt?: string;
  completedAt?: string;
  containerId?: string;
  result?: any;
  error?: string;
}