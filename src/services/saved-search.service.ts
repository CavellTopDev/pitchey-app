/**
 * Saved Search Service
 * Manages saved search queries, alerts, and automated search execution
 */

import { sql } from '../lib/db';
import { redis } from '../lib/redis';

export interface SavedSearch {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  search_query: string;
  filters: any;
  is_public: boolean;
  notify_on_results: boolean;
  alert_frequency: 'immediate' | 'daily' | 'weekly' | 'never';
  last_executed?: Date;
  last_result_count: number;
  use_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface SearchAlert {
  id: number;
  saved_search_id: number;
  user_id: number;
  alert_type: 'new_results' | 'trending' | 'price_change' | 'status_update';
  threshold_value?: number;
  is_active: boolean;
  last_triggered?: Date;
  created_at: Date;
}

export interface SavedSearchExecution {
  id: number;
  saved_search_id: number;
  executed_at: Date;
  result_count: number;
  new_results_count: number;
  execution_time_ms: number;
  status: 'success' | 'error';
  error_message?: string;
}

export interface SavedSearchCreateData {
  name: string;
  description?: string;
  search_query: string;
  filters?: any;
  is_public?: boolean;
  notify_on_results?: boolean;
  alert_frequency?: 'immediate' | 'daily' | 'weekly' | 'never';
}

export interface SavedSearchUpdateData {
  name?: string;
  description?: string;
  search_query?: string;
  filters?: any;
  is_public?: boolean;
  notify_on_results?: boolean;
  alert_frequency?: 'immediate' | 'daily' | 'weekly' | 'never';
}

export class SavedSearchService {
  private static instance: SavedSearchService;
  private cachePrefix = 'saved_search:';
  private cacheTTL = 1800; // 30 minutes

  private constructor() {}

  public static getInstance(): SavedSearchService {
    if (!SavedSearchService.instance) {
      SavedSearchService.instance = new SavedSearchService();
    }
    return SavedSearchService.instance;
  }

  /**
   * Create a new saved search
   */
  async createSavedSearch(userId: number, searchData: SavedSearchCreateData): Promise<SavedSearch> {
    try {
      const result = await sql`
        INSERT INTO saved_searches (
          user_id,
          name,
          description,
          search_query,
          filters,
          is_public,
          notify_on_results,
          alert_frequency,
          last_result_count,
          use_count,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 0, 0, NOW(), NOW()
        )
        RETURNING *
      `;

      const savedSearch = result[0] as SavedSearch;

      // Create default alert if notifications are enabled
      if (savedSearch.notify_on_results) {
        await this.createSearchAlert(savedSearch.id, userId, 'new_results');
      }

      // Clear user's saved searches cache
      await this.clearUserCache(userId);

      return savedSearch;
    } catch (error) {
      console.error('Error creating saved search:', error);
      throw new Error(`Failed to create saved search: ${error.message}`);
    }
  }

  /**
   * Get saved searches for a user
   */
  async getUserSavedSearches(userId: number, includePublic: boolean = false): Promise<SavedSearch[]> {
    const cacheKey = `${this.cachePrefix}user:${userId}:${includePublic}`;

    try {
      // Try cache first
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for user saved searches:', error);
    }

    try {
      let searches: SavedSearch[];

      if (includePublic) {
        searches = await sql`
          SELECT * FROM saved_searches
          WHERE user_id = $1 OR (is_public = true AND user_id != $1)
          ORDER BY use_count DESC, updated_at DESC
        ` as SavedSearch[];
      } else {
        searches = await sql`
          SELECT * FROM saved_searches
          WHERE user_id = $1
          ORDER BY use_count DESC, updated_at DESC
        ` as SavedSearch[];
      }

      // Cache the results
      try {
        await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(searches));
      } catch (error) {
        console.warn('Failed to cache user saved searches:', error);
      }

      return searches;
    } catch (error) {
      console.error('Error fetching user saved searches:', error);
      return [];
    }
  }

  /**
   * Get a specific saved search by ID
   */
  async getSavedSearchById(searchId: number, userId?: number): Promise<SavedSearch | null> {
    try {
      let search: SavedSearch[];

      if (userId) {
        // User can access their own searches or public searches
        search = await sql`
          SELECT * FROM saved_searches
          WHERE id = $1 AND (user_id = $2 OR is_public = true)
        ` as SavedSearch[];
      } else {
        search = await sql`
          SELECT * FROM saved_searches
          WHERE id = $1
        ` as SavedSearch[];
      }

      return search[0] || null;
    } catch (error) {
      console.error('Error fetching saved search by ID:', error);
      return null;
    }
  }

