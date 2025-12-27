/**
 * NDA Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';

export async function ndaHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const userId = url.searchParams.get('userId') || '1';
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      ndas: [],
      total: 0
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
  
  try {
    let query;
    if (status) {
      query = sql`
        SELECT 
          n.*, p.title as pitch_title,
          COUNT(*) OVER() as total_count
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        WHERE n.status = ${status} 
          AND (n.requester_id = ${userId} OR p.creator_id = ${userId})
        ORDER BY n.created_at DESC
        LIMIT 20
      `;
    } else {
      query = sql`
        SELECT 
          n.*, p.title as pitch_title,
          COUNT(*) OVER() as total_count
        FROM ndas n
        JOIN pitches p ON n.pitch_id = p.id
        WHERE n.requester_id = ${userId} OR p.creator_id = ${userId}
        ORDER BY n.created_at DESC
        LIMIT 20
      `;
    }
    
    const result = await query;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        ndas: result || [],
        total: result[0]?.total_count || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('NDA query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}

export async function ndaStatsHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '1';
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      signed: 0
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120'
      }
    });
  }
  
  try {
    const result = await sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'signed') as signed
      FROM ndas n
      JOIN pitches p ON n.pitch_id = p.id
      WHERE n.requester_id = ${userId} OR p.creator_id = ${userId}
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        total: Number(result[0]?.total) || 0,
        pending: Number(result[0]?.pending) || 0,
        approved: Number(result[0]?.approved) || 0,
        rejected: Number(result[0]?.rejected) || 0,
        signed: Number(result[0]?.signed) || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120'
      }
    });
    
  } catch (error) {
    console.error('NDA stats query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120'
      }
    });
  }
}