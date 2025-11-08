// Enhanced browse endpoint with proper multi-select filtering
import { db } from "../db/index.ts";
import { pitches, users } from "../db/schema.ts";
import { eq, and, or, desc, asc, sql, ilike, gte, lte } from "npm:drizzle-orm@0.35.3";
import { redisService } from "../services/redis-native.service.ts";

export async function handleEnhancedBrowse(url: URL) {
  try {
    // Parse query parameters
    const sortBy = url.searchParams.get('sort') || 'date';
    const order = url.searchParams.get('order') || 'desc';
    const genres = url.searchParams.getAll('genre');
    const formats = url.searchParams.getAll('format');
    const stages = url.searchParams.getAll('stage');
    const searchQuery = url.searchParams.get('q');
    const budgetMin = url.searchParams.get('budgetMin');
    const budgetMax = url.searchParams.get('budgetMax');
    const limit = parseInt(url.searchParams.get('limit') || '24');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    
    // Build cache key
    const cacheKey = redisService.generateKey(
      `pitches:browse:v2:${sortBy}:${order}:${genres.join(',')}:${formats.join(',')}:${stages.join(',')}:${searchQuery || ''}:${budgetMin || ''}:${budgetMax || ''}:${limit}:${offset}`
    );
    
    const result = await redisService.cached(
      cacheKey,
      async () => {
        // Start with base query
        let baseQuery = db
          .select({
            id: pitches.id,
            title: pitches.title,
            logline: pitches.logline,
            genre: pitches.genre,
            format: pitches.format,
            formatCategory: pitches.formatCategory,
            formatSubtype: pitches.formatSubtype,
            estimatedBudget: pitches.estimatedBudget,
            productionStage: pitches.productionStage,
            hasNDA: pitches.hasNDA,
            viewCount: pitches.viewCount,
            likeCount: pitches.likeCount,
            createdAt: pitches.createdAt,
            creatorId: users.id,
            creatorUsername: users.username,
            creatorCompanyName: users.companyName,
            creatorUserType: users.userType,
          })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id));
        
        // Build WHERE conditions
        const conditions: any[] = [eq(pitches.status, "published")];
        
        // Genre filter
        if (genres.length > 0) {
          conditions.push(sql`${pitches.genre} = ANY(${genres})`);
        }
        
        // Format filter
        if (formats.length > 0) {
          conditions.push(sql`${pitches.format} = ANY(${formats})`);
        }
        
        // Stage filter
        if (stages.length > 0) {
          conditions.push(sql`${pitches.productionStage} = ANY(${stages})`);
        }
        
        // Budget range filter
        if (budgetMin || budgetMax) {
          const minBudget = parseInt(budgetMin || '0');
          const maxBudget = parseInt(budgetMax || '999999999');
          conditions.push(gte(pitches.estimatedBudget, minBudget));
          conditions.push(lte(pitches.estimatedBudget, maxBudget));
        }
        
        // Search filter
        if (searchQuery) {
          const searchConditions = [
            ilike(pitches.title, `%${searchQuery}%`),
            ilike(pitches.logline, `%${searchQuery}%`),
          ];
          
          // Only add synopsis search if column exists
          if (pitches.synopsis) {
            searchConditions.push(ilike(pitches.synopsis, `%${searchQuery}%`));
          }
          
          conditions.push(or(...searchConditions));
        }
        
        // Apply WHERE conditions
        baseQuery = baseQuery.where(and(...conditions));
        
        // Apply sorting
        switch (sortBy) {
          case 'alphabetical':
            baseQuery = order === 'asc' 
              ? baseQuery.orderBy(asc(pitches.title))
              : baseQuery.orderBy(desc(pitches.title));
            break;
          case 'date':
            baseQuery = order === 'asc' 
              ? baseQuery.orderBy(asc(pitches.createdAt))
              : baseQuery.orderBy(desc(pitches.createdAt));
            break;
          case 'budget':
            baseQuery = order === 'asc' 
              ? baseQuery.orderBy(asc(pitches.estimatedBudget))
              : baseQuery.orderBy(desc(pitches.estimatedBudget));
            break;
          case 'views':
            baseQuery = order === 'asc' 
              ? baseQuery.orderBy(asc(pitches.viewCount))
              : baseQuery.orderBy(desc(pitches.viewCount));
            break;
          case 'likes':
            baseQuery = order === 'asc' 
              ? baseQuery.orderBy(asc(pitches.likeCount))
              : baseQuery.orderBy(desc(pitches.likeCount));
            break;
        }
        
        // Get total count
        const countQuery = db
          .select({ count: sql<number>`count(*)::int` })
          .from(pitches)
          .leftJoin(users, eq(pitches.userId, users.id))
          .where(and(...conditions));
        
        const [{ count: total }] = await countQuery;
        
        // Apply pagination
        baseQuery = baseQuery.limit(limit).offset(offset);
        
        // Execute query
        const results = await baseQuery;
        
        // Transform results
        const transformedPitches = results.map(row => ({
          id: row.id,
          title: row.title,
          logline: row.logline,
          genre: row.genre,
          format: row.format,
          formatCategory: row.formatCategory,
          formatSubtype: row.formatSubtype,
          estimatedBudget: row.estimatedBudget,
          productionStage: row.productionStage,
          hasNDA: row.hasNDA,
          viewCount: row.viewCount,
          likeCount: row.likeCount,
          createdAt: row.createdAt,
          creator: row.creatorId ? {
            id: row.creatorId,
            username: row.creatorUsername,
            companyName: row.creatorCompanyName,
            userType: row.creatorUserType,
          } : null,
        }));
        
        return {
          pitches: transformedPitches,
          pagination: {
            total,
            page: Math.floor(offset / limit) + 1,
            totalPages: Math.ceil(total / limit),
            limit,
            offset
          },
          filters: {
            genres,
            formats,
            stages,
            searchQuery,
            budgetMin: parseInt(budgetMin || '0'),
            budgetMax: parseInt(budgetMax || '999999999')
          }
        };
      },
      300 // 5 minutes cache
    );
    
    return {
      success: true,
      ...result,
      message: "Enhanced browse pitches retrieved successfully",
      cached: await redisService.exists(cacheKey)
    };
  } catch (error) {
    console.error("Error in enhanced browse v2:", error);
    throw error;
  }
}