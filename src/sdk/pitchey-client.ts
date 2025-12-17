/**
 * Pitchey Platform API Client SDK
 * TypeScript/JavaScript client for interacting with the Pitchey API
 */

export interface PitcheyConfig {
  baseUrl: string;
  apiKey?: string;
  sessionCookie?: string;
  timeout?: number;
  retryAttempts?: number;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  session?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  type: 'creator' | 'investor' | 'production';
  profileImage?: string;
  bio?: string;
}

export interface Pitch {
  id: string;
  title: string;
  logline: string;
  genre: string;
  format: string;
  status: 'draft' | 'active' | 'archived';
  creatorId: string;
  synopsis?: string;
  targetAudience?: string;
  comparableWorks?: string[];
  createdAt: Date;
  updatedAt: Date;
  viewCount?: number;
  tags?: string[];
}

export interface NDARequest {
  id: string;
  pitchId: string;
  requesterId: string;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
  createdAt: Date;
  respondedAt?: Date;
}

export class PitcheyClient {
  private config: PitcheyConfig;
  private headers: HeadersInit;

  constructor(config: PitcheyConfig) {
    this.config = {
      timeout: 30000,
      retryAttempts: 3,
      ...config
    };

    this.headers = {
      'Content-Type': 'application/json',
      ...(config.apiKey && { 'X-API-Key': config.apiKey }),
      ...(config.sessionCookie && { 'Cookie': config.sessionCookie })
    };
  }

