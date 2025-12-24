/**
 * Role-Based Access Control (RBAC) Middleware
 * Provides granular permission management for the Pitchey platform
 */

import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';

// Define user roles
export enum UserRole {
  CREATOR = 'creator',
  INVESTOR = 'investor',
  PRODUCTION = 'production',
  ADMIN = 'admin',
  TEAM_MEMBER = 'team_member',
  VIEWER = 'viewer'
}

// Define permissions
export enum Permission {
  // Pitch permissions
  PITCH_CREATE = 'pitch:create',
  PITCH_READ = 'pitch:read',
  PITCH_UPDATE = 'pitch:update',
  PITCH_DELETE = 'pitch:delete',
  PITCH_PUBLISH = 'pitch:publish',
  PITCH_UNPUBLISH = 'pitch:unpublish',
  
  // Document permissions
  DOCUMENT_UPLOAD = 'document:upload',
  DOCUMENT_VIEW = 'document:view',
  DOCUMENT_DELETE = 'document:delete',
  DOCUMENT_DOWNLOAD = 'document:download',
  
  // NDA permissions
  NDA_REQUEST = 'nda:request',
  NDA_APPROVE = 'nda:approve',
  NDA_REJECT = 'nda:reject',
  NDA_SIGN = 'nda:sign',
  NDA_VIEW = 'nda:view',
  
  // Investment permissions
  INVESTMENT_CREATE = 'investment:create',
  INVESTMENT_VIEW = 'investment:view',
  INVESTMENT_UPDATE = 'investment:update',
  INVESTMENT_APPROVE = 'investment:approve',
  
  // Team permissions
  TEAM_INVITE = 'team:invite',
  TEAM_REMOVE = 'team:remove',
  TEAM_MANAGE = 'team:manage',
  TEAM_VIEW = 'team:view',
  
  // Analytics permissions
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',
  
  // Admin permissions
  ADMIN_USERS = 'admin:users',
  ADMIN_CONTENT = 'admin:content',
  ADMIN_SETTINGS = 'admin:settings',
  ADMIN_REPORTS = 'admin:reports'
}

// Role-Permission Mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.CREATOR]: [
    Permission.PITCH_CREATE,
    Permission.PITCH_READ,
    Permission.PITCH_UPDATE,
    Permission.PITCH_DELETE,
    Permission.PITCH_PUBLISH,
    Permission.PITCH_UNPUBLISH,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_VIEW,
    Permission.DOCUMENT_DELETE,
    Permission.DOCUMENT_DOWNLOAD,
    Permission.NDA_APPROVE,
    Permission.NDA_REJECT,
    Permission.NDA_VIEW,
    Permission.TEAM_INVITE,
    Permission.TEAM_REMOVE,
    Permission.TEAM_MANAGE,
    Permission.TEAM_VIEW,
    Permission.ANALYTICS_VIEW,
    Permission.ANALYTICS_EXPORT
  ],
  
  [UserRole.INVESTOR]: [
    Permission.PITCH_READ,
    Permission.DOCUMENT_VIEW,
    Permission.DOCUMENT_DOWNLOAD,
    Permission.NDA_REQUEST,
    Permission.NDA_SIGN,
    Permission.NDA_VIEW,
    Permission.INVESTMENT_CREATE,
    Permission.INVESTMENT_VIEW,
    Permission.INVESTMENT_UPDATE,
    Permission.ANALYTICS_VIEW
  ],
  
  [UserRole.PRODUCTION]: [
    Permission.PITCH_READ,
    Permission.DOCUMENT_VIEW,
    Permission.DOCUMENT_DOWNLOAD,
    Permission.NDA_REQUEST,
    Permission.NDA_SIGN,
    Permission.NDA_VIEW,
    Permission.INVESTMENT_CREATE,
    Permission.INVESTMENT_VIEW,
    Permission.INVESTMENT_APPROVE,
    Permission.ANALYTICS_VIEW,
    Permission.TEAM_VIEW
  ],
  
  [UserRole.TEAM_MEMBER]: [
    Permission.PITCH_READ,
    Permission.PITCH_UPDATE,
    Permission.DOCUMENT_UPLOAD,
    Permission.DOCUMENT_VIEW,
    Permission.DOCUMENT_DOWNLOAD,
    Permission.TEAM_VIEW,
    Permission.ANALYTICS_VIEW
  ],
  
  [UserRole.VIEWER]: [
    Permission.PITCH_READ,
    Permission.DOCUMENT_VIEW
  ],
  
  [UserRole.ADMIN]: [
    // Admins have all permissions
    ...Object.values(Permission)
  ]
};

