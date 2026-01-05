/**
 * ContainerStateDO - Track container instance lifecycle, health, and metrics
 * Manages the complete state of container instances with persistence and recovery
 */

export interface ContainerState {
  id: string;
  name: string;
  status: 'pending' | 'starting' | 'running' | 'stopping' | 'stopped' | 'failed' | 'terminated';
  createdAt: Date;
  startedAt?: Date;
  stoppedAt?: Date;
  lastHealthCheck?: Date;
  health: {
    status: 'healthy' | 'unhealthy' | 'unknown';
    lastCheck: Date;
    checkCount: number;
    failureCount: number;
    response?: {
      statusCode: number;
      responseTime: number;
    };
  };
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    networkIn: number;
    networkOut: number;
    requests: number;
    errors: number;
    lastUpdated: Date;
  };
  configuration: {
    image: string;
    cpu: number;
    memory: number;
    disk: number;
    env: Record<string, string>;
    ports: number[];
    labels: Record<string, string>;
  };
  events: ContainerEvent[];
}

export interface ContainerEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'started' | 'stopped' | 'health_check' | 'metrics_update' | 'error' | 'warning';
  message: string;
  data?: Record<string, any>;
}

export interface HealthCheckRequest {
  path?: string;
  interval?: number;
  timeout?: number;
  retries?: number;
}

/**
 * Container State Durable Object
 * Provides centralized state management for container instances
 */
