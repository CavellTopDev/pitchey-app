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
  hasSignedNDA?: boolean; // Whether user has signed NDA
  protectedContent?: {
    budgetBreakdown?: Record<string, number | string>;
    productionTimeline?: string;
    attachedTalent?: Array<{ name: string; role: string; confirmed?: boolean }>;
    financialProjections?: Record<string, number | string>;
    distributionPlan?: string;
    marketingStrategy?: string;
    privateAttachments?: Array<{ url: string; name: string; type: string }>;
    contactDetails?: { email?: string; phone?: string; address?: string };
    revenueModel?: string;
  };
}

// Raw pitch data from API (snake_case)
interface RawPitchData {
  id?: number;
  view_count?: number;
  viewCount?: number;
  like_count?: number;
  likeCount?: number;
  nda_count?: number;
  ndaCount?: number;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  creator_id?: number;
  creatorId?: number;
  user_id?: number;
  creator_name?: string;
  creatorName?: string;
  short_synopsis?: string;
  shortSynopsis?: string;
  long_synopsis?: string;
  longSynopsis?: string;
  budget_breakdown?: Record<string, number | string>;
  budgetBreakdown?: Record<string, number | string>;
  attached_talent?: Array<{ name: string; role: string; confirmed?: boolean }>;
  attachedTalent?: Array<{ name: string; role: string; confirmed?: boolean }>;
  financial_projections?: Record<string, number | string>;
  financialProjections?: Record<string, number | string>;
  [key: string]: unknown;
}

interface PitchAnalytics {
  views: number;
  likes: number;
  ndaRequests: number;
  investments: number;
  viewHistory?: Array<{ date: string; count: number }>;
  demographics?: Record<string, number>;
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

// Helper to transform pitch data from snake_case (API) to camelCase (frontend)
// and ensure numeric values are properly typed
function transformPitchData(pitch: RawPitchData | null | undefined): Partial<Pitch> | null {
  if (pitch === null || pitch === undefined) return null;
  return {
    ...(pitch as unknown as Partial<Pitch>),
    // Map snake_case to camelCase for engagement metrics
    // Note: API may return strings for some numeric fields
    viewCount: Number(pitch.view_count ?? pitch.viewCount ?? 0),
    likeCount: Number(pitch.like_count ?? pitch.likeCount ?? 0),
    ndaCount: Number(pitch.nda_count ?? pitch.ndaCount ?? 0),
    createdAt: pitch.created_at ?? pitch.createdAt,
    updatedAt: pitch.updated_at ?? pitch.updatedAt,
    shortSynopsis: pitch.short_synopsis ?? pitch.shortSynopsis,
    longSynopsis: pitch.long_synopsis ?? pitch.longSynopsis,
  };
}

export class PitchService {
  // Create a new pitch
  static async create(input: CreatePitchInput): Promise<Pitch> {
    // Map frontend values to backend expectations
    const mappedData = {
      ...input,
      genre: genreMap[input.genre] ?? input.genre.toLowerCase(),
      format: formatMap[input.format] ?? input.format.toLowerCase(),
      // Ensure proper data types
      estimatedBudget: input.estimatedBudget ?? undefined,
      additionalMedia: input.additionalMedia?.map(media => ({
        ...media,
        uploadedAt: new Date().toISOString()
      }))
    };

    interface CreatePitchResponse {
      pitch?: Pitch;
      data?: Pitch;
    }
    const response = await apiClient.post<CreatePitchResponse>(
      '/api/creator/pitches',
      mappedData
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to create pitch');
    }

    // Handle different response structures
    const pitch = response.data?.pitch ?? response.data?.data ?? response.data;

    if (pitch === undefined || pitch === null) {
      throw new Error('Invalid response structure from server');
    }

    return pitch as Pitch;
  }

  // Get pitch with authenticated access for protected content
  static async getByIdAuthenticated(id: number): Promise<Pitch> {
    console.log('🔐 [PitchService] Fetching authenticated pitch data for ID:', id);

    interface AuthPitchResponse {
      pitch?: RawPitchData;
    }
    const response = await apiClient.get<AuthPitchResponse>(
      `/api/pitches/${id}`
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch authenticated pitch data');
    }

    console.log('🔐 [PitchService] Authenticated endpoint response:', response.data);

    // Extract the pitch object from the response
    const rawPitch = response.data?.pitch ?? (response.data as unknown as RawPitchData);
    console.log('🔐 [PitchService] Extracted pitch object:', rawPitch);

    // Transform snake_case to camelCase and ensure proper types
    const pitch = transformPitchData(rawPitch);
    if (pitch === null) {
      throw new Error('Invalid pitch data received');
    }
    return pitch as Pitch;
  }

