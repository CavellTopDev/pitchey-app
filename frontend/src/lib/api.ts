import axios from 'axios';
import { config } from '../config';

// In production, use '' (empty string) for same-origin requests via Pages Functions proxy
const isDev = import.meta.env.MODE === 'development';
const API_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8001' : '');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for all requests
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login for 401 errors on protected routes
    // Don't redirect for public endpoints or certain error scenarios
    const url = error.config?.url || '';
    const isPublicEndpoint = url.includes('/public') || 
                           url.includes('/api/pitches/public') ||
                           url.includes('/api/trending') ||
                           url.includes('/api/search');
    
    // DISABLED: This was causing redirect loops with Better Auth
    // Better Auth handles authentication via cookies, not this interceptor
    // if (error.response?.status === 401 && !isPublicEndpoint) {
    //   localStorage.removeItem('authToken');
    //   window.location.href = '/login';
    // }
    return Promise.reject(error);
  }
);

// Helper to transform pitch data from snake_case (API) to camelCase (frontend)
function transformPitchData(pitch: any): any {
  if (!pitch) return pitch;
  return {
    ...pitch,
    // Map snake_case to camelCase for engagement metrics
    viewCount: pitch.view_count ?? pitch.viewCount ?? 0,
    likeCount: pitch.like_count ?? pitch.likeCount ?? 0,
    ndaCount: pitch.nda_count ?? pitch.ndaCount ?? 0,
    createdAt: pitch.created_at ?? pitch.createdAt,
    updatedAt: pitch.updated_at ?? pitch.updatedAt,
    creatorId: pitch.creator_id ?? pitch.creatorId ?? pitch.user_id,
    creatorName: pitch.creator_name ?? pitch.creatorName,
    shortSynopsis: pitch.short_synopsis ?? pitch.shortSynopsis,
    longSynopsis: pitch.long_synopsis ?? pitch.longSynopsis,
    budgetBreakdown: pitch.budget_breakdown ?? pitch.budgetBreakdown,
    attachedTalent: pitch.attached_talent ?? pitch.attachedTalent,
    financialProjections: pitch.financial_projections ?? pitch.financialProjections,
  };
}

export interface User {
  id: number;
  email: string;
  username: string;
  userType: 'creator' | 'production' | 'investor';
  firstName?: string;
  lastName?: string;
  bio?: string;
  profileImage?: string;
  companyName?: string;
  subscriptionTier: string;
  // Production company specific fields (private - for vetting only)
  companyDetails?: {
    registrationNumber?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    companyEmail?: string;
    companyPhone?: string;
    website?: string;
    socials?: {
      linkedin?: string;
      twitter?: string;
      instagram?: string;
      facebook?: string;
    };
    verificationStatus?: 'pending' | 'verified' | 'rejected';
    verifiedAt?: string;
  };
  followingCount?: number;
  followersCount?: number;
}

export interface Pitch {
  id: number;
  title: string;
  logline: string;
  genre: string;
  format: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  creator: {
    id: number;
    username: string;
    userType: 'creator' | 'production' | 'investor';
    companyName?: string;
    name?: string;
    profileImage?: string;
  };
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  createdAt: string;
  status: 'draft' | 'published';
  // Media assets
  lookbookUrl?: string;
  scriptUrl?: string;
  trailerUrl?: string;
  pitchDeckUrl?: string;
  additionalVideos?: string[];
  // Enhanced info only visible after NDA
  budget?: string;
  budgetBreakdown?: {
    development?: number;
    preProduction?: number;
    production?: number;
    postProduction?: number;
    marketing?: number;
    distribution?: number;
    contingency?: number;
    total: number;
  };
  targetAudience?: string;
  comparableTitles?: string;
  productionTimeline?: string;
  attachedTalent?: string;
  distributionStrategy?: string;
  hasSignedNDA?: boolean;
  ndaStatus?: 'none' | 'pending' | 'signed' | 'expired';
  // Tracking
  followersCount?: number;
  isFollowing?: boolean;
}

