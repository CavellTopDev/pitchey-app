/**
 * Database operations with comprehensive distributed tracing
 * Provides detailed insights into query performance and bottlenecks
 */

import type { Env } from '../types';
import { TraceService, type TraceSpan } from '../services/trace-service';

interface QueryMetrics {
  query: string;
  duration: number;
  rowCount: number;
  cacheHit: boolean;
  error?: string;
}

/**
 * Get pitch with comprehensive tracing
 */
export async function getPitchWithTracing(
  env: Env,
  pitchId: number,
  userId?: string,
  parentSpan?: TraceSpan
) {
  const traceService = new TraceService(env);
  
  const span = parentSpan
    ? traceService.startChildSpan(parentSpan, 'db.pitch.get', {
        'pitch.id': pitchId,
        'user.id': userId || 'anonymous',
        'cache.enabled': env.CACHE ? true : false
      })
    : traceService.startSpan('db.pitch.get', {
        'pitch.id': pitchId,
        'user.id': userId || 'anonymous',
        'cache.enabled': env.CACHE ? true : false
      });

  try {
    // Check cache first
    const cacheKey = `pitch:${pitchId}`;
    if (env.CACHE) {
      traceService.addSpanEvent(span.spanId, 'cache.check', { key: cacheKey });
      
      const cached = await env.CACHE.get(cacheKey, 'json');
      if (cached) {
        span.attributes['cache.hit'] = true;
        span.attributes['cache.source'] = 'kv';
        await traceService.finishSpan(span.spanId, 'success');
        return cached;
      }
    }

    span.attributes['cache.hit'] = false;
    traceService.addSpanEvent(span.spanId, 'db.query_start');
    
    const startTime = performance.now();
    const result = await env.DB.prepare(`
      SELECT 
        p.*,
        u.name as creator_name,
        u.email as creator_email,
        COUNT(DISTINCT nda.id) as nda_count,
        COUNT(DISTINCT v.id) as view_count
      FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
      LEFT JOIN ndas nda ON p.id = nda.pitch_id
      LEFT JOIN pitch_views v ON p.id = v.pitch_id
      WHERE p.id = ? 
        AND (p.visibility = 'public' OR p.creator_id = ? OR ? = true)
      GROUP BY p.id, u.id
    `).bind(pitchId, userId || 0, userId ? true : false).first();
    
    const queryDuration = performance.now() - startTime;
    
    span.attributes['db.duration_ms'] = queryDuration;
    span.attributes['db.found'] = result ? true : false;
    
    if (result && env.CACHE) {
      // Cache the result
      traceService.addSpanEvent(span.spanId, 'cache.write', { key: cacheKey });
      await env.CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 300 // 5 minutes
      });
    }
    
    await traceService.finishSpan(span.spanId, 'success');
    return result;
  } catch (error) {
    span.attributes['db.error'] = error.message;
    await traceService.finishSpan(span.spanId, 'error', error);
    throw error;
  }
}

/**
 * Search pitches with tracing and performance monitoring
 */
export async function searchPitchesWithTracing(
  env: Env,
  filters: {
    query?: string;
    genre?: string;
    budget?: { min?: number; max?: number };
    status?: string;
    limit?: number;
    offset?: number;
  },
  userId?: string,
  parentSpan?: TraceSpan
) {
  const traceService = new TraceService(env);
  
  const span = parentSpan
    ? traceService.startChildSpan(parentSpan, 'db.pitch.search', {
        'search.query': filters.query || 'none',
        'search.genre': filters.genre || 'all',
        'search.limit': filters.limit || 20,
        'search.offset': filters.offset || 0,
        'user.id': userId || 'anonymous'
      })
    : traceService.startSpan('db.pitch.search', {
        'search.query': filters.query || 'none',
        'search.genre': filters.genre || 'all',
        'search.limit': filters.limit || 20,
        'search.offset': filters.offset || 0,
        'user.id': userId || 'anonymous'
      });

  try {
    // Build dynamic query with tracing
    let query = `
      SELECT 
        p.id,
        p.title,
        p.tagline,
        p.genre,
        p.budget,
        p.status,
        p.visibility,
        p.created_at,
        p.view_count,
        u.name as creator_name,
        COUNT(DISTINCT nda.id) as nda_requests
      FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
      LEFT JOIN ndas nda ON p.id = nda.pitch_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (filters.query) {
      query += ` AND (p.title ILIKE ? OR p.tagline ILIKE ? OR p.synopsis ILIKE ?)`;
      const searchTerm = `%${filters.query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
      span.attributes['search.has_text_filter'] = true;
    }
    
    if (filters.genre) {
      query += ` AND p.genre = ?`;
      params.push(filters.genre);
      span.attributes['search.has_genre_filter'] = true;
    }
    
    if (filters.budget?.min !== undefined) {
      query += ` AND p.budget >= ?`;
      params.push(filters.budget.min);
      span.attributes['search.has_budget_min'] = true;
    }
    
    if (filters.budget?.max !== undefined) {
      query += ` AND p.budget <= ?`;
      params.push(filters.budget.max);
      span.attributes['search.has_budget_max'] = true;
    }
    
    if (filters.status) {
      query += ` AND p.status = ?`;
      params.push(filters.status);
      span.attributes['search.has_status_filter'] = true;
    }
    
    // Add visibility check
    if (!userId) {
      query += ` AND p.visibility = 'public'`;
    } else {
      query += ` AND (p.visibility = 'public' OR p.creator_id = ?)`;
      params.push(userId);
    }
    
    query += ` GROUP BY p.id, u.id ORDER BY p.created_at DESC`;
    
    // Add pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    traceService.addSpanEvent(span.spanId, 'query.built', {
      param_count: params.length,
      has_pagination: true
    });
    
    const startTime = performance.now();
    const result = await env.DB.prepare(query).bind(...params).all();
    const queryDuration = performance.now() - startTime;
    
    span.attributes['db.duration_ms'] = queryDuration;
    span.attributes['db.row_count'] = result.results.length;
    span.attributes['db.has_more'] = result.results.length === limit;
    
    // Log slow queries
    if (queryDuration > 100) {
      traceService.addSpanEvent(span.spanId, 'slow_query_detected', {
        duration_ms: queryDuration,
        row_count: result.results.length
      });
      
      // Send to analytics for monitoring
      if (env.PITCHEY_PERFORMANCE) {
        await env.PITCHEY_PERFORMANCE.writeDataPoint({
          blobs: ['slow_query', 'pitch_search', filters.query || 'none'],
          doubles: [queryDuration, result.results.length],
          indexes: ['slow_query:search'] // Single combined index
        });
      }
    }
    
    await traceService.finishSpan(span.spanId, 'success');
    return result.results;
  } catch (error) {
    span.attributes['db.error'] = error.message;
    await traceService.finishSpan(span.spanId, 'error', error);
    throw error;
  }
}