  // Get all pitches for current creator
  static async getMyPitches(): Promise<Pitch[]> {
    interface MyPitchesResponse {
      data?: { pitches?: Pitch[] };
      pitches?: Pitch[];
    }
    const response = await apiClient.get<MyPitchesResponse>(
      '/api/creator/pitches'
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch pitches');
    }

    // Handle nested response structure from backend
    // Backend returns: { data: { data: { pitches: [...] } } }
    const pitches = response.data?.data?.pitches ?? response.data?.pitches ?? [];

    return Array.isArray(pitches) ? pitches : [];
  }

  // Get a single pitch
  static async getById(id: number): Promise<Pitch> {
    // Use the public endpoint which actually exists
    const response = await apiClient.get<RawPitchData>(
      `/api/pitches/public/${id}`
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Pitch not found');
    }

    // The public endpoint returns the pitch directly in data
    // Backend returns: { success: true, data: { ...pitchData } }
    const rawPitch = response.data;

    if (rawPitch === undefined || rawPitch === null) {
      throw new Error('Invalid response structure from server');
    }

    // Transform snake_case to camelCase and ensure proper types
    const pitch = transformPitchData(rawPitch);
    if (pitch === null) {
      throw new Error('Invalid pitch data');
    }
    return pitch as Pitch;
  }

  // Update a pitch
  static async update(id: number, input: UpdatePitchInput): Promise<Pitch> {
    // Map frontend values to backend expectations if needed
    const mappedData = {
      ...input,
      genre: input.genre !== undefined ? (genreMap[input.genre] ?? input.genre.toLowerCase()) : undefined,
      format: input.format !== undefined ? (formatMap[input.format] ?? input.format.toLowerCase()) : undefined,
    };

    interface UpdatePitchResponse {
      pitch?: Pitch;
    }
    const response = await apiClient.put<UpdatePitchResponse>(
      `/api/creator/pitches/${id}`,
      mappedData
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to update pitch');
    }

    const pitch = response.data?.pitch;
    if (pitch === undefined || pitch === null) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Delete a pitch
  static async delete(id: number): Promise<void> {
    try {
      const response = await apiClient.delete<{ success: boolean; message?: string }>(
        `/api/creator/pitches/${id}`
      );

      if (response.success !== true) {
        console.error('❌ Delete failed:', response);
        const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
        throw new Error(errorMessage ?? 'Failed to delete pitch');
      }

      // WebSocket notification for pitch deletion is handled by the calling component
    } catch (error: unknown) {
      console.error('❌ Error deleting pitch:', error);
      // Re-throw with more context if needed
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('foreign key constraint')) {
        throw new Error('Cannot delete pitch: it has active investments or related records');
      }
      throw error;
    }
  }

  // Publish a pitch
  static async publish(id: number): Promise<Pitch> {
    interface PublishResponse {
      pitch?: Pitch;
    }
    const response = await apiClient.post<PublishResponse>(
      `/api/creator/pitches/${id}/publish`,
      {}
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to publish pitch');
    }

    const pitch = response.data?.pitch;
    if (pitch === undefined || pitch === null) {
      throw new Error('Invalid response structure from server');
    }

    return pitch;
  }

