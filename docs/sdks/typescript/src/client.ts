/**
 * Core API client for the Pitchey SDK
 */

import 'cross-fetch/polyfill';
import {
  SDKConfig,
  RequestOptions,
  PitcheyAPIError,
  PitcheyValidationError,
  PitcheyAuthenticationError,
  PitcheyAuthorizationError,
  PitcheyNotFoundError,
  PitcheyRateLimitError,
} from './types';

export class PitcheyAPIClient {
  private apiUrl: string;
  private apiKey?: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;
  private debug: boolean;
  private userAgent: string;

  constructor(config: SDKConfig = {}) {
    this.apiUrl = config.apiUrl || 'https://pitchey-production.cavelltheleaddev.workers.dev';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000; // 30 seconds
    this.retries = config.retries || 3;
    this.retryDelay = config.retryDelay || 1000; // 1 second
    this.debug = config.debug || false;
    this.userAgent = config.userAgent || `Pitchey-SDK-JS/1.0.0`;

    // Remove trailing slash from API URL
    if (this.apiUrl.endsWith('/')) {
      this.apiUrl = this.apiUrl.slice(0, -1);
    }
  }

  /**
   * Set the API key for authenticated requests
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | undefined {
    return this.apiKey;
  }

  /**
   * Clear the API key
   */
  clearApiKey(): void {
    this.apiKey = undefined;
  }

  /**
   * Make an HTTP request to the Pitchey API
   */
  async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`;
    const timeout = options.timeout || this.timeout;
    const retries = options.retries !== undefined ? options.retries : this.retries;

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': this.userAgent,
      ...options.headers,
    };

    // Add authentication if available
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    // Build request options
    const requestOptions: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(timeout),
    };

    // Add body for non-GET requests
    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        // For file uploads, remove Content-Type to let browser set boundary
        delete headers['Content-Type'];
        requestOptions.body = data;
      } else {
        requestOptions.body = JSON.stringify(data);
      }
    }

    // Add query parameters for GET requests
    if (data && method === 'GET') {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, String(v)));
          } else {
            params.append(key, String(value));
          }
        }
      });
      const queryString = params.toString();
      if (queryString) {
        url.includes('?') ? url + '&' + queryString : url + '?' + queryString;
      }
    }

    if (this.debug) {
      console.log(`[Pitchey SDK] ${method} ${url}`, data);
    }

    return this.executeWithRetries(url, requestOptions, retries);
  }

  /**
   * Execute request with retry logic
   */
  private async executeWithRetries<T>(
    url: string,
    options: RequestInit,
    retries: number
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        
        if (this.debug) {
          console.log(`[Pitchey SDK] Response ${response.status} ${response.statusText}`);
        }

        // Handle successful responses
        if (response.ok) {
          // Handle empty responses
          if (response.status === 204) {
            return {} as T;
          }

          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            return await response.json();
          } else {
            return (await response.text()) as unknown as T;
          }
        }

        // Handle error responses
        await this.handleErrorResponse(response);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on client errors or authentication issues
        if (error instanceof PitcheyAuthenticationError ||
            error instanceof PitcheyAuthorizationError ||
            error instanceof PitcheyValidationError ||
            error instanceof PitcheyNotFoundError) {
          throw error;
        }

        // Don't retry on the last attempt
        if (attempt === retries) {
          break;
        }

        // Wait before retrying
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt); // Exponential backoff
          if (this.debug) {
            console.log(`[Pitchey SDK] Retrying in ${delay}ms... (attempt ${attempt + 1}/${retries})`);
          }
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Handle error responses from the API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: any;
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        errorData = { error: await response.text() };
      }
    } catch {
      errorData = { error: 'Unknown error occurred' };
    }

    const message = errorData.error || errorData.message || 'Unknown error';

    // Handle specific error types
    switch (response.status) {
      case 400:
        if (errorData.validation_errors) {
          throw new PitcheyValidationError(message, errorData.validation_errors);
        }
        throw new PitcheyAPIError(message, response.status, 'BAD_REQUEST', errorData);

      case 401:
        throw new PitcheyAuthenticationError(message);

      case 403:
        throw new PitcheyAuthorizationError(message);

      case 404:
        throw new PitcheyNotFoundError(message);

      case 429:
        const retryAfter = response.headers.get('Retry-After');
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : undefined;
        throw new PitcheyRateLimitError(message, retryAfterSeconds);

      case 500:
        throw new PitcheyAPIError(message, response.status, 'INTERNAL_SERVER_ERROR', errorData);

      case 502:
        throw new PitcheyAPIError(message, response.status, 'BAD_GATEWAY', errorData);

      case 503:
        throw new PitcheyAPIError(message, response.status, 'SERVICE_UNAVAILABLE', errorData);

      case 504:
        throw new PitcheyAPIError(message, response.status, 'GATEWAY_TIMEOUT', errorData);

      default:
        throw new PitcheyAPIError(message, response.status, 'UNKNOWN_ERROR', errorData);
    }
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, params?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, params, options);
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  /**
   * PATCH request
   */
  async patch<T = any>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', endpoint, data, options);
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, undefined, options);
  }
}