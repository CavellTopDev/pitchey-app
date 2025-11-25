// Pitch Service - Frontend integration with Drizzle-based backend
// Matches the Drizzle schema exactly for all pitch operations

import { apiClient } from '../lib/api-client';
import { API_URL } from '../config';

// Types matching Drizzle schema
export interface Pitch {
  id: number;
  userId: number;
  title: string;
  logline: string;
  genre: 'drama' | 'comedy' | 'thriller' | 'horror' | 'scifi' | 'fantasy' | 'documentary' | 'animation' | 'action' | 'romance' | 'other';
  format: 'feature' | 'tv' | 'short' | 'webseries' | 'other';
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  opener?: string;
  premise?: string;
  targetAudience?: string;
  characters?: Array<{
    id?: string;
    name: string;
    description: string;
    age?: string;
    gender?: string;
    actor?: string;
    displayOrder?: number;
  }>;
  themes?: string;
  worldDescription?: string;
  episodeBreakdown?: Array<{
    episodeNumber: number;
    title: string;
    synopsis: string;
  }>;
  budgetBracket?: string;
  estimatedBudget?: string;
  titleImage?: string;
  lookbookUrl?: string;
  pitchDeckUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  productionTimeline?: string;
  additionalMedia?: Array<{
    type: 'lookbook' | 'script' | 'trailer' | 'pitch_deck' | 'budget_breakdown' | 'production_timeline' | 'other';
    url: string;
    title: string;
    description?: string;
    uploadedAt: string;
  }>;
  visibilitySettings?: {
    showShortSynopsis: boolean;
    showCharacters: boolean;
    showBudget: boolean;
    showMedia: boolean;
  };
  status: 'draft' | 'published' | 'under_review' | 'archived';
  publishedAt?: string;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  aiUsed?: boolean;
  requireNDA?: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Related data
  creator?: {
    id: number;
    username: string;
    name?: string;
    profileImage?: string;
  };
  hasNDA?: boolean; // For current viewer
  isLiked?: boolean; // For current viewer
  canEdit?: boolean; // For current viewer
}

export interface CreatePitchInput {
  title: string;
  logline: string;
  genre: string;
  format: string;
  formatCategory?: string;
  formatSubtype?: string;
  customFormat?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  characters?: Array<{
    id?: string;
    name: string;
    description: string;
    age?: string;
    gender?: string;
    actor?: string;
    displayOrder?: number;
  }>;
  themes?: string;
  worldDescription?: string;
  budgetBracket?: string;
  estimatedBudget?: number;
  productionTimeline?: string;
  titleImage?: string;
  lookbookUrl?: string;
  pitchDeckUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  additionalMedia?: Array<{
    type: string;
    url: string;
    title: string;
    description?: string;
  }>;
  aiUsed?: boolean;
  requireNDA?: boolean;
}

export interface UpdatePitchInput extends Partial<CreatePitchInput> {
  status?: 'draft' | 'published' | 'under_review' | 'archived';
  visibilitySettings?: {
    showShortSynopsis?: boolean;
    showCharacters?: boolean;
    showBudget?: boolean;
    showMedia?: boolean;
  };
}

// Utility functions for genre and format mapping
const genreMap: Record<string, string> = {
  'Action': 'action',
  'Adventure': 'action',
  'Animation': 'animation',
  'Biography': 'documentary',
  'Comedy': 'comedy',
  'Crime': 'thriller',
  'Documentary': 'documentary',
  'Drama': 'drama',
  'Family': 'drama',
  'Fantasy': 'fantasy',
  'Horror': 'horror',
  'Mystery': 'thriller',
  'Romance': 'romance',
  'Sci-Fi': 'scifi',
  'Thriller': 'thriller',
  'War': 'action',
  'Western': 'other'
};

const formatMap: Record<string, string> = {
  'Feature Film': 'feature',
  'Short Film': 'short',
  'TV Series': 'tv',
  'TV Movie': 'tv',
  'Mini-Series': 'tv',
  'Web Series': 'webseries',
  'Documentary Series': 'tv',
  'Reality Show': 'tv'
};

