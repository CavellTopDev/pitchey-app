import { PermissionService, PermissionContext } from '../services/permission.service';
import postgres from 'postgres';

// Extend Request type with permission context
declare global {
  interface Request {
    permissionCtx?: PermissionContext;
    userId?: number;
  }
}

export interface Env {
  HYPERDRIVE: {
    connectionString: string;
  };
  CACHE?: any;
}

/**
 * Middleware to require specific permission
 */
export function requirePermission(permission: string) {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    const permissionCtx = request.permissionCtx;
    
    if (!permissionCtx) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
    const hasPermission = permissionService.hasPermission(permissionCtx, permission);

    // Log the check
    await permissionService.logPermissionCheck(
      permissionCtx.userId,
      request.method + ' ' + new URL(request.url).pathname,
      null,
      null,
      permission,
      hasPermission,
      request
    );

    if (!hasPermission) {
      return Response.json({ 
        error: 'Forbidden', 
        message: `Missing required permission: ${permission}`,
        required: permission
      }, { status: 403 });
    }

    return next();
  };
}

/**
 * Middleware to require any of the specified permissions
 */
export function requireAnyPermission(...permissions: string[]) {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    const permissionCtx = request.permissionCtx;
    
    if (!permissionCtx) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
    const hasPermission = permissionService.hasAnyPermission(permissionCtx, permissions);

    // Log the check
    await permissionService.logPermissionCheck(
      permissionCtx.userId,
      request.method + ' ' + new URL(request.url).pathname,
      null,
      null,
      permissions.join(' OR '),
      hasPermission,
      request,
      { requiredAny: permissions }
    );

    if (!hasPermission) {
      return Response.json({ 
        error: 'Forbidden', 
        message: `Missing required permissions. Need any of: ${permissions.join(', ')}`,
        requiredAny: permissions
      }, { status: 403 });
    }

    return next();
  };
}

/**
 * Middleware to require specific role
 */
export function requireRole(role: string) {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    const permissionCtx = request.permissionCtx;
    
    if (!permissionCtx) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
    
    if (!permissionService.hasRole(permissionCtx, role)) {
      // Log the check
      await permissionService.logPermissionCheck(
        permissionCtx.userId,
        request.method + ' ' + new URL(request.url).pathname,
        null,
        null,
        `role:${role}`,
        false,
        request,
        { requiredRole: role }
      );

      return Response.json({ 
        error: 'Forbidden', 
        message: `Required role: ${role}`,
        requiredRole: role
      }, { status: 403 });
    }

    return next();
  };
}

/**
 * Middleware to require any of the specified roles
 */
export function requireAnyRole(...roles: string[]) {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    const permissionCtx = request.permissionCtx;
    
    if (!permissionCtx) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
    const hasRole = permissionService.hasAnyRole(permissionCtx, roles);

    if (!hasRole) {
      // Log the check
      await permissionService.logPermissionCheck(
        permissionCtx.userId,
        request.method + ' ' + new URL(request.url).pathname,
        null,
        null,
        `role:${roles.join(' OR role:')}`,
        false,
        request,
        { requiredAnyRole: roles }
      );

      return Response.json({ 
        error: 'Forbidden', 
        message: `Required any role of: ${roles.join(', ')}`,
        requiredAnyRole: roles
      }, { status: 403 });
    }

    return next();
  };
}

/**
 * Middleware to require content access
 */
export function requireContentAccess(contentType: string, contentIdParam: string = 'id', requiredLevel: 'view' | 'edit' | 'admin' = 'view') {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    const permissionCtx = request.permissionCtx;
    
    if (!permissionCtx) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Extract content ID from URL params
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    
    // Find the content ID based on the parameter name
    let contentId: number | null = null;
    
    // Try to find ID after the content type in path (e.g., /api/pitches/123)
    const typeIndex = pathParts.findIndex(p => p.includes(contentType) || p === contentIdParam);
    if (typeIndex >= 0 && typeIndex < pathParts.length - 1) {
      contentId = parseInt(pathParts[typeIndex + 1]);
    }
    
    // If not found, try the last segment
    if (!contentId || isNaN(contentId)) {
      const lastPart = pathParts[pathParts.length - 1];
      contentId = parseInt(lastPart);
    }

    if (!contentId || isNaN(contentId)) {
      return Response.json({ error: 'Invalid or missing content ID' }, { status: 400 });
    }

    const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
    
    // Check if user owns the content first
    const isOwner = await permissionService.checkContentOwnership(permissionCtx.userId, contentType, contentId);
    
    // Owners always have access
    if (isOwner) {
      return next();
    }

    // Check content access table
    const hasAccess = await permissionService.checkContentAccess(
      permissionCtx.userId,
      contentType,
      contentId,
      requiredLevel
    );

    // Log the check
    await permissionService.logPermissionCheck(
      permissionCtx.userId,
      request.method + ' ' + new URL(request.url).pathname,
      contentType,
      contentId,
      `content:${contentType}:${requiredLevel}`,
      hasAccess || isOwner,
      request,
      { contentType, contentId, requiredLevel }
    );

    if (!hasAccess) {
      return Response.json({ 
        error: 'Access denied', 
        message: `You do not have ${requiredLevel} access to this ${contentType}. An approved NDA may be required.`,
        contentType,
        contentId,
        requiredAccess: requiredLevel
      }, { status: 403 });
    }

    return next();
  };
}

/**
 * Load permission context for authenticated user
 */
export async function loadPermissionContext(request: Request, env: Env, userId: number): Promise<void> {
  const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
  const permissionCtx = await permissionService.getCachedUserPermissions(userId, env.CACHE);
  
  // Attach to request
  request.permissionCtx = permissionCtx;
  request.userId = userId;
}

/**
 * Check ownership middleware
 */
export function requireOwnership(resourceType: string) {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    const permissionCtx = request.permissionCtx;
    
    if (!permissionCtx) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(p => p);
    const resourceId = parseInt(pathParts[pathParts.length - 1]);

    if (!resourceId || isNaN(resourceId)) {
      return Response.json({ error: 'Invalid resource ID' }, { status: 400 });
    }

    const permissionService = new PermissionService(postgres(env.HYPERDRIVE.connectionString));
    const isOwner = await permissionService.checkContentOwnership(
      permissionCtx.userId,
      resourceType,
      resourceId
    );

    if (!isOwner) {
      // Check if user is admin
      if (!permissionService.hasRole(permissionCtx, 'admin')) {
        await permissionService.logPermissionCheck(
          permissionCtx.userId,
          request.method + ' ' + new URL(request.url).pathname,
          resourceType,
          resourceId,
          'ownership',
          false,
          request
        );

        return Response.json({ 
          error: 'Forbidden',
          message: 'You do not own this resource'
        }, { status: 403 });
      }
    }

    return next();
  };
}

/**
 * Combined auth and permission loading middleware
 */
export function withAuthAndPermissions(authCheck: (req: Request) => Promise<{ authorized: boolean; user?: any; response?: Response }>) {
  return async (request: Request, env: Env, ctx: ExecutionContext, next: () => Promise<Response>) => {
    // Check authentication first
    const authResult = await authCheck(request);
    
    if (!authResult.authorized) {
      return authResult.response || Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Load permission context
    if (authResult.user?.id) {
      await loadPermissionContext(request, env, authResult.user.id);
    }

    return next();
  };
}