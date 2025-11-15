/**
 * Advanced Rate Limiting and Throttling Middleware
 * Provides intelligent rate limiting with multiple strategies, adaptive throttling, and abuse prevention
 */

import { telemetry } from "../utils/telemetry.ts";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  strategy: "fixed-window" | "sliding-window" | "token-bucket" | "adaptive";
  keyGenerator: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  headers?: boolean;
}

export interface ThrottleConfig {
  enabled: boolean;
  maxConcurrent: number;
  queueSize: number;
  priority: (request: Request) => number;
  timeout: number;
}

export interface RateLimitRule {
  id: string;
  pattern: string | RegExp;
  config: RateLimitConfig;
  priority: number;
  enabled: boolean;
}

export interface ClientMetrics {
  requests: number;
  lastRequest: number;
  bucket: number; // For token bucket
  violations: number;
  blocked: number;
  reputation: number; // 0-100 score
}

export interface AdaptiveSettings {
  baseLimit: number;
  maxLimit: number;
  minLimit: number;
  scaleFactor: number;
  learningRate: number;
  systemLoadThreshold: number;
}

export class AdvancedRateLimiter {
  private static clients = new Map<string, ClientMetrics>();
  private static rules = new Map<string, RateLimitRule>();
  private static pendingRequests = new Map<string, number>();
  private static requestQueue: Array<{
    resolve: (response: Response | null) => void;
    reject: (error: Error) => void;
    priority: number;
    timestamp: number;
    key: string;
  }> = [];
  
  private static adaptiveSettings: AdaptiveSettings = {
    baseLimit: 100,
    maxLimit: 1000,
    minLimit: 10,
    scaleFactor: 1.0,
    learningRate: 0.1,
    systemLoadThreshold: 0.8
  };
  
  /**
   * Initialize rate limiting rules
   */
  static initialize() {
    console.log("🔧 Initializing advanced rate limiting...");
    
    // Define default rate limiting rules
    this.addRule({
      id: "auth-strict",
      pattern: /^\/api\/auth\//,
      priority: 100,
      enabled: true,
      config: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 5, // Very strict for auth endpoints
        strategy: "sliding-window",
        keyGenerator: (req) => this.getClientKey(req),
        message: "Too many authentication attempts",
        headers: true
      }
    });
    
