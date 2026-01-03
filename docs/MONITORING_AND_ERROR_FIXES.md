# Production Monitoring and Error Fixes Documentation

## Table of Contents
1. [Health Monitoring Setup](#health-monitoring-setup)
2. [Password Verification Implementation](#password-verification-implementation)
3. [Database Query Optimization](#database-query-optimization)
4. [Email Notifications for Team Invites](#email-notifications-for-team-invites)
5. [Production Error Tracking](#production-error-tracking)

## Health Monitoring Setup

### Current Health Endpoint
The Worker already has a basic health endpoint at `/health`:

```typescript
// src/worker-integrated.ts (lines 5119-5133)
if (url.pathname === '/health') {
  const response = new Response(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'production',
      version: '1.0.0'
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
  return addSecurityHeaders(response);
}
```

### Enhanced Health Monitoring Implementation

Create an enhanced health monitoring system with database and service checks:

```typescript
// src/handlers/health-monitoring.ts
export async function enhancedHealthHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT || 'production',
    version: '1.0.0',
    checks: {
      database: 'unknown',
      cache: 'unknown',
      storage: 'unknown',
      email: 'unknown'
    },
    metrics: {
      responseTime: 0,
      activeConnections: 0,
      memoryUsage: 0
    }
  };

  const startTime = Date.now();

  // Database health check
  try {
    const db = createDatabase(env.DATABASE_URL);
    const result = await db.query('SELECT 1 as health');
    healthStatus.checks.database = result.rows.length > 0 ? 'healthy' : 'unhealthy';
  } catch (error) {
    healthStatus.checks.database = 'unhealthy';
    healthStatus.status = 'degraded';
  }

  // KV Cache health check
  try {
    if (env.KV_CACHE) {
      await env.KV_CACHE.put('health-check', Date.now().toString(), { expirationTtl: 10 });
      const value = await env.KV_CACHE.get('health-check');
      healthStatus.checks.cache = value ? 'healthy' : 'unhealthy';
    }
  } catch (error) {
    healthStatus.checks.cache = 'unhealthy';
  }

  // R2 Storage health check
  try {
    if (env.R2_BUCKET) {
      const testKey = `health-check-${Date.now()}`;
      await env.R2_BUCKET.put(testKey, 'test');
      await env.R2_BUCKET.delete(testKey);
      healthStatus.checks.storage = 'healthy';
    }
  } catch (error) {
    healthStatus.checks.storage = 'unhealthy';
  }

  healthStatus.metrics.responseTime = Date.now() - startTime;

  return new Response(JSON.stringify(healthStatus, null, 2), {
    status: healthStatus.status === 'healthy' ? 200 : 503,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

### Monitoring with Wrangler Tail

```bash
# Monitor all logs
wrangler tail --format pretty

# Monitor errors only
wrangler tail --format pretty --status error

# Monitor specific endpoints
wrangler tail --format pretty --search "/api/auth"

# Monitor with sampling (reduce log volume)
wrangler tail --format pretty --sampling-rate 0.1
```

## Password Verification Implementation

### 1. Add Current Password Verification to Better Auth

```typescript
// src/auth/better-auth-config.ts
import { betterAuth } from "better-auth";
import { passwordResetPlugin } from "better-auth/plugins/password-reset";

export const auth = betterAuth({
  database: createDatabase(env.DATABASE_URL),
  
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    
    // Add password verification requirements
    password: {
      // Custom password hashing (using bcrypt)
      hash: async (password) => {
        const bcrypt = await import('bcryptjs');
        return bcrypt.hash(password, 10);
      },
      
      // Custom password verification
      verify: async ({ hash, password }) => {
        const bcrypt = await import('bcryptjs');
        return bcrypt.compare(password, hash);
      }
    }
  },

  // Add password reset plugin
  plugins: [
    passwordResetPlugin({
      sendResetPassword: async ({ user, url, token }) => {
        // Send password reset email
        await sendPasswordResetEmail(user.email, url, token);
      },
      resetPasswordTokenExpiresIn: 3600, // 1 hour
    })
  ]
});
```

### 2. Implement Change Password Endpoint

```typescript
// src/handlers/auth-password.ts
export async function changePasswordHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json();
    const { currentPassword, newPassword, revokeOtherSessions } = body;
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return ApiResponseBuilder.error(
        ErrorCode.VALIDATION_ERROR,
        'Current and new passwords are required'
      );
    }
    
    // Get current user from session
    const session = await auth.api.getSession({
      headers: request.headers
    });
    
    if (!session?.user) {
      return ApiResponseBuilder.error(
        ErrorCode.UNAUTHORIZED,
        'Not authenticated'
      );
    }
    
    // Verify current password
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [session.user.id]
    );
    
    const isValid = await bcrypt.compare(currentPassword, user.rows[0].password_hash);
    if (!isValid) {
      return ApiResponseBuilder.error(
        ErrorCode.UNAUTHORIZED,
        'Current password is incorrect'
      );
    }
    
    // Update password
    const result = await auth.api.changePassword({
      body: {
        newPassword,
        currentPassword,
        revokeOtherSessions: revokeOtherSessions || false
      },
      headers: request.headers
    });
    
    return ApiResponseBuilder.success({
      message: 'Password changed successfully',
      revokedSessions: revokeOtherSessions ? 'all' : 'none'
    });
    
  } catch (error) {
    console.error('Password change error:', error);
    return ApiResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      'Failed to change password'
    );
  }
}
```

## Database Query Optimization

### 1. Add Missing Indexes

```sql
-- src/db/migrations/add-performance-indexes.sql

