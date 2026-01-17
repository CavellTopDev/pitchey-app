/**
 * Better Auth Observability Integration
 *
 * Tracks authentication events and integrates with the observability stack:
 * - Login/logout events
 * - Session creation/refresh/expiry
 * - Failed authentication attempts
 * - Password reset flows
 * - Security events (suspicious activity)
 */

import { Observability } from './observability';
import * as Sentry from '@sentry/cloudflare';

// ============================================================================
// Types
// ============================================================================

export type AuthEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'signup'
  | 'session_created'
  | 'session_refreshed'
  | 'session_expired'
  | 'session_revoked'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_changed'
  | 'email_verified'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'two_factor_challenge'
  | 'two_factor_success'
  | 'two_factor_failed'
  | 'account_locked'
  | 'account_unlocked'
  | 'suspicious_activity';

export interface AuthEventData {
  userId?: string;
  email?: string;
  portal?: 'creator' | 'investor' | 'production' | 'admin';
  method?: 'email' | 'oauth' | 'magic_link' | 'api_key';
  provider?: string;  // For OAuth: google, github, etc.
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  reason?: string;
  attempts?: number;
  metadata?: Record<string, unknown>;
}

export interface SecurityAlert {
  type: 'brute_force' | 'suspicious_ip' | 'impossible_travel' | 'credential_stuffing' | 'session_hijack';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ip?: string;
  details: Record<string, unknown>;
}

// ============================================================================
// Auth Event Tracker
// ============================================================================

export class AuthObservability {
  private obs: Observability;
  private failedAttempts: Map<string, { count: number; firstAttempt: number }> = new Map();
  private readonly LOCKOUT_THRESHOLD = 5;
  private readonly LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  constructor(observability: Observability) {
    this.obs = observability;
  }

  /**
   * Track an authentication event
   */
  async trackAuthEvent(event: AuthEventType, data: AuthEventData): Promise<void> {
    const eventData = {
      authEvent: event,
      ...this.sanitizeAuthData(data),
      timestamp: new Date().toISOString(),
    };

    // Determine log level based on event type
    const level = this.getLogLevel(event);

    if (level === 'error') {
      this.obs.error(`Auth event: ${event}`, undefined, eventData);
    } else if (level === 'warn') {
      this.obs.warn(`Auth event: ${event}`, eventData);
    } else {
      this.obs.info(`Auth event: ${event}`, eventData);
    }

    // Track metrics
    this.trackAuthMetrics(event, data);

    // Check for security issues
    await this.checkSecurityThresholds(event, data);

    // Set Sentry user context on successful auth
    if (event === 'login_success' && data.userId) {
      Sentry.setUser({
        id: data.userId,
        email: data.email,
      });
    }

    // Clear Sentry user on logout
    if (event === 'logout') {
      Sentry.setUser(null);
    }
  }

  /**
   * Track login success
   */
  async loginSuccess(data: AuthEventData): Promise<void> {
    // Clear failed attempts on success
    if (data.email) {
      this.failedAttempts.delete(data.email);
    }
    if (data.ip) {
      this.failedAttempts.delete(`ip:${data.ip}`);
    }

    await this.trackAuthEvent('login_success', data);
  }

  /**
   * Track login failure
   */
  async loginFailed(data: AuthEventData): Promise<void> {
    // Track failed attempts
    const key = data.email || `ip:${data.ip}`;
    if (key) {
      const existing = this.failedAttempts.get(key);
      const now = Date.now();

      if (existing && (now - existing.firstAttempt) < this.LOCKOUT_WINDOW_MS) {
        existing.count++;
      } else {
        this.failedAttempts.set(key, { count: 1, firstAttempt: now });
      }

      data.attempts = this.failedAttempts.get(key)?.count;
    }

    await this.trackAuthEvent('login_failed', data);
  }

  /**
   * Track logout
   */
  async logout(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('logout', data);
  }

  /**
   * Track signup
   */
  async signup(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('signup', data);
  }

  /**
   * Track session events
   */
  async sessionCreated(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('session_created', data);
  }

