/**
 * Investor Service Module  
 * Handles investor-specific functionality and dashboard
 */

import { AuthPayload } from '../../shared/auth-utils.ts';
import { CachingService } from '../../caching-strategy.ts';
import { InvestorEndpoints } from './investor-endpoints.ts';

export class InvestorService {
  private cache: CachingService;
  private endpoints: InvestorEndpoints;
  
  constructor(cache: CachingService) {
    this.cache = cache;
    this.endpoints = new InvestorEndpoints(cache);
  }

  /**
   * Handle investor-specific requests
   */
  async handleRequest(request: Request, pathname: string, auth: AuthPayload, sql: any): Promise<Response | null> {
    // Use comprehensive investor endpoints
    return this.endpoints.handleInvestorRequest(request, pathname, auth, sql);
  }
}
