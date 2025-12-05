// For Cloudflare Workers - use Web Crypto API

interface SessionData {
  userId: number;
  email: string;
  userType: 'creator' | 'investor' | 'production' | 'admin';
  createdAt: number;
  expiresAt: number;
  ipAddress?: string;
  userAgent?: string;
}

interface SessionConfig {
  maxAge?: number; // in seconds, default 7 days
  secure?: boolean; // require HTTPS
  httpOnly?: boolean; // prevent JS access
  sameSite?: 'strict' | 'lax' | 'none';
  domain?: string;
}

export class SessionManager {
  private readonly defaultConfig: SessionConfig = {
    maxAge: 7 * 24 * 60 * 60, // 7 days
    secure: true,
    httpOnly: true,
    sameSite: 'lax',
    domain: '.pitchey.pages.dev'
  };

  constructor(
    private redis: any, // Upstash Redis client
    private config: SessionConfig = {}
  ) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Generate a cryptographically secure session ID
   */
  private generateSessionId(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash the session ID for storage (prevents session hijacking if Redis is compromised)
   */
  private async hashSessionId(sessionId: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(sessionId);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Create a new session
   */
  async createSession(
    userData: Omit<SessionData, 'createdAt' | 'expiresAt'>,
    request?: Request
  ): Promise<{ sessionId: string; cookie: string }> {
    const sessionId = this.generateSessionId();
    const hashedId = await this.hashSessionId(sessionId);
    
    const sessionData: SessionData = {
      ...userData,
      createdAt: Date.now(),
      expiresAt: Date.now() + (this.config.maxAge! * 1000),
      ipAddress: request?.headers.get('CF-Connecting-IP') || undefined,
      userAgent: request?.headers.get('User-Agent') || undefined
    };

    // Store in Redis with expiration
    await this.redis.setex(
      `session:${hashedId}`,
      this.config.maxAge,
      JSON.stringify(sessionData)
    );

    // Also track active sessions per user
    await this.redis.sadd(`user:${userData.userId}:sessions`, hashedId);
    await this.redis.expire(`user:${userData.userId}:sessions`, this.config.maxAge);

    // Generate secure cookie
    const cookie = this.generateCookie(sessionId);

    return { sessionId, cookie };
  }

  /**
   * Validate and retrieve session
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    if (!sessionId) return null;

    const hashedId = await this.hashSessionId(sessionId);
    const data = await this.redis.get(`session:${hashedId}`);

    if (!data) return null;

    const session: SessionData = JSON.parse(data);

    // Check expiration
    if (session.expiresAt < Date.now()) {
      await this.destroySession(sessionId);
      return null;
    }

    // Extend session on activity (sliding expiration)
    await this.extendSession(sessionId);

    return session;
  }

  /**
   * Extend session expiration
   */
  async extendSession(sessionId: string): Promise<void> {
    const hashedId = await this.hashSessionId(sessionId);
    const data = await this.redis.get(`session:${hashedId}`);
    
    if (!data) return;

    const session: SessionData = JSON.parse(data);
    session.expiresAt = Date.now() + (this.config.maxAge! * 1000);

    await this.redis.setex(
      `session:${hashedId}`,
      this.config.maxAge,
      JSON.stringify(session)
    );
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<void> {
    const hashedId = await this.hashSessionId(sessionId);
    const data = await this.redis.get(`session:${hashedId}`);
    
    if (data) {
      const session: SessionData = JSON.parse(data);
      // Remove from user's active sessions
      await this.redis.srem(`user:${session.userId}:sessions`, hashedId);
    }

    await this.redis.del(`session:${hashedId}`);
  }

  /**
   * Destroy all sessions for a user (useful for password changes)
   */
  async destroyAllUserSessions(userId: number): Promise<void> {
    const sessions = await this.redis.smembers(`user:${userId}:sessions`);
    
    for (const hashedId of sessions) {
      await this.redis.del(`session:${hashedId}`);
    }
    
    await this.redis.del(`user:${userId}:sessions`);
  }

  /**
   * Generate secure cookie string
   */
  private generateCookie(sessionId: string): string {
    const parts = [
      `session=${sessionId}`,
      `Max-Age=${this.config.maxAge}`,
      'Path=/',
    ];

    if (this.config.secure) parts.push('Secure');
    if (this.config.httpOnly) parts.push('HttpOnly');
    if (this.config.sameSite) parts.push(`SameSite=${this.config.sameSite}`);
    if (this.config.domain) parts.push(`Domain=${this.config.domain}`);

    return parts.join('; ');
  }

  /**
   * Parse session ID from cookie header
   */
  static parseSessionFromCookie(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    return cookies['session'] || null;
  }

  /**
   * Generate logout cookie (expires immediately)
   */
  static generateLogoutCookie(domain?: string): string {
    const parts = [
      'session=',
      'Max-Age=0',
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax'
    ];
    
    if (domain) parts.push(`Domain=${domain}`);
    
    return parts.join('; ');
  }
}

/**
 * Middleware for Cloudflare Workers
 */
export function createSessionMiddleware(sessionManager: SessionManager) {
  return async (request: Request, env: any, ctx: any, next: () => Promise<Response>) => {
    const cookieHeader = request.headers.get('Cookie');
    const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);

    if (sessionId) {
      const session = await sessionManager.getSession(sessionId);
      if (session) {
        // Attach session to request context
        (request as any).session = session;
      }
    }

    return next();
  };
}

/**
 * Rate limiting with Redis
 */
export class RateLimiter {
  constructor(
    private redis: any,
    private limit: number = 10, // requests
    private window: number = 60  // seconds
  ) {}

  async checkLimit(identifier: string): Promise<{ allowed: boolean; remaining: number }> {
    const key = `rate:${identifier}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.window);
    }

    const remaining = Math.max(0, this.limit - current);
    const allowed = current <= this.limit;

    return { allowed, remaining };
  }
}