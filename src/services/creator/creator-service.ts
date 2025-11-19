/**
 * Creator Service Module  
 * Handles creator-specific functionality and dashboard
 */

import { AuthPayload } from '../../shared/auth-utils';
import { CachingService } from '../../caching-strategy';
import { CreatorEndpoints } from './creator-endpoints';

export class CreatorService {
  private cache: CachingService;
  private endpoints: CreatorEndpoints;
  
  constructor(cache: CachingService) {
    this.cache = cache;
    this.endpoints = new CreatorEndpoints(cache);
  }

  /**
   * Handle creator-specific requests
   */
  async handleRequest(request: Request, pathname: string, auth: AuthPayload, sql: any): Promise<Response | null> {
    // Use comprehensive creator endpoints
    return this.endpoints.handleCreatorRequest(request, pathname, auth, sql);
  }
}