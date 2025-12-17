/**
 * Admin Routes - Permission Management Endpoints
 * Provides comprehensive role and permission management capabilities
 */

import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { PermissionService } from "../services/permission.service.ts";
import { successResponse, errorResponse, validationErrorResponse } from "../utils/response.ts";
import { authenticate, requireRole } from "../middleware/auth.middleware.ts";

const router = new Router();

// Middleware - require admin access for all admin routes
router.use(async (ctx, next) => {
  const authResult = await authenticate(ctx.request);
  if (!authResult.success) {
    ctx.response.status = 401;
    ctx.response.body = authResult.response;
    return;
  }

  ctx.state.user = authResult.user;

  // Check admin permissions
  const hasAdminAccess = await PermissionService.hasPermission(
    authResult.user.id,
    ['system_administration', 'user_management'],
    { requireAny: true }
  );

  if (!hasAdminAccess) {
    ctx.response.status = 403;
    ctx.response.body = errorResponse("Admin access required");
    return;
  }

  await next();
});

// ===== ROLE MANAGEMENT =====

// GET /admin/roles - List all roles
router.get("/roles", async (ctx) => {
  try {
    const roles = await PermissionService.getAllRoles();
    ctx.response.body = successResponse(roles);
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch roles");
  }
});

// GET /admin/roles/:id - Get specific role with permissions
router.get("/roles/:id", async (ctx) => {
  try {
    const roleId = parseInt(ctx.params.id!);
    if (isNaN(roleId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid role ID");
      return;
    }

    const role = await PermissionService.getRoleById(roleId);
    if (!role) {
      ctx.response.status = 404;
      ctx.response.body = errorResponse("Role not found");
      return;
    }

    const rolePermissions = await PermissionService.getRolePermissions(roleId);
    
    ctx.response.body = successResponse({
      ...role,
      permissions: rolePermissions
    });
  } catch (error) {
    console.error("Failed to fetch role:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch role");
  }
});

// POST /admin/roles - Create new role
router.post("/roles", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    
    const {
      name,
      displayName,
      description,
      category,
      level = 0,
      maxUsers,
      metadata = {}
    } = body;

    // Validation
    if (!name || !displayName || !category) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Name, displayName, and category are required");
      return;
    }

    const roleData = {
      name: name.toLowerCase().replace(/\s+/g, '_'),
      displayName,
      description,
      category: category.toLowerCase(),
      level: parseInt(level) || 0,
      maxUsers: maxUsers ? parseInt(maxUsers) : undefined,
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata,
      isSystemRole: false,
      isDefault: false,
      createdBy: ctx.state.user.id
    };

    const newRole = await PermissionService.createRole(roleData);
    
    // Log the creation
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'role_create',
      roleId: newRole.id,
      newValue: roleData,
      reason: 'Admin role creation',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.status = 201;
    ctx.response.body = successResponse(newRole);
  } catch (error) {
    console.error("Failed to create role:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to create role");
  }
});

