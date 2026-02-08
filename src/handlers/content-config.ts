/**
 * Content & Config Handlers with Real Database Queries
 * Public endpoints for content pages, platform stats, and categories.
 * All handlers use graceful degradation: DB failure returns hardcoded fallback content.
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import { getCorsHeaders } from '../utils/response';

function jsonResponse(data: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
  });
}

// ---------------------------------------------------------------------------
// Fallback content constants
// ---------------------------------------------------------------------------

const HOW_IT_WORKS_FALLBACK = {
  title: 'How Pitchey Works',
  sections: [
    { title: 'Create Your Pitch', description: 'Build a compelling pitch with our guided tools', icon: 'create' },
    { title: 'Connect with Investors', description: 'Get discovered by investors actively looking for opportunities', icon: 'connect' },
    { title: 'Secure Funding', description: 'Negotiate deals and secure the funding you need', icon: 'fund' }
  ]
};

const ABOUT_FALLBACK = {
  title: 'About Pitchey',
  description: 'Pitchey is the premier platform connecting movie creators with investors and production companies.',
  mission: 'To democratize the entertainment industry by making pitch funding accessible to all creators.',
  founded: '2024'
};

const TEAM_FALLBACK = {
  title: 'Our Team',
  members: [] as unknown[]
};

const STATS_FALLBACK = {
  total_users: 0,
  total_pitches: 0,
  published_pitches: 0,
  total_invested: 0
};

const CATEGORIES_FALLBACK = [
  { id: 'drama', name: 'Drama', count: 0 },
  { id: 'comedy', name: 'Comedy', count: 0 },
  { id: 'action', name: 'Action', count: 0 },
  { id: 'thriller', name: 'Thriller', count: 0 },
  { id: 'sci-fi', name: 'Sci-Fi', count: 0 },
  { id: 'horror', name: 'Horror', count: 0 },
  { id: 'documentary', name: 'Documentary', count: 0 },
  { id: 'animation', name: 'Animation', count: 0 },
  { id: 'romance', name: 'Romance', count: 0 },
  { id: 'fantasy', name: 'Fantasy', count: 0 }
];

// ---------------------------------------------------------------------------
// 1. GET /api/content/how-it-works
// ---------------------------------------------------------------------------

export async function contentHowItWorksHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: true, data: HOW_IT_WORKS_FALLBACK }, 200, origin);
  }

  try {
    const rows = await sql`SELECT * FROM content_items WHERE key = 'how-it-works' LIMIT 1`;

    if (rows && rows.length > 0) {
      const content = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return jsonResponse({ success: true, data: content }, 200, origin);
    }

    return jsonResponse({ success: true, data: HOW_IT_WORKS_FALLBACK }, 200, origin);
  } catch (error) {
    console.error('contentHowItWorksHandler error:', error);
    return jsonResponse({ success: true, data: HOW_IT_WORKS_FALLBACK }, 200, origin);
  }
}

// ---------------------------------------------------------------------------
// 2. GET /api/content/about
// ---------------------------------------------------------------------------

export async function contentAboutHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: true, data: ABOUT_FALLBACK }, 200, origin);
  }

  try {
    const rows = await sql`SELECT * FROM content_items WHERE key = 'about' LIMIT 1`;

    if (rows && rows.length > 0) {
      const content = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return jsonResponse({ success: true, data: content }, 200, origin);
    }

    return jsonResponse({ success: true, data: ABOUT_FALLBACK }, 200, origin);
  } catch (error) {
    console.error('contentAboutHandler error:', error);
    return jsonResponse({ success: true, data: ABOUT_FALLBACK }, 200, origin);
  }
}

// ---------------------------------------------------------------------------
// 3. GET /api/content/team
// ---------------------------------------------------------------------------

export async function contentTeamHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: true, data: TEAM_FALLBACK }, 200, origin);
  }

  try {
    const rows = await sql`SELECT * FROM content_items WHERE key = 'team' LIMIT 1`;

    if (rows && rows.length > 0) {
      const content = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
      return jsonResponse({ success: true, data: content }, 200, origin);
    }

    return jsonResponse({ success: true, data: TEAM_FALLBACK }, 200, origin);
  } catch (error) {
    console.error('contentTeamHandler error:', error);
    return jsonResponse({ success: true, data: TEAM_FALLBACK }, 200, origin);
  }
}

// ---------------------------------------------------------------------------
// 4. GET /api/content/stats
// ---------------------------------------------------------------------------

export async function contentStatsHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: true, data: STATS_FALLBACK }, 200, origin);
  }

  try {
    const rows = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE is_active = true) as total_users,
        (SELECT COUNT(*)::int FROM pitches) as total_pitches,
        (SELECT COUNT(*)::int FROM pitches WHERE status = 'published') as published_pitches,
        (SELECT COALESCE(SUM(amount), 0)::numeric FROM investments) as total_invested
    `;

    if (rows && rows.length > 0) {
      return jsonResponse({
        success: true,
        data: {
          total_users: rows[0].total_users ?? 0,
          total_pitches: rows[0].total_pitches ?? 0,
          published_pitches: rows[0].published_pitches ?? 0,
          total_invested: Number(rows[0].total_invested) || 0
        }
      }, 200, origin);
    }

    return jsonResponse({ success: true, data: STATS_FALLBACK }, 200, origin);
  } catch (error) {
    console.error('contentStatsHandler error:', error);
    return jsonResponse({ success: true, data: STATS_FALLBACK }, 200, origin);
  }
}

// ---------------------------------------------------------------------------
// 5. GET /api/categories
// ---------------------------------------------------------------------------

export async function categoriesHandler(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const sql = getDb(env);

  if (!sql) {
    return jsonResponse({ success: true, data: CATEGORIES_FALLBACK }, 200, origin);
  }

  try {
    const rows = await sql`
      SELECT genre, COUNT(*)::int as count
      FROM pitches
      WHERE status = 'published' AND genre IS NOT NULL
      GROUP BY genre
      ORDER BY count DESC
    `;

    if (rows && rows.length > 0) {
      const categories = rows.map((row: any) => ({
        id: String(row.genre).toLowerCase().replace(/\s+/g, '-'),
        name: row.genre,
        count: row.count
      }));
      return jsonResponse({ success: true, data: categories }, 200, origin);
    }

    return jsonResponse({ success: true, data: CATEGORIES_FALLBACK }, 200, origin);
  } catch (error) {
    console.error('categoriesHandler error:', error);
    return jsonResponse({ success: true, data: CATEGORIES_FALLBACK }, 200, origin);
  }
}
