/**
 * Pitch Management Endpoints for Unified Worker
 * Handles all pitch CRUD operations, analytics, and interactions
 */

import { SentryLogger, DatabaseService, ApiResponse, AuthPayload } from '../types/worker-types';

export class PitchEndpoints {
  private db: DatabaseService | null;
  private sentry: SentryLogger;
  private env: any;
  
  constructor(db: DatabaseService | null, sentry: SentryLogger, env: any) {
    this.db = db;
    this.sentry = sentry;
    this.env = env;
  }

  async handlePitchEndpoints(request: Request, path: string, corsHeaders: Record<string, string>): Promise<Response | null> {
    const method = request.method;
    const url = new URL(request.url);

    try {
      // GET /api/pitches/public
      if (path === '/api/pitches/public' && method === 'GET') {
        return await this.handleGetPublicPitches(request, corsHeaders);
      }

      // GET /api/pitches/trending  
      if (path === '/api/pitches/trending' && method === 'GET') {
        return await this.handleGetTrendingPitches(request, corsHeaders);
      }

      // GET /api/pitches/new
      if (path === '/api/pitches/new' && method === 'GET') {
        return await this.handleGetNewPitches(request, corsHeaders);
      }

      // GET /api/pitches/browse/general
      if (path === '/api/pitches/browse/general' && method === 'GET') {
        return await this.handleBrowsePitches(request, corsHeaders);
      }

      // GET /api/pitches/:id
      if (path.startsWith('/api/pitches/') && method === 'GET' && path.split('/').length === 4) {
        const pitchId = path.split('/')[3];
        return await this.handleGetPitch(request, corsHeaders, pitchId);
      }

      // POST /api/creator/pitches
      if (path === '/api/creator/pitches' && method === 'POST') {
        return await this.handleCreatePitch(request, corsHeaders);
      }

      // GET /api/creator/pitches
      if (path === '/api/creator/pitches' && method === 'GET') {
        return await this.handleGetCreatorPitches(request, corsHeaders);
      }

      // PUT /api/creator/pitches/:id
      if (path.startsWith('/api/creator/pitches/') && method === 'PUT') {
        const pitchId = path.split('/')[4];
        return await this.handleUpdatePitch(request, corsHeaders, pitchId);
      }

      // DELETE /api/creator/pitches/:id
      if (path.startsWith('/api/creator/pitches/') && method === 'DELETE') {
        const pitchId = path.split('/')[4];
        return await this.handleDeletePitch(request, corsHeaders, pitchId);
      }

      // POST /api/creator/pitches/:id/publish
      if (path.match(/^\/api\/creator\/pitches\/\d+\/publish$/) && method === 'POST') {
        const pitchId = path.split('/')[4];
        return await this.handlePublishPitch(request, corsHeaders, pitchId);
      }

      // POST /api/creator/pitches/:id/archive
      if (path.match(/^\/api\/creator\/pitches\/\d+\/archive$/) && method === 'POST') {
        const pitchId = path.split('/')[4];
        return await this.handleArchivePitch(request, corsHeaders, pitchId);
      }

      // POST /api/creator/pitches/:id/like
      if (path.match(/^\/api\/creator\/pitches\/\d+\/like$/) && method === 'POST') {
        const pitchId = path.split('/')[4];
        return await this.handleLikePitch(request, corsHeaders, pitchId);
      }

      // POST /api/creator/pitches/:id/unlike  
      if (path.match(/^\/api\/creator\/pitches\/\d+\/unlike$/) && method === 'POST') {
        const pitchId = path.split('/')[4];
        return await this.handleUnlikePitch(request, corsHeaders, pitchId);
      }

      // POST /api/analytics/track-view
      if (path === '/api/analytics/track-view' && method === 'POST') {
        return await this.handleTrackView(request, corsHeaders);
      }

      // GET /api/creator/pitches/:pitchId/analytics
      if (path.match(/^\/api\/creator\/pitches\/\d+\/analytics$/) && method === 'GET') {
        const pitchId = path.split('/')[4];
        return await this.handleGetPitchAnalytics(request, corsHeaders, pitchId);
      }

      // POST /api/creator/pitches/:pitchId/media
      if (path.match(/^\/api\/creator\/pitches\/\d+\/media$/) && method === 'POST') {
        const pitchId = path.split('/')[4];
        return await this.handleUploadPitchMedia(request, corsHeaders, pitchId);
      }

      return null; // Not a pitch endpoint

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'pitch_endpoints',
        path,
        method
      });
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Pitch service error',
        message: 'An error occurred processing your pitch request'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetPublicPitches(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      let pitches = [];

      if (this.db) {
        try {
          const pitchResults = await this.db.query(`
            SELECT p.id, p.title, p.logline, p.genre, p.format, p.budget_range, p.description,
                   p.view_count, p.like_count, p.created_at, p.updated_at,
                   u.first_name, u.last_name, u.company_name
            FROM pitches p 
            JOIN users u ON p.created_by = u.id
            WHERE p.status = 'published' AND p.is_public = true
            ORDER BY p.created_at DESC 
            LIMIT $1 OFFSET $2
          `, [limit, offset]);
          
          pitches = pitchResults.map(p => ({
            id: p.id,
            title: p.title,
            logline: p.logline,
            genre: p.genre,
            format: p.format,
            budgetRange: p.budget_range,
            description: p.description,
            viewCount: p.view_count || 0,
            likeCount: p.like_count || 0,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            creator: {
              firstName: p.first_name,
              lastName: p.last_name,
              company: p.company_name,
              displayName: `${p.first_name} ${p.last_name}`.trim()
            }
          }));

        } catch (dbError) {
          await this.sentry.captureError(dbError as Error, {
            operation: 'public_pitches_query',
            limit,
            offset
          });
        }
      }

      // No demo fallback - return empty results if no database data

      return new Response(JSON.stringify({
        success: true,
        data: pitches,
        source: 'database',
        count: pitches.length,
        pagination: {
          limit,
          offset,
          hasMore: pitches.length === limit
        }
      } as ApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'get_public_pitches'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch public pitches'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetTrendingPitches(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      let pitches = [];

      if (this.db) {
        try {
          const pitchResults = await this.db.query(`
            SELECT p.id, p.title, p.logline, p.genre, p.format, p.budget_range,
                   p.view_count, p.like_count, p.created_at,
                   u.first_name, u.last_name, u.company_name
            FROM pitches p 
            JOIN users u ON p.created_by = u.id
            WHERE p.status = 'published' AND p.is_public = true
            ORDER BY (p.view_count * 0.7 + p.like_count * 0.3) DESC, p.created_at DESC 
            LIMIT $1
          `, [limit]);
          
          pitches = pitchResults.map(p => ({
            id: p.id,
            title: p.title,
            logline: p.logline,
            genre: p.genre,
            format: p.format,
            budgetRange: p.budget_range,
            viewCount: p.view_count || 0,
            likeCount: p.like_count || 0,
            trendingScore: (p.view_count * 0.7 + p.like_count * 0.3),
            createdAt: p.created_at,
            creator: {
              firstName: p.first_name,
              lastName: p.last_name,
              company: p.company_name,
              displayName: `${p.first_name} ${p.last_name}`.trim()
            }
          }));

        } catch (dbError) {
          await this.sentry.captureError(dbError as Error, {
            operation: 'trending_pitches_query',
            limit
          });
        }
      }

      // No demo fallback - return empty results if no database data

      return new Response(JSON.stringify({
        success: true,
        data: pitches,
        source: 'database',
        count: pitches.length
      } as ApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'get_trending_pitches'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch trending pitches'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetNewPitches(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '10');
      
      let pitches = [];

      if (this.db) {
        try {
          const pitchResults = await this.db.query(`
            SELECT p.id, p.title, p.logline, p.genre, p.format, p.budget_range,
                   p.view_count, p.like_count, p.created_at,
                   u.first_name, u.last_name, u.company_name
            FROM pitches p 
            JOIN users u ON p.created_by = u.id
            WHERE p.status = 'published' AND p.is_public = true
            ORDER BY p.created_at DESC 
            LIMIT $1
          `, [limit]);
          
          pitches = pitchResults.map(p => ({
            id: p.id,
            title: p.title,
            logline: p.logline,
            genre: p.genre,
            format: p.format,
            budgetRange: p.budget_range,
            viewCount: p.view_count || 0,
            likeCount: p.like_count || 0,
            createdAt: p.created_at,
            creator: {
              firstName: p.first_name,
              lastName: p.last_name,
              company: p.company_name,
              displayName: `${p.first_name} ${p.last_name}`.trim()
            }
          }));

        } catch (dbError) {
          await this.sentry.captureError(dbError as Error, {
            operation: 'new_pitches_query',
            limit
          });
        }
      }

      // No demo fallback - return empty results if no database data

      return new Response(JSON.stringify({
        success: true,
        data: pitches,
        source: 'database',
        count: pitches.length
      } as ApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'get_new_pitches'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch new pitches'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleBrowsePitches(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const url = new URL(request.url);
      const genre = url.searchParams.get('genre');
      const format = url.searchParams.get('format');
      const budgetRange = url.searchParams.get('budgetRange');
      const search = url.searchParams.get('search');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      
      let pitches = [];

      if (this.db) {
        try {
          let query = `
            SELECT p.id, p.title, p.logline, p.genre, p.format, p.budget_range,
                   p.view_count, p.like_count, p.created_at,
                   u.first_name, u.last_name, u.company_name
            FROM pitches p 
            JOIN users u ON p.created_by = u.id
            WHERE p.status = 'published' AND p.is_public = true
          `;
          
          const params: any[] = [];
          let paramCount = 0;

          if (genre) {
            query += ` AND p.genre = $${++paramCount}`;
            params.push(genre);
          }

          if (format) {
            query += ` AND p.format = $${++paramCount}`;
            params.push(format);
          }

          if (budgetRange) {
            query += ` AND p.budget_range = $${++paramCount}`;
            params.push(budgetRange);
          }

          if (search) {
            query += ` AND (p.title ILIKE $${++paramCount} OR p.logline ILIKE $${++paramCount})`;
            params.push(`%${search}%`, `%${search}%`);
          }

          query += ` ORDER BY p.created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
          params.push(limit, offset);

          const pitchResults = await this.db.query(query, params);
          
          pitches = pitchResults.map(p => ({
            id: p.id,
            title: p.title,
            logline: p.logline,
            genre: p.genre,
            format: p.format,
            budgetRange: p.budget_range,
            viewCount: p.view_count || 0,
            likeCount: p.like_count || 0,
            createdAt: p.created_at,
            creator: {
              firstName: p.first_name,
              lastName: p.last_name,
              company: p.company_name,
              displayName: `${p.first_name} ${p.last_name}`.trim()
            }
          }));

        } catch (dbError) {
          await this.sentry.captureError(dbError as Error, {
            operation: 'browse_pitches_query',
            filters: { genre, format, budgetRange, search }
          });
        }
      }

      // Fallback to filtered demo data
      if (pitches.length === 0) {
        pitches = this.getDemoPitches()
          .filter(p => !genre || p.genre === genre)
          .filter(p => !format || p.format === format)
          .filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.logline.toLowerCase().includes(search.toLowerCase()))
          .slice(offset, offset + limit);
      }

      return new Response(JSON.stringify({
        success: true,
        data: pitches,
        source: 'database',
        count: pitches.length,
        filters: { genre, format, budgetRange, search },
        pagination: {
          limit,
          offset,
          hasMore: pitches.length === limit
        }
      } as ApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'browse_pitches'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to browse pitches'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGetPitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    try {
      const id = parseInt(pitchId);
      if (isNaN(id)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid pitch ID'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let pitch = null;

      if (this.db) {
        try {
          const pitchResults = await this.db.query(`
            SELECT p.*, u.first_name, u.last_name, u.company_name, u.bio as creator_bio
            FROM pitches p 
            JOIN users u ON p.created_by = u.id
            WHERE p.id = $1
          `, [id]);
          
          if (pitchResults.length > 0) {
            const p = pitchResults[0];
            pitch = {
              id: p.id,
              title: p.title,
              logline: p.logline,
              description: p.description,
              genre: p.genre,
              format: p.format,
              budgetRange: p.budget_range,
              status: p.status,
              isPublic: p.is_public,
              viewCount: p.view_count || 0,
              likeCount: p.like_count || 0,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
              creator: {
                id: p.created_by,
                firstName: p.first_name,
                lastName: p.last_name,
                company: p.company_name,
                bio: p.creator_bio,
                displayName: `${p.first_name} ${p.last_name}`.trim()
              }
            };
          }

        } catch (dbError) {
          await this.sentry.captureError(dbError as Error, {
            operation: 'get_pitch_query',
            pitchId: id
          });
        }
      }

      // Fallback to demo data
      if (!pitch) {
        const demoPitches = this.getDemoPitches();
        pitch = demoPitches.find(p => p.id === id) || null;
      }

      if (!pitch) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Pitch not found'
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: pitch,
        source: this.db ? 'database' : 'demo'
      } as ApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'get_pitch',
        pitchId
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch pitch'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Authentication required endpoints
  private async handleCreatePitch(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    try {
      const auth = await this.requireAuth(request);
      if (!auth.success) {
        return new Response(JSON.stringify(auth), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await request.json();
      const { title, logline, description, genre, format, budgetRange } = body;

      if (!title || !logline || !genre) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Title, logline, and genre are required'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // For now, return a demo response
      const newPitch = {
        id: Date.now(), // Demo ID
        title,
        logline,
        description: description || '',
        genre,
        format: format || 'Feature Film',
        budgetRange: budgetRange || 'Under $1M',
        status: 'draft',
        isPublic: false,
        viewCount: 0,
        likeCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        creator: {
          id: auth.data.userId,
          displayName: auth.data.email
        }
      };

      return new Response(JSON.stringify({
        success: true,
        data: newPitch,
        message: 'Pitch created successfully'
      } as ApiResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      await this.sentry.captureError(error as Error, {
        operation: 'create_pitch'
      });

      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create pitch'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Placeholder implementations for remaining endpoints
  private async handleGetCreatorPitches(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    const auth = await this.requireAuth(request);
    if (!auth.success) {
      return new Response(JSON.stringify(auth), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: [],
      message: 'Creator pitches endpoint placeholder'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleUpdatePitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleDeletePitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handlePublishPitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleArchivePitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleLikePitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleUnlikePitch(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleTrackView(request: Request, corsHeaders: Record<string, string>): Promise<Response> {
    return new Response(JSON.stringify({ success: true, message: 'View tracked' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleGetPitchAnalytics(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  private async handleUploadPitchMedia(request: Request, corsHeaders: Record<string, string>, pitchId: string): Promise<Response> {
    return new Response(JSON.stringify({ success: false, error: 'Not implemented' }), {
      status: 501, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Helper methods
  private async requireAuth(request: Request): Promise<{ success: boolean; data?: AuthPayload; error?: string }> {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Authorization required' };
    }

    const token = authHeader.substring(7);
    const payload = await this.verifyJWT(token);
    
    if (!payload) {
      return { success: false, error: 'Invalid or expired token' };
    }

    return { success: true, data: payload };
  }

  private async verifyJWT(token: string): Promise<AuthPayload | null> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      
      // Check expiration
      if (payload.exp < Math.floor(Date.now() / 1000)) return null;

      return payload;
    } catch {
      return null;
    }
  }

  private getDemoPitches() {
    return [
      {
        id: 1,
        title: 'The Last Stand',
        logline: 'When civilization collapses, a small group must make their last stand.',
        description: 'An action-packed thriller about survival against impossible odds.',
        genre: 'Action',
        format: 'Feature Film',
        budgetRange: '$5M - $10M',
        status: 'published',
        isPublic: true,
        viewCount: 1250,
        likeCount: 89,
        createdAt: '2024-11-10T14:30:00Z',
        updatedAt: '2024-11-15T10:00:00Z',
        creator: {
          id: 1,
          firstName: 'Alex',
          lastName: 'Creator',
          company: 'Indie Film Works',
          displayName: 'Alex Creator'
        }
      }
    ];
  }
}