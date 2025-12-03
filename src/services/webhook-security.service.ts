/**
 * Webhook Security Service
 * Handles authentication, authorization, rate limiting, and security monitoring
 */

import crypto from 'crypto';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import {
  webhookEndpoints,
  webhookLogs,
  webhookRateLimits,
  webhookCircuitBreakers,
  WebhookEndpoint,
} from '../db/webhook-schema';
import { users } from '../db/schema';

interface SecurityConfig {
  maxEndpointsPerUser: number;
  maxEventsPerHour: number;
  maxRetryAttempts: number;
  signatureExpiry: number; // seconds
  allowedIpRanges?: string[];
  blockedIpRanges?: string[];
  requireHttps: boolean;
  maxPayloadSize: number; // bytes
  timeoutLimit: number; // seconds
}

interface SecurityViolation {
  type: 'rate_limit' | 'signature_invalid' | 'ip_blocked' | 'payload_too_large' | 'timeout_exceeded' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  endpointId?: number;
  userId?: number;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: Date;
}

interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;
}

interface SignatureValidationResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
  expired?: boolean;
}

export class WebhookSecurityService {
  private db: ReturnType<typeof drizzle>;
  private config: SecurityConfig;
  private violationCallbacks: Array<(violation: SecurityViolation) => void> = [];

  constructor(
    databaseUrl: string,
    config: Partial<SecurityConfig> = {}
  ) {
    this.db = drizzle({ connection: databaseUrl });
    this.config = {
      maxEndpointsPerUser: 50,
      maxEventsPerHour: 10000,
      maxRetryAttempts: 5,
      signatureExpiry: 300, // 5 minutes
      requireHttps: true,
      maxPayloadSize: 1024 * 1024, // 1MB
      timeoutLimit: 60,
      ...config,
    };
  }

  // ============================================================================
  // AUTHENTICATION AND AUTHORIZATION
  // ============================================================================

