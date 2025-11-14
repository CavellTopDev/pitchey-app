// Robust API client with comprehensive error handling for Pitchey v0.2
// Prevents frontend crashes from malformed JSON responses

import { config } from '../config';

interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  // Namespaced localStorage helpers to avoid cross-environment token collisions
  private nsKey(key: string): string {
    try {
      const host = new URL(config.API_URL).host;
      return `pitchey:${host}:${key}`;
    } catch {
      return `pitchey:${key}`;
    }
  }
  private getItem(key: string): string | null {
    try {
      return localStorage.getItem(this.nsKey(key)) ?? localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private setItem(key: string, value: string): void {
    try {
      localStorage.setItem(this.nsKey(key), value);
      // keep legacy key for backward compatibility
      localStorage.setItem(key, value);
    } catch {}
  }
  private removeItem(key: string): void {
    try {
      localStorage.removeItem(this.nsKey(key));
      localStorage.removeItem(key);
    } catch {}
  }

  constructor(baseURL: string = config.API_URL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private getAuthToken(): string | null {
    try {
      return this.getItem('authToken');
    } catch (error) {
      console.warn('Failed to get auth token from localStorage:', error);
      return null;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async safeJsonParse(text: string): Promise<any> {
    try {
      if (!text || text.trim() === '') {
        return { error: 'Empty response body' };
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('JSON parse error:', error);
      console.error('Response text:', text);
      return {
        error: 'Invalid JSON response',
        details: {
          parseError: error.message,
          responseText: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        }
      };
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const token = this.getAuthToken();
      
      const headers = {
        ...this.defaultHeaders,
        ...options.headers,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const fetchOptions: RequestInit = {
        ...options,
        headers,
      };

      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, fetchOptions);
      const responseText = await response.text();
      
      console.log(`API Response: ${response.status} ${response.statusText}`);
      
      // Handle non-JSON responses
      if (!response.headers.get('content-type')?.includes('application/json')) {
        return {
          success: false,
          error: {
            message: 'Server returned non-JSON response',
            status: response.status,
            details: {
              contentType: response.headers.get('content-type'),
              responseText: responseText.substring(0, 200)
            }
          }
        };
      }

      const data = await this.safeJsonParse(responseText);
      
      // Handle parsing errors
      if (data.error && typeof data.error === 'string' && data.error.includes('Invalid JSON')) {
        return {
          success: false,
          error: {
            message: 'Server response parsing failed',
            status: response.status,
            code: 'PARSE_ERROR',
            details: data.details
          }
        };
      }

      // Handle HTTP errors
      if (!response.ok) {
        // Handle 401 specifically
        if (response.status === 401) {
          try {
            // Get user type to redirect to correct login page
            const userType = localStorage.getItem('userType');
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            localStorage.removeItem('userType');
            
            if (typeof window !== 'undefined') {
              // Redirect to appropriate login page based on user type
              const loginPath = userType === 'creator' ? '/login/creator' : 
                               userType === 'investor' ? '/login/investor' :
                               userType === 'production' ? '/login/production' : '/';
              window.location.href = loginPath;
            }
          } catch (error) {
            console.warn('Failed to handle auth error:', error);
          }
        }

        return {
          success: false,
          error: {
            message: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            code: data.code,
            details: data.details
          }
        };
      }

      // Successful response
      return {
        success: true,
        data: data.data || data
      };

    } catch (error: any) {
      console.error('API request failed:', error);
      
      // Retry logic for network errors
      if (retryCount < this.maxRetries && this.isRetryableError(error)) {
        console.log(`Retrying request (${retryCount + 1}/${this.maxRetries}) after ${this.retryDelay}ms`);
        await this.delay(this.retryDelay * (retryCount + 1)); // Exponential backoff
        return this.makeRequest<T>(endpoint, options, retryCount + 1);
      }

      return {
        success: false,
        error: {
          message: error.message || 'Network request failed',
          code: 'NETWORK_ERROR',
          details: {
            name: error.name,
            stack: error.stack?.split('\n')[0] // Just first line of stack
          }
        }
      };
    }
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and server errors (5xx)
    return (
      error.name === 'TypeError' ||
      error.name === 'NetworkError' ||
      error.message?.includes('fetch') ||
      error.message?.includes('network')
    );
  }

  // HTTP Methods
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'POST', 
      body 
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'PUT', 
      body 
    });
  }

  async delete<T>(endpoint: string, options?: { data?: any }): Promise<ApiResponse<T>> {
    const body = options?.data ? JSON.stringify(options.data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'DELETE',
      body 
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    const body = data ? JSON.stringify(data) : undefined;
    return this.makeRequest<T>(endpoint, { 
      method: 'PATCH', 
      body 
    });
  }

  // File upload with multipart/form-data
  async uploadFile<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const token = this.getAuthToken();
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers
    });
  }
}