// PUT /admin/roles/:id - Update role
router.put("/roles/:id", async (ctx) => {
  try {
    const roleId = parseInt(ctx.params.id!);
    if (isNaN(roleId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid role ID");
      return;
    }

    const existingRole = await PermissionService.getRoleById(roleId);
    if (!existingRole) {
      ctx.response.status = 404;
      ctx.response.body = errorResponse("Role not found");
      return;
    }

    if (existingRole.isSystemRole) {
      ctx.response.status = 403;
      ctx.response.body = errorResponse("Cannot modify system roles");
      return;
    }

    const body = await ctx.request.body().value;
    const updateData = { ...body };
    
    // Don't allow changing critical fields
    delete updateData.id;
    delete updateData.isSystemRole;
    delete updateData.createdAt;

    const updatedRole = await PermissionService.updateRole(roleId, updateData);
    
    // Log the update
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'role_update',
      roleId: roleId,
      oldValue: existingRole,
      newValue: updateData,
      reason: 'Admin role update',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.body = successResponse(updatedRole);
  } catch (error) {
    console.error("Failed to update role:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to update role");
  }
});

// DELETE /admin/roles/:id - Delete role
router.delete("/roles/:id", async (ctx) => {
  try {
    const roleId = parseInt(ctx.params.id!);
    if (isNaN(roleId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid role ID");
      return;
    }

    const role = await PermissionService.getRoleById(roleId);
    if (!role) {
      ctx.response.status = 404;
      ctx.response.body = errorResponse("Role not found");
      return;
    }

    if (role.isSystemRole) {
      ctx.response.status = 403;
      ctx.response.body = errorResponse("Cannot delete system roles");
      return;
    }

    // Check if role is in use
    const userCount = await PermissionService.getRoleUserCount(roleId);
    if (userCount > 0) {
      ctx.response.status = 400;
      ctx.response.body = errorResponse(`Cannot delete role: ${userCount} users still assigned to this role`);
      return;
    }

    await PermissionService.deleteRole(roleId);
    
    // Log the deletion
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'role_delete',
      roleId: roleId,
      oldValue: role,
      reason: 'Admin role deletion',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.body = successResponse({ message: "Role deleted successfully" });
  } catch (error) {
    console.error("Failed to delete role:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to delete role");
  }
});

// ===== PERMISSION MANAGEMENT =====

// GET /admin/permissions - List all permissions
router.get("/permissions", async (ctx) => {
  try {
    const permissions = await PermissionService.getAllPermissions();
    ctx.response.body = successResponse(permissions);
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch permissions");
  }
});

// POST /admin/permissions - Create new permission
router.post("/permissions", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    
    const {
      name,
      displayName,
      description,
      category,
      resourceType,
      action,
      conditions = {}
    } = body;

    // Validation
    if (!name || !displayName || !category || !resourceType || !action) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("All required fields must be provided");
      return;
    }

    const permissionData = {
      name: name.toLowerCase().replace(/\s+/g, '_'),
      displayName,
      description,
      category: category.toLowerCase(),
      resourceType: resourceType.toLowerCase(),
      action: action.toLowerCase(),
      conditions: typeof conditions === 'string' ? JSON.parse(conditions) : conditions,
      isSystemPermission: false
    };

    const newPermission = await PermissionService.createPermission(permissionData);
    
    // Log the creation
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'permission_create',
      permissionId: newPermission.id,
      newValue: permissionData,
      reason: 'Admin permission creation',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.status = 201;
    ctx.response.body = successResponse(newPermission);
  } catch (error) {
    console.error("Failed to create permission:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to create permission");
  }
});