  /**
   * Validate webhook signature
   */
  validateSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
    timestamp?: string
  ): SignatureValidationResult {
    try {
      // Extract timestamp if provided in headers
      const requestTimestamp = timestamp ? parseInt(timestamp, 10) : Date.now();
      const currentTimestamp = Date.now();

      // Check if timestamp is within acceptable range (prevent replay attacks)
      const timeDiff = Math.abs(currentTimestamp - requestTimestamp) / 1000;
      if (timeDiff > this.config.signatureExpiry) {
        return {
          valid: false,
          reason: 'Timestamp too old',
          timestamp: requestTimestamp,
          expired: true,
        };
      }

      // Calculate expected signature
      const payloadString = payload instanceof Buffer ? payload.toString() : payload;
      const signaturePayload = timestamp ? `${timestamp}.${payloadString}` : payloadString;
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signaturePayload)
        .digest('hex');

      // Extract signature from header (remove 'sha256=' prefix if present)
      const providedSignature = signature.startsWith('sha256=')
        ? signature.substring(7)
        : signature;

      // Use timing-safe comparison to prevent timing attacks
      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );

      return {
        valid: isValid,
        timestamp: requestTimestamp,
        reason: isValid ? undefined : 'Signature mismatch',
      };
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid signature format',
      };
    }
  }

  /**
   * Generate secure webhook secret
   */
  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Rotate webhook secret
   */
  async rotateWebhookSecret(endpointId: number, userId: number): Promise<string> {
    const newSecret = this.generateWebhookSecret();
    
    await this.db
      .update(webhookEndpoints)
      .set({
        secret: newSecret,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.userId, userId)
        )
      );

    await this.logSecurityEvent('info', 'webhook_secret_rotated', {
      endpointId,
      userId,
      rotatedAt: new Date().toISOString(),
    });

    return newSecret;
  }

  /**
   * Validate endpoint ownership
   */
  async validateEndpointAccess(endpointId: number, userId: number): Promise<boolean> {
    const [endpoint] = await this.db
      .select({ userId: webhookEndpoints.userId })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, endpointId),
          eq(webhookEndpoints.userId, userId)
        )
      );

    return !!endpoint;
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  /**
   * Check rate limit for endpoint
   */
  async checkRateLimit(endpointId: number): Promise<RateLimitResult> {
    const [rateLimit] = await this.db
      .select()
      .from(webhookRateLimits)
      .where(eq(webhookRateLimits.endpointId, endpointId));

    if (!rateLimit) {
      // No rate limit configured
      return {
        allowed: true,
        remainingRequests: 1000,
        resetTime: new Date(Date.now() + 60000),
      };
    }

    const now = new Date();
    
    // Reset window if expired
    if (now > rateLimit.windowEnd!) {
      const newWindowEnd = new Date(now.getTime() + rateLimit.windowSize * 1000);
      
      await this.db
        .update(webhookRateLimits)
        .set({
          currentCount: 1,
          windowStart: now,
          windowEnd: newWindowEnd,
          updatedAt: now,
        })
        .where(eq(webhookRateLimits.id, rateLimit.id));

      return {
        allowed: true,
        remainingRequests: rateLimit.maxRequests - 1,
        resetTime: newWindowEnd,
      };
    }

    // Check if limit exceeded
    if (rateLimit.currentCount >= rateLimit.maxRequests) {
      await this.recordRateLimitViolation(endpointId, rateLimit);
      
      const retryAfter = Math.ceil((rateLimit.windowEnd!.getTime() - now.getTime()) / 1000);
      
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: rateLimit.windowEnd!,
        retryAfter,
      };
    }

    // Increment counter
    await this.db
      .update(webhookRateLimits)
      .set({
        currentCount: rateLimit.currentCount + 1,
        updatedAt: now,
      })
      .where(eq(webhookRateLimits.id, rateLimit.id));

    return {
      allowed: true,
      remainingRequests: rateLimit.maxRequests - rateLimit.currentCount - 1,
      resetTime: rateLimit.windowEnd!,
    };
  }

  /**
   * Check global rate limit for user
   */
  async checkGlobalRateLimit(userId: number): Promise<RateLimitResult> {
    const windowStart = new Date();
    windowStart.setHours(windowStart.getHours() - 1); // 1 hour window

    // Count events in the last hour
    const [eventCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.userId, userId),
          gte(webhookLogs.timestamp, windowStart),
          eq(webhookLogs.category, 'delivery')
        )
      );

    const count = eventCount?.count || 0;
    const allowed = count < this.config.maxEventsPerHour;
    
    if (!allowed) {
      await this.recordGlobalRateLimitViolation(userId, count);
    }

    return {
      allowed,
      remainingRequests: Math.max(0, this.config.maxEventsPerHour - count),
      resetTime: new Date(Date.now() + 60 * 60 * 1000), // Next hour
    };
  }

  /**
   * Implement adaptive rate limiting
   */
  async updateAdaptiveRateLimit(endpointId: number, success: boolean, responseTime: number): Promise<void> {
    const [rateLimit] = await this.db
      .select()
      .from(webhookRateLimits)
      .where(eq(webhookRateLimits.endpointId, endpointId));

    if (!rateLimit || !rateLimit.isAdaptive) return;

    let newMultiplier = rateLimit.adaptiveMultiplier || 1.0;

    if (success && responseTime < 1000) {
      // Good performance, increase limit slightly
      newMultiplier = Math.min(2.0, newMultiplier * 1.1);
    } else if (!success || responseTime > 5000) {
      // Poor performance, decrease limit
      newMultiplier = Math.max(0.1, newMultiplier * 0.9);
    }

    const newLimit = Math.floor((rateLimit.baseLimit || rateLimit.maxRequests) * newMultiplier);

    await this.db
      .update(webhookRateLimits)
      .set({
        maxRequests: newLimit,
        adaptiveMultiplier: newMultiplier,
        updatedAt: new Date(),
      })
      .where(eq(webhookRateLimits.id, rateLimit.id));
  }

  // ============================================================================
  // SECURITY MONITORING
  // ============================================================================

  /**
   * Validate request security
   */
  async validateRequestSecurity(
    request: {
      url: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
      ipAddress: string;
      userAgent: string;
    },
    endpointId?: number
  ): Promise<{ valid: boolean; violations: SecurityViolation[] }> {
    const violations: SecurityViolation[] = [];

    // Check HTTPS requirement
    if (this.config.requireHttps && !request.url.startsWith('https://')) {
      violations.push({
        type: 'suspicious_activity',
        severity: 'medium',
        endpointId,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        details: { reason: 'Non-HTTPS URL', url: request.url },
        timestamp: new Date(),
      });
    }

    // Check payload size
    if (request.body && Buffer.byteLength(request.body) > this.config.maxPayloadSize) {
      violations.push({
        type: 'payload_too_large',
        severity: 'medium',
        endpointId,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        details: { 
          payloadSize: Buffer.byteLength(request.body),
          maxSize: this.config.maxPayloadSize 
        },
        timestamp: new Date(),
      });
    }

    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(request);
    violations.push(...suspiciousPatterns);

    // Check IP restrictions
    const ipViolation = this.checkIpRestrictions(request.ipAddress, endpointId);
    if (ipViolation) {
      violations.push(ipViolation);
    }

    // Log violations
    for (const violation of violations) {
      await this.recordSecurityViolation(violation);
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Detect suspicious patterns in request
   */
  private detectSuspiciousPatterns(request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    ipAddress: string;
    userAgent: string;
  }): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Check for SQL injection patterns
    if (request.body && this.containsSqlInjectionPatterns(request.body)) {
      violations.push({
        type: 'suspicious_activity',
        severity: 'high',
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        details: { reason: 'SQL injection pattern detected', body: request.body.substring(0, 500) },
        timestamp: new Date(),
      });
    }

    // Check for XSS patterns
    if (request.body && this.containsXssPatterns(request.body)) {
      violations.push({
        type: 'suspicious_activity',
        severity: 'high',
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        details: { reason: 'XSS pattern detected', body: request.body.substring(0, 500) },
        timestamp: new Date(),
      });
    }

    // Check for suspicious user agents
    if (this.isSuspiciousUserAgent(request.userAgent)) {
      violations.push({
        type: 'suspicious_activity',
        severity: 'low',
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        details: { reason: 'Suspicious user agent' },
        timestamp: new Date(),
      });
    }

    // Check for excessive header count
    if (Object.keys(request.headers).length > 50) {
      violations.push({
        type: 'suspicious_activity',
        severity: 'medium',
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        details: { reason: 'Excessive headers', headerCount: Object.keys(request.headers).length },
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Check IP restrictions
   */
  private checkIpRestrictions(ipAddress: string, endpointId?: number): SecurityViolation | null {
    // Check blocked IP ranges
    if (this.config.blockedIpRanges && this.isIpInRanges(ipAddress, this.config.blockedIpRanges)) {
      return {
        type: 'ip_blocked',
        severity: 'high',
        endpointId,
        ipAddress,
        userAgent: '',
        details: { reason: 'IP in blocked range' },
        timestamp: new Date(),
      };
    }

    // Check allowed IP ranges (if configured)
    if (this.config.allowedIpRanges && !this.isIpInRanges(ipAddress, this.config.allowedIpRanges)) {
      return {
        type: 'ip_blocked',
        severity: 'medium',
        endpointId,
        ipAddress,
        userAgent: '',
        details: { reason: 'IP not in allowed range' },
        timestamp: new Date(),
      };
    }

    return null;
  }

  // ============================================================================
  // CIRCUIT BREAKER SECURITY
  // ============================================================================

  /**
   * Check if circuit breaker should trigger for security reasons
   */
  async checkSecurityCircuitBreaker(endpointId: number): Promise<boolean> {
    const [circuitBreaker] = await this.db
      .select()
      .from(webhookCircuitBreakers)
      .where(eq(webhookCircuitBreakers.endpointId, endpointId));

    if (!circuitBreaker) return false;

    // Check if we have too many security violations recently
    const recentViolations = await this.getRecentSecurityViolations(endpointId, 60); // Last hour

    if (recentViolations.length >= 10) {
      await this.triggerSecurityCircuitBreaker(endpointId, 'Too many security violations');
      return true;
    }

    return circuitBreaker.state === 'open';
  }

  /**
   * Trigger circuit breaker for security reasons
   */
  private async triggerSecurityCircuitBreaker(endpointId: number, reason: string): Promise<void> {
    await this.db
      .update(webhookCircuitBreakers)
      .set({
        state: 'open',
        consecutiveFailures: 999, // High number to indicate security trigger
        nextAttemptAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour lockout
        openedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookCircuitBreakers.endpointId, endpointId));

    await this.logSecurityEvent('error', 'security_circuit_breaker_triggered', {
      endpointId,
      reason,
      lockoutUntil: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  // ============================================================================
  // SECURITY AUDITING AND COMPLIANCE
  // ============================================================================

  /**
   * Generate security audit report
   */
  async generateSecurityAuditReport(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    // Get user endpoints
    const endpoints = await this.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.userId, userId));

    const endpointIds = endpoints.map(e => e.id);

    // Get security violations
    const violations = await this.db
      .select()
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.userId, userId),
          eq(webhookLogs.category, 'security'),
          gte(webhookLogs.timestamp, startDate),
          lte(webhookLogs.timestamp, endDate),
          endpointIds.length > 0 ? inArray(webhookLogs.endpointId, endpointIds) : sql`false`
        )
      )
      .orderBy(desc(webhookLogs.timestamp));

    // Group violations by type
    const violationsByType = violations.reduce((acc, violation) => {
      const type = violation.context?.type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate security score
    const securityScore = this.calculateSecurityScore(endpoints, violations);

    return {
      userId,
      period: { startDate, endDate },
      endpoints: endpoints.map(e => ({
        id: e.id,
        name: e.name,
        url: e.url,
        isActive: e.isActive,
        healthStatus: e.healthStatus,
      })),
      violations: {
        total: violations.length,
        byType: violationsByType,
        recent: violations.slice(0, 10),
      },
      securityScore,
      recommendations: this.generateSecurityRecommendations(securityScore, violationsByType),
      compliance: {
        httpsRequired: this.config.requireHttps,
        signatureValidation: true,
        rateLimiting: true,
        ipRestrictions: !!(this.config.allowedIpRanges || this.config.blockedIpRanges),
      },
    };
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(endpoints: any[], violations: any[]): number {
    let score = 100;

    // Deduct points for violations
    score -= Math.min(50, violations.length * 2);

    // Deduct points for insecure configurations
    const insecureEndpoints = endpoints.filter(e => !e.url.startsWith('https://'));
    score -= insecureEndpoints.length * 5;

    // Deduct points for inactive endpoints (potential security risk)
    const inactiveEndpoints = endpoints.filter(e => !e.isActive);
    score -= inactiveEndpoints.length * 2;

    return Math.max(0, score);
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    securityScore: number,
    violationsByType: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    if (securityScore < 70) {
      recommendations.push('Your security score is below recommended levels. Review the security violations and implement suggested fixes.');
    }

    if (violationsByType.signature_invalid > 0) {
      recommendations.push('Invalid signature violations detected. Ensure webhook secrets are properly configured and not exposed.');
    }

    if (violationsByType.rate_limit > 0) {
      recommendations.push('Rate limit violations detected. Consider adjusting rate limits or implementing endpoint throttling.');
    }

    if (violationsByType.ip_blocked > 0) {
      recommendations.push('IP blocking violations detected. Review IP restriction policies and whitelist legitimate sources.');
    }

    if (violationsByType.suspicious_activity > 0) {
      recommendations.push('Suspicious activity detected. Monitor webhook endpoints for potential security threats.');
    }

    if (!this.config.requireHttps) {
      recommendations.push('Enable HTTPS requirement for all webhook endpoints to ensure secure data transmission.');
    }

    return recommendations;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Record security violation
   */
  private async recordSecurityViolation(violation: SecurityViolation): Promise<void> {
    await this.logSecurityEvent(
      violation.severity === 'critical' || violation.severity === 'high' ? 'error' : 'warn',
      `security_violation_${violation.type}`,
      violation,
      violation.endpointId,
      violation.userId
    );

    // Notify callbacks
    this.violationCallbacks.forEach(callback => {
      try {
        callback(violation);
      } catch (error) {
        console.error('Error in violation callback:', error);
      }
    });
  }

  /**
   * Record rate limit violation
   */
  private async recordRateLimitViolation(endpointId: number, rateLimit: any): Promise<void> {
    await this.db
      .update(webhookRateLimits)
      .set({
        violations: rateLimit.violations + 1,
        lastViolationAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(webhookRateLimits.id, rateLimit.id));

    await this.logSecurityEvent('warn', 'rate_limit_exceeded', {
      endpointId,
      currentCount: rateLimit.currentCount,
      maxRequests: rateLimit.maxRequests,
      windowSize: rateLimit.windowSize,
    }, endpointId);
  }

  /**
   * Record global rate limit violation
   */
  private async recordGlobalRateLimitViolation(userId: number, eventCount: number): Promise<void> {
    await this.logSecurityEvent('error', 'global_rate_limit_exceeded', {
      userId,
      eventCount,
      maxEventsPerHour: this.config.maxEventsPerHour,
    }, null, userId);
  }

  /**
   * Get recent security violations
   */
  private async getRecentSecurityViolations(endpointId: number, minutesBack: number): Promise<any[]> {
    const cutoffTime = new Date(Date.now() - minutesBack * 60 * 1000);
    
    return await this.db
      .select()
      .from(webhookLogs)
      .where(
        and(
          eq(webhookLogs.endpointId, endpointId),
          eq(webhookLogs.category, 'security'),
          gte(webhookLogs.timestamp, cutoffTime)
        )
      );
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    context: Record<string, any>,
    endpointId?: number | null,
    userId?: number | null
  ): Promise<void> {
    try {
      await this.db.insert(webhookLogs).values({
        level,
        message,
        context,
        category: 'security',
        endpointId,
        userId,
      });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  /**
   * Check if string contains SQL injection patterns
   */
  private containsSqlInjectionPatterns(input: string): boolean {
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      /(\bunion\b.*\bselect\b)/i,
      /(\b(OR|AND)\b\s*\d+\s*[=<>])/i,
      /(--|\/\*|\*\/)/,
      /(\bexec\b|\bexecute\b)/i,
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if string contains XSS patterns
   */
  private containsXssPatterns(input: string): boolean {
    const patterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript\s*:/i,
      /on\w+\s*=/i,
      /<img[^>]*src\s*=\s*["']?javascript:/i,
    ];
    
    return patterns.some(pattern => pattern.test(input));
  }

  /**
   * Check if user agent is suspicious
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /python-requests/i,
      /curl/i,
      /wget/i,
    ];
    
    // Very short or missing user agents are suspicious
    if (!userAgent || userAgent.length < 10) {
      return true;
    }
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  /**
   * Check if IP is in CIDR ranges
   */
  private isIpInRanges(ip: string, ranges: string[]): boolean {
    // Simple implementation - in production, use a proper CIDR library
    for (const range of ranges) {
      if (range.includes('/')) {
        // CIDR notation - simplified check
        const [network, bits] = range.split('/');
        const networkParts = network.split('.').map(Number);
        const ipParts = ip.split('.').map(Number);
        
        // Simple byte-wise comparison (not complete CIDR implementation)
        const bytesToCheck = Math.floor(parseInt(bits) / 8);
        let match = true;
        
        for (let i = 0; i < bytesToCheck; i++) {
          if (networkParts[i] !== ipParts[i]) {
            match = false;
            break;
          }
        }
        
        if (match) return true;
      } else {
        // Exact IP match
        if (ip === range) return true;
      }
    }
    
    return false;
  }

  /**
   * Add security violation callback
   */
  onSecurityViolation(callback: (violation: SecurityViolation) => void): void {
    this.violationCallbacks.push(callback);
  }

  /**
   * Remove security violation callback
   */
  removeSecurityViolationCallback(callback: (violation: SecurityViolation) => void): void {
    const index = this.violationCallbacks.indexOf(callback);
    if (index > -1) {
      this.violationCallbacks.splice(index, 1);
    }
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current security configuration
   */
  getConfig(): SecurityConfig {
    return { ...this.config };
  }
}

// Export types for external use
export type { SecurityConfig, SecurityViolation, RateLimitResult, SignatureValidationResult };