export interface NDA {
  id: number;
  pitchId: number;
  requesterId: number;
  creatorId: number;
  status: 'pending' | 'signed' | 'rejected' | 'expired';
  requestedAt: string;
  signedAt?: string;
  expiresAt?: string;
  customTerms?: string;
  uploadedNDAUrl?: string;
}

export interface Session {
  token: string;
  expiresAt: string;
}

// Auth API
export const authAPI = {
  async register(data: {
    email: string;
    username: string;
    password: string;
    userType: string;
  }) {
    const response = await api.post<{ user: User; session: Session }>(
      '/auth/register',
      data
    );
    localStorage.setItem('authToken', response.data.session.token);
    return response.data;
  },

  async login(email: string, password: string) {
    const response = await api.post<{ user: User; session: Session }>(
      '/auth/login',
      { email, password }
    );
    localStorage.setItem('authToken', response.data.session.token);
    return response.data;
  },

  async loginCreator(email: string, password: string) {
    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/api/auth/creator/login',
      { email, password }
    );
    // API returns data nested in data.data
    if (response.data.data?.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    if (response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      localStorage.setItem('userType', response.data.data.user.userType);
    }
    return { data: { user: response.data.data?.user } };
  },

  async loginInvestor(email: string, password: string) {
    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/api/auth/investor/login',
      { email, password }
    );
    // API returns data nested in data.data
    if (response.data.data?.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    if (response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      localStorage.setItem('userType', response.data.data.user.userType);
    }
    return { data: { user: response.data.data?.user } };
  },

  async loginProduction(email: string, password: string) {
    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/api/auth/production/login',
      { email, password }
    );
    // API returns data nested in data.data
    if (response.data.data?.token) {
      localStorage.setItem('authToken', response.data.data.token);
    }
    if (response.data.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.data.user));
      localStorage.setItem('userType', response.data.data.user.userType);
    }
    return { data: { user: response.data.data?.user } };
  },

  async logout() {
    try {
      // Call backend logout endpoint to invalidate server-side session
      await api.post('/api/auth/logout', {});
    } catch (error) {
      // Ignore backend errors, still clear local storage
      console.warn('Backend logout failed, proceeding with local cleanup:', error);
    }
    
    // Clear all authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userType');
    
    // Clear any other cached data
    localStorage.removeItem('pitchey_websocket_disabled');
    localStorage.removeItem('pitchey_websocket_loop_detected');
    
    // Clear session storage as well
    sessionStorage.clear();
  },

  async getProfile() {
    const response = await api.get<User>('/api/profile');
    return response.data;
  },

  async updateProfile(data: Partial<User>) {
    const response = await api.put<{ message: string; user: User }>(
      '/api/profile',
      data
    );
    return response.data;
  },
};

