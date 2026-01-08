/**
 * Cached Pitches Handler
 * Optimized caching for pitch queries
 */

import { KVCacheService, CacheKeys, CacheTTL } from './kv-cache.service';

export class CachedPitchesHandler {
  constructor(
    private cache: KVCacheService | null,
    private db: any
  ) {}

  async getCachedPitches(params: {
    page: number;
    limit: number;
    search?: string;
    genre?: string;
    status: string;
    minBudget?: string;
    maxBudget?: string;
    sortBy: string;
    sortOrder: string;
  }): Promise<any> {
    // Generate cache key from parameters
    const cacheKey = CacheKeys.pitchList(JSON.stringify(params));
    
    // Try to get from cache if available
    if (this.cache) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        console.log('Cache HIT for pitches:', cacheKey);
        return cached;
      }
      console.log('Cache MISS for pitches:', cacheKey);
    }
    
    // Build query
    const offset = (params.page - 1) * params.limit;
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let nextParamNum = 1;
    
    // Always add status filter
    whereConditions.push(`p.status = $${nextParamNum}`);
    queryParams.push(params.status);
    nextParamNum++;
    
    if (params.search) {
      const searchParam = `$${nextParamNum}`;
      whereConditions.push(`(
        LOWER(p.title) LIKE ${searchParam} OR 
        LOWER(p.logline) LIKE ${searchParam} OR 
        LOWER(p.synopsis) LIKE ${searchParam} OR
        LOWER(p.genre) LIKE ${searchParam}
      )`);
      queryParams.push(`%${params.search.toLowerCase()}%`);
      nextParamNum++;
    }
    
    if (params.genre) {
      whereConditions.push(`p.genre = $${nextParamNum}`);
      queryParams.push(params.genre);
      nextParamNum++;
    }
    
    if (params.minBudget) {
      whereConditions.push(`p.budget_range >= $${nextParamNum}`);
      queryParams.push(parseInt(params.minBudget));
      nextParamNum++;
    }
    
    if (params.maxBudget) {
      whereConditions.push(`p.budget_range <= $${nextParamNum}`);
      queryParams.push(parseInt(params.maxBudget));
      nextParamNum++;
    }
    
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : '';
    
    // Build ORDER BY clause safely
    const allowedSortColumns: Record<string, string> = {
      'views': 'view_count',
      'investments': 'investment_count',
      'title': 'p.title',
      'budget': 'p.budget_range',
      'date': 'p.created_at'
    };
    
    const sortColumn = allowedSortColumns[params.sortBy] || 'p.created_at';
    const validSortOrder = params.sortOrder?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const orderByClause = `ORDER BY ${sortColumn} ${validSortOrder}`;
    
    // Add pagination params
    queryParams.push(params.limit);
    queryParams.push(offset);
    
    // Execute query
    const pitches = await this.db.query(`
      SELECT 
        p.*,
        CONCAT(u.first_name, ' ', u.last_name) as creator_name,
        u.user_type as creator_type,
        COUNT(DISTINCT v.id) as view_count,
        COUNT(DISTINCT i.id) as investment_count
      FROM pitches p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN views v ON v.pitch_id = p.id
      LEFT JOIN investments i ON i.pitch_id = p.id
      ${whereClause}
      GROUP BY p.id, u.first_name, u.last_name, u.user_type
      ${orderByClause}
      LIMIT $${nextParamNum} OFFSET $${nextParamNum + 1}
    `, queryParams);
    
    // Get total count
    const countParams = queryParams.slice(0, -2); // Remove limit and offset
    const countResult = await this.db.query(`
      SELECT COUNT(*) as total
      FROM pitches p
      ${whereClause}
    `, countParams);
    
    const result = {
      pitches,
      page: params.page,
      limit: params.limit,
      total: parseInt(countResult[0]?.total || '0')
    };
    
    // Cache the result
    if (this.cache) {
      const ttl = params.search ? CacheTTL.SHORT : CacheTTL.MEDIUM; // Shorter TTL for searches
      await this.cache.set(cacheKey, result, { ttl });
      console.log('Cached pitches result with TTL:', ttl);
    }
    
    return result;
  }
  
  async invalidatePitchesCache(): Promise<void> {
    if (this.cache) {
      // Invalidate all pitch list caches
      await this.cache.invalidatePattern('pitches:list:*');
      await this.cache.delete(CacheKeys.trending());
      await this.cache.delete(CacheKeys.featured());
      console.log('Invalidated pitches cache');
    }
  }
}