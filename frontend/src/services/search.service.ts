// Search Service - Advanced search functionality with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { Pitch, User } from '../types/api';
import { config } from '../config';

// Search result types
export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  facets?: SearchFacets;
  suggestions?: string[];
  executionTime?: number;
}

export interface SearchFacets {
  genres?: { value: string; count: number }[];
  formats?: { value: string; count: number }[];
  status?: { value: string; count: number }[];
  userTypes?: { value: string; count: number }[];
  dateRanges?: { value: string; count: number }[];
  priceRanges?: { value: string; count: number }[];
}

export interface PitchSearchFilters {
  query?: string;
  genres?: string[];
  formats?: string[];
  status?: string[];
  minBudget?: number;
  maxBudget?: number;
  creatorId?: number;
  hasNDA?: boolean;
  hasVideo?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'relevance' | 'date' | 'views' | 'likes' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserSearchFilters {
  query?: string;
  userTypes?: ('creator' | 'investor' | 'production')[];
  verified?: boolean;
  hasCompany?: boolean;
  location?: string;
  specialties?: string[];
  minFollowers?: number;
  sortBy?: 'relevance' | 'followers' | 'joined' | 'activity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface GlobalSearchFilters {
  query: string;
  types?: ('pitches' | 'users' | 'messages' | 'all')[];
  limit?: number;
}

export interface SavedSearch {
  id: number;
  name: string;
  type: 'pitch' | 'user' | 'global';
  filters: PitchSearchFilters | UserSearchFilters | GlobalSearchFilters;
  notificationsEnabled: boolean;
  frequency?: 'instant' | 'daily' | 'weekly';
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  resultsCount?: number;
}

export interface SearchHistory {
  id: number;
  query: string;
  type: 'pitch' | 'user' | 'global';
  filters?: any;
  resultsCount: number;
  clickedResults?: number[];
  createdAt: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'pitch' | 'user' | 'category';
  metadata?: any;
  score?: number;
}

export class SearchService {
  // Search pitches
  static async searchPitches(filters: PitchSearchFilters): Promise<SearchResult<Pitch>> {
    const params = new URLSearchParams();
    if (filters.query) params.append('q', filters.query);
    if (filters.genres?.length) params.append('genres', filters.genres.join(','));
    if (filters.formats?.length) params.append('formats', filters.formats.join(','));
    if (filters.status?.length) params.append('status', filters.status.join(','));
    if (filters.minBudget) params.append('minBudget', filters.minBudget.toString());
    if (filters.maxBudget) params.append('maxBudget', filters.maxBudget.toString());
    if (filters.creatorId) params.append('creatorId', filters.creatorId.toString());
    if (filters.hasNDA !== undefined) params.append('hasNDA', filters.hasNDA.toString());
    if (filters.hasVideo !== undefined) params.append('hasVideo', filters.hasVideo.toString());
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<{ success: boolean; result: SearchResult<Pitch> }>(
      `/api/search/pitches?${params}`
    );

    if (!response.success || !response.data?.result) {
      throw new Error(response.error?.message || 'Failed to search pitches');
    }

    return response.data.result;
  }

  // Search users
  static async searchUsers(filters: UserSearchFilters): Promise<SearchResult<User>> {
    const params = new URLSearchParams();
    if (filters.query) params.append('q', filters.query);
    if (filters.userTypes?.length) params.append('userTypes', filters.userTypes.join(','));
    if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
    if (filters.hasCompany !== undefined) params.append('hasCompany', filters.hasCompany.toString());
    if (filters.location) params.append('location', filters.location);
    if (filters.specialties?.length) params.append('specialties', filters.specialties.join(','));
    if (filters.minFollowers) params.append('minFollowers', filters.minFollowers.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<{ success: boolean; result: SearchResult<User> }>(
      `/api/search/users?${params}`
    );

    if (!response.success || !response.data?.result) {
      throw new Error(response.error?.message || 'Failed to search users');
    }

    return response.data.result;
  }

  // Global search
  static async globalSearch(filters: GlobalSearchFilters): Promise<{
    pitches?: SearchResult<Pitch>;
    users?: SearchResult<User>;
    messages?: SearchResult<any>;
    total: number;
  }> {
    const params = new URLSearchParams();
    params.append('q', filters.query);
    if (filters.types?.length) params.append('types', filters.types.join(','));
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await apiClient.get<{ 
      success: boolean; 
      results: any 
    }>(`/api/search/global?${params}`);

    if (!response.success || !response.data?.results) {
      throw new Error(response.error?.message || 'Failed to perform global search');
    }

    return response.data.results;
  }

  // Get search suggestions
  static async getSuggestions(query: string, type?: 'pitch' | 'user' | 'all'): Promise<SearchSuggestion[]> {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);

    const response = await apiClient.get<{ success: boolean; suggestions: SearchSuggestion[] }>(
      `/api/search/suggestions?${params}`
    );

    if (!response.success) {
      return [];
    }

    return response.data?.suggestions || [];
  }