/**
 * Create NDA with full audit trail
 */
export async function createNDAWithTracing(
  env: Env,
  ndaData: {
    pitch_id: number;
    requester_id: string;
    requester_type: 'investor' | 'production';
    template_id?: string;
    custom_terms?: string;
    expires_at: string;
  },
  parentSpan?: TraceSpan
) {
  const traceService = new TraceService(env);
  
  const span = parentSpan
    ? traceService.startChildSpan(parentSpan, 'db.nda.create', {
        'nda.pitch_id': ndaData.pitch_id,
        'nda.requester_id': ndaData.requester_id,
        'nda.requester_type': ndaData.requester_type,
        'nda.has_custom_terms': !!ndaData.custom_terms
      })
    : traceService.startSpan('db.nda.create', {
        'nda.pitch_id': ndaData.pitch_id,
        'nda.requester_id': ndaData.requester_id,
        'nda.requester_type': ndaData.requester_type,
        'nda.has_custom_terms': !!ndaData.custom_terms
      });

  try {
    // Log audit trail for compliance
    await traceService.logAuditTrail({
      timestamp: Date.now(),
      traceId: span.traceId,
      userId: ndaData.requester_id,
      action: 'nda.create',
      resource: `pitch:${ndaData.pitch_id}`,
      result: 'pending',
      metadata: {
        requester_type: ndaData.requester_type,
        has_custom_terms: !!ndaData.custom_terms,
        expires_at: ndaData.expires_at
      }
    });
    
    // Begin transaction with tracing
    traceService.addSpanEvent(span.spanId, 'transaction.begin');
    
    const startTime = performance.now();
    
    // Insert NDA
    const ndaResult = await env.DB.prepare(`
      INSERT INTO ndas (
        pitch_id, 
        requester_id, 
        requester_type,
        template_id,
        custom_terms,
        status,
        expires_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
      RETURNING *
    `).bind(
      ndaData.pitch_id,
      ndaData.requester_id,
      ndaData.requester_type,
      ndaData.template_id || null,
      ndaData.custom_terms || null,
      ndaData.expires_at
    ).first();
    
    if (!ndaResult) {
      throw new Error('Failed to create NDA');
    }
    
    // Create notification for pitch creator
    traceService.addSpanEvent(span.spanId, 'notification.create');
    
    await env.DB.prepare(`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data,
        created_at
      ) 
      SELECT 
        p.creator_id,
        'nda_request',
        'New NDA Request',
        ? || ' has requested to sign an NDA for your pitch',
        json_object('nda_id', ?, 'pitch_id', ?),
        datetime('now')
      FROM pitches p
      WHERE p.id = ?
    `).bind(
      ndaData.requester_type === 'investor' ? 'An investor' : 'A production company',
      ndaResult.id,
      ndaData.pitch_id,
      ndaData.pitch_id
    ).run();
    
    const transactionDuration = performance.now() - startTime;
    
    span.attributes['db.duration_ms'] = transactionDuration;
    span.attributes['db.nda_id'] = ndaResult.id;
    span.attributes['db.transaction.success'] = true;
    
    // Log successful creation
    await traceService.logAuditTrail({
      timestamp: Date.now(),
      traceId: span.traceId,
      userId: ndaData.requester_id,
      action: 'nda.created',
      resource: `nda:${ndaResult.id}`,
      result: 'success',
      metadata: {
        pitch_id: ndaData.pitch_id,
        nda_id: ndaResult.id
      }
    });
    
    await traceService.finishSpan(span.spanId, 'success');
    return ndaResult;
  } catch (error) {
    span.attributes['db.error'] = error.message;
    span.attributes['db.transaction.success'] = false;
    
    // Log failed creation
    await traceService.logAuditTrail({
      timestamp: Date.now(),
      traceId: span.traceId,
      userId: ndaData.requester_id,
      action: 'nda.create_failed',
      resource: `pitch:${ndaData.pitch_id}`,
      result: 'failure',
      metadata: {
        error: error.message
      }
    });
    
    await traceService.finishSpan(span.spanId, 'error', error);
    throw error;
  }
}