// Create singleton instance
const apiClient = new ApiClient();

// NDA-specific API functions
export const ndaAPI = {
  async requestNDA(pitchId: number, data: {
    ndaType?: 'basic' | 'enhanced' | 'custom';
    requestMessage?: string;
    companyInfo?: string;
  }) {
    return apiClient.post(`/api/ndas/request`, {
      pitchId,
      ...data
    });
  },

  async getRequests(type: 'incoming' | 'outgoing' = 'outgoing') {
    return apiClient.get(`/api/ndas/request?type=${type}`);
  },

  async approveRequest(requestId: number) {
    return apiClient.post(`/api/ndas/${requestId}/approve`);
  },

  async rejectRequest(requestId: number, rejectionReason?: string) {
    return apiClient.post(`/api/ndas/${requestId}/reject`, {
      rejectionReason
    });
  },

  async getSignedNDAs() {
    return apiClient.get('/api/ndas/signed');
  },

  async getNDAById(ndaId: number) {
    return apiClient.get(`/api/ndas/${ndaId}`);
  }
};

// Auth API
export const authAPI = {
  async login(email: string, password: string) {
    const response = await apiClient.post('/api/auth/creator/login', { email, password });
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async loginCreator(email: string, password: string) {
    const response = await apiClient.post('/api/auth/creator/login', { email, password });
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async loginInvestor(email: string, password: string) {
    const response = await apiClient.post('/api/auth/investor/login', { email, password });
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async loginProduction(email: string, password: string) {
    const response = await apiClient.post('/api/auth/production/login', { email, password });
    if (response.success && response.data?.token) {
      (apiClient as any).setItem?.('authToken', response.data.token);
    }
    return response;
  },

  async register(data: {
    email: string;
    username: string;
    password: string;
    userType: string;
  }) {
    const response = await apiClient.post('/api/auth/creator/register', data);
    if (response.success && response.data?.token) {
      localStorage.setItem('authToken', response.data.token);
    }
    return response;
  },

  async logout() {
    try {
      localStorage.removeItem('authToken');
      return { success: true };
    } catch (error) {
      return { success: false, error: { message: 'Logout failed' } };
    }
  },

  async getProfile() {
    return apiClient.get('/api/auth/profile');
  },

  async updateProfile(data: any) {
    return apiClient.put('/api/auth/profile', data);
  }
};

// Pitch API
export const pitchAPI = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    genre?: string;
    format?: string;
    search?: string;
  }) {
    const queryString = params 
      ? '?' + new URLSearchParams(
          Object.entries(params).filter(([_, value]) => value != null).map(([key, value]) => [key, String(value)])
        ).toString()
      : '';
    return apiClient.get(`/api/pitches${queryString}`);
  },

  async getById(id: number) {
    return apiClient.get(`/api/pitches/${id}`);
  },

  async getPublic() {
    return apiClient.get('/api/pitches/public');
  },

  async getPublicById(id: number) {
    return apiClient.get(`/api/pitches/public/${id}`);
  },

  async create(data: any) {
    return apiClient.post('/api/pitches', data);
  },

  async update(id: number, data: any) {
    return apiClient.put(`/api/pitches/${id}`, data);
  },

  async delete(id: number) {
    return apiClient.delete(`/api/pitches/${id}`);
  },

  async recordView(pitchId: number) {
    return apiClient.post(`/api/pitches/${pitchId}/view`);
  }
};

export { apiClient };
export default apiClient;