/**
 * Advanced Mocking Framework for Pitchey Platform
 * Provides sophisticated mocking capabilities for all external dependencies
 */

import { sinon } from "npm:sinon@19.0.2";
import type { SinonStub, SinonSpy } from "npm:sinon@19.0.2";

// ==================== MOCK INTERFACES ====================

interface MockConfig {
  autoRestore?: boolean;
  logCalls?: boolean;
  strictMode?: boolean;
}

interface DatabaseMockConfig extends MockConfig {
  latency?: number;
  failureRate?: number;
  connectionErrors?: boolean;
}

interface RedisMockConfig extends MockConfig {
  maxMemory?: number;
  evictionPolicy?: "allkeys-lru" | "volatile-lru" | "allkeys-random";
  persistence?: boolean;
}

interface APIMockConfig extends MockConfig {
  baseURL?: string;
  timeout?: number;
  rateLimiting?: boolean;
}

interface WebSocketMockConfig extends MockConfig {
  connectionDelay?: number;
  messageDelay?: number;
  dropRate?: number;
}

// ==================== BASE MOCK CLASS ====================

export abstract class BaseMock {
  protected stubs: Map<string, SinonStub> = new Map();
  protected spies: Map<string, SinonSpy> = new Map();
  protected config: MockConfig;

  constructor(config: MockConfig = {}) {
    this.config = {
      autoRestore: true,
      logCalls: false,
      strictMode: false,
      ...config,
    };
  }

  protected createStub(target: any, method: string): SinonStub {
    const stub = sinon.stub(target, method);
    this.stubs.set(`${target.constructor.name}.${method}`, stub);
    
    if (this.config.logCalls) {
      stub.callsFake((...args) => {
        console.log(`Mock called: ${target.constructor.name}.${method}`, args);
        return stub.wrappedMethod.apply(target, args);
      });
    }
    
    return stub;
  }

  protected createSpy(target: any, method: string): SinonSpy {
    const spy = sinon.spy(target, method);
    this.spies.set(`${target.constructor.name}.${method}`, spy);
    return spy;
  }

  restore(): void {
    this.stubs.forEach(stub => stub.restore());
    this.spies.forEach(spy => spy.restore());
    this.stubs.clear();
    this.spies.clear();
  }

  getCallHistory(mockName: string) {
    const stub = this.stubs.get(mockName);
    const spy = this.spies.get(mockName);
    
    if (stub) {
      return stub.getCalls();
    } else if (spy) {
      return spy.getCalls();
    }
    
    return [];
  }

  abstract setup(): void;
}

// ==================== DATABASE MOCK ====================

export class DatabaseMock extends BaseMock {
  private latency: number;
  private failureRate: number;
  private connectionErrors: boolean;
  private queryLog: Array<{ query: string; params: any[]; timestamp: Date }> = [];

  constructor(config: DatabaseMockConfig = {}) {
    super(config);
    this.latency = config.latency || 0;
    this.failureRate = config.failureRate || 0;
    this.connectionErrors = config.connectionErrors || false;
  }

  setup(): void {
    // Mock database client methods
    this.mockQuery();
    this.mockTransaction();
    this.mockConnection();
    this.mockMigrations();
  }

  private mockQuery(): void {
    const queryStub = this.createStub(globalThis, 'mockDatabaseQuery');
    
    queryStub.callsFake(async (query: string, params: any[] = []) => {
      // Log query
      this.queryLog.push({
        query,
        params,
        timestamp: new Date(),
      });

      // Simulate latency
      if (this.latency > 0) {
        await new Promise(resolve => setTimeout(resolve, this.latency));
      }

      // Simulate random failures
      if (Math.random() < this.failureRate) {
        throw new Error("Database connection failed (simulated)");
      }

      // Return appropriate mock response based on query type
      return this.generateMockResponse(query, params);
    });
  }

  private generateMockResponse(query: string, params: any[]) {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes("select")) {
      if (lowerQuery.includes("users")) {
        return this.mockUserQueryResult(query);
      } else if (lowerQuery.includes("pitches")) {
        return this.mockPitchQueryResult(query);
      } else if (lowerQuery.includes("ndas")) {
        return this.mockNDAQueryResult(query);
      }
      return { rows: [] };
    }
    
    if (lowerQuery.includes("insert")) {
      return { insertId: Math.floor(Math.random() * 1000) + 1 };
    }
    
