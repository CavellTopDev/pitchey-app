/**
 * Security Monitoring and Incident Response
 * Implements real-time security monitoring, anomaly detection, and incident response
 * NIST Cybersecurity Framework compliant
 */

import { z } from 'zod';

export enum SecurityEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  MFA_SUCCESS = 'MFA_SUCCESS',
  MFA_FAILURE = 'MFA_FAILURE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  DATA_BREACH_ATTEMPT = 'DATA_BREACH_ATTEMPT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
  CSRF_ATTEMPT = 'CSRF_ATTEMPT',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  API_ABUSE = 'API_ABUSE',
  FILE_UPLOAD_VIOLATION = 'FILE_UPLOAD_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export enum SecuritySeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  ipAddress: string;
  userAgent: string;
  url: string;
  method: string;
  statusCode?: number;
  message: string;
  details?: Record<string, any>;
  stackTrace?: string;
  mitigationApplied?: boolean;
  resolved?: boolean;
}

export interface SecurityMetrics {
  totalEvents: number;
  criticalEvents: number;
  highEvents: number;
  mediumEvents: number;
  lowEvents: number;
  infoEvents: number;
  failedLogins: number;
  successfulLogins: number;
  blockedRequests: number;
  averageResponseTime: number;
  uniqueIPs: number;
  uniqueUsers: number;
  topThreats: { type: string; count: number }[];
}

export interface AnomalyPattern {
  pattern: string;
  threshold: number;
  window: number; // Time window in seconds
  action: 'alert' | 'block' | 'monitor';
}

/**
 * Security Monitoring Service
 */
export class SecurityMonitor {
  private static events: SecurityEvent[] = [];
  private static readonly MAX_EVENTS = 10000;
  private static readonly ANOMALY_PATTERNS: AnomalyPattern[] = [
    {
      pattern: 'failed_login',
      threshold: 5,
      window: 300, // 5 minutes
      action: 'block'
    },
    {
      pattern: 'rapid_requests',
      threshold: 100,
      window: 60, // 1 minute
      action: 'block'
    },
    {
      pattern: 'sql_injection',
      threshold: 3,
      window: 3600, // 1 hour
      action: 'block'
    },
    {
      pattern: 'xss_attempt',
      threshold: 3,
      window: 3600, // 1 hour
      action: 'block'
    },
    {
      pattern: 'unauthorized_access',
      threshold: 10,
      window: 600, // 10 minutes
      action: 'alert'
    }
  ];
  
