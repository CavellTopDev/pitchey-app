/**
 * Multi-Factor Authentication API Routes
 * Handles MFA setup, verification, and management
 */

import { Hono } from 'https://deno.land/x/hono@v4.3.0/mod.ts';
import { getCookie } from 'https://deno.land/x/hono@v4.3.0/helper.ts';
import { betterAuth } from "../auth/better-auth.ts";
import { neon } from '@neondatabase/serverless';
import {
  setupMFA,
  verifyTOTP,
  verifyBackupCode,
  generateBackupCodes,
  hashBackupCode,
  logMFAEvent,
  createMFAChallenge,
  getRecoveryOptions,
  type MFASetupResponse,
  type MFAStatus,
  type MFAChallenge
} from '../services/mfa.service.ts';

const app = new Hono();

// Middleware to check authentication
async function requireAuth(c: any, next: () => Promise<void>) {
  const sessionToken = getCookie(c, 'better-auth.session_token');
  
  if (!sessionToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const session = await betterAuth.api.getSession({
    headers: c.req.raw.headers
  });

  if (!session?.user) {
    return c.json({ error: 'Invalid session' }, 401);
  }

  c.set('user', session.user);
  c.set('session', session.session);
  await next();
}

/**
 * GET /api/mfa/status
 * Check MFA status for current user
 */
app.get('/status', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sql = neon(c.env.DATABASE_URL);
    
    const result = await sql`
      SELECT 
        um.enabled,
        um.method,
        um.enrolled_at,
        um.last_used_at,
        array_length(um.backup_codes, 1) - um.backup_codes_used as backup_codes_remaining
      FROM user_mfa um
      WHERE um.user_id = ${user.id}
    `;
    
    if (!result.length) {
      return c.json({
        enabled: false
      } as MFAStatus);
    }
    
    const mfa = result[0];
    return c.json({
      enabled: mfa.enabled,
      method: mfa.method,
      backupCodesRemaining: mfa.backup_codes_remaining,
      lastUsed: mfa.last_used_at,
      enrolledAt: mfa.enrolled_at
    } as MFAStatus);
  } catch (error) {
    console.error('MFA status error:', error);
    return c.json({ error: 'Failed to get MFA status' }, 500);
  }
});

/**
 * POST /api/mfa/setup/start
 * Start MFA setup process - generates secret and QR code
 */
app.post('/setup/start', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sql = neon(c.env.DATABASE_URL);
    
    // Check if MFA already enabled
    const existing = await sql`
      SELECT enabled FROM user_mfa WHERE user_id = ${user.id}
    `;
    
    if (existing.length && existing[0].enabled) {
      return c.json({ error: 'MFA already enabled' }, 400);
    }
    
    // Generate MFA setup data
    const setup: MFASetupResponse = await setupMFA(user.id, user.email);
    
    // Store temporary secret (not enabled yet)
    const hashedBackupCodes = await Promise.all(
      setup.backupCodes.map(code => hashBackupCode(code))
    );
    
    await sql`
      INSERT INTO user_mfa (
        user_id, enabled, method, secret, backup_codes
      ) VALUES (
        ${user.id}, false, 'totp', ${setup.secret}, ${hashedBackupCodes}
      )
      ON CONFLICT (user_id) 
      DO UPDATE SET
        secret = ${setup.secret},
        backup_codes = ${hashedBackupCodes},
        updated_at = CURRENT_TIMESTAMP
    `;
    
    // Log setup attempt
    await logMFAEvent({
      userId: user.id,
      event: 'setup_started',
      method: 'totp',
      ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date()
    }, sql);
    
    // Don't send secret to client, only QR code
    return c.json({
      qrCode: setup.qrCode,
      backupCodes: setup.backupCodes
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return c.json({ error: 'Failed to start MFA setup' }, 500);
  }
});

/**
 * POST /api/mfa/setup/verify
 * Verify TOTP code and complete MFA setup
 */