export class ContainerStateDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;
  
  // In-memory cache for frequently accessed data
  private containerCache: Map<string, ContainerState> = new Map();
  private healthCheckIntervals: Map<string, number> = new Map();
  private metricsInterval?: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    // Initialize periodic tasks
    this.initializePeriodicTasks();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (true) {
        case method === 'POST' && path === '/containers':
          return this.createContainer(request);
        
        case method === 'GET' && path.startsWith('/containers/'):
          return this.getContainer(path.split('/')[2]);
        
        case method === 'PUT' && path.startsWith('/containers/'):
          return this.updateContainer(path.split('/')[2], request);
        
        case method === 'DELETE' && path.startsWith('/containers/'):
          return this.deleteContainer(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/start'):
          return this.startContainer(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/stop'):
          return this.stopContainer(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/health'):
          return this.updateHealth(path.split('/')[2], request);
        
        case method === 'POST' && path.endsWith('/metrics'):
          return this.updateMetrics(path.split('/')[2], request);
        
        case method === 'GET' && path === '/containers':
          return this.listContainers(url.searchParams);
        
        case method === 'GET' && path === '/health':
          return this.getHealthSummary();
        
        case method === 'GET' && path === '/metrics':
          return this.getMetricsSummary();
        
        case method === 'POST' && path === '/cleanup':
          return this.cleanup();
        
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('ContainerStateDO error:', error);
      return new Response(JSON.stringify({ 
        error: error.message 
      }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Create new container instance
   */
  private async createContainer(request: Request): Promise<Response> {
    const data = await request.json();
    const containerId = data.id || crypto.randomUUID();
    
    const container: ContainerState = {
      id: containerId,
      name: data.name,
      status: 'pending',
      createdAt: new Date(),
      health: {
        status: 'unknown',
        lastCheck: new Date(),
        checkCount: 0,
        failureCount: 0
      },
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkIn: 0,
        networkOut: 0,
        requests: 0,
        errors: 0,
        lastUpdated: new Date()
      },
      configuration: data.configuration,
      events: []
    };

    await this.saveContainer(container);
    await this.addEvent(containerId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'created',
      message: `Container ${container.name} created`,
      data: { configuration: data.configuration }
    });

    // Setup health checks if configured
    if (data.healthCheck) {
      await this.setupHealthCheck(containerId, data.healthCheck);
    }

    return Response.json({
      success: true,
      container: await this.sanitizeContainer(container)
    });
  }

  /**
   * Get container state
   */
  private async getContainer(containerId: string): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    return Response.json({
      success: true,
      container: await this.sanitizeContainer(container)
    });
  }

  /**
   * Update container configuration or state
   */
  private async updateContainer(containerId: string, request: Request): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    const updates = await request.json();
    
    // Update configuration if provided
    if (updates.configuration) {
      container.configuration = { ...container.configuration, ...updates.configuration };
      
      await this.addEvent(containerId, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'warning',
        message: 'Container configuration updated',
        data: { updates: updates.configuration }
      });
    }

    // Update status if provided
    if (updates.status && updates.status !== container.status) {
      const oldStatus = container.status;
      container.status = updates.status;
      
      if (updates.status === 'running' && !container.startedAt) {
        container.startedAt = new Date();
      } else if (['stopped', 'failed', 'terminated'].includes(updates.status)) {
        container.stoppedAt = new Date();
      }

      await this.addEvent(containerId, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'warning',
        message: `Status changed from ${oldStatus} to ${updates.status}`,
        data: { oldStatus, newStatus: updates.status }
      });
    }

    await this.saveContainer(container);

    return Response.json({
      success: true,
      container: await this.sanitizeContainer(container)
    });
  }

  /**
   * Start container
   */
  private async startContainer(containerId: string): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    if (container.status === 'running') {
      return Response.json({
        success: true,
        message: 'Container already running'
      });
    }

    container.status = 'starting';
    container.startedAt = new Date();
    
    await this.saveContainer(container);
    await this.addEvent(containerId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'started',
      message: `Container ${container.name} starting`
    });

    // Simulate container start (in production this would call container runtime API)
    setTimeout(async () => {
      const updatedContainer = await this.loadContainer(containerId);
      if (updatedContainer && updatedContainer.status === 'starting') {
        updatedContainer.status = 'running';
        await this.saveContainer(updatedContainer);
        
        await this.addEvent(containerId, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'started',
          message: `Container ${updatedContainer.name} running`
        });
      }
    }, 2000);

    return Response.json({
      success: true,
      message: 'Container start initiated'
    });
  }

  /**
   * Stop container
   */
  private async stopContainer(containerId: string): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    if (container.status === 'stopped') {
      return Response.json({
        success: true,
        message: 'Container already stopped'
      });
    }

    container.status = 'stopping';
    container.stoppedAt = new Date();
    
    await this.saveContainer(container);
    await this.addEvent(containerId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'stopped',
      message: `Container ${container.name} stopping`
    });

    // Clear health check interval
    const intervalId = this.healthCheckIntervals.get(containerId);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthCheckIntervals.delete(containerId);
    }

    // Simulate container stop
    setTimeout(async () => {
      const updatedContainer = await this.loadContainer(containerId);
      if (updatedContainer && updatedContainer.status === 'stopping') {
        updatedContainer.status = 'stopped';
        await this.saveContainer(updatedContainer);
        
        await this.addEvent(containerId, {
          id: crypto.randomUUID(),
          timestamp: new Date(),
          type: 'stopped',
          message: `Container ${updatedContainer.name} stopped`
        });
      }
    }, 1000);

    return Response.json({
      success: true,
      message: 'Container stop initiated'
    });
  }

  /**
   * Update health status
   */
  private async updateHealth(containerId: string, request: Request): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    const healthData = await request.json();
    const now = new Date();
    
    container.health = {
      status: healthData.healthy ? 'healthy' : 'unhealthy',
      lastCheck: now,
      checkCount: container.health.checkCount + 1,
      failureCount: healthData.healthy ? 
        Math.max(0, container.health.failureCount - 1) : 
        container.health.failureCount + 1,
      response: healthData.response
    };
    
    container.lastHealthCheck = now;

    await this.saveContainer(container);

    // Add event for unhealthy status
    if (!healthData.healthy) {
      await this.addEvent(containerId, {
        id: crypto.randomUUID(),
        timestamp: now,
        type: 'warning',
        message: `Health check failed`,
        data: { 
          failureCount: container.health.failureCount,
          response: healthData.response
        }
      });
    }

    return Response.json({
      success: true,
      health: container.health
    });
  }

  /**
   * Update metrics
   */
  private async updateMetrics(containerId: string, request: Request): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    const metricsData = await request.json();
    const now = new Date();
    
    container.metrics = {
      ...container.metrics,
      ...metricsData,
      lastUpdated: now
    };

    await this.saveContainer(container);

    // Check for threshold alerts
    await this.checkMetricsAlerts(container);

    return Response.json({
      success: true,
      metrics: container.metrics
    });
  }

  /**
   * List containers with filtering
   */
  private async listContainers(params: URLSearchParams): Promise<Response> {
    const status = params.get('status');
    const name = params.get('name');
    const limit = parseInt(params.get('limit') || '50');
    const offset = parseInt(params.get('offset') || '0');

    const allContainers = await this.storage.list({ prefix: 'container:' });
    const containers: ContainerState[] = [];

    for (const [key, value] of allContainers) {
      const container = value as ContainerState;
      
      // Apply filters
      if (status && container.status !== status) continue;
      if (name && !container.name.includes(name)) continue;
      
      containers.push(await this.sanitizeContainer(container));
    }

    // Apply pagination
    const paginatedContainers = containers.slice(offset, offset + limit);

    return Response.json({
      success: true,
      containers: paginatedContainers,
      total: containers.length,
      offset,
      limit
    });
  }

  /**
   * Get health summary for all containers
   */
  private async getHealthSummary(): Promise<Response> {
    const allContainers = await this.storage.list({ prefix: 'container:' });
    const summary = {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      unknown: 0,
      running: 0,
      stopped: 0,
      failed: 0
    };

    for (const [_, container] of allContainers) {
      const state = container as ContainerState;
      summary.total++;
      summary[state.health.status]++;
      
      if (state.status === 'running') summary.running++;
      else if (state.status === 'stopped') summary.stopped++;
      else if (state.status === 'failed') summary.failed++;
    }

    return Response.json({
      success: true,
      summary
    });
  }

  /**
   * Get metrics summary
   */
  private async getMetricsSummary(): Promise<Response> {
    const allContainers = await this.storage.list({ prefix: 'container:' });
    const summary = {
      totalContainers: 0,
      totalCpuUsage: 0,
      totalMemoryUsage: 0,
      totalDiskUsage: 0,
      totalRequests: 0,
      totalErrors: 0,
      averageResponseTime: 0,
      lastUpdated: new Date()
    };

    let responseTimeSum = 0;
    let responseTimeCount = 0;

    for (const [_, container] of allContainers) {
      const state = container as ContainerState;
      summary.totalContainers++;
      summary.totalCpuUsage += state.metrics.cpuUsage;
      summary.totalMemoryUsage += state.metrics.memoryUsage;
      summary.totalDiskUsage += state.metrics.diskUsage;
      summary.totalRequests += state.metrics.requests;
      summary.totalErrors += state.metrics.errors;
      
      if (state.health.response?.responseTime) {
        responseTimeSum += state.health.response.responseTime;
        responseTimeCount++;
      }
    }

    if (responseTimeCount > 0) {
      summary.averageResponseTime = responseTimeSum / responseTimeCount;
    }

    return Response.json({
      success: true,
      summary
    });
  }

  /**
   * Cleanup terminated containers
   */
  private async cleanup(): Promise<Response> {
    const allContainers = await this.storage.list({ prefix: 'container:' });
    const cleanupThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    let cleanedCount = 0;

    for (const [key, container] of allContainers) {
      const state = container as ContainerState;
      
      if (state.status === 'terminated' && 
          state.stoppedAt && 
          state.stoppedAt < cleanupThreshold) {
        
        await this.storage.delete(key);
        this.containerCache.delete(state.id);
        cleanedCount++;
      }
    }

    return Response.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} terminated containers`
    });
  }

  /**
   * Load container from storage with caching
   */
  private async loadContainer(containerId: string): Promise<ContainerState | null> {
    // Check cache first
    if (this.containerCache.has(containerId)) {
      return this.containerCache.get(containerId)!;
    }

    // Load from storage
    const container = await this.storage.get<ContainerState>(`container:${containerId}`);
    
    if (container) {
      this.containerCache.set(containerId, container);
      return container;
    }

    return null;
  }

  /**
   * Save container to storage and update cache
   */
  private async saveContainer(container: ContainerState): Promise<void> {
    await this.storage.put(`container:${container.id}`, container);
    this.containerCache.set(container.id, container);
  }

  /**
   * Add event to container history
   */
  private async addEvent(containerId: string, event: ContainerEvent): Promise<void> {
    const container = await this.loadContainer(containerId);
    if (!container) return;

    container.events.push(event);
    
    // Keep only last 100 events
    if (container.events.length > 100) {
      container.events = container.events.slice(-100);
    }

    await this.saveContainer(container);
    
    // Also store events separately for querying
    await this.storage.put(`event:${containerId}:${event.id}`, event);
  }

  /**
   * Setup health check interval
   */
  private async setupHealthCheck(containerId: string, config: HealthCheckRequest): Promise<void> {
    const interval = config.interval || 30000; // 30 seconds default
    
    const intervalId = setInterval(async () => {
      const container = await this.loadContainer(containerId);
      if (!container || container.status !== 'running') {
        clearInterval(intervalId);
        this.healthCheckIntervals.delete(containerId);
        return;
      }

      // Perform health check (simulate)
      const healthy = Math.random() > 0.1; // 90% success rate
      
      await this.updateHealth(containerId, new Request('http://localhost', {
        method: 'POST',
        body: JSON.stringify({
          healthy,
          response: {
            statusCode: healthy ? 200 : 500,
            responseTime: Math.random() * 100 + 50
          }
        })
      }));
    }, interval);

    this.healthCheckIntervals.set(containerId, intervalId as any);
  }

  /**
   * Check for metrics alerts
   */
  private async checkMetricsAlerts(container: ContainerState): Promise<void> {
    const alerts: string[] = [];
    
    if (container.metrics.cpuUsage > 80) {
      alerts.push(`High CPU usage: ${container.metrics.cpuUsage}%`);
    }
    
    if (container.metrics.memoryUsage > 85) {
      alerts.push(`High memory usage: ${container.metrics.memoryUsage}%`);
    }
    
    if (container.metrics.diskUsage > 90) {
      alerts.push(`High disk usage: ${container.metrics.diskUsage}%`);
    }

    if (alerts.length > 0) {
      await this.addEvent(container.id, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'warning',
        message: `Resource alerts: ${alerts.join(', ')}`,
        data: { alerts, metrics: container.metrics }
      });
    }
  }

  /**
   * Initialize periodic maintenance tasks
   */
  private initializePeriodicTasks(): void {
    // Cleanup task every hour
    this.metricsInterval = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }, 60 * 60 * 1000) as any;
  }

  /**
   * Sanitize container for external access (remove sensitive data)
   */
  private async sanitizeContainer(container: ContainerState): Promise<Partial<ContainerState>> {
    return {
      id: container.id,
      name: container.name,
      status: container.status,
      createdAt: container.createdAt,
      startedAt: container.startedAt,
      stoppedAt: container.stoppedAt,
      lastHealthCheck: container.lastHealthCheck,
      health: container.health,
      metrics: container.metrics,
      configuration: {
        ...container.configuration,
        env: {} // Remove environment variables for security
      },
      events: container.events.slice(-10) // Only last 10 events
    };
  }

  /**
   * Delete container and cleanup resources
   */
  private async deleteContainer(containerId: string): Promise<Response> {
    const container = await this.loadContainer(containerId);
    
    if (!container) {
      return new Response('Container not found', { status: 404 });
    }

    // Stop container if running
    if (container.status === 'running') {
      await this.stopContainer(containerId);
    }

    // Clear health check interval
    const intervalId = this.healthCheckIntervals.get(containerId);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthCheckIntervals.delete(containerId);
    }

    // Remove from storage and cache
    await this.storage.delete(`container:${containerId}`);
    this.containerCache.delete(containerId);

    // Remove events
    const events = await this.storage.list({ prefix: `event:${containerId}:` });
    for (const [key] of events) {
      await this.storage.delete(key);
    }

    return Response.json({
      success: true,
      message: `Container ${container.name} deleted`
    });
  }
}