  /**
   * Update a saved search
   */
  async updateSavedSearch(
    searchId: number,
    userId: number,
    updateData: SavedSearchUpdateData
  ): Promise<SavedSearch | null> {
    try {
      const result = await sql`
        UPDATE saved_searches 
        SET 
          name = COALESCE($3, name),
          description = COALESCE($4, description),
          search_query = COALESCE($5, search_query),
          filters = COALESCE($6, filters),
          is_public = COALESCE($7, is_public),
          notify_on_results = COALESCE($8, notify_on_results),
          alert_frequency = COALESCE($9, alert_frequency),
          updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;

      if (result.length === 0) {
        return null;
      }

      const updatedSearch = result[0] as SavedSearch;

      // Update alerts if notification settings changed
      if (updateData.notify_on_results !== undefined || updateData.alert_frequency !== undefined) {
        await this.updateSearchAlerts(searchId, updatedSearch);
      }

      // Clear caches
      await this.clearUserCache(userId);

      return updatedSearch;
    } catch (error) {
      console.error('Error updating saved search:', error);
      throw new Error(`Failed to update saved search: ${error.message}`);
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId: number, userId: number): Promise<boolean> {
    try {
      // Delete associated alerts first
      await sql`
        DELETE FROM search_alerts
        WHERE saved_search_id = $1 AND user_id = $2
      `;

      // Delete execution history
      await sql`
        DELETE FROM saved_search_executions
        WHERE saved_search_id = $1
      `;

      // Delete the saved search
      const result = await sql`
        DELETE FROM saved_searches
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `;

      if (result.length === 0) {
        return false;
      }

      // Clear cache
      await this.clearUserCache(userId);

      return true;
    } catch (error) {
      console.error('Error deleting saved search:', error);
      return false;
    }
  }

  /**
   * Execute a saved search and track usage
   */
  async executeSavedSearch(searchId: number, userId?: number): Promise<{
    search: SavedSearch;
    results: any[];
    execution: SavedSearchExecution;
  }> {
    const startTime = Date.now();
    let search: SavedSearch | null = null;
    let execution: SavedSearchExecution;

    try {
      // Get the saved search
      search = await this.getSavedSearchById(searchId, userId);
      if (!search) {
        throw new Error('Saved search not found or access denied');
      }

      // Execute the search (you would integrate with your main search service here)
      const results = await this.performSearch(search.search_query, search.filters);
      const executionTime = Date.now() - startTime;

      // Count new results (simplified logic)
      const newResultsCount = Math.max(0, results.length - search.last_result_count);

      // Record execution
      execution = await this.recordExecution(searchId, results.length, newResultsCount, executionTime, 'success');

      // Update search statistics
      await this.updateSearchStats(searchId, results.length);

      // Check if alerts should be triggered
      if (newResultsCount > 0 && search.notify_on_results) {
        await this.triggerSearchAlerts(search, newResultsCount);
      }

      return { search, results, execution };
    } catch (error) {
      console.error('Error executing saved search:', error);
      
      // Record failed execution
      if (search) {
        execution = await this.recordExecution(
          searchId, 
          0, 
          0, 
          Date.now() - startTime, 
          'error', 
          error.message
        );
      }

      throw new Error(`Failed to execute saved search: ${error.message}`);
    }
  }

  /**
   * Create a search alert
   */
  async createSearchAlert(
    savedSearchId: number,
    userId: number,
    alertType: 'new_results' | 'trending' | 'price_change' | 'status_update',
    thresholdValue?: number
  ): Promise<SearchAlert> {
    try {
      const result = await sql`
        INSERT INTO search_alerts (
          saved_search_id,
          user_id,
          alert_type,
          threshold_value,
          is_active,
          created_at
        ) VALUES (
          $1, $2, $3, $4, true, NOW()
        )
        RETURNING *
      `;

      return result[0] as SearchAlert;
    } catch (error) {
      console.error('Error creating search alert:', error);
      throw new Error(`Failed to create search alert: ${error.message}`);
    }
  }

  /**
   * Get popular public saved searches
   */
  async getPopularSavedSearches(limit: number = 10): Promise<SavedSearch[]> {
    const cacheKey = `${this.cachePrefix}popular:${limit}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache miss for popular saved searches:', error);
    }

    try {
      const searches = await sql`
        SELECT 
          ss.*,
          u.email as creator_email,
          COUNT(sse.id) as execution_count
        FROM saved_searches ss
        LEFT JOIN users u ON u.id = ss.user_id
        LEFT JOIN saved_search_executions sse ON sse.saved_search_id = ss.id
        WHERE ss.is_public = true
        GROUP BY ss.id, u.email
        ORDER BY ss.use_count DESC, execution_count DESC
        LIMIT $1
      ` as (SavedSearch & { creator_email: string; execution_count: number })[];

      // Cache the results
      try {
        await redis.setex(cacheKey, this.cacheTTL * 2, JSON.stringify(searches)); // Longer cache for popular
      } catch (error) {
        console.warn('Failed to cache popular saved searches:', error);
      }

      return searches;
    } catch (error) {
      console.error('Error fetching popular saved searches:', error);
      return [];
    }
  }