  async sessionRefreshed(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('session_refreshed', data);
  }

  async sessionExpired(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('session_expired', data);
  }

  async sessionRevoked(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('session_revoked', data);
  }

  /**
   * Track password events
   */
  async passwordResetRequested(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('password_reset_requested', data);
  }

  async passwordResetCompleted(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('password_reset_completed', data);
  }

  async passwordChanged(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('password_changed', data);
  }

  /**
   * Track 2FA events
   */
  async twoFactorEnabled(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('two_factor_enabled', data);
  }

  async twoFactorDisabled(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('two_factor_disabled', data);
  }

  async twoFactorChallenge(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('two_factor_challenge', data);
  }

  async twoFactorSuccess(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('two_factor_success', data);
  }

  async twoFactorFailed(data: AuthEventData): Promise<void> {
    await this.trackAuthEvent('two_factor_failed', data);
  }

  /**
   * Report a security alert
   */
  async securityAlert(alert: SecurityAlert): Promise<void> {
    this.obs.error('Security alert', undefined, {
      alertType: alert.type,
      severity: alert.severity,
      userId: alert.userId,
      ip: alert.ip,
      ...alert.details,
    });

    // Always send critical alerts to Sentry
    if (alert.severity === 'critical' || alert.severity === 'high') {
      Sentry.withScope((scope) => {
        scope.setLevel(alert.severity === 'critical' ? 'fatal' : 'error');
        scope.setTag('alert_type', alert.type);
        scope.setTag('severity', alert.severity);
        scope.setExtras(alert.details);
        Sentry.captureMessage(`Security Alert: ${alert.type}`, alert.severity === 'critical' ? 'fatal' : 'error');
      });
    }
  }

  /**
   * Check if user/IP is locked out
   */
  isLockedOut(identifier: string): boolean {
    const attempts = this.failedAttempts.get(identifier);
    if (!attempts) return false;

    const now = Date.now();
    if ((now - attempts.firstAttempt) > this.LOCKOUT_WINDOW_MS) {
      this.failedAttempts.delete(identifier);
      return false;
    }

    return attempts.count >= this.LOCKOUT_THRESHOLD;
  }

