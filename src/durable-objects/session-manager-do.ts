/**
 * SessionManagerDO - Manage long-running container sessions
 * Handles persistent container sessions with automatic scaling and resource management
 */

import type { Env } from '../worker-integrated';

export interface ContainerSession {
  id: string;
  userId: string;
  containerId: string;
  sessionType: 'interactive' | 'batch' | 'streaming' | 'api' | 'development';
  status: 'initializing' | 'active' | 'idle' | 'hibernating' | 'terminating' | 'terminated' | 'failed';
  createdAt: Date;
  lastActivity: Date;
  expiresAt?: Date;
  configuration: SessionConfiguration;
  resources: ResourceAllocation;
  metrics: SessionMetrics;
  connections: SessionConnection[];
  persistence: SessionPersistence;
  scaling: AutoScalingConfig;
  security: SessionSecurity;
  events: SessionEvent[];
}

export interface SessionConfiguration {
  maxIdleTime: number; // milliseconds
  maxDuration: number; // milliseconds
  autoHibernate: boolean;
  hibernateAfter: number; // milliseconds of inactivity
  autoScale: boolean;
  persistData: boolean;
  allowMultipleConnections: boolean;
  environment: Record<string, string>;
  ports: number[];
  volumes: string[];
  network: {
    bandwidth: number;
    allowedIPs?: string[];
    publicAccess: boolean;
  };
}

export interface ResourceAllocation {
  cpu: {
    allocated: number; // cores
    limit: number;
    usage: number; // percentage
    throttled: boolean;
  };
  memory: {
    allocated: number; // bytes
    limit: number;
    usage: number; // bytes
    swapUsage: number;
  };
  disk: {
    allocated: number; // bytes
    limit: number;
    usage: number; // bytes
    iops: number;
  };
  network: {
    bandwidthUp: number; // bytes/sec
    bandwidthDown: number; // bytes/sec
    connections: number;
    packetsIn: number;
    packetsOut: number;
  };
  gpu?: {
    allocated: number;
    usage: number;
    memoryUsage: number;
  };
}

export interface SessionMetrics {
  totalRequests: number;
  activeConnections: number;
  dataProcessed: number; // bytes
  errorRate: number; // percentage
  responseTime: number; // milliseconds average
  uptime: number; // milliseconds
  costAccrued: number; // USD
  lastUpdated: Date;
  performance: {
    throughput: number; // requests per second
    latency: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
    availability: number; // percentage
  };
}

export interface SessionConnection {
  id: string;
  type: 'websocket' | 'http' | 'tcp' | 'udp' | 'ssh';
  clientIP: string;
  userAgent?: string;
  connectedAt: Date;
  lastActivity: Date;
  bytesTransferred: number;
  status: 'active' | 'idle' | 'closed';
  metadata: Record<string, any>;
}

export interface SessionPersistence {
  enabled: boolean;
  snapshotInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  lastSnapshot?: Date;
  snapshotSize?: number; // bytes
  backupEnabled: boolean;
  backupInterval?: number;
  restorePoint?: {
    id: string;
    timestamp: Date;
    size: number;
    checksum: string;
  };
}

export interface AutoScalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilization: number;
  targetMemoryUtilization: number;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  cooldownPeriod: number; // seconds
  metrics: {
    requestsPerSecond?: number;
    responseTime?: number;
    errorRate?: number;
  };
}

export interface SessionSecurity {
  encryption: {
    inTransit: boolean;
    atRest: boolean;
    algorithm: string;
  };
  authentication: {
    required: boolean;
    method: 'token' | 'certificate' | 'oauth' | 'basic';
    expiresAt?: Date;
  };
  authorization: {
    policies: string[];
    roles: string[];
    permissions: string[];
  };
  networking: {
    firewallEnabled: boolean;
    allowedPorts: number[];
    blockedIPs: string[];
    vpnRequired: boolean;
  };
  monitoring: {
    auditLogging: boolean;
    intrustionDetection: boolean;
    anomalyDetection: boolean;
  };
}

