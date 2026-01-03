/**
 * Cloudflare Worker with Enterprise Security Implementation
 * Integrates all security middleware and monitoring
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { SecurityHeaders } from './security/middleware/security-headers';
import { 
  RequestValidator, 
  ValidationSchemas,
  SQLInjectionPrevention,
  XSSPrevention,
  InputValidationError
} from './security/middleware/input-validation';
import { 
  SecurityMonitor, 
  SecurityEventType, 
  SecuritySeverity,
  IntrusionDetection
} from './security/monitoring/security-monitoring';
import { MFAService } from './security/auth/mfa';
import { EncryptionService, PIIService } from './security/data/encryption';
import { GDPRCompliance, CCPACompliance } from './security/compliance/gdpr-ccpa';

export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  MFA_SECRET: string;
  ENCRYPTION_KEY: string;
  REDIS_URL: string;
  REDIS_TOKEN: string;
  R2_BUCKET: R2Bucket;
  KV_NAMESPACE: KVNamespace;
  RATE_LIMITER: DurableObjectNamespace;
  SECURITY_MONITOR: DurableObjectNamespace;
}

// Initialize security headers middleware
const securityHeaders = new SecurityHeaders({
  csp: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'strict-dynamic'", "https://cdn.jsdelivr.net"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    connectSrc: [
      "'self'",
      "https://*.workers.dev",
      "wss://*.workers.dev",
      "https://*.upstash.io"
    ]
  },
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true
  }
});

// Rate limiting configuration
const RATE_LIMITS = {
  global: { requests: 100, window: 60 }, // 100 req/min
  auth: { requests: 5, window: 300 }, // 5 attempts/5 min
  api: { requests: 50, window: 60 }, // 50 req/min
  upload: { requests: 10, window: 3600 } // 10 uploads/hour
};

// Initialize Hono app
const app = new Hono<{ Bindings: Env }>();

// CORS configuration
app.use('*', cors({
  origin: [
    'https://pitchey-5o8.pages.dev',
    'http://localhost:5173',
    'http://localhost:5174'
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID']
}));

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-ID') || crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
});

// Security monitoring middleware
app.use('*', async (c, next) => {
  const startTime = Date.now();
  const request = c.req;
  
  // Check for intrusion patterns
  const intrusion = IntrusionDetection.scanRequest(
    request.url,
    request.method,
    request.headers,
    await request.text()
  );
  
  if (intrusion.detected) {
    // Log security event
    SecurityMonitor.logEvent({
      type: intrusion.type === 'sqlInjection' 
        ? SecurityEventType.SQL_INJECTION_ATTEMPT
        : SecurityEventType.XSS_ATTEMPT,
      severity: SecuritySeverity.HIGH,
      userId: c.get('userId'),
      ipAddress: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      url: request.url,
      method: request.method,
      message: `${intrusion.type} attempt detected`,
      details: {
        pattern: intrusion.signature,
        blocked: true
      }
    });
    
    return c.json({ error: 'Security violation detected' }, 403);
  }
  
  await next();
  
  // Log request metrics
  const responseTime = Date.now() - startTime;
  c.header('X-Response-Time', `${responseTime}ms`);
});

// Rate limiting middleware
app.use('*', async (c, next) => {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const path = new URL(c.req.url).pathname;
  
  // Determine rate limit based on path
  let limit = RATE_LIMITS.global;
  if (path.startsWith('/api/auth')) {
    limit = RATE_LIMITS.auth;
  } else if (path.startsWith('/api/upload')) {
    limit = RATE_LIMITS.upload;
  } else if (path.startsWith('/api')) {
    limit = RATE_LIMITS.api;
  }
  
  // Check rate limit
  const key = `rate_limit:${ip}:${path}`;
  const count = await c.env.KV_NAMESPACE.get(key);
  const currentCount = count ? parseInt(count) : 0;
  
  if (currentCount >= limit.requests) {
    SecurityMonitor.logEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecuritySeverity.MEDIUM,
      ipAddress: ip,
      userAgent: c.req.header('User-Agent') || 'unknown',
      url: c.req.url,
      method: c.req.method,
      message: 'Rate limit exceeded',
      details: { limit: limit.requests, window: limit.window }
    });
    
    return c.json({ error: 'Too many requests' }, 429);
  }
  
  // Increment counter
  await c.env.KV_NAMESPACE.put(
    key,
    String(currentCount + 1),
    { expirationTtl: limit.window }
  );
  
  await next();
});

// CSRF protection middleware
app.use('/api/*', async (c, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method)) {
    const csrfToken = c.req.header('X-CSRF-Token');
    const sessionToken = c.get('csrfToken');
    
    if (!csrfToken || csrfToken !== sessionToken) {
      SecurityMonitor.logEvent({
        type: SecurityEventType.CSRF_ATTEMPT,
        severity: SecuritySeverity.HIGH,
        ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
        userAgent: c.req.header('User-Agent') || 'unknown',
        url: c.req.url,
        method: c.req.method,
        message: 'CSRF token validation failed'
      });
      
      return c.json({ error: 'Invalid CSRF token' }, 403);
    }
  }
  
  await next();
});

// Authentication endpoints with MFA
app.post('/api/auth/:portal/login', async (c) => {
  const portal = c.req.param('portal');
  const body = await c.req.json();
  
  try {
    // Validate input
    const validated = RequestValidator.validateBody(body, {
      email: ValidationSchemas.email,
      password: ValidationSchemas.password,
      mfaToken: ValidationSchemas.jwt.optional()
    });
    
    // Check for SQL injection
    if (SQLInjectionPrevention.detectSQLInjection(validated.email)) {
      throw new InputValidationError('Invalid input detected');
    }
    
    // Authenticate user
    const user = await authenticateUser(validated.email, validated.password, portal);
    
    if (!user) {
      SecurityMonitor.logEvent({
        type: SecurityEventType.LOGIN_FAILURE,
        severity: SecuritySeverity.MEDIUM,
        ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
        userAgent: c.req.header('User-Agent') || 'unknown',
        url: c.req.url,
        method: c.req.method,
        message: 'Invalid credentials',
        details: { email: validated.email, portal }
      });
      
      return c.json({ error: 'Invalid credentials' }, 401);
    }
    
    // Check if MFA is enabled
    if (user.mfaEnabled) {
      if (!validated.mfaToken) {
        return c.json({ 
          requiresMFA: true,
          userId: user.id
        }, 200);
      }
      
      // Verify MFA token
      const mfaValid = MFAService.verifyToken(
        validated.mfaToken,
        user.mfaSecret,
        user.id
      );
      
      if (!mfaValid) {
        SecurityMonitor.logEvent({
          type: SecurityEventType.MFA_FAILURE,
          severity: SecuritySeverity.HIGH,
          userId: user.id,
          ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
          userAgent: c.req.header('User-Agent') || 'unknown',
          url: c.req.url,
          method: c.req.method,
          message: 'MFA verification failed'
        });
        
        return c.json({ error: 'Invalid MFA token' }, 401);
      }
    }
    
    // Generate JWT token
    const token = await generateJWT(user, c.env.JWT_SECRET);
    
    // Log successful login
    SecurityMonitor.logEvent({
      type: SecurityEventType.LOGIN_SUCCESS,
      severity: SecuritySeverity.INFO,
      userId: user.id,
      ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown',
      url: c.req.url,
      method: c.req.method,
      message: 'User logged in successfully',
      details: { portal, mfaUsed: user.mfaEnabled }
    });
    
    return c.json({ 
      success: true,
      token,
      user: sanitizeUserData(user)
    });
    
  } catch (error) {
    if (error instanceof InputValidationError) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

// MFA setup endpoint
app.post('/api/auth/mfa/setup', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  // Require password confirmation
  const validated = RequestValidator.validateBody(body, {
    password: ValidationSchemas.password
  });
  
  // Verify password
  const passwordValid = await verifyPassword(userId, validated.password);
  if (!passwordValid) {
    return c.json({ error: 'Invalid password' }, 401);
  }
  
  // Generate MFA secret
  const user = await getUser(userId);
  const mfaSetup = await MFAService.generateSecret(userId, user.email);
  
  // Store secret temporarily (user must verify to activate)
  await c.env.KV_NAMESPACE.put(
    `mfa_setup:${userId}`,
    JSON.stringify(mfaSetup),
    { expirationTtl: 600 } // 10 minutes
  );
  
  return c.json({
    qrCode: mfaSetup.qrCode,
    secret: mfaSetup.secret,
    backupCodes: mfaSetup.backupCodes
  });
});

// Privacy/GDPR endpoints
app.post('/api/privacy/request', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  const validated = RequestValidator.validateBody(body, {
    type: z.enum(['access', 'deletion', 'portability', 'rectification', 'restriction']),
    data: z.any().optional()
  });
  
  // Process GDPR request
  const result = await GDPRCompliance.processDataSubjectRequest({
    id: crypto.randomUUID(),
    type: validated.type,
    userId,
    email: c.get('userEmail'),
    requestDate: new Date(),
    status: 'processing',
    data: validated.data
  });
  
  return c.json(result);
});

// CCPA endpoints
app.post('/api/privacy/ccpa/:action', async (c) => {
  const action = c.req.param('action');
  const userId = c.get('userId');
  
  if (!['opt_out', 'delete', 'know'].includes(action)) {
    return c.json({ error: 'Invalid action' }, 400);
  }
  
  const result = await CCPACompliance.processConsumerRequest(
    action as 'opt_out' | 'delete' | 'know',
    userId
  );
  
  return c.json(result);
});

// Security metrics endpoint
app.get('/api/security/metrics', async (c) => {
  // Require admin role
  if (c.get('userRole') !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  const timeRange = {
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  };
  
  const metrics = SecurityMonitor.getMetrics(timeRange);
  
  return c.json(metrics);
});

// Security events endpoint
app.get('/api/security/events', async (c) => {
  // Require admin role
  if (c.get('userRole') !== 'admin') {
    return c.json({ error: 'Unauthorized' }, 403);
  }
  
  const limit = parseInt(c.req.query('limit') || '100');
  const events = SecurityMonitor.getRecentSecurityEvents(limit);
  
  return c.json(events);
});

// CSP violation reporting
app.post('/api/security/csp-report', async (c) => {
  const report = await c.req.json();
  
  SecurityMonitor.logEvent({
    type: SecurityEventType.XSS_ATTEMPT,
    severity: SecuritySeverity.MEDIUM,
    ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
    userAgent: c.req.header('User-Agent') || 'unknown',
    url: report['csp-report']?.['document-uri'] || 'unknown',
    method: 'CSP',
    message: 'Content Security Policy violation',
    details: report['csp-report']
  });
  
  return c.text('', 204);
});

// File upload with validation
app.post('/api/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }
  
  // Validate file
  try {
    const category = formData.get('category') as 'images' | 'documents' | 'videos' | 'audio';
    FileUploadValidation.validateFile(file, category);
  } catch (error) {
    return c.json({ error: error.message }, 400);
  }
  
  // Scan for malware (simplified check)
  const fileBuffer = await file.arrayBuffer();
  const fileHash = await crypto.subtle.digest('SHA-256', fileBuffer);
  const hashHex = Array.from(new Uint8Array(fileHash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Check against known malware hashes (would use real threat intelligence in production)
  const isMalicious = await checkMalwareHash(hashHex);
  if (isMalicious) {
    SecurityMonitor.logEvent({
      type: SecurityEventType.FILE_UPLOAD_VIOLATION,
      severity: SecuritySeverity.CRITICAL,
      userId: c.get('userId'),
      ipAddress: c.req.header('CF-Connecting-IP') || 'unknown',
      userAgent: c.req.header('User-Agent') || 'unknown',
      url: c.req.url,
      method: c.req.method,
      message: 'Malicious file detected',
      details: { filename: file.name, hash: hashHex }
    });
    
    return c.json({ error: 'File rejected by security scan' }, 403);
  }
  
  // Sanitize filename
  const sanitizedFilename = FileUploadValidation.sanitizeFilename(file.name);
  
  // Store file in R2
  const key = `uploads/${c.get('userId')}/${Date.now()}_${sanitizedFilename}`;
  await c.env.R2_BUCKET.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type
    },
    customMetadata: {
      uploadedBy: c.get('userId'),
      uploadedAt: new Date().toISOString(),
      originalName: file.name
    }
  });
  
  return c.json({
    success: true,
    key,
    filename: sanitizedFilename,
    size: file.size,
    type: file.type
  });
});

// Apply security headers to all responses
app.use('*', async (c, next) => {
  await next();
  const response = c.res;
  return securityHeaders.apply(response);
});

// Helper functions
async function authenticateUser(email: string, password: string, portal: string): Promise<any> {
  // Implementation would check database
  return null;
}

async function generateJWT(user: any, secret: string): Promise<string> {
  // Implementation would generate JWT
  return '';
}

async function verifyPassword(userId: string, password: string): Promise<boolean> {
  // Implementation would verify password
  return false;
}

async function getUser(userId: string): Promise<any> {
  // Implementation would fetch user
  return null;
}

function sanitizeUserData(user: any): any {
  // Remove sensitive fields
  const { password, mfaSecret, ...sanitized } = user;
  
  // Mask PII if needed
  if (user.ssn) {
    sanitized.ssn = PIIService.maskPII(user.ssn);
  }
  
  return sanitized;
}

async function checkMalwareHash(hash: string): Promise<boolean> {
  // Would check against threat intelligence database
  return false;
}

// Export for Cloudflare Worker
export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Clean old security events
    SecurityMonitor.clearOldEvents(30);
    
    // Generate security report
    const metrics = SecurityMonitor.getMetrics();
  }
};