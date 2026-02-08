/**
 * Creator Pitches Handler - Get creator's pitches for the portal
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';
import { requireRole } from '../utils/auth-extract';

// GET /api/creator/pitches - Get creator's pitches
export async function creatorPitchesHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    const sql = getDb(env);

    if (!sql) {
      console.error('Database connection failed in creator pitches');
      return new Response(JSON.stringify({
        success: true,
        pitches: [],
        total: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get creator's pitches with full details
    // Use separate queries based on whether status filter is provided
    let pitches;
    let countResult;

    if (status && ['draft', 'published', 'under_review', 'archived'].includes(status)) {
      pitches = await sql`
        SELECT
          id,
          title,
          logline,
          short_synopsis,
          long_synopsis,
          genre,
          format,
          budget_bracket,
          estimated_budget,
          target_audience,
          themes,
          title_image,
          status,
          require_nda,
          visibility_settings,
          characters,
          production_timeline,
          view_count,
          like_count,
          nda_count,
          published_at,
          created_at,
          updated_at
        FROM pitches
        WHERE user_id = ${userId}
          AND status = ${status}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total
        FROM pitches
        WHERE user_id = ${userId}
          AND status = ${status}
      `;
    } else {
      pitches = await sql`
        SELECT
          id,
          title,
          logline,
          short_synopsis,
          long_synopsis,
          genre,
          format,
          budget_bracket,
          estimated_budget,
          target_audience,
          themes,
          title_image,
          status,
          require_nda,
          visibility_settings,
          characters,
          production_timeline,
          view_count,
          like_count,
          nda_count,
          published_at,
          created_at,
          updated_at
        FROM pitches
        WHERE user_id = ${userId}
        ORDER BY updated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      countResult = await sql`
        SELECT COUNT(*) as total
        FROM pitches
        WHERE user_id = ${userId}
      `;
    }

    const total = parseInt(countResult[0]?.total || '0');

    // Transform pitches to match frontend expectations
    const transformedPitches = pitches.map((pitch: any) => ({
      id: pitch.id,
      title: pitch.title,
      logline: pitch.logline,
      shortSynopsis: pitch.short_synopsis,
      longSynopsis: pitch.long_synopsis,
      genre: pitch.genre,
      format: pitch.format,
      budgetBracket: pitch.budget_bracket,
      estimatedBudget: pitch.estimated_budget,
      targetAudience: pitch.target_audience,
      themes: pitch.themes,
      titleImage: pitch.title_image,
      status: pitch.status,
      requireNDA: pitch.require_nda,
      visibilitySettings: pitch.visibility_settings,
      characters: pitch.characters,
      productionTimeline: pitch.production_timeline,
      viewCount: pitch.view_count || 0,
      likeCount: pitch.like_count || 0,
      ndaCount: pitch.nda_count || 0,
      publishedAt: pitch.published_at,
      createdAt: pitch.created_at,
      updatedAt: pitch.updated_at
    }));

    return new Response(JSON.stringify({
      success: true,
      pitches: transformedPitches,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=30',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Creator pitches error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load pitches',
      debug: errorMessage,
      pitches: [],
      total: 0
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

// GET /api/creator/activities - Get creator's activity feed
export async function creatorActivitiesHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Require creator role
  const roleCheck = await requireRole(request, env, 'creator');
  if ('error' in roleCheck) {
    return roleCheck.error;
  }

  const userId = roleCheck.user.id;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const type = url.searchParams.get('type'); // filter by activity type

  try {
    const sql = getDb(env);

    if (!sql) {
      console.error('Database connection failed in creator activities');
      return new Response(JSON.stringify({
        success: true,
        activities: [],
        total: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Simplified activity query - get pitch-related activities
    // For now, just fetch created/published pitches as activity items
    const activities = await sql`
      SELECT
        id,
        CASE
          WHEN status = 'published' AND published_at IS NOT NULL THEN 'pitch_published'
          ELSE 'pitch_created'
        END as type,
        CASE
          WHEN status = 'published' AND published_at IS NOT NULL
          THEN 'You published "' || title || '"'
          ELSE 'You created "' || title || '"'
        END as description,
        COALESCE(published_at, created_at) as created_at,
        jsonb_build_object(
          'pitchId', id,
          'pitchTitle', title,
          'status', status
        ) as metadata
      FROM pitches
      WHERE user_id = ${userId}
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM pitches
      WHERE user_id = ${userId}
    `;

    const total = parseInt(countResult[0]?.total || '0');

    // Transform activities
    const transformedActivities = activities.map((activity: any) => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      createdAt: activity.created_at,
      metadata: activity.metadata
    }));

    return new Response(JSON.stringify({
      success: true,
      activities: transformedActivities,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=30',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Creator activities error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to load activities',
      activities: [],
      total: 0
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}
