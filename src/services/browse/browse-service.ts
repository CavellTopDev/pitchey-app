/**
 * Browse Service Module  
 * Handles browse, search, and content discovery functionality
 */

import { AuthPayload } from '../../shared/auth-utils.ts';
import { CachingService } from '../../caching-strategy.ts';
import { BrowseEndpoints } from './browse-endpoints.ts';

export class BrowseService {
  private cache: CachingService;
  private endpoints: BrowseEndpoints;
  
  constructor(cache: CachingService) {
    this.cache = cache;
    this.endpoints = new BrowseEndpoints(cache);
  }

  /**
   * Handle browse and search requests
   */
  async handleRequest(request: Request, pathname: string, auth: AuthPayload, sql: any): Promise<Response | null> {
    // Use comprehensive browse endpoints
    return this.endpoints.handleBrowseRequest(request, pathname, auth, sql);
  }
}