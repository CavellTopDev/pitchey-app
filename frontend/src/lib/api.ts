import axios from 'axios';
import { config } from '../config';

const API_URL = config.API_URL;

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
    // Don't redirect for public endpoints
    const isPublicEndpoint = error.config?.url?.includes('/public/');
    if (error.response?.status === 401 && !isPublicEndpoint) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

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
    const response = await api.post<{ success: boolean; data: { user: User; token: string } }>(
      '/api/auth/creator/login',
      { email, password }
    );
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
    const response = await api.post<{ success: boolean; data: { user: User; token: string } }>(
      '/api/auth/investor/login',
      { email, password }
    );
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
    const response = await api.post<{ success: boolean; data: { user: User; token: string } }>(
      '/api/auth/production/login',
      { email, password }
    );
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
    return response.data.data;
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    genre?: string;
    format?: string;
    search?: string;
  }) {
    // Use the public endpoint which is what the marketplace needs
    const response = await api.get('/api/pitches/public', { params });
    // Handle the response format from the backend
    // Backend returns { success: true, data: [...pitches], total: number }
    const pitches = response.data.data || response.data.items || [];
    return Array.isArray(pitches) ? pitches : [];
  },

  async getById(id: number) {
    const response = await api.get<Pitch>(`/api/pitches/${id}`);
    return response.data;
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
    const response = await api.get<Pitch[]>('/api/trending');
    return response.data;
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
    const response = await api.post<NDA>(`/api/nda/${ndaId}/sign`);
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
    const response = await api.get<NDA[]>('/api/nda/my');
    return response.data;
  },

  async getPendingNDAs() {
    const response = await api.get<NDA[]>('/api/nda/pending');
    return response.data;
  },
};

export default api;