  // Archive a pitch
  static async archive(id: number): Promise<Pitch> {
    interface ArchiveResponse {
      pitch?: Pitch;
    }
    const response = await apiClient.post<ArchiveResponse>(
      `/api/creator/pitches/${id}/archive`,
      {}
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to archive pitch');
    }

    const pitch = response.data?.pitch;
    if (pitch === undefined || pitch === null) {
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
      if (filters?.genre !== undefined && filters.genre !== '') params.append('genre', filters.genre);
      if (filters?.format !== undefined && filters.format !== '') params.append('format', filters.format);
      if (filters?.search !== undefined && filters.search !== '') params.append('search', filters.search);
      if (filters?.page !== undefined) params.append('page', filters.page.toString());
      if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());

      interface PublicPitchesResponse {
        items?: Pitch[];
        data?: Pitch[];
        total?: number;
      }
      const response = await apiClient.get<PublicPitchesResponse>(`/api/pitches/public?${params}`);

      if (response.success !== true) {
        console.error('Failed to fetch public pitches:', response.error?.message);
        return { pitches: [], total: 0 };
      }

      // ApiClient returns { success: true, data: <full-api-response> }
      // API returns { success: true, data: [...], total: number, ... }
      // Handle both nested and direct response formats
      const responseData = response.data;
      const pitches = responseData?.data ?? responseData?.items ?? [];
      const total = responseData?.total ?? (Array.isArray(pitches) ? pitches.length : 0);

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

  // Get trending pitches - use pitches endpoint sorted by view/like counts
  static async getTrendingPitches(limit: number = 10): Promise<Pitch[]> {
    try {
      interface TrendingResponse {
        data?: Pitch[];
        items?: Pitch[];
        pagination?: { page: number; limit: number; total: number };
        message?: string;
      }
      // Use /api/pitches endpoint since /api/browse returns empty
      const response = await apiClient.get<TrendingResponse>(`/api/pitches?limit=${limit}&sortBy=like_count&sortOrder=desc`);

      if (response.success !== true) {
        console.error('Failed to fetch trending pitches:', response.error?.message);
        return [];
      }

      // Extract pitches from response
      const responseData = response.data;
      const pitches = responseData?.data ?? responseData?.items ?? [];

      // Ensure we always return an array
      return Array.isArray(pitches) ? pitches : [];
    } catch (error) {
      console.error('Error fetching trending pitches:', error);
      return []; // Always return empty array on error
    }
  }

  // Get popular pitches - use browse endpoint with tab parameter
  static async getPopularPitches(limit: number = 10): Promise<Pitch[]> {
    try {
      interface BrowseResponse {
        data?: Pitch[];
        items?: Pitch[];
        pagination?: { page: number; limit: number; total: number };
        message?: string;
        tab?: string;
        total?: number;
      }
      const response = await apiClient.get<BrowseResponse>(`/api/browse?tab=popular&limit=${limit}`);

      if (response.success !== true) {
        console.error('Failed to fetch popular pitches:', response.error?.message);
        return [];
      }

      // The response should have items array with the pitches
      const pitches = response.data?.items ?? response.data?.data ?? [];
      return Array.isArray(pitches) ? pitches : [];
    } catch (error) {
      console.error('Error fetching popular pitches:', error);
      return []; // Always return empty array on error
    }
  }

  // Get new releases - use browse endpoint with tab parameter
  static async getNewReleases(limit: number = 10): Promise<Pitch[]> {
    try {
      interface NewReleasesResponse {
        data?: Pitch[];
        items?: Pitch[];
        pagination?: { page: number; limit: number; total: number };
        message?: string;
        tab?: string;
        total?: number;
      }
      const response = await apiClient.get<NewReleasesResponse>(`/api/browse?tab=new&limit=${limit}`);

      if (response.success !== true) {
        console.error('Failed to fetch new releases:', response.error?.message);
        return [];
      }

      // The apiClient returns the whole response as data, so we need to check response.data.data
      const responseData = response.data;
      const pitches = responseData?.data ?? responseData?.items ?? [];

      // Ensure we always return an array
      return Array.isArray(pitches) ? pitches : [];
    } catch (error) {
      console.error('Error fetching new releases:', error);
      return []; // Always return empty array on error
    }
  }

  // Get pitches with enhanced browse and sorting - using enhanced endpoint
  static async getGeneralBrowse(filters?: {
    sort?: 'alphabetical' | 'date' | 'budget' | 'views' | 'likes' | 'investment_status';
    order?: 'asc' | 'desc';
    genre?: string;
    format?: string;
    search?: string;
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
    const defaultLimit = 20;
    const defaultResult = {
      pitches: [],
      totalCount: 0,
      pagination: {
        limit: filters?.limit ?? defaultLimit,
        offset: filters?.offset ?? 0,
        totalPages: 0,
        currentPage: 1
      },
      filters: {
        sortBy: filters?.sort ?? 'date',
        order: filters?.order ?? 'desc',
        genre: filters?.genre ?? null,
        format: filters?.format ?? null
      }
    };

    try {
      const params = new URLSearchParams();
      if (filters?.sort !== undefined) params.append('sort', filters.sort);
      if (filters?.order !== undefined) params.append('order', filters.order);
      if (filters?.genre !== undefined && filters.genre !== '') params.append('genre', filters.genre);
      if (filters?.format !== undefined && filters.format !== '') params.append('format', filters.format);
      if (filters?.search !== undefined && filters.search !== '') params.append('q', filters.search);
      if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());
      if (filters?.offset !== undefined) params.append('offset', filters.offset.toString());

      interface GeneralBrowseResponse {
        pitches?: Pitch[];
        items?: Pitch[];
        totalCount?: number;
        total?: number;
        tab?: string;
        page?: number;
        limit?: number;
        hasMore?: boolean;
        pagination?: {
          limit: number;
          offset: number;
          totalPages: number;
          currentPage: number;
        };
        filters?: {
          sortBy: string;
          order: string;
          genre: string | null;
          format: string | null;
        };
      }
      // Use the /api/browse endpoint which is actually implemented
      const response = await apiClient.get<GeneralBrowseResponse>(`/api/browse?${params}`);

      if (response.success !== true) {
        console.error('Failed to fetch browse pitches:', response.error?.message);
        return defaultResult;
      }

      // Worker API returns { success, items, total, ... }
      const responseData = response.data;
      const pitches = responseData?.items ?? responseData?.pitches ?? [];
      const totalCount = responseData?.total ?? responseData?.totalCount ?? 0;
      const limit = filters?.limit ?? defaultLimit;
      const currentPage = responseData?.page ?? Math.floor((filters?.offset ?? 0) / limit) + 1;

      return {
        pitches: Array.isArray(pitches) ? pitches : [],
        totalCount: totalCount,
        pagination: {
          limit: limit,
          offset: filters?.offset ?? 0,
          totalPages: Math.ceil(totalCount / limit),
          currentPage: currentPage
        },
        filters: {
          sortBy: filters?.sort ?? 'date',
          order: filters?.order ?? 'desc',
          genre: filters?.genre ?? null,
          format: filters?.format ?? null
        }
      };
    } catch (error) {
      console.error('Error fetching general browse:', error);
      return defaultResult;
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

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to like pitch');
    }
  }

  // Unlike a pitch
  static async unlikePitch(id: number): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/creator/pitches/${id}/unlike`,
      {}
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to unlike pitch');
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

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to request NDA');
    }
  }

  // Sign NDA for a pitch
  static async signNDA(pitchId: number, signature: string): Promise<void> {
    const response = await apiClient.post<{ success: boolean }>(
      `/api/pitches/${pitchId}/nda/sign`,
      { signature }
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to sign NDA');
    }
  }

  // Get pitch analytics
  static async getAnalytics(pitchId: number): Promise<PitchAnalytics> {
    interface AnalyticsResponse {
      analytics?: PitchAnalytics;
    }
    const response = await apiClient.get<AnalyticsResponse>(
      `/api/creator/pitches/${pitchId}/analytics`
    );

    if (response.success !== true) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to fetch analytics');
    }

    return response.data?.analytics ?? { views: 0, likes: 0, ndaRequests: 0, investments: 0 };
  }

  // Upload media for pitch
  static async uploadMedia(pitchId: number, file: File, type: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    interface UploadResponse {
      url?: string;
    }
    const response = await apiClient.uploadFile<UploadResponse>(
      `/api/creator/pitches/${pitchId}/media`,
      formData
    );

    if (response.success !== true || response.data?.url === undefined) {
      const errorMessage = typeof response.error === 'object' && response.error !== null ? response.error.message : response.error;
      throw new Error(errorMessage ?? 'Failed to upload media');
    }

    return response.data.url;
  }

  // === PUBLIC ENDPOINTS FOR GUEST BROWSING ===
  // These endpoints work without authentication and are rate-limited

  // Get public trending pitches (no auth required)
  static async getPublicTrendingPitches(limit: number = 20): Promise<Pitch[]> {
    try {
      const response = await fetch(`${API_URL}/api/pitches/public/trending?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface PublicPitchesJson {
        success?: boolean;
        data?: { pitches?: Pitch[] };
      }
      const data = await response.json() as PublicPitchesJson;
      return data.success === true ? (data.data?.pitches ?? []) : [];
    } catch (error) {
      console.error('Error fetching public trending pitches:', error);
      return [];
    }
  }

