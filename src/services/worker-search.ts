/**
 * Search and Filtering Service for Cloudflare Workers Free Plan
 * Implements efficient in-memory search without external dependencies
 */

export interface SearchOptions {
  query?: string;
  genre?: string;
  status?: string;
  userType?: string;
  minBudget?: number;
  maxBudget?: number;
  sortBy?: 'relevance' | 'date' | 'views' | 'rating';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  facets?: Record<string, number>;
}

/**
 * Simple text search implementation
 */
export class TextSearcher {
  /**
   * Tokenize text for searching
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  /**
   * Calculate similarity score between query and text
   */
  private calculateScore(query: string, text: string): number {
    const queryTokens = this.tokenize(query);
    const textTokens = this.tokenize(text);
    
    if (queryTokens.length === 0) return 0;
    
    let matches = 0;
    let exactMatches = 0;
    
    for (const queryToken of queryTokens) {
      // Check for exact matches
      if (textTokens.includes(queryToken)) {
        exactMatches++;
        matches++;
      } else {
        // Check for partial matches (prefix matching)
        const partialMatch = textTokens.some(textToken => 
          textToken.startsWith(queryToken) || queryToken.startsWith(textToken)
        );
        if (partialMatch) {
          matches += 0.5;
        }
      }
    }
    
    // Calculate score with exact matches weighted higher
    const score = (exactMatches * 2 + matches) / (queryTokens.length * 3);
    
    // Boost score if query appears as a phrase
    if (text.toLowerCase().includes(query.toLowerCase())) {
      return Math.min(1, score + 0.3);
    }
    
    return score;
  }

  /**
   * Search items by text query
   */
  search<T extends Record<string, any>>(
    items: T[],
    query: string,
    fields: (keyof T)[]
  ): Array<T & { _score: number }> {
    if (!query) {
      return items.map(item => ({ ...item, _score: 1 }));
    }
    
    const results = items.map(item => {
      let maxScore = 0;
      
      for (const field of fields) {
        const value = item[field];
        if (typeof value === 'string') {
          const score = this.calculateScore(query, value);
          maxScore = Math.max(maxScore, score);
        } else if (Array.isArray(value)) {
          // Handle array fields (e.g., tags)
          for (const v of value) {
            if (typeof v === 'string') {
              const score = this.calculateScore(query, v);
              maxScore = Math.max(maxScore, score);
            }
          }
        }
      }
      
      return { ...item, _score: maxScore };
    });
    
    // Filter out items with no matches
    return results.filter(item => item._score > 0);
  }
}

/**
 * Faceted search implementation
 */
export class FacetedSearch {
  /**
   * Build facets from items
   */
  buildFacets<T extends Record<string, any>>(
    items: T[],
    fields: (keyof T)[]
  ): Record<string, Record<string, number>> {
    const facets: Record<string, Record<string, number>> = {};
    
    for (const field of fields) {
      facets[field as string] = {};
      
      for (const item of items) {
        const value = item[field];
        if (value !== undefined && value !== null) {
          const key = String(value);
          facets[field as string][key] = (facets[field as string][key] || 0) + 1;
        }
      }
    }
    
    return facets;
  }

  /**
   * Filter items by facets
   */
  filterByFacets<T extends Record<string, any>>(
    items: T[],
    filters: Partial<Record<keyof T, any>>
  ): T[] {
    return items.filter(item => {
      for (const [field, value] of Object.entries(filters)) {
        if (value === undefined || value === null) continue;
        
        const itemValue = item[field as keyof T];
        
        // Handle array values (check if value is in array)
        if (Array.isArray(itemValue)) {
          if (!itemValue.includes(value)) return false;
        }
        // Handle range filters
        else if (typeof value === 'object' && value !== null) {
          if ('min' in value && itemValue < value.min) return false;
          if ('max' in value && itemValue > value.max) return false;
        }
        // Handle exact match
        else if (itemValue !== value) {
          return false;
        }
      }
      return true;
    });
  }
}

/**
 * Main search service
 */
export class WorkerSearchService {
  private textSearcher = new TextSearcher();
  private facetedSearch = new FacetedSearch();

