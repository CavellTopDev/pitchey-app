import { db } from "../db/client.ts";
import { AuthService } from "./auth.service.ts";

export class SessionService {
  // Re-export auth session methods
  static createSession = AuthService.createSession;
  static verifySession = AuthService.verifySession;
  static logout = AuthService.logout;
  
  static async getUserSessions(userId: number) {
    return await db.query(`
      SELECT id, ip_address, user_agent, expires_at, created_at
      FROM sessions 
      WHERE user_id = $1
      ORDER BY created_at
    `, [userId]);
  }
  
  static async revokeSession(sessionId: string, userId: number) {
    await db.query(`
      DELETE FROM sessions 
      WHERE id = $1 AND user_id = $2
    `, [sessionId, userId]);
  }
  
  static async revokeAllSessions(userId: number, exceptSessionId?: string) {
    if (exceptSessionId) {
      await db.query(`
        DELETE FROM sessions 
        WHERE user_id = $1 AND id != $2
      `, [userId, exceptSessionId]);
    } else {
      await db.query(`
        DELETE FROM sessions 
        WHERE user_id = $1
      `, [userId]);
    }
  }
  
  static async cleanupExpiredSessions() {
    const now = new Date();
    const deletedSessions = await db.query(`
      DELETE FROM sessions 
      WHERE expires_at < $1
      RETURNING id
    `, [now]);
    
    return deletedSessions.length;
  }
  
  static async getSessionWithUser(token: string) {
    const sessionResult = await db.query(`
      SELECT 
        s.*,
        u.id as user_id,
        u.email,
        u.username,
        u.user_type,
        u.first_name,
        u.last_name,
        u.email_verified,
        u.is_active
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.token = $1
      LIMIT 1
    `, [token]);
    
    if (!sessionResult.length) {
      return null;
    }
    
    const session = sessionResult[0];
    
    if (new Date(session.expires_at) < new Date()) {
      return null;
    }
    
    return {
      id: session.id,
      token: session.token,
      userId: session.user_id,
      expiresAt: session.expires_at,
      createdAt: session.created_at,
      user: {
        id: session.user_id,
        email: session.email,
        username: session.username,
        userType: session.user_type,
        firstName: session.first_name,
        lastName: session.last_name,
        emailVerified: session.email_verified,
        isActive: session.is_active,
      },
    };
  }
  
  static async updateSessionActivity(sessionId: string) {
    // For basic session tracking, we could add a lastActivityAt field
    // For now, we'll just verify the session exists
    const sessionResult = await db.query(`
      SELECT * FROM sessions WHERE id = $1
    `, [sessionId]);
    
    return sessionResult[0] || null;
  }
  
  static async validateSessionToken(token: string) {
    try {
      const session = await this.verifySession(token);
      return session;
    } catch {
      return null;
    }
  }
  
  static async getActiveSessionCount(userId: number) {
    const now = new Date();
    const activeSessionsResult = await db.query(`
      SELECT COUNT(*) as count
      FROM sessions 
      WHERE user_id = $1 AND expires_at > $2
    `, [userId, now]);
    
    return activeSessionsResult[0]?.count || 0;
  }
}