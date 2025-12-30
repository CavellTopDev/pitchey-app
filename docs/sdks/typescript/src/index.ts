/**
 * Pitchey SDK - Official TypeScript/JavaScript SDK for the Pitchey API
 * 
 * @example
 * ```typescript
 * import { PitcheySDK } from '@pitchey/sdk';
 * 
 * const pitchey = new PitcheySDK({
 *   apiUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
 *   debug: true
 * });
 * 
 * // Authenticate
 * await pitchey.auth.login({
 *   email: 'user@example.com',
 *   password: 'password123'
 * });
 * 
 * // Get public pitches
 * const pitches = await pitchey.pitches.getPublic({ limit: 10 });
 * console.log(pitches.data);
 * ```
 */

import { PitcheyAPIClient } from './client';
import { AuthResource } from './resources/auth';
import { PitchesResource } from './resources/pitches';
import { UsersResource } from './resources/users';
import { MessagesResource } from './resources/messages';
import { NotificationsResource } from './resources/notifications';
import { InvestmentsResource } from './resources/investments';
import { NDAsResource } from './resources/ndas';
import { MediaResource } from './resources/media';
import { WatchlistResource } from './resources/watchlist';
import { AnalyticsResource } from './resources/analytics';
import { SearchResource } from './resources/search';
import { WebhooksResource } from './resources/webhooks';
import { SystemResource } from './resources/system';
import { SDKConfig } from './types';

/**
 * Main Pitchey SDK class
 */
export class PitcheySDK {
  private client: PitcheyAPIClient;

  // Resource instances
  public readonly auth: AuthResource;
  public readonly pitches: PitchesResource;
  public readonly users: UsersResource;
  public readonly messages: MessagesResource;
  public readonly notifications: NotificationsResource;
  public readonly investments: InvestmentsResource;
  public readonly ndas: NDAsResource;
  public readonly media: MediaResource;
  public readonly watchlist: WatchlistResource;
  public readonly analytics: AnalyticsResource;
  public readonly search: SearchResource;
  public readonly webhooks: WebhooksResource;
  public readonly system: SystemResource;

  constructor(config: SDKConfig = {}) {
    // Initialize the API client
    this.client = new PitcheyAPIClient(config);

    // Initialize resource instances
    this.auth = new AuthResource(this.client);
    this.pitches = new PitchesResource(this.client);
    this.users = new UsersResource(this.client);
    this.messages = new MessagesResource(this.client);
    this.notifications = new NotificationsResource(this.client);
    this.investments = new InvestmentsResource(this.client);
    this.ndas = new NDAsResource(this.client);
    this.media = new MediaResource(this.client);
    this.watchlist = new WatchlistResource(this.client);
    this.analytics = new AnalyticsResource(this.client);
    this.search = new SearchResource(this.client);
    this.webhooks = new WebhooksResource(this.client);
    this.system = new SystemResource(this.client);
  }

  /**
   * Get the underlying API client instance
   */
  getClient(): PitcheyAPIClient {
    return this.client;
  }

  /**
   * Set the API key for authenticated requests
   */
  setApiKey(apiKey: string): void {
    this.client.setApiKey(apiKey);
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | undefined {
    return this.client.getApiKey();
  }

  /**
   * Clear the API key
   */
  clearApiKey(): void {
    this.client.clearApiKey();
  }

  /**
   * Check if the SDK is authenticated
   */
  isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  /**
   * Quick login helper - auto-detects user type
   */
  async login(email: string, password: string) {
    return this.auth.login({ email, password });
  }

  /**
   * Logout helper
   */
  logout(): void {
    this.auth.logout();
  }

  // ============================================================================
  // Static factory methods for common use cases
  // ============================================================================

  /**
   * Create an SDK instance for production use
   */
  static production(apiKey?: string): PitcheySDK {
    return new PitcheySDK({
      apiUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
      apiKey,
      debug: false,
    });
  }

  /**
   * Create an SDK instance for development
   */
  static development(apiKey?: string): PitcheySDK {
    return new PitcheySDK({
      apiUrl: 'http://localhost:8001',
      apiKey,
      debug: true,
    });
  }

  /**
   * Create an SDK instance with demo credentials
   */
  static async demo(userType: 'creator' | 'investor' | 'production' = 'creator'): Promise<PitcheySDK> {
    const sdk = PitcheySDK.production();
    
    // Login with demo account
    switch (userType) {
      case 'creator':
        await sdk.auth.loginDemoCreator();
        break;
      case 'investor':
        await sdk.auth.loginDemoInvestor();
        break;
      case 'production':
        await sdk.auth.loginDemoProduction();
        break;
    }

    return sdk;
  }

  /**
   * Create an SDK instance for public (unauthenticated) use
   */
  static public(): PitcheySDK {
    return new PitcheySDK({
      apiUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
      debug: false,
    });
  }
}

// Re-export types for convenience
export * from './types';
export { PitcheyAPIClient } from './client';

// Re-export resources for advanced usage
export { AuthResource } from './resources/auth';
export { PitchesResource } from './resources/pitches';

// Default export
export default PitcheySDK;

// ============================================================================
// Version information
// ============================================================================
export const SDK_VERSION = '1.0.0';
export const API_VERSION = '1.0.0';
export const USER_AGENT = `Pitchey-SDK-JS/${SDK_VERSION}`;

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Create a configured SDK instance with sensible defaults
 */
export function createPitcheySDK(config?: SDKConfig): PitcheySDK {
  return new PitcheySDK({
    apiUrl: 'https://pitchey-api-prod.ndlovucavelle.workers.dev',
    debug: process?.env?.NODE_ENV === 'development',
    ...config,
  });
}

/**
 * Quick authentication helper
 */
export async function authenticateWithPitchey(
  email: string,
  password: string,
  config?: SDKConfig
): Promise<PitcheySDK> {
  const sdk = createPitcheySDK(config);
  await sdk.login(email, password);
  return sdk;
}

/**
 * Get public pitches without authentication
 */
export async function getPublicPitches(params?: {
  page?: number;
  limit?: number;
  genre?: string;
  format?: string;
  sort?: string;
}) {
  const sdk = PitcheySDK.public();
  return sdk.pitches.getPublic(params);
}

/**
 * Search public pitches without authentication
 */
export async function searchPublicPitches(query: string, filters?: any) {
  const sdk = PitcheySDK.public();
  return sdk.pitches.search({ q: query, ...filters });
}