export interface SessionEvent {
  id: string;
  timestamp: Date;
  type: 'created' | 'started' | 'scaled' | 'hibernated' | 'resumed' | 'failed' | 'terminated';
  description: string;
  metadata?: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ScalingDecision {
  action: 'scale_up' | 'scale_down' | 'maintain';
  reason: string;
  currentReplicas: number;
  targetReplicas: number;
  confidence: number;
  metrics: Record<string, number>;
}

/**
 * Session Manager Durable Object
 * Manages long-running container sessions with persistence and auto-scaling
 */
export class SessionManagerDO implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private env: Env;
  
  // In-memory state
  private sessions: Map<string, ContainerSession> = new Map();
  private activeConnections: Map<string, WebSocket[]> = new Map();
  private hibernatedSessions: Set<string> = new Set();
  
  // Background tasks
  private cleanupInterval?: number;
  private metricsInterval?: number;
  private scalingInterval?: number;
  private snapshotInterval?: number;
  
  // Configuration
  private defaultConfig: SessionConfiguration = {
    maxIdleTime: 30 * 60 * 1000, // 30 minutes
    maxDuration: 8 * 60 * 60 * 1000, // 8 hours
    autoHibernate: true,
    hibernateAfter: 15 * 60 * 1000, // 15 minutes
    autoScale: false,
    persistData: false,
    allowMultipleConnections: true,
    environment: {},
    ports: [8080],
    volumes: [],
    network: {
      bandwidth: 100 * 1024 * 1024, // 100 MB/s
      publicAccess: false
    }
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.env = env;
    
    this.initializeSessionManager();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      switch (true) {
        case method === 'POST' && path === '/sessions':
          return this.createSession(request);
        
        case method === 'GET' && path.startsWith('/sessions/'):
          return this.getSession(path.split('/')[2]);
        
        case method === 'PUT' && path.startsWith('/sessions/'):
          return this.updateSession(path.split('/')[2], request);
        
        case method === 'DELETE' && path.startsWith('/sessions/'):
          return this.terminateSession(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/hibernate'):
          return this.hibernateSession(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/resume'):
          return this.resumeSession(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/scale'):
          return this.scaleSession(path.split('/')[2], request);
        
        case method === 'POST' && path.endsWith('/snapshot'):
          return this.createSnapshot(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/restore'):
          return this.restoreSession(path.split('/')[2], request);
        
        case method === 'GET' && path.endsWith('/connections'):
          return this.getConnections(path.split('/')[2]);
        
        case method === 'POST' && path.endsWith('/connect'):
          return this.handleConnection(path.split('/')[2], request);
        
        case method === 'GET' && path === '/sessions':
          return this.listSessions(url.searchParams);
        
        case method === 'GET' && path === '/metrics':
          return this.getMetrics();
        
        case method === 'POST' && path === '/cleanup':
          return this.cleanup();
        
        case method === 'GET' && path === '/health':
          return this.getHealth();
        
        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('SessionManagerDO error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Create a new container session
   */
  private async createSession(request: Request): Promise<Response> {
    const data = await request.json() as {
      id?: string;
      userId?: string;
      containerId?: string;
      sessionType?: ContainerSession['sessionType'];
      expiresAt?: string;
      configuration?: Partial<SessionConfiguration>;
      resources?: Partial<ResourceAllocation>;
      persistence?: Partial<SessionPersistence>;
      scaling?: Partial<AutoScalingConfig>;
      security?: Partial<SessionSecurity>;
    };
    const sessionId = data.id || crypto.randomUUID();

    const session: ContainerSession = {
      id: sessionId,
      userId: data.userId || '',
      containerId: data.containerId || '',
      sessionType: data.sessionType || 'interactive',
      status: 'initializing',
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      configuration: { ...this.defaultConfig, ...(data.configuration || {}) },
      resources: this.initializeResources(data.resources),
      metrics: this.initializeMetrics(),
      connections: [],
      persistence: this.initializePersistence(data.persistence),
      scaling: this.initializeScaling(data.scaling),
      security: this.initializeSecurity(data.security),
      events: []
    };

    // Allocate resources for the session
    await this.allocateResources(session);
    
    // Initialize container if needed
    await this.initializeContainer(session);
    
    // Save session
    await this.saveSession(session);
    
    // Add initial event
    await this.addSessionEvent(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'created',
      description: `Session created for user ${session.userId}`,
      severity: 'info'
    });

    // Start session monitoring
    this.startSessionMonitoring(sessionId);

    session.status = 'active';
    await this.saveSession(session);

    return Response.json({
      success: true,
      session: this.sanitizeSession(session),
      message: 'Session created successfully'
    });
  }

  /**
   * Get session details
   */
  private async getSession(sessionId: string): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    // Update session activity
    session.lastActivity = new Date();
    await this.saveSession(session);

    return Response.json({
      success: true,
      session: this.sanitizeSession(session)
    });
  }

  /**
   * Update session configuration
   */
  private async updateSession(sessionId: string, request: Request): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const updates = await request.json() as {
      configuration?: Partial<SessionConfiguration>;
      resources?: Partial<ResourceAllocation>;
      scaling?: Partial<AutoScalingConfig>;
    };

    // Update configuration
    if (updates.configuration) {
      session.configuration = { ...session.configuration, ...updates.configuration };
    }

    // Update resources if needed
    if (updates.resources) {
      await this.updateResources(session, updates.resources);
    }

    // Update scaling configuration
    if (updates.scaling) {
      session.scaling = { ...session.scaling, ...updates.scaling };
    }

    session.lastActivity = new Date();
    await this.saveSession(session);

    await this.addSessionEvent(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'scaled',
      description: 'Session configuration updated',
      severity: 'info',
      metadata: { updates }
    });

    return Response.json({
      success: true,
      session: this.sanitizeSession(session),
      message: 'Session updated successfully'
    });
  }

  /**
   * Hibernate a session to save resources
   */
  private async hibernateSession(sessionId: string): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    if (session.status === 'hibernating') {
      return Response.json({
        success: true,
        message: 'Session already hibernating'
      });
    }

    // Create snapshot if persistence is enabled
    if (session.persistence.enabled) {
      await this.createSessionSnapshot(session);
    }

    // Close active connections
    const connections = this.activeConnections.get(sessionId) || [];
    for (const ws of connections) {
      ws.close(1000, 'Session hibernating');
    }
    this.activeConnections.delete(sessionId);

    // Release resources
    await this.releaseResources(session);

    session.status = 'hibernating';
    session.lastActivity = new Date();
    this.hibernatedSessions.add(sessionId);
    
    await this.saveSession(session);

    await this.addSessionEvent(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'hibernated',
      description: 'Session hibernated to save resources',
      severity: 'info'
    });

    return Response.json({
      success: true,
      message: 'Session hibernated successfully'
    });
  }

  /**
   * Resume a hibernated session
   */
  private async resumeSession(sessionId: string): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    if (session.status !== 'hibernating') {
      return Response.json({
        success: true,
        message: 'Session is not hibernating'
      });
    }

    // Restore from snapshot if available
    if (session.persistence.enabled && session.persistence.restorePoint) {
      await this.restoreFromSnapshot(session);
    }

    // Reallocate resources
    await this.allocateResources(session);

    // Reinitialize container
    await this.initializeContainer(session);

    session.status = 'active';
    session.lastActivity = new Date();
    this.hibernatedSessions.delete(sessionId);
    
    await this.saveSession(session);

    // Restart monitoring
    this.startSessionMonitoring(sessionId);

    await this.addSessionEvent(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'resumed',
      description: 'Session resumed from hibernation',
      severity: 'info'
    });

