/**
 * Queue Service for Cloudflare Workers
 * Handles background job processing and message queueing
 */

export interface QueueMessage {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  createdAt: Date;
  scheduledFor?: Date;
  priority?: number;
}

export interface QueueConfig {
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
  batchTimeout?: number;
}

export class WorkerQueueService {
  private maxRetries: number;
  private retryDelay: number;
  private batchSize: number;
  private batchTimeout: number;

  constructor(config: QueueConfig = {}) {
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 5000;
    this.batchSize = config.batchSize || 10;
    this.batchTimeout = config.batchTimeout || 30;
  }

  /**
   * Send a message to the queue
   */
  async send(
    queue: Queue,
    message: any,
    options?: { delaySeconds?: number }
  ): Promise<void> {
    await queue.send(message, options);
  }

  /**
   * Send multiple messages
   */
  async sendBatch(
    queue: Queue,
    messages: any[],
    options?: { delaySeconds?: number }
  ): Promise<void> {
    // Send in batches to avoid limits
    const batches = this.chunkArray(messages, 100);
    
    for (const batch of batches) {
      const batchMessages = batch.map(message => ({
        body: message,
        options
      }));
      await queue.sendBatch(batchMessages);
    }
  }

  /**
   * Process queue messages (consumer handler)
   */
  async processMessages(
    batch: MessageBatch,
    env: any
  ): Promise<void> {
    console.log(`Processing ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      try {
        await this.handleMessage(message, env);
        // Mark message as processed
        message.ack();
      } catch (error) {
        console.error('Error processing message:', error);
        
        // Retry logic
        if (this.shouldRetry(message)) {
          message.retry({ delaySeconds: this.retryDelay / 1000 });
        } else {
          // Send to dead letter queue or log
          console.error('Message failed after max retries:', message);
          message.ack(); // Remove from queue
        }
      }
    }
  }

  /**
   * Handle individual message based on type
   */
  private async handleMessage(message: Message, env: any): Promise<void> {
    const { type, payload } = message.body as any;

    switch (type) {
      case 'email':
        await this.processEmailJob(payload, env);
        break;
        
      case 'notification':
        await this.processNotificationJob(payload, env);
        break;
        
      case 'analytics':
        await this.processAnalyticsJob(payload, env);
        break;
        
      case 'export':
        await this.processExportJob(payload, env);
        break;
        
      default:
        console.warn('Unknown message type:', type);
    }
  }

  /**
   * Process email job
   */
  private async processEmailJob(payload: any, env: any): Promise<void> {
    const { to, subject, template, data } = payload;
    
    // Initialize email service with env.RESEND_API_KEY
    if (env.EMAIL_SERVICE) {
      await env.EMAIL_SERVICE.sendTemplate(to, template, data);
    }
  }

  /**
   * Process notification job
   */
  private async processNotificationJob(payload: any, env: any): Promise<void> {
    const { userId, title, message, type } = payload;
    
    // Store notification in database
    if (env.DATABASE) {
      await env.DATABASE.query(
        `INSERT INTO notifications (user_id, title, message, type, created_at) 
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, title, message, type]
      );
    }
    
    // Send via WebSocket if user is online
    if (env.WEBSOCKET_ROOM) {
      const room = env.WEBSOCKET_ROOM.get('global');
      await room.fetch(new Request('http://internal/notify', {
        method: 'POST',
        body: JSON.stringify({ userId, title, message })
      }));
    }
  }

  /**
   * Process analytics job
   */
  private async processAnalyticsJob(payload: any, env: any): Promise<void> {
    const { event, userId, properties } = payload;
    
    // Store analytics event
    if (env.DATABASE) {
      await env.DATABASE.query(
        `INSERT INTO analytics_events (event, user_id, properties, created_at) 
         VALUES ($1, $2, $3, NOW())`,
        [event, userId, JSON.stringify(properties)]
      );
    }
  }

  /**
   * Process export job
   */
  private async processExportJob(payload: any, env: any): Promise<void> {
    const { userId, type, filters } = payload;
    
    // Generate export based on type
    let data: any;
    if (env.DATABASE) {
      switch (type) {
        case 'pitches':
          data = await env.DATABASE.query(
            `SELECT * FROM pitches WHERE creator_id = $1`,
            [userId]
          );
          break;
        case 'investments':
          data = await env.DATABASE.query(
            `SELECT * FROM investments WHERE investor_id = $1`,
            [userId]
          );
          break;
      }
    }
    
    // Convert to CSV or desired format
    const csv = this.convertToCSV(data);
    
    // Send email with export
    if (env.EMAIL_SERVICE) {
      await env.EMAIL_SERVICE.send({
        to: payload.email,
        subject: `Your ${type} export is ready`,
        html: `<p>Your export is attached.</p>`,
        attachments: [{
          filename: `${type}_export_${Date.now()}.csv`,
          content: Buffer.from(csv).toString('base64')
        }]
      });
    }
  }

  /**
   * Check if message should be retried
   */
  private shouldRetry(message: Message): boolean {
    const attempts = (message as any).attempts || 0;
    return attempts < this.maxRetries;
  }

  /**
   * Convert data to CSV
   */
  private convertToCSV(data: any[]): string {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
      headers.map(header => {
        const value = item[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Helper to chunk array
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Queue consumer export for wrangler
export default {
  async queue(batch: MessageBatch, env: any): Promise<void> {
    const queueService = new WorkerQueueService();
    await queueService.processMessages(batch, env);
  }
};