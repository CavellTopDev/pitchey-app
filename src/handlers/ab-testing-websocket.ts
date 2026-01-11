// A/B Testing WebSocket Handler for Real-time Updates
import { WorkerDatabase } from '../services/worker-database';

interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId?: number;
  userType?: string;
  subscribedExperiments: Set<number>;
  lastPing: number;
}

interface ABTestingWebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong' | 'experiment-update' | 'experiment-event';
  experimentId?: number;
  data?: any;
  timestamp?: number;
}

export class ABTestingWebSocketHandler {
  private db: WorkerDatabase;
  private connections: Map<string, WebSocketConnection> = new Map();
  private experimentSubscribers: Map<number, Set<string>> = new Map();
  private pingInterval: number = 30000; // 30 seconds

  constructor(db: WorkerDatabase) {
    this.db = db;
    
    // Start ping interval to keep connections alive
    setInterval(() => {
      this.pingConnections();
    }, this.pingInterval);
  }

  // Handle new WebSocket connection
  handleConnection(webSocket: WebSocket, request: Request): void {
    const connectionId = this.generateConnectionId();
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const userType = url.searchParams.get('userType');

    const connection: WebSocketConnection = {
      id: connectionId,
      socket: webSocket,
      userId: userId ? parseInt(userId) : undefined,
      userType: userType || undefined,
      subscribedExperiments: new Set(),
      lastPing: Date.now()
    };

    this.connections.set(connectionId, connection);

    // Set up event listeners
    webSocket.addEventListener('message', (event) => {
      this.handleMessage(connectionId, event.data);
    });

    webSocket.addEventListener('close', () => {
      this.handleDisconnection(connectionId);
    });

    webSocket.addEventListener('error', (error) => {
      console.error('WebSocket error for connection', connectionId, error);
      this.handleDisconnection(connectionId);
    });

    // Send welcome message
    this.sendMessage(connectionId, {
      type: 'connected',
      data: { connectionId },
      timestamp: Date.now()
    });

    console.log(`New A/B testing WebSocket connection: ${connectionId}`);
  }