app.post('/setup/verify', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { code } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    
    if (!code || !/^\d{6}$/.test(code)) {
      return c.json({ error: 'Invalid code format' }, 400);
    }
    
    // Get temporary secret
    const result = await sql`
      SELECT secret, enabled 
      FROM user_mfa 
      WHERE user_id = ${user.id}
    `;
    
    if (!result.length) {
      return c.json({ error: 'MFA setup not started' }, 400);
    }
    
    if (result[0].enabled) {
      return c.json({ error: 'MFA already enabled' }, 400);
    }
    
    // Verify the TOTP code
    const verification = await verifyTOTP(code, result[0].secret, user.id);
    
    if (!verification.valid) {
      await logMFAEvent({
        userId: user.id,
        event: 'setup_failed',
        method: 'totp',
        ip: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
        timestamp: new Date(),
        details: { reason: verification.reason }
      }, sql);
      
      return c.json({ 
        error: 'Invalid code', 
        reason: verification.reason 
      }, 400);
    }
    
    // Enable MFA
    await sql`
      UPDATE user_mfa 
      SET 
        enabled = true,
        enrolled_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${user.id}
    `;
    
    // Update user table
    await sql`
      UPDATE users 
      SET 
        mfa_enabled = true,
        mfa_method = 'totp'
      WHERE id = ${user.id}
    `;
    
    // Log successful setup
    await logMFAEvent({
      userId: user.id,
      event: 'enabled',
      method: 'totp',
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date()
    }, sql);
    
    return c.json({ 
      success: true,
      message: 'MFA enabled successfully'
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    return c.json({ error: 'Failed to verify MFA setup' }, 500);
  }
});

/**
 * POST /api/mfa/verify
 * Verify MFA code during login or sensitive operations
 */
app.post('/verify', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { code, challengeId, method = 'totp' } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    
    // Validate input
    if (!code) {
      return c.json({ error: 'Code required' }, 400);
    }
    
    // Get MFA settings
    const mfaResult = await sql`
      SELECT secret, backup_codes, backup_codes_used
      FROM user_mfa
      WHERE user_id = ${user.id} AND enabled = true
    `;
    
    if (!mfaResult.length) {
      return c.json({ error: 'MFA not enabled' }, 400);
    }
    
    const mfa = mfaResult[0];
    let verified = false;
    let backupUsed = false;
    
    if (method === 'totp') {
      // Verify TOTP code
      const verification = await verifyTOTP(code, mfa.secret, user.id);
      verified = verification.valid;
      
      if (!verified) {
        await logMFAEvent({
          userId: user.id,
          event: 'failed',
          method: 'totp',
          ip: c.req.header('CF-Connecting-IP'),
          userAgent: c.req.header('User-Agent'),
          timestamp: new Date(),
          details: { reason: verification.reason }
        }, sql);
        
        return c.json({ 
          error: 'Invalid code',
          reason: verification.reason
        }, 400);
      }
    } else if (method === 'backup') {
      // Verify backup code
      verified = await verifyBackupCode(code, mfa.backup_codes);
      
      if (verified) {
        backupUsed = true;
        // Mark backup code as used
        const hashedCode = await hashBackupCode(code.toUpperCase().replace(/\s/g, ''));
        await sql`
          UPDATE user_mfa
          SET 
            backup_codes_used = backup_codes_used + 1,
            last_used_at = CURRENT_TIMESTAMP
          WHERE user_id = ${user.id}
        `;
      }
    }
    
    if (!verified) {
      return c.json({ error: 'Invalid code' }, 400);
    }
    
    // Update last used timestamp
    await sql`
      UPDATE user_mfa
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE user_id = ${user.id}
    `;
    
    // Mark challenge as completed if provided
    if (challengeId) {
      await sql`
        UPDATE mfa_challenges
        SET completed_at = CURRENT_TIMESTAMP
        WHERE id = ${challengeId} AND user_id = ${user.id}
      `;
    }
    
    // Log successful verification
    await logMFAEvent({
      userId: user.id,
      event: backupUsed ? 'backup_used' : 'verified',
      method: method,
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date()
    }, sql);
    
    // Create session token for MFA-verified request
    const mfaToken = crypto.randomUUID();
    
    // Store in session or cache (you might want to use KV or Redis)
    // For now, we'll return it to the client
    
    return c.json({
      success: true,
      mfaToken,
      backupCodesRemaining: backupUsed ? 
        mfa.backup_codes.length - mfa.backup_codes_used - 1 : 
        mfa.backup_codes.length - mfa.backup_codes_used
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    return c.json({ error: 'Failed to verify MFA' }, 500);
  }
});

