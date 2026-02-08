// Search Service - Advanced search functionality with Drizzle integration
import { apiClient } from '../lib/api-client';
import type { Pitch, User } from '../types/api';

const isDev = import.meta.env.MODE === 'development';
const API_BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? (isDev ? 'http://localhost:8001' : '');

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
  filters?: Record<string, unknown>;
  resultsCount: number;
  clickedResults?: number[];
  createdAt: string;
}

export interface SearchSuggestion {
  text: string;
  type: 'query' | 'pitch' | 'user' | 'category';
  metadata?: Record<string, unknown>;
  score?: number;
}

// API response types
interface PitchSearchResponseData {
  result: SearchResult<Pitch>;
}

interface UserSearchResponseData {
  result: SearchResult<User>;
}

interface MessageSearchResult {
  id: number;
  content: string;
  createdAt: string;
  senderId: number;
  receiverId: number;
}

interface GlobalSearchResponseData {
  pitches?: SearchResult<Pitch>;
  users?: SearchResult<User>;
  messages?: SearchResult<MessageSearchResult>;
  total: number;
}

interface SuggestionResponseData {
  suggestions: SearchSuggestion[];
}

interface AutocompleteResponseData {
  completions: string[];
}

interface SavedSearchResponseData {
  search: SavedSearch;
}

interface SavedSearchesResponseData {
  searches: SavedSearch[];
}

interface SearchHistoryResponseData {
  history: SearchHistory[];
}

interface TrendingItem {
  query: string;
  count: number;
  trend: 'up' | 'down' | 'stable';
}

interface TrendingResponseData {
  trending: TrendingItem[];
}

interface RelatedResponseData {
  related: string[];
}

interface AISearchResult {
  interpretation: string;
  filters: Record<string, unknown>;
  results: SearchResult<Pitch | User>;
  confidence: number;
}

interface AISearchResponseData {
  search: AISearchResult;
}

interface FiltersMetadata {
  genres?: string[];
  formats?: string[];
  userTypes?: string[];
  locations?: string[];
  specialties?: string[];
  budgetRanges?: { min: number; max: number; label: string }[];
}

interface FiltersMetadataResponseData {
  metadata: FiltersMetadata;
}

interface PitchesResponseData {
  pitches: Pitch[];
}

interface UsersResponseData {
  users: User[];
}

// Helper function to extract error message
function getErrorMessage(error: { message: string } | string | undefined, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    return error.message;
  }
  return error ?? fallback;
}

export class SearchService {
  // Search pitches
  static async searchPitches(filters: PitchSearchFilters): Promise<SearchResult<Pitch>> {
    const params = new URLSearchParams();
    if (filters.query !== undefined && filters.query !== '') params.append('q', filters.query);
    if (filters.genres !== undefined && filters.genres.length > 0) params.append('genres', filters.genres.join(','));
    if (filters.formats !== undefined && filters.formats.length > 0) params.append('formats', filters.formats.join(','));
    if (filters.status !== undefined && filters.status.length > 0) params.append('status', filters.status.join(','));
    if (filters.minBudget !== undefined && filters.minBudget !== 0) params.append('minBudget', filters.minBudget.toString());
    if (filters.maxBudget !== undefined && filters.maxBudget !== 0) params.append('maxBudget', filters.maxBudget.toString());
    if (filters.creatorId !== undefined && filters.creatorId !== 0) params.append('creatorId', filters.creatorId.toString());
    if (filters.hasNDA !== undefined) params.append('hasNDA', filters.hasNDA.toString());
    if (filters.hasVideo !== undefined) params.append('hasVideo', filters.hasVideo.toString());
    if (filters.dateFrom !== undefined && filters.dateFrom !== '') params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo !== undefined && filters.dateTo !== '') params.append('dateTo', filters.dateTo);
    if (filters.sortBy !== undefined && filters.sortBy !== '') params.append('sortBy', filters.sortBy);
    if (filters.sortOrder !== undefined && filters.sortOrder !== '') params.append('sortOrder', filters.sortOrder);
    if (filters.page !== undefined && filters.page !== 0) params.append('page', filters.page.toString());
    if (filters.limit !== undefined && filters.limit !== 0) params.append('limit', filters.limit.toString());

