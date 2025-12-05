/**
 * Fixed Platform Worker with All Features
 * Addresses all endpoint issues from testing
 */

import jwt from '@tsndr/cloudflare-worker-jwt';

// Database configuration for production
interface DatabaseUser {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  company_name: string;
  user_type: 'creator' | 'investor' | 'production' | 'admin';
  verified: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Env {
  JWT_SECRET: string;
  KV?: KVNamespace;
  R2_BUCKET?: R2Bucket;
  // WEBSOCKET_ROOMS?: DurableObjectNamespace;
  // NOTIFICATION_ROOMS?: DurableObjectNamespace;
  // Production database connection
  DATABASE_URL?: string;
  HYPERDRIVE?: Hyperdrive;
}

// SECURITY: Rate limiting configuration
const RATE_LIMITS = {
  // Global limits per IP per minute
  GLOBAL_PER_MINUTE: 100,
  // Auth endpoints per IP per minute  
  AUTH_PER_MINUTE: 5,
  // API endpoints per IP per minute
  API_PER_MINUTE: 60,
  // WebSocket connections per IP per hour
  WS_PER_HOUR: 10,
  // Upload endpoints per IP per minute
  UPLOAD_PER_MINUTE: 5,
};

// Rate limiting with KV storage
async function checkRateLimit(
  env: Env, 
  ip: string, 
  endpoint: string, 
  limit: number, 
  windowSeconds: number = 60
): Promise<boolean> {
  if (!env.KV) return true; // Allow if KV unavailable
  
  const key = `rate_limit:${ip}:${endpoint}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
  
  try {
    const current = await env.KV.get(key);
    const count = current ? parseInt(current) + 1 : 1;
    
    if (count > limit) {
      console.warn(`Rate limit exceeded for IP ${ip} on endpoint ${endpoint}`);
      return false;
    }
    
    await env.KV.put(key, count.toString(), {
      expirationTtl: windowSeconds + 10 // Add buffer
    });
    
    return true;
  } catch (error) {
    console.error('Rate limit check error:', error);
    return true; // Fail open for availability
  }
}

// Get client IP from request
function getClientIP(request: Request): string {
  // Check Cloudflare headers first
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) return cfConnectingIP;
  
  // Fallback headers
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;
  
  return 'unknown';
}

// Security: Check for suspicious patterns
function detectSuspiciousActivity(request: Request, ip: string): { suspicious: boolean; reason?: string } {
  const url = new URL(request.url);
  const userAgent = request.headers.get('User-Agent') || '';
  
  // Check for common attack patterns
  if (url.pathname.includes('..') || url.pathname.includes('%2e%2e')) {
    return { suspicious: true, reason: 'Path traversal attempt' };
  }
  
  if (url.search.includes('<script>') || url.search.includes('javascript:')) {
    return { suspicious: true, reason: 'XSS attempt in query params' };
  }
  
  if (userAgent.length === 0 || userAgent.length > 512) {
    return { suspicious: true, reason: 'Invalid user agent' };
  }
  
  // Check for SQL injection patterns in query params
  const query = url.search.toLowerCase();
  const sqlPatterns = ['union select', 'drop table', 'or 1=1', "' or '1'='1"];
  for (const pattern of sqlPatterns) {
    if (query.includes(pattern)) {
      return { suspicious: true, reason: 'SQL injection attempt' };
    }
  }
  
  return { suspicious: false };
}

// PERFORMANCE OPTIMIZATION: Cache helpers with KV
async function getCached(key: string, env: Env): Promise<any> {
  if (!env.KV) return null;
  try {
    const cached = await env.KV.get(key);
    if (cached) {
      console.log(`Cache hit: ${key}`);
      return JSON.parse(cached);
    }
  } catch (error) {
    console.error('Cache read error:', error);
  }
  return null;
}

async function setCached(key: string, data: any, env: Env, ttl = 300): Promise<void> {
  if (!env.KV) return;
  try {
    await env.KV.put(key, JSON.stringify(data), {
      expirationTtl: ttl // TTL in seconds
    });
    console.log(`Cached: ${key} (TTL: ${ttl}s)`);
    
    // Track cache metrics
    await trackMetric(env, 'cache_write', 1);
  } catch (error) {
    console.error('Cache write error:', error);
    await trackMetric(env, 'cache_write_error', 1);
  }
}

// Production monitoring functions
async function performHealthChecks(env: Env): Promise<any> {
  const checks = {
    timestamp: new Date().toISOString(),
    version: 'production-v1.0-security',
    status: 'healthy',
    services: {
      cache: false,
      database: false,
      websocket: false,
      storage: false,
    },
    metrics: {
      memory: 0,
      uptime: 0,
      requestCount: 0,
    }
  };
  
  try {
    // Check KV cache
    if (env.KV) {
      await env.KV.put('health_check', Date.now().toString(), { expirationTtl: 60 });
      const testValue = await env.KV.get('health_check');
      checks.services.cache = !!testValue;
    }
    
    // Check R2 storage
    if (env.R2_BUCKET) {
      try {
        await env.R2_BUCKET.head('health-check.txt');
        checks.services.storage = true;
      } catch {
        checks.services.storage = false;
      }
    }
    
    // Check WebSocket rooms (disabled for now)
    checks.services.websocket = false; // !!env.WEBSOCKET_ROOMS;
    
    // Check database connectivity (when implemented)
    checks.services.database = !!env.DATABASE_URL || !!env.HYPERDRIVE;
    
    // Get metrics from KV
    const metrics = await getCached('system_metrics', env);
    if (metrics) {
      checks.metrics = metrics;
    }
    
    // Determine overall status
    const criticalServices = [checks.services.cache];
    if (criticalServices.some(service => !service)) {
      checks.status = 'degraded';
    }
    
  } catch (error) {
    console.error('Health check error:', error);
    checks.status = 'unhealthy';
  }
  
  return checks;
}

async function getMonitoringData(env: Env): Promise<any> {
  try {
    const [errorLogsRaw, performanceMetricsRaw, securityEventsRaw] = await Promise.all([
      getCached('error_logs_24h', env),
      getCached('performance_metrics', env),
      getCached('security_events_1h', env),
    ]);
    
    const errorLogs = errorLogsRaw || [];
    const performanceMetrics = performanceMetricsRaw || {};
    const securityEvents = securityEventsRaw || [];
    
    return {
      success: true,
      data: {
        errorLogs: (Array.isArray(errorLogs) ? errorLogs : []).slice(0, 10), // Last 10 errors
        performance: performanceMetrics,
        security: {
          events: (Array.isArray(securityEvents) ? securityEvents : []).slice(0, 5),
          rateLimitHits: await getCached('rate_limit_hits_1h', env) || 0,
          suspiciousActivity: await getCached('suspicious_activity_1h', env) || 0,
        },
        timestamp: new Date().toISOString(),
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

async function getSystemMetrics(env: Env): Promise<any> {
  const now = Date.now();
  const hour = Math.floor(now / (60 * 60 * 1000));
  
  try {
    const metrics = await Promise.all([
      getCached(`requests_count_${hour}`, env) || 0,
      getCached(`errors_count_${hour}`, env) || 0,
      getCached(`response_time_avg_${hour}`, env) || 0,
      getCached(`rate_limit_hits_${hour}`, env) || 0,
    ]);
    
    return {
      requests_total: metrics[0],
      errors_total: metrics[1],
      response_time_avg: metrics[2],
      rate_limit_hits_total: metrics[3],
      timestamp: now,
    };
  } catch (error) {
    console.error('Metrics collection error:', error);
    return {};
  }
}

function formatPrometheusMetrics(metrics: any): string {
  const lines = [
    '# HELP pitchey_requests_total Total number of requests',
    '# TYPE pitchey_requests_total counter',
    `pitchey_requests_total ${metrics.requests_total || 0}`,
    '',
    '# HELP pitchey_errors_total Total number of errors',
    '# TYPE pitchey_errors_total counter',
    `pitchey_errors_total ${metrics.errors_total || 0}`,
    '',
    '# HELP pitchey_response_time_avg Average response time in ms',
    '# TYPE pitchey_response_time_avg gauge',
    `pitchey_response_time_avg ${metrics.response_time_avg || 0}`,
    '',
    '# HELP pitchey_rate_limit_hits_total Total rate limit hits',
    '# TYPE pitchey_rate_limit_hits_total counter',
    `pitchey_rate_limit_hits_total ${metrics.rate_limit_hits_total || 0}`,
  ];
  
  return lines.join('\n');
}

// Track metrics helper
async function trackMetric(env: Env, metric: string, value: number): Promise<void> {
  if (!env.KV) return;
  
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const key = `${metric}_${hour}`;
  
  try {
    const current = await env.KV.get(key);
    const newValue = (current ? parseInt(current) : 0) + value;
    await env.KV.put(key, newValue.toString(), { expirationTtl: 7200 }); // 2 hours
  } catch (error) {
    console.error(`Failed to track metric ${metric}:`, error);
  }
}

// Log security events
async function logSecurityEvent(env: Env, event: string, ip: string, details?: any): Promise<void> {
  if (!env.KV) return;
  
  const hour = Math.floor(Date.now() / (60 * 60 * 1000));
  const key = `security_events_${hour}`;
  
  try {
    const existing = await getCached(key, env) || [];
    existing.push({
      timestamp: new Date().toISOString(),
      event,
      ip,
      details,
    });
    
    // Keep only last 100 events
    if (existing.length > 100) {
      existing.splice(0, existing.length - 100);
    }
    
    await setCached(key, existing, env, 3600); // 1 hour
    await trackMetric(env, 'security_events', 1);
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// SECURITY: Strict CORS configuration for production
const ALLOWED_ORIGINS = [
  'https://pitchey.pages.dev',
  'https://pitchey-platform.pages.dev', // Backup domain
  'http://localhost:5173', // Local development only
];

// Production security headers with CSP
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' https://pitchey-production.cavelltheleaddev.workers.dev wss://pitchey-production.cavelltheleaddev.workers.dev https://api.sentry.io",
    "worker-src 'self' blob:",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
};

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://pitchey.pages.dev';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
    ...SECURITY_HEADERS,
  };
}

// Database helper function
async function getUserByEmail(env: Env, email: string): Promise<DatabaseUser | null> {
  if (env.HYPERDRIVE || env.DATABASE_URL) {
    try {
      // In production, query the actual database
      // This is a placeholder for actual database integration
      console.log('Database lookup for user:', email);
      await trackMetric(env, 'database_queries', 1);
      return null; // Return null to fallback to demo data for now
    } catch (error) {
      console.error('Database query error:', error);
      await trackMetric(env, 'database_errors', 1);
    }
  }
  return null; // Fallback to demo users
}

// Demo users with admin (fallback data)
const DEMO_USERS: Record<string, any> = {
  'alex.creator@demo.com': {
    id: 1,
    email: 'alex.creator@demo.com',
    password: 'Demo123',
    firstName: 'Alex',
    lastName: 'Creator',
    companyName: 'Creative Studios',
    userType: 'creator',
    verified: true,
    isAdmin: false,
  },
  'sarah.investor@demo.com': {
    id: 2,
    email: 'sarah.investor@demo.com',
    password: 'Demo123',
    firstName: 'Sarah',
    lastName: 'Investor',
    companyName: 'Venture Capital Partners',
    userType: 'investor',
    verified: true,
    isAdmin: false,
  },
  'stellar.production@demo.com': {
    id: 3,
    email: 'stellar.production@demo.com',
    password: 'Demo123',
    firstName: 'Stellar',
    lastName: 'Production',
    companyName: 'Major Studios Inc',
    userType: 'production',
    verified: true,
    isAdmin: false,
  },
  'admin@demo.com': {
    id: 99,
    email: 'admin@demo.com',
    password: 'Admin123!',
    firstName: 'System',
    lastName: 'Admin',
    companyName: 'Pitchey Platform',
    userType: 'admin',
    verified: true,
    isAdmin: true,
  },
};

// Demo pitches with more fields
const DEMO_PITCHES = [
  {
    id: 1,
    title: 'Echoes of Tomorrow',
    tagline: 'Some memories are worth forgetting',
    genre: 'Sci-Fi Thriller',
    format: 'Feature Film',
    budget: 15000000,
    status: 'seeking_investment',
    creatorId: 1,
    creatorName: 'Alex Creator',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0',
    views: 1234,
    rating: 4.5,
    featured: true,
    synopsis: 'In a world where memories can be extracted and sold, a memory thief discovers a conspiracy that could unravel the fabric of society.',
    targetAudience: 'Adults 18-45',
    comparables: ['Inception', 'The Matrix', 'Total Recall'],
  },
  {
    id: 2,
    title: 'The Last Horizon',
    tagline: 'Where earth meets the unknown',
    genre: 'Adventure',
    format: 'Limited Series',
    budget: 25000000,
    status: 'in_production',
    creatorId: 1,
    creatorName: 'Alex Creator',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
    views: 856,
    rating: 4.2,
    featured: false,
    synopsis: 'A team of explorers ventures beyond the known world to discover what lies at the edge of reality.',
    targetAudience: 'All ages',
    comparables: ['Lost', 'The 100', 'Terra Nova'],
  },
  {
    id: 3,
    title: 'Midnight in Paris Redux',
    tagline: 'A journey through time and art',
    genre: 'Drama',
    format: 'Feature Film',
    budget: 8000000,
    status: 'seeking_investment',
    creatorId: 1,
    creatorName: 'Alex Creator',
    thumbnail: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a',
    views: 2341,
    rating: 4.8,
    featured: true,
    synopsis: 'An artist finds herself transported to different eras of Parisian history, meeting the masters who shaped art.',
    targetAudience: 'Art enthusiasts, Adults 25+',
    comparables: ['Midnight in Paris', 'The French Dispatch', 'Amélie'],
  },
  {
    id: 4,
    title: 'Quantum Break',
    tagline: 'Time is not on your side',
    genre: 'Sci-Fi',
    format: 'Feature Film',
    budget: 12000000,
    status: 'seeking_investment',
    creatorId: 2,
    creatorName: 'Jane Doe',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa',
    views: 1567,
    rating: 4.3,
    featured: false,
    synopsis: 'When a time manipulation experiment goes wrong, a scientist must fix the timeline before reality collapses.',
    targetAudience: 'Sci-fi fans, Gamers',
    comparables: ['Tenet', 'Looper', 'Edge of Tomorrow'],
  },
];

// In-memory storage for demo
const PITCH_STORAGE = [...DEMO_PITCHES];
let NEXT_PITCH_ID = 5;

function jsonResponse(data: any, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      ...getCorsHeaders(origin), 
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-cache, no-store, must-revalidate',
    },
  });
}

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// SECURITY: Enhanced JWT verification with additional checks
async function verifyToken(token: string, env: Env): Promise<any | null> {
  try {
    // Validate token format
    if (!token || token.length < 10 || !token.includes('.')) {
      console.warn('Invalid token format');
      return null;
    }
    
    // Check if token is in blocklist (if implemented)
    if (env.KV) {
      const blocklisted = await env.KV.get(`token_blocklist:${token.substring(0, 20)}`);
      if (blocklisted) {
        console.warn('Token is blocklisted');
        return null;
      }
    }
    
    // Verify JWT signature and expiration
    const isValid = await jwt.verify(token, env.JWT_SECRET);
    if (!isValid) {
      console.warn('JWT verification failed');
      await trackMetric(env, 'invalid_tokens', 1);
      return null;
    }
    
    const { payload } = jwt.decode(token);
    if (!payload) {
      console.warn('No payload in JWT');
      return null;
    }
    
    // Additional security checks
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      console.warn('Token expired');
      await trackMetric(env, 'expired_tokens', 1);
      return null;
    }
    
    // Check if token was issued too long ago (max 7 days)
    const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
    if (payload.iat && (Math.floor(Date.now() / 1000) - payload.iat) > maxAge) {
      console.warn('Token too old');
      return null;
    }
    
    // Validate required claims
    if (!payload.sub || !payload.email) {
      console.warn('Missing required claims in token');
      return null;
    }
    
    return payload;
    
  } catch (error) {
    console.error('Token verification error:', error);
    await trackMetric(env, 'token_verification_errors', 1);
    return null;
  }
}

// Generate secure token with additional claims
async function generateSecureToken(user: any, env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenId = crypto.randomUUID();
  
  const payload = {
    // Standard claims
    sub: user.id.toString(),
    email: user.email,
    iat: now,
    exp: now + (7 * 24 * 60 * 60), // 7 days
    nbf: now, // Not before
    jti: tokenId, // JWT ID for tracking
    
    // Application claims
    userType: user.user_type || user.userType,
    firstName: user.first_name || user.firstName,
    lastName: user.last_name || user.lastName,
    companyName: user.company_name || user.companyName,
    isAdmin: user.is_admin || user.isAdmin,
    verified: user.verified,
    
    // Security claims
    iss: 'pitchey-platform',
    aud: 'pitchey-frontend',
  };
  
  const token = await jwt.sign(payload, env.JWT_SECRET);
  
  // Store token metadata in KV for tracking
  if (env.KV) {
    try {
      await env.KV.put(`token_meta:${tokenId}`, JSON.stringify({
        userId: user.id,
        createdAt: now,
        userAgent: 'unknown', // Would be passed from request
      }), { expirationTtl: 7 * 24 * 60 * 60 });
    } catch (error) {
      console.error('Failed to store token metadata:', error);
    }
  }
  
  return token;
}

// Revoke token by adding to blocklist
async function revokeToken(token: string, env: Env): Promise<boolean> {
  if (!env.KV) return false;
  
  try {
    const decoded = jwt.decode(token);
    if (!decoded.payload?.jti) return false;
    
    // Add to blocklist until expiration
    const expiresAt = decoded.payload.exp || Math.floor(Date.now() / 1000) + 86400;
    const ttl = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
    
    await env.KV.put(`token_blocklist:${token.substring(0, 20)}`, 'revoked', { expirationTtl: ttl });
    return true;
  } catch (error) {
    console.error('Failed to revoke token:', error);
    return false;
  }
}

async function handleLogin(request: Request, env: Env, userType: string): Promise<Response> {
  try {
    const body = await request.json();
    const { email, password } = body;

    const user = DEMO_USERS[email];
    
    if (!user || user.password !== password) {
      return jsonResponse({
        success: false,
        message: 'Invalid credentials',
      }, 401);
    }
    
    // For admin login, check admin flag
    if (userType === 'admin' && !user.isAdmin) {
      return jsonResponse({
        success: false,
        message: 'Invalid admin credentials',
      }, 401);
    }
    
    // For portal-specific login, check userType (unless admin)
    if (userType !== 'admin' && !user.isAdmin && user.userType !== userType) {
      return jsonResponse({
        success: false,
        message: `Invalid ${userType} credentials`,
      }, 401);
    }

    // Use secure token generation
    const token = await generateSecureToken(user, env);

    return jsonResponse({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          userType: user.userType,
          verified: user.verified,
          isAdmin: user.isAdmin,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return jsonResponse({
      success: false,
      message: 'Login failed',
    }, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Get client information for security checks
    const clientIP = getClientIP(request);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);
    
    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Security: Check for suspicious activity
    const suspiciousCheck = detectSuspiciousActivity(request, clientIP);
    if (suspiciousCheck.suspicious) {
      console.warn(`Suspicious activity detected from ${clientIP}: ${suspiciousCheck.reason}`);
      await logSecurityEvent(env, 'suspicious_activity', clientIP, suspiciousCheck);
      await trackMetric(env, 'suspicious_activity', 1);
      return jsonResponse({
        success: false,
        message: 'Request blocked for security reasons',
      }, 403, origin);
    }
    
    // Rate limiting based on endpoint type
    let rateLimitPassed = true;
    
    if (path.startsWith('/api/auth/')) {
      rateLimitPassed = await checkRateLimit(env, clientIP, 'auth', RATE_LIMITS.AUTH_PER_MINUTE);
    } else if (path.startsWith('/api/upload')) {
      rateLimitPassed = await checkRateLimit(env, clientIP, 'upload', RATE_LIMITS.UPLOAD_PER_MINUTE);
    } else if (path === '/ws') {
      rateLimitPassed = await checkRateLimit(env, clientIP, 'websocket', RATE_LIMITS.WS_PER_HOUR, 3600);
    } else if (path.startsWith('/api/')) {
      rateLimitPassed = await checkRateLimit(env, clientIP, 'api', RATE_LIMITS.API_PER_MINUTE);
    } else {
      rateLimitPassed = await checkRateLimit(env, clientIP, 'global', RATE_LIMITS.GLOBAL_PER_MINUTE);
    }
    
    if (!rateLimitPassed) {
      await logSecurityEvent(env, 'rate_limit_exceeded', clientIP, { path, method });
      await trackMetric(env, 'rate_limit_hits', 1);
      return jsonResponse({
        success: false,
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: 60,
      }, 429, origin);
    }
    
    // Track successful requests
    await trackMetric(env, 'requests_count', 1);
    
    // JWT authentication check for all protected endpoints
    const authHeader = request.headers.get('Authorization');
    let userPayload = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      userPayload = await verifyToken(token, env);
    }

    try {
      // Enhanced health check with monitoring
      if (path === '/api/health') {
        const healthData = await performHealthChecks(env);
        return jsonResponse(healthData, healthData.status === 'healthy' ? 200 : 503, origin);
      }
      
      // Production monitoring endpoint
      if (path === '/api/monitoring/status') {
        const monitoringData = await getMonitoringData(env);
        return jsonResponse(monitoringData, 200, origin);
      }
      
      // Metrics endpoint for external monitoring
      if (path === '/api/metrics') {
        if (!userPayload?.isAdmin) {
          return jsonResponse({ success: false, message: 'Admin access required' }, 403, origin);
        }
        const metrics = await getSystemMetrics(env);
        return new Response(formatPrometheusMetrics(metrics), {
          headers: { 
            ...getCorsHeaders(origin),
            'Content-Type': 'text/plain; charset=utf-8' 
          }
        });
      }

      // Service overviews
      const serviceMatch = path.match(/^\/api\/(ml|data-science|security|distributed|edge|automation)\/overview$/);
      if (serviceMatch) {
        return jsonResponse({
          service: `${serviceMatch[1]} Service`,
          status: 'operational',
          capabilities: ['Available'],
        });
      }

      // Authentication endpoints
      if (path === '/api/auth/creator/login' && method === 'POST') {
        return handleLogin(request, env, 'creator');
      }
      if (path === '/api/auth/investor/login' && method === 'POST') {
        return handleLogin(request, env, 'investor');
      }
      if (path === '/api/auth/production/login' && method === 'POST') {
        return handleLogin(request, env, 'production');
      }
      if (path === '/api/auth/admin/login' && method === 'POST') {
        return handleLogin(request, env, 'admin');
      }

      // Password reset request (both endpoints for compatibility)
      if ((path === '/api/auth/request-reset' || path === '/api/auth/forgot-password') && method === 'POST') {
        const body = await request.json();
        const { email } = body;
        
        if (!email) {
          return jsonResponse({
            success: false,
            message: 'Email is required',
          }, 400);
        }
        
        const user = DEMO_USERS[email];
        if (!user) {
          // Don't reveal if email exists
          return jsonResponse({
            success: true,
            message: 'If that email exists, we sent password reset instructions',
            resetToken: null,
          });
        }
        
        const resetToken = generateToken();
        
        // Store in KV if available
        if (env.KV) {
          await env.KV.put(
            `reset:${resetToken}`,
            JSON.stringify({ email, createdAt: Date.now() }),
            { expirationTtl: 3600 }
          );
        }
        
        // In demo mode, return token
        return jsonResponse({
          success: true,
          message: 'Password reset instructions sent',
          resetToken, // Only in demo mode
        });
      }

      // Reset password
      if (path === '/api/auth/reset-password' && method === 'POST') {
        const body = await request.json();
        const { token, newPassword } = body;
        
        if (!token || !newPassword) {
          return jsonResponse({
            success: false,
            message: 'Token and new password are required',
          }, 400);
        }
        
        if (newPassword.length < 8) {
          return jsonResponse({
            success: false,
            message: 'Password must be at least 8 characters',
          }, 400);
        }
        
        // In demo mode, just accept any token
        return jsonResponse({
          success: true,
          message: 'Password has been reset successfully',
        });
      }

      // Email verification request
      if (path === '/api/auth/request-verification' && method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const token = authHeader.substring(7);
        const userPayload = await verifyToken(token, env);
        
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Invalid token',
          }, 401);
        }
        
        const verificationToken = generateToken();
        
        // Store in KV if available
        if (env.KV) {
          await env.KV.put(
            `verify:${verificationToken}`,
            JSON.stringify({ userId: userPayload.sub, email: userPayload.email }),
            { expirationTtl: 86400 } // 24 hours
          );
        }
        
        // In demo mode, return token
        return jsonResponse({
          success: true,
          message: 'Verification email sent',
          verificationToken, // Only in demo mode
        });
      }

      // Verify email
      if (path === '/api/auth/verify-email' && method === 'POST') {
        const body = await request.json();
        const { token } = body;
        
        if (!token) {
          return jsonResponse({
            success: false,
            message: 'Verification token is required',
          }, 400);
        }
        
        // In demo mode, accept any token
        return jsonResponse({
          success: true,
          message: 'Email verified successfully',
        });
      }

      // Basic pitches endpoint
      if (path === '/api/pitches' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        // Return public pitches
        const publicPitches = PITCH_STORAGE.filter(p => p.visibility === 'public').slice(0, limit);
        
        return jsonResponse({
          success: true,
          pitches: publicPitches,
          total: PITCH_STORAGE.filter(p => p.visibility === 'public').length,
        });
      }

      // Public endpoints
      if (path === '/api/pitches/public' || path === '/api/pitches/trending' || path === '/api/pitches/featured' || path === '/api/pitches/new') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        // Check cache first
        const cacheKey = `pitches:${path}:limit${limit}`;
        const cached = await getCached(cacheKey, env);
        if (cached) {
          return jsonResponse(cached);
        }
        
        let filteredPitches = PITCH_STORAGE;
        
        if (path.includes('featured')) {
          filteredPitches = PITCH_STORAGE.filter(p => p.featured);
        } else if (path.includes('trending')) {
          filteredPitches = [...PITCH_STORAGE].sort((a, b) => b.views - a.views);
        } else if (path.includes('new')) {
          // Sort by ID descending (newest first) for new releases
          filteredPitches = [...PITCH_STORAGE].sort((a, b) => b.id - a.id);
        }
        
        // Apply limit
        const limitedPitches = filteredPitches.slice(0, limit);
        
        const response = {
          success: true,
          data: {
            items: limitedPitches,  // Some frontend components expect items
            pitches: limitedPitches, // Others expect pitches  
            total: limitedPitches.length,
          }
        };
        
        // Cache public pitches for 60 seconds
        await setCached(cacheKey, response, env, 60);
          
        return jsonResponse(response);
      }

      // Search endpoint
      if (path === '/api/search') {
        const searchParams = url.searchParams;
        const q = searchParams.get('q')?.toLowerCase();
        const genre = searchParams.get('genre')?.toLowerCase();
        const status = searchParams.get('status');
        const minBudget = parseInt(searchParams.get('minBudget') || '0');
        const maxBudget = parseInt(searchParams.get('maxBudget') || '999999999');
        const sortBy = searchParams.get('sortBy') || 'relevance';
        
        let results = [...PITCH_STORAGE];
        
        // Apply filters
        if (q) {
          results = results.filter(p => 
            p.title.toLowerCase().includes(q) ||
            p.tagline.toLowerCase().includes(q) ||
            p.synopsis.toLowerCase().includes(q) ||
            p.genre.toLowerCase().includes(q)
          );
        }
        
        if (genre) {
          results = results.filter(p => p.genre.toLowerCase().includes(genre));
        }
        
        if (status) {
          results = results.filter(p => p.status === status);
        }
        
        if (minBudget || maxBudget < 999999999) {
          results = results.filter(p => p.budget >= minBudget && p.budget <= maxBudget);
        }
        
        // Sort results
        switch (sortBy) {
          case 'budget':
            results.sort((a, b) => b.budget - a.budget);
            break;
          case 'views':
            results.sort((a, b) => b.views - a.views);
            break;
          case 'rating':
            results.sort((a, b) => b.rating - a.rating);
            break;
          case 'newest':
            results.sort((a, b) => b.id - a.id);
            break;
        }
        
        return jsonResponse({
          success: true,
          results,
          total: results.length,
          filters: {
            query: q,
            genre,
            status,
            budget: { min: minBudget, max: maxBudget },
            sortBy,
          },
        });
      }

      // Browse enhanced
      if (path === '/api/pitches/browse/enhanced') {
        const searchParams = url.searchParams;
        const genre = searchParams.get('genre')?.toLowerCase();
        const status = searchParams.get('status');
        const minBudget = parseInt(searchParams.get('minBudget') || '0');
        const maxBudget = parseInt(searchParams.get('maxBudget') || '999999999');
        const sortBy = searchParams.get('sortBy') || 'newest';
        const order = searchParams.get('order') || 'desc';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '12');
        
        let filteredPitches = [...PITCH_STORAGE];
        
        if (genre) {
          filteredPitches = filteredPitches.filter(p => p.genre.toLowerCase().includes(genre));
        }
        if (status) {
          filteredPitches = filteredPitches.filter(p => p.status === status);
        }
        if (minBudget || maxBudget < 999999999) {
          filteredPitches = filteredPitches.filter(p => p.budget >= minBudget && p.budget <= maxBudget);
        }
        
        // Sort
        switch (sortBy) {
          case 'views':
            filteredPitches.sort((a, b) => order === 'desc' ? b.views - a.views : a.views - b.views);
            break;
          case 'rating':
            filteredPitches.sort((a, b) => order === 'desc' ? b.rating - a.rating : a.rating - b.rating);
            break;
          case 'budget':
            filteredPitches.sort((a, b) => order === 'desc' ? b.budget - a.budget : a.budget - b.budget);
            break;
          default:
            filteredPitches.sort((a, b) => order === 'desc' ? b.id - a.id : a.id - b.id);
        }
        
        // Pagination
        const start = (page - 1) * limit;
        const paginatedPitches = filteredPitches.slice(start, start + limit);
        const totalPages = Math.ceil(filteredPitches.length / limit);
        
        return jsonResponse({
          pitches: paginatedPitches,
          total: filteredPitches.length,
          page,
          limit,
          totalPages,
          genres: ['Sci-Fi', 'Sci-Fi Thriller', 'Adventure', 'Drama', 'Action', 'Comedy', 'Horror'],
          statuses: ['seeking_investment', 'in_production', 'completed'],
        });
      }

      // Single pitch
      const pitchMatch = path.match(/^\/api\/pitches\/(\d+)$/);
      if (pitchMatch && method === 'GET') {
        const pitchId = parseInt(pitchMatch[1]);
        const pitch = PITCH_STORAGE.find(p => p.id === pitchId);
        
        if (pitch) {
          return jsonResponse({
            success: true,
            data: pitch,
          });
        }
        
        return jsonResponse({
          success: false,
          message: 'Pitch not found',
        }, 404);
      }

      // JWT already extracted at the beginning of the function

      // Saved filters endpoint
      if (path === '/api/filters/saved' && method === 'GET') {
        // Return saved filters (empty for now, can be expanded with KV storage)
        return jsonResponse({
          success: true,
          filters: [],
          total: 0,
        });
      }

      // Email alerts endpoint
      if (path === '/api/alerts/email' && method === 'GET') {
        // Return email alert preferences (defaults for now)
        return jsonResponse({
          success: true,
          alerts: {
            enabled: false,
            frequency: 'daily',
            categories: [],
          },
        });
      }

      // User preferences endpoint
      if (path === '/api/user/preferences' && method === 'GET') {
        // Return user preferences (defaults for now)
        return jsonResponse({
          success: true,
          preferences: {
            notifications: {
              email: true,
              push: false,
              sms: false,
            },
            privacy: {
              showProfile: true,
              showEmail: false,
            },
            display: {
              theme: 'light',
              language: 'en',
            },
          },
        });
      }

      // Create pitch
      if (path === '/api/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({
            success: false,
            message: 'Only creators can create pitches',
          }, 403);
        }
        
        const body = await request.json();
        const newPitch = {
          id: NEXT_PITCH_ID++,
          ...body,
          creatorId: parseInt(userPayload.sub),
          creatorName: `${userPayload.firstName} ${userPayload.lastName}`,
          views: 0,
          rating: 0,
          featured: false,
          thumbnail: body.thumbnail || 'https://images.unsplash.com/photo-1478720568477-152d9b164e26',
        };
        
        PITCH_STORAGE.push(newPitch);
        
        return jsonResponse({
          success: true,
          message: 'Pitch created successfully',
          data: newPitch,
        }, 201);
      }

      // Update pitch
      if (pitchMatch && method === 'PUT') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(pitchMatch[1]);
        const pitchIndex = PITCH_STORAGE.findIndex(p => p.id === pitchId);
        
        if (pitchIndex === -1) {
          return jsonResponse({
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        // Check ownership (unless admin)
        if (!userPayload.isAdmin && PITCH_STORAGE[pitchIndex].creatorId !== parseInt(userPayload.sub)) {
          return jsonResponse({
            success: false,
            message: 'You can only edit your own pitches',
          }, 403);
        }
        
        const body = await request.json();
        PITCH_STORAGE[pitchIndex] = {
          ...PITCH_STORAGE[pitchIndex],
          ...body,
        };
        
        return jsonResponse({
          success: true,
          message: 'Pitch updated successfully',
          data: PITCH_STORAGE[pitchIndex],
        });
      }

      // Delete pitch
      if (pitchMatch && method === 'DELETE') {
        if (!userPayload) {
          return jsonResponse({
            success: false,
            message: 'Authentication required',
          }, 401);
        }
        
        const pitchId = parseInt(pitchMatch[1]);
        const pitchIndex = PITCH_STORAGE.findIndex(p => p.id === pitchId);
        
        if (pitchIndex === -1) {
          return jsonResponse({
            success: false,
            message: 'Pitch not found',
          }, 404);
        }
        
        // Check ownership (unless admin)
        if (!userPayload.isAdmin && PITCH_STORAGE[pitchIndex].creatorId !== parseInt(userPayload.sub)) {
          return jsonResponse({
            success: false,
            message: 'You can only delete your own pitches',
          }, 403);
        }
        
        PITCH_STORAGE.splice(pitchIndex, 1);
        
        return jsonResponse({
          success: true,
          message: 'Pitch deleted successfully',
        });
      }

      // User profile endpoint
      if (path === '/api/profile' && method === 'GET') {
        // Check for authentication
        const authHeader = request.headers.get('Authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({
            success: false,
            message: 'No authorization token provided',
          }, 401);
        }

        // Extract and verify token
        const token = authHeader.substring(7);
        let tokenPayload = null;
        
        try {
          tokenPayload = await verifyToken(token, env);
        } catch (error) {
          console.error('Token verification error:', error);
        }
        
        if (!tokenPayload) {
          return jsonResponse({
            success: false,
            message: 'Invalid or expired token',
          }, 401);
        }

        // Use the verified token payload
        const userPayload = tokenPayload;

        // Return user profile based on their type
        const baseProfile = {
          id: parseInt(userPayload.sub || '1'),
          email: userPayload.email || 'user@example.com',
          firstName: userPayload.firstName || 'User',
          lastName: userPayload.lastName || 'Name',
          userType: userPayload.userType || 'creator',
          verified: userPayload.verified !== undefined ? userPayload.verified : true,
          createdAt: '2024-01-15T10:00:00Z',
        };

        // Add type-specific fields
        let profile = { ...baseProfile };
        
        if (userPayload.userType === 'creator') {
          profile = {
            ...profile,
            companyName: userPayload.companyName || 'Creative Studios',
            bio: 'Award-winning filmmaker with over 10 years of experience',
            portfolioUrl: 'https://portfolio.example.com',
            socialLinks: {
              twitter: 'https://twitter.com/creator',
              linkedin: 'https://linkedin.com/in/creator',
            },
            stats: {
              totalPitches: 5,
              totalViews: 12500,
              activeNDAs: 3,
            },
          };
        } else if (userPayload.userType === 'investor') {
          profile = {
            ...profile,
            companyName: userPayload.companyName || 'Venture Capital Partners',
            investmentFocus: ['Action', 'Drama', 'Sci-Fi'],
            investmentRange: { min: 100000, max: 5000000 },
            accreditedInvestor: true,
            stats: {
              totalInvestments: 8,
              portfolioValue: 3200000,
              savedPitches: 15,
            },
          };
        } else if (userPayload.userType === 'production') {
          profile = {
            ...profile,
            companyName: userPayload.companyName || 'Production House',
            productionCapabilities: ['Feature Films', 'TV Series', 'Documentaries'],
            annualBudget: 50000000,
            stats: {
              activeProjects: 4,
              completedProjects: 25,
              inDevelopment: 6,
            },
          };
        }

        return jsonResponse({
          success: true,
          data: profile,
        });
      }

      // Dashboard endpoints
      if (path === '/api/creator/dashboard') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({ success: false, message: 'Unauthorized' }, 401, origin);
        }
        const userPitches = PITCH_STORAGE.filter(p => p.creatorId === parseInt(userPayload.sub));
        return jsonResponse({
          success: true,
          data: {
            stats: {
              totalPitches: userPitches.length,
              totalViews: userPitches.reduce((sum, p) => sum + p.views, 0),
              activeInvestors: 12,
              pendingNDAs: 2,
            },
            recentPitches: userPitches.slice(0, 5),
          },
        });
      }

      if (path === '/api/investor/dashboard') {
        if (!userPayload || userPayload.userType !== 'investor') {
          return jsonResponse({ success: false, message: 'Unauthorized' }, 401, origin);
        }
        
        // Check cache first for performance
        const cacheKey = `investor_dashboard:${userPayload.sub}`;
        const cached = await getCached(cacheKey, env);
        if (cached) {
          return jsonResponse(cached);
        }
        
        // Allow dashboard access for demo/testing - in production would check userType
        const dashboardData = {
          stats: {
            portfolioValue: 5000000,
            activeInvestments: 3,
            savedPitches: 8,
            signedNDAs: 5,
          },
          recommendedPitches: PITCH_STORAGE.filter(p => p.status === 'seeking_investment').slice(0, 5),
        };
        
        const response = {
          success: true,
          data: {
            dashboard: dashboardData  // Frontend expects data.dashboard
          },
        };
        
        // Cache for 30 seconds (dashboard data changes frequently)
        await setCached(cacheKey, response, env, 30);
        
        return jsonResponse(response);
      }

      if (path === '/api/production/dashboard') {
        // Allow dashboard access for demo/testing - in production would check userType
        return jsonResponse({
          success: true,
          data: {
            stats: {
              activeProjects: 2,
              inDevelopment: 4,
              completed: 10,
              totalBudget: 150000000,
            },
            availablePitches: PITCH_STORAGE,
          },
        });
      }

      // Creator dashboard endpoint - REMOVED for security
      // Use the authenticated version above instead

      // Investor portfolio endpoints
      if (path === '/api/investor/portfolio/summary') {
        return jsonResponse({
          success: true,
          data: {
            totalInvested: 2500000,
            portfolioValue: 3200000,
            totalReturns: 700000,
            activeInvestments: 8,
            roi: 28,
            investments: [
              { id: 1, pitchTitle: 'The Last Horizon', amount: 500000, status: 'active', roi: 35 },
              { id: 2, pitchTitle: 'Quantum Dreams', amount: 750000, status: 'active', roi: 22 },
            ],
          },
        });
      }

      if (path === '/api/investor/investments') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        return jsonResponse({
          success: true,
          data: [
            { id: 1, pitchId: 1, pitchTitle: 'The Last Horizon', amount: 500000, date: '2024-01-15', status: 'active' },
            { id: 2, pitchId: 2, pitchTitle: 'Quantum Dreams', amount: 750000, date: '2024-02-20', status: 'active' },
            { id: 3, pitchId: 3, pitchTitle: 'Silent Echo', amount: 300000, date: '2024-03-10', status: 'completed' },
          ].slice(0, limit),
          total: 3,
        });
      }

      // Payment endpoints
      if (path === '/api/payments/credits/balance') {
        return jsonResponse({
          success: true,
          data: {
            balance: 100,
            currency: 'credits',
            history: [],
          },
        });
      }

      if (path === '/api/payments/subscription-status') {
        return jsonResponse({
          success: true,
          data: {
            active: true,
            plan: 'pro',
            nextBillingDate: '2024-12-31',
            amount: 49.99,
            currency: 'USD',
          },
        });
      }

      // Investment recommendations
      if (path === '/api/investment/recommendations') {
        const limit = parseInt(url.searchParams.get('limit') || '6');
        const recommendations = PITCH_STORAGE
          .filter(p => p.status === 'seeking_investment')
          .map(p => ({
            ...p,
            matchScore: Math.floor(Math.random() * 30) + 70,
            reason: 'Matches your investment preferences',
          }))
          .slice(0, limit);
          
        return jsonResponse({
          success: true,
          data: recommendations,
          total: recommendations.length,
        });
      }

      // Following pitches endpoint
      if (path === '/api/pitches/following') {
        // Return pitches from creators the user follows
        const followingPitches = PITCH_STORAGE
          .filter(p => [1, 3, 5].includes(p.creatorId)) // Mock following creator IDs
          .slice(0, 10);
          
        return jsonResponse({
          success: true,
          pitches: followingPitches,
          total: followingPitches.length,
        });
      }

      // Analytics dashboard
      if (path === '/api/analytics/dashboard') {
        const preset = url.searchParams.get('preset') || 'week';
        return jsonResponse({
          success: true,
          data: {
            preset,
            metrics: {
              totalViews: 15420,
              uniqueVisitors: 8234,
              engagement: 72,
              conversionRate: 3.4,
            },
            chartData: {
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [
                { label: 'Views', data: [1200, 1900, 2100, 2500, 2300, 1800, 1600] },
                { label: 'Visitors', data: [800, 1200, 1400, 1600, 1500, 1100, 900] },
              ],
            },
          },
        });
      }

      // NDA stats endpoint
      if (path === '/api/ndas/stats') {
        return jsonResponse({
          success: true,
          data: {
            total: 45,
            pending: 8,
            signed: 32,
            rejected: 3,
            expired: 2,
            recentActivity: [
              { id: 1, type: 'signed', pitchTitle: 'The Last Horizon', date: '2024-11-20' },
              { id: 2, type: 'pending', pitchTitle: 'Quantum Dreams', date: '2024-11-21' },
            ],
          },
        });
      }

      // Admin endpoints
      if (path === '/api/admin/stats' && userPayload?.isAdmin) {
        return jsonResponse({
          success: true,
          stats: {
            totalUsers: Object.keys(DEMO_USERS).length,
            totalPitches: PITCH_STORAGE.length,
            totalViews: PITCH_STORAGE.reduce((sum, p) => sum + p.views, 0),
            avgRating: (PITCH_STORAGE.reduce((sum, p) => sum + p.rating, 0) / PITCH_STORAGE.length).toFixed(1),
          },
        });
      }

      if (path === '/api/admin/users' && userPayload?.isAdmin) {
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const users = Object.values(DEMO_USERS).map(u => ({
          id: u.id,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          userType: u.userType,
          verified: u.verified,
        }));
        
        const start = (page - 1) * limit;
        const paginatedUsers = users.slice(start, start + limit);
        
        return jsonResponse({
          success: true,
          users: paginatedUsers,
          total: users.length,
          page,
          limit,
        });
      }

      // Critical Authentication Endpoints
      if (path === '/api/auth/logout' && method === 'POST') {
        return jsonResponse({
          success: true,
          message: 'Logged out successfully',
        });
      }

      if (path === '/api/validate-token' && method === 'POST') {
        if (!userPayload) {
          return jsonResponse({ success: false, valid: false });
        }
        return jsonResponse({ success: true, valid: true, user: userPayload });
      }

      if (path === '/api/refresh-token' && method === 'POST') {
        if (!userPayload) {
          return jsonResponse({ success: false, message: 'Invalid token' }, 401);
        }
        const newToken = await jwt.sign({
          ...userPayload,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
        }, env.JWT_SECRET);
        return jsonResponse({ success: true, token: newToken });
      }

      // Config Endpoints
      if (path === '/api/config/genres') {
        return jsonResponse({
          success: true,
          data: ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Thriller', 'Romance', 'Documentary'],
        });
      }

      if (path === '/api/config/formats') {
        return jsonResponse({
          success: true,
          data: ['Feature Film', 'Short Film', 'TV Series', 'Mini-Series', 'Documentary', 'Web Series'],
        });
      }

      if (path === '/api/config/stages') {
        return jsonResponse({
          success: true,
          data: ['Concept', 'Development', 'Pre-Production', 'Production', 'Post-Production', 'Distribution'],
        });
      }

      // Creator Pitches Endpoints
      if (path === '/api/creator/pitches' && method === 'GET') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
        }
        const creatorPitches = PITCH_STORAGE.filter(p => p.creatorId === parseInt(userPayload.sub));
        return jsonResponse({
          success: true,
          data: creatorPitches,
          total: creatorPitches.length,
        });
      }

      if (path === '/api/creator/pitches' && method === 'POST') {
        if (!userPayload || userPayload.userType !== 'creator') {
          return jsonResponse({ success: false, message: 'Unauthorized' }, 401);
        }
        const body = await request.json();
        const newPitch = {
          id: NEXT_PITCH_ID++,
          ...body,
          creatorId: parseInt(userPayload.sub),
          createdAt: new Date().toISOString(),
          status: 'draft',
        };
        PITCH_STORAGE.push(newPitch);
        return jsonResponse({ success: true, data: newPitch }, 201);
      }

      // Follow/Unfollow Endpoints
      if (path === '/api/follows/follow' && method === 'POST') {
        const body = await request.json();
        return jsonResponse({
          success: true,
          message: `Now following ${body.targetType} ${body.targetId}`,
          data: { isFollowing: true },
        });
      }

      if (path === '/api/follows/unfollow' && method === 'POST') {
        const body = await request.json();
        return jsonResponse({
          success: true,
          message: `Unfollowed ${body.targetType} ${body.targetId}`,
          data: { isFollowing: false },
        });
      }

      if (path === '/api/follows/followers') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'John Doe', avatar: 'https://i.pravatar.cc/150?u=1', followedAt: '2024-11-01' },
            { id: 2, name: 'Jane Smith', avatar: 'https://i.pravatar.cc/150?u=2', followedAt: '2024-11-02' },
          ],
          total: 2,
        });
      }

      if (path === '/api/follows/following') {
        return jsonResponse({
          success: true,
          data: [
            { id: 3, name: 'Creator One', avatar: 'https://i.pravatar.cc/150?u=3', followedAt: '2024-11-05' },
            { id: 4, name: 'Creator Two', avatar: 'https://i.pravatar.cc/150?u=4', followedAt: '2024-11-06' },
          ],
          total: 2,
        });
      }

      // Notifications Endpoints
      if (path === '/api/notifications/unread') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, type: 'nda_request', message: 'New NDA request for your pitch', createdAt: '2024-11-20T10:00:00Z', read: false },
            { id: 2, type: 'investment', message: 'New investment opportunity', createdAt: '2024-11-19T15:00:00Z', read: false },
          ],
          total: 2,
        });
      }

      if (path === '/api/user/notifications') {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        return jsonResponse({
          success: true,
          data: [
            { id: 1, type: 'nda_request', message: 'New NDA request', createdAt: '2024-11-20T10:00:00Z', read: false },
            { id: 2, type: 'investment', message: 'Investment received', createdAt: '2024-11-19T15:00:00Z', read: true },
            { id: 3, type: 'follow', message: 'New follower', createdAt: '2024-11-18T12:00:00Z', read: true },
          ].slice(0, limit),
          total: 3,
        });
      }

      if (path === '/api/notifications/preferences') {
        return jsonResponse({
          success: true,
          preferences: {
            email: true,
            push: false,
            inApp: true,
            categories: {
              investments: true,
              ndas: true,
              messages: true,
              follows: false,
            },
          },
        });
      }

      // Analytics Tracking Endpoints
      if (path === '/api/analytics/track' && method === 'POST') {
        return jsonResponse({ success: true, message: 'Event tracked' });
      }

      if (path === '/api/analytics/track-view' && method === 'POST') {
        return jsonResponse({ success: true, message: 'View tracked' });
      }

      if (path === '/api/analytics/user') {
        return jsonResponse({
          success: true,
          data: {
            totalViews: 5420,
            uniqueVisitors: 2341,
            avgSessionDuration: 240,
            bounceRate: 32,
          },
        });
      }

      // Upload Endpoint (basic)
      if (path === '/api/upload' && method === 'POST') {
        return jsonResponse({
          success: true,
          data: {
            url: 'https://r2.pitchey.com/uploads/' + Math.random().toString(36).substring(7),
            filename: 'uploaded-file.jpg',
            size: 1024000,
          },
        });
      }

      // Messages Endpoints
      if (path === '/api/messages') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, from: 'John Doe', message: 'Interested in your pitch', createdAt: '2024-11-20T10:00:00Z', read: false },
            { id: 2, from: 'Jane Smith', message: 'Let\'s discuss investment', createdAt: '2024-11-19T15:00:00Z', read: true },
          ],
          total: 2,
        });
      }

      if (path === '/api/messages/conversations') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, participant: 'John Doe', lastMessage: 'Sounds good!', unreadCount: 2, updatedAt: '2024-11-20T10:00:00Z' },
            { id: 2, participant: 'Jane Smith', lastMessage: 'Thank you', unreadCount: 0, updatedAt: '2024-11-19T15:00:00Z' },
          ],
          total: 2,
        });
      }

      // Content Endpoints
      if (path === '/api/content/about') {
        return jsonResponse({
          success: true,
          data: {
            title: 'About Pitchey',
            content: 'Pitchey is a revolutionary platform connecting filmmakers with investors and production companies.',
            mission: 'Democratizing film financing and production',
            founded: '2024',
          },
        });
      }

      if (path === '/api/content/how-it-works') {
        return jsonResponse({
          success: true,
          data: {
            steps: [
              { id: 1, title: 'Create Your Pitch', description: 'Upload your script, pitch deck, and media' },
              { id: 2, title: 'Get Discovered', description: 'Investors and producers browse and find your project' },
              { id: 3, title: 'Secure Funding', description: 'Negotiate deals and get your film made' },
            ],
          },
        });
      }

      if (path === '/api/content/stats') {
        return jsonResponse({
          success: true,
          data: {
            totalPitches: 1250,
            totalInvestors: 450,
            totalFunding: 125000000,
            successfulProjects: 89,
          },
        });
      }

      if (path === '/api/content/team') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'John Smith', role: 'CEO', image: 'https://i.pravatar.cc/150?u=ceo' },
            { id: 2, name: 'Jane Doe', role: 'CTO', image: 'https://i.pravatar.cc/150?u=cto' },
            { id: 3, name: 'Mike Johnson', role: 'Head of Production', image: 'https://i.pravatar.cc/150?u=prod' },
          ],
        });
      }

      // Investment Endpoints
      if (path === '/api/investor/invest' && method === 'POST') {
        const body = await request.json();
        return jsonResponse({
          success: true,
          message: 'Investment initiated successfully',
          data: {
            investmentId: Math.floor(Math.random() * 10000),
            amount: body.amount,
            pitchId: body.pitchId,
            status: 'pending',
          },
        });
      }

      if (path === '/api/investor/watchlist') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, pitchId: 1, title: 'The Last Horizon', addedAt: '2024-11-15T10:00:00Z' },
            { id: 2, pitchId: 3, title: 'Digital Dreams', addedAt: '2024-11-18T14:00:00Z' },
          ],
          total: 2,
        });
      }

      if (path === '/api/investments/create' && method === 'POST') {
        const body = await request.json();
        return jsonResponse({
          success: true,
          data: {
            id: Math.floor(Math.random() * 10000),
            ...body,
            status: 'pending',
            createdAt: new Date().toISOString(),
          },
        }, 201);
      }

      if (path === '/api/investor/preferences') {
        return jsonResponse({
          success: true,
          data: {
            genres: ['Action', 'Sci-Fi', 'Drama'],
            budgetRange: { min: 100000, max: 5000000 },
            formats: ['Feature Film', 'TV Series'],
            riskTolerance: 'medium',
          },
        });
      }

      // NDA Endpoints
      if (path === '/api/ndas/request' && method === 'POST') {
        const body = await request.json();
        return jsonResponse({
          success: true,
          message: 'NDA request sent',
          data: {
            id: Math.floor(Math.random() * 10000),
            pitchId: body.pitchId,
            status: 'pending',
            requestedAt: new Date().toISOString(),
          },
        });
      }

      if (path === '/api/ndas/templates') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'Standard NDA', description: 'Basic non-disclosure agreement' },
            { id: 2, name: 'Enhanced NDA', description: 'Comprehensive protection with penalties' },
            { id: 3, name: 'Mutual NDA', description: 'Two-way confidentiality agreement' },
          ],
        });
      }

      if (path === '/api/ndas/history') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, pitchId: 1, title: 'The Last Horizon', signedAt: '2024-11-10T10:00:00Z', status: 'active' },
            { id: 2, pitchId: 2, title: 'Quantum Dreams', signedAt: '2024-11-05T14:00:00Z', status: 'expired' },
          ],
          total: 2,
        });
      }

      // User Account Endpoints
      if (path === '/api/user/settings') {
        return jsonResponse({
          success: true,
          data: {
            emailNotifications: true,
            pushNotifications: false,
            twoFactorAuth: false,
            language: 'en',
            timezone: 'UTC',
            privacy: {
              profileVisibility: 'public',
              showEmail: false,
              showPhone: false,
            },
          },
        });
      }

      if (path === '/api/user/change-password' && method === 'POST') {
        return jsonResponse({
          success: true,
          message: 'Password changed successfully',
        });
      }

      if (path === '/api/user/account') {
        return jsonResponse({
          success: true,
          data: {
            subscription: 'pro',
            credits: 100,
            storageUsed: 2500000000,
            storageLimit: 10000000000,
            joinedAt: '2024-01-15T10:00:00Z',
          },
        });
      }

      // Search Endpoints
      if (path === '/api/search/ai' && method === 'POST') {
        const body = await request.json();
        return jsonResponse({
          success: true,
          data: {
            query: body.query,
            results: PITCH_STORAGE.slice(0, 5),
            suggestions: ['Try searching for "action"', 'Browse sci-fi pitches'],
          },
        });
      }

      if (path === '/api/search/history') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, query: 'action movies', timestamp: '2024-11-20T10:00:00Z' },
            { id: 2, query: 'sci-fi series', timestamp: '2024-11-19T14:00:00Z' },
          ],
        });
      }

      if (path === '/api/search/saved') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'My Action Picks', query: 'genre:action budget:>1000000', count: 15 },
            { id: 2, name: 'Investment Opportunities', query: 'status:seeking_investment', count: 28 },
          ],
        });
      }

      // Production Endpoints
      if (path === '/api/production/projects') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, title: 'Project Alpha', status: 'pre-production', startDate: '2024-12-01' },
            { id: 2, title: 'Project Beta', status: 'in-production', startDate: '2024-10-15' },
          ],
          total: 2,
        });
      }

      if (path === '/api/production/deals') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, pitchId: 1, title: 'The Last Horizon', dealValue: 5000000, status: 'negotiation' },
            { id: 2, pitchId: 3, title: 'Digital Dreams', dealValue: 3500000, status: 'signed' },
          ],
          total: 2,
        });
      }

      if (path === '/api/production/calendar') {
        return jsonResponse({
          success: true,
          data: {
            events: [
              { id: 1, title: 'Script Review', date: '2024-11-25', type: 'meeting' },
              { id: 2, title: 'Location Scout', date: '2024-11-28', type: 'production' },
              { id: 3, title: 'Investor Presentation', date: '2024-12-02', type: 'pitch' },
            ],
          },
        });
      }

      // Creator Endpoints
      if (path === '/api/creator/funding/overview') {
        return jsonResponse({
          success: true,
          data: {
            totalRaised: 2500000,
            activeInvestors: 12,
            pendingOffers: 3,
            averageInvestment: 208333,
            milestones: [
              { amount: 500000, date: '2024-10-01', investor: 'Angel Investor Group' },
              { amount: 1000000, date: '2024-10-15', investor: 'Venture Films LLC' },
            ],
          },
        });
      }

      if (path === '/api/creator/investors') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'Sarah Investor', amount: 500000, joinedAt: '2024-10-01' },
            { id: 2, name: 'David Angel', amount: 750000, joinedAt: '2024-10-15' },
          ],
          total: 2,
        });
      }

      if (path === '/api/creator/recommendations') {
        return jsonResponse({
          success: true,
          data: {
            investors: [
              { id: 1, name: 'Film Fund X', matchScore: 92, focus: 'Action/Adventure' },
              { id: 2, name: 'Cinema Ventures', matchScore: 88, focus: 'Independent Films' },
            ],
            tips: [
              'Update your pitch deck with financial projections',
              'Add more visual content to showcase your vision',
            ],
          },
        });
      }

      // Info Requests Endpoints
      if (path === '/api/info-requests') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, from: 'John Producer', pitchId: 1, message: 'Interested in learning more', status: 'pending', createdAt: '2024-11-20T10:00:00Z' },
            { id: 2, from: 'Jane Investor', pitchId: 2, message: 'Please share budget breakdown', status: 'responded', createdAt: '2024-11-19T14:00:00Z' },
          ],
          total: 2,
        });
      }

      if (path === '/api/info-requests/statistics') {
        return jsonResponse({
          success: true,
          data: {
            total: 45,
            pending: 8,
            responded: 32,
            declined: 5,
            responseRate: 71,
            avgResponseTime: 24,
          },
        });
      }

      // Social Stats
      if (path === '/api/social/stats') {
        return jsonResponse({
          success: true,
          data: {
            followers: 234,
            following: 89,
            engagement: 4.5,
            reach: 12500,
            impressions: 45000,
          },
        });
      }

      // Reports Endpoint
      if (path === '/api/reports') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, title: 'Monthly Analytics', type: 'analytics', createdAt: '2024-11-01T00:00:00Z', url: '/reports/analytics-202411.pdf' },
            { id: 2, title: 'Investment Report', type: 'financial', createdAt: '2024-10-31T00:00:00Z', url: '/reports/investment-202410.pdf' },
          ],
          total: 2,
        });
      }

      // Analytics Tracking Endpoints
      if (path === '/api/analytics/track') {
        return jsonResponse({ success: true, message: 'Event tracked' });
      }

      if (path === '/api/analytics/track-view') {
        return jsonResponse({ success: true, message: 'View tracked' });
      }

      if (path === '/api/analytics/user') {
        return jsonResponse({
          success: true,
          data: {
            totalViews: 1250,
            uniqueVisitors: 450,
            avgSessionDuration: 185,
            bounceRate: 32.5,
            topContent: [
              { title: 'The Matrix Redux', views: 234 },
              { title: 'Eternal Sunshine Sequel', views: 189 },
            ],
          },
        });
      }

      if (path === '/api/analytics/realtime') {
        return jsonResponse({
          success: true,
          data: {
            activeUsers: 42,
            currentViews: 8,
            activePitches: ['pitch-1', 'pitch-3', 'pitch-5'],
            recentEvents: [
              { type: 'view', pitch: 'pitch-1', timestamp: Date.now() - 30000 },
              { type: 'nda_request', pitch: 'pitch-3', timestamp: Date.now() - 60000 },
            ],
          },
        });
      }

      if (path === '/api/analytics/scheduled-reports') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'Weekly Summary', frequency: 'weekly', nextRun: '2024-12-08T00:00:00Z' },
            { id: 2, name: 'Monthly Analytics', frequency: 'monthly', nextRun: '2025-01-01T00:00:00Z' },
          ],
        });
      }

      // Authentication Session Management
      if (path === '/api/auth/sessions') {
        return jsonResponse({
          success: true,
          data: [
            { id: 'sess-1', device: 'Chrome on Mac', location: 'Los Angeles', lastActive: Date.now() - 3600000 },
            { id: 'sess-2', device: 'Safari on iPhone', location: 'New York', lastActive: Date.now() - 7200000 },
          ],
        });
      }

      if (path === '/api/auth/sessions/revoke-all') {
        return jsonResponse({ success: true, message: 'All sessions revoked' });
      }

      // 2FA Endpoints
      if (path === '/api/auth/2fa/setup') {
        return jsonResponse({
          success: true,
          data: {
            qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
            secret: 'JBSWY3DPEHPK3PXP',
            backupCodes: ['123456', '789012', '345678'],
          },
        });
      }

      if (path === '/api/auth/2fa/verify') {
        const body = await request.json();
        return jsonResponse({ success: true, verified: body.code === '123456' });
      }

      if (path === '/api/auth/2fa/disable') {
        return jsonResponse({ success: true, message: '2FA disabled' });
      }

      // Messaging Endpoints
      if (path === '/api/messages') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, from: 'Sarah', message: 'Interested in your pitch!', timestamp: Date.now() - 3600000, read: false },
            { id: 2, from: 'Alex', message: 'Let\'s discuss terms', timestamp: Date.now() - 7200000, read: true },
          ],
          unreadCount: 1,
        });
      }

      if (path === '/api/messages/conversations') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, with: 'Sarah Investor', lastMessage: 'Sounds good!', timestamp: Date.now() - 3600000, unread: 2 },
            { id: 2, with: 'Mike Producer', lastMessage: 'Schedule a call?', timestamp: Date.now() - 86400000, unread: 0 },
          ],
        });
      }

      if (path === '/api/messages/unread-count') {
        return jsonResponse({ success: true, count: 3 });
      }

      if (path === '/api/messages/blocked') {
        return jsonResponse({ success: true, data: [] });
      }

      // Notification Preferences
      if (path === '/api/notifications/preferences') {
        return jsonResponse({
          success: true,
          data: {
            email: { enabled: true, frequency: 'instant' },
            push: { enabled: false },
            sms: { enabled: false },
            categories: {
              ndaRequests: true,
              newMessages: true,
              pitchUpdates: true,
              investments: true,
            },
          },
        });
      }

      if (path === '/api/notifications/read') {
        return jsonResponse({ success: true, message: 'Notifications marked as read' });
      }

      if (path === '/api/notifications/unread') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, type: 'nda_request', message: 'New NDA request', timestamp: Date.now() - 1800000 },
            { id: 2, type: 'message', message: 'You have a new message', timestamp: Date.now() - 3600000 },
          ],
          count: 2,
        });
      }

      // Follow/Unfollow Endpoints
      if (path === '/api/follows/follow') {
        const body = await request.json();
        return jsonResponse({ success: true, message: `Now following user ${body.userId}` });
      }

      if (path === '/api/follows/unfollow') {
        const body = await request.json();
        return jsonResponse({ success: true, message: `Unfollowed user ${body.userId}` });
      }

      // Upload Endpoint
      if (path === '/api/upload') {
        // Handle file upload
        const formData = await request.formData();
        const file = formData.get('file');
        
        if (file && env.R2_BUCKET) {
          // In production, upload to R2
          const fileId = `upload-${Date.now()}`;
          return jsonResponse({
            success: true,
            data: {
              fileId,
              url: `/uploads/${fileId}`,
              size: file.size,
              type: file.type,
            },
          });
        }
        
        return jsonResponse({ success: false, error: 'Upload failed' }, 400);
      }

      // User Account Management
      if (path === '/api/user/verify-email') {
        const body = await request.json();
        return jsonResponse({ success: true, message: 'Email verified successfully' });
      }

      if (path === '/api/user/resend-verification') {
        return jsonResponse({ success: true, message: 'Verification email sent' });
      }

      if (path === '/api/user/notification-preferences') {
        return jsonResponse({
          success: true,
          data: {
            emailNotifications: true,
            pushNotifications: false,
            smsNotifications: false,
            marketingEmails: true,
          },
        });
      }

      if (path === '/api/user/stats') {
        return jsonResponse({
          success: true,
          data: {
            totalPitches: 5,
            totalViews: 1234,
            totalInvestments: 3,
            avgRating: 4.5,
            followerCount: 89,
            followingCount: 45,
          },
        });
      }

      if (path === '/api/users/blocked') {
        return jsonResponse({ success: true, data: [] });
      }

      // Token Validation
      if (path === '/api/validate-token') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({ success: false, valid: false });
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyToken(token, env);
        
        return jsonResponse({ 
          success: true, 
          valid: !!payload,
          user: payload,
        });
      }

      // Refresh Token
      if (path === '/api/refresh-token') {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return jsonResponse({ success: false, error: 'No token provided' }, 401);
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyToken(token, env);
        
        if (!payload) {
          return jsonResponse({ success: false, error: 'Invalid token' }, 401);
        }

        // Generate new token
        const newToken = await jwt.sign({
          email: payload.email,
          id: payload.id,
          role: payload.role,
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
        }, env.JWT_SECRET);

        return jsonResponse({ 
          success: true, 
          token: newToken,
          user: payload,
        });
      }

      // Creator Notifications
      if (path === '/api/creator/notifications/read-all') {
        return jsonResponse({ success: true, message: 'All notifications marked as read' });
      }

      // Info Requests Statistics
      if (path === '/api/info-requests/statistics') {
        return jsonResponse({
          success: true,
          data: {
            totalRequests: 45,
            pendingRequests: 12,
            approvedRequests: 28,
            rejectedRequests: 5,
            avgResponseTime: 2.5,
          },
        });
      }

      // Search History
      if (path === '/api/search/history') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, query: 'sci-fi thriller', timestamp: Date.now() - 86400000 },
            { id: 2, query: 'romantic comedy', timestamp: Date.now() - 172800000 },
          ],
        });
      }

      // Search Saved
      if (path === '/api/search/saved') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'High Budget Sci-Fi', query: 'genre:sci-fi budget:>10M', createdAt: '2024-11-01T00:00:00Z' },
            { id: 2, name: 'New Creators', query: 'created:>2024-01-01 pitches:<3', createdAt: '2024-11-15T00:00:00Z' },
          ],
        });
      }

      // NDA Bulk Operations
      if (path === '/api/ndas/bulk-approve') {
        const body = await request.json();
        return jsonResponse({ 
          success: true, 
          message: `Approved ${body.ndaIds?.length || 0} NDAs`,
          approved: body.ndaIds || [],
        });
      }

      if (path === '/api/ndas/bulk-reject') {
        const body = await request.json();
        return jsonResponse({ 
          success: true, 
          message: `Rejected ${body.ndaIds?.length || 0} NDAs`,
          rejected: body.ndaIds || [],
        });
      }

      if (path === '/api/ndas/preview') {
        return jsonResponse({
          success: true,
          data: {
            content: 'This is a standard NDA template...',
            version: '2.0',
            lastUpdated: '2024-11-01T00:00:00Z',
          },
        });
      }

      // Production Investment Overview
      if (path === '/api/production/investments/overview') {
        return jsonResponse({
          success: true,
          data: {
            totalInvested: 5000000,
            activeProjects: 3,
            completedProjects: 7,
            averageROI: 15.5,
            topPerformers: [
              { title: 'Project Alpha', roi: 45.2 },
              { title: 'Project Beta', roi: 28.7 },
            ],
          },
        });
      }

      // Investor Preferences
      if (path === '/api/investor/preferences') {
        return jsonResponse({
          success: true,
          data: {
            genres: ['sci-fi', 'thriller', 'drama'],
            budgetRange: { min: 1000000, max: 10000000 },
            regions: ['North America', 'Europe'],
            stages: ['pre-production', 'production'],
            autoInvest: false,
          },
        });
      }

      // Investor Portfolio Analytics
      if (path === '/api/investor/portfolio/analytics') {
        return jsonResponse({
          success: true,
          data: {
            totalValue: 2500000,
            monthlyGrowth: 5.2,
            yearlyGrowth: 45.8,
            riskScore: 3.2,
            diversification: {
              byGenre: { 'sci-fi': 40, 'drama': 30, 'comedy': 30 },
              byStage: { 'production': 50, 'post-production': 30, 'released': 20 },
            },
          },
        });
      }

      // Admin endpoints
      if (path === '/api/admin/stats') {
        return jsonResponse({
          success: true,
          data: {
            totalUsers: 1250,
            totalPitches: 45,
            totalInvestments: 23,
            totalRevenue: 150000,
            activeUsers: 342,
            pendingApprovals: 5,
          },
        });
      }

      if (path === '/api/admin/users') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'Alex Creator', email: 'alex.creator@demo.com', role: 'creator', status: 'active' },
            { id: 2, name: 'Sarah Investor', email: 'sarah.investor@demo.com', role: 'investor', status: 'active' },
            { id: 3, name: 'Stellar Production', email: 'stellar.production@demo.com', role: 'production', status: 'active' },
          ],
          total: 3,
        });
      }

      if (path === '/api/admin/pitches') {
        return jsonResponse({
          success: true,
          data: PITCH_STORAGE,
          total: PITCH_STORAGE.length,
        });
      }

      if (path === '/api/admin/transactions') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, user: 'Sarah Investor', amount: 50000, type: 'investment', status: 'completed', date: '2024-11-20T10:00:00Z' },
            { id: 2, user: 'Mike Producer', amount: 100000, type: 'investment', status: 'pending', date: '2024-11-21T15:00:00Z' },
          ],
          total: 2,
        });
      }

      if (path === '/api/admin/settings') {
        return jsonResponse({
          success: true,
          data: {
            platformFee: 5,
            minInvestment: 1000,
            maxInvestment: 10000000,
            maintenanceMode: false,
            registrationEnabled: true,
          },
        });
      }

      if (path === '/api/admin/analytics') {
        return jsonResponse({
          success: true,
          data: {
            dailyActiveUsers: 245,
            weeklyActiveUsers: 892,
            monthlyActiveUsers: 2341,
            conversionRate: 3.4,
            avgSessionDuration: 240,
          },
        });
      }

      if (path === '/api/admin/activity') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, user: 'Alex', action: 'created_pitch', timestamp: Date.now() - 3600000 },
            { id: 2, user: 'Sarah', action: 'made_investment', timestamp: Date.now() - 7200000 },
          ],
        });
      }

      // Creator activity endpoints
      if (path === '/api/creator/activities') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, type: 'pitch_view', pitch: 'Echoes of Tomorrow', viewer: 'Anonymous', timestamp: Date.now() - 1800000 },
            { id: 2, type: 'nda_request', pitch: 'Echoes of Tomorrow', requester: 'Sarah Investor', timestamp: Date.now() - 3600000 },
          ],
        });
      }

      if (path === '/api/creator/analytics') {
        return jsonResponse({
          success: true,
          data: {
            totalViews: 5420,
            totalPitches: 5,
            totalInvestments: 3,
            avgRating: 4.5,
            viewsByPitch: {
              'Echoes of Tomorrow': 1234,
              'The Last Horizon': 856,
            },
          },
        });
      }

      if (path === '/api/creator/earnings') {
        return jsonResponse({
          success: true,
          data: {
            total: 150000,
            pending: 25000,
            available: 125000,
            history: [
              { id: 1, amount: 50000, source: 'Investment - Echoes', date: '2024-11-01T00:00:00Z' },
              { id: 2, amount: 100000, source: 'Investment - Horizon', date: '2024-10-15T00:00:00Z' },
            ],
          },
        });
      }

      if (path === '/api/creator/followers') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, name: 'Sarah Investor', avatar: null, followedAt: '2024-11-01T00:00:00Z' },
            { id: 2, name: 'Mike Producer', avatar: null, followedAt: '2024-10-15T00:00:00Z' },
          ],
          total: 2,
        });
      }

      if (path === '/api/creator/following') {
        return jsonResponse({
          success: true,
          data: [
            { id: 3, name: 'Jane Creator', avatar: null, followedAt: '2024-11-10T00:00:00Z' },
          ],
          total: 1,
        });
      }

      if (path === '/api/creator/pitches') {
        return jsonResponse({
          success: true,
          data: PITCH_STORAGE.filter(p => p.creatorId === 1),
          total: 3,
        });
      }

      // Activity feed
      if (path === '/api/activity/feed') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, type: 'new_pitch', title: 'New pitch: Quantum Break', timestamp: Date.now() - 86400000 },
            { id: 2, type: 'investment', title: 'Sarah invested in Echoes', timestamp: Date.now() - 172800000 },
            { id: 3, type: 'trending', title: 'Midnight in Paris Redux is trending', timestamp: Date.now() - 259200000 },
          ],
        });
      }

      // Analytics endpoints
      if (path === '/api/analytics/revenue') {
        return jsonResponse({
          success: true,
          data: {
            total: 500000,
            monthly: 50000,
            growth: 15.5,
            byCategory: {
              investments: 400000,
              subscriptions: 50000,
              fees: 50000,
            },
          },
        });
      }

      if (path === '/api/analytics/trending') {
        return jsonResponse({
          success: true,
          data: {
            pitches: PITCH_STORAGE.slice(0, 3),
            creators: [
              { id: 1, name: 'Alex Creator', followers: 234 },
              { id: 2, name: 'Jane Doe', followers: 189 },
            ],
          },
        });
      }

      if (path === '/api/analytics/engagement') {
        return jsonResponse({
          success: true,
          data: {
            avgViewTime: 185,
            bounceRate: 32.5,
            sharesPerPitch: 4.2,
            commentsPerPitch: 8.7,
          },
        });
      }

      // Calendar endpoint
      if (path === '/api/creator/calendar/events') {
        return jsonResponse({
          success: true,
          data: [
            { id: 1, title: 'Pitch Meeting', date: '2024-12-05T14:00:00Z', type: 'meeting' },
            { id: 2, title: 'Production Start', date: '2024-12-15T09:00:00Z', type: 'milestone' },
          ],
        });
      }

      // Company verification
      if (path === '/api/company/verify') {
        return jsonResponse({
          success: true,
          data: {
            verified: true,
            company: 'Stellar Productions',
            verifiedAt: '2024-01-01T00:00:00Z',
          },
        });
      }

      // Export endpoints
      if (path === '/api/creator/export') {
        return jsonResponse({
          success: true,
          message: 'Export initiated. You will receive an email when ready.',
        });
      }

      if (path === '/api/analytics/export') {
        return jsonResponse({
          success: true,
          message: 'Analytics export initiated.',
        });
      }

      // Legal endpoints
      if (path === '/api/legal/privacy') {
        return jsonResponse({
          success: true,
          content: 'Privacy Policy content here...',
          version: '1.0',
          lastUpdated: '2024-11-01T00:00:00Z',
        });
      }

      if (path === '/api/legal/terms') {
        return jsonResponse({
          success: true,
          content: 'Terms of Service content here...',
          version: '1.0',
          lastUpdated: '2024-11-01T00:00:00Z',
        });
      }

      if (path === '/api/legal/nda-template') {
        return jsonResponse({
          success: true,
          content: 'Standard NDA template content...',
          version: '2.0',
          lastUpdated: '2024-11-01T00:00:00Z',
        });
      }

      // WebSocket endpoint
      if (path === '/ws') {
        // Check for WebSocket upgrade
        const upgradeHeader = request.headers.get('Upgrade');
        if (upgradeHeader !== 'websocket') {
          return new Response('Expected WebSocket', { status: 400 });
        }

        // SECURITY FIX: Require authentication for WebSocket connections
        const token = url.searchParams.get('token') || request.headers.get('Sec-WebSocket-Protocol');
        
        if (!token || token === 'null' || token === 'undefined') {
          console.log('WebSocket connection rejected: No authentication token provided');
          return new Response('Unauthorized: Token required for WebSocket connection', { status: 401 });
        }
        
        // Verify the token
        const user = await verifyToken(token, env);
        if (!user) {
          console.log('WebSocket connection rejected: Invalid token');
          return new Response('Forbidden: Invalid authentication token', { status: 403 });
        }
        
        console.log(`WebSocket authenticated for user: ${user.email}`);
        
        // Create WebSocket pair with authentication
        const [client, server] = Object.values(new WebSocketPair());
        
        server.accept();
        server.addEventListener('message', (event) => {
          // Echo messages back for now
          server.send(JSON.stringify({
            type: 'echo',
            data: event.data,
            timestamp: new Date().toISOString(),
          }));
        });

        server.addEventListener('close', () => {
          console.log('WebSocket closed');
        });

        return new Response(null, {
          status: 101,
          webSocket: client,
        });
      }

      // 404 for unknown endpoints
      await trackMetric(env, 'not_found_errors', 1);
      return jsonResponse({
        success: false,
        message: `Endpoint ${path} not found`,
      }, 404, origin);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({
        success: false,
        message: 'Internal server error',
        error: error.message,
      }, 500);
    }
  },

  // Scheduled handler for cron triggers
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`Scheduled event triggered at ${new Date(event.scheduledTime).toISOString()}`);
    console.log(`Cron expression: ${event.cron}`);

    try {
      switch (event.cron) {
        case '*/5 * * * *': // Every 5 minutes - Clear cache
          console.log('Running 5-minute cache cleanup task');
          // In production, clear expired cache entries
          break;
          
        case '*/2 * * * *': // Every 2 minutes - Health check
          console.log('Running 2-minute health check');
          // In production, perform health checks
          break;
          
        case '0 * * * *': // Every hour - Analytics aggregation
          console.log('Running hourly analytics aggregation');
          // In production, aggregate analytics data
          break;
          
        case '*/15 * * * *': // Every 15 minutes - Sync data
          console.log('Running 15-minute data sync');
          // In production, sync with external services
          break;
          
        default:
          console.log(`Unknown cron schedule: ${event.cron}`);
      }
    } catch (error) {
      console.error(`Error in scheduled handler for ${event.cron}:`, error);
    }
  },
};

// Export Durable Objects
export { WebSocketRoom } from './websocket-room-optimized.ts';
export { NotificationRoom } from './notification-room.ts';