  /**
   * Get remaining lockout time in seconds
   */
  getLockoutRemaining(identifier: string): number {
    const attempts = this.failedAttempts.get(identifier);
    if (!attempts) return 0;

    const elapsed = Date.now() - attempts.firstAttempt;
    if (elapsed > this.LOCKOUT_WINDOW_MS) return 0;

    return Math.ceil((this.LOCKOUT_WINDOW_MS - elapsed) / 1000);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private sanitizeAuthData(data: AuthEventData): AuthEventData {
    // Never log actual passwords, tokens, etc.
    const sanitized = { ...data };

    // Mask email for privacy in logs (keep domain)
    if (sanitized.email) {
      const [local, domain] = sanitized.email.split('@');
      if (local && domain) {
        sanitized.email = `${local.substring(0, 2)}***@${domain}`;
      }
    }

    return sanitized;
  }

  private getLogLevel(event: AuthEventType): 'info' | 'warn' | 'error' {
    const errorEvents: AuthEventType[] = [
      'login_failed',
      'two_factor_failed',
      'account_locked',
      'suspicious_activity',
    ];

    const warnEvents: AuthEventType[] = [
      'session_expired',
      'session_revoked',
      'password_reset_requested',
    ];

    if (errorEvents.includes(event)) return 'error';
    if (warnEvents.includes(event)) return 'warn';
    return 'info';
  }

  private trackAuthMetrics(event: AuthEventType, data: AuthEventData): void {
    const metrics = this.obs.getMetrics();
    if (!metrics) return;

    // Track auth event counter
    metrics.counter(`auth.${event}`, 1, {
      portal: data.portal || 'unknown',
      method: data.method || 'unknown',
    });

    // Track specific metrics
    if (event === 'login_success') {
      metrics.counter('auth.logins_total', 1, { portal: data.portal });
    } else if (event === 'login_failed') {
      metrics.counter('auth.login_failures_total', 1);
    } else if (event === 'signup') {
      metrics.counter('auth.signups_total', 1, { portal: data.portal });
    }
  }

  private async checkSecurityThresholds(event: AuthEventType, data: AuthEventData): Promise<void> {
    // Check for brute force
    if (event === 'login_failed' && data.email) {
      const attempts = this.failedAttempts.get(data.email);
      if (attempts && attempts.count >= this.LOCKOUT_THRESHOLD) {
        await this.securityAlert({
          type: 'brute_force',
          severity: 'high',
          userId: data.userId,
          ip: data.ip,
          details: {
            email: data.email,
            attempts: attempts.count,
            windowMs: this.LOCKOUT_WINDOW_MS,
          },
        });

        await this.trackAuthEvent('account_locked', {
          ...data,
          reason: 'Too many failed login attempts',
        });
      }
    }

    // Check for credential stuffing (many failed logins from same IP)
    if (event === 'login_failed' && data.ip) {
      const ipKey = `ip:${data.ip}`;
      const attempts = this.failedAttempts.get(ipKey);
      if (attempts && attempts.count >= this.LOCKOUT_THRESHOLD * 2) {
        await this.securityAlert({
          type: 'credential_stuffing',
          severity: 'critical',
          ip: data.ip,
          details: {
            attempts: attempts.count,
            windowMs: this.LOCKOUT_WINDOW_MS,
          },
        });
      }
    }
  }
}

// ============================================================================
// Better Auth Hooks Integration
// ============================================================================

/**
 * Create Better Auth hooks that integrate with observability
 *
 * Usage in Better Auth config:
 * ```typescript
 * import { createAuthHooks } from './lib/auth-observability';
 *
 * const auth = betterAuth({
 *   // ... config
 *   hooks: createAuthHooks(observability),
 * });
 * ```
 */
export function createAuthHooks(obs: Observability) {
  const authObs = new AuthObservability(obs);

  return {
    // After sign in
    async afterSignIn({ user, session, request }: any) {
      await authObs.loginSuccess({
        userId: user.id,
        email: user.email,
        sessionId: session?.id,
        ip: request?.headers?.get?.('cf-connecting-ip'),
        userAgent: request?.headers?.get?.('user-agent'),
        method: 'email',
      });
    },

    // After sign up
    async afterSignUp({ user, request }: any) {
      await authObs.signup({
        userId: user.id,
        email: user.email,
        ip: request?.headers?.get?.('cf-connecting-ip'),
        userAgent: request?.headers?.get?.('user-agent'),
      });
    },

    // After sign out
    async afterSignOut({ user, session, request }: any) {
      await authObs.logout({
        userId: user?.id,
        sessionId: session?.id,
        ip: request?.headers?.get?.('cf-connecting-ip'),
      });
    },

    // On session created
    async onSessionCreated({ session, user, request }: any) {
      await authObs.sessionCreated({
        userId: user.id,
        sessionId: session.id,
        ip: request?.headers?.get?.('cf-connecting-ip'),
        userAgent: request?.headers?.get?.('user-agent'),
      });
    },

    // Before sign in (for lockout check)
    async beforeSignIn({ email, request }: any) {
      const ip = request?.headers?.get?.('cf-connecting-ip');

      // Check email lockout
      if (email && authObs.isLockedOut(email)) {
        const remaining = authObs.getLockoutRemaining(email);
        throw new Error(`Account temporarily locked. Try again in ${remaining} seconds.`);
      }

      // Check IP lockout
      if (ip && authObs.isLockedOut(`ip:${ip}`)) {
        const remaining = authObs.getLockoutRemaining(`ip:${ip}`);
        throw new Error(`Too many login attempts. Try again in ${remaining} seconds.`);
      }
    },
  };
}

/**
 * Create auth observability instance
 */
export function createAuthObservability(obs: Observability): AuthObservability {
  return new AuthObservability(obs);
}

export default AuthObservability;
