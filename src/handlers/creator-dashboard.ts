/**
 * Creator Dashboard Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';

export async function creatorDashboardHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  
  // Always return valid data structure
  const defaultData = {
    totalPitches: 0,
    totalViews: 0,
    totalInvestments: 0,
    activeNDAs: 0,
    recentPitches: [],
    analytics: {
      weeklyViews: 0,
      monthlyViews: 0,
      conversionRate: 0
    }
  };
  
  if (!sql) {
    console.log('Database unavailable, returning default data');
    return new Response(JSON.stringify({
      success: true,
      data: defaultData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });
  }
  
  try {
    // Get user ID from auth (hardcoded for demo)
    const userId = 1; // TODO: Get from session/JWT
    
    // Simple query for free tier - use parallel queries for efficiency
    const [pitchStats, ndaStats] = await Promise.all([
      sql`
        SELECT 
          COUNT(DISTINCT p.id) as total_pitches,
          COALESCE(SUM(p.view_count), 0) as total_views,
          COUNT(DISTINCT i.id) as total_investments
        FROM pitches p
        LEFT JOIN investments i ON p.id = i.pitch_id
        WHERE p.creator_id = ${userId}
      `,
      sql`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'active') as active_ndas,
          COUNT(*) as total_ndas
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        WHERE p.creator_id = ${userId}
      `
    ]);
    
    // Get recent pitches
    const recentPitches = await sql`
      SELECT 
        id, title, status, view_count, created_at
      FROM pitches
      WHERE creator_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 5
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        totalPitches: Number(pitchStats[0]?.total_pitches) || 0,
        totalViews: Number(pitchStats[0]?.total_views) || 0,
        totalInvestments: Number(pitchStats[0]?.total_investments) || 0,
        activeNDAs: Number(ndaStats[0]?.active_ndas) || 0,
        recentPitches: recentPitches || [],
        analytics: {
          weeklyViews: Number(pitchStats[0]?.total_views) || 0,
          monthlyViews: Number(pitchStats[0]?.total_views) || 0,
          conversionRate: 0
        }
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Dashboard query error:', error);
    return new Response(JSON.stringify({
      success: true,
      data: defaultData
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}