/**
 * POST /api/mfa/challenge
 * Create MFA challenge for sensitive operations
 */
app.post('/challenge', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { action } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    
    // Check if MFA is required for this action
    const checkResult = await sql`
      SELECT * FROM check_mfa_required(${user.id}, ${action})
    `;
    
    if (!checkResult[0] || !checkResult[0].check_mfa_required) {
      return c.json({ required: false });
    }
    
    // Create challenge
    const challenge = createMFAChallenge(user.id);
    
    // Store challenge in database
    await sql`
      INSERT INTO mfa_challenges (
        id, user_id, challenge_type, expires_at,
        ip_address, user_agent
      ) VALUES (
        ${challenge.challengeId},
        ${user.id},
        ${challenge.method},
        ${challenge.expiresAt},
        ${c.req.header('CF-Connecting-IP')},
        ${c.req.header('User-Agent')}
      )
    `;
    
    return c.json({
      required: true,
      challenge
    });
  } catch (error) {
    console.error('MFA challenge error:', error);
    return c.json({ error: 'Failed to create MFA challenge' }, 500);
  }
});

/**
 * POST /api/mfa/disable
 * Disable MFA (requires current code)
 */
app.post('/disable', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { code, password } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    
    // Verify password first
    const userResult = await sql`
      SELECT password FROM users WHERE id = ${user.id}
    `;
    
    // You'd need to verify password here with bcrypt
    // For now, we'll just check the code
    
    // Get MFA settings
    const mfaResult = await sql`
      SELECT secret FROM user_mfa
      WHERE user_id = ${user.id} AND enabled = true
    `;
    
    if (!mfaResult.length) {
      return c.json({ error: 'MFA not enabled' }, 400);
    }
    
    // Verify TOTP code
    const verification = await verifyTOTP(code, mfaResult[0].secret, user.id);
    
    if (!verification.valid) {
      return c.json({ error: 'Invalid code' }, 400);
    }
    
    // Disable MFA
    await sql`
      UPDATE user_mfa
      SET enabled = false
      WHERE user_id = ${user.id}
    `;
    
    await sql`
      UPDATE users
      SET mfa_enabled = false, mfa_method = NULL
      WHERE id = ${user.id}
    `;
    
    // Log disable event
    await logMFAEvent({
      userId: user.id,
      event: 'disabled',
      method: 'totp',
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date()
    }, sql);
    
    return c.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    return c.json({ error: 'Failed to disable MFA' }, 500);
  }
});

/**
 * POST /api/mfa/backup-codes/regenerate
 * Generate new backup codes
 */
app.post('/backup-codes/regenerate', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { code } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    
    // Get MFA settings
    const mfaResult = await sql`
      SELECT secret FROM user_mfa
      WHERE user_id = ${user.id} AND enabled = true
    `;
    
    if (!mfaResult.length) {
      return c.json({ error: 'MFA not enabled' }, 400);
    }
    
    // Verify TOTP code
    const verification = await verifyTOTP(code, mfaResult[0].secret, user.id);
    
    if (!verification.valid) {
      return c.json({ error: 'Invalid code' }, 400);
    }
    
    // Generate new backup codes
    const backupCodes = generateBackupCodes(10);
    const hashedCodes = await Promise.all(
      backupCodes.map(code => hashBackupCode(code))
    );
    
    // Update backup codes
    await sql`
      UPDATE user_mfa
      SET 
        backup_codes = ${hashedCodes},
        backup_codes_used = 0,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${user.id}
    `;
    
    // Log regeneration
    await logMFAEvent({
      userId: user.id,
      event: 'backup_codes_regenerated',
      method: 'totp',
      ip: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      timestamp: new Date()
    }, sql);
    
    return c.json({
      success: true,
      backupCodes
    });
  } catch (error) {
    console.error('Backup codes regenerate error:', error);
    return c.json({ error: 'Failed to regenerate backup codes' }, 500);
  }
});

