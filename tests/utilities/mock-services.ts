// MOCK SERVICES FOR TESTING
// Provides mock implementations for external services during testing
// Enables isolated testing without external dependencies

export interface MockConfig {
  enableLogs?: boolean;
  simulateLatency?: boolean;
  simulateErrors?: boolean;
  errorRate?: number; // 0-1
}

// Mock Email Service
export class MockEmailService {
  private sentEmails: any[] = [];
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = { enableLogs: false, ...config };
  }

  async sendEmail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    template?: string;
    data?: Record<string, any>;
  }) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
    }

    if (this.config.simulateErrors && Math.random() < (this.config.errorRate || 0.1)) {
      throw new Error("Mock email service error");
    }

    const email = {
      ...options,
      id: `mock-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    this.sentEmails.push(email);

    if (this.config.enableLogs) {
      console.log(`📧 Mock Email Sent:`, {
        to: email.to,
        subject: email.subject,
        id: email.id,
      });
    }

    return { success: true, messageId: email.id };
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  getEmailsTo(email: string) {
    return this.sentEmails.filter(e => e.to === email);
  }

  clearSentEmails() {
    this.sentEmails = [];
  }

  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1];
  }
}

// Mock Storage Service
export class MockStorageService {
  private files: Map<string, { content: Uint8Array; metadata: any }> = new Map();
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = { enableLogs: false, ...config };
  }

  async uploadFile(
    file: Uint8Array, 
    fileName: string, 
    options: { contentType?: string; pitchId?: number; documentType?: string } = {}
  ) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 800));
    }

    if (this.config.simulateErrors && Math.random() < (this.config.errorRate || 0.05)) {
      throw new Error("Mock storage service error");
    }

    // Validate file size (50MB limit)
    if (file.length > 50 * 1024 * 1024) {
      throw new Error("File size exceeds limit");
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "video/mp4",
    ];

    if (options.contentType && !allowedTypes.includes(options.contentType)) {
      throw new Error("Invalid file type");
    }

    const fileId = `mock-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fileUrl = `https://mock-storage.pitchey.test/files/${fileId}`;

    this.files.set(fileId, {
      content: file,
      metadata: {
        fileName,
        contentType: options.contentType,
        size: file.length,
        uploadedAt: new Date().toISOString(),
        pitchId: options.pitchId,
        documentType: options.documentType,
      },
    });

    if (this.config.enableLogs) {
      console.log(`📁 Mock File Uploaded:`, {
        fileName,
        fileId,
        size: file.length,
        contentType: options.contentType,
      });
    }

    return {
      success: true,
      fileId,
      fileUrl,
      size: file.length,
    };
  }

  async deleteFile(fileId: string) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const deleted = this.files.delete(fileId);
    
    if (this.config.enableLogs && deleted) {
      console.log(`🗑️ Mock File Deleted: ${fileId}`);
    }

    return { success: deleted };
  }

  getFile(fileId: string) {
    return this.files.get(fileId);
  }

  getAllFiles() {
    return Array.from(this.files.entries()).map(([id, data]) => ({
      id,
      ...data.metadata,
    }));
  }

  clearAllFiles() {
    this.files.clear();
  }

  getFilesByPitch(pitchId: number) {
    return Array.from(this.files.entries())
      .filter(([_, data]) => data.metadata.pitchId === pitchId)
      .map(([id, data]) => ({ id, ...data.metadata }));
  }
}

// Mock Payment Service
export class MockPaymentService {
  private transactions: any[] = [];
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = { enableLogs: false, ...config };
  }

  async createPaymentIntent(options: {
    amount: number;
    currency: string;
    metadata?: Record<string, any>;
  }) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    if (this.config.simulateErrors && Math.random() < (this.config.errorRate || 0.02)) {
      throw new Error("Mock payment service error");
    }

    const paymentIntent = {
      id: `pi_mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: options.amount,
      currency: options.currency,
      status: "requires_payment_method",
      client_secret: `pi_mock_secret_${Math.random().toString(36).substr(2, 16)}`,
      metadata: options.metadata || {},
      created: Math.floor(Date.now() / 1000),
    };

    this.transactions.push(paymentIntent);

    if (this.config.enableLogs) {
      console.log(`💳 Mock Payment Intent Created:`, {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    }

    return paymentIntent;
  }

  async confirmPayment(paymentIntentId: string) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const transaction = this.transactions.find(t => t.id === paymentIntentId);
    if (!transaction) {
      throw new Error("Payment intent not found");
    }

    // Simulate payment success/failure
    const success = Math.random() > (this.config.errorRate || 0.02);
    
    transaction.status = success ? "succeeded" : "failed";
    transaction.updated = Math.floor(Date.now() / 1000);

    if (this.config.enableLogs) {
      console.log(`💳 Mock Payment ${success ? "Succeeded" : "Failed"}:`, paymentIntentId);
    }

    return transaction;
  }

  getTransactions() {
    return [...this.transactions];
  }

  clearTransactions() {
    this.transactions = [];
  }
}

// Mock WebSocket Service
export class MockWebSocketService {
  private connections: Set<MockWebSocketConnection> = new Set();
  private messageHistory: any[] = [];
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = { enableLogs: false, ...config };
  }

  createConnection(userId?: number): MockWebSocketConnection {
    const connection = new MockWebSocketConnection(userId, this);
    this.connections.add(connection);
    
    if (this.config.enableLogs) {
      console.log(`🔌 Mock WebSocket Connected: User ${userId || "Anonymous"}`);
    }

    return connection;
  }

  broadcast(message: any, excludeConnection?: MockWebSocketConnection) {
    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
      id: `ws-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    this.messageHistory.push(messageWithTimestamp);

    for (const connection of this.connections) {
      if (connection !== excludeConnection && connection.isConnected()) {
        connection.receive(messageWithTimestamp);
      }
    }

    if (this.config.enableLogs) {
      console.log(`📡 Mock WebSocket Broadcast:`, message.type);
    }
  }

  removeConnection(connection: MockWebSocketConnection) {
    this.connections.delete(connection);
    
    if (this.config.enableLogs) {
      console.log(`🔌 Mock WebSocket Disconnected: User ${connection.userId || "Anonymous"}`);
    }
  }

  getConnectedUsers(): number[] {
    return Array.from(this.connections)
      .filter(conn => conn.userId && conn.isConnected())
      .map(conn => conn.userId!);
  }

  getMessageHistory() {
    return [...this.messageHistory];
  }

  clearMessageHistory() {
    this.messageHistory = [];
  }

  getConnectionCount() {
    return this.connections.size;
  }
}