    if (lowerQuery.includes("update") || lowerQuery.includes("delete")) {
      return { affectedRows: 1 };
    }
    
    return { success: true };
  }

  private mockUserQueryResult(query: string) {
    // Return realistic user data structure
    return {
      rows: [{
        id: 1,
        email: "test@example.com",
        username: "testuser",
        userType: "creator",
        firstName: "Test",
        lastName: "User",
        emailVerified: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]
    };
  }

  private mockPitchQueryResult(query: string) {
    return {
      rows: [{
        id: 1,
        userId: 1,
        title: "Test Pitch",
        logline: "A compelling test story",
        genre: "Drama",
        status: "active",
        visibility: "public",
        viewCount: 42,
        likeCount: 8,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]
    };
  }

  private mockNDAQueryResult(query: string) {
    return {
      rows: [{
        id: 1,
        pitchId: 1,
        userId: 2,
        status: "signed",
        signedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }]
    };
  }

  private mockTransaction(): void {
    const transactionStub = this.createStub(globalThis, 'mockDatabaseTransaction');
    
    transactionStub.callsFake(async (callback: Function) => {
      if (this.connectionErrors && Math.random() < 0.1) {
        throw new Error("Transaction failed - connection lost");
      }
      
      try {
        return await callback({
          query: this.stubs.get('mockDatabaseQuery'),
          commit: () => Promise.resolve(),
          rollback: () => Promise.resolve(),
        });
      } catch (error) {
        throw error;
      }
    });
  }

  private mockConnection(): void {
    const connectStub = this.createStub(globalThis, 'mockDatabaseConnect');
    
    connectStub.callsFake(async () => {
      if (this.connectionErrors && Math.random() < 0.05) {
        throw new Error("Connection timeout");
      }
      
      return {
        connected: true,
        connectionId: Math.random().toString(36),
      };
    });
  }

  private mockMigrations(): void {
    const migrateStub = this.createStub(globalThis, 'mockDatabaseMigrate');
    
    migrateStub.callsFake(async (direction: "up" | "down" = "up") => {
      return {
        migrated: ["20241213_001_add_test_table.sql"],
        direction,
        timestamp: new Date(),
      };
    });
  }

  getQueryLog() {
    return this.queryLog;
  }

  clearQueryLog() {
    this.queryLog = [];
  }

  simulateFailure() {
    this.failureRate = 1;
  }

  resetFailureRate() {
    this.failureRate = 0;
  }
}

// ==================== REDIS MOCK ====================

export class RedisMock extends BaseMock {
  private cache: Map<string, { value: any; expiry?: number }> = new Map();
  private maxMemory: number;
  private persistence: boolean;

  constructor(config: RedisMockConfig = {}) {
    super(config);
    this.maxMemory = config.maxMemory || Infinity;
    this.persistence = config.persistence || false;
  }

  setup(): void {
    this.mockGetSet();
    this.mockLists();
    this.mockSets();
    this.mockPubSub();
  }

  private mockGetSet(): void {
    // GET
    const getStub = this.createStub(globalThis, 'mockRedisGet');
    getStub.callsFake(async (key: string) => {
      const entry = this.cache.get(key);
      if (!entry) return null;
      
      if (entry.expiry && Date.now() > entry.expiry) {
        this.cache.delete(key);
        return null;
      }
      
      return entry.value;
    });

    // SET
    const setStub = this.createStub(globalThis, 'mockRedisSet');
    setStub.callsFake(async (key: string, value: any, ttl?: number) => {
      const expiry = ttl ? Date.now() + (ttl * 1000) : undefined;
      
      // Check memory limits
      if (this.cache.size >= this.maxMemory) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      
      this.cache.set(key, { value, expiry });
      return "OK";
    });

    // DEL
    const delStub = this.createStub(globalThis, 'mockRedisDel');
    delStub.callsFake(async (key: string) => {
      const deleted = this.cache.delete(key);
      return deleted ? 1 : 0;
    });
  }

  private mockLists(): void {
    // LPUSH
    const lpushStub = this.createStub(globalThis, 'mockRedisLPush');
    lpushStub.callsFake(async (key: string, ...values: any[]) => {
      const existing = this.cache.get(key);
      const list = existing?.value || [];
      list.unshift(...values);
      this.cache.set(key, { value: list });
      return list.length;
    });

    // LPOP
    const lpopStub = this.createStub(globalThis, 'mockRedisLPop');
    lpopStub.callsFake(async (key: string) => {
      const existing = this.cache.get(key);
      if (!existing?.value || !Array.isArray(existing.value)) return null;
      
      const value = existing.value.shift();
      if (existing.value.length === 0) {
        this.cache.delete(key);
      }
      return value;
    });
  }

  private mockSets(): void {
    // SADD
    const saddStub = this.createStub(globalThis, 'mockRedisSAdd');
    saddStub.callsFake(async (key: string, ...members: any[]) => {
      const existing = this.cache.get(key);
      const set = new Set(existing?.value || []);
      let added = 0;
      
      members.forEach(member => {
        if (!set.has(member)) {
          set.add(member);
          added++;
        }
      });
      
      this.cache.set(key, { value: Array.from(set) });
      return added;
    });

    // SMEMBERS
    const smembersStub = this.createStub(globalThis, 'mockRedisSMembers');
    smembersStub.callsFake(async (key: string) => {
      const existing = this.cache.get(key);
      return existing?.value || [];
    });
  }

  private mockPubSub(): void {
    const subscribers: Map<string, Function[]> = new Map();

    // PUBLISH
    const publishStub = this.createStub(globalThis, 'mockRedisPublish');
    publishStub.callsFake(async (channel: string, message: any) => {
      const channelSubscribers = subscribers.get(channel) || [];
      channelSubscribers.forEach(callback => {
        setTimeout(() => callback(channel, message), 0);
      });
      return channelSubscribers.length;
    });

    // SUBSCRIBE
    const subscribeStub = this.createStub(globalThis, 'mockRedisSubscribe');
    subscribeStub.callsFake(async (channel: string, callback: Function) => {
      const channelSubscribers = subscribers.get(channel) || [];
      channelSubscribers.push(callback);
      subscribers.set(channel, channelSubscribers);
    });
  }

  getCacheKeys() {
    return Array.from(this.cache.keys());
  }

  getCacheSize() {
    return this.cache.size;
  }

  clearCache() {
    this.cache.clear();
  }
}

// ==================== EXTERNAL API MOCK ====================

export class ExternalAPIMock extends BaseMock {
  private baseURL: string;
  private responses: Map<string, any> = new Map();
  private requestLog: Array<{ url: string; method: string; body: any; timestamp: Date }> = [];

  constructor(config: APIMockConfig = {}) {
    super(config);
    this.baseURL = config.baseURL || "https://api.example.com";
  }

  setup(): void {
    this.mockFetch();
    this.mockStripeAPI();
    this.mockSendGridAPI();
    this.mockUpstashAPI();
  }

  private mockFetch(): void {
    const fetchStub = this.createStub(globalThis, 'fetch');
    
    fetchStub.callsFake(async (url: string, options: any = {}) => {
      this.requestLog.push({
        url,
        method: options.method || "GET",
        body: options.body,
        timestamp: new Date(),
      });

      // Check for predefined responses
      const key = `${options.method || "GET"} ${url}`;
      if (this.responses.has(key)) {
        const response = this.responses.get(key);
        return new Response(JSON.stringify(response.body), {
          status: response.status || 200,
          headers: response.headers || {},
        });
      }

      // Default responses based on URL patterns
      if (url.includes("stripe.com")) {
        return this.mockStripeResponse(url, options);
      } else if (url.includes("sendgrid.com")) {
        return this.mockSendGridResponse(url, options);
      }

      // Default success response
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
  }

  private mockStripeResponse(url: string, options: any) {
    if (url.includes("/customers")) {
      return new Response(JSON.stringify({
        id: "cus_test_" + Math.random().toString(36).substr(2, 9),
        email: "test@example.com",
        created: Math.floor(Date.now() / 1000),
      }), { status: 200 });
    }

    if (url.includes("/subscriptions")) {
      return new Response(JSON.stringify({
        id: "sub_test_" + Math.random().toString(36).substr(2, 9),
        status: "active",
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 2592000, // +30 days
      }), { status: 200 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  private mockSendGridResponse(url: string, options: any) {
    if (url.includes("/mail/send")) {
      return new Response(JSON.stringify({
        message: "success"
      }), { 
        status: 202,
        headers: { 'X-Message-Id': 'test_' + Math.random().toString(36) }
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }

  private mockStripeAPI(): void {
    // Mock specific Stripe operations
    this.addMockResponse("POST", `${this.baseURL}/v1/customers`, {
      status: 200,
      body: {
        id: "cus_test_123",
        email: "test@example.com",
        created: Math.floor(Date.now() / 1000),
      }
    });
  }

  private mockSendGridAPI(): void {
    this.addMockResponse("POST", "https://api.sendgrid.com/v3/mail/send", {
      status: 202,
      body: { message: "success" }
    });
  }

  private mockUpstashAPI(): void {
    this.addMockResponse("GET", "https://redis-endpoint.upstash.io/*", {
      status: 200,
      body: { result: null }
    });
  }

  addMockResponse(method: string, url: string, response: any) {
    this.responses.set(`${method} ${url}`, response);
  }

  getRequestLog() {
    return this.requestLog;
  }

  clearRequestLog() {
    this.requestLog = [];
  }
}

// ==================== WEBSOCKET MOCK ====================

export class WebSocketMock extends BaseMock {
  private connections: Set<MockWebSocket> = new Set();
  private messageLog: Array<{ type: string; data: any; timestamp: Date }> = [];
  private connectionDelay: number;
  private messageDelay: number;
  private dropRate: number;

  constructor(config: WebSocketMockConfig = {}) {
    super(config);
    this.connectionDelay = config.connectionDelay || 0;
    this.messageDelay = config.messageDelay || 0;
    this.dropRate = config.dropRate || 0;
  }

  setup(): void {
    this.mockWebSocket();
  }

  private mockWebSocket(): void {
    const OriginalWebSocket = globalThis.WebSocket;
    
    class MockWebSocket {
      public readyState: number = WebSocket.CONNECTING;
      public onopen?: (event: Event) => void;
      public onmessage?: (event: MessageEvent) => void;
      public onclose?: (event: CloseEvent) => void;
      public onerror?: (event: Event) => void;
      
      constructor(public url: string, public protocols?: string | string[]) {
        setTimeout(() => {
          this.readyState = WebSocket.OPEN;
          this.onopen?.(new Event("open"));
        }, Math.random() * 100); // Random connection delay
      }

      send(data: string | ArrayBuffer | Blob) {
        if (this.readyState !== WebSocket.OPEN) {
          throw new Error("WebSocket is not open");
        }

        // Simulate message dropping
        if (Math.random() < this.dropRate) {
          return;
        }

        // Log message
        this.messageLog.push({
          type: "send",
          data: data,
          timestamp: new Date(),
        });

        // Simulate message delay and echo back
        setTimeout(() => {
          if (this.readyState === WebSocket.OPEN) {
            this.onmessage?.(new MessageEvent("message", { data }));
          }
        }, this.messageDelay);
      }

      close(code?: number, reason?: string) {
        this.readyState = WebSocket.CLOSED;
        this.onclose?.(new CloseEvent("close", { code: code || 1000, reason }));
      }
    }

    // Replace global WebSocket
    (globalThis as any).WebSocket = MockWebSocket;
    this.stubs.set("WebSocket", sinon.stub());
  }

  simulateMessage(data: any) {
    this.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.onmessage?.(new MessageEvent("message", { data }));
      }
    });
  }

  simulateDisconnection() {
    this.connections.forEach(ws => {
      ws.close(1006, "Connection lost");
    });
  }

  getMessageLog() {
    return this.messageLog;
  }

  clearMessageLog() {
    this.messageLog = [];
  }
}

// ==================== MOCK MANAGER ====================

export class MockManager {
  private mocks: Map<string, BaseMock> = new Map();

  addMock(name: string, mock: BaseMock) {
    mock.setup();
    this.mocks.set(name, mock);
  }

  getMock<T extends BaseMock>(name: string): T {
    const mock = this.mocks.get(name);
    if (!mock) {
      throw new Error(`Mock '${name}' not found`);
    }
    return mock as T;
  }

  restoreAll() {
    this.mocks.forEach(mock => mock.restore());
    this.mocks.clear();
  }

  setupStandardMocks(): MockManager {
    this.addMock("database", new DatabaseMock());
    this.addMock("redis", new RedisMock());
    this.addMock("externalAPI", new ExternalAPIMock());
    this.addMock("websocket", new WebSocketMock());
    return this;
  }
}

// ==================== CONVENIENCE EXPORTS ====================

export function createMockManager(): MockManager {
  return new MockManager().setupStandardMocks();
}

export { DatabaseMock, RedisMock, ExternalAPIMock, WebSocketMock };