// Pitch API
export const pitchAPI = {
  async getPublic() {
    const response = await api.get('/api/pitches/public');
    // Handle both current backend format (items) and future expected format (data.pitches)
    return response.data.items || response.data.data?.pitches || [];
  },

  async getPublicById(id: number) {
    const response = await api.get(`/api/pitches/public/${id}`);
    // Axios returns the response in response.data
    // The API structure is { success: true, data: { ...pitchData } }
    // Transform snake_case to camelCase for frontend compatibility
    return transformPitchData(response.data.data);
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    genre?: string;
    format?: string;
    search?: string;
  }) {
    try {
      // Use the public endpoint which is what the marketplace needs
      const response = await api.get('/api/pitches/public', { params });
      
      console.log('Raw API response:', response.data); // Debug log
      
      // Handle various response formats from the backend
      // The backend may return data in different structures
      let pitches = [];
      
      if (response.data) {
        // First check for the actual format: {success: true, data: [...]}
        if (response.data.success && Array.isArray(response.data.data)) {
          pitches = response.data.data;
        } else if (Array.isArray(response.data)) {
          // Direct array response
          pitches = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // Nested data structure
          pitches = response.data.data;
        } else if (response.data.items && Array.isArray(response.data.items)) {
          // Items structure
          pitches = response.data.items;
        } else if (response.data.pitches && Array.isArray(response.data.pitches)) {
          // Pitches structure
          pitches = response.data.pitches;
        }
      }
      
      console.log('Extracted pitches count:', pitches.length); // Debug log

      // Transform each pitch to ensure camelCase fields
      const transformedPitches = Array.isArray(pitches)
        ? pitches.map(transformPitchData)
        : [];

      return transformedPitches;
    } catch (error) {
      console.error('Failed to fetch pitches:', error);
      return [];
    }
  },

  async getById(id: number) {
    const response = await api.get<Pitch>(`/api/pitches/${id}`);
    // Transform snake_case to camelCase
    return transformPitchData(response.data);
  },

  async create(data: {
    title: string;
    logline: string;
    genre: string;
    format: string;
    shortSynopsis?: string;
    longSynopsis?: string;
  }) {
    const response = await api.post<{ success: boolean; data: { data: Pitch } }>('/api/creator/pitches', data);
    return response.data.data.data;
  },

  async update(id: number, data: Partial<Pitch>) {
    const response = await api.put<Pitch>(`/api/pitches/${id}`, data);
    return response.data;
  },

  async delete(id: number) {
    await api.delete(`/api/pitches/${id}`);
  },

  async search(query: string) {
    const response = await api.get<{ results: Pitch[] }>('/api/search', {
      params: { q: query },
    });
    return response.data.results;
  },

  async getTrending() {
    try {
      const response = await api.get<Pitch[]>('/api/trending');
      // Handle various response formats
      if (Array.isArray(response.data)) {
        return response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        return response.data.data;
      } else if (response.data?.items && Array.isArray(response.data.items)) {
        return response.data.items;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch trending pitches:', error);
      return [];
    }
  },

  async signNDA(pitchId: number, ndaType: 'basic' | 'enhanced' = 'basic') {
    const response = await api.post(`/api/pitches/${pitchId}/nda`, { ndaType });
    return response.data;
  },

  async recordView(pitchId: number) {
    const response = await api.post(`/api/pitches/${pitchId}/view`);
    return response.data;
  },

  async getAnalytics(pitchId: number) {
    const response = await api.get(`/api/pitches/${pitchId}/analytics`);
    return response.data;
  },

  async like(pitchId: number) {
    const response = await api.post(`/api/pitches/${pitchId}/like`);
    return response.data;
  },

  async unlike(pitchId: number) {
    const response = await api.delete(`/api/pitches/${pitchId}/like`);
    return response.data;
  },

  async save(pitchId: number) {
    const response = await api.post(`/api/pitches/${pitchId}/save`);
    return response.data;
  },

  async unsave(pitchId: number) {
    const response = await api.delete(`/api/pitches/${pitchId}/save`);
    return response.data;
  },

  async share(pitchId: number, platform: string, message?: string) {
    const response = await api.post(`/api/pitches/${pitchId}/share`, { platform, message });
    return response.data;
  },

  async requestNDA(pitchId: number, message?: string, requestType?: string) {
    const response = await api.post(`/api/pitches/${pitchId}/request-nda`, { message, requestType });
    return response.data;
  },
};

// NDA API
export const ndaAPI = {
  async requestNDA(pitchId: number, customTerms?: string) {
    const response = await api.post<NDA>(`/api/pitches/${pitchId}/nda/request`, {
      customTerms
    });
    return response.data;
  },

  async signNDA(ndaId: number) {
    const response = await api.post<NDA>(`/api/ndas/${ndaId}/sign`);
    return response.data;
  },

  async uploadNDA(pitchId: number, file: File) {
    const formData = new FormData();
    formData.append('nda', file);
    const response = await api.post<NDA>(`/api/pitches/${pitchId}/nda/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async getMyNDAs() {
    const response = await api.get<NDA[]>('/api/ndas/signed');
    return response.data;
  },

  async getPendingNDAs() {
    const response = await api.get<NDA[]>('/api/ndas/incoming-requests');
    return response.data;
  },
};

export default api;