export class MockWebSocketConnection {
  private connected = true;
  private messageQueue: any[] = [];
  public userId?: number;
  private mockService: MockWebSocketService;

  constructor(userId: number | undefined, mockService: MockWebSocketService) {
    this.userId = userId;
    this.mockService = mockService;
  }

  send(message: any) {
    if (!this.connected) {
      throw new Error("WebSocket connection is closed");
    }

    const messageWithTimestamp = {
      ...message,
      timestamp: new Date().toISOString(),
      userId: this.userId,
    };

    // Simulate network delay
    setTimeout(() => {
      this.mockService.broadcast(messageWithTimestamp, this);
    }, Math.random() * 50);
  }

  receive(message: any) {
    if (this.connected) {
      this.messageQueue.push(message);
    }
  }

  getMessages() {
    return [...this.messageQueue];
  }

  getLastMessage() {
    return this.messageQueue[this.messageQueue.length - 1];
  }

  clearMessages() {
    this.messageQueue = [];
  }

  close() {
    this.connected = false;
    this.mockService.removeConnection(this);
  }

  isConnected() {
    return this.connected;
  }
}

// Mock Redis Service
export class MockRedisService {
  private cache: Map<string, { value: any; expiry?: number }> = new Map();
  private config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = { enableLogs: false, ...config };
  }

  async set(key: string, value: any, expirySeconds?: number) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
    }

    const expiry = expirySeconds ? Date.now() + (expirySeconds * 1000) : undefined;
    this.cache.set(key, { value, expiry });

    if (this.config.enableLogs) {
      console.log(`🔴 Mock Redis SET: ${key} (expires: ${expiry ? new Date(expiry).toISOString() : "never"})`);
    }

    return "OK";
  }

  async get(key: string) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
    }

    const item = this.cache.get(key);
    if (!item) return null;

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    if (this.config.enableLogs) {
      console.log(`🔴 Mock Redis GET: ${key}`);
    }

    return item.value;
  }

  async del(key: string) {
    if (this.config.simulateLatency) {
      await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 15));
    }

    const deleted = this.cache.delete(key);

    if (this.config.enableLogs && deleted) {
      console.log(`🔴 Mock Redis DEL: ${key}`);
    }

    return deleted ? 1 : 0;
  }

  async exists(key: string) {
    const item = this.cache.get(key);
    if (!item) return 0;

    // Check expiry
    if (item.expiry && Date.now() > item.expiry) {
      this.cache.delete(key);
      return 0;
    }

    return 1;
  }

  async keys(pattern: string) {
    // Simple pattern matching (only supports * wildcard)
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  async flushAll() {
    this.cache.clear();
    
    if (this.config.enableLogs) {
      console.log("🔴 Mock Redis FLUSH ALL");
    }

    return "OK";
  }

  getCacheSize() {
    return this.cache.size;
  }

  getCacheKeys() {
    return Array.from(this.cache.keys());
  }
}

// Mock Service Factory
export class MockServiceFactory {
  private static instances: Map<string, any> = new Map();

  static getEmailService(config?: MockConfig): MockEmailService {
    if (!this.instances.has("email")) {
      this.instances.set("email", new MockEmailService(config));
    }
    return this.instances.get("email");
  }

  static getStorageService(config?: MockConfig): MockStorageService {
    if (!this.instances.has("storage")) {
      this.instances.set("storage", new MockStorageService(config));
    }
    return this.instances.get("storage");
  }

  static getPaymentService(config?: MockConfig): MockPaymentService {
    if (!this.instances.has("payment")) {
      this.instances.set("payment", new MockPaymentService(config));
    }
    return this.instances.get("payment");
  }

  static getWebSocketService(config?: MockConfig): MockWebSocketService {
    if (!this.instances.has("websocket")) {
      this.instances.set("websocket", new MockWebSocketService(config));
    }
    return this.instances.get("websocket");
  }

  static getRedisService(config?: MockConfig): MockRedisService {
    if (!this.instances.has("redis")) {
      this.instances.set("redis", new MockRedisService(config));
    }
    return this.instances.get("redis");
  }

  static clearAll() {
    this.instances.clear();
  }

  static reset() {
    // Reset all mock services to clean state
    this.instances.forEach(service => {
      if (typeof service.clearAllFiles === "function") service.clearAllFiles();
      if (typeof service.clearSentEmails === "function") service.clearSentEmails();
      if (typeof service.clearTransactions === "function") service.clearTransactions();
      if (typeof service.clearMessageHistory === "function") service.clearMessageHistory();
      if (typeof service.flushAll === "function") service.flushAll();
    });
  }
}