  /**
   * Make authenticated request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    let lastError;
    for (let attempt = 0; attempt < (this.config.retryAttempts || 1); attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.headers,
            ...options.headers
          },
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API Error: ${response.status} - ${error}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < (this.config.retryAttempts || 1) - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError;
  }

  // =================
  // Authentication
  // =================

  /**
   * Login to the platform
   */
  async login(portal: 'creator' | 'investor' | 'production', email: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>(`/api/auth/${portal}/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  /**
   * Register new account
   */
  async register(
    portal: 'creator' | 'investor' | 'production',
    data: {
      email: string;
      password: string;
      name: string;
      company?: string;
    }
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>(`/api/auth/${portal}/register`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Logout
   */
  async logout(): Promise<{ success: boolean }> {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  /**
   * Get current session
   */
  async getSession(): Promise<User | null> {
    try {
      return await this.request<User>('/api/auth/session');
    } catch {
      return null;
    }
  }

  // =================
  // User Management
  // =================

  /**
   * Get user profile
   */
  async getProfile(userId?: string): Promise<User> {
    const endpoint = userId ? `/api/users/${userId}` : '/api/users/profile';
    return this.request<User>(endpoint);
  }

  /**
   * Update user profile
   */
  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Upload profile image
   */
  async uploadProfileImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<{ url: string }>('/api/users/profile/image', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for multipart
    });
  }

  // =================
  // Pitches
  // =================

  /**
   * Get trending pitches
   */
  async getTrendingPitches(limit = 10): Promise<Pitch[]> {
    return this.request<Pitch[]>(`/api/pitches/trending?limit=${limit}`);
  }

  /**
   * Get featured pitches
   */
  async getFeaturedPitches(limit = 10): Promise<Pitch[]> {
    return this.request<Pitch[]>(`/api/pitches/featured?limit=${limit}`);
  }

  /**
   * Search pitches
   */
  async searchPitches(params: {
    query?: string;
    genre?: string;
    format?: string;
    page?: number;
    limit?: number;
  }): Promise<{ pitches: Pitch[]; total: number }> {
    const queryParams = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    );
    return this.request<{ pitches: Pitch[]; total: number }>(`/api/pitches/search?${queryParams}`);
  }

  /**
   * Get pitch by ID
   */
  async getPitch(id: string): Promise<Pitch> {
    return this.request<Pitch>(`/api/pitches/${id}`);
  }

  /**
   * Create new pitch
   */
  async createPitch(data: Partial<Pitch>): Promise<Pitch> {
    return this.request<Pitch>('/api/pitches', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * Update pitch
   */
  async updatePitch(id: string, data: Partial<Pitch>): Promise<Pitch> {
    return this.request<Pitch>(`/api/pitches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * Delete pitch
   */
  async deletePitch(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/pitches/${id}`, {
      method: 'DELETE'
    });
  }

  /**
   * Save/unsave pitch
   */
  async savePitch(id: string, save = true): Promise<{ success: boolean }> {
    const method = save ? 'POST' : 'DELETE';
    return this.request<{ success: boolean }>(`/api/pitches/${id}/save`, { method });
  }

  // =================
  // NDAs
  // =================

  /**
   * Request NDA for a pitch
   */
  async requestNDA(pitchId: string, message?: string): Promise<NDARequest> {
    return this.request<NDARequest>('/api/nda/request', {
      method: 'POST',
      body: JSON.stringify({ pitchId, message })
    });
  }

  /**
   * Get NDA requests
   */
  async getNDARequests(type: 'incoming' | 'outgoing' = 'incoming'): Promise<NDARequest[]> {
    return this.request<NDARequest[]>(`/api/nda/requests?type=${type}`);
  }

  /**
   * Respond to NDA request
   */
  async respondToNDA(
    requestId: string,
    action: 'approve' | 'reject',
    message?: string
  ): Promise<NDARequest> {
    return this.request<NDARequest>(`/api/nda/requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action, message })
    });
  }

  /**
   * Check NDA status for a pitch
   */
  async checkNDAStatus(pitchId: string): Promise<{
    hasAccess: boolean;
    request?: NDARequest;
  }> {
    return this.request(`/api/nda/status/${pitchId}`);
  }

  // =================
  // File Upload
  // =================

  /**
   * Upload file
   */
  async uploadFile(
    file: File,
    type: 'pitch_deck' | 'screenplay' | 'treatment' | 'nda' | 'other'
  ): Promise<{ id: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return this.request<{ id: string; url: string }>('/api/upload', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type
    });
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  // =================
  // Notifications
  // =================

  /**
   * Get notifications
   */
  async getNotifications(unreadOnly = false): Promise<Notification[]> {
    return this.request<Notification[]>(`/api/notifications?unread=${unreadOnly}`);
  }

  /**
   * Mark notification as read
   */
  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(`/api/notifications/${id}/read`, {
      method: 'PUT'
    });
  }

  /**
   * Get notification settings
   */
  async getNotificationSettings(): Promise<any> {
    return this.request('/api/notifications/settings');
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings: any): Promise<any> {
    return this.request('/api/notifications/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // =================
  // WebSocket
  // =================

  /**
   * Connect to WebSocket for real-time updates
   */
  connectWebSocket(handlers: {
    onMessage?: (data: any) => void;
    onError?: (error: Error) => void;
    onClose?: () => void;
    onOpen?: () => void;
  }): WebSocket {
    const wsUrl = this.config.baseUrl.replace('http', 'ws') + '/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      handlers.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handlers.onMessage?.(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      handlers.onError?.(error as any);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      handlers.onClose?.();
    };

    return ws;
  }

  // =================
  // Analytics
  // =================

  /**
   * Get dashboard analytics
   */
  async getDashboardAnalytics(): Promise<any> {
    return this.request('/api/analytics/dashboard');
  }

  /**
   * Get pitch analytics
   */
  async getPitchAnalytics(pitchId: string): Promise<any> {
    return this.request(`/api/analytics/pitch/${pitchId}`);
  }

  /**
   * Track event
   */
  async trackEvent(event: string, data?: any): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify({ event, data })
    });
  }

  // =================
  // Search & Discovery
  // =================

  /**
   * Get genres
   */
  async getGenres(): Promise<string[]> {
    return this.request<string[]>('/api/genres');
  }

  /**
   * Get formats
   */
  async getFormats(): Promise<string[]> {
    return this.request<string[]>('/api/formats');
  }

  /**
   * Get recommendations
   */
  async getRecommendations(): Promise<Pitch[]> {
    return this.request<Pitch[]>('/api/recommendations');
  }

  // =================
  // Messaging
  // =================

  /**
   * Get conversations
   */
  async getConversations(): Promise<any[]> {
    return this.request<any[]>('/api/messages/conversations');
  }

  /**
   * Get messages
   */
  async getMessages(conversationId: string): Promise<any[]> {
    return this.request<any[]>(`/api/messages/${conversationId}`);
  }

  /**
   * Send message
   */
  async sendMessage(recipientId: string, message: string): Promise<any> {
    return this.request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ recipientId, message })
    });
  }

  // =================
  // Admin
  // =================

  /**
   * Get system health
   */
  async getHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, boolean>;
  }> {
    return this.request('/health');
  }

  /**
   * Get system metrics
   */
  async getMetrics(): Promise<any> {
    return this.request('/metrics');
  }

  /**
   * Clear cache (admin only)
   */
  async clearCache(adminToken: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/admin/cache', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });
  }

  /**
   * Warm cache (admin only)
   */
  async warmCache(adminToken: string, priority = 1): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/api/admin/cache/warm', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ priority })
    });
  }
}

// Export for different module systems
export default PitcheyClient;

// CommonJS support
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PitcheyClient;
  module.exports.PitcheyClient = PitcheyClient;
}