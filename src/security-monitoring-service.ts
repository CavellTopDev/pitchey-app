/**
 * Security Monitoring and Rate Limiting Service for Pitchey Platform
 * Provides comprehensive security monitoring, rate limiting, and threat detection
 */

import { Toucan } from "toucan-js";

// Security monitoring interfaces
interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  source: {
    ip: string;
    userAgent?: string;
    countryCode?: string;
    asn?: string;
  };
  target: {
    endpoint: string;
    method: string;
    userId?: string;
    resource?: string;
  };
  details: Record<string, any>;
  riskScore: number;
  blocked: boolean;
}

type SecurityEventType = 
  | 'rate_limit_exceeded'
  | 'suspicious_login_attempt'
  | 'brute_force_attack'
  | 'sql_injection_attempt'
  | 'xss_attempt'
  | 'malicious_file_upload'
  | 'anomalous_behavior'
  | 'unauthorized_access'
  | 'data_exfiltration'
  | 'ddos_attack'
  | 'account_takeover'
  | 'privilege_escalation';

interface RateLimitConfig {
  endpoint: string;
  limits: {
    requests: number;
    windowMs: number;
    type: 'fixed' | 'sliding';
  }[];
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: 'ip' | 'user' | 'combined';
  store: 'memory' | 'kv';
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

interface SecurityRule {
  id: string;
  name: string;
  type: SecurityEventType;
  enabled: boolean;
  conditions: SecurityCondition[];
  actions: SecurityAction[];
  priority: number;
}

interface SecurityCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'gt' | 'lt' | 'in';
  value: any;
}

interface SecurityAction {
  type: 'block' | 'alert' | 'captcha' | 'log' | 'rate_limit';
  config?: Record<string, any>;
}

interface ThreatIntelligence {
  ip: string;
  riskScore: number;
  categories: string[];
  lastSeen: number;
  source: string;
}

interface AnomalyDetection {
  userId?: string;
  ip: string;
  patterns: {
    requestVolume: number;
    errorRate: number;
    uniqueEndpoints: number;
    timePattern: number[];
  };
  baselineDeviation: number;
  anomalyScore: number;
}

export class SecurityMonitoringService {
  private sentry: Toucan;
  private kv: any;
  private rateLimitConfigs: Map<string, RateLimitConfig> = new Map();
  private securityRules: SecurityRule[] = [];
  private threatIntelCache: Map<string, ThreatIntelligence> = new Map();

