/**
 * Pitchey API Client for React Native and Mobile Web
 * Provides type-safe API access with mobile optimizations
 */

import {
  User,
  Pitch,
  PitchDetail,
  UserDashboard,
  ApiResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  SearchRequest,
  Notification,
  MobileDevice,
  DeviceInfo,
  ConnectionInfo,
  MobileConfig,
  AsyncState,
  DEFAULT_PAGINATION_LIMIT,
  DEFAULT_REQUEST_TIMEOUT,
  DEFAULT_RETRY_ATTEMPTS
} from '../types';

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  optimizeForConnection?: boolean;
  priority?: 'high' | 'normal' | 'low';
}

export interface PitcheyApiClientConfig extends Partial<MobileConfig> {
  apiBaseUrl: string;
  timeout?: number;
  retries?: number;
  enableOfflineMode?: boolean;
  enableMobileOptimizations?: boolean;
}

export class PitcheyApiClient {
  private config: PitcheyApiClientConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private deviceId: string | null = null;
  private connectionInfo: ConnectionInfo | null = null;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  
  constructor(config: PitcheyApiClientConfig) {
    this.config = {
      timeout: DEFAULT_REQUEST_TIMEOUT,
      retries: DEFAULT_RETRY_ATTEMPTS,
      enableOfflineMode: true,
      enableMobileOptimizations: true,
      ...config
    };
  }

  // Configuration methods
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  setDeviceId(deviceId: string): void {
    this.deviceId = deviceId;
  }

  setConnectionInfo(connectionInfo: ConnectionInfo): void {
    this.connectionInfo = connectionInfo;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.deviceId = null;
  }

