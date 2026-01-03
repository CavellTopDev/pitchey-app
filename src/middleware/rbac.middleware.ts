/**
 * RBAC Middleware for Cloudflare Workers
 * Enforces permission checks on API endpoints
 */

import { RBACService, Permission, UserRole, RBACContext } from '../services/rbac.service';
import { ErrorCode } from '../utils/errors';
import { ApiResponseBuilder } from '../utils/response-builder';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    userType?: string;
    role?: string;
  };
  params?: Record<string, string>;
}

export class RBACMiddleware {
  /**
   * Require specific permission(s) for an endpoint
   */
  static requirePermission(...permissions: Permission[]) {
    return async (
      request: AuthenticatedRequest,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const builder = new ApiResponseBuilder(request);
      
      // Check if user is authenticated
      if (!request.user) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      // Build RBAC context
      const context: RBACContext = {
        userId: request.user.id,
        userRole: RBACService.getRoleFromUserType(request.user.userType || request.user.role),
        userType: request.user.userType
      };

      // Check if user has all required permissions
      if (!RBACService.hasAllPermissions(context, permissions)) {
        const missingPermission = permissions.find(p => !RBACService.hasPermission(context, p));
        return builder.error(
          ErrorCode.FORBIDDEN,
          RBACService.getPermissionError(missingPermission!)
        );
      }

      // Continue to next handler
      return next();
    };
  }

  /**
   * Require any of the specified permissions
   */
  static requireAnyPermission(...permissions: Permission[]) {
    return async (
      request: AuthenticatedRequest,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const builder = new ApiResponseBuilder(request);
      
      if (!request.user) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      const context: RBACContext = {
        userId: request.user.id,
        userRole: RBACService.getRoleFromUserType(request.user.userType || request.user.role),
        userType: request.user.userType
      };

      if (!RBACService.hasAnyPermission(context, permissions)) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          'You don\'t have permission to access this resource'
        );
      }

      return next();
    };
  }

  /**
   * Check resource ownership
   */
  static async checkResourceOwnership(
    request: AuthenticatedRequest,
    resourceType: 'pitch' | 'nda' | 'document' | 'investment',
    resourceId: number,
    db: any
  ): Promise<boolean> {
    if (!request.user) return false;

    let ownerId: number | null = null;

    switch (resourceType) {
      case 'pitch':
        const [pitch] = await db.query(
          'SELECT creator_id FROM pitches WHERE id = $1',
          [resourceId]
        );
        ownerId = pitch?.creator_id;
        break;

      case 'nda':
        const [nda] = await db.query(
          'SELECT requester_id, owner_id FROM nda_requests WHERE id = $1',
          [resourceId]
        );
        // NDA can be owned by either requester or owner (pitch creator)
        if (nda) {
          return nda.requester_id === request.user.id || nda.owner_id === request.user.id;
        }
        break;

      case 'document':
        const [doc] = await db.query(
          'SELECT uploaded_by FROM documents WHERE id = $1',
          [resourceId]
        );
        ownerId = doc?.uploaded_by;
        break;

      case 'investment':
        const [investment] = await db.query(
          'SELECT investor_id FROM investments WHERE id = $1',
          [resourceId]
        );
        ownerId = investment?.investor_id;
        break;
    }

    return ownerId === request.user.id;
  }

  /**
   * Require resource ownership with specific permission
   */
  static requireOwnership(
    resourceType: 'pitch' | 'nda' | 'document' | 'investment',
    permission: Permission
  ) {
    return async (
      request: AuthenticatedRequest,
      db: any,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const builder = new ApiResponseBuilder(request);
      
      if (!request.user) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      // Get resource ID from params
      const resourceId = parseInt(
        request.params?.id || 
        request.params?.pitchId || 
        request.params?.ndaId || 
        '0'
      );

      if (!resourceId) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'Resource ID required');
      }

      // Check ownership
      const isOwner = await this.checkResourceOwnership(
        request,
        resourceType,
        resourceId,
        db
      );

      // Build context with ownership info
      const context: RBACContext = {
        userId: request.user.id,
        userRole: RBACService.getRoleFromUserType(request.user.userType || request.user.role),
        userType: request.user.userType,
        resourceId,
        resourceOwnerId: isOwner ? request.user.id : undefined
      };

      // Check permission with ownership
      if (!RBACService.canAccess(context, permission, { checkOwnership: true })) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          isOwner 
            ? RBACService.getPermissionError(permission)
            : 'You don\'t have access to this resource'
        );
      }

      return next();
    };
  }

  /**
   * Check if user has NDA for a pitch
   */
  static async checkNDAAccess(
    request: AuthenticatedRequest,
    pitchId: number,
    db: any
  ): Promise<boolean> {
    if (!request.user) return false;

    const [nda] = await db.query(`
      SELECT id, status 
      FROM nda_requests 
      WHERE pitch_id = $1 
        AND requester_id = $2 
        AND status = 'approved'
      LIMIT 1
    `, [pitchId, request.user.id]);

    return !!nda;
  }

  /**
   * Require NDA for accessing private content
   */
  static requireNDA(permission: Permission) {
    return async (
      request: AuthenticatedRequest,
      db: any,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const builder = new ApiResponseBuilder(request);
      
      if (!request.user) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      const pitchId = parseInt(request.params?.pitchId || request.params?.id || '0');
      
      if (!pitchId) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'Pitch ID required');
      }

      // Check if pitch requires NDA
      const [pitch] = await db.query(
        'SELECT requires_nda, creator_id FROM pitches WHERE id = $1',
        [pitchId]
      );

      if (!pitch) {
        return builder.error(ErrorCode.NOT_FOUND, 'Pitch not found');
      }

      // Creator always has access to their own pitch
      if (pitch.creator_id === request.user.id) {
        return next();
      }

      // If pitch requires NDA, check if user has one
      if (pitch.requires_nda) {
        const hasNDA = await this.checkNDAAccess(request, pitchId, db);
        
        if (!hasNDA) {
          return builder.error(
            ErrorCode.FORBIDDEN,
            'NDA required to access this content'
          );
        }
      }

      // Check base permission
      const context: RBACContext = {
        userId: request.user.id,
        userRole: RBACService.getRoleFromUserType(request.user.userType || request.user.role),
        userType: request.user.userType,
        metadata: { hasNDA: true }
      };

      if (!RBACService.hasPermission(context, permission)) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          RBACService.getPermissionError(permission)
        );
      }

      return next();
    };
  }

  /**
   * Admin-only endpoints
   */
  static requireAdmin() {
    return async (
      request: AuthenticatedRequest,
      next: () => Promise<Response>
    ): Promise<Response> => {
      const builder = new ApiResponseBuilder(request);
      
      if (!request.user) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }

      const context: RBACContext = {
        userId: request.user.id,
        userRole: RBACService.getRoleFromUserType(request.user.userType || request.user.role),
        userType: request.user.userType
      };

      if (!RBACService.isAdmin(context)) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          'Admin access required'
        );
      }

      return next();
    };
  }

  /**
   * Rate limiting based on user role
   */
  static getRateLimit(userRole: UserRole): {
    requests: number;
    window: number; // in seconds
  } {
    switch (userRole) {
      case UserRole.ADMIN:
        return { requests: 1000, window: 60 }; // 1000 requests per minute
      case UserRole.CREATOR:
      case UserRole.INVESTOR:
      case UserRole.PRODUCTION:
        return { requests: 100, window: 60 }; // 100 requests per minute
      case UserRole.VIEWER:
      default:
        return { requests: 20, window: 60 }; // 20 requests per minute
    }
  }
}