  /**
   * Log security event
   */
  static logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    const fullEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date()
    };
    
    // Add to events array (FIFO)
    this.events.push(fullEvent);
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }
    
    // Check for anomalies
    this.detectAnomalies(fullEvent);
    
    // Send to backend for persistent storage
    this.sendToBackend(fullEvent);
    
    // Trigger real-time alerts for critical events
    if (fullEvent.severity === SecuritySeverity.CRITICAL) {
      this.triggerAlert(fullEvent);
    }
  }
  
  /**
   * Generate unique event ID
   */
  private static generateEventId(): string {
    return `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Detect anomalies based on patterns
   */
  private static detectAnomalies(event: SecurityEvent): void {
    for (const pattern of this.ANOMALY_PATTERNS) {
      const recentEvents = this.getRecentEvents(pattern.window);
      const matchingEvents = this.filterEventsByPattern(recentEvents, pattern.pattern);
      
      if (matchingEvents.length >= pattern.threshold) {
        this.handleAnomaly(pattern, matchingEvents, event);
      }
    }
  }
  
  /**
   * Get recent events within time window
   */
  private static getRecentEvents(windowSeconds: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - windowSeconds * 1000);
    return this.events.filter(e => e.timestamp >= cutoff);
  }
  
  /**
   * Filter events by pattern
   */
  private static filterEventsByPattern(events: SecurityEvent[], pattern: string): SecurityEvent[] {
    switch (pattern) {
      case 'failed_login':
        return events.filter(e => e.type === SecurityEventType.LOGIN_FAILURE);
      case 'rapid_requests':
        return events.filter(e => e.type === SecurityEventType.RATE_LIMIT_EXCEEDED);
      case 'sql_injection':
        return events.filter(e => e.type === SecurityEventType.SQL_INJECTION_ATTEMPT);
      case 'xss_attempt':
        return events.filter(e => e.type === SecurityEventType.XSS_ATTEMPT);
      case 'unauthorized_access':
        return events.filter(e => e.type === SecurityEventType.UNAUTHORIZED_ACCESS);
      default:
        return [];
    }
  }
  
  /**
   * Handle detected anomaly
   */
  private static handleAnomaly(
    pattern: AnomalyPattern,
    matchingEvents: SecurityEvent[],
    currentEvent: SecurityEvent
  ): void {
    const anomalyEvent: Omit<SecurityEvent, 'id' | 'timestamp'> = {
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecuritySeverity.HIGH,
      userId: currentEvent.userId,
      ipAddress: currentEvent.ipAddress,
      userAgent: currentEvent.userAgent,
      url: currentEvent.url,
      method: currentEvent.method,
      message: `Anomaly detected: ${pattern.pattern}`,
      details: {
        pattern: pattern.pattern,
        threshold: pattern.threshold,
        count: matchingEvents.length,
        action: pattern.action,
        events: matchingEvents.map(e => e.id)
      }
    };
    
    // Log the anomaly
    this.logEvent(anomalyEvent);
    
    // Take action based on pattern configuration
    switch (pattern.action) {
      case 'block':
        this.blockIP(currentEvent.ipAddress);
        break;
      case 'alert':
        this.sendAlert(anomalyEvent);
        break;
      case 'monitor':
        console.warn('Anomaly detected, monitoring:', pattern.pattern);
        break;
    }
  }
  
  /**
   * Block IP address
   */
  private static blockIP(ipAddress: string): void {
    // In production, this would update a WAF rule or IP blacklist
    console.error('BLOCKING IP:', ipAddress);
    
    // Store blocked IPs
    const blockedIPs = JSON.parse(localStorage.getItem('blocked_ips') || '[]');
    if (!blockedIPs.includes(ipAddress)) {
      blockedIPs.push(ipAddress);
      localStorage.setItem('blocked_ips', JSON.stringify(blockedIPs));
    }
  }
  
  /**
   * Send alert
   */
  private static sendAlert(event: Omit<SecurityEvent, 'id' | 'timestamp'>): void {
    // In production, this would send to alerting service (PagerDuty, etc.)
    console.error('SECURITY ALERT:', event);
  }
  
  /**
   * Trigger real-time alert
   */
  private static triggerAlert(event: SecurityEvent): void {
    // Send to WebSocket for real-time dashboard updates
    if (window.WebSocket) {
      const ws = new WebSocket('wss://pitchey-api-prod.ndlovucavelle.workers.dev/ws');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'security_alert',
          event
        }));
        ws.close();
      };
    }
  }
  
  /**
   * Send event to backend
   */
  private static async sendToBackend(event: SecurityEvent): Promise<void> {
    try {
      await 
      credentials: 'include', // Send cookies for Better Auth session
      
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Failed to send security event to backend:', error);
    }
  }
  
  /**
   * Get security metrics
   */
  static getMetrics(timeRange?: { start: Date; end: Date }): SecurityMetrics {
    let events = this.events;
    
    if (timeRange) {
      events = events.filter(e => 
        e.timestamp >= timeRange.start && 
        e.timestamp <= timeRange.end
      );
    }
    
    const metrics: SecurityMetrics = {
      totalEvents: events.length,
      criticalEvents: events.filter(e => e.severity === SecuritySeverity.CRITICAL).length,
      highEvents: events.filter(e => e.severity === SecuritySeverity.HIGH).length,
      mediumEvents: events.filter(e => e.severity === SecuritySeverity.MEDIUM).length,
      lowEvents: events.filter(e => e.severity === SecuritySeverity.LOW).length,
      infoEvents: events.filter(e => e.severity === SecuritySeverity.INFO).length,
      failedLogins: events.filter(e => e.type === SecurityEventType.LOGIN_FAILURE).length,
      successfulLogins: events.filter(e => e.type === SecurityEventType.LOGIN_SUCCESS).length,
      blockedRequests: events.filter(e => e.details?.blocked === true).length,
      averageResponseTime: this.calculateAverageResponseTime(events),
      uniqueIPs: new Set(events.map(e => e.ipAddress)).size,
      uniqueUsers: new Set(events.filter(e => e.userId).map(e => e.userId)).size,
      topThreats: this.getTopThreats(events)
    };
    
    return metrics;
  }
  
  /**
   * Calculate average response time
   */
  private static calculateAverageResponseTime(events: SecurityEvent[]): number {
    const responseTimes = events
      .filter(e => e.details?.responseTime)
      .map(e => e.details!.responseTime as number);
    
    if (responseTimes.length === 0) return 0;
    
    return responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }
  
  /**
   * Get top threats
   */
  private static getTopThreats(events: SecurityEvent[]): { type: string; count: number }[] {
    const threatCounts = new Map<string, number>();
    
    for (const event of events) {
      if (event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL) {
        const count = threatCounts.get(event.type) || 0;
        threatCounts.set(event.type, count + 1);
      }
    }
    
    return Array.from(threatCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
  
  /**
   * Get recent security events
   */
  static getRecentSecurityEvents(limit: number = 100): SecurityEvent[] {
    return this.events.slice(-limit).reverse();
  }
  
  /**
   * Clear old events
   */
  static clearOldEvents(daysToKeep: number = 30): void {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    this.events = this.events.filter(e => e.timestamp >= cutoff);
  }
}

/**
 * Intrusion Detection System
 */
export class IntrusionDetection {
  private static readonly ATTACK_SIGNATURES = {
    sqlInjection: [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b.*\b(FROM|WHERE|JOIN)\b)/i,
      /(\bUNION\b.*\bSELECT\b)/i,
      /(--|\\/\\*|\\*\\/)/,
      /(\bOR\b.*=.*\bOR\b)/i,
      /(xp_|sp_)/i
    ],
    xss: [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe/gi,
      /document\.(cookie|write|location)/gi,
      /eval\s*\(/gi
    ],
    pathTraversal: [
      /\.\.[\/\\]/,
      /%2e%2e[\/\\]/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ],
    commandInjection: [
      /[;&|`$]/,
      /\b(cat|ls|rm|mv|cp|chmod|chown|wget|curl|nc|bash|sh)\b/
    ],
    xxe: [
      /<!DOCTYPE[^>]*\[/,
      /<!ENTITY/,
      /SYSTEM\s+"file:/
    ],
    ldapInjection: [
      /[()&|!*]/,
      /\b(objectClass|cn|sn|uid|mail)\b.*[()&|!*]/
    ]
  };
  
  /**
   * Scan request for attack patterns
   */
  static scanRequest(
    url: string,
    method: string,
    headers: Headers,
    body?: string
  ): { detected: boolean; type?: string; signature?: string } {
    // Check URL
    const urlScan = this.scanText(url);
    if (urlScan.detected) {
      return { ...urlScan, signature: 'URL' };
    }
    
    // Check headers
    headers.forEach((value, key) => {
      const headerScan = this.scanText(`${key}: ${value}`);
      if (headerScan.detected) {
        return { ...headerScan, signature: `Header: ${key}` };
      }
    });
    
    // Check body
    if (body) {
      const bodyScan = this.scanText(body);
      if (bodyScan.detected) {
        return { ...bodyScan, signature: 'Body' };
      }
    }
    
    return { detected: false };
  }
  
  /**
   * Scan text for attack patterns
   */
  private static scanText(text: string): { detected: boolean; type?: string } {
    for (const [attackType, patterns] of Object.entries(this.ATTACK_SIGNATURES)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return { detected: true, type: attackType };
        }
      }
    }
    
    return { detected: false };
  }
  
  /**
   * Calculate risk score
   */
  static calculateRiskScore(request: {
    url: string;
    method: string;
    headers: Headers;
    body?: string;
    user?: { id: string; role: string };
    ip: string;
  }): number {
    let score = 0;
    
    // Check for attack patterns
    const scan = this.scanRequest(request.url, request.method, request.headers, request.body);
    if (scan.detected) {
      score += 50;
    }
    
    // Check method risk
    if (['DELETE', 'PUT', 'PATCH'].includes(request.method)) {
      score += 10;
    }
    
    // Check authentication
    if (!request.headers.get('Authorization')) {
      score += 20;
    }
    
    // Check user role
    if (!request.user || request.user.role === 'guest') {
      score += 15;
    }
    
    // Check IP reputation (simplified)
    const blockedIPs = JSON.parse(localStorage.getItem('blocked_ips') || '[]');
    if (blockedIPs.includes(request.ip)) {
      score += 30;
    }
    
    // Check unusual patterns
    if (request.url.length > 500) {
      score += 10;
    }
    
    if (request.body && request.body.length > 100000) {
      score += 15;
    }
    
    return Math.min(score, 100);
  }
}