  /**
   * Perform the actual search (integrate with your main search service)
   */
  private async performSearch(query: string, filters: any): Promise<any[]> {
    try {
      // This would integrate with your main search service
      // For now, return mock results
      const results = await sql`
        SELECT 
          p.*,
          ts_rank_cd(p.search_vector, plainto_tsquery($1)) as relevance_score
        FROM pitches p
        WHERE p.search_vector @@ plainto_tsquery($1)
        ORDER BY relevance_score DESC
        LIMIT 50
      `;

      return results;
    } catch (error) {
      console.error('Error performing search:', error);
      return [];
    }
  }

  /**
   * Record search execution
   */
  private async recordExecution(
    savedSearchId: number,
    resultCount: number,
    newResultsCount: number,
    executionTimeMs: number,
    status: 'success' | 'error',
    errorMessage?: string
  ): Promise<SavedSearchExecution> {
    try {
      const result = await sql`
        INSERT INTO saved_search_executions (
          saved_search_id,
          executed_at,
          result_count,
          new_results_count,
          execution_time_ms,
          status,
          error_message
        ) VALUES (
          $1, NOW(), $2, $3, $4, $5, $6
        )
        RETURNING *
      `;

      return result[0] as SavedSearchExecution;
    } catch (error) {
      console.error('Error recording search execution:', error);
      throw error;
    }
  }

  /**
   * Update search statistics
   */
  private async updateSearchStats(searchId: number, resultCount: number): Promise<void> {
    try {
      await sql`
        UPDATE saved_searches
        SET 
          use_count = use_count + 1,
          last_executed = NOW(),
          last_result_count = $2
        WHERE id = $1
      `;
    } catch (error) {
      console.error('Error updating search stats:', error);
    }
  }

  /**
   * Update search alerts based on search settings
   */
  private async updateSearchAlerts(searchId: number, search: SavedSearch): Promise<void> {
    try {
      if (search.notify_on_results) {
        // Ensure alert exists
        const existingAlert = await sql`
          SELECT id FROM search_alerts
          WHERE saved_search_id = $1 AND alert_type = 'new_results'
        `;

        if (existingAlert.length === 0) {
          await this.createSearchAlert(searchId, search.user_id, 'new_results');
        } else {
          // Update existing alert
          await sql`
            UPDATE search_alerts
            SET is_active = true
            WHERE saved_search_id = $1 AND alert_type = 'new_results'
          `;
        }
      } else {
        // Disable alerts
        await sql`
          UPDATE search_alerts
          SET is_active = false
          WHERE saved_search_id = $1
        `;
      }
    } catch (error) {
      console.error('Error updating search alerts:', error);
    }
  }

  /**
   * Trigger search alerts when conditions are met
   */
  private async triggerSearchAlerts(search: SavedSearch, newResultsCount: number): Promise<void> {
    try {
      // This would integrate with your notification system
      console.log(`Triggering alert for saved search ${search.id}: ${newResultsCount} new results`);
      
      // Update last triggered time
      await sql`
        UPDATE search_alerts
        SET last_triggered = NOW()
        WHERE saved_search_id = $1 AND is_active = true
      `;
    } catch (error) {
      console.error('Error triggering search alerts:', error);
    }
  }

  /**
   * Clear user cache
   */
  private async clearUserCache(userId: number): Promise<void> {
    try {
      const pattern = `${this.cachePrefix}user:${userId}:*`;
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.warn('Failed to clear user saved searches cache:', error);
    }
  }

  /**
   * Cleanup old execution records
   */
  async cleanupOldExecutions(daysToKeep: number = 30): Promise<number> {
    try {
      const result = await sql`
        DELETE FROM saved_search_executions
        WHERE executed_at < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING id
      `;

      console.log(`Cleaned up ${result.length} old search executions`);
      return result.length;
    } catch (error) {
      console.error('Error cleaning up old executions:', error);
      return 0;
    }
  }
}

export const savedSearchService = SavedSearchService.getInstance();