    this.addRule({
      id: "api-standard",
      pattern: /^\/api\//,
      priority: 50,
      enabled: true,
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60,
        strategy: "adaptive",
        keyGenerator: (req) => this.getClientKey(req),
        skipSuccessfulRequests: false,
        headers: true
      }
    });
    
    this.addRule({
      id: "search-moderate",
      pattern: /^\/api\/.*\/search/,
      priority: 75,
      enabled: true,
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 30,
        strategy: "token-bucket",
        keyGenerator: (req) => this.getClientKey(req),
        headers: true
      }
    });
    
    this.addRule({
      id: "upload-restricted",
      pattern: /^\/api\/.*\/upload/,
      priority: 90,
      enabled: true,
      config: {
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 5,
        strategy: "fixed-window",
        keyGenerator: (req) => this.getClientKey(req),
        message: "Upload rate limit exceeded",
        headers: true
      }
    });
    
    // Start background cleanup
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
    
    console.log(`✅ Rate limiting initialized with ${this.rules.size} rules`);
  }
  
  /**
   * Main rate limiting middleware
   */
  static async middleware(
    request: Request,
    next: () => Promise<Response>
  ): Promise<Response> {
    const url = new URL(request.url);
    const clientKey = this.getClientKey(request);
    
    try {
      // Find applicable rule
      const rule = this.findApplicableRule(url.pathname);
      if (!rule || !rule.enabled) {
        return await next();
      }
      
      // Check rate limit
      const limitResult = await this.checkRateLimit(request, rule);
      
      if (!limitResult.allowed) {
        // Update client reputation
        this.updateClientReputation(clientKey, false);
        
        // Log rate limit violation
        telemetry.logger.warn("Rate limit exceeded", {
          clientKey,
          path: url.pathname,
          rule: rule.id,
          remaining: limitResult.remaining,
          resetTime: limitResult.resetTime
        });
        
        return this.createRateLimitResponse(limitResult, rule);
      }
      
      // Apply throttling if enabled
      const throttleConfig = this.getThrottleConfig(request, rule);
      if (throttleConfig.enabled) {
        const throttleResult = await this.applyThrottling(request, throttleConfig);
        if (!throttleResult) {
          return this.createThrottleResponse();
        }
      }
      
      // Execute request
      const response = await next();
      
      // Update metrics based on response (only if response exists)
      if (response) {
        this.updateClientMetrics(clientKey, response.status);
        this.updateClientReputation(clientKey, response.ok);
      }
      
      // Add rate limit headers
      if (response && rule.config.headers) {
        return this.addRateLimitHeaders(response, limitResult);
      }
      
      return response;
      
    } catch (error) {
      telemetry.logger.error("Rate limiting error", error, { clientKey });
      return await next(); // Fail open
    }
  }
  
  /**
   * Check rate limit based on strategy
   */
  private static async checkRateLimit(request: Request, rule: RateLimitRule) {
    const clientKey = rule.config.keyGenerator(request);
    const now = Date.now();
    
    switch (rule.config.strategy) {
      case "fixed-window":
        return this.checkFixedWindow(clientKey, rule.config, now);
      case "sliding-window":
        return this.checkSlidingWindow(clientKey, rule.config, now);
      case "token-bucket":
        return this.checkTokenBucket(clientKey, rule.config, now);
      case "adaptive":
        return this.checkAdaptive(clientKey, rule.config, now);
      default:
        return { allowed: true, remaining: rule.config.maxRequests, resetTime: now + rule.config.windowMs };
    }
  }
  
  /**
   * Fixed window rate limiting
   */
  private static checkFixedWindow(clientKey: string, config: RateLimitConfig, now: number) {
    const client = this.getOrCreateClient(clientKey);
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
    
    if (client.lastRequest < windowStart) {
      client.requests = 0;
      client.lastRequest = now;
    }
    
    const allowed = client.requests < config.maxRequests;
    
    if (allowed) {
      client.requests++;
      client.lastRequest = now;
    } else {
      client.violations++;
    }
    
    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - client.requests),
      resetTime: windowStart + config.windowMs,
      total: config.maxRequests
    };
  }
  
  /**
   * Sliding window rate limiting
   */
  private static checkSlidingWindow(clientKey: string, config: RateLimitConfig, now: number) {
    const client = this.getOrCreateClient(clientKey);
    const windowStart = now - config.windowMs;
    
    // Simple sliding window approximation
    const timeSinceLastReset = now - client.lastRequest;
    if (timeSinceLastReset > config.windowMs) {
      client.requests = 0;
    } else {
      // Decay old requests based on time passed
      const decayFactor = timeSinceLastReset / config.windowMs;
      client.requests = Math.max(0, client.requests * (1 - decayFactor));
    }
    
    const allowed = client.requests < config.maxRequests;
    
    if (allowed) {
      client.requests++;
      client.lastRequest = now;
    } else {
      client.violations++;
    }
    
    return {
      allowed,
      remaining: Math.max(0, Math.floor(config.maxRequests - client.requests)),
      resetTime: now + config.windowMs,
      total: config.maxRequests
    };
  }
  
  /**
   * Token bucket rate limiting
   */
  private static checkTokenBucket(clientKey: string, config: RateLimitConfig, now: number) {
    const client = this.getOrCreateClient(clientKey);
    
    if (!client.bucket) {
      client.bucket = config.maxRequests;
      client.lastRequest = now;
    }
    
    // Refill tokens based on time passed
    const timePassed = now - client.lastRequest;
    const refillRate = config.maxRequests / config.windowMs;
    const tokensToAdd = Math.floor(timePassed * refillRate);
    
    client.bucket = Math.min(config.maxRequests, client.bucket + tokensToAdd);
    client.lastRequest = now;
    
    const allowed = client.bucket > 0;
    
    if (allowed) {
      client.bucket--;
      client.requests++;
    } else {
      client.violations++;
    }
    
    return {
      allowed,
      remaining: client.bucket,
      resetTime: now + ((config.maxRequests - client.bucket) / refillRate),
      total: config.maxRequests
    };
  }
  
  /**
   * Adaptive rate limiting based on system load and client behavior
   */
  private static checkAdaptive(clientKey: string, config: RateLimitConfig, now: number) {
    const client = this.getOrCreateClient(clientKey);
    const systemLoad = this.getSystemLoad();
    
    // Adjust limits based on system load and client reputation
    let adaptedLimit = this.adaptiveSettings.baseLimit;
    
    if (systemLoad > this.adaptiveSettings.systemLoadThreshold) {
      adaptedLimit = Math.max(
        this.adaptiveSettings.minLimit,
        adaptedLimit * (1 - systemLoad)
      );
    } else {
      adaptedLimit = Math.min(
        this.adaptiveSettings.maxLimit,
        adaptedLimit * (1 + (client.reputation / 100))
      );
    }
    
    // Use sliding window with adapted limit
    const modifiedConfig = { ...config, maxRequests: Math.floor(adaptedLimit) };
    return this.checkSlidingWindow(clientKey, modifiedConfig, now);
  }
  
  /**
   * Apply request throttling
   */
  private static async applyThrottling(request: Request, config: ThrottleConfig): Promise<boolean> {
    const clientKey = this.getClientKey(request);
    const currentPending = this.pendingRequests.get(clientKey) || 0;
    
    if (currentPending >= config.maxConcurrent) {
      // Check queue space
      if (this.requestQueue.length >= config.queueSize) {
        return false; // Queue full, reject request
      }
      
      // Add to queue
      const priority = config.priority(request);
      const queuePromise = new Promise<Response | null>((resolve, reject) => {
        this.requestQueue.push({
          resolve,
          reject,
          priority,
          timestamp: Date.now(),
          key: clientKey
        });
        
        // Sort queue by priority
        this.requestQueue.sort((a, b) => b.priority - a.priority);
        
        // Set timeout
        setTimeout(() => {
          const index = this.requestQueue.findIndex(item => 
            item.key === clientKey && item.timestamp === Date.now()
          );
          if (index !== -1) {
            this.requestQueue.splice(index, 1);
            reject(new Error("Request timeout"));
          }
        }, config.timeout);
      });
      
      const result = await queuePromise;
      return result !== null;
    }
    
    // Track pending request
    this.pendingRequests.set(clientKey, currentPending + 1);
    
    // Process queue when request completes
    setTimeout(() => {
      this.pendingRequests.set(clientKey, Math.max(0, (this.pendingRequests.get(clientKey) || 0) - 1));
      this.processQueue();
    }, 0);
    
    return true;
  }
  
  /**
   * Process the throttling queue
   */
  private static processQueue() {
    if (this.requestQueue.length === 0) return;
    
    const nextRequest = this.requestQueue.shift();
    if (nextRequest) {
      const currentPending = this.pendingRequests.get(nextRequest.key) || 0;
      const throttleConfig = { maxConcurrent: 5 }; // Default config
      
      if (currentPending < throttleConfig.maxConcurrent) {
        nextRequest.resolve(null); // Signal to proceed
      } else {
        // Put back in queue
        this.requestQueue.unshift(nextRequest);
      }
    }
  }
  
  // Helper methods
  
  private static getClientKey(request: Request): string {
    // Try to get client identifier from various sources
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");
    const authorization = request.headers.get("authorization");
    
    // Use auth token if available, otherwise IP + User-Agent fingerprint
    if (authorization) {
      const token = authorization.replace("Bearer ", "");
      return `auth:${token.substring(0, 10)}`;
    }
    
    const ip = forwarded?.split(",")[0] || realIp || "unknown";
    const fingerprint = this.hashString(userAgent || "unknown");
    
    return `ip:${ip}:${fingerprint}`;
  }
  
  private static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  private static findApplicableRule(pathname: string): RateLimitRule | null {
    let applicableRule: RateLimitRule | null = null;
    let highestPriority = -1;
    
    for (const [, rule] of this.rules) {
      if (!rule.enabled) continue;
      
      const matches = typeof rule.pattern === "string" 
        ? pathname.startsWith(rule.pattern)
        : rule.pattern.test(pathname);
      
      if (matches && rule.priority > highestPriority) {
        applicableRule = rule;
        highestPriority = rule.priority;
      }
    }
    
    return applicableRule;
  }
  
  private static getOrCreateClient(key: string): ClientMetrics {
    let client = this.clients.get(key);
    if (!client) {
      client = {
        requests: 0,
        lastRequest: Date.now(),
        bucket: 0,
        violations: 0,
        blocked: 0,
        reputation: 50 // Start with neutral reputation
      };
      this.clients.set(key, client);
    }
    return client;
  }
  
  private static updateClientMetrics(clientKey: string, statusCode: number) {
    const client = this.getOrCreateClient(clientKey);
    
    if (statusCode >= 400) {
      client.reputation = Math.max(0, client.reputation - 1);
    } else {
      client.reputation = Math.min(100, client.reputation + 0.1);
    }
  }
  
  private static updateClientReputation(clientKey: string, success: boolean) {
    const client = this.getOrCreateClient(clientKey);
    
    if (success) {
      client.reputation = Math.min(100, client.reputation + 0.5);
    } else {
      client.reputation = Math.max(0, client.reputation - 2);
      client.violations++;
    }
  }
  
  private static getSystemLoad(): number {
    // Simple system load calculation based on active clients and request volume
    const activeClients = this.clients.size;
    const totalRequests = Array.from(this.clients.values())
      .reduce((sum, client) => sum + client.requests, 0);
    
    const loadScore = Math.min(1, (activeClients * totalRequests) / 10000);
    return loadScore;
  }
  
  private static getThrottleConfig(request: Request, rule: RateLimitRule): ThrottleConfig {
    const url = new URL(request.url);
    
    // Define throttling based on endpoint type
    if (url.pathname.includes("/upload")) {
      return {
        enabled: true,
        maxConcurrent: 2,
        queueSize: 10,
        priority: () => 1,
        timeout: 30000
      };
    }
    
    if (url.pathname.includes("/search")) {
      return {
        enabled: true,
        maxConcurrent: 5,
        queueSize: 20,
        priority: () => 2,
        timeout: 10000
      };
    }
    
    return {
      enabled: false,
      maxConcurrent: 10,
      queueSize: 50,
      priority: () => 1,
      timeout: 5000
    };
  }
  
  private static createRateLimitResponse(limitResult: any, rule: RateLimitRule): Response {
    const message = rule.config.message || "Rate limit exceeded. Please try again later.";
    
    const headers = new Headers({
      "Content-Type": "application/json",
      "Retry-After": Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString()
    });
    
    if (rule.config.headers) {
      headers.set("X-RateLimit-Limit", rule.config.maxRequests.toString());
      headers.set("X-RateLimit-Remaining", limitResult.remaining.toString());
      headers.set("X-RateLimit-Reset", new Date(limitResult.resetTime).toISOString());
    }
    
    return new Response(JSON.stringify({
      error: "Rate Limit Exceeded",
      message,
      retryAfter: Math.ceil((limitResult.resetTime - Date.now()) / 1000)
    }), {
      status: 429,
      headers
    });
  }
  
  private static createThrottleResponse(): Response {
    return new Response(JSON.stringify({
      error: "Service Throttled",
      message: "Service is temporarily throttled due to high load. Please try again later.",
      retryAfter: 30
    }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "30"
      }
    });
  }
  
  private static addRateLimitHeaders(response: Response, limitResult: any) {
    const headers = new Headers(response.headers);
    headers.set("X-RateLimit-Remaining", limitResult.remaining.toString());
    headers.set("X-RateLimit-Reset", new Date(limitResult.resetTime).toISOString());
    headers.set("X-RateLimit-Total", limitResult.total.toString());
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
  
  private static cleanup() {
    const now = Date.now();
    const expiredClients = [];
    
    // Clean up old client metrics
    for (const [key, client] of this.clients) {
      if (now - client.lastRequest > 24 * 60 * 60 * 1000) { // 24 hours
        expiredClients.push(key);
      }
    }
    
    expiredClients.forEach(key => this.clients.delete(key));
    
    // Clean up old queue entries
    const validQueue = this.requestQueue.filter(item => 
      now - item.timestamp < 60000 // 1 minute
    );
    this.requestQueue.length = 0;
    this.requestQueue.push(...validQueue);
    
    if (expiredClients.length > 0) {
      telemetry.logger.info("Rate limit cleanup", { 
        expiredClients: expiredClients.length,
        activeClients: this.clients.size 
      });
    }
  }
  
  // Public API methods
  
  static addRule(rule: RateLimitRule) {
    this.rules.set(rule.id, rule);
    telemetry.logger.info("Rate limit rule added", { ruleId: rule.id, pattern: rule.pattern });
  }
  
  static removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      telemetry.logger.info("Rate limit rule removed", { ruleId });
    }
    return removed;
  }
  
  static getClientMetrics(clientKey?: string) {
    if (clientKey) {
      return this.clients.get(clientKey);
    }
    return Array.from(this.clients.entries()).map(([key, metrics]) => ({
      clientKey: key,
      ...metrics
    }));
  }
  
  static getSystemStats() {
    return {
      totalClients: this.clients.size,
      totalRules: this.rules.size,
      queueLength: this.requestQueue.length,
      systemLoad: this.getSystemLoad(),
      adaptiveSettings: this.adaptiveSettings
    };
  }
  
  static resetClient(clientKey: string): boolean {
    return this.clients.delete(clientKey);
  }
  
  static updateAdaptiveSettings(settings: Partial<AdaptiveSettings>) {
    this.adaptiveSettings = { ...this.adaptiveSettings, ...settings };
    telemetry.logger.info("Adaptive rate limit settings updated", settings);
  }
}