/**
 * Pitches Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';

export async function pitchesHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const genre = url.searchParams.get('genre');
  const sort = url.searchParams.get('sort') || 'created_at';
  const page = Number(url.searchParams.get('page')) || 1;
  const limit = Number(url.searchParams.get('limit')) || 20;
  const offset = (page - 1) * limit;
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      pitches: [],
      totalCount: 0,
      page,
      pageSize: limit
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
    if (genre) {
      query = sql`
        SELECT 
          p.*, 
          u.username as creator_name,
          COUNT(*) OVER() as total_count
        FROM pitches p
        JOIN users u ON p.creator_id = u.id
        WHERE p.genre = ${genre} AND p.status = 'published'
        ORDER BY p.${sql(sort)} DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      query = sql`
        SELECT 
          p.*, 
          u.username as creator_name,
          COUNT(*) OVER() as total_count
        FROM pitches p
        JOIN users u ON p.creator_id = u.id
        WHERE p.status = 'published'
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    const result = await query;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: result || [],
        totalCount: result[0]?.total_count || 0,
        page,
        pageSize: limit
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
    
  } catch (error) {
    console.error('Pitches query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  }
}

export async function trendingPitchesHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      pitches: [],
      message: 'Trending pitches unavailable'
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
  
  try {
    const result = await sql`
      SELECT 
        p.*, 
        u.username as creator_name
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.view_count DESC, p.created_at DESC
      LIMIT 10
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: result || []
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Trending pitches query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}

export async function newPitchesHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      pitches: [],
      message: 'New pitches unavailable'
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
  
  try {
    const result = await sql`
      SELECT 
        p.*, 
        u.username as creator_name
      FROM pitches p
      JOIN users u ON p.creator_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT 10
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: result || []
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('New pitches query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}