/**
 * Security Incident Response
 */
export class IncidentResponse {
  static readonly RESPONSE_PLAYBOOKS = {
    data_breach: [
      'Isolate affected systems',
      'Preserve evidence',
      'Notify security team',
      'Begin forensic analysis',
      'Notify affected users',
      'Report to authorities if required',
      'Implement additional security measures',
      'Conduct post-incident review'
    ],
    ddos_attack: [
      'Enable DDoS protection',
      'Increase rate limiting',
      'Block attacking IPs',
      'Scale infrastructure',
      'Monitor system health',
      'Communicate with stakeholders',
      'Document attack patterns'
    ],
    account_compromise: [
      'Lock compromised account',
      'Reset authentication credentials',
      'Review account activity',
      'Check for lateral movement',
      'Notify account owner',
      'Enable additional security measures',
      'Monitor for further suspicious activity'
    ],
    malware_detection: [
      'Isolate infected system',
      'Run malware scans',
      'Identify infection vector',
      'Remove malware',
      'Patch vulnerabilities',
      'Restore from clean backup if needed',
      'Update security signatures'
    ]
  };
  
  /**
   * Initiate incident response
   */
  static initiateResponse(
    incidentType: keyof typeof IncidentResponse.RESPONSE_PLAYBOOKS,
    details: Record<string, any>
  ): string {
    const incidentId = `INC-${Date.now()}`;
    const playbook = this.RESPONSE_PLAYBOOKS[incidentType];
    
    // Log incident
    SecurityMonitor.logEvent({
      type: SecurityEventType.DATA_BREACH_ATTEMPT,
      severity: SecuritySeverity.CRITICAL,
      ipAddress: details.ipAddress || 'unknown',
      userAgent: details.userAgent || 'unknown',
      url: details.url || 'unknown',
      method: details.method || 'unknown',
      message: `Incident response initiated: ${incidentType}`,
      details: {
        incidentId,
        incidentType,
        playbook,
        ...details
      }
    });
    
    // Execute automated response actions
    this.executeAutomatedActions(incidentType, details);
    
    return incidentId;
  }
  
  /**
   * Execute automated response actions
   */
  private static executeAutomatedActions(
    incidentType: string,
    details: Record<string, any>
  ): void {
    switch (incidentType) {
      case 'data_breach':
        // Automatically lock affected accounts
        if (details.affectedUsers) {
          this.lockAccounts(details.affectedUsers);
        }
        break;
        
      case 'ddos_attack':
        // Automatically increase rate limits
        this.increaseRateLimits();
        break;
        
      case 'account_compromise':
        // Automatically lock account
        if (details.userId) {
          this.lockAccount(details.userId);
        }
        break;
        
      case 'malware_detection':
        // Automatically quarantine files
        if (details.files) {
          this.quarantineFiles(details.files);
        }
        break;
    }
  }
  
  private static lockAccounts(userIds: string[]): void {
    // Implementation would call backend API
  }
  
  private static lockAccount(userId: string): void {
    // Implementation would call backend API
  }
  
  private static increaseRateLimits(): void {
    // Implementation would update rate limiting configuration
  }
  
  private static quarantineFiles(files: string[]): void {
    // Implementation would move files to quarantine
  }
}

export default SecurityMonitor;