/**
 * GET /api/mfa/recovery-options
 * Get available recovery options
 */
app.get('/recovery-options', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sql = neon(c.env.DATABASE_URL);
    
    // Get user details for recovery options
    const userResult = await sql`
      SELECT 
        email,
        email_verified,
        phone,
        phone_verified,
        (SELECT array_length(backup_codes, 1) - backup_codes_used 
         FROM user_mfa WHERE user_id = ${user.id}) as backup_codes_remaining
      FROM users
      WHERE id = ${user.id}
    `;
    
    if (!userResult.length) {
      return c.json({ error: 'User not found' }, 404);
    }
    
    const userData = userResult[0];
    const options = getRecoveryOptions({
      email: userData.email,
      emailVerified: userData.email_verified,
      phone: userData.phone,
      phoneVerified: userData.phone_verified,
      backupCodesRemaining: userData.backup_codes_remaining || 0
    });
    
    return c.json(options);
  } catch (error) {
    console.error('Recovery options error:', error);
    return c.json({ error: 'Failed to get recovery options' }, 500);
  }
});

/**
 * POST /api/mfa/trusted-device
 * Add a trusted device
 */
app.post('/trusted-device', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { deviceFingerprint, deviceName } = await c.req.json();
    const sql = neon(c.env.DATABASE_URL);
    
    if (!deviceFingerprint) {
      return c.json({ error: 'Device fingerprint required' }, 400);
    }
    
    // Parse user agent for browser/OS info
    const userAgent = c.req.header('User-Agent') || '';
    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/)?.[1] || 'Unknown';
    const os = userAgent.match(/(Windows|Mac|Linux|Android|iOS)/)?.[1] || 'Unknown';
    
    // Add trusted device (expires in 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    await sql`
      INSERT INTO trusted_devices (
        user_id, device_fingerprint, device_name,
        browser, os, expires_at
      ) VALUES (
        ${user.id},
        ${deviceFingerprint},
        ${deviceName || `${browser} on ${os}`},
        ${browser},
        ${os},
        ${expiresAt}
      )
      ON CONFLICT (user_id, device_fingerprint)
      DO UPDATE SET
        last_used_at = CURRENT_TIMESTAMP,
        expires_at = ${expiresAt}
    `;
    
    return c.json({
      success: true,
      expiresAt
    });
  } catch (error) {
    console.error('Trusted device error:', error);
    return c.json({ error: 'Failed to add trusted device' }, 500);
  }
});

/**
 * GET /api/mfa/trusted-devices
 * List trusted devices
 */
app.get('/trusted-devices', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const sql = neon(c.env.DATABASE_URL);
    
    const devices = await sql`
      SELECT 
        id,
        device_name,
        browser,
        os,
        last_used_at,
        expires_at,
        created_at
      FROM trusted_devices
      WHERE user_id = ${user.id}
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_used_at DESC
    `;
    
    return c.json(devices);
  } catch (error) {
    console.error('List trusted devices error:', error);
    return c.json({ error: 'Failed to list trusted devices' }, 500);
  }
});

/**
 * DELETE /api/mfa/trusted-device/:id
 * Remove a trusted device
 */
app.delete('/trusted-device/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const deviceId = c.req.param('id');
    const sql = neon(c.env.DATABASE_URL);
    
    await sql`
      DELETE FROM trusted_devices
      WHERE id = ${deviceId} AND user_id = ${user.id}
    `;
    
    return c.json({
      success: true,
      message: 'Device removed'
    });
  } catch (error) {
    console.error('Remove trusted device error:', error);
    return c.json({ error: 'Failed to remove trusted device' }, 500);
  }
});

export default app;