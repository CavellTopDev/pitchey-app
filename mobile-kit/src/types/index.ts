/**
 * Shared TypeScript interfaces for Pitchey Mobile Development
 * Compatible with React Native and Web platforms
 */

// User Types
export interface User {
  id: number;
  email: string;
  display_name: string;
  user_type: 'creator' | 'investor' | 'production';
  profile_image_url?: string;
  bio?: string;
  location?: string;
  verified?: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserProfile extends User {
  follower_count: number;
  following_count: number;
  pitch_count: number;
  total_views: number;
  social_links?: {
    website?: string;
    twitter?: string;
    instagram?: string;
    linkedin?: string;
  };
}

// Pitch Types
export interface Pitch {
  id: number;
  title: string;
  description: string;
  genre: string;
  format: string;
  status: 'draft' | 'published' | 'archived';
  thumbnail_url?: string;
  video_url?: string;
  document_urls?: string[];
  view_count: number;
  like_count: number;
  comment_count: number;
  user_id: number;
  creator_name: string;
  creator_avatar?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
  tags?: string[];
  budget_range?: {
    min: number;
    max: number;
    currency: string;
  };
  seeking_amount?: number;
  equity_offered?: number;
  production_timeline?: string;
}

export interface PitchDetail extends Pitch {
  full_description: string;
  target_audience: string;
  marketing_strategy?: string;
  financial_projections?: {
    revenue_streams: string[];
    break_even_timeline: string;
    roi_projection: number;
  };
  team_members?: Array<{
    name: string;
    role: string;
    bio: string;
    image_url?: string;
  }>;
  attachments?: Array<{
    id: number;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
  nda_required: boolean;
  nda_status?: 'not_requested' | 'pending' | 'signed' | 'rejected';
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface OptimizedResponse<T = any> extends ApiResponse<T> {
  meta?: {
    optimized?: string;
    connectionType?: string;
    effectiveType?: string;
  };
}

// Authentication Types
export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo: DeviceInfo;
  rememberDevice?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
  deviceId: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'web';
  version?: string;
  model?: string;
  pushToken?: string;
}

export interface MobileDevice {
  id: string;
  device_name: string;
  platform: 'ios' | 'android' | 'web';
  device_model?: string;
  app_version?: string;
  registered_at: string;
  last_activity: string;
  is_active: boolean;
  has_push_notifications: boolean;
}

// Notification Types
export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  read_at?: string;
  created_at: string;
  metadata?: any;
}

// Dashboard Types
export interface DashboardStats {
  [key: string]: number | string;
}

export interface CreatorDashboard {
  user_type: 'creator';
  stats: {
    total_pitches: number;
    total_views: number;
    followers: number;
  };
  recent_pitches: Array<{
    id: number;
    title: string;
    view_count: number;
    created_at: string;
  }>;
}

export interface InvestorDashboard {
  user_type: 'investor';
  stats: {
    investment_interests: number;
    saved_pitches: number;
    signed_ndas: number;
  };
}

export interface ProductionDashboard {
  user_type: 'production';
  stats: {
    submissions: number;
    projects: number;
  };
}

export type UserDashboard = CreatorDashboard | InvestorDashboard | ProductionDashboard;

// Search Types
export interface SearchFilters {
  genre?: string;
  format?: string;
  budget_min?: number;
  budget_max?: number;
  seeking_amount_min?: number;
  seeking_amount_max?: number;
  tags?: string[];
  user_type?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface SearchRequest {
  query?: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
  sort_by?: 'relevance' | 'date' | 'views' | 'popularity';
  sort_order?: 'asc' | 'desc';
}

// Mobile-specific Types
export interface ConnectionInfo {
  isConnected: boolean;
  type: string;
  effectiveType?: '2g' | '3g' | '4g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
}

export interface CacheStatus {
  caches: {
    static: number;
    images: number;
    api: number;
    dynamic: number;
    mobile?: number;
  };
  connectionType: string;
  effectiveType: string;
  version: string;
}

export interface OfflineAction {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retry_count: number;
  max_retries: number;
}

// File Upload Types
export interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

export interface ChunkedUploadSession {
  id: string;
  filename: string;
  total_size: number;
  chunk_size: number;
  total_chunks: number;
  uploaded_chunks: number;
  status: 'active' | 'completed' | 'failed';
  created_at: string;
  expires_at: string;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError extends ApiError {
  field: string;
  value?: any;
}

// Configuration Types
export interface MobileConfig {
  apiBaseUrl: string;
  wsBaseUrl?: string;
  vapidPublicKey?: string;
  environment: 'development' | 'staging' | 'production';
  features: {
    pushNotifications: boolean;
    offlineMode: boolean;
    biometric: boolean;
    caching: boolean;
  };
  cache: {
    maxSize: number;
    ttl: number;
    strategies: {
      images: 'cache-first' | 'network-first' | 'stale-while-revalidate';
      api: 'cache-first' | 'network-first' | 'stale-while-revalidate';
      static: 'cache-first' | 'network-first' | 'stale-while-revalidate';
    };
  };
}

// Generic utility types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch?: number;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
}

// Event types for mobile analytics
export interface AnalyticsEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
  user_id?: number;
  session_id: string;
  platform: string;
  app_version?: string;
}

export interface PerformanceMetric {
  metric: string;
  value: number;
  unit: string;
  timestamp: number;
  context?: Record<string, any>;
}

// Export commonly used type unions
export type UserType = User['user_type'];
export type PitchStatus = Pitch['status'];
export type Platform = DeviceInfo['platform'];
export type SortBy = SearchRequest['sort_by'];
export type SortOrder = SearchRequest['sort_order'];

// Export default configurations
export const DEFAULT_PAGINATION_LIMIT = 20;
export const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds
export const DEFAULT_RETRY_ATTEMPTS = 3;