export class PitchService {
  // Create a new pitch
  static async create(input: CreatePitchInput): Promise<Pitch> {
    // Map frontend values to backend expectations
    const mappedData = {
      ...input,
      genre: genreMap[input.genre] || input.genre.toLowerCase(),
      format: formatMap[input.format] || input.format.toLowerCase(),
      // Ensure proper data types
      estimatedBudget: input.estimatedBudget || undefined,
      additionalMedia: input.additionalMedia?.map(media => ({
        ...media,
        uploadedAt: new Date().toISOString()
      }))
    };

    const response = await apiClient.post<any>(
      '/api/creator/pitches',
      mappedData
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create pitch');
    }

    // Handle different response structures
    const pitch = response.data?.pitch || response.data?.data || response.pitch || response.data;
    
    if (!pitch) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Get all pitches for current creator
  static async getMyPitches(): Promise<Pitch[]> {
    const response = await apiClient.get<any>(
      '/api/creator/pitches'
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch pitches');
    }

    // Handle nested response structure from backend
    // Backend returns: { data: { data: { pitches: [...] } } }
    const pitches = response.data?.data?.pitches || response.data?.pitches || response.pitches || [];
    
    return Array.isArray(pitches) ? pitches : [];
  }

  // Get a single pitch
  static async getById(id: number): Promise<Pitch> {
    const response = await apiClient.get<any>(
      `/api/pitches/${id}`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Pitch not found');
    }

    // Handle the nested response structure from backend
    // Backend returns: { success: true, data: { pitch: {...}, message: "..." } }
    // apiClient returns: { success: true, data: { pitch: {...}, message: "..." } }
    const pitch = response.data?.pitch;
    
    if (!pitch) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Update a pitch
  static async update(id: number, input: UpdatePitchInput): Promise<Pitch> {
    // Map frontend values to backend expectations if needed
    const mappedData = {
      ...input,
      genre: input.genre ? (genreMap[input.genre] || input.genre.toLowerCase()) : undefined,
      format: input.format ? (formatMap[input.format] || input.format.toLowerCase()) : undefined,
    };

    const response = await apiClient.put<any>(
      `/api/creator/pitches/${id}`,
      mappedData
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update pitch');
    }

    const pitch = response.data?.pitch;
    if (!pitch) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Delete a pitch
  static async delete(id: number): Promise<void> {
    console.log(`🗑️ Attempting to delete pitch ${id}`);
    
    try {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(
        `/api/creator/pitches/${id}`
      );

      if (!response.success) {
        console.error('❌ Delete failed:', response);
        throw new Error(response.error?.message || 'Failed to delete pitch');
      }
      
      console.log(`✅ Pitch ${id} deleted successfully`);
      
      // Trigger a WebSocket event if connected
      if ((window as any).websocketService?.isConnected()) {
        (window as any).websocketService.send({
          type: 'pitch_deleted',
          data: { pitchId: id }
        });
      }
      
    } catch (error: any) {
      console.error('❌ Error deleting pitch:', error);
      // Re-throw with more context if needed
      if (error.message?.includes('foreign key constraint')) {
        throw new Error('Cannot delete pitch: it has active investments or related records');
      }
      throw error;
    }
  }

  // Publish a pitch
  static async publish(id: number): Promise<Pitch> {
    const response = await apiClient.post<any>(
      `/api/creator/pitches/${id}/publish`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to publish pitch');
    }

    const pitch = response.data?.pitch;
    if (!pitch) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Archive a pitch
  static async archive(id: number): Promise<Pitch> {
    const response = await apiClient.post<any>(
      `/api/creator/pitches/${id}/archive`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to archive pitch');
    }

    const pitch = response.data?.pitch;
    if (!pitch) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Get public pitches (for marketplace)
  static async getPublicPitches(filters?: {
    genre?: string;
    format?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ pitches: Pitch[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters?.genre) params.append('genre', filters.genre);
      if (filters?.format) params.append('format', filters.format);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await apiClient.get<{ 
        success: boolean; 
        items: Pitch[]; 
        total: number 
      }>(`/api/pitches/public?${params}`);

      if (!response.success) {
        console.error('Failed to fetch public pitches:', response.error?.message);
        return { pitches: [], total: 0 };
      }

      // Worker API returns { success: true, items: [...], message: "...", total: number, page: number }
      const pitches = response.data?.items || [];
      const total = response.data?.total || pitches.length;
      
      // Ensure we always return arrays and numbers
      return {
        pitches: Array.isArray(pitches) ? pitches : [],
        total: typeof total === 'number' ? total : 0
      };
    } catch (error) {
      console.error('Error fetching public pitches:', error);
      return { pitches: [], total: 0 }; // Always return valid structure on error
    }
  }

  // Get trending pitches
  static async getTrendingPitches(limit: number = 10): Promise<Pitch[]> {
    try {
      const response = await apiClient.get<{ 
        success: boolean; 
        items: Pitch[];
        message: string;
      }>(`/api/pitches/trending?limit=${limit}`);

      if (!response.success) {
        console.error('Failed to fetch trending pitches:', response.error?.message);
        return [];
      }

      // Worker API returns { success: true, items: [...], message: "...", total: number, page: number }
      const pitches = response.data?.items || [];
      console.log('Trending pitches received:', pitches.length);
      
      // Ensure we always return an array
      return Array.isArray(pitches) ? pitches : [];
    } catch (error) {
      console.error('Error fetching trending pitches:', error);
      return []; // Always return empty array on error
    }
  }

  // Get new releases
  static async getNewReleases(limit: number = 10): Promise<Pitch[]> {
    try {
      const response = await apiClient.get<{ 
        success: boolean; 
        items: Pitch[];
        message: string;
      }>(`/api/pitches/new?limit=${limit}`);

      if (!response.success) {
        console.error('Failed to fetch new releases:', response.error?.message);
        return [];
      }

      // Worker API returns { success: true, items: [...], message: "...", total: number, page: number }
      const pitches = response.data?.items || [];
      console.log('New releases received:', pitches.length);
      
      // Ensure we always return an array
      return Array.isArray(pitches) ? pitches : [];
    } catch (error) {
      console.error('Error fetching new releases:', error);
      return []; // Always return empty array on error
    }
  }

  // Get pitches with general browse and sorting
  static async getGeneralBrowse(filters?: {
    sort?: 'alphabetical' | 'date' | 'budget' | 'views' | 'likes';
    order?: 'asc' | 'desc';
    genre?: string;
    format?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    pitches: Pitch[];
    totalCount: number;
    pagination: {
      limit: number;
      offset: number;
      totalPages: number;
      currentPage: number;
    };
    filters: {
      sortBy: string;
      order: string;
      genre: string | null;
      format: string | null;
    };
  }> {
    try {
      const params = new URLSearchParams();
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.order) params.append('order', filters.order);
      if (filters?.genre) params.append('genre', filters.genre);
      if (filters?.format) params.append('format', filters.format);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await apiClient.get<{ 
        success: boolean; 
        pitches: Pitch[];
        totalCount: number;
        pagination: {
          limit: number;
          offset: number;
          totalPages: number;
          currentPage: number;
        };
        filters: {
          sortBy: string;
          order: string;
          genre: string | null;
          format: string | null;
        };
      }>(`/api/pitches/browse/general?${params}`);

      if (!response.success) {
        console.error('Failed to fetch browse pitches:', response.error?.message);
        // Return safe defaults on error
        return {
          pitches: [],
          totalCount: 0,
          pagination: {
            limit: filters?.limit || 20,
            offset: filters?.offset || 0,
            totalPages: 0,
            currentPage: 1
          },
          filters: {
            sortBy: filters?.sort || 'date',
            order: filters?.order || 'desc',
            genre: filters?.genre || null,
            format: filters?.format || null
          }
        };
      }

      // Worker API returns { success, items, total, totalPages, ... }
      const pitches = response.data?.items || [];
      return {
        pitches: Array.isArray(pitches) ? pitches : [],
        totalCount: response.data?.total || 0,
        pagination: {
          limit: filters?.limit || 20,
          offset: filters?.offset || 0,
          totalPages: response.data?.totalPages || 0,
          currentPage: response.data?.page || 1
        },
        filters: {
          sortBy: filters?.sort || 'date',
          order: filters?.order || 'desc',
          genre: filters?.genre || null,
          format: filters?.format || null
        }
      };
    } catch (error) {
      console.error('Error fetching general browse:', error);
      // Always return valid structure on error
      return {
        pitches: [],
        totalCount: 0,
        pagination: {
          limit: filters?.limit || 20,
          offset: filters?.offset || 0,
          totalPages: 0,
          currentPage: 1
        },
        filters: {
          sortBy: filters?.sort || 'date',
          order: filters?.order || 'desc',
          genre: filters?.genre || null,
          format: filters?.format || null
        }
      };
    }
  }

  // Track view for a pitch
  static async trackView(pitchId: number): Promise<void> {
    try {
      await apiClient.post('/api/analytics/track-view', { 
        pitchId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Silently fail for analytics
      console.error('Failed to track view:', error);
    }
  }

  // Like a pitch
  static async likePitch(id: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/creator/pitches/${id}/like`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to like pitch');
    }
  }

  // Unlike a pitch
  static async unlikePitch(id: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/creator/pitches/${id}/unlike`,
      {}
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to unlike pitch');
    }
  }

  // Request NDA for a pitch
  static async requestNDA(pitchId: number, data: {
    fullName: string;
    email: string;
    company?: string;
    purpose: string;
  }): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/pitches/${pitchId}/nda/request`,
      data
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to request NDA');
    }
  }

  // Sign NDA for a pitch
  static async signNDA(pitchId: number, signature: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/pitches/${pitchId}/nda/sign`,
      { signature }
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to sign NDA');
    }
  }

  // Get pitch analytics
  static async getAnalytics(pitchId: number): Promise<any> {
    const response = await apiClient.get<{ success: boolean; analytics: any }>(
      `/api/creator/pitches/${pitchId}/analytics`
    );

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch analytics');
    }

    return response.data?.analytics;
  }

  // Upload media for pitch
  static async uploadMedia(pitchId: number, file: File, type: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await apiClient.uploadFile<{ success: boolean; url: string }>(
      `/api/creator/pitches/${pitchId}/media`,
      formData
    );

    if (!response.success || !response.data?.url) {
      throw new Error(response.error?.message || 'Failed to upload media');
    }

    return response.data.url;
  }
}

// Export singleton instance for convenience
export const pitchService = PitchService;