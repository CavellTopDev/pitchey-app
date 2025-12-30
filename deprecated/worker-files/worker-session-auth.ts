import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SessionManager, RateLimiter } from './auth/session-manager';
import { Redis } from '@upstash/redis';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  FRONTEND_URL: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('*', async (c, next) => {
  const corsMiddleware = cors({
    origin: (origin) => {
      const allowedOrigins = [
        'https://pitchey-5o8.pages.dev',
        'https://*.pitchey-5o8.pages.dev',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000'
      ];
      
      if (!origin) return true;
      
      // Check exact match
      if (allowedOrigins.includes(origin)) return origin;
      
      // Check wildcard patterns
      for (const allowed of allowedOrigins) {
        if (allowed.includes('*')) {
          const pattern = allowed.replace('*', '.*');
          if (new RegExp(pattern).test(origin)) return origin;
        }
      }
      
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposeHeaders: ['Set-Cookie']
  });
  
  return corsMiddleware(c, next);
});

// Session middleware
app.use('*', async (c, next) => {
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_REST_URL,
    token: c.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const sessionManager = new SessionManager(redis, {
    domain: c.env.ENVIRONMENT === 'production' ? '.pitchey-5o8.pages.dev' : undefined,
    secure: c.env.ENVIRONMENT === 'production',
    maxAge: 7 * 24 * 60 * 60 // 7 days
  });

  c.set('sessionManager', sessionManager);
  c.set('redis', redis);

  // Check for existing session
  const cookieHeader = c.req.header('Cookie');
  const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);

  if (sessionId) {
    const session = await sessionManager.getSession(sessionId);
    if (session) {
      c.set('session', session);
      c.set('userId', session.userId);
      c.set('userType', session.userType);
    }
  }

  await next();
});

// Rate limiting middleware for auth endpoints
const authRateLimiter = async (c: any, next: any) => {
  const redis = c.get('redis');
  const rateLimiter = new RateLimiter(redis, 5, 60); // 5 attempts per minute
  
  const identifier = c.req.header('CF-Connecting-IP') || 'unknown';
  const { allowed, remaining } = await rateLimiter.checkLimit(`auth:${identifier}`);
  
  c.header('X-RateLimit-Remaining', remaining.toString());
  
  if (!allowed) {
    return c.json({ error: 'Too many attempts. Please try again later.' }, 429);
  }
  
  await next();
};

// Protected route middleware
const requireAuth = async (c: any, next: any) => {
  const session = c.get('session');
  
  if (!session) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  
  await next();
};

// Login endpoint with secure session
app.post('/api/auth/:portal/login', authRateLimiter, async (c) => {
  const { portal } = c.req.param();
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  // Initialize database
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql, { schema });

  try {
    // Find user
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (!user) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    // Check user type matches portal
    if (user.userType !== portal && portal !== 'admin') {
      return c.json({ error: `This account is not registered as ${portal}` }, 403);
    }

    // Create session
    const sessionManager = c.get('sessionManager');
    const { sessionId, cookie } = await sessionManager.createSession(
      {
        userId: user.id,
        email: user.email,
        userType: user.userType as any,
      },
      c.req.raw
    );

    // Set secure cookie
    c.header('Set-Cookie', cookie);

    // Return user data (without sensitive info)
    const { password: _, ...userData } = user;
    
    return c.json({
      success: true,
      user: userData,
      sessionId: sessionId.substring(0, 8) + '...', // Partial for debugging
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'Authentication failed' }, 500);
  }
});

// Logout endpoint
app.post('/api/auth/logout', async (c) => {
  const cookieHeader = c.req.header('Cookie');
  const sessionId = SessionManager.parseSessionFromCookie(cookieHeader);
  
  if (sessionId) {
    const sessionManager = c.get('sessionManager');
    await sessionManager.destroySession(sessionId);
  }

  // Clear cookie
  const logoutCookie = SessionManager.generateLogoutCookie(
    c.env.ENVIRONMENT === 'production' ? '.pitchey-5o8.pages.dev' : undefined
  );
  
  c.header('Set-Cookie', logoutCookie);
  
  return c.json({ success: true });
});

// Session validation endpoint
app.get('/api/auth/session', requireAuth, async (c) => {
  const session = c.get('session');
  
  // Get fresh user data
  const sql = neon(c.env.DATABASE_URL);
  const db = drizzle(sql, { schema });
  
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  const { password: _, ...userData } = user;
  
  return c.json({
    success: true,
    user: userData,
    session: {
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    }
  });
});

// Invalidate all sessions (useful for password changes)
app.post('/api/auth/sessions/invalidate-all', requireAuth, async (c) => {
  const session = c.get('session');
  const sessionManager = c.get('sessionManager');
  
  await sessionManager.destroyAllUserSessions(session.userId);
  
  // Clear current cookie
  const logoutCookie = SessionManager.generateLogoutCookie(
    c.env.ENVIRONMENT === 'production' ? '.pitchey-5o8.pages.dev' : undefined
  );
  
  c.header('Set-Cookie', logoutCookie);
  
  return c.json({ 
    success: true,
    message: 'All sessions have been invalidated' 
  });
});

// Get active sessions count
app.get('/api/auth/sessions/count', requireAuth, async (c) => {
  const session = c.get('session');
  const redis = c.get('redis');
  
  const sessions = await redis.smembers(`user:${session.userId}:sessions`);
  
  return c.json({
    success: true,
    activeSessions: sessions.length
  });
});

export default app;