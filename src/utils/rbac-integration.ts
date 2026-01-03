/**
 * RBAC Integration Helper
 * Adds permission checks to Worker endpoints
 */

import { RBACService, Permission, RBACContext } from '../services/rbac.service';
import { ErrorCode } from './errors';
import { ApiResponseBuilder } from './response-builder';

export interface AuthResult {
  authorized: boolean;
  user?: {
    id: number;
    email: string;
    userType?: string;
    role?: string;
  };
  response?: Response;
}

export class RBACIntegration {
  /**
   * Check permission before executing handler
   */
  static async checkPermission(
    authResult: AuthResult,
    permission: Permission,
    request: Request
  ): Promise<{ allowed: boolean; response?: Response }> {
    const builder = new ApiResponseBuilder(request);
    
    if (!authResult.authorized || !authResult.user) {
      return {
        allowed: false,
        response: builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required')
      };
    }

    const context: RBACContext = {
      userId: authResult.user.id,
      userRole: RBACService.getRoleFromUserType(authResult.user.userType || authResult.user.role)
    };

    if (!RBACService.hasPermission(context, permission)) {
      return {
        allowed: false,
        response: builder.error(
          ErrorCode.FORBIDDEN,
          RBACService.getPermissionError(permission)
        );
      };
    }

    return { allowed: true };
  }

  /**
   * Check ownership-based permission
   */
  static async checkOwnershipPermission(
    authResult: AuthResult,
    permission: Permission,
    resourceOwnerId: number,
    request: Request
  ): Promise<{ allowed: boolean; response?: Response }> {
    const builder = new ApiResponseBuilder(request);
    
    if (!authResult.authorized || !authResult.user) {
      return {
        allowed: false,
        response: builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required')
      };
    }

    const context: RBACContext = {
      userId: authResult.user.id,
      userRole: RBACService.getRoleFromUserType(authResult.user.userType || authResult.user.role),
      resourceOwnerId
    };

    const allowed = RBACService.canAccess(context, permission, {
      checkOwnership: true
    });

    if (!allowed) {
      const isOwner = authResult.user.id === resourceOwnerId;
      return {
        allowed: false,
        response: builder.error(
          ErrorCode.FORBIDDEN,
          isOwner 
            ? RBACService.getPermissionError(permission)
            : 'You don\'t have access to this resource'
        )
      };
    }

    return { allowed: true };
  }

  /**
   * Check NDA-based permission
   */
  static async checkNDAPermission(
    authResult: AuthResult,
    permission: Permission,
    hasNDA: boolean,
    request: Request
  ): Promise<{ allowed: boolean; response?: Response }> {
    const builder = new ApiResponseBuilder(request);
    
    if (!authResult.authorized || !authResult.user) {
      return {
        allowed: false,
        response: builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required')
      };
    }

    const context: RBACContext = {
      userId: authResult.user.id,
      userRole: RBACService.getRoleFromUserType(authResult.user.userType || authResult.user.role),
      metadata: { hasNDA }
    };

    const allowed = RBACService.canAccess(context, permission, {
      requireNDA: true
    });

    if (!allowed) {
      return {
        allowed: false,
        response: builder.error(
          ErrorCode.FORBIDDEN,
          hasNDA 
            ? RBACService.getPermissionError(permission)
            : 'NDA required to access this content'
        )
      };
    }

    return { allowed: true };
  }

  /**
   * Add RBAC to pitch creation
   */
  static async checkPitchCreatePermission(authResult: AuthResult, request: Request) {
    return this.checkPermission(authResult, Permission.PITCH_CREATE, request);
  }

  /**
   * Add RBAC to pitch editing
   */
  static async checkPitchEditPermission(
    authResult: AuthResult,
    pitchOwnerId: number,
    request: Request
  ) {
    // Admins can edit any pitch
    const adminCheck = await this.checkPermission(authResult, Permission.PITCH_EDIT_ANY, request);
    if (adminCheck.allowed) return adminCheck;

    // Others can only edit their own
    return this.checkOwnershipPermission(
      authResult,
      Permission.PITCH_EDIT_OWN,
      pitchOwnerId,
      request
    );
  }