  // Get autocomplete
  static async getAutocomplete(query: string, field: string): Promise<string[]> {
    const params = new URLSearchParams({ q: query, field });

    const response = await apiClient.get<{ success: boolean; completions: string[] }>(
      `/api/search/autocomplete?${params}`
    );

    if (!response.success) {
      return [];
    }

    return response.data?.completions || [];
  }

  // Save search
  static async saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedSearch> {
    const response = await apiClient.post<{ success: boolean; search: SavedSearch }>(
      '/api/search/saved',
      search
    );

    if (!response.success || !response.data?.search) {
      throw new Error(response.error?.message || 'Failed to save search');
    }

    return response.data.search;
  }

  // Get saved searches
  static async getSavedSearches(): Promise<SavedSearch[]> {
    const response = await apiClient.get<{ success: boolean; searches: SavedSearch[] }>(
      '/api/search/saved'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch saved searches');
    }

    return response.data?.searches || [];
  }

  // Update saved search
  static async updateSavedSearch(
    searchId: number,
    updates: Partial<Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<SavedSearch> {
    const response = await apiClient.put<{ success: boolean; search: SavedSearch }>(
      `/api/search/saved/${searchId}`,
      updates
    );

    if (!response.success || !response.data?.search) {
      throw new Error(response.error?.message || 'Failed to update saved search');
    }

    return response.data.search;
  }

  // Delete saved search
  static async deleteSavedSearch(searchId: number): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      `/api/search/saved/${searchId}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete saved search');
    }
  }

  // Run saved search
  static async runSavedSearch(searchId: number): Promise<SearchResult<any>> {
    const response = await apiClient.get<{ success: boolean; result: SearchResult<any> }>(
      `/api/search/saved/${searchId}/run`
    );

    if (!response.success || !response.data?.result) {
      throw new Error(response.error?.message || 'Failed to run saved search');
    }

    return response.data.result;
  }

  // Get search history
  static async getSearchHistory(limit: number = 10): Promise<SearchHistory[]> {
    const response = await apiClient.get<{ success: boolean; history: SearchHistory[] }>(
      `/api/search/history?limit=${limit}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch search history');
    }

    return response.data?.history || [];
  }

  // Clear search history
  static async clearSearchHistory(): Promise<void> {
    const response = await apiClient.delete<{ success: boolean }>(
      '/api/search/history'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to clear search history');
    }
  }

  // Get trending searches
  static async getTrendingSearches(type?: 'pitch' | 'user' | 'all'): Promise<{
    query: string;
    count: number;
    trend: 'up' | 'down' | 'stable';
  }[]> {
    const params = new URLSearchParams();
    if (type) params.append('type', type);

    const response = await apiClient.get<{ success: boolean; trending: any[] }>(
      `/api/search/trending?${params}`
    );

    if (!response.success) {
      return [];
    }

    return response.data?.trending || [];
  }

  // Get related searches
  static async getRelatedSearches(query: string): Promise<string[]> {
    const response = await apiClient.get<{ success: boolean; related: string[] }>(
      `/api/search/related?q=${encodeURIComponent(query)}`
    );

    if (!response.success) {
      return [];
    }

    return response.data?.related || [];
  }

  // Advanced search with AI
  static async aiSearch(prompt: string): Promise<{
    interpretation: string;
    filters: any;
    results: SearchResult<any>;
    confidence: number;
  }> {
    const response = await apiClient.post<{ success: boolean; search: any }>(
      '/api/search/ai',
      { prompt }
    );

    if (!response.success || !response.data?.search) {
      throw new Error(response.error?.message || 'Failed to perform AI search');
    }

    return response.data.search;
  }

  // Export search results
  static async exportResults(
    searchType: 'pitch' | 'user',
    filters: any,
    format: 'csv' | 'pdf' | 'excel'
  ): Promise<Blob> {
    const response = await fetch(
      `${config.API_URL}/api/search/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ searchType, filters, format }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to export search results');
    }

    return response.blob();
  }

  // Get search filters metadata
  static async getFiltersMetadata(type: 'pitch' | 'user'): Promise<{
    genres?: string[];
    formats?: string[];
    userTypes?: string[];
    locations?: string[];
    specialties?: string[];
    budgetRanges?: { min: number; max: number; label: string }[];
  }> {
    const response = await apiClient.get<{ success: boolean; metadata: any }>(
      `/api/search/filters/${type}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch filters metadata');
    }

    return response.data?.metadata || {};
  }

  // Similar pitches
  static async getSimilarPitches(pitchId: number, limit: number = 5): Promise<Pitch[]> {
    const response = await apiClient.get<{ success: boolean; pitches: Pitch[] }>(
      `/api/search/similar/pitches/${pitchId}?limit=${limit}`
    );

    if (!response.success) {
      return [];
    }

    return response.data?.pitches || [];
  }

  // Similar users
  static async getSimilarUsers(userId: number, limit: number = 5): Promise<User[]> {
    const response = await apiClient.get<{ success: boolean; users: User[] }>(
      `/api/search/similar/users/${userId}?limit=${limit}`
    );

    if (!response.success) {
      return [];
    }

    return response.data?.users || [];
  }
}

// Export singleton instance
export const searchService = SearchService;