/**
 * Authentication Service Module
 * Handles JWT validation, user authentication, and authorization
 */

import { AuthPayload, validateJWT, extractAuthToken, hasPermission, createAuthErrorResponse } from '../../shared/auth-utils.ts';
import { AuthEndpoints } from './auth-endpoints.ts';

export class AuthService {
  private jwtSecret: string;
  private authEndpoints: AuthEndpoints;

  constructor(jwtSecret: string) {
    this.jwtSecret = jwtSecret;
    this.authEndpoints = new AuthEndpoints(jwtSecret);
  }

  /**
   * Validate request authentication
   */
  async validateRequest(request: Request): Promise<{ success: boolean; auth?: AuthPayload; error?: Response }> {
    try {
      const token = extractAuthToken(request);
      if (!token) {
        return { 
          success: false, 
          error: createAuthErrorResponse('Authorization token required') 
        };
      }

      const auth = await validateJWT(token, this.jwtSecret);
      return { success: true, auth };

    } catch (error) {
      return { 
        success: false, 
        error: createAuthErrorResponse(`Invalid token: ${error instanceof Error ? error.message : 'Unknown error'}`) 
      };
    }
  }

  /**
   * Check if user has required permissions
   */
  checkPermissions(auth: AuthPayload, requiredTypes: string[]): boolean {
    return hasPermission(auth, requiredTypes);
  }

  /**
   * Handle auth-specific endpoints
   */
  async handleRequest(request: Request, pathname: string, sql?: any): Promise<Response | null> {
    // Use the comprehensive auth endpoints
    return this.authEndpoints.handleAuthRequest(request, pathname, sql);
  }
}