// DELETE /admin/permissions/:id - Delete permission
router.delete("/permissions/:id", async (ctx) => {
  try {
    const permissionId = parseInt(ctx.params.id!);
    if (isNaN(permissionId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid permission ID");
      return;
    }

    const permission = await PermissionService.getPermissionById(permissionId);
    if (!permission) {
      ctx.response.status = 404;
      ctx.response.body = errorResponse("Permission not found");
      return;
    }

    if (permission.isSystemPermission) {
      ctx.response.status = 403;
      ctx.response.body = errorResponse("Cannot delete system permissions");
      return;
    }

    await PermissionService.deletePermission(permissionId);
    
    // Log the deletion
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'permission_delete',
      permissionId: permissionId,
      oldValue: permission,
      reason: 'Admin permission deletion',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.body = successResponse({ message: "Permission deleted successfully" });
  } catch (error) {
    console.error("Failed to delete permission:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to delete permission");
  }
});

// ===== ROLE-PERMISSION ASSIGNMENT =====

// GET /admin/roles/:id/permissions - Get role's permissions
router.get("/roles/:roleId/permissions", async (ctx) => {
  try {
    const roleId = parseInt(ctx.params.roleId!);
    if (isNaN(roleId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid role ID");
      return;
    }

    const rolePermissions = await PermissionService.getRolePermissions(roleId);
    ctx.response.body = successResponse(rolePermissions);
  } catch (error) {
    console.error("Failed to fetch role permissions:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch role permissions");
  }
});

// POST /admin/roles/:roleId/permissions/:permissionId - Grant permission to role
router.post("/roles/:roleId/permissions/:permissionId", async (ctx) => {
  try {
    const roleId = parseInt(ctx.params.roleId!);
    const permissionId = parseInt(ctx.params.permissionId!);
    
    if (isNaN(roleId) || isNaN(permissionId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid role or permission ID");
      return;
    }

    const body = await ctx.request.body().value;
    const { conditions = {}, expiresAt } = body || {};

    const rolePermission = await PermissionService.grantRolePermission({
      roleId,
      permissionId,
      granted: true,
      conditions: typeof conditions === 'string' ? JSON.parse(conditions) : conditions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      grantedBy: ctx.state.user.id
    });

    // Log the grant
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'role_permission_grant',
      roleId: roleId,
      permissionId: permissionId,
      newValue: { granted: true, conditions, expiresAt },
      reason: 'Admin permission grant',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.body = successResponse(rolePermission);
  } catch (error) {
    console.error("Failed to grant role permission:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to grant permission");
  }
});

// DELETE /admin/roles/:roleId/permissions/:permissionId - Revoke permission from role
router.delete("/roles/:roleId/permissions/:permissionId", async (ctx) => {
  try {
    const roleId = parseInt(ctx.params.roleId!);
    const permissionId = parseInt(ctx.params.permissionId!);
    
    if (isNaN(roleId) || isNaN(permissionId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid role or permission ID");
      return;
    }

    await PermissionService.revokeRolePermission(roleId, permissionId);

    // Log the revocation
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      action: 'role_permission_revoke',
      roleId: roleId,
      permissionId: permissionId,
      newValue: { granted: false },
      reason: 'Admin permission revocation',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.body = successResponse({ message: "Permission revoked successfully" });
  } catch (error) {
    console.error("Failed to revoke role permission:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to revoke permission");
  }
});

// ===== USER ROLE ASSIGNMENT =====

// GET /admin/user-roles - List all user role assignments
router.get("/user-roles", async (ctx) => {
  try {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const userId = url.searchParams.get('userId');
    const roleId = url.searchParams.get('roleId');
    const active = url.searchParams.get('active');

    const filters = {
      userId: userId ? parseInt(userId) : undefined,
      roleId: roleId ? parseInt(roleId) : undefined,
      active: active !== null ? active === 'true' : undefined
    };

    const userRoles = await PermissionService.getUserRoles(filters, { page, limit });
    ctx.response.body = successResponse(userRoles);
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch user roles");
  }
});

// POST /admin/user-roles - Assign role to user
router.post("/user-roles", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const { userId, roleId, expiresAt, metadata = {} } = body;

    if (!userId || !roleId) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("User ID and Role ID are required");
      return;
    }

    // Check if assignment already exists
    const existingAssignment = await PermissionService.getUserRole(userId, roleId);
    if (existingAssignment && existingAssignment.isActive) {
      ctx.response.status = 400;
      ctx.response.body = errorResponse("User already has this role assigned");
      return;
    }

    const userRole = await PermissionService.assignUserRole({
      userId: parseInt(userId),
      roleId: parseInt(roleId),
      assignedBy: ctx.state.user.id,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      metadata: typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    });

    // Log the assignment
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      targetUserId: parseInt(userId),
      action: 'user_role_assign',
      roleId: parseInt(roleId),
      newValue: { userId, roleId, expiresAt, metadata },
      reason: 'Admin role assignment',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.status = 201;
    ctx.response.body = successResponse(userRole);
  } catch (error) {
    console.error("Failed to assign user role:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to assign role");
  }
});

// DELETE /admin/user-roles/:id - Revoke user role assignment
router.delete("/user-roles/:id", async (ctx) => {
  try {
    const userRoleId = parseInt(ctx.params.id!);
    if (isNaN(userRoleId)) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Invalid user role ID");
      return;
    }

    const userRole = await PermissionService.getUserRoleById(userRoleId);
    if (!userRole) {
      ctx.response.status = 404;
      ctx.response.body = errorResponse("User role assignment not found");
      return;
    }

    await PermissionService.revokeUserRole(userRoleId);

    // Log the revocation
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      targetUserId: userRole.userId,
      action: 'user_role_revoke',
      roleId: userRole.roleId,
      oldValue: userRole,
      reason: 'Admin role revocation',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.body = successResponse({ message: "User role revoked successfully" });
  } catch (error) {
    console.error("Failed to revoke user role:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to revoke user role");
  }
});

