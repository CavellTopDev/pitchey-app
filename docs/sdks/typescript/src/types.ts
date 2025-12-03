/**
 * TypeScript type definitions for the Pitchey API
 * Generated from OpenAPI specification
 */

// ============================================================================
// Base Types
// ============================================================================

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  timestamp?: string;
  details?: Record<string, any>;
}

export interface ValidationError {
  error: string;
  validation_errors: Array<{
    field: string;
    message: string;
  }>;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  userType: UserType;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expires_in?: number;
}

// ============================================================================
// User Types
// ============================================================================

export type UserType = 'creator' | 'investor' | 'production' | 'admin' | 'viewer';
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';
export type NotificationFrequency = 'real-time' | 'daily' | 'weekly' | 'monthly';

export interface User {
  id: number;
  email: string;
  username: string;
  userType: UserType;
  firstName?: string;
  lastName?: string;
  phone?: string;
  location?: string;
  bio?: string;
  website?: string;
  avatar_url?: string;
  companyName?: string;
  companyWebsite?: string;
  emailVerified: boolean;
  companyVerified: boolean;
  isActive: boolean;
  subscriptionTier: SubscriptionTier;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  email_notifications: boolean;
  marketing_emails: boolean;
  privacy_settings: Record<string, any>;
  preferred_genres: string[];
  preferred_formats: string[];
  preferred_budget_ranges: string[];
  notification_frequency: NotificationFrequency;
}

// ============================================================================
// Pitch Types
// ============================================================================

export type PitchFormat = 'feature' | 'short' | 'series' | 'documentary' | 'animation';
export type PitchStage = 'concept' | 'treatment' | 'script' | 'pre-production' | 'production' | 'post-production' | 'distribution';
export type PitchVisibility = 'public' | 'private' | 'nda_required';
export type PitchStatus = 'active' | 'archived' | 'under_review' | 'rejected';

