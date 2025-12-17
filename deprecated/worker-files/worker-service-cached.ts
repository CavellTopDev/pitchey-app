/**
 * Worker Service with Integrated Cache Layer
 * Extends worker-service-optimized.ts with edge caching capabilities
 */

// Import the original service and extend it
import { createCacheLayer, EdgeCacheLayer, CACHE_TTL } from './worker-cache-layer.ts';

// Helper to wrap database queries with caching
export async function withCachedDatabase<T>(
  cache: EdgeCacheLayer | null,
  cacheKey: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!cache) {
    // No cache available, fall back to direct fetch
    return await fetcher();
  }
  
  return await cache.get(cacheKey, fetcher, { ttl });
}

// Export cached endpoint handlers
export const cachedEndpoints = {
  /**
   * Get trending pitches with caching
   */
  async getTrendingPitches(env: any, cache: EdgeCacheLayer | null, limit: number = 10, sentry?: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
      const fetcher = async () => {
        const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
        dbPool.initialize(env, sentry);
        
        const results = await withDatabase(env, async (sql) => await sql`
          SELECT 
            p.id, p.title, p.logline, p.genre, p.format, 
            p.poster_url as "posterUrl", p.view_count as "viewCount",
            p.like_count as "likeCount", p.status, p.visibility,
            p.created_at as "createdAt", p.updated_at as "updatedAt",
            u.username as creator_username, u.first_name, u.last_name,
            u.profile_image_url as creator_profile_image
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.status = 'published' AND p.visibility = 'public'
          ORDER BY 
            (p.view_count * 0.3 + p.like_count * 0.5 + p.comment_count * 0.2) DESC,
            p.created_at DESC
          LIMIT ${limit}
        `, sentry);
        
        return results.map((pitch: any) => ({
          ...pitch,
          creator: pitch.creator_username ? {
            username: pitch.creator_username,
            firstName: pitch.first_name,
            lastName: pitch.last_name,
            profileImage: pitch.creator_profile_image
          } : null
        }));
      };

      const items = cache 
        ? await cache.cacheTrendingPitches(limit, fetcher)
        : await fetcher();

      return new Response(JSON.stringify({
        success: true,
        items: items || [],
        cached: cache ? true : false,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL.TRENDING_PITCHES}`,
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error fetching trending pitches:', error);
      if (sentry) {
        sentry.captureException(error);
      }
      
      return new Response(JSON.stringify({
        success: false,
        items: [],
        error: 'Failed to fetch trending pitches'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },

  /**
   * Get new releases with caching
   */
  async getNewReleases(env: any, cache: EdgeCacheLayer | null, limit: number = 10, sentry?: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
      const fetcher = async () => {
        const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
        dbPool.initialize(env, sentry);
        
        const results = await withDatabase(env, async (sql) => await sql`
          SELECT 
            p.id, p.title, p.logline, p.genre, p.format,
            p.poster_url as "posterUrl", p.view_count as "viewCount",
            p.like_count as "likeCount", p.status, p.visibility,
            p.created_at as "createdAt", p.updated_at as "updatedAt",
            u.username as creator_username, u.first_name, u.last_name,
            u.profile_image_url as creator_profile_image
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.status = 'published' AND p.visibility = 'public'
          ORDER BY p.created_at DESC
          LIMIT ${limit}
        `, sentry);
        
        return results.map((pitch: any) => ({
          ...pitch,
          creator: pitch.creator_username ? {
            username: pitch.creator_username,
            firstName: pitch.first_name,
            lastName: pitch.last_name,
            profileImage: pitch.creator_profile_image
          } : null
        }));
      };

      const items = cache 
        ? await cache.cacheNewReleases(limit, fetcher)
        : await fetcher();

      return new Response(JSON.stringify({
        success: true,
        items: items || [],
        cached: cache ? true : false,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL.NEW_RELEASES}`,
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error fetching new releases:', error);
      if (sentry) {
        sentry.captureException(error);
      }
      
      return new Response(JSON.stringify({
        success: false,
        items: [],
        error: 'Failed to fetch new releases'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },

  /**
   * Get public pitches with caching and pagination
   */
  async getPublicPitches(env: any, cache: EdgeCacheLayer | null, limit: number = 10, offset: number = 0, sentry?: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
      const fetcher = async () => {
        const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
        dbPool.initialize(env, sentry);
        
        const results = await withDatabase(env, async (sql) => await sql`
          SELECT 
            p.id, p.title, p.logline, p.genre, p.format,
            p.poster_url as "posterUrl", p.view_count as "viewCount",
            p.like_count as "likeCount", p.status, p.visibility,
            p.created_at as "createdAt", p.updated_at as "updatedAt",
            u.username as creator_username, u.first_name, u.last_name,
            u.profile_image_url as creator_profile_image
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.status = 'published' AND p.visibility = 'public'
          ORDER BY p.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `, sentry);
        
        return results.map((pitch: any) => ({
          ...pitch,
          creator: pitch.creator_username ? {
            username: pitch.creator_username,
            firstName: pitch.first_name,
            lastName: pitch.last_name,
            profileImage: pitch.creator_profile_image
          } : null
        }));
      };

      const items = cache 
        ? await cache.cachePublicPitches(limit, offset, fetcher)
        : await fetcher();

      return new Response(JSON.stringify({
        success: true,
        items: items || [],
        limit,
        offset,
        cached: cache ? true : false,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL.PUBLIC_PITCHES}`,
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error fetching public pitches:', error);
      if (sentry) {
        sentry.captureException(error);
      }
      
      return new Response(JSON.stringify({
        success: false,
        items: [],
        error: 'Failed to fetch public pitches'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },

  /**
   * Get pitch details with caching
   */
  async getPitchDetails(env: any, cache: EdgeCacheLayer | null, pitchId: string, userId?: number, sentry?: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
      const fetcher = async () => {
        const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
        dbPool.initialize(env, sentry);
        
        // Get pitch details
        const pitchResults = await withDatabase(env, async (sql) => await sql`
          SELECT 
            p.*, 
            u.username as creator_username, u.first_name, u.last_name,
            u.bio as creator_bio, u.profile_image_url as creator_profile_image
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE p.id = ${pitchId} 
            AND p.status IN ('published', 'active') 
            AND (p.visibility = 'public' OR p.user_id = ${userId || 0})
        `, sentry);
        
        if (pitchResults.length === 0) {
          return null;
        }
        
        const pitch = pitchResults[0];
        
        // Get characters
        const characters = await withDatabase(env, async (sql) => await sql`
          SELECT * FROM pitch_characters 
          WHERE pitch_id = ${pitchId}
          ORDER BY display_order ASC
        `, sentry);
        
        // Get media
        const media = await withDatabase(env, async (sql) => await sql`
          SELECT * FROM pitch_media 
          WHERE pitch_id = ${pitchId}
          ORDER BY display_order ASC
        `, sentry);
        
        return {
          ...pitch,
          characters,
          media,
          creator: {
            username: pitch.creator_username,
            firstName: pitch.first_name,
            lastName: pitch.last_name,
            bio: pitch.creator_bio,
            profileImage: pitch.creator_profile_image
          }
        };
      };

      const pitch = cache 
        ? await cache.cachePitchDetails(pitchId, fetcher)
        : await fetcher();

      if (!pitch) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Pitch not found or not accessible'
        }), {
          status: 404,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        pitch,
        cached: cache ? true : false,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': userId 
            ? 'private, no-cache' // Don't cache user-specific views
            : `public, max-age=${CACHE_TTL.PITCH_DETAILS}`,
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error fetching pitch details:', error);
      if (sentry) {
        sentry.captureException(error);
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to fetch pitch details'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },

  /**
   * Search with caching
   */
  async searchPitches(env: any, cache: EdgeCacheLayer | null, query: string, filters: any, sentry?: any): Promise<Response> {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    try {
      const fetcher = async () => {
        const { dbPool, withDatabase } = await import('./worker-database-pool-enhanced.ts');
        dbPool.initialize(env, sentry);
        
        let whereConditions = ['p.status = \'published\'', 'p.visibility = \'public\''];
        
        if (query) {
          whereConditions.push(`(
            p.title ILIKE '%${query}%' OR 
            p.logline ILIKE '%${query}%' OR 
            p.genre ILIKE '%${query}%'
          )`);
        }
        
        if (filters.genre) {
          whereConditions.push(`p.genre = '${filters.genre}'`);
        }
        
        if (filters.format) {
          whereConditions.push(`p.format = '${filters.format}'`);
        }
        
        const whereClause = whereConditions.join(' AND ');
        
        const results = await withDatabase(env, async (sql) => await sql`
          SELECT 
            p.id, p.title, p.logline, p.genre, p.format,
            p.poster_url as "posterUrl", p.view_count as "viewCount",
            p.like_count as "likeCount", p.status, p.visibility,
            p.created_at as "createdAt", p.updated_at as "updatedAt",
            u.username as creator_username, u.first_name, u.last_name,
            u.profile_image_url as creator_profile_image
          FROM pitches p
          LEFT JOIN users u ON p.user_id = u.id
          WHERE ${whereClause}
          ORDER BY p.view_count DESC, p.created_at DESC
          LIMIT 50
        `, sentry);
        
        return results.map((pitch: any) => ({
          ...pitch,
          creator: pitch.creator_username ? {
            username: pitch.creator_username,
            firstName: pitch.first_name,
            lastName: pitch.last_name,
            profileImage: pitch.creator_profile_image
          } : null
        }));
      };

      const results = cache 
        ? await cache.cacheSearchResults(query, filters, fetcher)
        : await fetcher();

      return new Response(JSON.stringify({
        success: true,
        results: results || [],
        query,
        filters,
        cached: cache ? true : false,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL.SEARCH_RESULTS}`,
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error('Error searching pitches:', error);
      if (sentry) {
        sentry.captureException(error);
      }
      
      return new Response(JSON.stringify({
        success: false,
        results: [],
        error: 'Search failed'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
  },

  /**
   * Invalidate cache when pitch is updated
   */
  async invalidatePitchCache(cache: EdgeCacheLayer | null, pitchId: string): Promise<void> {
    if (!cache) return;
    
    try {
      await cache.invalidatePitchCache(pitchId);
      console.log(`Cache invalidated for pitch ${pitchId}`);
    } catch (error) {
      console.error('Failed to invalidate cache:', error);
    }
  },

  /**
   * Get cache statistics
   */
  getCacheStats(cache: EdgeCacheLayer | null): any {
    if (!cache) {
      return { enabled: false, message: 'Cache not available' };
    }
    
    return {
      enabled: true,
      ...cache.getStats()
    };
  }
};