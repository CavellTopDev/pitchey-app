import { apiClient } from '../lib/api-client';

// Content API service with caching and fallback support
class ContentService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private isValidCache(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    return Date.now() - cached.timestamp < this.cacheTimeout;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private getCache(key: string): any | null {
    if (this.isValidCache(key)) {
      return this.cache.get(key)?.data || null;
    }
    return null;
  }

  async getHowItWorks() {
    const cacheKey = 'how-it-works';
    const cached = this.getCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await apiClient.get('/api/content/how-it-works');
      if (response.success && response.data) {
        this.setCache(cacheKey, response.data);
        return response;
      }
      throw new Error('API request failed');
    } catch (error) {
      console.warn('Failed to fetch how-it-works content from API, using fallback');
      return { success: false, error: 'API unavailable' };
    }
  }

  async getAbout() {
    const cacheKey = 'about';
    const cached = this.getCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await apiClient.get('/api/content/about');
      if (response.success && response.data) {
        this.setCache(cacheKey, response.data);
        return response;
      }
      throw new Error('API request failed');
    } catch (error) {
      console.warn('Failed to fetch about content from API, using fallback');
      return { success: false, error: 'API unavailable' };
    }
  }

  async getTeam() {
    const cacheKey = 'team';
    const cached = this.getCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await apiClient.get('/api/content/team');
      if (response.success && response.data) {
        this.setCache(cacheKey, response.data);
        return response;
      }
      throw new Error('API request failed');
    } catch (error) {
      console.warn('Failed to fetch team content from API, using fallback');
      return { success: false, error: 'API unavailable' };
    }
  }

  async getStats() {
    const cacheKey = 'stats';
    const cached = this.getCache(cacheKey);
    if (cached) return { success: true, data: cached };

    try {
      const response = await apiClient.get('/api/content/stats');
      if (response.success && response.data) {
        this.setCache(cacheKey, response.data);
        return response;
      }
      throw new Error('API request failed');
    } catch (error) {
      console.warn('Failed to fetch stats content from API, using fallback');
      return { success: false, error: 'API unavailable' };
    }
  }

  // Clear all cached content
  clearCache(): void {
    this.cache.clear();
  }

  // Clear specific cached content
  clearCacheItem(key: string): void {
    this.cache.delete(key);
  }
}

export const contentService = new ContentService();
export default contentService;