// ===== RESOURCE PERMISSIONS =====

// GET /admin/resource-permissions - List resource-specific permissions
router.get("/resource-permissions", async (ctx) => {
  try {
    const url = new URL(ctx.request.url);
    const userId = url.searchParams.get('userId');
    const resourceType = url.searchParams.get('resourceType');
    const resourceId = url.searchParams.get('resourceId');

    const filters = {
      userId: userId ? parseInt(userId) : undefined,
      resourceType: resourceType || undefined,
      resourceId: resourceId ? parseInt(resourceId) : undefined
    };

    const resourcePermissions = await PermissionService.getResourcePermissions(filters);
    ctx.response.body = successResponse(resourcePermissions);
  } catch (error) {
    console.error("Failed to fetch resource permissions:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch resource permissions");
  }
});

// POST /admin/resource-permissions - Grant resource-specific permission
router.post("/resource-permissions", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const {
      userId,
      resourceType,
      resourceId,
      permissionId,
      granted = true,
      conditions = {},
      expiresAt
    } = body;

    if (!userId || !resourceType || !resourceId || !permissionId) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("All required fields must be provided");
      return;
    }

    const resourcePermission = await PermissionService.grantResourcePermission({
      userId: parseInt(userId),
      resourceType,
      resourceId: parseInt(resourceId),
      permissionId: parseInt(permissionId),
      granted,
      conditions: typeof conditions === 'string' ? JSON.parse(conditions) : conditions,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      grantedBy: ctx.state.user.id
    });

    // Log the grant
    await PermissionService.logPermissionChange({
      userId: ctx.state.user.id,
      targetUserId: parseInt(userId),
      action: 'resource_permission_grant',
      resourceType,
      resourceId: parseInt(resourceId),
      permissionId: parseInt(permissionId),
      newValue: { granted, conditions, expiresAt },
      reason: 'Admin resource permission grant',
      ipAddress: ctx.request.ip,
      userAgent: ctx.request.headers.get('user-agent')
    });

    ctx.response.status = 201;
    ctx.response.body = successResponse(resourcePermission);
  } catch (error) {
    console.error("Failed to grant resource permission:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to grant resource permission");
  }
});

// ===== AUDIT LOG =====

// GET /admin/audit-log - Get permission audit log
router.get("/audit-log", async (ctx) => {
  try {
    const url = new URL(ctx.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const userId = url.searchParams.get('userId');
    const targetUserId = url.searchParams.get('targetUserId');
    const action = url.searchParams.get('action');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    const filters = {
      userId: userId ? parseInt(userId) : undefined,
      targetUserId: targetUserId ? parseInt(targetUserId) : undefined,
      action: action || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const auditLog = await PermissionService.getAuditLog(filters, { page, limit });
    ctx.response.body = successResponse(auditLog);
  } catch (error) {
    console.error("Failed to fetch audit log:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Failed to fetch audit log");
  }
});

// ===== BULK OPERATIONS =====

// POST /admin/bulk/role-assignments - Bulk assign roles
router.post("/bulk/role-assignments", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const { assignments, reason = 'Bulk assignment' } = body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      ctx.response.status = 400;
      ctx.response.body = validationErrorResponse("Assignments array is required");
      return;
    }

    const results = [];
    const errors = [];

    for (const assignment of assignments) {
      try {
        const userRole = await PermissionService.assignUserRole({
          ...assignment,
          assignedBy: ctx.state.user.id
        });
        results.push(userRole);

        // Log each assignment
        await PermissionService.logPermissionChange({
          userId: ctx.state.user.id,
          targetUserId: assignment.userId,
          action: 'bulk_user_role_assign',
          roleId: assignment.roleId,
          newValue: assignment,
          reason: `Bulk operation: ${reason}`,
          ipAddress: ctx.request.ip,
          userAgent: ctx.request.headers.get('user-agent')
        });
      } catch (error) {
        errors.push({
          assignment,
          error: error.message
        });
      }
    }

    ctx.response.body = successResponse({
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (error) {
    console.error("Bulk role assignment failed:", error);
    ctx.response.status = 500;
    ctx.response.body = errorResponse("Bulk role assignment failed");
  }
});

export default router;