    params.append('type', 'pitches');
    const response = await apiClient.get<PitchSearchResponseData>(
      `/api/search?${params.toString()}`
    );

    if (response.success !== true || response.data?.result === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to search pitches'));
    }

    return response.data.result;
  }

  // Search users
  static async searchUsers(filters: UserSearchFilters): Promise<SearchResult<User>> {
    const params = new URLSearchParams();
    if (filters.query !== undefined && filters.query !== '') params.append('q', filters.query);
    if (filters.userTypes !== undefined && filters.userTypes.length > 0) params.append('userTypes', filters.userTypes.join(','));
    if (filters.verified !== undefined) params.append('verified', filters.verified.toString());
    if (filters.hasCompany !== undefined) params.append('hasCompany', filters.hasCompany.toString());
    if (filters.location !== undefined && filters.location !== '') params.append('location', filters.location);
    if (filters.specialties !== undefined && filters.specialties.length > 0) params.append('specialties', filters.specialties.join(','));
    if (filters.minFollowers !== undefined && filters.minFollowers !== 0) params.append('minFollowers', filters.minFollowers.toString());
    if (filters.sortBy !== undefined && filters.sortBy !== '') params.append('sortBy', filters.sortBy);
    if (filters.sortOrder !== undefined && filters.sortOrder !== '') params.append('sortOrder', filters.sortOrder);
    if (filters.page !== undefined && filters.page !== 0) params.append('page', filters.page.toString());
    if (filters.limit !== undefined && filters.limit !== 0) params.append('limit', filters.limit.toString());

    params.append('type', 'users');
    const response = await apiClient.get<UserSearchResponseData>(
      `/api/search?${params.toString()}`
    );

    if (response.success !== true || response.data?.result === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to search users'));
    }

    return response.data.result;
  }

  // Global search
  static async globalSearch(filters: GlobalSearchFilters): Promise<GlobalSearchResponseData> {
    const params = new URLSearchParams();
    params.append('q', filters.query);
    if (filters.types !== undefined && filters.types.length > 0) params.append('types', filters.types.join(','));
    if (filters.limit !== undefined && filters.limit !== 0) params.append('limit', filters.limit.toString());

    params.append('type', 'all');
    const response = await apiClient.get<{ results: GlobalSearchResponseData }>(
      `/api/search?${params.toString()}`
    );

    if (response.success !== true || response.data?.results === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to perform global search'));
    }

    return response.data.results;
  }

  // Get search suggestions
  static async getSuggestions(query: string, type?: 'pitch' | 'user' | 'all'): Promise<SearchSuggestion[]> {
    const params = new URLSearchParams({ q: query });
    if (type !== undefined) params.append('type', type);

    const response = await apiClient.get<SuggestionResponseData>(
      `/api/search/autocomplete?${params.toString()}`
    );

    if (response.success !== true) {
      return [];
    }

    return response.data?.suggestions ?? [];
  }

  // Get autocomplete
  static async getAutocomplete(query: string, field: string): Promise<string[]> {
    const params = new URLSearchParams({ q: query, field });

    const response = await apiClient.get<AutocompleteResponseData>(
      `/api/search/autocomplete?${params.toString()}`
    );

    if (response.success !== true) {
      return [];
    }

    return response.data?.completions ?? [];
  }

  // Save search
  static async saveSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>): Promise<SavedSearch> {
    const response = await apiClient.post<SavedSearchResponseData>(
      '/api/search/saved',
      search
    );

    if (response.success !== true || response.data?.search === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to save search'));
    }

    return response.data.search;
  }

  // Get saved searches
  static async getSavedSearches(): Promise<SavedSearch[]> {
    const response = await apiClient.get<SavedSearchesResponseData>(
      '/api/search/saved'
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch saved searches'));
    }

    return response.data?.searches ?? [];
  }

  // Update saved search
  static async updateSavedSearch(
    searchId: number,
    updates: Partial<Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<SavedSearch> {
    const response = await apiClient.put<SavedSearchResponseData>(
      `/api/search/saved/${searchId.toString()}`,
      updates
    );

    if (response.success !== true || response.data?.search === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to update saved search'));
    }

    return response.data.search;
  }

  // Delete saved search
  static async deleteSavedSearch(searchId: number): Promise<void> {
    const response = await apiClient.delete<Record<string, unknown>>(
      `/api/search/saved/${searchId.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to delete saved search'));
    }
  }

  // Run saved search
  static async runSavedSearch(searchId: number): Promise<SearchResult<Pitch | User>> {
    const response = await apiClient.get<{ result: SearchResult<Pitch | User> }>(
      `/api/search/saved/${searchId.toString()}/run`
    );

    if (response.success !== true || response.data?.result === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to run saved search'));
    }

    return response.data.result;
  }

  // Get search history
  static async getSearchHistory(limit: number = 10): Promise<SearchHistory[]> {
    const response = await apiClient.get<SearchHistoryResponseData>(
      `/api/search/history?limit=${limit.toString()}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch search history'));
    }

    return response.data?.history ?? [];
  }

  // Clear search history
  static async clearSearchHistory(): Promise<void> {
    const response = await apiClient.delete<Record<string, unknown>>(
      '/api/search/history'
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to clear search history'));
    }
  }

  // Get trending searches
  static async getTrendingSearches(type?: 'pitch' | 'user' | 'all'): Promise<TrendingItem[]> {
    const params = new URLSearchParams();
    if (type !== undefined) params.append('type', type);

    const response = await apiClient.get<TrendingResponseData>(
      `/api/search/trending?${params.toString()}`
    );

    if (response.success !== true) {
      return [];
    }

    return response.data?.trending ?? [];
  }

  // Get related searches
  static async getRelatedSearches(query: string): Promise<string[]> {
    const response = await apiClient.get<RelatedResponseData>(
      `/api/search/related?q=${encodeURIComponent(query)}`
    );

    if (response.success !== true) {
      return [];
    }

    return response.data?.related ?? [];
  }

  // Advanced search with AI
  static async aiSearch(prompt: string): Promise<AISearchResult> {
    const response = await apiClient.post<AISearchResponseData>(
      '/api/search/ai',
      { prompt }
    );

    if (response.success !== true || response.data?.search === undefined) {
      throw new Error(getErrorMessage(response.error, 'Failed to perform AI search'));
    }

    return response.data.search;
  }

  // Export search results
  static async exportResults(
    searchType: 'pitch' | 'user',
    filters: Record<string, unknown>,
    format: 'csv' | 'pdf' | 'excel'
  ): Promise<Blob> {
    const response = await fetch(
      `${API_BASE_URL}/api/search/export`, {
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
  static async getFiltersMetadata(type: 'pitch' | 'user'): Promise<FiltersMetadata> {
    const response = await apiClient.get<FiltersMetadataResponseData>(
      `/api/search/facets?type=${type}`
    );

    if (response.success !== true) {
      throw new Error(getErrorMessage(response.error, 'Failed to fetch filters metadata'));
    }

    return response.data?.metadata ?? {};
  }

  // Similar pitches
  static async getSimilarPitches(pitchId: number, limit: number = 5): Promise<Pitch[]> {
    const response = await apiClient.get<PitchesResponseData>(
      `/api/search/similar/pitches/${pitchId.toString()}?limit=${limit.toString()}`
    );

    if (response.success !== true) {
      return [];
    }

    return response.data?.pitches ?? [];
  }

  // Similar users
  static async getSimilarUsers(userId: number, limit: number = 5): Promise<User[]> {
    const response = await apiClient.get<UsersResponseData>(
      `/api/search/similar/users/${userId.toString()}?limit=${limit.toString()}`
    );

    if (response.success !== true) {
      return [];
    }

    return response.data?.users ?? [];
  }
}

// Export singleton instance
export const searchService = SearchService;