-- User authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);

-- Pitch performance indexes
CREATE INDEX IF NOT EXISTS idx_pitches_creator_id ON pitches(creator_id);
CREATE INDEX IF NOT EXISTS idx_pitches_status ON pitches(status);
CREATE INDEX IF NOT EXISTS idx_pitches_created_at ON pitches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pitches_genre ON pitches(genre);
CREATE INDEX IF NOT EXISTS idx_pitches_status_created ON pitches(status, created_at DESC);

-- NDA indexes
CREATE INDEX IF NOT EXISTS idx_ndas_user_id ON ndas(user_id);
CREATE INDEX IF NOT EXISTS idx_ndas_pitch_id ON ndas(pitch_id);
CREATE INDEX IF NOT EXISTS idx_ndas_status ON ndas(status);
CREATE INDEX IF NOT EXISTS idx_ndas_user_pitch ON ndas(user_id, pitch_id);

-- Investment indexes
CREATE INDEX IF NOT EXISTS idx_investments_investor_id ON investments(investor_id);
CREATE INDEX IF NOT EXISTS idx_investments_pitch_id ON investments(pitch_id);
CREATE INDEX IF NOT EXISTS idx_investments_status ON investments(status);

-- Follow relationship indexes
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_unique ON follows(follower_id, following_id);

-- Team and invitation indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_team_id ON invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Analytics and performance indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
```

### 2. Optimize Common Queries

```typescript
// src/db/optimized-queries.ts
export class OptimizedQueries {
  
  // Use prepared statements for frequently executed queries
  static readonly GET_USER_BY_EMAIL = `
    SELECT id, email, username, user_type, created_at 
    FROM users 
    WHERE email = $1 
    LIMIT 1
  `;
  
  // Use CTEs for complex queries
  static readonly GET_DASHBOARD_STATS = `
    WITH pitch_stats AS (
      SELECT 
        COUNT(*) as total_pitches,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_pitches,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_pitches
      FROM pitches
      WHERE creator_id = $1
    ),
    nda_stats AS (
      SELECT 
        COUNT(*) as total_ndas,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_ndas
      FROM ndas
      WHERE user_id = $1
    )
    SELECT 
      p.*,
      n.*,
      (SELECT COUNT(*) FROM follows WHERE following_id = $1) as followers_count,
      (SELECT COUNT(*) FROM follows WHERE follower_id = $1) as following_count
    FROM pitch_stats p, nda_stats n
  `;
  