  // Handle incoming messages
  private handleMessage(connectionId: string, message: string): void {
    try {
      const data: ABTestingWebSocketMessage = JSON.parse(message);
      const connection = this.connections.get(connectionId);

      if (!connection) {
        console.warn('Message from unknown connection:', connectionId);
        return;
      }

      switch (data.type) {
        case 'subscribe':
          this.handleSubscribe(connectionId, data.experimentId);
          break;

        case 'unsubscribe':
          this.handleUnsubscribe(connectionId, data.experimentId);
          break;

        case 'ping':
          this.handlePing(connectionId);
          break;

        case 'experiment-event':
          this.handleExperimentEvent(connectionId, data);
          break;

        default:
          console.warn('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Handle experiment subscription
  private handleSubscribe(connectionId: string, experimentId?: number): void {
    if (!experimentId) {
      this.sendError(connectionId, 'Invalid experiment ID');
      return;
    }

    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Add to experiment subscribers
    connection.subscribedExperiments.add(experimentId);
    
    if (!this.experimentSubscribers.has(experimentId)) {
      this.experimentSubscribers.set(experimentId, new Set());
    }
    this.experimentSubscribers.get(experimentId)!.add(connectionId);

    // Send current experiment data
    this.sendExperimentData(connectionId, experimentId);

    this.sendMessage(connectionId, {
      type: 'subscribed',
      experimentId,
      timestamp: Date.now()
    });

    console.log(`Connection ${connectionId} subscribed to experiment ${experimentId}`);
  }

  // Handle experiment unsubscription
  private handleUnsubscribe(connectionId: string, experimentId?: number): void {
    if (!experimentId) {
      this.sendError(connectionId, 'Invalid experiment ID');
      return;
    }

    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from experiment subscribers
    connection.subscribedExperiments.delete(experimentId);
    this.experimentSubscribers.get(experimentId)?.delete(connectionId);

    this.sendMessage(connectionId, {
      type: 'unsubscribed',
      experimentId,
      timestamp: Date.now()
    });

    console.log(`Connection ${connectionId} unsubscribed from experiment ${experimentId}`);
  }

  // Handle ping message
  private handlePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = Date.now();
      this.sendMessage(connectionId, {
        type: 'pong',
        timestamp: Date.now()
      });
    }
  }

  // Handle experiment event from client
  private handleExperimentEvent(connectionId: string, data: ABTestingWebSocketMessage): void {
    // Broadcast event to other subscribers
    if (data.experimentId) {
      this.broadcastToExperiment(data.experimentId, {
        type: 'experiment-event',
        experimentId: data.experimentId,
        data: data.data,
        timestamp: Date.now()
      }, connectionId);
    }
  }

  // Handle connection disconnection
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from all experiment subscriptions
    connection.subscribedExperiments.forEach(experimentId => {
      this.experimentSubscribers.get(experimentId)?.delete(connectionId);
    });

    // Remove connection
    this.connections.delete(connectionId);

    console.log(`A/B testing WebSocket connection closed: ${connectionId}`);
  }

  // Send current experiment data to subscriber
  private async sendExperimentData(connectionId: string, experimentId: number): Promise<void> {
    try {
      // Get experiment details
      const experimentResult = await this.db.query(`
        SELECT * FROM experiments WHERE id = $1
      `, [experimentId]);

      if (experimentResult.rows.length === 0) {
        this.sendError(connectionId, 'Experiment not found');
        return;
      }

      // Get current metrics
      const metricsResult = await this.db.query(`
        SELECT 
          ev.variant_id,
          ev.name as variant_name,
          ev.is_control,
          COUNT(DISTINCT COALESCE(ee.user_id::text, ee.session_id)) as participants,
          COUNT(*) FILTER (WHERE ee.event_type = 'conversion') as conversions
        FROM experiment_variants ev
        LEFT JOIN experiment_events ee ON ev.experiment_id = ee.experiment_id AND ev.variant_id = ee.variant_id
        WHERE ev.experiment_id = $1
        GROUP BY ev.variant_id, ev.name, ev.is_control
        ORDER BY ev.is_control DESC, ev.variant_id
      `, [experimentId]);

      const experiment = experimentResult.rows[0];
      const metrics = metricsResult.rows.map(row => ({
        variantId: row.variant_id,
        variantName: row.variant_name,
        isControl: row.is_control,
        participants: parseInt(row.participants) || 0,
        conversions: parseInt(row.conversions) || 0,
        conversionRate: parseInt(row.participants) > 0 ? (parseInt(row.conversions) || 0) / (parseInt(row.participants) || 1) : 0
      }));

      this.sendMessage(connectionId, {
        type: 'experiment-data',
        experimentId,
        data: {
          experiment: {
            id: experiment.id,
            name: experiment.name,
            status: experiment.status,
            startDate: experiment.started_at
          },
          metrics,
          lastUpdated: new Date().toISOString()
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error sending experiment data:', error);
      this.sendError(connectionId, 'Failed to fetch experiment data');
    }
  }

  // Broadcast message to all subscribers of an experiment
  public broadcastToExperiment(experimentId: number, message: ABTestingWebSocketMessage, excludeConnectionId?: string): void {
    const subscribers = this.experimentSubscribers.get(experimentId);
    if (!subscribers) {
      return;
    }

    subscribers.forEach(connectionId => {
      if (connectionId !== excludeConnectionId) {
        this.sendMessage(connectionId, message);
      }
    });
  }

  // Broadcast experiment update to subscribers
  public broadcastExperimentUpdate(experimentId: number, updateType: string, data: any): void {
    this.broadcastToExperiment(experimentId, {
      type: 'experiment-update',
      experimentId,
      data: {
        updateType,
        ...data
      },
      timestamp: Date.now()
    });
  }

  // Broadcast new event to subscribers
  public broadcastExperimentEvent(experimentId: number, variantId: string, eventType: string, eventData?: any): void {
    this.broadcastToExperiment(experimentId, {
      type: 'experiment-event',
      experimentId,
      data: {
        variantId,
        eventType,
        eventData,
        timestamp: Date.now()
      },
      timestamp: Date.now()
    });

    // Also update metrics if this is a conversion
    if (eventType === 'conversion') {
      this.updateRealTimeMetrics(experimentId);
    }
  }

  // Update real-time metrics for an experiment
  private async updateRealTimeMetrics(experimentId: number): Promise<void> {
    try {
      const metricsResult = await this.db.query(`
        SELECT 
          ev.variant_id,
          ev.name as variant_name,
          ev.is_control,
          COUNT(DISTINCT COALESCE(ee.user_id::text, ee.session_id)) as participants,
          COUNT(*) FILTER (WHERE ee.event_type = 'conversion') as conversions
        FROM experiment_variants ev
        LEFT JOIN experiment_events ee ON ev.experiment_id = ee.experiment_id AND ev.variant_id = ee.variant_id
        WHERE ev.experiment_id = $1
        GROUP BY ev.variant_id, ev.name, ev.is_control
        ORDER BY ev.is_control DESC, ev.variant_id
      `, [experimentId]);

      const metrics = metricsResult.rows.map(row => ({
        variantId: row.variant_id,
        variantName: row.variant_name,
        isControl: row.is_control,
        participants: parseInt(row.participants) || 0,
        conversions: parseInt(row.conversions) || 0,
        conversionRate: parseInt(row.participants) > 0 ? (parseInt(row.conversions) || 0) / (parseInt(row.participants) || 1) : 0
      }));

      this.broadcastToExperiment(experimentId, {
        type: 'metrics-update',
        experimentId,
        data: {
          metrics,
          lastUpdated: new Date().toISOString()
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('Error updating real-time metrics:', error);
    }
  }

  // Send message to specific connection
  private sendMessage(connectionId: string, message: any): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      connection.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      this.handleDisconnection(connectionId);
    }
  }

  // Send error message to connection
  private sendError(connectionId: string, error: string): void {
    this.sendMessage(connectionId, {
      type: 'error',
      data: { error },
      timestamp: Date.now()
    });
  }

  // Ping all connections to keep them alive
  private pingConnections(): void {
    const now = Date.now();
    const staleConnections: string[] = [];

    this.connections.forEach((connection, connectionId) => {
      // Check if connection is stale (no ping for 2 minutes)
      if (now - connection.lastPing > 120000) {
        staleConnections.push(connectionId);
        return;
      }

      // Send ping to active connections
      if (connection.socket.readyState === WebSocket.OPEN) {
        this.sendMessage(connectionId, {
          type: 'ping',
          timestamp: now
        });
      } else {
        staleConnections.push(connectionId);
      }
    });

    // Clean up stale connections
    staleConnections.forEach(connectionId => {
      this.handleDisconnection(connectionId);
    });
  }

  // Generate unique connection ID
  private generateConnectionId(): string {
    return `abt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get connection statistics
  public getStats(): any {
    return {
      totalConnections: this.connections.size,
      activeExperiments: this.experimentSubscribers.size,
      connectionsByExperiment: Array.from(this.experimentSubscribers.entries()).map(([experimentId, subscribers]) => ({
        experimentId,
        subscriberCount: subscribers.size
      }))
    };
  }

  // Close all connections (for cleanup)
  public closeAllConnections(): void {
    this.connections.forEach((connection) => {
      try {
        connection.socket.close();
      } catch (error) {
        console.error('Error closing WebSocket connection:', error);
      }
    });
    this.connections.clear();
    this.experimentSubscribers.clear();
  }
}

export default ABTestingWebSocketHandler;