/**
 * Track user activity with tracing
 */
export async function trackUserActivityWithTracing(
  env: Env,
  userId: string,
  activity: {
    type: string;
    resource: string;
    metadata?: Record<string, any>;
  },
  parentSpan?: TraceSpan
) {
  const traceService = new TraceService(env);
  
  const span = parentSpan
    ? traceService.startChildSpan(parentSpan, 'db.activity.track', {
        'activity.type': activity.type,
        'activity.resource': activity.resource,
        'user.id': userId
      })
    : traceService.startSpan('db.activity.track', {
        'activity.type': activity.type,
        'activity.resource': activity.resource,
        'user.id': userId
      });

  try {
    // Log to audit trail
    await traceService.logAuditTrail({
      timestamp: Date.now(),
      traceId: span.traceId,
      userId,
      action: activity.type,
      resource: activity.resource,
      result: 'success',
      metadata: activity.metadata
    });
    
    // Store in database
    const result = await env.DB.prepare(`
      INSERT INTO user_activities (
        user_id,
        activity_type,
        resource,
        metadata,
        created_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
      RETURNING id
    `).bind(
      userId,
      activity.type,
      activity.resource,
      JSON.stringify(activity.metadata || {})
    ).first();
    
    span.attributes['db.activity_id'] = result?.id;
    
    // Send to analytics for real-time dashboards
    if (env.ANALYTICS) {
      await env.ANALYTICS.writeDataPoint({
        blobs: [userId, activity.type, activity.resource],
        doubles: [Date.now()],
        indexes: [`${activity.type}:user_activity`] // Single combined index
      });
    }
    
    await traceService.finishSpan(span.spanId, 'success');
    return result;
  } catch (error) {
    span.attributes['db.error'] = error.message;
    await traceService.finishSpan(span.spanId, 'error', error);
    throw error;
  }
}

/**
 * Batch operation with distributed tracing
 */
export async function batchOperationWithTracing<T>(
  env: Env,
  operations: Array<{
    query: string;
    params: any[];
    name: string;
  }>,
  parentSpan?: TraceSpan
): Promise<T[]> {
  const traceService = new TraceService(env);
  
  const span = parentSpan
    ? traceService.startChildSpan(parentSpan, 'db.batch_operation', {
        'batch.size': operations.length,
        'batch.operations': operations.map(op => op.name).join(',')
      })
    : traceService.startSpan('db.batch_operation', {
        'batch.size': operations.length,
        'batch.operations': operations.map(op => op.name).join(',')
      });

  const results: T[] = [];
  const errors: Array<{ operation: string; error: string }> = [];

  try {
    for (const operation of operations) {
      const opSpan = traceService.startChildSpan(span, `db.${operation.name}`, {
        'db.statement': operation.query.substring(0, 100),
        'db.params.count': operation.params.length
      });
      
      try {
        const startTime = performance.now();
        const result = await env.DB.prepare(operation.query)
          .bind(...operation.params)
          .all();
        const duration = performance.now() - startTime;
        
        opSpan.attributes['db.duration_ms'] = duration;
        opSpan.attributes['db.row_count'] = result.results.length;
        
        results.push(...(result.results as T[]));
        await traceService.finishSpan(opSpan.spanId, 'success');
      } catch (error) {
        errors.push({
          operation: operation.name,
          error: error.message
        });
        await traceService.finishSpan(opSpan.spanId, 'error', error);
      }
    }
    
    span.attributes['batch.success_count'] = operations.length - errors.length;
    span.attributes['batch.error_count'] = errors.length;
    
    if (errors.length > 0) {
      span.attributes['batch.errors'] = JSON.stringify(errors);
    }
    
    await traceService.finishSpan(
      span.spanId,
      errors.length === 0 ? 'success' : errors.length < operations.length ? 'partial' : 'error'
    );
    
    return results;
  } catch (error) {
    span.attributes['db.error'] = error.message;
    await traceService.finishSpan(span.spanId, 'error', error);
    throw error;
  }
}