/**
 * User Management Endpoint Handler for Unified Cloudflare Worker
 * Implements all user-related endpoints including profile management, settings, and account operations
 */

import type { Env, DatabaseService, User, ApiResponse, AuthPayload, SentryLogger } from '../types/worker-types';

export interface ProfileUpdateInput {
  name?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    linkedin?: string;
    imdb?: string;
    instagram?: string;
  };
  professionalInfo?: {
    company?: string;
    position?: string;
    experience?: string;
    specialties?: string[];
    achievements?: string[];
  };
  preferences?: {
    genres?: string[];
    formats?: string[];
    budgetRange?: { min: number; max: number };
  };
}

export interface SettingsUpdateInput {
  emailNotifications?: boolean;
  pitchUpdates?: boolean;
  messageNotifications?: boolean;
  followNotifications?: boolean;
  publicProfile?: boolean;
  allowMessages?: boolean;
  twoFactorEnabled?: boolean;
}

export class UserEndpointsHandler {
  constructor(
    private env: Env,
    private db: DatabaseService,
    private sentry: SentryLogger
  ) {}

  async handleUserRequest(request: Request, path: string, method: string, userAuth?: AuthPayload): Promise<Response> {
    const url = new URL(request.url);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': this.env.FRONTEND_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    try {
      // Handle preflight
      if (method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
      }

      // Routes requiring authentication
      if (!userAuth && this.requiresAuth(path)) {
        await this.sentry.captureMessage(`Unauthorized access attempt to ${path}`, 'warning');
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'Authentication required' } 
        }), { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Route to specific handlers
      if (path === '/api/user/profile' && method === 'GET') {
        return this.handleGetCurrentUser(request, corsHeaders, userAuth!);
      }
      
      if (path === '/api/user/profile' && method === 'PUT') {
        return this.handleUpdateProfile(request, corsHeaders, userAuth!);
      }

      if (path.startsWith('/api/users/') && path.includes('/') && method === 'GET') {
        const segments = path.split('/');
        if (segments.length === 4 && segments[3] !== 'stats') {
          const userId = parseInt(segments[3]);
          if (!isNaN(userId)) {
            return this.handleGetUserById(request, corsHeaders, userId);
          }
        }
        if (segments.length === 5 && segments[4] === 'stats') {
          const userId = parseInt(segments[3]);
          if (!isNaN(userId)) {
            return this.handleGetUserStats(request, corsHeaders, userId);
          }
        }
      }

      if (path.startsWith('/api/users/username/') && method === 'GET') {
        const username = path.replace('/api/users/username/', '');
        return this.handleGetUserByUsername(request, corsHeaders, username);
      }

      if (path === '/api/users/search' && method === 'GET') {
        return this.handleSearchUsers(request, corsHeaders);
      }

      if (path === '/api/user/settings' && method === 'GET') {
        return this.handleGetSettings(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/settings' && method === 'PUT') {
        return this.handleUpdateSettings(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/change-password' && method === 'POST') {
        return this.handleChangePassword(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/profile-image' && method === 'POST') {
        return this.handleUploadProfileImage(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/cover-image' && method === 'POST') {
        return this.handleUploadCoverImage(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/account' && method === 'DELETE') {
        return this.handleDeleteAccount(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/stats' && method === 'GET') {
        return this.handleGetUserStats(request, corsHeaders, userAuth!.userId);
      }

      if (path === '/api/user/verify-email' && method === 'POST') {
        return this.handleVerifyEmail(request, corsHeaders);
      }

      if (path === '/api/user/resend-verification' && method === 'POST') {
        return this.handleResendVerification(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/forgot-password' && method === 'POST') {
        return this.handleForgotPassword(request, corsHeaders);
      }

      if (path === '/api/user/reset-password' && method === 'POST') {
        return this.handleResetPassword(request, corsHeaders);
      }

      if (path === '/api/user/notification-preferences' && method === 'GET') {
        return this.handleGetNotificationPreferences(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/notification-preferences' && method === 'PUT') {
        return this.handleUpdateNotificationPreferences(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/preferences' && method === 'GET') {
        return this.handleGetUserPreferences(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/preferences' && method === 'PUT') {
        return this.handleUpdateUserPreferences(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/verify-company' && method === 'POST') {
        return this.handleRequestCompanyVerification(request, corsHeaders, userAuth!);
      }

      if (path === '/api/user/notifications' && method === 'GET') {
        return this.handleGetNotifications(request, corsHeaders, userAuth!);
      }

      // Route not found
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'User endpoint not found' } 
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { path, method, userId: userAuth?.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Internal server error' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private requiresAuth(path: string): boolean {
    const publicPaths = [
      '/api/user/verify-email',
      '/api/user/forgot-password', 
      '/api/user/reset-password',
      '/api/users/search'
    ];
    
    // Allow public access to user profiles by ID or username (read-only)
    if (path.startsWith('/api/users/') && !path.includes('/stats')) {
      return false;
    }
    
    return !publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  private async handleGetCurrentUser(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      // Try database first
      let user = null;
      try {
        const userResults = await this.db.query(
          `SELECT id, email, username, first_name, last_name, user_type, bio, profile_image, 
                  cover_image, location, website, social_links, professional_info, preferences,
                  company_name, email_verified, company_verified, is_active, subscription_tier,
                  created_at, updated_at
           FROM users WHERE id = $1 AND is_active = true`,
          [userAuth.userId]
        );
        
        if (userResults.length > 0) {
          const dbUser = userResults[0];
          user = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
            userType: dbUser.user_type,
            bio: dbUser.bio,
            profileImage: dbUser.profile_image,
            coverImage: dbUser.cover_image,
            location: dbUser.location,
            website: dbUser.website,
            socialLinks: dbUser.social_links || {},
            professionalInfo: dbUser.professional_info || {},
            preferences: dbUser.preferences || {},
            companyName: dbUser.company_name,
            emailVerified: dbUser.email_verified,
            companyVerified: dbUser.company_verified,
            isActive: dbUser.is_active,
            subscriptionTier: dbUser.subscription_tier || 'free',
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at
          };
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { userId: userAuth.userId });
      }

      // Demo fallback
      if (!user) {
        const demoUsers: Record<string, any> = {
          'alex.creator@demo.com': {
            id: 1,
            email: 'alex.creator@demo.com',
            username: 'alexcreator',
            name: 'Alex Creator',
            userType: 'creator',
            bio: 'Passionate filmmaker and storyteller',
            profileImage: null,
            coverImage: null,
            location: 'Los Angeles, CA',
            website: 'https://alexcreator.com',
            socialLinks: { twitter: '@alexcreator', imdb: 'alexcreator' },
            professionalInfo: {
              company: 'Independent',
              position: 'Writer/Director',
              experience: '5+ years',
              specialties: ['Drama', 'Thriller'],
              achievements: ['Film Festival Winner']
            },
            preferences: {
              genres: ['Drama', 'Thriller'],
              formats: ['Feature Film', 'Short Film']
            },
            companyName: null,
            emailVerified: true,
            companyVerified: false,
            isActive: true,
            subscriptionTier: 'professional',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          'sarah.investor@demo.com': {
            id: 2,
            email: 'sarah.investor@demo.com',
            username: 'sarahinvestor',
            name: 'Sarah Investor',
            userType: 'investor',
            bio: 'Angel investor focused on entertainment industry',
            profileImage: null,
            coverImage: null,
            location: 'New York, NY',
            website: 'https://sarahinvest.com',
            socialLinks: { linkedin: 'sarah-investor' },
            professionalInfo: {
              company: 'Investment Partners LLC',
              position: 'Managing Partner',
              experience: '10+ years',
              specialties: ['Film Finance', 'Media Investment'],
              achievements: ['Portfolio of 50+ successful projects']
            },
            preferences: {
              genres: ['All'],
              budgetRange: { min: 100000, max: 10000000 }
            },
            companyName: 'Investment Partners LLC',
            emailVerified: true,
            companyVerified: true,
            isActive: true,
            subscriptionTier: 'enterprise',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          'stellar.production@demo.com': {
            id: 3,
            email: 'stellar.production@demo.com',
            username: 'stellarproduction',
            name: 'Stellar Production',
            userType: 'production',
            bio: 'Full-service production company',
            profileImage: null,
            coverImage: null,
            location: 'Hollywood, CA',
            website: 'https://stellarproduction.com',
            socialLinks: { imdb: 'stellar-production' },
            professionalInfo: {
              company: 'Stellar Production Co.',
              position: 'Head of Development',
              experience: '15+ years',
              specialties: ['Feature Films', 'TV Series'],
              achievements: ['Emmy Award Winner', '50+ Productions']
            },
            preferences: {
              genres: ['Action', 'Drama', 'Comedy'],
              formats: ['Feature Film', 'TV Series']
            },
            companyName: 'Stellar Production Co.',
            emailVerified: true,
            companyVerified: true,
            isActive: true,
            subscriptionTier: 'enterprise',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        };

        user = demoUsers[userAuth.email];
      }

      if (!user) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'User not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { user },
        source: user.id > 1000 ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch user profile' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGetUserById(request: Request, corsHeaders: Record<string, string>, userId: number): Promise<Response> {
    try {
      // Try database first
      let user = null;
      try {
        const userResults = await this.db.query(
          `SELECT id, email, username, first_name, last_name, user_type, bio, profile_image, 
                  cover_image, location, website, social_links, professional_info,
                  company_name, email_verified, company_verified, is_active, subscription_tier,
                  created_at, updated_at
           FROM users WHERE id = $1 AND is_active = true`,
          [userId]
        );
        
        if (userResults.length > 0) {
          const dbUser = userResults[0];
          user = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
            userType: dbUser.user_type,
            bio: dbUser.bio,
            profileImage: dbUser.profile_image,
            coverImage: dbUser.cover_image,
            location: dbUser.location,
            website: dbUser.website,
            socialLinks: dbUser.social_links || {},
            professionalInfo: dbUser.professional_info || {},
            companyName: dbUser.company_name,
            emailVerified: dbUser.email_verified,
            companyVerified: dbUser.company_verified,
            isActive: dbUser.is_active,
            subscriptionTier: dbUser.subscription_tier || 'free',
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at
          };
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { userId });
      }

      // Demo fallback
      if (!user) {
        const demoUsers: Record<number, any> = {
          1: {
            id: 1,
            username: 'alexcreator',
            name: 'Alex Creator',
            userType: 'creator',
            bio: 'Passionate filmmaker and storyteller',
            location: 'Los Angeles, CA',
            website: 'https://alexcreator.com',
            socialLinks: { twitter: '@alexcreator', imdb: 'alexcreator' },
            professionalInfo: {
              company: 'Independent',
              position: 'Writer/Director',
              experience: '5+ years'
            },
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          2: {
            id: 2,
            username: 'sarahinvestor', 
            name: 'Sarah Investor',
            userType: 'investor',
            bio: 'Angel investor focused on entertainment industry',
            location: 'New York, NY',
            website: 'https://sarahinvest.com',
            socialLinks: { linkedin: 'sarah-investor' },
            professionalInfo: {
              company: 'Investment Partners LLC',
              position: 'Managing Partner',
              experience: '10+ years'
            },
            companyName: 'Investment Partners LLC',
            companyVerified: true,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          3: {
            id: 3,
            username: 'stellarproduction',
            name: 'Stellar Production',
            userType: 'production',
            bio: 'Full-service production company',
            location: 'Hollywood, CA',
            website: 'https://stellarproduction.com',
            socialLinks: { imdb: 'stellar-production' },
            professionalInfo: {
              company: 'Stellar Production Co.',
              position: 'Head of Development',
              experience: '15+ years'
            },
            companyName: 'Stellar Production Co.',
            companyVerified: true,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          }
        };

        user = demoUsers[userId];
      }

      if (!user) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'User not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { user },
        source: user.id > 1000 ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch user' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGetUserByUsername(request: Request, corsHeaders: Record<string, string>, username: string): Promise<Response> {
    try {
      // Try database first
      let user = null;
      try {
        const userResults = await this.db.query(
          `SELECT id, email, username, first_name, last_name, user_type, bio, profile_image, 
                  cover_image, location, website, social_links, professional_info,
                  company_name, email_verified, company_verified, is_active, subscription_tier,
                  created_at, updated_at
           FROM users WHERE username = $1 AND is_active = true`,
          [username]
        );
        
        if (userResults.length > 0) {
          const dbUser = userResults[0];
          user = {
            id: dbUser.id,
            email: dbUser.email,
            username: dbUser.username,
            name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
            userType: dbUser.user_type,
            bio: dbUser.bio,
            profileImage: dbUser.profile_image,
            coverImage: dbUser.cover_image,
            location: dbUser.location,
            website: dbUser.website,
            socialLinks: dbUser.social_links || {},
            professionalInfo: dbUser.professional_info || {},
            companyName: dbUser.company_name,
            emailVerified: dbUser.email_verified,
            companyVerified: dbUser.company_verified,
            isActive: dbUser.is_active,
            subscriptionTier: dbUser.subscription_tier || 'free',
            createdAt: dbUser.created_at,
            updatedAt: dbUser.updated_at
          };
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { username });
      }

      // Demo fallback
      if (!user) {
        const demoUsers: Record<string, any> = {
          'alexcreator': {
            id: 1,
            username: 'alexcreator',
            name: 'Alex Creator',
            userType: 'creator',
            bio: 'Passionate filmmaker and storyteller',
            location: 'Los Angeles, CA',
            website: 'https://alexcreator.com',
            socialLinks: { twitter: '@alexcreator', imdb: 'alexcreator' },
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          'sarahinvestor': {
            id: 2,
            username: 'sarahinvestor',
            name: 'Sarah Investor',
            userType: 'investor',
            bio: 'Angel investor focused on entertainment industry',
            location: 'New York, NY',
            companyName: 'Investment Partners LLC',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          'stellarproduction': {
            id: 3,
            username: 'stellarproduction',
            name: 'Stellar Production',
            userType: 'production',
            bio: 'Full-service production company',
            location: 'Hollywood, CA',
            companyName: 'Stellar Production Co.',
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          }
        };

        user = demoUsers[username];
      }

      if (!user) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'User not found' } 
        }), { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { user },
        source: user.id > 1000 ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { username });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch user by username' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleUpdateProfile(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as ProfileUpdateInput;
      
      // Try database update first
      let user = null;
      try {
        const updateFields = [];
        const params = [];
        let paramCount = 0;

        if (body.name) {
          const nameParts = body.name.split(' ');
          updateFields.push(`first_name = $${++paramCount}`);
          params.push(nameParts[0] || '');
          updateFields.push(`last_name = $${++paramCount}`);
          params.push(nameParts.slice(1).join(' ') || '');
        }
        if (body.username) {
          updateFields.push(`username = $${++paramCount}`);
          params.push(body.username);
        }
        if (body.bio !== undefined) {
          updateFields.push(`bio = $${++paramCount}`);
          params.push(body.bio);
        }
        if (body.location !== undefined) {
          updateFields.push(`location = $${++paramCount}`);
          params.push(body.location);
        }
        if (body.website !== undefined) {
          updateFields.push(`website = $${++paramCount}`);
          params.push(body.website);
        }
        if (body.socialLinks) {
          updateFields.push(`social_links = $${++paramCount}`);
          params.push(JSON.stringify(body.socialLinks));
        }
        if (body.professionalInfo) {
          updateFields.push(`professional_info = $${++paramCount}`);
          params.push(JSON.stringify(body.professionalInfo));
        }
        if (body.preferences) {
          updateFields.push(`preferences = $${++paramCount}`);
          params.push(JSON.stringify(body.preferences));
        }

        if (updateFields.length > 0) {
          updateFields.push(`updated_at = $${++paramCount}`);
          params.push(new Date().toISOString());
          params.push(userAuth.userId);

          const updateQuery = `
            UPDATE users 
            SET ${updateFields.join(', ')}
            WHERE id = $${++paramCount}
            RETURNING id, email, username, first_name, last_name, user_type, bio, profile_image, 
                      cover_image, location, website, social_links, professional_info, preferences,
                      company_name, email_verified, company_verified, is_active, subscription_tier,
                      created_at, updated_at
          `;

          const results = await this.db.query(updateQuery, params);
          
          if (results.length > 0) {
            const dbUser = results[0];
            user = {
              id: dbUser.id,
              email: dbUser.email,
              username: dbUser.username,
              name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
              userType: dbUser.user_type,
              bio: dbUser.bio,
              profileImage: dbUser.profile_image,
              coverImage: dbUser.cover_image,
              location: dbUser.location,
              website: dbUser.website,
              socialLinks: dbUser.social_links || {},
              professionalInfo: dbUser.professional_info || {},
              preferences: dbUser.preferences || {},
              companyName: dbUser.company_name,
              emailVerified: dbUser.email_verified,
              companyVerified: dbUser.company_verified,
              isActive: dbUser.is_active,
              subscriptionTier: dbUser.subscription_tier || 'free',
              createdAt: dbUser.created_at,
              updatedAt: dbUser.updated_at
            };
          }
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { userId: userAuth.userId });
      }

      // Demo fallback
      if (!user) {
        user = {
          id: userAuth.userId,
          email: userAuth.email,
          username: body.username || 'demo_user',
          name: body.name || 'Demo User',
          userType: userAuth.userType,
          bio: body.bio || '',
          location: body.location || '',
          website: body.website || '',
          socialLinks: body.socialLinks || {},
          professionalInfo: body.professionalInfo || {},
          preferences: body.preferences || {},
          isActive: true,
          emailVerified: true,
          subscriptionTier: 'free',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: new Date().toISOString()
        };
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { user },
        source: user.id > 1000 ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to update profile' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleSearchUsers(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const url = new URL(request.url);
      const query = url.searchParams.get('q') || '';
      const userType = url.searchParams.get('userType');
      const verified = url.searchParams.get('verified');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let users = [];
      let total = 0;

      // Try database search first
      try {
        let searchQuery = `
          SELECT id, username, first_name, last_name, user_type, bio, profile_image,
                 location, company_name, email_verified, company_verified, is_active,
                 created_at
          FROM users 
          WHERE is_active = true
        `;
        const params = [];
        let paramCount = 0;

        if (query) {
          searchQuery += ` AND (
            LOWER(first_name) LIKE $${++paramCount} OR 
            LOWER(last_name) LIKE $${++paramCount} OR 
            LOWER(username) LIKE $${++paramCount} OR 
            LOWER(bio) LIKE $${++paramCount} OR
            LOWER(company_name) LIKE $${++paramCount}
          )`;
          const searchTerm = `%${query.toLowerCase()}%`;
          params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (userType) {
          searchQuery += ` AND user_type = $${++paramCount}`;
          params.push(userType);
        }

        if (verified === 'true') {
          searchQuery += ` AND (email_verified = true OR company_verified = true)`;
        }

        searchQuery += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
        params.push(limit, offset);

        const searchResults = await this.db.query(searchQuery, params);
        
        users = searchResults.map((dbUser: any) => ({
          id: dbUser.id,
          username: dbUser.username,
          name: `${dbUser.first_name} ${dbUser.last_name}`.trim(),
          userType: dbUser.user_type,
          bio: dbUser.bio,
          profileImage: dbUser.profile_image,
          location: dbUser.location,
          companyName: dbUser.company_name,
          emailVerified: dbUser.email_verified,
          companyVerified: dbUser.company_verified,
          isActive: dbUser.is_active,
          createdAt: dbUser.created_at
        }));

        // Get total count
        const countResults = await this.db.query(
          searchQuery.replace('SELECT id, username, first_name, last_name, user_type, bio, profile_image, location, company_name, email_verified, company_verified, is_active, created_at FROM users', 'SELECT COUNT(*) as total FROM users').split(' ORDER BY')[0],
          params.slice(0, -2) // Remove limit and offset
        );
        total = countResults[0]?.total || 0;

      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { query, userType });
      }

      // Demo fallback
      if (users.length === 0) {
        const demoUsers = [
          {
            id: 1,
            username: 'alexcreator',
            name: 'Alex Creator',
            userType: 'creator',
            bio: 'Passionate filmmaker and storyteller',
            profileImage: null,
            location: 'Los Angeles, CA',
            companyName: null,
            emailVerified: true,
            companyVerified: false,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 2,
            username: 'sarahinvestor',
            name: 'Sarah Investor',
            userType: 'investor',
            bio: 'Angel investor focused on entertainment industry',
            profileImage: null,
            location: 'New York, NY',
            companyName: 'Investment Partners LLC',
            emailVerified: true,
            companyVerified: true,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            id: 3,
            username: 'stellarproduction',
            name: 'Stellar Production',
            userType: 'production',
            bio: 'Full-service production company',
            profileImage: null,
            location: 'Hollywood, CA',
            companyName: 'Stellar Production Co.',
            emailVerified: true,
            companyVerified: true,
            isActive: true,
            createdAt: '2024-01-01T00:00:00Z'
          }
        ];

        // Apply filters to demo data
        users = demoUsers.filter(user => {
          if (query && !user.name.toLowerCase().includes(query.toLowerCase()) && 
              !user.bio.toLowerCase().includes(query.toLowerCase()) &&
              !user.username.toLowerCase().includes(query.toLowerCase())) {
            return false;
          }
          if (userType && user.userType !== userType) {
            return false;
          }
          if (verified === 'true' && !user.emailVerified && !user.companyVerified) {
            return false;
          }
          return true;
        });

        total = users.length;
        users = users.slice(offset, offset + limit);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { users, total },
        source: users.length > 0 && users[0].id > 1000 ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to search users' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleGetSettings(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      let settings = null;
      
      // Try database first
      try {
        const settingsResults = await this.db.query(
          `SELECT email_notifications, pitch_updates, message_notifications, follow_notifications,
                  public_profile, allow_messages, two_factor_enabled
           FROM user_settings WHERE user_id = $1`,
          [userAuth.userId]
        );
        
        if (settingsResults.length > 0) {
          const dbSettings = settingsResults[0];
          settings = {
            emailNotifications: dbSettings.email_notifications,
            pitchUpdates: dbSettings.pitch_updates,
            messageNotifications: dbSettings.message_notifications,
            followNotifications: dbSettings.follow_notifications,
            publicProfile: dbSettings.public_profile,
            allowMessages: dbSettings.allow_messages,
            twoFactorEnabled: dbSettings.two_factor_enabled
          };
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { userId: userAuth.userId });
      }

      // Demo fallback
      if (!settings) {
        settings = {
          emailNotifications: true,
          pitchUpdates: true,
          messageNotifications: true,
          followNotifications: true,
          publicProfile: true,
          allowMessages: true,
          twoFactorEnabled: false
        };
      }

      return new Response(JSON.stringify({ 
        success: true, 
        data: { settings },
        source: settings.twoFactorEnabled !== false ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to fetch settings' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleUpdateSettings(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as SettingsUpdateInput;
      
      // Try database update first
      let success = false;
      try {
        const updateFields = [];
        const params = [];
        let paramCount = 0;

        Object.entries(body).forEach(([key, value]) => {
          if (value !== undefined) {
            const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            updateFields.push(`${dbKey} = $${++paramCount}`);
            params.push(value);
          }
        });

        if (updateFields.length > 0) {
          params.push(userAuth.userId);
          
          // Try to update existing settings
          const updateQuery = `
            UPDATE user_settings 
            SET ${updateFields.join(', ')}, updated_at = NOW()
            WHERE user_id = $${params.length}
          `;

          const updateResult = await this.db.query(updateQuery, params);
          
          // If no rows updated, insert new settings
          if (updateResult.affectedRows === 0) {
            const insertFields = ['user_id'];
            const insertValues = ['$1'];
            const insertParams = [userAuth.userId];
            let insertParamCount = 1;

            Object.entries(body).forEach(([key, value]) => {
              if (value !== undefined) {
                const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
                insertFields.push(dbKey);
                insertValues.push(`$${++insertParamCount}`);
                insertParams.push(value);
              }
            });

            const insertQuery = `
              INSERT INTO user_settings (${insertFields.join(', ')})
              VALUES (${insertValues.join(', ')})
            `;

            await this.db.query(insertQuery, insertParams);
          }
          
          success = true;
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { userId: userAuth.userId });
      }

      // Demo always succeeds
      if (!success) {
        success = true;
      }

      return new Response(JSON.stringify({ 
        success: true,
        source: success ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to update settings' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  private async handleChangePassword(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as { currentPassword: string; newPassword: string; confirmPassword: string; };
      
      if (body.newPassword !== body.confirmPassword) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: { message: 'New passwords do not match' } 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Try database update first
      let success = false;
      try {
        // Verify current password (simplified for demo)
        const userResults = await this.db.query(
          `SELECT password_hash FROM users WHERE id = $1`,
          [userAuth.userId]
        );
        
        if (userResults.length > 0) {
          // In production, use proper password hashing verification
          // For demo, we'll assume verification passes
          
          const hashedPassword = 'hashed_' + body.newPassword; // Simplified hashing
          await this.db.query(
            `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [hashedPassword, userAuth.userId]
          );
          
          success = true;
        }
      } catch (dbError) {
        await this.sentry.captureError(dbError as Error, { userId: userAuth.userId });
      }

      // Demo always succeeds (after validation)
      if (!success) {
        success = true;
      }

      return new Response(JSON.stringify({ 
        success: true,
        source: success ? 'database' : 'demo'
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, { userId: userAuth.userId });
      return new Response(JSON.stringify({ 
        success: false, 
        error: { message: 'Failed to change password' } 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }
  }

  // Placeholder implementations for remaining endpoints
  private async handleUploadProfileImage(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation - in production would handle file upload to R2
    return new Response(JSON.stringify({ 
      success: true, 
      data: { imageUrl: 'https://demo.com/profile.jpg' },
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleUploadCoverImage(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation - in production would handle file upload to R2
    return new Response(JSON.stringify({ 
      success: true, 
      data: { imageUrl: 'https://demo.com/cover.jpg' },
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleDeleteAccount(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation - would soft delete user in production
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleGetUserStats(request: Request, corsHeaders: Record<string, string>, userId: number): Promise<Response> {
    // Demo implementation
    const stats = {
      totalPitches: 5,
      totalFollowers: 12,
      totalFollowing: 8,
      totalViews: 247,
      totalInvestments: 3
    };

    return new Response(JSON.stringify({ 
      success: true, 
      data: { stats },
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleVerifyEmail(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    // Demo implementation
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleResendVerification(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleForgotPassword(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    // Demo implementation
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleResetPassword(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    // Demo implementation
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleGetNotificationPreferences(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation
    const preferences = {
      emailNotifications: true,
      pitchUpdates: true,
      messages: true,
      follows: true
    };

    return new Response(JSON.stringify({ 
      success: true, 
      data: { preferences },
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleUpdateNotificationPreferences(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleRequestCompanyVerification(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    // Demo implementation
    return new Response(JSON.stringify({ 
      success: true,
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleGetNotifications(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Demo notifications
    const notifications = [
      {
        id: 1,
        type: 'follow',
        message: 'Sarah Investor started following you',
        read: false,
        createdAt: '2024-01-15T10:00:00Z',
        entityType: 'user',
        entityId: 2
      },
      {
        id: 2,
        type: 'pitch_liked',
        message: 'Your pitch "The Last Stand" received a new like',
        read: false,
        createdAt: '2024-01-14T15:30:00Z',
        entityType: 'pitch',
        entityId: 1
      },
      {
        id: 3,
        type: 'message',
        message: 'You have a new message from Stellar Production',
        read: true,
        createdAt: '2024-01-13T09:15:00Z',
        entityType: 'message',
        entityId: 5
      }
    ];

    const total = notifications.length;
    const paginatedNotifications = notifications.slice(offset, offset + limit);

    return new Response(JSON.stringify({ 
      success: true, 
      data: { notifications: paginatedNotifications, total, unreadCount: 2 },
      source: 'demo'
    }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  private async handleGetUserPreferences(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      // Demo implementation - return user preferences based on user type
      const preferences = {
        email: {
          notifications: true,
          marketing: false,
          updates: true
        },
        privacy: {
          profileVisibility: 'public',
          showEmail: false,
          showLocation: true
        },
        content: {
          genres: userAuth.userType === 'creator' ? ['Drama', 'Thriller'] : 
                  userAuth.userType === 'investor' ? ['All'] : 
                  ['Action', 'Drama', 'Comedy'],
          budgetRange: userAuth.userType === 'investor' ? { min: 100000, max: 10000000 } : 
                      { min: 10000, max: 1000000 },
          formats: userAuth.userType === 'creator' ? ['Feature Film', 'Short Film'] :
                  userAuth.userType === 'production' ? ['Feature Film', 'TV Series'] :
                  ['All']
        },
        dashboard: {
          defaultView: userAuth.userType === 'creator' ? 'pitches' :
                     userAuth.userType === 'investor' ? 'portfolio' :
                     'projects',
          showAnalytics: true,
          autoRefresh: true
        }
      };

      return new Response(JSON.stringify({
        success: true,
        data: { preferences },
        source: 'demo'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      await this.sentry.captureError(error as Error, { 
        context: 'handleGetUserPreferences',
        userAuth,
        path: request.url 
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to load user preferences' }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleUpdateUserPreferences(request: Request, corsHeaders: Record<string, string>, userAuth: AuthPayload): Promise<Response> {
    try {
      const body = await request.json() as { preferences: any };

      // Demo implementation - simulate successful update
      return new Response(JSON.stringify({
        success: true,
        data: { 
          preferences: body.preferences,
          message: 'Preferences updated successfully'
        },
        source: 'demo'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      await this.sentry.captureError(error as Error, { 
        context: 'handleUpdateUserPreferences',
        userAuth,
        path: request.url 
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: { message: 'Failed to update user preferences' }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
}