// Visibility levels for content
export enum Visibility {
  PUBLIC = 'public',      // Anyone can view
  PRIVATE = 'private',    // Only owner can view
  TEAM = 'team',         // Owner and team members
  NDA = 'nda',           // Requires signed NDA
  INVESTORS = 'investors' // Only verified investors
}

// Resource ownership interface
export interface ResourceOwnership {
  ownerId: number;
  teamIds?: number[];
  visibility: Visibility;
  ndaRequired?: boolean;
  allowedUserIds?: number[];
  blockedUserIds?: number[];
}

// Permission context for checking
export interface PermissionContext {
  userId: number;
  userRole: UserRole;
  teamIds?: number[];
  resource?: ResourceOwnership;
  customPermissions?: Permission[];
}

export class RBAC {
  /**
   * Check if a user has a specific permission
   */
  static hasPermission(
    context: PermissionContext,
    permission: Permission
  ): boolean {
    // Check custom permissions first
    if (context.customPermissions?.includes(permission)) {
      return true;
    }
    
    // Check role-based permissions
    const rolePerms = rolePermissions[context.userRole] || [];
    return rolePerms.includes(permission);
  }
  
  /**
   * Check if a user can access a resource
   */
  static canAccessResource(
    context: PermissionContext,
    resource: ResourceOwnership
  ): boolean {
    // Owner always has access
    if (context.userId === resource.ownerId) {
      return true;
    }
    
    // Check if user is blocked
    if (resource.blockedUserIds?.includes(context.userId)) {
      return false;
    }
    
    // Check if user is explicitly allowed
    if (resource.allowedUserIds?.includes(context.userId)) {
      return true;
    }
    
    // Check visibility rules
    switch (resource.visibility) {
      case Visibility.PUBLIC:
        return true;
        
      case Visibility.PRIVATE:
        return false;
        
      case Visibility.TEAM:
        // Check if user is in any of the resource's teams
        if (context.teamIds && resource.teamIds) {
          return context.teamIds.some(id => resource.teamIds?.includes(id));
        }
        return false;
        
      case Visibility.NDA:
        // This would check if user has signed NDA for this resource
        // Implementation depends on NDA system
        return resource.ndaRequired === false; // Simplified for now
        
      case Visibility.INVESTORS:
        return context.userRole === UserRole.INVESTOR || 
               context.userRole === UserRole.PRODUCTION;
        
      default:
        return false;
    }
  }
  
  /**
   * Check multiple permissions at once
   */
  static hasAllPermissions(
    context: PermissionContext,
    permissions: Permission[]
  ): boolean {
    return permissions.every(perm => this.hasPermission(context, perm));
  }
  
