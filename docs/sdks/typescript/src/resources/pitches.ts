/**
 * Pitch management resource methods
 */

import { PitcheyAPIClient } from '../client';
import {
  Pitch,
  CreatePitchData,
  UpdatePitchData,
  PitchFilters,
  PitchSearchParams,
  PaginatedResponse,
  SearchResults,
} from '../types';

export class PitchesResource {
  constructor(private client: PitcheyAPIClient) {}

  /**
   * Get a list of pitches (user's own pitches when authenticated)
   */
  async list(filters: PitchFilters & { page?: number; limit?: number } = {}): Promise<PaginatedResponse<Pitch>> {
    return this.client.get('/api/pitches', filters);
  }

  /**
   * Get a specific pitch by ID
   */
  async get(pitchId: number): Promise<Pitch> {
    return this.client.get(`/api/pitches/${pitchId}`);
  }

  /**
   * Create a new pitch
   */
  async create(data: CreatePitchData): Promise<{ message: string; pitch: Pitch }> {
    return this.client.post('/api/pitches', data);
  }

  /**
   * Update an existing pitch
   */
  async update(pitchId: number, data: UpdatePitchData): Promise<{ message: string; pitch: Pitch }> {
    return this.client.put(`/api/pitches/${pitchId}`, data);
  }

  /**
   * Delete a pitch
   */
  async delete(pitchId: number): Promise<{ message: string }> {
    return this.client.delete(`/api/pitches/${pitchId}`);
  }

  /**
   * Get public pitches (no authentication required)
   */
  async getPublic(params: PitchSearchParams = {}): Promise<PaginatedResponse<Pitch>> {
    return this.client.get('/api/pitches/public', params);
  }

  /**
   * Get trending pitches
   */
  async getTrending(limit?: number): Promise<{ pitches: Pitch[]; trending_factors: any }> {
    const params = limit ? { limit } : {};
    return this.client.get('/api/pitches/trending', params);
  }

  /**
   * Search pitches
   */
  async search(params: PitchSearchParams): Promise<SearchResults> {
    return this.client.get('/api/pitches/search', params);
  }

  /**
   * Advanced search with complex filters
   */
  async advancedSearch(params: {
    query?: string;
    genres?: string[];
    formats?: string[];
    budgetRanges?: string[];
    stages?: string[];
    seekingInvestment?: boolean;
    sort?: 'relevance' | 'newest' | 'oldest' | 'most_liked' | 'most_viewed' | 'budget_asc' | 'budget_desc';
    page?: number;
    limit?: number;
  }): Promise<SearchResults> {
    return this.client.get('/api/search/advanced', params);
  }

  /**
   * Like a pitch
   */
  async like(pitchId: number): Promise<{ message: string }> {
    return this.client.post(`/api/pitches/${pitchId}/like`);
  }

  /**
   * Unlike a pitch
   */
  async unlike(pitchId: number): Promise<{ message: string }> {
    return this.client.delete(`/api/pitches/${pitchId}/like`);
  }

  /**
   * Get pitch analytics
   */
  async getAnalytics(pitchId: number, timeframe?: '24h' | '7d' | '30d'): Promise<any> {
    const params = timeframe ? { timeframe } : {};
    return this.client.get(`/api/pitches/${pitchId}/analytics`, params);
  }

  /**
   * Archive a pitch
   */
  async archive(pitchId: number): Promise<{ message: string }> {
    return this.client.patch(`/api/pitches/${pitchId}`, { archived: true });
  }

  /**
   * Unarchive a pitch
   */
  async unarchive(pitchId: number): Promise<{ message: string }> {
    return this.client.patch(`/api/pitches/${pitchId}`, { archived: false });
  }

  /**
   * Publish a draft pitch
   */
  async publish(pitchId: number): Promise<{ message: string }> {
    return this.client.post(`/api/pitches/${pitchId}/publish`);
  }

  /**
   * Unpublish a pitch (make it draft)
   */
  async unpublish(pitchId: number): Promise<{ message: string }> {
    return this.client.post(`/api/pitches/${pitchId}/unpublish`);
  }

  /**
   * Get pitch views analytics
   */
  async getViews(pitchId: number, params?: { page?: number; limit?: number }): Promise<any> {
    return this.client.get(`/api/pitches/${pitchId}/views`, params);
  }

  /**
   * Get pitch likes
   */
  async getLikes(pitchId: number, params?: { page?: number; limit?: number }): Promise<any> {
    return this.client.get(`/api/pitches/${pitchId}/likes`, params);
  }

  /**
   * Get pitch comments
   */
  async getComments(pitchId: number, params?: { page?: number; limit?: number }): Promise<any> {
    return this.client.get(`/api/pitches/${pitchId}/comments`, params);
  }

  /**
   * Add a comment to a pitch
   */
  async addComment(pitchId: number, content: string): Promise<{ message: string; comment: any }> {
    return this.client.post(`/api/pitches/${pitchId}/comments`, { content });
  }

  /**
   * Update a comment
   */
  async updateComment(pitchId: number, commentId: number, content: string): Promise<{ message: string }> {
    return this.client.put(`/api/pitches/${pitchId}/comments/${commentId}`, { content });
  }

  /**
   * Delete a comment
   */
  async deleteComment(pitchId: number, commentId: number): Promise<{ message: string }> {
    return this.client.delete(`/api/pitches/${pitchId}/comments/${commentId}`);
  }

  /**
   * Report a pitch
   */
  async report(pitchId: number, reason: string, description?: string): Promise<{ message: string }> {
    return this.client.post(`/api/pitches/${pitchId}/report`, { reason, description });
  }

  /**
   * Share a pitch
   */
  async share(pitchId: number, platform: string): Promise<{ message: string; shareUrl: string }> {
    return this.client.post(`/api/pitches/${pitchId}/share`, { platform });
  }

  /**
   * Get shareable link for a pitch
   */
  async getShareLink(pitchId: number): Promise<{ shareUrl: string }> {
    return this.client.get(`/api/pitches/${pitchId}/share-link`);
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Get multiple pitches by IDs
   */
  async getMultiple(pitchIds: number[]): Promise<{ pitches: Pitch[] }> {
    return this.client.get('/api/pitches/batch', { ids: pitchIds });
  }

  /**
   * Archive multiple pitches
   */
  async archiveMultiple(pitchIds: number[]): Promise<{ message: string; updated: number }> {
    return this.client.post('/api/pitches/batch/archive', { ids: pitchIds });
  }

  /**
   * Delete multiple pitches
   */
  async deleteMultiple(pitchIds: number[]): Promise<{ message: string; deleted: number }> {
    return this.client.post('/api/pitches/batch/delete', { ids: pitchIds });
  }

  // ============================================================================
  // Filtering Helpers
  // ============================================================================

  /**
   * Get pitches by genre
   */
  async getByGenre(genre: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.list({ ...params, genre });
  }

  /**
   * Get pitches by format
   */
  async getByFormat(format: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.list({ ...params, format });
  }

  /**
   * Get pitches seeking investment
   */
  async getSeekingInvestment(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.list({ ...params, seekingInvestment: true });
  }

  /**
   * Get pitches requiring NDA
   */
  async getRequiringNDA(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.getPublic({ ...params, visibility: 'nda_required' } as any);
  }

  /**
   * Get featured pitches
   */
  async getFeatured(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.client.get('/api/pitches/featured', params);
  }

  /**
   * Get recommended pitches for the current user
   */
  async getRecommended(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Pitch>> {
    return this.client.get('/api/pitches/recommended', params);
  }
}