  // Use batch operations
  static readonly BATCH_UPDATE_NOTIFICATIONS = `
    UPDATE notifications 
    SET read = true, read_at = NOW()
    WHERE user_id = $1 
    AND id = ANY($2::uuid[])
    RETURNING id
  `;
}
```

## Email Notifications for Team Invites

### 1. Implement Email Service

```typescript
// src/services/email-notifications.ts
import { Resend } from 'resend';

export class EmailNotificationService {
  private resend: Resend;
  
  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }
  
  async sendTeamInvite(
    email: string,
    teamName: string,
    inviterName: string,
    inviteLink: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to join ${teamName}</h2>
        <p>${inviterName} has invited you to join their team on Pitchey.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Team:</strong> ${teamName}</p>
          <p><strong>Invited by:</strong> ${inviterName}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="
            background: #4F46E5;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            display: inline-block;
          ">Accept Invitation</a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          This invitation will expire in 7 days. If you don't want to join this team, 
          you can safely ignore this email.
        </p>
      </div>
    `;
    
    await this.resend.emails.send({
      from: 'Pitchey <team@pitchey.com>',
      to: email,
      subject: `Invitation to join ${teamName}`,
      html
    });
  }
  
  async sendInviteAccepted(
    inviterEmail: string,
    memberName: string,
    teamName: string
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Team invitation accepted!</h2>
        <p>${memberName} has accepted your invitation to join ${teamName}.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://pitchey.com/team/members" style="
            background: #4F46E5;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 6px;
            display: inline-block;
          ">View Team Members</a>
        </div>
      </div>
    `;
    
    await this.resend.emails.send({
      from: 'Pitchey <team@pitchey.com>',
      to: inviterEmail,
      subject: `${memberName} joined ${teamName}`,
      html
    });
  }
}
```

### 2. Integrate with Team Invite Handler

```typescript
// src/handlers/teams.ts (enhanced)
export async function inviteToTeamHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json();
    const { teamId, email, role } = body;
    
    // Validate and create invitation
    const invitation = await db.query(
      `INSERT INTO invitations (id, team_id, email, role, status, expires_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'pending', NOW() + INTERVAL '7 days')
       RETURNING *`,
      [teamId, email, role || 'member']
    );
    
    // Get team and inviter details
    const team = await db.query(
      'SELECT name FROM teams WHERE id = $1',
      [teamId]
    );
    
    const inviter = await auth.api.getSession({
      headers: request.headers
    });
    
    // Send email notification
    const emailService = new EmailNotificationService(env.RESEND_API_KEY);
    const inviteLink = `https://pitchey.com/team/invite/${invitation.rows[0].id}`;
    
    await emailService.sendTeamInvite(
      email,
      team.rows[0].name,
      inviter.user.name || inviter.user.email,
      inviteLink
    );
    
    return ApiResponseBuilder.success({
      invitation: invitation.rows[0],
      emailSent: true
    });
    
  } catch (error) {
    console.error('Team invite error:', error);
    return ApiResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      'Failed to send team invitation'
    );
  }
}
```

## Production Error Tracking

### 1. Configure Sentry for Workers

```typescript
// src/utils/sentry-worker.ts
import { Toucan } from 'toucan-js';