  // Get public new pitches (no auth required)
  static async getPublicNewPitches(limit: number = 20): Promise<Pitch[]> {
    try {
      const response = await fetch(`${API_URL}/api/pitches/public/new?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface PublicPitchesJson {
        success?: boolean;
        data?: { pitches?: Pitch[] };
      }
      const data = await response.json() as PublicPitchesJson;
      return data.success === true ? (data.data?.pitches ?? []) : [];
    } catch (error) {
      console.error('Error fetching public new pitches:', error);
      return [];
    }
  }

  // Get public featured pitches (no auth required)
  static async getPublicFeaturedPitches(limit: number = 6): Promise<Pitch[]> {
    try {
      const response = await fetch(`${API_URL}/api/pitches/public/featured?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface PublicPitchesJson {
        success?: boolean;
        data?: { pitches?: Pitch[] };
      }
      const data = await response.json() as PublicPitchesJson;
      return data.success === true ? (data.data?.pitches ?? []) : [];
    } catch (error) {
      console.error('Error fetching public featured pitches:', error);
      return [];
    }
  }

  // Search public pitches (no auth required)
  static async searchPublicPitches(
    searchTerm: string,
    filters?: {
      genre?: string;
      format?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ pitches: Pitch[]; total: number; page: number; pageSize: number }> {
    try {
      const params = new URLSearchParams();
      params.append('q', searchTerm);

      if (filters?.genre !== undefined && filters.genre !== '') params.append('genre', filters.genre);
      if (filters?.format !== undefined && filters.format !== '') params.append('format', filters.format);
      if (filters?.page !== undefined) params.append('page', filters.page.toString());
      if (filters?.limit !== undefined) params.append('limit', filters.limit.toString());

      const response = await fetch(`${API_URL}/api/pitches/public/search?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface SearchResultJson {
        success?: boolean;
        data?: { pitches?: Pitch[]; total?: number; page?: number; pageSize?: number };
      }
      const data = await response.json() as SearchResultJson;
      if (data.success !== true) {
        return { pitches: [], total: 0, page: 1, pageSize: 20 };
      }

      return {
        pitches: data.data?.pitches ?? [],
        total: data.data?.total ?? 0,
        page: data.data?.page ?? 1,
        pageSize: data.data?.pageSize ?? 20
      };
    } catch (error) {
      console.error('Error searching public pitches:', error);
      return { pitches: [], total: 0, page: 1, pageSize: 20 };
    }
  }

  // Get public pitch by ID (no auth required)
  static async getPublicPitchById(pitchId: string): Promise<Pitch | null> {
    try {
      const response = await fetch(`${API_URL}/api/pitches/public/${pitchId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Pitch not found or not public
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      interface PitchByIdJson {
        success?: boolean;
        data?: { pitch?: Pitch };
      }
      const data = await response.json() as PitchByIdJson;
      return data.success === true ? (data.data?.pitch ?? null) : null;
    } catch (error) {
      console.error('Error fetching public pitch by ID:', error);
      return null;
    }
  }

  // Enhanced public pitches method that uses the new endpoints
  static async getPublicPitchesEnhanced(filters?: {
    genre?: string;
    format?: string;
    search?: string;
    page?: number;
    limit?: number;
    tab?: 'trending' | 'new' | 'featured' | 'all';
  }): Promise<{ pitches: Pitch[]; total: number }> {
    try {
      // Route to specific endpoint based on tab
      if (filters?.tab === 'trending') {
        const pitches = await this.getPublicTrendingPitches(filters.limit);
        return { pitches, total: pitches.length };
      }

      if (filters?.tab === 'new') {
        const pitches = await this.getPublicNewPitches(filters.limit);
        return { pitches, total: pitches.length };
      }

      if (filters?.tab === 'featured') {
        const pitches = await this.getPublicFeaturedPitches(filters.limit);
        return { pitches, total: pitches.length };
      }

      // For search or general browsing
      if (filters?.search !== undefined && filters.search !== '') {
        return this.searchPublicPitches(filters.search, filters);
      }

      // Fallback to original getPublicPitches method
      return this.getPublicPitches(filters);
    } catch (error) {
      console.error('Error in getPublicPitchesEnhanced:', error);
      return { pitches: [], total: 0 };
    }
  }
}

// Export singleton instance for convenience
export const pitchService = PitchService;