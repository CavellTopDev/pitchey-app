import postgres from 'postgres';

export interface PermissionContext {
  userId: number;
  roles: string[];
  permissions: string[];
}

export interface ContentAccessOptions {
  userId: number;
  contentType: string;
  contentId: number;
  accessLevel?: 'view' | 'edit' | 'admin';
  grantedVia?: string;
  ndaId?: number;
  expiresAt?: Date;
}

export class PermissionService {
  constructor(private sql: ReturnType<typeof postgres>) {}

  /**
   * Load user's roles and permissions
   */
  async getUserPermissions(userId: number): Promise<PermissionContext> {
    const roles = await this.sql`
      SELECT r.name
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ${userId}
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `;

    const permissions = await this.sql`
      SELECT DISTINCT p.name
      FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = ${userId}
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    `;

    return {
      userId,
      roles: roles.map(r => r.name),
      permissions: permissions.map(p => p.name)
    };
  }

  /**
   * Get user permissions with caching for better performance
   */
  async getCachedUserPermissions(userId: number, cache?: any): Promise<PermissionContext> {
    const cacheKey = `permissions:${userId}`;
    
    // Try to get from cache if available
    if (cache) {
      try {
        const cached = await cache.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (error) {
        console.warn('Cache read failed:', error);
      }
    }

    // Load from database
    const permissions = await this.getUserPermissions(userId);

    // Store in cache with 5-minute TTL
    if (cache) {
      try {
        await cache.set(cacheKey, JSON.stringify(permissions), { ex: 300 });
      } catch (error) {
        console.warn('Cache write failed:', error);
      }
    }

    return permissions;
  }

  /**
   * Check if user has specific permission
   */
  hasPermission(ctx: PermissionContext, permission: string): boolean {
    return ctx.permissions.includes(permission);
  }

  /**
   * Check if user has any of the permissions
   */
  hasAnyPermission(ctx: PermissionContext, permissions: string[]): boolean {
    return permissions.some(p => ctx.permissions.includes(p));
  }

  /**
   * Check if user has all permissions
   */
  hasAllPermissions(ctx: PermissionContext, permissions: string[]): boolean {
    return permissions.every(p => ctx.permissions.includes(p));
  }

  /**
   * Check if user has role
   */
  hasRole(ctx: PermissionContext, role: string): boolean {
    return ctx.roles.includes(role);
  }

  /**
   * Check if user has any of the roles
   */
  hasAnyRole(ctx: PermissionContext, roles: string[]): boolean {
    return roles.some(r => ctx.roles.includes(r));
  }

  /**
   * Check content access (for NDA-protected content)
   */
  async checkContentAccess(
    userId: number, 
    contentType: string, 
    contentId: number,
    requiredLevel: 'view' | 'edit' | 'admin' = 'view'
  ): Promise<boolean> {
    const levels = { view: 1, edit: 2, admin: 3 };
    
    const [access] = await this.sql`
      SELECT access_level
      FROM content_access
      WHERE user_id = ${userId}
        AND content_type = ${contentType}
        AND content_id = ${contentId}
        AND (expires_at IS NULL OR expires_at > NOW())
    `;

    if (!access) return false;
    
    const userLevel = levels[access.access_level as keyof typeof levels] || 0;
    const requiredLevelNum = levels[requiredLevel] || 1;
    
    return userLevel >= requiredLevelNum;
  }

  /**
   * Check if user owns the content (creator/owner)
   */
  async checkContentOwnership(
    userId: number,
    contentType: string,
    contentId: number
  ): Promise<boolean> {
    let isOwner = false;

    switch (contentType) {
      case 'pitch':
        const [pitch] = await this.sql`
          SELECT creator_id FROM pitches WHERE id = ${contentId}
        `;
        isOwner = pitch?.creator_id === userId;
        break;

      case 'document':
        const [document] = await this.sql`
          SELECT user_id FROM documents WHERE id = ${contentId}
        `;
        isOwner = document?.user_id === userId;
        break;

      case 'investment':
        const [investment] = await this.sql`
          SELECT investor_id FROM investments WHERE id = ${contentId}
        `;
        isOwner = investment?.investor_id === userId;
        break;
    }

    return isOwner;
  }

  /**
   * Grant content access (e.g., when NDA is approved)
   */
  async grantContentAccess(options: ContentAccessOptions): Promise<void> {
    const {
      userId,
      contentType,
      contentId,
      accessLevel = 'view',
      grantedVia = 'manual',
      ndaId = null,
      expiresAt = null
    } = options;

    await this.sql`
      INSERT INTO content_access (
        user_id, content_type, content_id, access_level, 
        granted_via, nda_id, expires_at
      ) VALUES (
        ${userId}, ${contentType}, ${contentId}, ${accessLevel}, 
        ${grantedVia}, ${ndaId}, ${expiresAt}
      )
      ON CONFLICT (user_id, content_type, content_id) 
      DO UPDATE SET 
        access_level = ${accessLevel}, 
        granted_via = ${grantedVia}, 
        nda_id = ${ndaId},
        expires_at = ${expiresAt},
        granted_at = NOW()
    `;
  }

  /**
   * Grant access to multiple pieces of content at once
   */
  async grantBulkContentAccess(
    userId: number,
    contentItems: Array<{ type: string; id: number }>,
    accessLevel: 'view' | 'edit' | 'admin' = 'view',
    grantedVia: string = 'manual',
    ndaId?: number
  ): Promise<void> {
    const values = contentItems.map(item => ({
      user_id: userId,
      content_type: item.type,
      content_id: item.id,
      access_level: accessLevel,
      granted_via: grantedVia,
      nda_id: ndaId || null
    }));

    if (values.length > 0) {
      await this.sql`
        INSERT INTO content_access ${this.sql(values)}
        ON CONFLICT (user_id, content_type, content_id) 
        DO UPDATE SET 
          access_level = EXCLUDED.access_level,
          granted_via = EXCLUDED.granted_via,
          nda_id = EXCLUDED.nda_id,
          granted_at = NOW()
      `;
    }
  }

  /**
   * Revoke content access
   */
  async revokeContentAccess(
    userId: number,
    contentType: string,
    contentId: number
  ): Promise<void> {
    await this.sql`
      DELETE FROM content_access
      WHERE user_id = ${userId}
        AND content_type = ${contentType}
        AND content_id = ${contentId}
    `;
  }

  /**
   * Revoke all access for a specific NDA
   */
  async revokeNDAAccess(ndaId: number): Promise<void> {
    await this.sql`
      DELETE FROM content_access
      WHERE nda_id = ${ndaId}
    `;
  }

  /**
   * Log permission check (for audit)
   */
  async logPermissionCheck(
    userId: number | null,
    action: string,
    resourceType: string | null,
    resourceId: number | null,
    permissionRequired: string,
    granted: boolean,
    request: Request,
    metadata?: Record<string, any>
  ): Promise<void> {
    const ip = request.headers.get('cf-connecting-ip') || 
               request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip');
    
    const userAgent = request.headers.get('user-agent');
    
    // Convert IP to proper format for PostgreSQL inet type
    const ipAddress = ip ? ip.split(',')[0].trim() : null;

    try {
      await this.sql`
        INSERT INTO permission_audit (
          user_id, action, resource_type, resource_id, 
          permission_required, granted, ip_address, user_agent, metadata
        ) VALUES (
          ${userId}, ${action}, ${resourceType}, ${resourceId},
          ${permissionRequired}, ${granted}, 
          ${ipAddress ? this.sql`${ipAddress}::inet` : null}, 
          ${userAgent},
          ${metadata ? JSON.stringify(metadata) : null}::jsonb
        )
      `;
    } catch (error) {
      console.error('Failed to log permission audit:', error);
      // Don't throw - audit logging should not break the request
    }
  }

  /**
   * Get user's content access list
   */
  async getUserContentAccess(userId: number, contentType?: string): Promise<any[]> {
    if (contentType) {
      return await this.sql`
        SELECT content_id, access_level, granted_via, granted_at, expires_at
        FROM content_access
        WHERE user_id = ${userId}
          AND content_type = ${contentType}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY granted_at DESC
      `;
    } else {
      return await this.sql`
        SELECT content_type, content_id, access_level, granted_via, granted_at, expires_at
        FROM content_access
        WHERE user_id = ${userId}
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY content_type, granted_at DESC
      `;
    }
  }

  /**
   * Check if user can perform an action on a resource
   */
  async canPerformAction(
    userId: number,
    action: string,
    resourceType: string,
    resourceId: number
  ): Promise<boolean> {
    // Get user permissions
    const ctx = await this.getUserPermissions(userId);

    // Map common actions to permissions
    const actionPermissionMap: Record<string, string[]> = {
      'view': [`${resourceType}:read`, `${resourceType}:read_own`],
      'edit': [`${resourceType}:update`, `${resourceType}:update_own`],
      'delete': [`${resourceType}:delete`, `${resourceType}:delete_own`],
      'create': [`${resourceType}:create`],
    };

    const requiredPermissions = actionPermissionMap[action] || [`${resourceType}:${action}`];

    // Check if user has general permission
    if (this.hasAnyPermission(ctx, requiredPermissions.filter(p => !p.includes('_own')))) {
      return true;
    }

    // Check if user has own permission and owns the resource
    if (this.hasAnyPermission(ctx, requiredPermissions.filter(p => p.includes('_own')))) {
      const isOwner = await this.checkContentOwnership(userId, resourceType, resourceId);
      if (isOwner) return true;
    }

    // Check content access table for granted permissions
    if (action === 'view' || action === 'edit') {
      const hasAccess = await this.checkContentAccess(userId, resourceType, resourceId, action as any);
      if (hasAccess) return true;
    }

    return false;
  }

  /**
   * Assign role to user
   */
  async assignRole(userId: number, roleName: string, grantedBy?: number): Promise<void> {
    const [role] = await this.sql`
      SELECT id FROM roles WHERE name = ${roleName}
    `;

    if (!role) {
      throw new Error(`Role '${roleName}' does not exist`);
    }

    await this.sql`
      INSERT INTO user_roles (user_id, role_id, granted_by)
      VALUES (${userId}, ${role.id}, ${grantedBy || null})
      ON CONFLICT (user_id, role_id) DO NOTHING
    `;
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: number, roleName: string): Promise<void> {
    const [role] = await this.sql`
      SELECT id FROM roles WHERE name = ${roleName}
    `;

    if (role) {
      await this.sql`
        DELETE FROM user_roles
        WHERE user_id = ${userId} AND role_id = ${role.id}
      `;
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<any[]> {
    return await this.sql`
      SELECT id, name, description, is_system
      FROM roles
      ORDER BY name
    `;
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<any[]> {
    return await this.sql`
      SELECT id, name, description, category
      FROM permissions
      ORDER BY category, name
    `;
  }
}