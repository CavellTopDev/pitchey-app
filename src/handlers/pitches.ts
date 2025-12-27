/**
 * Pitches Handler with Raw SQL Queries
 * Uses new query functions that properly separate trending and new pitches
 */

import { getDb } from '../db/connection';
import type { Env } from '../db/connection';
import * as pitchQueries from '../db/queries/pitches';

export async function pitchesHandler(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const genre = url.searchParams.get('genre');
  const format = url.searchParams.get('format');
  const sort = url.searchParams.get('sort') || 'newest';
  const searchTerm = url.searchParams.get('q');
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
    let pitches;
    
    // If searching, use search function
    if (searchTerm) {
      pitches = await pitchQueries.searchPitches(sql, searchTerm, {
        genre,
        format,
        status: 'published',
        sortBy: sort as any,
        limit,
        offset
      });
    } 
    // If sorting by trending
    else if (sort === 'trending') {
      pitches = await pitchQueries.getTrendingPitches(sql, limit, offset);
    }
    // Default to newest
    else {
      pitches = await pitchQueries.getNewPitches(sql, limit, offset);
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: pitches || [],
        totalCount: pitches.length,
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

// FIXED: Browse tab separation - Trending shows only high-engagement pitches
export async function trendingPitchesHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 10;
  const offset = Number(url.searchParams.get('offset')) || 0;
  
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
    // Use the new getTrendingPitches function that properly filters for high engagement
    const pitches = await pitchQueries.getTrendingPitches(sql, limit, offset);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: pitches || []
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

// FIXED: Browse tab separation - New shows only recent pitches from last 30 days
export async function newPitchesHandler(request: Request, env: Env): Promise<Response> {
  const sql = getDb(env);
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit')) || 10;
  const offset = Number(url.searchParams.get('offset')) || 0;
  
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
    // Use the new getNewPitches function that filters for recent pitches only
    const pitches = await pitchQueries.getNewPitches(sql, limit, offset);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        pitches: pitches || []
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