  /**
   * Check if user has any of the specified permissions
   */
  static hasAnyPermission(
    context: PermissionContext,
    permissions: Permission[]
  ): boolean {
    return permissions.some(perm => this.hasPermission(context, perm));
  }
  
  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: UserRole): Permission[] {
    return rolePermissions[role] || [];
  }
  
  /**
   * Middleware factory for permission checking
   */
  static requirePermission(permission: Permission | Permission[]) {
    return async (request: Request, context: any): Promise<Response | null> => {
      const builder = new ApiResponseBuilder(request);
      
      // Extract user context from request
      // This assumes you have authentication middleware that sets user data
      const user = context.user;
      if (!user) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Authentication required');
      }
      
      const permContext: PermissionContext = {
        userId: user.id,
        userRole: user.role as UserRole,
        teamIds: user.teamIds,
        customPermissions: user.customPermissions
      };
      
      const permissions = Array.isArray(permission) ? permission : [permission];
      
      if (!this.hasAnyPermission(permContext, permissions)) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          'Insufficient permissions for this action'
        );
      }
      
      return null; // Permission granted
    };
  }
  
  /**
   * Middleware for resource access control
   */
  static requireResourceAccess() {
    return async (request: Request, context: any): Promise<Response | null> => {
      const builder = new ApiResponseBuilder(request);
      
      const user = context.user;
      const resource = context.resource;
      
      if (!user || !resource) {
        return builder.error(ErrorCode.UNAUTHORIZED, 'Access denied');
      }
      
      const permContext: PermissionContext = {
        userId: user.id,
        userRole: user.role as UserRole,
        teamIds: user.teamIds
      };
      
      if (!this.canAccessResource(permContext, resource)) {
        return builder.error(
          ErrorCode.FORBIDDEN,
          'You do not have access to this resource'
        );
      }
      
      return null; // Access granted
    };
  }
}

// Team management utilities
export class TeamManager {
  /**
   * Check if user is team owner
   */
  static isTeamOwner(userId: number, teamOwnerId: number): boolean {
    return userId === teamOwnerId;
  }
  
  /**
   * Check if user is team member
   */
  static isTeamMember(userId: number, teamMemberIds: number[]): boolean {
    return teamMemberIds.includes(userId);
  }
  
  /**
   * Get team permissions for a user
   */
  static getTeamPermissions(
    userId: number,
    teamId: number,
    teamRoles: Record<number, string>
  ): Permission[] {
    const userTeamRole = teamRoles[userId];
    
    if (!userTeamRole) return [];
    
    // Define team role permissions
    const teamRolePermissions: Record<string, Permission[]> = {
      owner: [
        Permission.PITCH_CREATE,
        Permission.PITCH_UPDATE,
        Permission.PITCH_DELETE,
        Permission.PITCH_PUBLISH,
        Permission.TEAM_MANAGE,
        Permission.TEAM_INVITE,
        Permission.TEAM_REMOVE
      ],
      editor: [
        Permission.PITCH_UPDATE,
        Permission.DOCUMENT_UPLOAD,
        Permission.DOCUMENT_DELETE
      ],
      viewer: [
        Permission.PITCH_READ,
        Permission.DOCUMENT_VIEW
      ]
    };
    
    return teamRolePermissions[userTeamRole] || [];
  }
}

// Visibility control utilities
export class VisibilityController {
  /**
   * Filter resources based on user's visibility permissions
   */
  static filterVisible<T extends { visibility: Visibility; ownerId: number }>(
    resources: T[],
    context: PermissionContext
  ): T[] {
    return resources.filter(resource => {
      const ownership: ResourceOwnership = {
        ownerId: resource.ownerId,
        visibility: resource.visibility
      };
      
      return RBAC.canAccessResource(context, ownership);
    });
  }
  
  /**
   * Check if visibility change is allowed
   */
  static canChangeVisibility(
    context: PermissionContext,
    fromVisibility: Visibility,
    toVisibility: Visibility
  ): boolean {
    // Only owners and admins can change visibility
    if (context.userRole === UserRole.ADMIN) {
      return true;
    }
    
    // Creators can change their own content visibility
    if (context.userRole === UserRole.CREATOR) {
      // Can't make content public if it requires NDA
      if (toVisibility === Visibility.PUBLIC && fromVisibility === Visibility.NDA) {
        return false;
      }
      return true;
    }
    
    return false;
  }
  
  /**
   * Get default visibility for a user role
   */
  static getDefaultVisibility(role: UserRole): Visibility {
    switch (role) {
      case UserRole.CREATOR:
        return Visibility.PRIVATE;
      case UserRole.INVESTOR:
      case UserRole.PRODUCTION:
        return Visibility.NDA;
      default:
        return Visibility.PRIVATE;
    }
  }
}

// Export middleware helper
export function createRBACMiddleware(permission: Permission | Permission[]) {
  return RBAC.requirePermission(permission);
}

// Export resource access middleware
export function createResourceAccessMiddleware() {
  return RBAC.requireResourceAccess();
}