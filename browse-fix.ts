/**
 * Complete Browse Tabs Filtering Fix for Cloudflare Worker
 * 
 * This file contains the fixed browsePitches method that properly handles
 * the different tab filtering requirements:
 * - "trending" tab: Last 7 days with view_count > 10
 * - "new" tab: Last 30 days, sorted by creation date
 * - "popular" tab: All time, with view_count > 50 OR like_count > 20
 */

import { ApiResponseBuilder, ErrorCode, errorHandler } from './utils/api-response';

/**
 * Fixed Browse Pitches Handler
 * Replaces the existing browsePitches method in worker-integrated.ts
 */
export async function browsePitchesFixed(request: Request, db: any): Promise<Response> {
  const builder = new ApiResponseBuilder(request);
  const url = new URL(request.url);
  const tab = url.searchParams.get('tab') || 'trending';
  const limit = parseInt(url.searchParams.get('limit') || '20');
  const page = parseInt(url.searchParams.get('page') || '1');
  const offset = (page - 1) * limit;

  try {
    let sql: string;
    let params: any[];
    let whereClause: string;
    let orderClause: string;

    // Base SELECT with all required fields and joins
    const baseSelect = `
      SELECT 
        p.*,
        u.name as creator_name,
        COALESCE(p.view_count, 0) as view_count,
        COALESCE(p.like_count, 0) as like_count,
        COALESCE(p.investment_count, 0) as investment_count
      FROM pitches p
      LEFT JOIN users u ON p.creator_id = u.id
    `;

    switch (tab) {
      case 'trending':
        // Trending: Last 7 days with view_count > 10
        whereClause = `
          WHERE p.status = 'published' 
          AND p.created_at >= NOW() - INTERVAL '7 days'
          AND COALESCE(p.view_count, 0) > 10
        `;
        orderClause = `ORDER BY p.view_count DESC, p.created_at DESC`;
        break;

      case 'new':
        // New: Last 30 days, sorted by creation date
        whereClause = `
          WHERE p.status = 'published'
          AND p.created_at >= NOW() - INTERVAL '30 days'
        `;
        orderClause = `ORDER BY p.created_at DESC`;
        break;

      case 'popular':
        // Popular: All time, with view_count > 50 OR like_count > 20
        whereClause = `
          WHERE p.status = 'published'
          AND (COALESCE(p.view_count, 0) > 50 OR COALESCE(p.like_count, 0) > 20)
        `;
        orderClause = `ORDER BY p.view_count DESC, p.like_count DESC, p.created_at DESC`;
        break;

      default:
        // Fallback to trending if invalid tab
        whereClause = `
          WHERE p.status = 'published' 
          AND p.created_at >= NOW() - INTERVAL '7 days'
          AND COALESCE(p.view_count, 0) > 10
        `;
        orderClause = `ORDER BY p.view_count DESC, p.created_at DESC`;
        break;
    }

    // Construct the complete SQL query
    sql = `
      ${baseSelect}
      ${whereClause}
      ${orderClause}
      LIMIT $1 OFFSET $2
    `;

    params = [limit, offset];

    // Execute the main query
    const pitches = await db.query(sql, params);

    // Get total count for pagination (if needed)
    const countSql = `
      SELECT COUNT(*) as total
      FROM pitches p
      ${whereClause}
    `;
    
    const [{ total }] = await db.query(countSql);

    // Return the response in the expected format
    return builder.success({ 
      success: true,
      items: pitches || [],
      tab: tab,
      total: total || 0,
      page: page,
      limit: limit,
      hasMore: (offset + (pitches?.length || 0)) < (total || 0)
    });

  } catch (error) {
    console.error('Error in browsePitches:', error);
    return errorHandler(error, request);
  }
}

/**
 * Drop-in replacement method for RouteRegistry class
 * This method should replace the existing browsePitches method in worker-integrated.ts
 */
export function createBrowsePitchesMethod() {
  return async function browsePitches(this: any, request: Request): Promise<Response> {
    return browsePitchesFixed(request, this.db);
  };
}

/**
 * SQL optimization queries to ensure proper indexing for browse performance
 * Run these in your database to optimize browse queries
 */
export const BROWSE_OPTIMIZATION_SQL = `
-- Ensure view_count and like_count columns exist with proper defaults
ALTER TABLE pitches 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0;

-- Create composite indexes for optimal browse performance
CREATE INDEX IF NOT EXISTS idx_pitches_trending 
ON pitches(status, created_at, view_count) 
WHERE status = 'published' AND view_count > 10;

CREATE INDEX IF NOT EXISTS idx_pitches_new 
ON pitches(status, created_at) 
WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_pitches_popular_views 
ON pitches(status, view_count, created_at) 
WHERE status = 'published' AND view_count > 50;

CREATE INDEX IF NOT EXISTS idx_pitches_popular_likes 
ON pitches(status, like_count, created_at) 
WHERE status = 'published' AND like_count > 20;

-- Function to update pitch statistics (if not exists)
CREATE OR REPLACE FUNCTION update_pitch_stats_realtime()
RETURNS TRIGGER AS $$
BEGIN
    -- Update view_count from analytics_events
    UPDATE pitches SET view_count = (
        SELECT COUNT(*) FROM analytics_events 
        WHERE pitch_id = NEW.pitch_id AND event_type = 'view'
    ) WHERE id = NEW.pitch_id;
    
    -- Update like_count from pitch_likes
    UPDATE pitches SET like_count = (
        SELECT COUNT(*) FROM pitch_likes 
        WHERE pitch_id = NEW.pitch_id
    ) WHERE id = NEW.pitch_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to keep stats updated in real-time
DROP TRIGGER IF EXISTS trigger_update_view_stats ON analytics_events;
CREATE TRIGGER trigger_update_view_stats
    AFTER INSERT ON analytics_events
    FOR EACH ROW
    WHEN (NEW.event_type = 'view')
    EXECUTE FUNCTION update_pitch_stats_realtime();

DROP TRIGGER IF EXISTS trigger_update_like_stats ON pitch_likes;
CREATE TRIGGER trigger_update_like_stats
    AFTER INSERT OR DELETE ON pitch_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_pitch_stats_realtime();
`;

/**
 * Test data generator for verifying browse functionality
 */
export const GENERATE_TEST_DATA_SQL = `
-- Generate test pitches with various stats for testing browse tabs
WITH test_data AS (
  SELECT 
    'Test Pitch ' || generate_series(1, 100) as title,
    'Test logline for pitch ' || generate_series(1, 100) as logline,
    (ARRAY['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi'])[floor(random() * 5 + 1)] as genre,
    'Feature' as format,
    '1M-5M' as budget_range,
    'General Audience' as target_audience,
    'This is a test synopsis for testing purposes.' as synopsis,
    'published' as status,
    NOW() - (random() * interval '60 days') as created_at,
    floor(random() * 200) as view_count,
    floor(random() * 50) as like_count,
    1 as creator_id -- Assuming user ID 1 exists
  FROM generate_series(1, 100)
)
INSERT INTO pitches (
  title, logline, genre, format, budget_range, 
  target_audience, synopsis, status, created_at, 
  view_count, like_count, creator_id
)
SELECT * FROM test_data
ON CONFLICT DO NOTHING;
`;