  /**
   * Add RBAC to pitch deletion
   */
  static async checkPitchDeletePermission(
    authResult: AuthResult,
    pitchOwnerId: number,
    request: Request
  ) {
    // Admins can delete any pitch
    const adminCheck = await this.checkPermission(authResult, Permission.PITCH_DELETE_ANY, request);
    if (adminCheck.allowed) return adminCheck;

    // Others can only delete their own
    return this.checkOwnershipPermission(
      authResult,
      Permission.PITCH_DELETE_OWN,
      pitchOwnerId,
      request
    );
  }

  /**
   * Add RBAC to NDA approval
   */
  static async checkNDAApprovePermission(
    authResult: AuthResult,
    pitchOwnerId: number,
    request: Request
  ) {
    // Only pitch owners can approve NDAs for their pitches
    if (authResult.user?.id !== pitchOwnerId) {
      const builder = new ApiResponseBuilder(request);
      return {
        allowed: false,
        response: builder.error(
          ErrorCode.FORBIDDEN,
          'Only the pitch owner can approve NDA requests'
        )
      };
    }

    return this.checkPermission(authResult, Permission.NDA_APPROVE, request);
  }

  /**
   * Add RBAC to NDA rejection
   */
  static async checkNDARejectPermission(
    authResult: AuthResult,
    pitchOwnerId: number,
    request: Request
  ) {
    // Only pitch owners can reject NDAs for their pitches
    if (authResult.user?.id !== pitchOwnerId) {
      const builder = new ApiResponseBuilder(request);
      return {
        allowed: false,
        response: builder.error(
          ErrorCode.FORBIDDEN,
          'Only the pitch owner can reject NDA requests'
        )
      };
    }

    return this.checkPermission(authResult, Permission.NDA_REJECT, request);
  }

  /**
   * Add RBAC to investment creation
   */
  static async checkInvestmentCreatePermission(authResult: AuthResult, request: Request) {
    return this.checkPermission(authResult, Permission.INVESTMENT_CREATE, request);
  }

  /**
   * Add RBAC to document upload
   */
  static async checkDocumentUploadPermission(authResult: AuthResult, request: Request) {
    return this.checkPermission(authResult, Permission.DOCUMENT_UPLOAD, request);
  }

  /**
   * Add RBAC to private document viewing
   */
  static async checkDocumentViewPermission(
    authResult: AuthResult,
    isPublic: boolean,
    hasNDA: boolean,
    documentOwnerId: number,
    request: Request
  ) {
    // Public documents can be viewed by anyone with the permission
    if (isPublic) {
      return this.checkPermission(authResult, Permission.DOCUMENT_VIEW_PUBLIC, request);
    }

    // Document owner always has access
    if (authResult.user?.id === documentOwnerId) {
      return { allowed: true };
    }

    // Private documents require NDA
    return this.checkNDAPermission(
      authResult,
      Permission.DOCUMENT_VIEW_PRIVATE,
      hasNDA,
      request
    );
  }

  /**
   * Add RBAC to analytics viewing
   */
  static async checkAnalyticsViewPermission(
    authResult: AuthResult,
    resourceOwnerId: number,
    request: Request
  ) {
    // Admins can view any analytics
    const adminCheck = await this.checkPermission(authResult, Permission.ANALYTICS_VIEW_ANY, request);
    if (adminCheck.allowed) return adminCheck;

    // Others can only view their own
    return this.checkOwnershipPermission(
      authResult,
      Permission.ANALYTICS_VIEW_OWN,
      resourceOwnerId,
      request
    );
  }

  /**
   * Add RBAC to user profile editing
   */
  static async checkUserEditPermission(
    authResult: AuthResult,
    profileUserId: number,
    request: Request
  ) {
    // Admins can edit any user
    const adminCheck = await this.checkPermission(authResult, Permission.USER_EDIT_ANY, request);
    if (adminCheck.allowed) return adminCheck;

    // Others can only edit their own profile
    return this.checkOwnershipPermission(
      authResult,
      Permission.USER_EDIT_OWN,
      profileUserId,
      request
    );
  }

  /**
   * Check if user can moderate content
   */
  static async checkModerationPermission(authResult: AuthResult, request: Request) {
    return this.checkPermission(authResult, Permission.PITCH_MODERATE, request);
  }

  /**
   * Check admin access
   */
  static async checkAdminPermission(authResult: AuthResult, request: Request) {
    return this.checkPermission(authResult, Permission.ADMIN_ACCESS, request);
  }
}