export interface Pitch {
  id: number;
  userId: number;
  title: string;
  logline: string;
  description?: string;
  genre: string;
  format: PitchFormat;
  formatCategory?: string;
  shortSynopsis?: string;
  longSynopsis?: string;
  targetAudience?: string;
  characters?: string;
  themes?: string;
  worldDescription?: string;
  budgetRange?: string;
  estimatedBudget?: number;
  stage: PitchStage;
  videoUrl?: string;
  posterUrl?: string;
  pitchDeckUrl?: string;
  visibility: PitchVisibility;
  status: PitchStatus;
  viewCount: number;
  likeCount: number;
  ndaCount: number;
  requireNda: boolean;
  seekingInvestment: boolean;
  productionStage: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

export interface CreatePitchData {
  title: string;
  logline: string;
  description?: string;
  genre: string;
  format: PitchFormat;
  shortSynopsis?: string;
  longSynopsis?: string;
  targetAudience?: string;
  characters?: string;
  themes?: string;
  budgetRange?: string;
  seekingInvestment?: boolean;
  requireNda?: boolean;
  visibility?: PitchVisibility;
}

export interface UpdatePitchData extends Partial<CreatePitchData> {}

export interface PitchFilters {
  genre?: string;
  format?: PitchFormat;
  budgetRange?: string;
  stage?: PitchStage;
  seekingInvestment?: boolean;
  status?: PitchStatus;
}

export interface PitchSearchParams extends PitchFilters {
  q?: string;
  sort?: 'newest' | 'oldest' | 'most_liked' | 'most_viewed' | 'trending' | 'relevance';
  page?: number;
  limit?: number;
}

// ============================================================================
// NDA Types
// ============================================================================

export type NDAStatus = 'pending' | 'approved' | 'rejected' | 'signed' | 'expired';
export type NDAType = 'basic' | 'custom' | 'mutual';

export interface NDA {
  id: number;
  pitchId: number;
  userId: number;
  signerId?: number;
  status: NDAStatus;
  ndaType: NDAType;
  accessGranted: boolean;
  signedAt?: string;
  expiresAt?: string;
  documentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RequestNDAData {
  pitchId: number;
  message?: string;
}

// ============================================================================
// Message Types
// ============================================================================

export type MessageType = 'text' | 'pitch_share' | 'nda_request' | 'system';

export interface Message {
  id: number;
  conversationId?: number;
  senderId: number;
  receiverId: number;
  subject?: string;
  content: string;
  messageType: MessageType;
  pitchId?: number;
  read: boolean;
  readAt?: string;
  sentAt: string;
  createdAt: string;
}

export interface Conversation {
  id: number;
  participants: User[];
  lastMessage: Message;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SendMessageData {
  receiverId: number;
  subject?: string;
  content: string;
  pitchId?: number;
  messageType?: MessageType;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationType = 'message' | 'nda_request' | 'pitch_like' | 'follow' | 'system' | 'investment';

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  relatedId?: number;
  relatedType?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationFilters {
  type?: NotificationType;
  read?: boolean;
}

// ============================================================================
// Investment Types
// ============================================================================

export type InvestmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Investment {
  id: number;
  investorId: number;
  pitchId: number;
  amount: number;
  currentValue?: number;
  status: InvestmentStatus;
  createdAt: string;
  updatedAt: string;
  pitch?: Pitch;
}

export interface TrackInvestmentData {
  pitchId: number;
  amount: number;
  notes?: string;
}

// ============================================================================
// Media Types
// ============================================================================

export type MediaType = 'poster' | 'video' | 'pitch_deck' | 'script' | 'lookbook' | 'trailer';

export interface MediaFile {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: MediaType;
  createdAt: string;
}

export interface UploadMediaData {
  file: File | Blob;
  type: MediaType;
  pitchId?: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export type AnalyticsEventType = 
  | 'page_view' 
  | 'pitch_view' 
  | 'pitch_like' 
  | 'nda_request' 
  | 'login' 
  | 'search'
  | 'message_sent'
  | 'registration'
  | 'investment_tracked';

export interface AnalyticsEvent {
  id: number;
  eventType: AnalyticsEventType;
  eventCategory?: string;
  userId?: number;
  pitchId?: number;
  sessionId?: string;
  eventData?: Record<string, any>;
  createdAt: string;
}

export interface TrackEventData {
  eventType: AnalyticsEventType;
  eventCategory?: string;
  pitchId?: number;
  eventData?: Record<string, any>;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResults {
  pitches: Pitch[];
  users: User[];
  total: number;
  query: string;
  filters: Record<string, any>;
  meta: PaginationMeta;
}

export interface AdvancedSearchParams {
  query?: string;
  genres?: string[];
  formats?: string[];
  budgetRanges?: string[];
  stages?: string[];
  seekingInvestment?: boolean;
  sort?: 'relevance' | 'newest' | 'oldest' | 'most_liked' | 'most_viewed' | 'budget_asc' | 'budget_desc';
  page?: number;
  limit?: number;
}

// ============================================================================
// Watchlist Types
// ============================================================================

export interface WatchlistItem {
  pitchId: number;
  addedAt: string;
}

export interface AddToWatchlistData {
  pitchId: number;
}

// ============================================================================
// System Types
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  database: 'connected' | 'disconnected';
  timestamp: string;
  version?: string;
  error?: string;
}

// ============================================================================
// SDK Configuration Types
// ============================================================================

export interface SDKConfig {
  apiUrl?: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  debug?: boolean;
  userAgent?: string;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

// ============================================================================
// Error Types
// ============================================================================

export class PitcheyAPIError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, status: number, code: string, details?: any) {
    super(message);
    this.name = 'PitcheyAPIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class PitcheyValidationError extends PitcheyAPIError {
  public readonly validation_errors: Array<{ field: string; message: string }>;

  constructor(message: string, validationErrors: Array<{ field: string; message: string }>) {
    super(message, 400, 'VALIDATION_ERROR', { validation_errors: validationErrors });
    this.name = 'PitcheyValidationError';
    this.validation_errors = validationErrors;
  }
}

export class PitcheyAuthenticationError extends PitcheyAPIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
    this.name = 'PitcheyAuthenticationError';
  }
}

export class PitcheyAuthorizationError extends PitcheyAPIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
    this.name = 'PitcheyAuthorizationError';
  }
}

export class PitcheyNotFoundError extends PitcheyAPIError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND_ERROR');
    this.name = 'PitcheyNotFoundError';
  }
}

export class PitcheyRateLimitError extends PitcheyAPIError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'PitcheyRateLimitError';
    this.retryAfter = retryAfter;
  }
}