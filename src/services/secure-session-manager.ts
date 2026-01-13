/**
 * Secure Session Manager for Better Auth
 * Implements enhanced session security with fingerprinting and anomaly detection
 */

import { createHash } from 'crypto';
import type { KVNamespace } from '@cloudflare/workers-types';

export interface SessionConfig {
  duration: number; // Session duration in milliseconds
  absoluteTimeout: number; // Absolute timeout regardless of activity
  idleTimeout: number; // Idle timeout
  maxConcurrent: number; // Maximum concurrent sessions per user
  rotationInterval: number; // How often to rotate session ID
}

export interface SessionData {
  id: string;
  userId: string;
  userType: string;
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  absoluteExpiry: number;
  rotationDue: number;
  metadata?: Record<string, any>;
}

export interface AnomalyCheck {
  fingerprintMismatch: boolean;
  ipChanged: boolean;
  userAgentChanged: boolean;
  suspiciousActivity: boolean;
  geoLocationAnomaly: boolean;
}

export class SecureSessionManager {
  // Security configuration
  private static readonly DEFAULT_CONFIG: SessionConfig = {
    duration: 4 * 60 * 60 * 1000, // 4 hours
    absoluteTimeout: 12 * 60 * 60 * 1000, // 12 hours
    idleTimeout: 30 * 60 * 1000, // 30 minutes
    maxConcurrent: 3, // 3 concurrent sessions
    rotationInterval: 60 * 60 * 1000 // Rotate every hour
  };
  
  private config: SessionConfig;
  private kv?: KVNamespace;
  
  constructor(config?: Partial<SessionConfig>, kv?: KVNamespace) {
    this.config = { ...SecureSessionManager.DEFAULT_CONFIG, ...config };
    this.kv = kv;
  }
  
  /**
   * Create a new secure session
   */
  async createSession(
    userId: string,
    userType: string,
    request: Request
  ): Promise<SessionData> {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    
    // Extract request metadata
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const ipAddress = this.getClientIP(request);
    const fingerprint = this.generateFingerprint(request);
    
    // Check concurrent sessions
    if (this.kv) {
      await this.enforceMaxConcurrentSessions(userId);
    }
    
    const session: SessionData = {
      id: sessionId,
      userId,
      userType,
      fingerprint,
      ipAddress,
      userAgent,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + this.config.duration,
      absoluteExpiry: now + this.config.absoluteTimeout,
      rotationDue: now + this.config.rotationInterval,
      metadata: {
        country: request.headers.get('CF-IPCountry') || 'unknown',
        region: request.headers.get('CF-Region') || 'unknown',
        city: request.headers.get('CF-City') || 'unknown',
        timezone: request.headers.get('CF-Timezone') || 'unknown'
      }
    };
    
    // Store session in KV if available
    if (this.kv) {
      await this.storeSession(session);
      await this.addSessionToUserIndex(userId, sessionId);
    }
    
    return session;
  }
  
  /**
   * Validate an existing session
   */
  async validateSession(
    sessionId: string,
    request: Request
  ): Promise<{ valid: boolean; reason?: string; newSession?: SessionData }> {
    if (!this.kv) {
      return { valid: false, reason: 'Session storage not configured' };
    }
    
    // Retrieve session from KV
    const session = await this.getSession(sessionId);
    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }
    
    const now = Date.now();
    
    // Check absolute timeout
    if (now > session.absoluteExpiry) {
      await this.destroySession(sessionId);
      return { valid: false, reason: 'Session absolute timeout exceeded' };
    }
    
    // Check session expiry
    if (now > session.expiresAt) {
      await this.destroySession(sessionId);
      return { valid: false, reason: 'Session expired' };
    }
    
    // Check idle timeout
    if (now - session.lastActivity > this.config.idleTimeout) {
      await this.destroySession(sessionId);
      return { valid: false, reason: 'Session idle timeout' };
    }
    
    // Perform anomaly detection
    const anomalies = await this.detectAnomalies(session, request);
    if (this.hasSignificantAnomalies(anomalies)) {
      await this.destroySession(sessionId);
      await this.logSecurityEvent('session_anomaly_detected', {
        sessionId,
        userId: session.userId,
        anomalies
      });
      return { valid: false, reason: 'Security anomaly detected' };
    }
    
