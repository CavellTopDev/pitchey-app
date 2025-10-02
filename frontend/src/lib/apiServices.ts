import apiClient, { ndaAPI as newNdaAPI, authAPI, pitchAPI as newPitchAPI } from './api-client';
import { config } from '../config';

const API_URL = config.API_URL;

// Helper function to get auth headers (for backwards compatibility)
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

// Helper function to get userId from auth token
const getUserId = (): string | null => {
  try {
    // First try to get from stored user data
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.id) {
        return user.id.toString();
      }
    }

    // Fallback to extracting from JWT token
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // Handle different possible payload structures
        const userId = payload.userId || payload.user_id || payload.id || payload.sub;
        return userId ? userId.toString() : null;
      } catch (jwtError) {
        console.error('Error parsing JWT token:', jwtError);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
};

// Export the new robust API client for new code
export { apiClient, authAPI, getUserId };

// NDA Services (Updated to use robust API client)
export const ndaAPI = {
  // Use new API client methods
  ...newNdaAPI,
  
  // Legacy methods for backwards compatibility
  legacy: {
  // Create NDA request
  async createRequest(pitchId: number, data: {
    ndaType?: 'basic' | 'enhanced' | 'custom';
    requestMessage?: string;
    companyInfo?: {
      companyName: string;
      position: string;
      intendedUse: string;
    };
  }) {
    const response = await fetch(`${API_URL}/api/ndas/request`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pitchId, ...data }),
    });
    return response.json();
  },

  // Get NDA requests (incoming or outgoing)
  async getRequests(type: 'incoming' | 'outgoing' = 'outgoing') {
    const response = await fetch(`${API_URL}/api/ndas/request?type=${type}`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  // Approve NDA request
  async approveRequest(requestId: number) {
    const response = await fetch(`${API_URL}/api/ndas/${requestId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  // Reject NDA request
  async rejectRequest(requestId: number, rejectionReason?: string) {
    const response = await fetch(`${API_URL}/api/ndas/${requestId}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ rejectionReason }),
    });
    return response.json();
  },

  // Get signed NDAs
  async getSignedNDAs() {
    const response = await fetch(`${API_URL}/api/ndas/signed`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },
  },
  
  // Enhanced methods using robust API client
  async getSignedNDAs() {
    const response = await apiClient.get('/api/ndas/signed');
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // New categorized NDA endpoints
  async getIncomingSignedNDAs() {
    const response = await apiClient.get('/api/ndas/incoming-signed');
    if (response.success) {
      return { success: true, ndas: response.data.ndas || [], count: response.data.count || 0 };
    }
    return { success: false, error: response.error?.message, ndas: [], count: 0 };
  },

  async getOutgoingSignedNDAs() {
    const response = await apiClient.get('/api/ndas/outgoing-signed');
    if (response.success) {
      return { success: true, ndas: response.data.ndas || [], count: response.data.count || 0 };
    }
    return { success: false, error: response.error?.message, ndas: [], count: 0 };
  },

  async getIncomingRequests() {
    const response = await apiClient.get('/api/ndas/incoming-requests');
    if (response.success) {
      return { success: true, requests: response.data.requests || [], count: response.data.count || 0 };
    }
    return { success: false, error: response.error?.message, requests: [], count: 0 };
  },

  async getOutgoingRequests() {
    const response = await apiClient.get('/api/ndas/outgoing-requests');
    if (response.success) {
      return { success: true, requests: response.data.requests || [], count: response.data.count || 0 };
    }
    return { success: false, error: response.error?.message, requests: [], count: 0 };
  },
};

