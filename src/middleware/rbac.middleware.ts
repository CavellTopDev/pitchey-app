// RBAC Middleware for API Routes
import { defineAbilityFor, checkPermission, AppActions, AppSubjects } from '../services/rbac/rbac.service.ts';
import { ForbiddenError, subject } from '@casl/ability';
import { verifyToken } from '../utils/jwt.ts';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';

interface RBACOptions {
  action: AppActions;
  subject: AppSubjects;
  /** Optional field to check specific field permissions */
  field?: string;
  /** Optional conditions to check */
  conditions?: any;
  /** If true, will use request params/body to build conditions */
  useRequestContext?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** If true, allows guest access */
  allowGuest?: boolean;
}

/**
 * RBAC Middleware Factory
 * Creates middleware that checks if user has permission to perform action on subject
 */
export function requirePermission(options: RBACOptions) {
  return async (request: Request, env: any, ctx: any) => {
    try {
      // Extract token from Authorization header
      const authHeader = request.headers.get('Authorization');
      let user = null;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        try {
          // Verify token and get user
          const decoded = await verifyToken(token, env.JWT_SECRET);
          
          // Fetch full user data
          const [userData] = await db
            .select()
            .from(users)
            .where(eq(users.id, decoded.userId))
            .limit(1);
          
          if (userData) {
            user = {
              ...userData,
              role: userData.userType // Map userType to role
            };
          }
        } catch (tokenError) {
          // Invalid token, treat as guest
          console.error('Token verification failed:', tokenError);
        }
      }
      
      // Check if guest access is allowed
      if (!user && !options.allowGuest) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'Authentication required',
              code: 'UNAUTHORIZED'
            }
          }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Build conditions from request if needed
      let conditions = options.conditions;
      
      if (options.useRequestContext) {
        const url = new URL(request.url);
        const params = Object.fromEntries(url.searchParams);
        
        // For resource-specific checks
        if (params.id) {
          conditions = { ...conditions, id: parseInt(params.id) };
        }
        if (params.pitchId) {
          conditions = { ...conditions, pitchId: parseInt(params.pitchId) };
        }
        if (params.userId) {
          conditions = { ...conditions, userId: parseInt(params.userId) };
        }
        
        // Add user context
        if (user) {
          if (options.subject === 'Pitch') {
            conditions = { ...conditions, creatorId: user.id };
          }
          if (options.subject === 'Investment') {
            conditions = { ...conditions, investorId: user.id };
          }
          if (options.subject === 'NDA') {
            conditions = { 
              ...conditions, 
              $or: [
                { requesterId: user.id },
                { creatorId: user.id }
              ]
            };
          }
        }
      }
      
      // Check permission
      const hasPermission = await checkPermission(
        user || { role: 'guest' },
        options.action,
        options.subject,
        conditions
      );
      
      if (!hasPermission) {
        const errorMessage = options.errorMessage || 
          `You don't have permission to ${options.action} ${options.subject}`;
        
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: errorMessage,
              code: 'FORBIDDEN',
              required: {
                action: options.action,
                subject: options.subject
              }
            }
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Permission granted, attach user and ability to context
      ctx.user = user;
      ctx.ability = await defineAbilityFor(user || { role: 'guest' });
      
      // Continue to next middleware/handler
      return null; // Indicates middleware passed
      
    } catch (error) {
      console.error('RBAC middleware error:', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Authorization check failed',
            code: 'INTERNAL_ERROR'
          }
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Combine multiple permission checks with OR logic
 */
export function requireAnyPermission(...permissions: RBACOptions[]) {
  return async (request: Request, env: any, ctx: any) => {
    // Try each permission check
    for (const permission of permissions) {
      const middleware = requirePermission(permission);
      const result = await middleware(request, env, ctx);
      
      // If any permission passes, allow access
      if (result === null) {
        return null;
      }
    }
    
    // All permissions failed
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: 'Insufficient permissions',
          code: 'FORBIDDEN'
        }
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  };
}

/**
 * Combine multiple permission checks with AND logic
 */
export function requireAllPermissions(...permissions: RBACOptions[]) {
  return async (request: Request, env: any, ctx: any) => {
    // Check all permissions
    for (const permission of permissions) {
      const middleware = requirePermission(permission);
      const result = await middleware(request, env, ctx);
      
      // If any permission fails, deny access
      if (result !== null) {
        return result;
      }
    }
    
    // All permissions passed
    return null;
  };
}

/**
 * Check if user has a specific role
 */
