/**
 * Follows Handler with Error Resilience
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';

export async function followersHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const creatorId = url.searchParams.get('creatorId') || '1';
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      followers: [],
      count: 0
    }
  };
  
  if (!sql) {
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  }
  
  try {
    // Check if follows table exists first
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'follows'
      )
    `.catch(() => [{ exists: false }]);
    
    if (!tableCheck[0]?.exists) {
      // Table doesn't exist, return empty
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    const result = await sql`
      SELECT 
        u.id, u.username, u.email, u.profile_image,
        COUNT(*) OVER() as total_count
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      WHERE f.following_id = ${creatorId}
      LIMIT 20
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        followers: result || [],
        count: result[0]?.total_count || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Followers query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}

export async function followingHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '1';
  const sql = getDb(env);
  
  const defaultResponse = {
    success: true,
    data: {
      following: [],
      count: 0
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
    // Check if follows table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'follows'
      )
    `.catch(() => [{ exists: false }]);
    
    if (!tableCheck[0]?.exists) {
      return new Response(JSON.stringify(defaultResponse), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    const result = await sql`
      SELECT 
        u.id, u.username, u.email, u.profile_image,
        COUNT(*) OVER() as total_count
      FROM follows f
      JOIN users u ON f.following_id = u.id
      WHERE f.follower_id = ${userId}
      LIMIT 20
    `;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        following: result || [],
        count: result[0]?.total_count || 0
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Following query error:', error);
    return new Response(JSON.stringify(defaultResponse), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
}