// Company Verification Services (Updated to use robust API client)
export const companyAPI = {
  // Get verification status
  async getVerificationStatus() {
    const response = await apiClient.get('/api/company/verify');
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Submit verification request
  async submitVerification(data: {
    companyName: string;
    companyNumber: string;
    companyWebsite?: string;
    companyAddress?: string;
  }) {
    const response = await apiClient.post('/api/company/verify', data);
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },
};

// Analytics Services (Updated to use robust API client)
export const analyticsAPI = {
  // Get dashboard analytics
  async getDashboardAnalytics() {
    const response = await apiClient.get('/api/analytics/dashboard');
    if (response.success) {
      // Handle nested response structure
      const analytics = response.data?.analytics || response.data;
      return { success: true, analytics };
    }
    return { success: false, error: response.error?.message };
  },

  // Track view
  async trackView(pitchId: number, viewData?: {
    viewType?: string;
    sessionId?: string;
  }) {
    const response = await apiClient.post('/api/analytics/track-view', { pitchId, ...viewData });
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },
};

// Media Services (keeping existing implementation with file upload support)
export const mediaAPI = {
  // Get media access for a pitch
  async getMediaAccess(pitchId: number) {
    const response = await fetch(`${API_URL}/api/pitches/${pitchId}/media`, {
      headers: getAuthHeaders(),
    });
    return response.json();
  },

  // Upload media files with progress tracking
  async uploadMedia(
    pitchId: number, 
    files: File[], 
    options: {
      fileType?: string;
      title?: string;
      description?: string;
      applyWatermark?: boolean;
      accessLevel?: 'public' | 'basic' | 'enhanced' | 'custom';
      onProgress?: (progress: number) => void;
    } = {}
  ) {
    const formData = new FormData();
    
    // Add files to form data
    files.forEach((file, index) => {
      formData.append(`file${index}`, file);
    });
    
    // Add metadata
    formData.append('pitchId', pitchId.toString());
    if (options.fileType) formData.append('fileType', options.fileType);
    if (options.title) formData.append('title', options.title);
    if (options.description) formData.append('description', options.description);
    if (options.applyWatermark !== undefined) formData.append('applyWatermark', options.applyWatermark.toString());
    if (options.accessLevel) formData.append('accessLevel', options.accessLevel);

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            options.onProgress!(progress);
          }
        });
      }
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.error || 'Upload failed'));
          } catch (e) {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        }
      };
      
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.ontimeout = () => reject(new Error('Upload timeout'));
      
      xhr.open('POST', `${API_URL}/api/media/upload`);
      xhr.setRequestHeader('Authorization', token ? `Bearer ${token}` : '');
      xhr.timeout = 5 * 60 * 1000; // 5 minute timeout
      xhr.send(formData);
    });
  },

  // Delete media file
  async deleteMedia(pitchId: number, mediaId: string) {
    const response = await fetch(`${API_URL}/api/media/delete`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pitchId, mediaId }),
    });
    return response.json();
  },

  // Get media stream URL with access control
  getMediaStreamUrl(mediaId: string, pitchId: number, token?: string) {
    const baseUrl = `${API_URL}/api/media/stream/${mediaId}?pitchId=${pitchId}`;
    if (token) {
      return `${baseUrl}&token=${encodeURIComponent(token)}`;
    }
    return baseUrl;
  },

  // Stream media with authentication
  async streamMedia(mediaId: string, pitchId: number, options: { range?: string } = {}) {
    const headers: Record<string, string> = {
      ...getAuthHeaders(),
    };
    
    // Remove Content-Type for streaming requests
    delete headers['Content-Type'];
    
    if (options.range) {
      headers['Range'] = options.range;
    }

    const response = await fetch(`${API_URL}/api/media/stream/${mediaId}?pitchId=${pitchId}`, {
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response;
  },

  // Check if media requires NDA
  async checkMediaAccess(pitchId: number, mediaId: string) {
    try {
      const response = await this.streamMedia(mediaId, pitchId);
      return { 
        hasAccess: true, 
        requiresNDA: false 
      };
    } catch (error: any) {
      if (error.message.includes('NDA')) {
        return { 
          hasAccess: false, 
          requiresNDA: true,
          reason: error.message 
        };
      }
      return { 
        hasAccess: false, 
        requiresNDA: false,
        reason: error.message 
      };
    }
  },

  // Validate file before upload
  validateFile(file: File, fileType: string): { valid: boolean; error?: string } {
    const allowedTypes: Record<string, { mimeTypes: string[]; maxSize: number }> = {
      'lookbook': { 
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'], 
        maxSize: 50 * 1024 * 1024 
      },
      'script': { 
        mimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'], 
        maxSize: 50 * 1024 * 1024 
      },
      'trailer': { 
        mimeTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/mpeg', 'video/webm'], 
        maxSize: 500 * 1024 * 1024 
      },
      'pitch_deck': { 
        mimeTypes: ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'], 
        maxSize: 50 * 1024 * 1024 
      },
      'budget_breakdown': { 
        mimeTypes: ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'], 
        maxSize: 50 * 1024 * 1024 
      },
      'production_timeline': { 
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'], 
        maxSize: 50 * 1024 * 1024 
      },
      'other': { 
        mimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'video/mp4', 'video/quicktime', 'text/plain'], 
        maxSize: 50 * 1024 * 1024 
      }
    };

    const config = allowedTypes[fileType];
    if (!config) {
      return { valid: false, error: 'Unknown file type' };
    }

    if (!config.mimeTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `Invalid file type. Allowed types for ${fileType}: ${config.mimeTypes.join(', ')}` 
      };
    }

    if (file.size > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return { 
        valid: false, 
        error: `File size exceeds ${maxSizeMB}MB limit` 
      };
    }

    return { valid: true };
  },
};

