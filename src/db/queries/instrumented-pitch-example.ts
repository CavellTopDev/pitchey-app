/**
 * Example: Instrumented Pitch Queries with Analytics Engine Metrics
 * 
 * This shows how to instrument existing database queries with
 * performance tracking using Cloudflare Analytics Engine.
 */

import type { SqlQuery } from './base';
import { WhereBuilder, extractFirst, extractMany } from './base';
import { createInstrumentedSqlConnection, RequestContext } from './instrumented-base';
import { DatabaseMetricsService, AnalyticsEnv } from '../services/database-metrics.service';

// Re-export types
export type { Pitch, CreatePitchInput, UpdatePitchInput, PitchFilters } from './pitches';

/**
 * Example: Instrumented createPitch function
 */
export async function createPitchInstrumented(
  databaseUrl: string,
  env: AnalyticsEnv,
  context: RequestContext,
  input: any // Use proper type from pitches.ts
): Promise<any> {
  // Create instrumented connection
  const instrumentedSql = createInstrumentedSqlConnection(databaseUrl, env, context);

  // This query will automatically be tracked for performance metrics
  const result = await instrumentedSql.queryFirst`
    INSERT INTO pitches (
      title, tagline, genre, subgenre, format,
      logline, synopsis, target_audience, budget_range,
      comparable_works, pitch_deck_url, video_pitch_url,
      creator_id, status, visibility,
      themes, mood_tone,
      view_count, like_count, investment_count,
      created_at, updated_at, published_at
    ) VALUES (
      ${input.title}, ${input.tagline}, ${input.genre}, 
      ${input.subgenre || null}, ${input.format},
      ${input.logline}, ${input.synopsis || null},
      ${input.target_audience || null}, ${input.budget_range || null},
      ${input.comparable_works || []}::text[],
      ${input.pitch_deck_url || null}, ${input.video_pitch_url || null},
      ${input.creator_id}, ${input.status || 'draft'}, 
      ${input.visibility || 'public'},
      ${input.themes || []}::text[], ${input.mood_tone || []}::text[],
      0, 0, 0,
      NOW(), NOW(), 
      ${input.status === 'published' ? 'NOW()' : null}
    )
    RETURNING *
  `;

  if (!result) {
    throw new Error('Failed to create pitch');
  }

  return result;
}

/**
 * Example: Instrumented getPitches function with complex query
 */
export async function getPitchesInstrumented(
  databaseUrl: string,
  env: AnalyticsEnv,
  context: RequestContext,
  filters: any = {},
  pagination: { limit?: number; offset?: number } = {}
): Promise<any[]> {
  const instrumentedSql = createInstrumentedSqlConnection(databaseUrl, env, context);

  // Build dynamic WHERE clause
  const whereBuilder = new WhereBuilder();
  
  if (filters.genre) {
    whereBuilder.addOptional('genre', '=', filters.genre);
  }
  if (filters.format) {
    whereBuilder.addOptional('format', '=', filters.format);
  }
  if (filters.status) {
    whereBuilder.addOptional('status', '=', filters.status);
  }
  if (filters.creator_id) {
    whereBuilder.addOptional('creator_id', '=', filters.creator_id);
  }
  if (filters.search) {
    whereBuilder.add(
      'title ILIKE $param OR logline ILIKE $param OR synopsis ILIKE $param',
      `%${filters.search}%`
    );
  }

  const { where, params } = whereBuilder.build();
  const limit = pagination.limit || 20;
  const offset = pagination.offset || 0;

  // This complex query will be automatically tracked
  const queryString = `
    SELECT 
      p.*,
      u.display_name as creator_name,
      u.avatar_url as creator_avatar,
      COUNT(i.id) as investment_count,
      COUNT(v.id) as view_count,
      COALESCE(AVG(r.rating), 0) as avg_rating
    FROM pitches p
    LEFT JOIN users u ON p.creator_id = u.id
    LEFT JOIN investments i ON p.id = i.pitch_id
    LEFT JOIN pitch_views v ON p.id = v.pitch_id
    LEFT JOIN pitch_reviews r ON p.id = r.pitch_id
    ${where}
    GROUP BY p.id, u.display_name, u.avatar_url
    ORDER BY p.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  // Execute with automatic metrics tracking
  const results = await instrumentedSql.query(queryString, ...params);

  return results;
}

/**
 * Example: Instrumented transaction with multiple queries
 */
export async function createPitchWithInvestmentInstrumented(
  databaseUrl: string,
  env: AnalyticsEnv,
  context: RequestContext,
  pitchData: any,
  investmentData: any
): Promise<{ pitch: any; investment: any }> {
  const instrumentedSql = createInstrumentedSqlConnection(databaseUrl, env, context);

  // Transaction is automatically tracked for total duration
  return await instrumentedSql.transaction(async (sql) => {
    // First query: Create pitch
    const pitch = await sql.queryFirst`
      INSERT INTO pitches (
        title, tagline, genre, format, logline,
        creator_id, status, visibility,
        created_at, updated_at
      ) VALUES (
        ${pitchData.title}, ${pitchData.tagline}, ${pitchData.genre},
        ${pitchData.format}, ${pitchData.logline},
        ${pitchData.creator_id}, 'draft', 'private',
        NOW(), NOW()
      )
      RETURNING *
    `;

    if (!pitch) {
      throw new Error('Failed to create pitch');
    }

    // Second query: Create initial investment
    const investment = await sql.queryFirst`
      INSERT INTO investments (
        pitch_id, investor_id, amount, status,
        created_at, updated_at
      ) VALUES (
        ${pitch.id}, ${investmentData.investor_id}, ${investmentData.amount},
        'pending', NOW(), NOW()
      )
      RETURNING *
    `;

    if (!investment) {
      throw new Error('Failed to create investment');
    }

    // Third query: Update pitch investment count
    await sql.query`
      UPDATE pitches 
      SET investment_count = investment_count + 1,
          updated_at = NOW()
      WHERE id = ${pitch.id}
    `;

    return { pitch, investment };
  });
}

/**
 * Example: Wrapper function to instrument existing queries
 */
export function instrumentExistingQuery<T>(
  originalFunction: (sql: SqlQuery, ...args: any[]) => Promise<T>,
  databaseUrl: string,
  env: AnalyticsEnv,
  context: RequestContext
) {
  return async (...args: any[]): Promise<T> => {
    const instrumentedSql = createInstrumentedSqlConnection(databaseUrl, env, context);
    
    // Call original function with instrumented SQL connection
    return originalFunction(instrumentedSql.getRawConnection(), ...args);
  };
}

/**
 * Usage example in Worker handlers:
 * 
 * In a Worker route handler, you would use it like this:
 * 
 * ```typescript
 * private async handleCreatePitch(request: Request): Promise<Response> {
 *   try {
 *     const authCheck = await this.requireAuth(request);
 *     if (!authCheck.authorized) return authCheck.response;
 *     
 *     const pitchData = await request.json();
 *     const context = {
 *       endpoint: '/api/pitches',
 *       userId: authCheck.user.id,
 *       method: 'POST'
 *     };
 *     
 *     const result = await createPitchInstrumented(
 *       this.env.DATABASE_URL,
 *       this.env, // Contains Analytics Engine bindings
 *       context,
 *       pitchData
 *     );
 *     
 *     return new Response(JSON.stringify({ success: true, data: result }), {
 *       headers: getCorsHeaders(request.headers.get('Origin'))
 *     });
 *   } catch (error) {
 *     return errorHandler(error, request);
 *   }
 * }
 * ```
 */