export function requireRole(role: string | string[]) {
  const roles = Array.isArray(role) ? role : [role];
  
  return async (request: Request, env: any, ctx: any) => {
    try {
      // Extract and verify token
      const authHeader = request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'Authentication required',
              code: 'UNAUTHORIZED'
            }
          }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      const token = authHeader.substring(7);
      const decoded = await verifyToken(token, env.JWT_SECRET);
      
      // Fetch user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.userId))
        .limit(1);
      
      if (!user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: 'User not found',
              code: 'NOT_FOUND'
            }
          }),
          { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Check role
      const userRole = user.userType;
      if (!roles.includes(userRole)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: {
              message: `This action requires one of the following roles: ${roles.join(', ')}`,
              code: 'FORBIDDEN',
              requiredRoles: roles,
              currentRole: userRole
            }
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
      
      // Role check passed
      ctx.user = user;
      return null;
      
    } catch (error) {
      console.error('Role middleware error:', error);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            message: 'Role check failed',
            code: 'INTERNAL_ERROR'
          }
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Apply RBAC to query results
 * Filters results based on user's permissions
 */
export async function filterByPermission<T>(
  items: T[],
  user: any,
  action: AppActions,
  subject: AppSubjects,
  getConditions?: (item: T) => any
): Promise<T[]> {
  const ability = await defineAbilityFor(user);
  
  return items.filter(item => {
    const conditions = getConditions ? getConditions(item) : item;
    return ability.can(action, subject, conditions);
  });
}

/**
 * Field-level permission filtering
 * Removes fields that user doesn't have permission to see
 */
export async function filterFields<T extends Record<string, any>>(
  item: T,
  user: any,
  action: AppActions,
  subject: AppSubjects
): Promise<Partial<T>> {
  const ability = await defineAbilityFor(user);
  const rules = ability.rulesFor(action, subject);
  
  // If no field restrictions, return full item
  const hasFieldRestrictions = rules.some(rule => rule.fields && rule.fields.length > 0);
  if (!hasFieldRestrictions) {
    return item;
  }
  
  // Get allowed fields
  const allowedFields = new Set<string>();
  rules.forEach(rule => {
    if (rule.fields) {
      rule.fields.forEach(field => allowedFields.add(field));
    }
  });
  
  // Filter item fields
  const filtered: Partial<T> = {};
  for (const [key, value] of Object.entries(item)) {
    if (allowedFields.has(key)) {
      filtered[key as keyof T] = value;
    }
  }
  
  return filtered;
}

// Export common permission checks as shortcuts
export const permissions = {
  // Pitch permissions
  canCreatePitch: requirePermission({ action: 'create', subject: 'Pitch' }),
  canReadPitch: requirePermission({ action: 'read', subject: 'Pitch', useRequestContext: true }),
  canUpdatePitch: requirePermission({ action: 'update', subject: 'Pitch', useRequestContext: true }),
  canDeletePitch: requirePermission({ action: 'delete', subject: 'Pitch', useRequestContext: true }),
  canModeratePitch: requirePermission({ action: 'moderate', subject: 'Pitch' }),
  canFeaturePitch: requirePermission({ action: 'feature', subject: 'Pitch' }),
  
  // NDA permissions
  canRequestNDA: requirePermission({ action: 'request', subject: 'NDA' }),
  canApproveNDA: requirePermission({ action: 'approve', subject: 'NDA', useRequestContext: true }),
  canRejectNDA: requirePermission({ action: 'reject', subject: 'NDA', useRequestContext: true }),
  canSignNDA: requirePermission({ action: 'sign', subject: 'NDA', useRequestContext: true }),
  
  // Investment permissions
  canCreateInvestment: requirePermission({ action: 'create', subject: 'Investment' }),
  canReadInvestment: requirePermission({ action: 'read', subject: 'Investment', useRequestContext: true }),
  canTrackInvestment: requirePermission({ action: 'track', subject: 'Investment', useRequestContext: true }),
  
  // Admin permissions
  canViewAnalytics: requirePermission({ action: 'view_analytics', subject: 'Dashboard' }),
  canViewSensitive: requirePermission({ action: 'view_sensitive', subject: 'Report' }),
  canExportData: requirePermission({ action: 'export', subject: 'Analytics' }),
  
  // Role checks
  requireAdmin: requireRole(['admin', 'superAdmin']),
  requireCreator: requireRole('creator'),
  requireInvestor: requireRole('investor'),
  requireProduction: requireRole('productionCompany'),
  requireModerator: requireRole(['moderator', 'admin', 'superAdmin'])
};

export default {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  requireRole,
  filterByPermission,
  filterFields,
  permissions
};