// Messaging Services (Updated to use robust API client)
export const messageAPI = {
  // Send message
  async sendMessage(data: {
    pitchId: number;
    receiverId: number;
    subject?: string;
    content: string;
    offPlatformRequested?: boolean;
  }) {
    const response = await apiClient.post('/api/messages/send', data);
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Get messages
  async getMessages(type: 'inbox' | 'sent' | 'all' = 'inbox', pitchId?: number) {
    let endpoint = `/api/messages/list?type=${type}`;
    if (pitchId) {
      endpoint += `&pitchId=${pitchId}`;
    }
    const response = await apiClient.get(endpoint);
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Mark message as read
  async markAsRead(messageId: number) {
    const response = await apiClient.post(`/api/messages/${messageId}/read`);
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Approve off-platform request
  async approveOffPlatform(messageId: number) {
    const response = await apiClient.post(`/api/messages/${messageId}/approve-offplatform`);
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },
};

// Pitch Services (Updated to use robust API client)
export const pitchServicesAPI = {
  // Get pitches with NDA status
  async getPitchesWithNDAStatus() {
    const response = await apiClient.get('/api/pitches/with-nda-status');
    if (response.success) {
      return { success: true, pitches: response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Get following pitches
  async getFollowingPitches() {
    const response = await apiClient.get('/api/pitches/following');
    if (response.success) {
      // Check if response.data is already structured with pitches property
      if (response.data && response.data.pitches !== undefined) {
        return response.data; // Already has the correct structure
      }
      // Otherwise wrap in expected structure
      return { success: true, pitches: response.data || [] };
    }
    return { success: false, error: response.error?.message, pitches: [] };
  },

  // Follow/Unfollow pitch
  async toggleFollow(pitchId: number, follow: boolean) {
    const response = await apiClient.post(`/api/pitches/${pitchId}/${follow ? 'follow' : 'unfollow'}`);
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },
};

// Payment Services (Updated to use robust API client)
export const paymentsAPI = {
  // Get subscription status
  async getSubscriptionStatus() {
    const response = await apiClient.get('/api/payments/subscription-status');
    if (response.success) {
      return response.data;
    }
    console.error('Failed to get subscription status:', response.error?.message);
    return null;
  },

  // Subscribe to a plan
  async subscribe(tier: string, billingInterval?: 'monthly' | 'yearly') {
    const response = await apiClient.post('/api/payments/subscribe', { tier, billingInterval });
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Cancel subscription
  async cancelSubscription() {
    const response = await apiClient.post('/api/payments/cancel-subscription');
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Get credit balance and recent transactions
  async getCreditBalance() {
    const response = await apiClient.get('/api/payments/credits/balance');
    if (response.success) {
      return response.data;
    }
    console.error('Failed to get credit balance:', response.error?.message);
    return null;
  },

  // Get credits (alias for getCreditBalance for backwards compatibility)
  async getCredits() {
    return this.getCreditBalance();
  },

  // Purchase credits
  async purchaseCredits(creditPackage: string) {
    const response = await apiClient.post('/api/payments/credits/purchase', { creditPackage });
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Use credits
  async useCredits(amount: number, description: string, usageType?: string, pitchId?: number) {
    const response = await apiClient.post('/api/payments/credits/use', { amount, description, usageType, pitchId });
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Get payment history
  async getPaymentHistory(params?: { 
    type?: string; 
    status?: string; 
    startDate?: string; 
    endDate?: string; 
    limit?: number; 
    offset?: number; 
  }) {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.startDate) searchParams.set('startDate', params.startDate);
    if (params?.endDate) searchParams.set('endDate', params.endDate);
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());

    const endpoint = `/api/payments/history${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await apiClient.get(endpoint);
    if (response.success) {
      return response.data;
    }
    console.error('Failed to get payment history:', response.error?.message);
    return null;
  },

  // Get invoices
  async getInvoices(params?: { 
    limit?: number; 
    offset?: number; 
    status?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.offset) searchParams.set('offset', params.offset.toString());
    if (params?.status) searchParams.set('status', params.status);

    const endpoint = `/api/payments/invoices${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const response = await apiClient.get(endpoint);
    if (response.success) {
      return response.data;
    }
    console.error('Failed to get invoices:', response.error?.message);
    return null;
  },

  // Get payment methods
  async getPaymentMethods() {
    const response = await apiClient.get('/api/payments/payment-methods');
    if (response.success) {
      return response.data;
    }
    console.error('Failed to get payment methods:', response.error?.message);
    return null;
  },

  // Add payment method
  async addPaymentMethod() {
    const response = await apiClient.post('/api/payments/payment-methods');
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Remove payment method
  async removePaymentMethod(paymentMethodId: string) {
    const response = await apiClient.delete('/api/payments/payment-methods');
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },

  // Set default payment method
  async setDefaultPaymentMethod(paymentMethodId: string) {
    const response = await apiClient.put('/api/payments/payment-methods', { paymentMethodId });
    if (response.success) {
      return { success: true, ...response.data };
    }
    return { success: false, error: response.error?.message };
  },
};