  // Authentication methods
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/mobile/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    if (response.success && response.data) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
      this.setDeviceId(response.data.deviceId);
    }

    return response.data!;
  }

  async refreshTokens(): Promise<{ accessToken: string; expiresIn: number } | null> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.request<{ accessToken: string; expiresIn: number; user: User }>('/api/mobile/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken })
      });

      if (response.success && response.data) {
        this.accessToken = response.data.accessToken;
        return {
          accessToken: response.data.accessToken,
          expiresIn: response.data.expiresIn
        };
      }

      return null;
    } catch (error) {
      this.clearTokens();
      throw error;
    }
  }

  async logout(): Promise<void> {
    if (this.accessToken && this.deviceId) {
      try {
        await this.request('/api/mobile/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ deviceId: this.deviceId })
        });
      } catch (error) {
        console.warn('Logout request failed:', error);
      }
    }
    
    this.clearTokens();
    this.clearCache();
  }

  // Pitch methods
  async getTrendingPitches(page = 1, limit = DEFAULT_PAGINATION_LIMIT, filters?: { genre?: string; format?: string }): Promise<PaginatedResponse<Pitch>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...filters
    });

    return this.request<Pitch[]>(`/api/mobile/pitches/trending?${params}`, {
      cache: true
    });
  }

  async getPitchById(id: number): Promise<PitchDetail> {
    const response = await this.request<PitchDetail>(`/api/mobile/pitches/${id}`, {
      cache: true
    });
    return response.data!;
  }

  async searchPitches(searchRequest: SearchRequest): Promise<PaginatedResponse<Pitch>> {
    const params = new URLSearchParams();
    
    if (searchRequest.query) params.set('q', searchRequest.query);
    if (searchRequest.page) params.set('page', searchRequest.page.toString());
    if (searchRequest.limit) params.set('limit', searchRequest.limit.toString());
    if (searchRequest.filters?.genre) params.set('genre', searchRequest.filters.genre);
    if (searchRequest.filters?.format) params.set('format', searchRequest.filters.format);

    return this.request<Pitch[]>(`/api/mobile/search/pitches?${params}`, {
      cache: true
    });
  }

  async likePitch(pitchId: number): Promise<void> {
    await this.request(`/api/pitches/${pitchId}/like`, {
      method: 'POST'
    });
  }

  async savePitch(pitchId: number): Promise<void> {
    await this.request(`/api/pitches/${pitchId}/save`, {
      method: 'POST'
    });
  }

  // User methods
  async getUserProfile(userId?: number): Promise<User> {
    const endpoint = userId ? `/api/users/${userId}/profile` : '/api/users/profile';
    const response = await this.request<User>(endpoint, { cache: true });
    return response.data!;
  }

  async updateUserProfile(updates: Partial<User>): Promise<User> {
    const response = await this.request<User>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    return response.data!;
  }

  async followUser(userId: number): Promise<void> {
    await this.request(`/api/users/${userId}/follow`, {
      method: 'POST'
    });
  }

  async unfollowUser(userId: number): Promise<void> {
    await this.request(`/api/users/${userId}/unfollow`, {
      method: 'DELETE'
    });
  }

  // Dashboard methods
  async getDashboard(): Promise<UserDashboard> {
    const response = await this.request<UserDashboard>('/api/mobile/dashboard', {
      cache: true
    });
    return response.data!;
  }

  // Notifications methods
  async getNotifications(page = 1, limit = DEFAULT_PAGINATION_LIMIT, unreadOnly = false): Promise<PaginatedResponse<Notification>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      unread_only: unreadOnly.toString()
    });

    return this.request<Notification[]>(`/api/mobile/notifications?${params}`);
  }

  async markNotificationAsRead(notificationId: number): Promise<void> {
    await this.request(`/api/notifications/${notificationId}/read`, {
      method: 'POST'
    });
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.request('/api/notifications/read-all', {
      method: 'POST'
    });
  }

  // Device management methods
  async getDevices(): Promise<MobileDevice[]> {
    const response = await this.request<{ devices: MobileDevice[] }>('/api/mobile/devices');
    return response.data!.devices;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    await this.request(`/api/mobile/devices/${deviceId}/revoke`, {
      method: 'DELETE'
    });
  }

  async updatePushToken(pushToken: string): Promise<void> {
    await this.request('/api/mobile/push/token', {
      method: 'PUT',
      body: JSON.stringify({ pushToken, deviceId: this.deviceId })
    });
  }

  // Push notification methods
  async subscribeToPushNotifications(subscription: any): Promise<{ vapidPublicKey: string }> {
    const response = await this.request<{ vapidPublicKey: string }>('/api/mobile/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        subscription,
        deviceId: this.deviceId,
        platform: this.getPlatform()
      })
    });
    return response.data!;
  }

  async unsubscribeFromPushNotifications(): Promise<void> {
    await this.request('/api/mobile/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ deviceId: this.deviceId })
    });
  }

  async updateNotificationPreferences(preferences: Record<string, boolean>): Promise<void> {
    await this.request('/api/mobile/push/preferences', {
      method: 'PUT',
      body: JSON.stringify({ preferences })
    });
  }

  async testPushNotification(): Promise<void> {
    await this.request('/api/mobile/push/test', {
      method: 'POST'
    });
  }

  // Core request method
  private async request<T>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.apiBaseUrl}${endpoint}`;
    const cacheKey = `${options.method || 'GET'}:${url}`;

    // Check cache first if caching is enabled
    if (options.cache && this.isValidCacheEntry(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return { success: true, data: cached.data, timestamp: new Date().toISOString() };
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getMobileHeaders(),
      ...options.headers as Record<string, string>
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Prepare request options
    const requestOptions: RequestInit = {
      method: 'GET',
      headers,
      ...options,
      signal: AbortSignal.timeout(options.timeout || this.config.timeout || DEFAULT_REQUEST_TIMEOUT)
    };

    const maxRetries = options.retries !== undefined ? options.retries : this.config.retries || DEFAULT_RETRY_ATTEMPTS;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, requestOptions);

        // Handle token refresh on 401
        if (response.status === 401 && this.refreshToken && attempt === 0) {
          const refreshed = await this.refreshTokens();
          if (refreshed) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
            continue; // Retry with new token
          }
        }

        const responseData = await response.json() as ApiResponse<T>;

        if (!response.ok) {
          throw new Error(responseData.error || `HTTP ${response.status}`);
        }

        // Cache successful responses
        if (options.cache && responseData.success) {
          this.setCacheEntry(cacheKey, responseData.data, this.getCacheTTL());
        }

        return responseData;

      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (this.isNonRetryableError(error as Error)) {
          break;
        }

        if (attempt < maxRetries) {
          await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
        }
      }
    }

    throw lastError || new Error('Request failed after all retries');
  }

  // Utility methods
  private getMobileHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Client-Type': 'mobile',
      'X-Client-Version': '1.0.0'
    };

    if (this.connectionInfo) {
      if (this.connectionInfo.effectiveType) {
        headers['Effective-Connection-Type'] = this.connectionInfo.effectiveType;
      }
      if (this.connectionInfo.downlink) {
        headers['Downlink'] = this.connectionInfo.downlink.toString();
      }
      if (this.connectionInfo.rtt) {
        headers['RTT'] = this.connectionInfo.rtt.toString();
      }
    }

    return headers;
  }

  private getPlatform(): 'ios' | 'android' | 'web' {
    // This would be determined by the platform-specific implementation
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent;
      if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';
      if (/Android/.test(userAgent)) return 'android';
    }
    return 'web';
  }

  private isValidCacheEntry(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const age = Date.now() - entry.timestamp;
    return age < entry.ttl;
  }

  private setCacheEntry(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });

    // Prevent cache from growing too large
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }

  private getCacheTTL(): number {
    if (!this.connectionInfo?.isConnected) {
      return 60 * 60 * 1000; // 1 hour for offline
    }

    switch (this.connectionInfo?.effectiveType) {
      case '2g':
      case 'slow-2g':
        return 10 * 60 * 1000; // 10 minutes
      case '3g':
        return 5 * 60 * 1000; // 5 minutes
      default:
        return 2 * 60 * 1000; // 2 minutes
    }
  }

  private clearCache(): void {
    this.cache.clear();
  }

  private isNonRetryableError(error: Error): boolean {
    return error.message.includes('400') || 
           error.message.includes('401') || 
           error.message.includes('403') || 
           error.message.includes('404');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function for creating API client instances
export function createPitcheyApiClient(config: PitcheyApiClientConfig): PitcheyApiClient {
  return new PitcheyApiClient(config);
}

// Default configuration for different environments
export const ApiClientConfigs = {
  development: {
    apiBaseUrl: 'http://localhost:8001',
    timeout: 10000,
    retries: 2,
    enableOfflineMode: true,
    enableMobileOptimizations: true
  },
  production: {
    apiBaseUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    timeout: 15000,
    retries: 3,
    enableOfflineMode: true,
    enableMobileOptimizations: true
  }
} as const;