    // Check if rotation is needed
    if (now > session.rotationDue) {
      const newSession = await this.rotateSession(session, request);
      return { valid: true, newSession };
    }
    
    // Update last activity
    session.lastActivity = now;
    session.expiresAt = now + this.config.duration; // Sliding window
    await this.storeSession(session);
    
    return { valid: true };
  }
  
  /**
   * Generate device/browser fingerprint
   */
  private generateFingerprint(request: Request): string {
    const components = [
      request.headers.get('User-Agent') || '',
      request.headers.get('Accept-Language') || '',
      request.headers.get('Accept-Encoding') || '',
      request.headers.get('CF-IPCountry') || '',
      request.headers.get('CF-Device-Type') || '',
      // Add more entropy sources as needed
    ];
    
    const fingerprintData = components.join('|');
    return createHash('sha256').update(fingerprintData).digest('hex');
  }
  
  /**
   * Get client IP address
   */
  private getClientIP(request: Request): string {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For')?.split(',')[0] || 
           request.headers.get('X-Real-IP') || 
           'unknown';
  }
  
  /**
   * Detect anomalies in session
   */
  private async detectAnomalies(
    session: SessionData,
    request: Request
  ): Promise<AnomalyCheck> {
    const currentFingerprint = this.generateFingerprint(request);
    const currentIP = this.getClientIP(request);
    const currentUserAgent = request.headers.get('User-Agent') || '';
    
    const anomalies: AnomalyCheck = {
      fingerprintMismatch: currentFingerprint !== session.fingerprint,
      ipChanged: currentIP !== session.ipAddress,
      userAgentChanged: currentUserAgent !== session.userAgent,
      suspiciousActivity: false,
      geoLocationAnomaly: false
    };
    
    // Check for geo-location anomaly
    const currentCountry = request.headers.get('CF-IPCountry');
    if (currentCountry && session.metadata?.country) {
      anomalies.geoLocationAnomaly = currentCountry !== session.metadata.country;
    }
    
    // Check for suspicious patterns (rapid location changes, etc.)
    if (anomalies.geoLocationAnomaly && anomalies.ipChanged) {
      const timeSinceLastActivity = Date.now() - session.lastActivity;
      // If location changed significantly in less than 5 minutes, it's suspicious
      if (timeSinceLastActivity < 5 * 60 * 1000) {
        anomalies.suspiciousActivity = true;
      }
    }
    
    return anomalies;
  }
  
  /**
   * Determine if anomalies are significant enough to invalidate session
   */
  private hasSignificantAnomalies(anomalies: AnomalyCheck): boolean {
    // Fingerprint mismatch is always significant
    if (anomalies.fingerprintMismatch) return true;
    
    // Suspicious activity patterns
    if (anomalies.suspiciousActivity) return true;
    
    // Multiple minor anomalies together
    const anomalyCount = Object.values(anomalies).filter(v => v === true).length;
    if (anomalyCount >= 3) return true;
    
    return false;
  }
  
  /**
   * Rotate session ID while maintaining session data
   */
  private async rotateSession(
    oldSession: SessionData,
    request: Request
  ): Promise<SessionData> {
    const newSessionId = crypto.randomUUID();
    const now = Date.now();
    
    const newSession: SessionData = {
      ...oldSession,
      id: newSessionId,
      lastActivity: now,
      expiresAt: now + this.config.duration,
      rotationDue: now + this.config.rotationInterval,
      // Update fingerprint with new request data
      fingerprint: this.generateFingerprint(request),
      ipAddress: this.getClientIP(request),
      userAgent: request.headers.get('User-Agent') || oldSession.userAgent
    };
    
    // Store new session
    await this.storeSession(newSession);
    
    // Update user index
    await this.removeSessionFromUserIndex(oldSession.userId, oldSession.id);
    await this.addSessionToUserIndex(newSession.userId, newSessionId);
    
    // Destroy old session
    await this.destroySession(oldSession.id);
    
    return newSession;
  }
  
  /**
   * Enforce maximum concurrent sessions per user
   */
  private async enforceMaxConcurrentSessions(userId: string): Promise<void> {
    if (!this.kv) return;
    
    const sessionIds = await this.getUserSessions(userId);
    if (sessionIds.length >= this.config.maxConcurrent) {
      // Remove oldest session
      const sessionsWithData = await Promise.all(
        sessionIds.map(async id => ({
          id,
          session: await this.getSession(id)
        }))
      );
      
      // Sort by creation time and remove oldest
      sessionsWithData.sort((a, b) => 
        (a.session?.createdAt || 0) - (b.session?.createdAt || 0)
      );
      
      const toRemove = sessionsWithData.slice(
        0,
        sessionIds.length - this.config.maxConcurrent + 1
      );
      
      for (const { id } of toRemove) {
        await this.destroySession(id);
        await this.removeSessionFromUserIndex(userId, id);
      }
    }
  }
  
  /**
   * Store session in KV
   */
  private async storeSession(session: SessionData): Promise<void> {
    if (!this.kv) return;
    
    await this.kv.put(
      `session:${session.id}`,
      JSON.stringify(session),
      {
        expirationTtl: Math.floor(this.config.absoluteTimeout / 1000)
      }
    );
  }
  
  /**
   * Get session from KV
   */
  private async getSession(sessionId: string): Promise<SessionData | null> {
    if (!this.kv) return null;
    
    const data = await this.kv.get(`session:${sessionId}`);
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    if (!this.kv) return;
    
    const session = await this.getSession(sessionId);
    if (session) {
      await this.removeSessionFromUserIndex(session.userId, sessionId);
    }
    
    await this.kv.delete(`session:${sessionId}`);
  }
  
  /**
   * Get user's active sessions
   */
  private async getUserSessions(userId: string): Promise<string[]> {
    if (!this.kv) return [];
    
    const data = await this.kv.get(`user:sessions:${userId}`);
    if (!data) return [];
    
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  
  /**
   * Add session to user index
   */
  private async addSessionToUserIndex(
    userId: string,
    sessionId: string
  ): Promise<void> {
    if (!this.kv) return;
    
    const sessions = await this.getUserSessions(userId);
    if (!sessions.includes(sessionId)) {
      sessions.push(sessionId);
      await this.kv.put(
        `user:sessions:${userId}`,
        JSON.stringify(sessions),
        {
          expirationTtl: Math.floor(this.config.absoluteTimeout / 1000)
        }
      );
    }
  }
  
  /**
   * Remove session from user index
   */
  private async removeSessionFromUserIndex(
    userId: string,
    sessionId: string
  ): Promise<void> {
    if (!this.kv) return;
    
    const sessions = await this.getUserSessions(userId);
    const filtered = sessions.filter(id => id !== sessionId);
    
    if (filtered.length > 0) {
      await this.kv.put(
        `user:sessions:${userId}`,
        JSON.stringify(filtered),
        {
          expirationTtl: Math.floor(this.config.absoluteTimeout / 1000)
        }
      );
    } else {
      await this.kv.delete(`user:sessions:${userId}`);
    }
  }
  
  /**
   * Log security event
   */
  private async logSecurityEvent(
    event: string,
    data: Record<string, any>
  ): Promise<void> {
    // In production, send to logging service
    console.warn(`[SECURITY] ${event}:`, data);
    
    // Could also store in KV for audit trail
    if (this.kv) {
      const timestamp = Date.now();
      await this.kv.put(
        `security:event:${timestamp}:${crypto.randomUUID()}`,
        JSON.stringify({
          event,
          data,
          timestamp
        }),
        {
          expirationTtl: 30 * 24 * 60 * 60 // 30 days
        }
      );
    }
  }
  
  /**
   * Create session cookie string
   */
  createSessionCookie(sessionId: string, secure = true): string {
    const parts = [
      `better-auth-session=${sessionId}`,
      'Path=/',
      'HttpOnly',
      secure ? 'Secure' : '',
      'SameSite=Strict',
      `Max-Age=${Math.floor(this.config.duration / 1000)}`
    ].filter(Boolean);
    
    return parts.join('; ');
  }
  
  /**
   * Destroy all sessions for a user (for logout all devices)
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessions(userId);
    
    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }
    
    if (this.kv) {
      await this.kv.delete(`user:sessions:${userId}`);
    }
  }
}