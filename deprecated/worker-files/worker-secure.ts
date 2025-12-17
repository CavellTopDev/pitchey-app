/**
 * Production-Ready Secure Worker Implementation
 * Integrates all security components with zero-trust architecture
 */

import { Router } from 'itty-router';
import { SecurityMiddleware, SecurityContext } from './security/security-middleware';
import { AuthenticationService } from './security/auth-service';
import { EncryptionService } from './security/encryption';
import { SchemaValidators, RequestValidator } from './security/input-validation';
import { AuditLogger } from './security/audit-logger';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon, neonConfig } from '@neondatabase/serverless';
import * as schema from './db/schema';

// Configure Neon for edge environments
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = 'password';
neonConfig.pipelineTLS = true;
neonConfig.coalesceWrites = true;
neonConfig.poolQueryViaFetch = true;

export interface Env {
  // Secrets (managed via wrangler secret)
  JWT_SECRET: string;
  DATABASE_URL: string;
  ENCRYPTION_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  
  // Bindings
  KV: KVNamespace;
  R2_BUCKET: R2Bucket;
  RATE_LIMITER: any;
  HYPERDRIVE: any;
  
  // Configuration
  ENVIRONMENT: 'production' | 'development';
  FRONTEND_URL: string;
  REPORT_URI?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Initialize security middleware
    const security = new SecurityMiddleware({
      environment: env.ENVIRONMENT,
      jwtSecret: env.JWT_SECRET,
      encryptionKey: env.ENCRYPTION_KEY,
      kv: env.KV,
      rateLimiter: env.RATE_LIMITER,
      db: this.getDb(env),
      reportUri: env.REPORT_URI,
      allowedOrigins: [
        env.FRONTEND_URL,
        env.ENVIRONMENT === 'development' ? 'http://localhost:5173' : null
      ].filter(Boolean) as string[]
    });

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return security.handlePreflight(request);
    }

    // Initialize router
    const router = Router();

    // Health check endpoint (public)
    router.get('/api/health', async () => {
      return new Response(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Authentication endpoints
    router.post('/api/auth/:portal/login', async (request) => {
      return security.handle(request, async (context) => {
        const { portal } = request.params as { portal: string };
        
        // Validate input
        const validation = await RequestValidator.validateBody(
          request,
          SchemaValidators.UserRegistration
        );
        
        if (!validation.success) {
          return new Response(JSON.stringify({
            error: 'Validation failed',
            errors: validation.errors
          }), { status: 400 });
        }

        const { email, password } = validation.data;
        
        // Initialize services
        const authService = new AuthenticationService({
          jwtSecret: env.JWT_SECRET,
          mfaIssuer: 'Pitchey',
          environment: env.ENVIRONMENT,
          kv: env.KV,
          db: this.getDb(env)
        });

        const auditLogger = new AuditLogger({
          kv: env.KV,
          environment: env.ENVIRONMENT,
          retention: 90
        });

        try {
          // Check if account is locked
          if (await authService.isAccountLocked(email)) {
            await auditLogger.logAuth('login', context.request, false, {
              reason: 'account_locked'
            });
            
            return new Response(JSON.stringify({
              error: 'Account temporarily locked due to multiple failed attempts'
            }), { status: 429 });
          }

          // Verify credentials
          const db = this.getDb(env);
          const user = await db
            .select()
            .from(schema.users)
            .where(schema.users.email.eq(email))
            .where(schema.users.role.eq(portal))
            .limit(1);

          if (!user.length) {
            await authService.trackFailedLogin(email, context.request.ip);
            await auditLogger.logAuth('login', context.request, false, {
              reason: 'invalid_credentials'
            });
            
            return new Response(JSON.stringify({
              error: 'Invalid credentials'
            }), { status: 401 });
          }

          // Verify password
          const validPassword = await authService.verifyPassword(
            password,
            user[0].password_hash
          );

          if (!validPassword) {
            await authService.trackFailedLogin(email, context.request.ip);
            await auditLogger.logAuth('login', context.request, false, {
              reason: 'invalid_password'
            });
            
            return new Response(JSON.stringify({
              error: 'Invalid credentials'
            }), { status: 401 });
          }

          // Check if MFA is enabled
          const mfaEnabled = await env.KV.get(`mfa:${user[0].id}`);
          if (mfaEnabled) {
            // Return MFA challenge
            return new Response(JSON.stringify({
              mfaRequired: true,
              challengeId: crypto.randomUUID()
            }), { status: 200 });
          }

          // Generate tokens
          const tokens = await authService.generateTokens(
            user[0].id,
            user[0].email,
            user[0].role
          );

          // Clear failed attempts
          await authService.clearFailedAttempts(email);

          // Log successful login
          await auditLogger.logAuth('login', {
            id: user[0].id,
            email: user[0].email,
            role: user[0].role,
            ip: context.request.ip,
            userAgent: context.request.userAgent
          }, true);

          return new Response(JSON.stringify({
            success: true,
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
              id: user[0].id,
              email: user[0].email,
              role: user[0].role,
              firstName: user[0].first_name,
              lastName: user[0].last_name
            }
          }), {
            headers: { 'Content-Type': 'application/json' }
          });

        } catch (error) {
          console.error('[Auth Error]', error);
          
          await auditLogger.logAuth('login', context.request, false, {
            reason: 'system_error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          return new Response(JSON.stringify({
            error: 'Authentication failed'
          }), { status: 500 });
        }
      });
    });

    // MFA verification endpoint
    router.post('/api/auth/mfa/verify', async (request) => {
      return security.handle(request, async (context) => {
        const body = await request.json() as any;
        const { challengeId, code, userId } = body;

        const authService = new AuthenticationService({
          jwtSecret: env.JWT_SECRET,
          mfaIssuer: 'Pitchey',
          environment: env.ENVIRONMENT,
          kv: env.KV,
          db: this.getDb(env)
        });

        const verified = await authService.verifyMFA(userId, code);

        if (!verified) {
          return new Response(JSON.stringify({
            error: 'Invalid MFA code'
          }), { status: 401 });
        }

        // Get user details
        const db = this.getDb(env);
        const user = await db
          .select()
          .from(schema.users)
          .where(schema.users.id.eq(userId))
          .limit(1);

        if (!user.length) {
          return new Response(JSON.stringify({
            error: 'User not found'
          }), { status: 404 });
        }

        // Generate tokens
        const tokens = await authService.generateTokens(
          user[0].id,
          user[0].email,
          user[0].role
        );

        return new Response(JSON.stringify({
          success: true,
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: user[0].id,
            email: user[0].email,
            role: user[0].role
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });

    // Token refresh endpoint
    router.post('/api/auth/refresh', async (request) => {
      return security.handle(request, async (context) => {
        const body = await request.json() as any;
        const { refreshToken } = body;

        if (!refreshToken) {
          return new Response(JSON.stringify({
            error: 'Refresh token required'
          }), { status: 400 });
        }

        const authService = new AuthenticationService({
          jwtSecret: env.JWT_SECRET,
          mfaIssuer: 'Pitchey',
          environment: env.ENVIRONMENT,
          kv: env.KV,
          db: this.getDb(env)
        });

        try {
          const result = await authService.refreshAccessToken(refreshToken);
          
          return new Response(JSON.stringify({
            success: true,
            token: result.accessToken,
            expiresIn: result.expiresIn
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error) {
          return new Response(JSON.stringify({
            error: 'Invalid refresh token'
          }), { status: 401 });
        }
      });
    });

    // Logout endpoint
    router.post('/api/auth/logout', async (request) => {
      return security.handle(request, async (context) => {
        if (!context.user) {
          return new Response(JSON.stringify({
            error: 'Not authenticated'
          }), { status: 401 });
        }

        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.substring(7);

        if (token) {
          const authService = new AuthenticationService({
            jwtSecret: env.JWT_SECRET,
            mfaIssuer: 'Pitchey',
            environment: env.ENVIRONMENT,
            kv: env.KV,
            db: this.getDb(env)
          });

          await authService.revokeToken(token);
        }

        const auditLogger = new AuditLogger({
          kv: env.KV,
          environment: env.ENVIRONMENT,
          retention: 90
        });

        await auditLogger.logAuth('logout', {
          id: context.user.id,
          email: context.user.email,
          role: context.user.role,
          ip: context.request.ip,
          userAgent: context.request.userAgent
        }, true);

        return new Response(JSON.stringify({
          success: true,
          message: 'Logged out successfully'
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });

    // Protected pitch creation endpoint
    router.post('/api/pitches', async (request) => {
      return security.handle(request, async (context) => {
        if (!context.user) {
          return new Response(JSON.stringify({
            error: 'Authentication required'
          }), { status: 401 });
        }

        // Validate input
        const validation = await RequestValidator.validateBody(
          request,
          SchemaValidators.PitchCreation
        );

        if (!validation.success) {
          return new Response(JSON.stringify({
            error: 'Validation failed',
            errors: validation.errors
          }), { status: 400 });
        }

        const db = this.getDb(env);
        const encryptionService = new EncryptionService({
          masterKey: env.ENCRYPTION_KEY,
          saltRounds: 10,
          keyDerivationIterations: 100000
        });

        // Encrypt sensitive fields
        const encryptedData = await encryptionService.encryptFields(
          validation.data,
          ['synopsis', 'budget']
        );

        // Create pitch
        const pitch = await db
          .insert(schema.pitches)
          .values({
            ...encryptedData,
            creator_id: context.user.id,
            created_at: new Date()
          })
          .returning();

        // Audit log
        const auditLogger = new AuditLogger({
          kv: env.KV,
          environment: env.ENVIRONMENT,
          retention: 90
        });

        await auditLogger.logDataAccess(
          'create',
          {
            id: context.user.id,
            email: context.user.email,
            role: context.user.role,
            ip: context.request.ip,
            userAgent: context.request.userAgent
          },
          {
            type: 'pitch',
            id: pitch[0].id,
            name: pitch[0].title
          },
          true
        );

        return new Response(JSON.stringify({
          success: true,
          pitch: pitch[0]
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });

    // File upload endpoint with security
    router.post('/api/upload', async (request) => {
      return security.handle(request, async (context) => {
        if (!context.user) {
          return new Response(JSON.stringify({
            error: 'Authentication required'
          }), { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
          return new Response(JSON.stringify({
            error: 'No file provided'
          }), { status: 400 });
        }

        // Validate file
        const validation = SchemaValidators.FileUpload.safeParse({
          filename: file.name,
          mimeType: file.type,
          size: file.size
        });

        if (!validation.success) {
          return new Response(JSON.stringify({
            error: 'File validation failed',
            errors: validation.error.errors
          }), { status: 400 });
        }

        // Scan file for malware (simplified check)
        const fileBuffer = await file.arrayBuffer();
        const fileContent = new Uint8Array(fileBuffer);
        
        // Check for common malware signatures
        const malwareSignatures = [
          [0x4D, 0x5A], // PE executable
          [0x7F, 0x45, 0x4C, 0x46], // ELF
          [0x3C, 0x3F, 0x70, 0x68, 0x70] // PHP
        ];

        for (const signature of malwareSignatures) {
          if (signature.every((byte, index) => fileContent[index] === byte)) {
            return new Response(JSON.stringify({
              error: 'File type not allowed'
            }), { status: 400 });
          }
        }

        // Encrypt file before storage
        const encryptionService = new EncryptionService({
          masterKey: env.ENCRYPTION_KEY,
          saltRounds: 10,
          keyDerivationIterations: 100000
        });

        const { encryptedFile, encryptedMetadata } = await encryptionService.encryptFile(
          Buffer.from(fileBuffer),
          {
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            uploadedBy: context.user.id,
            uploadedAt: new Date().toISOString()
          }
        );

        // Store in R2
        const fileKey = `${context.user.id}/${crypto.randomUUID()}`;
        await env.R2_BUCKET.put(fileKey, encryptedFile, {
          customMetadata: {
            encryptedMetadata
          }
        });

        // Audit log
        const auditLogger = new AuditLogger({
          kv: env.KV,
          environment: env.ENVIRONMENT,
          retention: 90
        });

        await auditLogger.logDataAccess(
          'create',
          {
            id: context.user.id,
            email: context.user.email,
            role: context.user.role,
            ip: context.request.ip,
            userAgent: context.request.userAgent
          },
          {
            type: 'file',
            id: fileKey,
            name: file.name
          },
          true,
          {
            size: file.size,
            mimeType: file.type
          }
        );

        return new Response(JSON.stringify({
          success: true,
          fileId: fileKey
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      });
    });

    // 404 handler
    router.all('*', () => {
      return new Response(JSON.stringify({
        error: 'Not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    // Handle request through router
    return router.handle(request, env, ctx);
  },

  // Helper method to get database connection
  getDb(env: Env) {
    // Use Hyperdrive for connection pooling in production
    const connectionString = env.HYPERDRIVE 
      ? env.HYPERDRIVE.connectionString
      : env.DATABASE_URL;

    const sql = neon(connectionString);
    return drizzle(sql, { schema });
  }
};