    return Response.json({
      success: true,
      session: this.sanitizeSession(session),
      message: 'Session resumed successfully'
    });
  }

  /**
   * Scale session resources
   */
  private async scaleSession(sessionId: string, request: Request): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const body = await request.json() as { action?: string; replicas?: number };
    const { action, replicas } = body;
    
    const decision = await this.makeScalingDecision(session, action, replicas);
    
    if (decision.action !== 'maintain') {
      await this.executeScalingDecision(session, decision);
      
      session.lastActivity = new Date();
      await this.saveSession(session);

      await this.addSessionEvent(sessionId, {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        type: 'scaled',
        description: `Session scaled ${decision.action}: ${decision.currentReplicas} -> ${decision.targetReplicas}`,
        severity: 'info',
        metadata: { decision }
      });
    }

    return Response.json({
      success: true,
      scalingDecision: decision,
      message: `Scaling ${decision.action} completed`
    });
  }

  /**
   * Handle WebSocket connections to sessions
   */
  private async handleConnection(sessionId: string, request: Request): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    if (session.status === 'hibernating') {
      // Auto-resume hibernated sessions
      await this.resumeSession(sessionId);
    }

    const { 0: client, 1: server } = new WebSocketPair();

    // Accept the WebSocket connection
    this.state.acceptWebSocket(server);

    // Create connection record
    const connection: SessionConnection = {
      id: crypto.randomUUID(),
      type: 'websocket',
      clientIP: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || undefined,
      connectedAt: new Date(),
      lastActivity: new Date(),
      bytesTransferred: 0,
      status: 'active',
      metadata: {}
    };

    session.connections.push(connection);
    session.lastActivity = new Date();
    session.metrics.activeConnections++;

    // Store WebSocket connection
    if (!this.activeConnections.has(sessionId)) {
      this.activeConnections.set(sessionId, []);
    }
    this.activeConnections.get(sessionId)!.push(server);

    await this.saveSession(session);

    // Set up WebSocket handlers
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(sessionId, connection.id, event);
    });

    server.addEventListener('close', () => {
      this.handleWebSocketClose(sessionId, connection.id);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Create session snapshot
   */
  private async createSnapshot(sessionId: string): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const snapshot = await this.createSessionSnapshot(session);

    return Response.json({
      success: true,
      snapshot: {
        id: snapshot.id,
        timestamp: snapshot.timestamp,
        size: snapshot.size
      },
      message: 'Snapshot created successfully'
    });
  }

  /**
   * List sessions with filtering
   */
  private async listSessions(params: URLSearchParams): Promise<Response> {
    const userId = params.get('userId');
    const status = params.get('status');
    const sessionType = params.get('sessionType');
    const limit = parseInt(params.get('limit') || '50');

    const allSessions = await this.storage.list({ prefix: 'session:' });
    const sessions: ContainerSession[] = [];

    for (const [key, value] of allSessions) {
      const session = value as ContainerSession;
      
      // Apply filters
      if (userId && session.userId !== userId) continue;
      if (status && session.status !== status) continue;
      if (sessionType && session.sessionType !== sessionType) continue;
      
      sessions.push(this.sanitizeSession(session) as ContainerSession);
    }

    // Sort by last activity
    sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    // Apply pagination
    const paginatedSessions = sessions.slice(0, limit);

    return Response.json({
      success: true,
      sessions: paginatedSessions,
      total: sessions.length,
      limit
    });
  }

  /**
   * Get aggregated metrics
   */
  private async getMetrics(): Promise<Response> {
    const allSessions = Array.from(this.sessions.values());
    
    const metrics = {
      totalSessions: allSessions.length,
      activeSessions: allSessions.filter(s => s.status === 'active').length,
      hibernatingSessions: allSessions.filter(s => s.status === 'hibernating').length,
      totalConnections: allSessions.reduce((sum, s) => sum + s.metrics.activeConnections, 0),
      totalCost: allSessions.reduce((sum, s) => sum + s.metrics.costAccrued, 0),
      avgResponseTime: this.calculateAverageResponseTime(allSessions),
      resourceUtilization: this.calculateResourceUtilization(allSessions),
      scalingEvents: await this.getScalingEventCount(),
      uptimePercentage: this.calculateUptimePercentage(allSessions)
    };

    return Response.json({
      success: true,
      metrics
    });
  }

  /**
   * Initialize session manager
   */
  private async initializeSessionManager(): Promise<void> {
    // Load existing sessions
    const storedSessions = await this.storage.list({ prefix: 'session:' });
    
    for (const [key, session] of storedSessions) {
      const sessionData = session as ContainerSession;
      this.sessions.set(sessionData.id, sessionData);
      
      // Check if session should be hibernated or terminated
      if (sessionData.status === 'hibernating') {
        this.hibernatedSessions.add(sessionData.id);
      } else if (this.shouldTerminateSession(sessionData)) {
        await this.terminateSessionInternal(sessionData.id);
      } else {
        this.startSessionMonitoring(sessionData.id);
      }
    }

    // Start background tasks
    this.startBackgroundTasks();
  }

  /**
   * Start background monitoring tasks
   */
  private startBackgroundTasks(): void {
    // Cleanup task every 5 minutes
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.error('Cleanup task failed:', error);
      }
    }, 5 * 60 * 1000) as any;

    // Metrics update every minute
    this.metricsInterval = setInterval(async () => {
      try {
        await this.updateAllMetrics();
      } catch (error) {
        console.error('Metrics update failed:', error);
      }
    }, 60 * 1000) as any;

    // Auto-scaling check every 30 seconds
    this.scalingInterval = setInterval(async () => {
      try {
        await this.performAutoScaling();
      } catch (error) {
        console.error('Auto-scaling failed:', error);
      }
    }, 30 * 1000) as any;

    // Snapshot creation for persistent sessions
    this.snapshotInterval = setInterval(async () => {
      try {
        await this.performSnapshots();
      } catch (error) {
        console.error('Snapshot creation failed:', error);
      }
    }, 10 * 60 * 1000) as any; // 10 minutes
  }

  /**
   * Monitor individual session
   */
  private startSessionMonitoring(sessionId: string): void {
    const interval = setInterval(async () => {
      const session = await this.loadSession(sessionId);
      if (!session || session.status === 'terminated') {
        clearInterval(interval);
        return;
      }

      // Check for auto-hibernation
      if (this.shouldHibernateSession(session)) {
        await this.hibernateSession(sessionId);
        clearInterval(interval);
        return;
      }

      // Check for session expiration
      if (this.shouldTerminateSession(session)) {
        await this.terminateSessionInternal(sessionId);
        clearInterval(interval);
        return;
      }

      // Update metrics
      await this.updateSessionMetrics(session);

    }, 30 * 1000); // Check every 30 seconds
  }

  /**
   * Helper methods for resource management
   */
  private initializeResources(resourceConfig?: Partial<ResourceAllocation>): ResourceAllocation {
    return {
      cpu: {
        allocated: resourceConfig?.cpu?.allocated || 1,
        limit: resourceConfig?.cpu?.limit || 2,
        usage: 0,
        throttled: false
      },
      memory: {
        allocated: resourceConfig?.memory?.allocated || 1024 * 1024 * 1024, // 1GB
        limit: resourceConfig?.memory?.limit || 2 * 1024 * 1024 * 1024, // 2GB
        usage: 0,
        swapUsage: 0
      },
      disk: {
        allocated: resourceConfig?.disk?.allocated || 10 * 1024 * 1024 * 1024, // 10GB
        limit: resourceConfig?.disk?.limit || 50 * 1024 * 1024 * 1024, // 50GB
        usage: 0,
        iops: 0
      },
      network: {
        bandwidthUp: 0,
        bandwidthDown: 0,
        connections: 0,
        packetsIn: 0,
        packetsOut: 0
      }
    };
  }

  private initializeMetrics(): SessionMetrics {
    return {
      totalRequests: 0,
      activeConnections: 0,
      dataProcessed: 0,
      errorRate: 0,
      responseTime: 0,
      uptime: 0,
      costAccrued: 0,
      lastUpdated: new Date(),
      performance: {
        throughput: 0,
        latency: { p50: 0, p90: 0, p95: 0, p99: 0 },
        availability: 100
      }
    };
  }

  private initializePersistence(config?: Partial<SessionPersistence>): SessionPersistence {
    return {
      enabled: config?.enabled || false,
      snapshotInterval: config?.snapshotInterval || 5 * 60 * 1000, // 5 minutes
      retentionPeriod: config?.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      backupEnabled: config?.backupEnabled || false
    };
  }

  private initializeScaling(config?: Partial<AutoScalingConfig>): AutoScalingConfig {
    return {
      enabled: config?.enabled || false,
      minReplicas: config?.minReplicas || 1,
      maxReplicas: config?.maxReplicas || 10,
      targetCPUUtilization: config?.targetCPUUtilization || 70,
      targetMemoryUtilization: config?.targetMemoryUtilization || 80,
      scaleUpThreshold: config?.scaleUpThreshold || 80,
      scaleDownThreshold: config?.scaleDownThreshold || 30,
      cooldownPeriod: config?.cooldownPeriod || 300, // 5 minutes
      metrics: config?.metrics || {}
    };
  }

  private initializeSecurity(config?: Partial<SessionSecurity>): SessionSecurity {
    return {
      encryption: {
        inTransit: config?.encryption?.inTransit || true,
        atRest: config?.encryption?.atRest || false,
        algorithm: config?.encryption?.algorithm || 'AES-256'
      },
      authentication: {
        required: config?.authentication?.required || true,
        method: config?.authentication?.method || 'token'
      },
      authorization: {
        policies: config?.authorization?.policies || [],
        roles: config?.authorization?.roles || [],
        permissions: config?.authorization?.permissions || []
      },
      networking: {
        firewallEnabled: config?.networking?.firewallEnabled || true,
        allowedPorts: config?.networking?.allowedPorts || [80, 443, 8080],
        blockedIPs: config?.networking?.blockedIPs || [],
        vpnRequired: config?.networking?.vpnRequired || false
      },
      monitoring: {
        auditLogging: config?.monitoring?.auditLogging || true,
        intrustionDetection: config?.monitoring?.intrustionDetection || false,
        anomalyDetection: config?.monitoring?.anomalyDetection || false
      }
    };
  }

  private shouldHibernateSession(session: ContainerSession): boolean {
    if (!session.configuration.autoHibernate) return false;
    
    const inactiveTime = Date.now() - session.lastActivity.getTime();
    return inactiveTime > session.configuration.hibernateAfter;
  }

  private shouldTerminateSession(session: ContainerSession): boolean {
    const age = Date.now() - session.createdAt.getTime();
    
    // Check maximum duration
    if (age > session.configuration.maxDuration) return true;
    
    // Check expiration time
    if (session.expiresAt && new Date() > session.expiresAt) return true;
    
    // Check idle time
    const idleTime = Date.now() - session.lastActivity.getTime();
    if (idleTime > session.configuration.maxIdleTime) return true;
    
    return false;
  }

  // Placeholder implementations for external operations
  private async allocateResources(session: ContainerSession): Promise<void> {
    console.log(`Allocating resources for session ${session.id}`);
  }

  private async releaseResources(session: ContainerSession): Promise<void> {
    console.log(`Releasing resources for session ${session.id}`);
  }

  private async initializeContainer(session: ContainerSession): Promise<void> {
    console.log(`Initializing container for session ${session.id}`);
  }

  private async createSessionSnapshot(session: ContainerSession): Promise<any> {
    const snapshot = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      size: Math.random() * 1024 * 1024 * 100, // Random size up to 100MB
      checksum: 'sha256_' + crypto.randomUUID()
    };
    
    session.persistence.restorePoint = snapshot;
    session.persistence.lastSnapshot = snapshot.timestamp;
    
    return snapshot;
  }

  private async restoreFromSnapshot(session: ContainerSession): Promise<void> {
    console.log(`Restoring session ${session.id} from snapshot`);
  }

  private async makeScalingDecision(session: ContainerSession, action?: string, replicas?: number): Promise<ScalingDecision> {
    if (!session.scaling.enabled) {
      return {
        action: 'maintain',
        reason: 'Auto-scaling disabled',
        currentReplicas: 1,
        targetReplicas: 1,
        confidence: 1.0,
        metrics: {}
      };
    }

    // Simple scaling logic based on CPU utilization
    const cpuUsage = session.resources.cpu.usage;
    
    if (cpuUsage > session.scaling.scaleUpThreshold) {
      return {
        action: 'scale_up',
        reason: `CPU usage ${cpuUsage}% above threshold ${session.scaling.scaleUpThreshold}%`,
        currentReplicas: 1,
        targetReplicas: Math.min(2, session.scaling.maxReplicas),
        confidence: 0.8,
        metrics: { cpuUsage }
      };
    }
    
    if (cpuUsage < session.scaling.scaleDownThreshold) {
      return {
        action: 'scale_down',
        reason: `CPU usage ${cpuUsage}% below threshold ${session.scaling.scaleDownThreshold}%`,
        currentReplicas: 1,
        targetReplicas: Math.max(1, session.scaling.minReplicas),
        confidence: 0.8,
        metrics: { cpuUsage }
      };
    }

    return {
      action: 'maintain',
      reason: 'Resource usage within normal range',
      currentReplicas: 1,
      targetReplicas: 1,
      confidence: 0.9,
      metrics: { cpuUsage }
    };
  }

  private async executeScalingDecision(session: ContainerSession, decision: ScalingDecision): Promise<void> {
    console.log(`Executing scaling decision for session ${session.id}:`, decision);
  }

  private async updateSessionMetrics(session: ContainerSession): Promise<void> {
    // Simulate metrics update
    session.metrics.totalRequests += Math.floor(Math.random() * 10);
    session.metrics.responseTime = 50 + Math.random() * 100;
    session.metrics.uptime = Date.now() - session.createdAt.getTime();
    session.metrics.lastUpdated = new Date();
    
    // Update resource usage
    session.resources.cpu.usage = Math.random() * 100;
    session.resources.memory.usage = session.resources.memory.allocated * (0.3 + Math.random() * 0.4);
    session.resources.disk.usage = session.resources.disk.allocated * (0.1 + Math.random() * 0.3);
    
    await this.saveSession(session);
  }

  private async performCleanup(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.status === 'terminated' && session.lastActivity < cutoff) {
        await this.storage.delete(`session:${sessionId}`);
        this.sessions.delete(sessionId);
      }
    }
  }

  private async updateAllMetrics(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        await this.updateSessionMetrics(session);
      }
    }
  }

  private async performAutoScaling(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.scaling.enabled && session.status === 'active') {
        const decision = await this.makeScalingDecision(session);
        if (decision.action !== 'maintain') {
          await this.executeScalingDecision(session, decision);
        }
      }
    }
  }

  private async performSnapshots(): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.persistence.enabled && session.status === 'active') {
        const timeSinceSnapshot = session.persistence.lastSnapshot ? 
          Date.now() - session.persistence.lastSnapshot.getTime() : Infinity;
        
        if (timeSinceSnapshot > session.persistence.snapshotInterval) {
          await this.createSessionSnapshot(session);
        }
      }
    }
  }

  private handleWebSocketMessage(sessionId: string, connectionId: string, event: MessageEvent): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = new Date();
    session.metrics.totalRequests++;
    
    const connection = session.connections.find(c => c.id === connectionId);
    if (connection) {
      connection.lastActivity = new Date();
      connection.bytesTransferred += new TextEncoder().encode(event.data as string).length;
    }
  }

  private handleWebSocketClose(sessionId: string, connectionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update connection status
    const connection = session.connections.find(c => c.id === connectionId);
    if (connection) {
      connection.status = 'closed';
    }

    // Update metrics
    session.metrics.activeConnections = Math.max(0, session.metrics.activeConnections - 1);

    // Remove from active connections
    const connections = this.activeConnections.get(sessionId) || [];
    this.activeConnections.set(sessionId, connections.filter(ws => ws.readyState === WebSocket.OPEN));
  }

  private calculateAverageResponseTime(sessions: ContainerSession[]): number {
    const activeSessions = sessions.filter(s => s.status === 'active');
    if (activeSessions.length === 0) return 0;
    
    return activeSessions.reduce((sum, s) => sum + s.metrics.responseTime, 0) / activeSessions.length;
  }

  private calculateResourceUtilization(sessions: ContainerSession[]): any {
    const activeSessions = sessions.filter(s => s.status === 'active');
    if (activeSessions.length === 0) return { cpu: 0, memory: 0, disk: 0 };
    
    return {
      cpu: activeSessions.reduce((sum, s) => sum + s.resources.cpu.usage, 0) / activeSessions.length,
      memory: activeSessions.reduce((sum, s) => sum + (s.resources.memory.usage / s.resources.memory.allocated * 100), 0) / activeSessions.length,
      disk: activeSessions.reduce((sum, s) => sum + (s.resources.disk.usage / s.resources.disk.allocated * 100), 0) / activeSessions.length
    };
  }

  private async getScalingEventCount(): Promise<number> {
    let count = 0;
    for (const session of this.sessions.values()) {
      count += session.events.filter(e => e.type === 'scaled').length;
    }
    return count;
  }

  private calculateUptimePercentage(sessions: ContainerSession[]): number {
    if (sessions.length === 0) return 100;
    
    const totalUptime = sessions.reduce((sum, s) => sum + s.metrics.uptime, 0);
    const totalPossibleUptime = sessions.reduce((sum, s) => sum + (Date.now() - s.createdAt.getTime()), 0);
    
    return totalPossibleUptime > 0 ? (totalUptime / totalPossibleUptime) * 100 : 100;
  }

  private async terminateSessionInternal(sessionId: string): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    // Close connections
    const connections = this.activeConnections.get(sessionId) || [];
    for (const ws of connections) {
      ws.close(1000, 'Session terminated');
    }
    this.activeConnections.delete(sessionId);

    // Release resources
    await this.releaseResources(session);

    session.status = 'terminated';
    session.lastActivity = new Date();
    
    await this.saveSession(session);

    await this.addSessionEvent(sessionId, {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      type: 'terminated',
      description: 'Session terminated',
      severity: 'info'
    });
  }

  private async updateResources(session: ContainerSession, updates: Partial<ResourceAllocation>): Promise<void> {
    // Update resource allocation
    if (updates.cpu) {
      session.resources.cpu = { ...session.resources.cpu, ...updates.cpu };
    }
    if (updates.memory) {
      session.resources.memory = { ...session.resources.memory, ...updates.memory };
    }
    if (updates.disk) {
      session.resources.disk = { ...session.resources.disk, ...updates.disk };
    }
  }

  private async getConnections(sessionId: string): Promise<Response> {
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const activeConnections = session.connections.filter(c => c.status === 'active');

    return Response.json({
      success: true,
      connections: activeConnections,
      count: activeConnections.length
    });
  }

  private async terminateSession(sessionId: string): Promise<Response> {
    await this.terminateSessionInternal(sessionId);

    return Response.json({
      success: true,
      message: 'Session terminated successfully'
    });
  }

  private async restoreSession(sessionId: string, request: Request): Promise<Response> {
    const body = await request.json() as { snapshotId?: string };
    const { snapshotId } = body;
    const session = await this.loadSession(sessionId);
    
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    // Restore from specific snapshot
    await this.restoreFromSnapshot(session);

    return Response.json({
      success: true,
      message: `Session restored from snapshot ${snapshotId}`
    });
  }

  private async cleanup(): Promise<Response> {
    await this.performCleanup();

    return Response.json({
      success: true,
      message: 'Cleanup completed'
    });
  }

  private async getHealth(): Promise<Response> {
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');
    const health = {
      status: 'healthy',
      activeSessions: activeSessions.length,
      hibernatedSessions: this.hibernatedSessions.size,
      totalSessions: this.sessions.size,
      issues: [] as string[]
    };

    // Check for issues
    if (activeSessions.length > 100) {
      health.issues.push('High number of active sessions');
    }

    const avgResponseTime = this.calculateAverageResponseTime(activeSessions);
    if (avgResponseTime > 1000) {
      health.issues.push('High average response time');
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
   * Storage helper methods
   */
  private async loadSession(sessionId: string): Promise<ContainerSession | null> {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const session = await this.storage.get<ContainerSession>(`session:${sessionId}`);
    if (session) {
      this.sessions.set(sessionId, session);
      return session;
    }

    return null;
  }

  private async saveSession(session: ContainerSession): Promise<void> {
    await this.storage.put(`session:${session.id}`, session);
    this.sessions.set(session.id, session);
  }

  private async addSessionEvent(sessionId: string, event: SessionEvent): Promise<void> {
    const session = await this.loadSession(sessionId);
    if (!session) return;

    session.events.push(event);
    
    // Keep only last 100 events
    if (session.events.length > 100) {
      session.events = session.events.slice(-100);
    }

    await this.saveSession(session);
  }

  private sanitizeSession(session: ContainerSession): Partial<ContainerSession> {
    return {
      id: session.id,
      userId: session.userId,
      containerId: session.containerId,
      sessionType: session.sessionType,
      status: session.status,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      expiresAt: session.expiresAt,
      metrics: session.metrics,
      connections: session.connections.slice(-10), // Last 10 connections only
      events: session.events.slice(-10) // Last 10 events only
    };
  }
}