export function initSentry(request: Request, env: Env, ctx: ExecutionContext): Toucan {
  const sentry = new Toucan({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT || 'production',
    release: env.RELEASE || '1.0.0',
    context: ctx,
    request,
    
    requestDataOptions: {
      allowedHeaders: ['user-agent', 'cf-ray', 'cf-connecting-ip'],
      allowedSearchParams: /(.*)/,
    },
    
    integrations: [
      new Toucan.Integrations.RequestData(),
    ],
    
    beforeSend: (event) => {
      // Filter out sensitive data
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.headers?.authorization) {
        event.request.headers.authorization = '[REDACTED]';
      }
      return event;
    },
  });
  
  return sentry;
}
```

### 2. Enhanced Error Handler with Tracking

```typescript
// src/utils/error-handler.ts
export async function enhancedErrorHandler(
  error: unknown,
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  sentry: Toucan
): Promise<Response> {
  // Capture error context
  const errorContext = {
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    timestamp: new Date().toISOString(),
    environment: env.ENVIRONMENT,
  };
  
  // Log to Sentry
  if (error instanceof Error) {
    sentry.captureException(error, {
      tags: {
        component: 'worker',
        environment: env.ENVIRONMENT,
      },
      extra: errorContext,
    });
  }
  
  // Log to Worker logs
  console.error('Worker Error:', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    context: errorContext,
  });
  
  // Return appropriate error response
  if (error instanceof ValidationError) {
    return ApiResponseBuilder.error(
      ErrorCode.VALIDATION_ERROR,
      error.message,
      error.details
    );
  }
  
  if (error instanceof AuthenticationError) {
    return ApiResponseBuilder.error(
      ErrorCode.UNAUTHORIZED,
      'Authentication required'
    );
  }
  
  // Generic error response
  return ApiResponseBuilder.error(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    env.ENVIRONMENT === 'development' ? { error: String(error) } : undefined
  );
}
```

### 3. Monitoring Dashboard Integration

```typescript
// src/handlers/monitoring.ts
export async function getErrorMetricsHandler(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    // Get error metrics from database
    const metrics = await db.query(`
      SELECT 
        DATE_TRUNC('hour', created_at) as hour,
        error_type,
        COUNT(*) as error_count,
        COUNT(DISTINCT user_id) as affected_users
      FROM error_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY hour, error_type
      ORDER BY hour DESC
    `);
    
    // Get performance metrics
    const performance = await db.query(`
      SELECT 
        endpoint,
        AVG(response_time) as avg_response_time,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
        COUNT(*) as request_count
      FROM request_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY endpoint
    `);
    
    return ApiResponseBuilder.success({
      errors: metrics.rows,
      performance: performance.rows,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Metrics error:', error);
    return ApiResponseBuilder.error(
      ErrorCode.INTERNAL_ERROR,
      'Failed to retrieve metrics'
    );
  }
}
```

## Deployment Commands

```bash
# Run database migrations
wrangler d1 execute pitchey-db --file=./src/db/migrations/add-performance-indexes.sql

# Deploy Worker with monitoring
wrangler deploy --env production

# Configure secrets
wrangler secret put SENTRY_DSN
wrangler secret put RESEND_API_KEY

# Monitor deployment
wrangler tail --format pretty --status error
```

## Testing Commands

```bash
# Test health endpoint
curl https://pitchey-production.cavelltheleaddev.workers.dev/health

# Test password change
curl -X POST https://pitchey-production.cavelltheleaddev.workers.dev/api/auth/change-password \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "currentPassword": "old_password",
    "newPassword": "new_secure_password",
    "revokeOtherSessions": true
  }'

# Monitor error logs
wrangler tail --format json --status error | jq '.logs[].message'
```

## Next Steps

1. **Implement rate limiting** for password change attempts
2. **Add 2FA support** using Better Auth's two-factor plugin
3. **Set up alerts** for critical errors using Cloudflare's alerting
4. **Create dashboard** for monitoring metrics in the admin panel
5. **Implement log aggregation** using Cloudflare Logpush

## Conclusion

This documentation provides a complete implementation guide for:
- Health monitoring with comprehensive service checks
- Password verification using Better Auth
- Database query optimization with proper indexes
- Email notifications for team invites using Resend
- Production error tracking with Sentry integration

All implementations follow Cloudflare Workers best practices and integrate seamlessly with the existing Better Auth session-based authentication system.