  /**
   * Search pitches with filters
   */
  searchPitches(
    pitches: any[],
    options: SearchOptions
  ): SearchResult<any> {
    let results = [...pitches];
    
    // Apply text search
    if (options.query) {
      const searchResults = this.textSearcher.search(
        results,
        options.query,
        ['title', 'logline', 'synopsis', 'genre', 'themes']
      );
      results = searchResults.sort((a, b) => b._score - a._score);
    }
    
    // Apply filters
    const filters: any = {};
    if (options.genre) filters.genre = options.genre;
    if (options.status) filters.status = options.status;
    
    // Budget range filter
    if (options.minBudget !== undefined || options.maxBudget !== undefined) {
      results = results.filter(pitch => {
        if (options.minBudget && pitch.budgetRange < options.minBudget) return false;
        if (options.maxBudget && pitch.budgetRange > options.maxBudget) return false;
        return true;
      });
    }
    
    if (Object.keys(filters).length > 0) {
      results = this.facetedSearch.filterByFacets(results, filters);
    }
    
    // Apply sorting
    if (options.sortBy && options.sortBy !== 'relevance') {
      results.sort((a, b) => {
        let aVal, bVal;
        
        switch (options.sortBy) {
          case 'date':
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
            break;
          case 'views':
            aVal = a.viewCount || 0;
            bVal = b.viewCount || 0;
            break;
          case 'rating':
            aVal = a.rating || 0;
            bVal = b.rating || 0;
            break;
          default:
            return 0;
        }
        
        return options.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    
    // Build facets from filtered results
    const facets = this.facetedSearch.buildFacets(results, ['genre', 'status']);
    
    // Apply pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const paginatedResults = results.slice(offset, offset + limit);
    
    return {
      items: paginatedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
      facets
    };
  }

  /**
   * Search users with filters
   */
  searchUsers(
    users: any[],
    options: SearchOptions
  ): SearchResult<any> {
    let results = [...users];
    
    // Apply text search
    if (options.query) {
      const searchResults = this.textSearcher.search(
        results,
        options.query,
        ['name', 'bio', 'company', 'expertise']
      );
      results = searchResults.sort((a, b) => b._score - a._score);
    }
    
    // Apply user type filter
    if (options.userType) {
      results = results.filter(user => user.userType === options.userType);
    }
    
    // Apply sorting
    if (options.sortBy && options.sortBy !== 'relevance') {
      results.sort((a, b) => {
        let aVal, bVal;
        
        switch (options.sortBy) {
          case 'date':
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
            break;
          case 'rating':
            aVal = a.rating || 0;
            bVal = b.rating || 0;
            break;
          default:
            return 0;
        }
        
        return options.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }
    
    // Build facets
    const facets = this.facetedSearch.buildFacets(results, ['userType']);
    
    // Apply pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const paginatedResults = results.slice(offset, offset + limit);
    
    return {
      items: paginatedResults,
      total: results.length,
      hasMore: offset + limit < results.length,
      facets
    };
  }

  /**
   * Get autocomplete suggestions
   */
  getAutocompleteSuggestions(
    items: any[],
    query: string,
    field: string,
    limit: number = 10
  ): string[] {
    if (!query || query.length < 2) return [];
    
    const suggestions = new Set<string>();
    const lowerQuery = query.toLowerCase();
    
    for (const item of items) {
      const value = item[field];
      if (typeof value === 'string') {
        const lowerValue = value.toLowerCase();
        if (lowerValue.includes(lowerQuery)) {
          suggestions.add(value);
        }
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string') {
            const lowerV = v.toLowerCase();
            if (lowerV.includes(lowerQuery)) {
              suggestions.add(v);
            }
          }
        }
      }
      
      if (suggestions.size >= limit) break;
    }
    
    return Array.from(suggestions);
  }

  /**
   * Get trending items based on recent activity
   */
  getTrending<T extends { viewCount?: number; createdAt: string }>(
    items: T[],
    limit: number = 10,
    timeWindowDays: number = 7
  ): T[] {
    const now = Date.now();
    const windowMs = timeWindowDays * 24 * 60 * 60 * 1000;
    
    // Filter recent items and calculate trending score
    const scoredItems = items
      .filter(item => {
        const createdAt = new Date(item.createdAt).getTime();
        return now - createdAt <= windowMs;
      })
      .map(item => {
        const age = now - new Date(item.createdAt).getTime();
        const ageInDays = age / (24 * 60 * 60 * 1000);
        const views = item.viewCount || 0;
        
        // Trending score: views / (age + 1) to favor newer items with views
        const score = views / (ageInDays + 1);
        
        return { item, score };
      });
    
    // Sort by trending score and return top items
    return scoredItems
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ item }) => item);
  }

  /**
   * Get related items based on similarity
   */
  getRelated<T extends Record<string, any>>(
    item: T,
    allItems: T[],
    fields: (keyof T)[],
    limit: number = 5
  ): T[] {
    // Build a query from the item's fields
    const queryParts: string[] = [];
    
    for (const field of fields) {
      const value = item[field];
      if (typeof value === 'string') {
        queryParts.push(value);
      } else if (Array.isArray(value)) {
        queryParts.push(...value.filter(v => typeof v === 'string'));
      }
    }
    
    const query = queryParts.join(' ');
    
    // Search for similar items
    const searchResults = this.textSearcher.search(
      allItems.filter(i => i !== item),
      query,
      fields
    );
    
    // Return top matches
    return searchResults
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, ...item }) => item as T);
  }
}

// Export singleton instance
export const searchService = new WorkerSearchService();