  constructor(sentry: Toucan, bindings: any) {
    this.sentry = sentry;
    this.kv = bindings.KV;
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default security configurations
   */
  private initializeDefaultConfigs(): void {
    // Rate limiting configurations
    this.rateLimitConfigs.set('/api/auth/login', {
      endpoint: '/api/auth/login',
      limits: [
        { requests: 5, windowMs: 15 * 60 * 1000, type: 'sliding' }, // 5 per 15 minutes
        { requests: 20, windowMs: 60 * 60 * 1000, type: 'sliding' }  // 20 per hour
      ],
      keyGenerator: 'ip'
    });

    this.rateLimitConfigs.set('/api/pitches', {
      endpoint: '/api/pitches',
      limits: [
        { requests: 100, windowMs: 60 * 1000, type: 'sliding' },     // 100 per minute
        { requests: 1000, windowMs: 60 * 60 * 1000, type: 'sliding' } // 1000 per hour
      ],
      keyGenerator: 'user'
    });

    this.rateLimitConfigs.set('/api/upload', {
      endpoint: '/api/upload',
      limits: [
        { requests: 10, windowMs: 60 * 1000, type: 'sliding' },      // 10 per minute
        { requests: 100, windowMs: 60 * 60 * 1000, type: 'sliding' }  // 100 per hour
      ],
      keyGenerator: 'combined'
    });

    // Security rules
    this.securityRules = [
      {
        id: 'brute-force-detection',
        name: 'Brute Force Attack Detection',
        type: 'brute_force_attack',
        enabled: true,
        conditions: [
          { field: 'failed_logins', operator: 'gt', value: 5 },
          { field: 'time_window', operator: 'lt', value: 300000 } // 5 minutes
        ],
        actions: [
          { type: 'block', config: { duration: 3600000 } }, // 1 hour
          { type: 'alert', config: { severity: 'high' } }
        ],
        priority: 1
      },
      {
        id: 'sql-injection-detection',
        name: 'SQL Injection Attempt Detection',
        type: 'sql_injection_attempt',
        enabled: true,
        conditions: [
          { field: 'request_body', operator: 'regex', value: '(union|select|insert|update|delete|drop|exec|script)' },
          { field: 'query_params', operator: 'regex', value: '(\\'|\\"|\\;|\\-\\-|\\/\\*|\\*\\/|xp_)' }
        ],
        actions: [
          { type: 'block' },
          { type: 'alert', config: { severity: 'critical' } }
        ],
        priority: 1
      },
      {
        id: 'xss-detection',
        name: 'Cross-Site Scripting Detection',
        type: 'xss_attempt',
        enabled: true,
        conditions: [
          { field: 'request_params', operator: 'regex', value: '(<script|<iframe|javascript:|vbscript:|onload=|onerror=)' }
        ],
        actions: [
          { type: 'block' },
          { type: 'alert', config: { severity: 'high' } }
        ],
        priority: 1
      }
    ];
  }

  /**
   * Check rate limits for a request
   */
  async checkRateLimit(
    endpoint: string, 
    identifier: string, 
    userId?: string
  ): Promise<RateLimitResult> {
    try {
      const config = this.rateLimitConfigs.get(endpoint) || this.getDefaultRateLimit();
      const key = this.generateRateLimitKey(endpoint, identifier, userId, config.keyGenerator);

      let minRemaining = Number.MAX_SAFE_INTEGER;
      let earliestReset = 0;
      let totalHits = 0;
      let allowed = true;

      for (const limit of config.limits) {
        const limitKey = `${key}:${limit.windowMs}`;
        const result = await this.checkSingleRateLimit(limitKey, limit);
        
        minRemaining = Math.min(minRemaining, result.remaining);
        earliestReset = Math.max(earliestReset, result.resetTime);
        totalHits = Math.max(totalHits, result.totalHits);
        
        if (!result.allowed) {
          allowed = false;
        }
      }

      // Log rate limit metrics
      await this.recordRateLimitMetrics(endpoint, identifier, allowed, totalHits);

      return {
        allowed,
        remaining: minRemaining,
        resetTime: earliestReset,
        totalHits
      };

    } catch (error) {
      this.sentry.captureException(error);
      // Fail open in case of errors
      return {
        allowed: true,
        remaining: 1000,
        resetTime: Date.now() + 60000,
        totalHits: 0
      };
    }
  }

  /**
   * Check single rate limit rule
   */
  private async checkSingleRateLimit(
    key: string, 
    limit: { requests: number; windowMs: number; type: 'fixed' | 'sliding' }
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - limit.windowMs;

    if (limit.type === 'sliding') {
      return await this.checkSlidingWindowLimit(key, limit.requests, windowStart, now);
    } else {
      return await this.checkFixedWindowLimit(key, limit.requests, limit.windowMs, now);
    }
  }

  /**
   * Sliding window rate limit implementation
   */
  private async checkSlidingWindowLimit(
    key: string, 
    maxRequests: number, 
    windowStart: number, 
    now: number
  ): Promise<RateLimitResult> {
    const requestsData = await this.kv.get(key);
    let requests: number[] = requestsData ? JSON.parse(requestsData) : [];
    
    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we're within limits
    const allowed = requests.length < maxRequests;
    
    if (allowed) {
      // Add current request
      requests.push(now);
      await this.kv.put(key, JSON.stringify(requests), { expirationTtl: Math.ceil((now - windowStart) / 1000) + 60 });
    }

    return {
      allowed,
      remaining: Math.max(0, maxRequests - requests.length - (allowed ? 0 : 1)),
      resetTime: requests.length > 0 ? requests[0] + (now - windowStart) : now + (now - windowStart),
      totalHits: requests.length + (allowed ? 0 : 1)
    };
  }

  /**
   * Fixed window rate limit implementation
   */
  private async checkFixedWindowLimit(
    key: string, 
    maxRequests: number, 
    windowMs: number, 
    now: number
  ): Promise<RateLimitResult> {
    const windowKey = `${key}:${Math.floor(now / windowMs)}`;
    const currentCount = parseInt(await this.kv.get(windowKey) || '0');
    
    const allowed = currentCount < maxRequests;
    
    if (allowed) {
      await this.kv.put(windowKey, (currentCount + 1).toString(), { expirationTtl: Math.ceil(windowMs / 1000) + 60 });
    }

    const resetTime = Math.ceil(now / windowMs) * windowMs + windowMs;

    return {
      allowed,
      remaining: Math.max(0, maxRequests - currentCount - (allowed ? 1 : 0)),
      resetTime,
      totalHits: currentCount + (allowed ? 1 : 0)
    };
  }

  /**
   * Analyze request for security threats
   */
  async analyzeRequest(request: Request, userId?: string): Promise<SecurityEvent[]> {
    const events: SecurityEvent[] = [];
    const url = new URL(request.url);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || '';

    try {
      // Check threat intelligence
      const threatInfo = await this.checkThreatIntelligence(ip);
      
      // Analyze for different threat types
      const threatChecks = [
        this.checkSQLInjection(request),
        this.checkXSS(request),
        this.checkMaliciousPatterns(request),
        this.checkAnomalousBehavior(ip, userId, url.pathname)
      ];

      const threatResults = await Promise.all(threatChecks);
      events.push(...threatResults.filter(event => event !== null) as SecurityEvent[]);

      // Apply security rules
      for (const rule of this.securityRules.filter(r => r.enabled)) {
        const ruleEvent = await this.evaluateSecurityRule(rule, request, threatInfo);
        if (ruleEvent) {
          events.push(ruleEvent);
        }
      }

      // Log all security events
      for (const event of events) {
        await this.recordSecurityEvent(event);
      }

      return events;

    } catch (error) {
      this.sentry.captureException(error);
      return [];
    }
  }

  /**
   * Check threat intelligence for IP
   */
  private async checkThreatIntelligence(ip: string): Promise<ThreatIntelligence | null> {
    try {
      // Check cache first
      if (this.threatIntelCache.has(ip)) {
        const cached = this.threatIntelCache.get(ip)!;
        if (Date.now() - cached.lastSeen < 3600000) { // 1 hour cache
          return cached;
        }
      }

      // Check stored threat data
      const threatData = await this.kv.get(`threat:${ip}`);
      if (threatData) {
        const threat = JSON.parse(threatData);
        this.threatIntelCache.set(ip, threat);
        return threat;
      }

      // For production, this would integrate with threat intelligence feeds
      // For now, return null (no threat data)
      return null;

    } catch (error) {
      console.warn('Failed to check threat intelligence:', error);
      return null;
    }
  }

  /**
   * Check for SQL injection attempts
   */
  private async checkSQLInjection(request: Request): Promise<SecurityEvent | null> {
    try {
      const url = new URL(request.url);
      const suspicious = [
        'union', 'select', 'insert', 'update', 'delete', 'drop', 'exec', 'script',
        "'", '"', ';', '--', '/*', '*/', 'xp_'
      ];

      const testStrings = [
        url.search,
        url.hash,
        await this.safeGetRequestBody(request)
      ].filter(Boolean);

      for (const testString of testStrings) {
        for (const pattern of suspicious) {
          if (testString.toLowerCase().includes(pattern.toLowerCase())) {
            return this.createSecurityEvent(
              'sql_injection_attempt',
              'critical',
              request,
              { pattern, location: 'request_body' },
              90
            );
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check for XSS attempts
   */
  private async checkXSS(request: Request): Promise<SecurityEvent | null> {
    try {
      const url = new URL(request.url);
      const xssPatterns = [
        /<script/i,
        /<iframe/i,
        /javascript:/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i,
        /onclick=/i
      ];

      const testStrings = [
        url.search,
        url.hash,
        await this.safeGetRequestBody(request)
      ].filter(Boolean);

      for (const testString of testStrings) {
        for (const pattern of xssPatterns) {
          if (pattern.test(testString)) {
            return this.createSecurityEvent(
              'xss_attempt',
              'high',
              request,
              { pattern: pattern.toString(), location: 'request_params' },
              80
            );
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check for other malicious patterns
   */
  private async checkMaliciousPatterns(request: Request): Promise<SecurityEvent | null> {
    try {
      const url = new URL(request.url);
      const userAgent = request.headers.get('User-Agent') || '';

      // Check for suspicious user agents
      const maliciousAgents = [
        'sqlmap', 'nikto', 'nmap', 'masscan', 'gobuster', 'dirb', 'dirbuster'
      ];

      for (const agent of maliciousAgents) {
        if (userAgent.toLowerCase().includes(agent)) {
          return this.createSecurityEvent(
            'suspicious_login_attempt',
            'high',
            request,
            { maliciousAgent: agent },
            85
          );
        }
      }

      // Check for path traversal
      if (url.pathname.includes('../') || url.pathname.includes('..\\')) {
        return this.createSecurityEvent(
          'unauthorized_access',
          'medium',
          request,
          { attack: 'path_traversal' },
          60
        );
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check for anomalous behavior patterns
   */
  private async checkAnomalousBehavior(ip: string, userId?: string, endpoint?: string): Promise<SecurityEvent | null> {
    try {
      const identifier = userId ? `user:${userId}` : `ip:${ip}`;
      const behaviorKey = `behavior:${identifier}`;
      
      const behaviorData = await this.kv.get(behaviorKey);
      const behavior = behaviorData ? JSON.parse(behaviorData) : {
        requestCount: 0,
        uniqueEndpoints: new Set(),
        errorCount: 0,
        startTime: Date.now()
      };

      behavior.requestCount++;
      if (endpoint) {
        behavior.uniqueEndpoints.add(endpoint);
      }

      // Check for anomalous patterns
      const timeWindow = Date.now() - behavior.startTime;
      const requestRate = behavior.requestCount / (timeWindow / 1000); // requests per second
      
      // High request rate anomaly
      if (requestRate > 10) { // More than 10 requests per second
        return this.createSecurityEvent(
          'anomalous_behavior',
          'medium',
          { headers: new Headers(), url: `http://example.com${endpoint}` } as Request,
          { requestRate, timeWindow },
          70
        );
      }

      // Store updated behavior
      await this.kv.put(behaviorKey, JSON.stringify({
        ...behavior,
        uniqueEndpoints: Array.from(behavior.uniqueEndpoints)
      }), { expirationTtl: 3600 });

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Evaluate security rule
   */
  private async evaluateSecurityRule(
    rule: SecurityRule, 
    request: Request, 
    threatInfo: ThreatIntelligence | null
  ): Promise<SecurityEvent | null> {
    try {
      // Simple rule evaluation - in production this would be more sophisticated
      const requestData = {
        url: request.url,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries()),
        body: await this.safeGetRequestBody(request),
        threatInfo
      };

      // Check if all conditions match
      const matches = rule.conditions.every(condition => 
        this.evaluateCondition(condition, requestData)
      );

      if (matches) {
        return this.createSecurityEvent(
          rule.type,
          'medium',
          request,
          { rule: rule.id, ruleName: rule.name },
          60
        );
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Evaluate individual security condition
   */
  private evaluateCondition(condition: SecurityCondition, data: any): boolean {
    try {
      const fieldValue = this.getNestedField(data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'regex':
          return new RegExp(condition.value, 'i').test(String(fieldValue));
        case 'gt':
          return Number(fieldValue) > Number(condition.value);
        case 'lt':
          return Number(fieldValue) < Number(condition.value);
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  // Helper methods

  private generateRateLimitKey(
    endpoint: string, 
    identifier: string, 
    userId?: string, 
    keyType?: string
  ): string {
    switch (keyType) {
      case 'user':
        return `rate_limit:user:${userId || identifier}:${endpoint}`;
      case 'combined':
        return `rate_limit:combined:${identifier}:${userId || 'anonymous'}:${endpoint}`;
      default:
        return `rate_limit:ip:${identifier}:${endpoint}`;
    }
  }

  private getDefaultRateLimit(): RateLimitConfig {
    return {
      endpoint: 'default',
      limits: [
        { requests: 1000, windowMs: 60 * 1000, type: 'sliding' }
      ],
      keyGenerator: 'ip'
    };
  }

  private async recordRateLimitMetrics(
    endpoint: string, 
    identifier: string, 
    allowed: boolean, 
    totalHits: number
  ): Promise<void> {
    try {
      const metricsKey = `metrics:rate_limit:${endpoint}`;
      const metrics = await this.kv.get(metricsKey);
      const data = metrics ? JSON.parse(metrics) : { requests: 0, blocked: 0 };
      
      data.requests++;
      if (!allowed) data.blocked++;
      
      await this.kv.put(metricsKey, JSON.stringify(data), { expirationTtl: 3600 });
    } catch (error) {
      console.warn('Failed to record rate limit metrics:', error);
    }
  }

  private createSecurityEvent(
    type: SecurityEventType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    request: Request,
    details: Record<string, any>,
    riskScore: number
  ): SecurityEvent {
    const url = new URL(request.url);
    
    return {
      id: this.generateEventId(),
      type,
      severity,
      timestamp: Date.now(),
      source: {
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent'),
        countryCode: request.headers.get('CF-IPCountry') || undefined
      },
      target: {
        endpoint: url.pathname,
        method: request.method
      },
      details,
      riskScore,
      blocked: false // Will be determined by actions
    };
  }

  private async recordSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Store event
      await this.kv.put(`security_event:${event.id}`, JSON.stringify(event), { expirationTtl: 86400 * 30 });
      
      // Update metrics
      const metricsKey = `metrics:security:${event.type}`;
      const metrics = await this.kv.get(metricsKey);
      const data = metrics ? JSON.parse(metrics) : { count: 0, lastSeen: 0 };
      
      data.count++;
      data.lastSeen = event.timestamp;
      
      await this.kv.put(metricsKey, JSON.stringify(data), { expirationTtl: 86400 });

      // Send critical events to Sentry
      if (event.severity === 'critical' || event.severity === 'high') {
        this.sentry.captureMessage(`Security Event: ${event.type}`, {
          level: event.severity === 'critical' ? 'error' : 'warning',
          tags: {
            securityEventType: event.type,
            severity: event.severity,
            sourceIp: event.source.ip,
            targetEndpoint: event.target.endpoint
          },
          extra: {
            event,
            riskScore: event.riskScore
          }
        });
      }

    } catch (error) {
      console.warn('Failed to record security event:', error);
    }
  }

  private async safeGetRequestBody(request: Request): Promise<string> {
    try {
      if (request.method === 'GET' || request.method === 'HEAD') return '';
      
      const cloned = request.clone();
      const body = await cloned.text();
      return body;
    } catch {
      return '';
    }
  }

  private getNestedField(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get security metrics summary
   */
  async getSecurityMetrics(): Promise<any> {
    try {
      const eventTypes: SecurityEventType[] = [
        'rate_limit_exceeded', 'suspicious_login_attempt', 'brute_force_attack',
        'sql_injection_attempt', 'xss_attempt', 'anomalous_behavior'
      ];

      const metrics: any = {};
      
      for (const eventType of eventTypes) {
        const metricsKey = `metrics:security:${eventType}`;
        const data = await this.kv.get(metricsKey);
        metrics[eventType] = data ? JSON.parse(data) : { count: 0, lastSeen: 0 };
      }

      return {
        timestamp: Date.now(),
        events: metrics,
        totalEvents: Object.values(metrics).reduce((sum: number, m: any) => sum + m.count, 0)
      };

    } catch (error) {
      this.sentry.captureException(error);
      return { error: error.message, timestamp: Date.now() };
    }
  }
}

/**
 * Security Monitoring Worker
 */
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const sentry = new Toucan({
      dsn: env.SENTRY_DSN,
      context: {
        waitUntil: (promise: Promise<any>) => promise,
        request,
      },
      environment: env.ENVIRONMENT || 'production',
      release: env.SENTRY_RELEASE,
    });

    const securityService = new SecurityMonitoringService(sentry, env);
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/security/rate-limit':
          const endpoint = url.searchParams.get('endpoint') || '/api/default';
          const identifier = url.searchParams.get('identifier') || 'unknown';
          const userId = url.searchParams.get('userId');
          
          const rateLimitResult = await securityService.checkRateLimit(endpoint, identifier, userId);
          return new Response(JSON.stringify(rateLimitResult), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/security/analyze':
          const events = await securityService.analyzeRequest(request);
          return new Response(JSON.stringify({ events, count: events.length }), {
            headers: { 'Content-Type': 'application/json' }
          });

        case '/security/metrics':
          const metrics = await securityService.getSecurityMetrics();
          return new Response(JSON.stringify(metrics), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Security monitoring endpoint not found', { status: 404 });
      }

    } catch (error) {
      sentry.captureException(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};