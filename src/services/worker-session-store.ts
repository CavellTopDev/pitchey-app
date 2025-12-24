/**
 * In-Memory Session Store for Cloudflare Workers (Free Plan)
 * 
 * NOTE: Sessions are stored in worker memory and will be lost on:
 * - Worker restart/redeploy
 * - After ~15 minutes of inactivity
 * - When hitting memory limits
 * 
 * For production, upgrade to KV storage or external session store
 */

interface Session {
  id: string;
  userId: string;
  data: Record<string, any>;
  createdAt: number;
  lastAccessedAt: number;
  expiresAt: number;
}

class InMemorySessionStore {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();
  private readonly maxSessions = 1000; // Limit for free plan
  private readonly sessionTTL = 7200000; // 2 hours in ms
  
  /**
   * Create a new session
   */
  create(userId: string, data: Record<string, any> = {}): string {
    // Clean up expired sessions first
    this.cleanup();
    
    // Check memory limits
    if (this.sessions.size >= this.maxSessions) {
      this.evictOldest();
    }
    
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session: Session = {
      id: sessionId,
      userId,
      data,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt: now + this.sessionTTL
    };
    
    this.sessions.set(sessionId, session);
    
    // Track user sessions
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);
    
    return sessionId;
  }
  
  /**
   * Get a session by ID
   */
  get(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > session.expiresAt) {
      this.delete(sessionId);
      return null;
    }
    
    // Update last accessed time
    session.lastAccessedAt = Date.now();
    return session;
  }
  
  /**
   * Update session data
   */
  update(sessionId: string, data: Partial<Session['data']>): boolean {
    const session = this.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    session.data = { ...session.data, ...data };
    return true;
  }
  
  /**
   * Delete a session
   */
  delete(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    // Remove from user sessions
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions) {
      userSessions.delete(sessionId);
      if (userSessions.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }
    
    return this.sessions.delete(sessionId);
  }
  
  /**
   * Delete all sessions for a user
   */
  deleteUserSessions(userId: string): number {
    const userSessions = this.userSessions.get(userId);
    
    if (!userSessions) {
      return 0;
    }
    
    let deleted = 0;
    for (const sessionId of userSessions) {
      if (this.sessions.delete(sessionId)) {
        deleted++;
      }
    }
    
    this.userSessions.delete(userId);
    return deleted;
  }
  
  /**
   * Refresh session expiry
   */
  refresh(sessionId: string): boolean {
    const session = this.get(sessionId);
    
    if (!session) {
      return false;
    }
    
    session.expiresAt = Date.now() + this.sessionTTL;
    return true;
  }
  
  /**
   * Clean up expired sessions
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt) {
        this.delete(sessionId);
        cleaned++;
      }
    }
    
    return cleaned;
  }
  
  /**
   * Evict oldest session when at capacity
   */
  private evictOldest(): void {
    let oldest: Session | null = null;
    let oldestId: string | null = null;
    
    for (const [id, session] of this.sessions) {
      if (!oldest || session.lastAccessedAt < oldest.lastAccessedAt) {
        oldest = session;
        oldestId = id;
      }
    }
    
    if (oldestId) {
      this.delete(oldestId);
    }
  }
  
  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Get session statistics
   */
  getStats(): {
    totalSessions: number;
    totalUsers: number;
    oldestSession: number | null;
    memoryUsage: string;
  } {
    let oldest: number | null = null;
    
    for (const session of this.sessions.values()) {
      if (oldest === null || session.createdAt < oldest) {
        oldest = session.createdAt;
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      totalUsers: this.userSessions.size,
      oldestSession: oldest,
      memoryUsage: `${this.sessions.size}/${this.maxSessions} sessions`
    };
  }
}

// Global instance (persists for worker lifetime)
let sessionStore: InMemorySessionStore | null = null;

/**
 * Get or create the session store instance
 */
export function getSessionStore(): InMemorySessionStore {
  if (!sessionStore) {
    sessionStore = new InMemorySessionStore();
  }
  return sessionStore;
}

/**
 * Session cookie utilities
 */
export const SessionCookie = {
  /**
   * Create a session cookie string
   */
  create(sessionId: string, secure: boolean = true): string {
    const flags = [
      `session=${sessionId}`,
      'HttpOnly',
      'SameSite=Strict',
      'Path=/',
      `Max-Age=${7200}` // 2 hours
    ];
    
    if (secure) {
      flags.push('Secure');
    }
    
    return flags.join('; ');
  },
  
  /**
   * Parse session ID from cookie header
   */
  parse(cookieHeader: string | null): string | null {
    if (!cookieHeader) return null;
    
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === 'session') {
        return value;
      }
    }
    
    return null;
  },
  
  /**
   * Create a deletion cookie
   */
  delete(): string {
    return 'session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0';
  }
};

/**
 * Session middleware for request handlers
 */
export async function withSession(
  request: Request,
  handler: (request: Request, session: Session | null) => Promise<Response>
): Promise<Response> {
  const store = getSessionStore();
  const cookieHeader = request.headers.get('Cookie');
  const sessionId = SessionCookie.parse(cookieHeader);
  
  let session: Session | null = null;
  if (sessionId) {
    session = store.get(sessionId);
  }
  
  const response = await handler(request, session);
  
  // Add session cleanup header if needed
  if (session === null && sessionId) {
    response.headers.set('Set-Cookie', SessionCookie.delete());
  }
  
  return response;
}