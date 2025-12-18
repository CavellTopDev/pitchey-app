/**
 * User Profile & Management Routes
 * Implements missing user endpoints identified in the analysis
 */

import { createAuthAdapter } from '../auth/auth-adapter';
import { neon } from '@neondatabase/serverless';
import { getCorsHeaders } from '../utils/response';

export interface UserProfileUpdate {
  name?: string;
  bio?: string;
  phone?: string;
  website?: string;
  linkedinUrl?: string;
  companyName?: string;
  profileImage?: string;
  location?: string;
  skills?: string[];
  preferences?: {
    emailNotifications?: boolean;
    smsNotifications?: boolean;
    marketingEmails?: boolean;
  };
}

export interface UserSettings {
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
  timezone?: string;
  currency?: string;
  notificationSettings?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    inApp?: boolean;
  };
  privacySettings?: {
    profileVisibility?: 'public' | 'private' | 'connections';
    showEmail?: boolean;
    showPhone?: boolean;
  };
}

export class UserProfileRoutes {
  private authAdapter: ReturnType<typeof createAuthAdapter>;
  private sql: ReturnType<typeof neon>;

  constructor(env: any) {
    this.authAdapter = createAuthAdapter(env);
    this.sql = neon(env.DATABASE_URL);
  }

  /**
   * GET /api/users/profile - Get current user profile
   */
  async getProfile(request: Request): Promise<Response> {
    try {
      const authResult = await this.authAdapter.requireAuth(request);
      if (!authResult.authorized) return authResult.response!;

      const userId = authResult.user.id;

      const [user] = await this.sql`
        SELECT 
          id, email, name, user_type as "userType",
          company_name as "companyName", bio, phone,
          website, linkedin_url as "linkedinUrl",
          profile_image as "profileImage", location,
          skills, email_verified as "emailVerified",
          two_factor_enabled as "twoFactorEnabled",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM users 
        WHERE id = ${userId}
        LIMIT 1
      `;

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'User not found' }
        }), { 
          status: 404,
          headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
        });
      }

      // Get user stats based on type
      const stats = await this.getUserStats(userId, user.userType);

      return new Response(JSON.stringify({
        success: true,
        data: {
          user,
          stats
        }
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to fetch profile' }
      }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * PUT /api/users/profile - Update user profile
   */
  async updateProfile(request: Request): Promise<Response> {
    try {
      const authResult = await this.authAdapter.requireAuth(request);
      if (!authResult.authorized) return authResult.response!;

      const userId = authResult.user.id;
      const updates: UserProfileUpdate = await request.json();

      // Build dynamic update query
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.bio !== undefined) {
        updateFields.push(`bio = $${paramIndex++}`);
        values.push(updates.bio);
      }
      if (updates.phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        values.push(updates.phone);
      }
      if (updates.website !== undefined) {
        updateFields.push(`website = $${paramIndex++}`);
        values.push(updates.website);
      }
      if (updates.linkedinUrl !== undefined) {
        updateFields.push(`linkedin_url = $${paramIndex++}`);
        values.push(updates.linkedinUrl);
      }
      if (updates.companyName !== undefined) {
        updateFields.push(`company_name = $${paramIndex++}`);
        values.push(updates.companyName);
      }
      if (updates.profileImage !== undefined) {
        updateFields.push(`profile_image = $${paramIndex++}`);
        values.push(updates.profileImage);
      }
      if (updates.location !== undefined) {
        updateFields.push(`location = $${paramIndex++}`);
        values.push(updates.location);
      }
      if (updates.skills !== undefined) {
        updateFields.push(`skills = $${paramIndex++}`);
        values.push(JSON.stringify(updates.skills));
      }

      if (updateFields.length === 0) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'No fields to update' }
        }), { 
          status: 400,
          headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
        });
      }

      updateFields.push(`updated_at = NOW()`);
      values.push(userId);

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING 
          id, email, name, user_type as "userType",
          company_name as "companyName", bio, phone,
          website, linkedin_url as "linkedinUrl",
          profile_image as "profileImage", location,
          skills, created_at as "createdAt",
          updated_at as "updatedAt"
      `;

      const [updatedUser] = await this.sql(updateQuery, values);

      return new Response(JSON.stringify({
        success: true,
        data: { user: updatedUser }
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to update profile' }
      }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * GET /api/users/settings - Get user settings
   */
  async getSettings(request: Request): Promise<Response> {
    try {
      const authResult = await this.authAdapter.requireAuth(request);
      if (!authResult.authorized) return authResult.response!;

      const userId = authResult.user.id;

      const [settings] = await this.sql`
        SELECT 
          theme, language, timezone, currency,
          notification_settings as "notificationSettings",
          privacy_settings as "privacySettings"
        FROM user_settings 
        WHERE user_id = ${userId}
        LIMIT 1
      `;

      // Return default settings if none exist
      const userSettings: UserSettings = settings || {
        theme: 'auto',
        language: 'en',
        timezone: 'UTC',
        currency: 'USD',
        notificationSettings: {
          email: true,
          sms: false,
          push: true,
          inApp: true
        },
        privacySettings: {
          profileVisibility: 'public',
          showEmail: false,
          showPhone: false
        }
      };

      return new Response(JSON.stringify({
        success: true,
        data: { settings: userSettings }
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get settings error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to fetch settings' }
      }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * PUT /api/users/settings - Update user settings
   */
  async updateSettings(request: Request): Promise<Response> {
    try {
      const authResult = await this.authAdapter.requireAuth(request);
      if (!authResult.authorized) return authResult.response!;

      const userId = authResult.user.id;
      const settings: UserSettings = await request.json();

      // Upsert settings
      await this.sql`
        INSERT INTO user_settings (
          user_id, theme, language, timezone, currency,
          notification_settings, privacy_settings, updated_at
        ) VALUES (
          ${userId},
          ${settings.theme || 'auto'},
          ${settings.language || 'en'},
          ${settings.timezone || 'UTC'},
          ${settings.currency || 'USD'},
          ${JSON.stringify(settings.notificationSettings || {})},
          ${JSON.stringify(settings.privacySettings || {})},
          NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          theme = EXCLUDED.theme,
          language = EXCLUDED.language,
          timezone = EXCLUDED.timezone,
          currency = EXCLUDED.currency,
          notification_settings = EXCLUDED.notification_settings,
          privacy_settings = EXCLUDED.privacy_settings,
          updated_at = NOW()
      `;

      return new Response(JSON.stringify({
        success: true,
        data: { settings }
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Update settings error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to update settings' }
      }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * DELETE /api/users/account - Delete user account
   */
  async deleteAccount(request: Request): Promise<Response> {
    try {
      const authResult = await this.authAdapter.requireAuth(request);
      if (!authResult.authorized) return authResult.response!;

      const userId = authResult.user.id;
      const { password } = await request.json();

      // Verify password before deletion
      // TODO: Implement password verification

      // Soft delete user account
      await this.sql`
        UPDATE users 
        SET 
          deleted_at = NOW(),
          email = CONCAT('deleted_', id, '_', email),
          status = 'deleted'
        WHERE id = ${userId}
      `;

      return new Response(JSON.stringify({
        success: true,
        message: 'Account deleted successfully'
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Delete account error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to delete account' }
      }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * GET /api/users/:userId - Get specific user profile (public view)
   */
  async getPublicProfile(request: Request, userId: string): Promise<Response> {
    try {
      const [user] = await this.sql`
        SELECT 
          id, name, user_type as "userType",
          company_name as "companyName", bio,
          website, linkedin_url as "linkedinUrl",
          profile_image as "profileImage", location,
          skills, created_at as "createdAt"
        FROM users 
        WHERE id = ${userId} AND deleted_at IS NULL
        LIMIT 1
      `;

      if (!user) {
        return new Response(JSON.stringify({
          success: false,
          error: { message: 'User not found' }
        }), { 
          status: 404,
          headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
        });
      }

      // Get public stats
      const stats = await this.getUserStats(userId, user.userType, true);

      return new Response(JSON.stringify({
        success: true,
        data: {
          user,
          stats
        }
      }), {
        status: 200,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Get public profile error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to fetch profile' }
      }), { 
        status: 500,
        headers: { ...getCorsHeaders(request.headers.get('Origin')), 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Helper: Get user statistics based on user type
   */
  private async getUserStats(userId: string, userType: string, publicOnly = false): Promise<any> {
    const stats: any = {};

    switch (userType) {
      case 'creator': {
        const [creatorStats] = await this.sql`
          SELECT 
            COUNT(DISTINCT p.id) as "totalPitches",
            COUNT(DISTINCT CASE WHEN p.status = 'published' THEN p.id END) as "publishedPitches",
            COUNT(DISTINCT i.id) as "totalInvestments",
            COALESCE(SUM(i.amount), 0) as "totalRaised",
            COUNT(DISTINCT v.id) as "totalViews",
            COUNT(DISTINCT f.follower_id) as "followers"
          FROM users u
          LEFT JOIN pitches p ON p.creator_id = ${userId}
          LEFT JOIN investments i ON i.pitch_id = p.id
          LEFT JOIN views v ON v.pitch_id = p.id
          LEFT JOIN follows f ON f.following_id = ${userId}
          WHERE u.id = ${userId}
        `;
        stats.creator = creatorStats;
        break;
      }

      case 'investor':
        if (!publicOnly) {
          const [investorStats] = await this.sql`
            SELECT 
              COUNT(DISTINCT i.id) as "totalInvestments",
              COALESCE(SUM(i.amount), 0) as "totalInvested",
              COUNT(DISTINCT i.pitch_id) as "pitchesInvested",
              COUNT(DISTINCT sp.pitch_id) as "savedPitches",
              COUNT(DISTINCT n.id) as "ndasSigned"
            FROM users u
            LEFT JOIN investments i ON i.investor_id = ${userId}
            LEFT JOIN saved_pitches sp ON sp.user_id = ${userId}
            LEFT JOIN ndas n ON n.investor_id = ${userId} AND n.status = 'signed'
            WHERE u.id = ${userId}
          `;
          stats.investor = investorStats;
        }
        break;

      case 'production': {
        const [productionStats] = await this.sql`
          SELECT 
            COUNT(DISTINCT p.id) as "totalProductions",
            COUNT(DISTINCT p.id) as "activeProjects",
            COUNT(DISTINCT i.id) as "totalInvestments",
            COALESCE(SUM(i.amount), 0) as "totalBudget"
          FROM users u
          LEFT JOIN pitches p ON p.production_company_id = ${userId}
          LEFT JOIN investments i ON i.pitch_id = p.id
          WHERE u.id = ${userId}
        `;
        stats.production = productionStats;
        break;
      }
    }

    return stats;
  }

  /**
   * Register all user profile routes
   */
  registerRoutes(router: any): void {
    router.get('/api/users/profile', (req: Request) => this.getProfile(req));
    router.put('/api/users/profile', (req: Request) => this.updateProfile(req));
    router.get('/api/users/settings', (req: Request) => this.getSettings(req));
    router.put('/api/users/settings', (req: Request) => this.updateSettings(req));
    router.delete('/api/users/account', (req: Request) => this.deleteAccount(req));
    router.get('/api/users/:userId', (req: Request, params: any) => 
      this.getPublicProfile(req, params.userId)
    );
  }
}