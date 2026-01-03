import { ReactNode } from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../hooks/useAuth';

interface PermissionGuardProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  role?: string;
  roles?: string[];
  fallback?: ReactNode;
  showMessage?: boolean;
  children: ReactNode;
}

/**
 * Component to conditionally render children based on permissions
 * 
 * Examples:
 * <PermissionGuard permission="pitch:create">
 *   <CreatePitchButton />
 * </PermissionGuard>
 * 
 * <PermissionGuard roles={['investor', 'production']}>
 *   <InvestmentOptions />
 * </PermissionGuard>
 * 
 * <PermissionGuard permissions={['nda:approve', 'admin:manage_content']} requireAll={false}>
 *   <ApprovalControls />
 * </PermissionGuard>
 */
export function PermissionGuard({ 
  permission, 
  permissions, 
  requireAll = false,
  role, 
  roles,
  fallback = null, 
  showMessage = false,
  children 
}: PermissionGuardProps) {
  const { hasPermission, hasRole, hasAnyPermission, hasAllPermissions, hasAnyRole, loading } = usePermissions();
  const { isAuthenticated } = useAuth();

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // Check authentication first
  if (!isAuthenticated) {
    if (showMessage) {
      return (
        <div className="text-gray-500 italic">
          Please sign in to access this feature
        </div>
      );
    }
    return <>{fallback}</>;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    if (showMessage) {
      return (
        <div className="text-gray-500 italic">
          You don't have permission to access this feature
        </div>
      );
    }
    return <>{fallback}</>;
  }

  // Check multiple permissions
  if (permissions) {
    const hasRequiredPermissions = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    
    if (!hasRequiredPermissions) {
      if (showMessage) {
        return (
          <div className="text-gray-500 italic">
            You don't have the required permissions for this feature
          </div>
        );
      }
      return <>{fallback}</>;
    }
  }

  // Check single role
  if (role && !hasRole(role)) {
    if (showMessage) {
      return (
        <div className="text-gray-500 italic">
          This feature is only available for {role}s
        </div>
      );
    }
    return <>{fallback}</>;
  }

  // Check multiple roles
  if (roles && !hasAnyRole(roles)) {
    if (showMessage) {
      return (
        <div className="text-gray-500 italic">
          This feature is only available for {roles.join(' or ')}s
        </div>
      );
    }
    return <>{fallback}</>;
  }

  // All checks passed, render children
  return <>{children}</>;
}

/**
 * Hook to check if a component should be visible based on permissions
 */
export function usePermissionVisibility(
  options: Omit<PermissionGuardProps, 'children' | 'fallback' | 'showMessage'>
): boolean {
  const { hasPermission, hasRole, hasAnyPermission, hasAllPermissions, hasAnyRole, loading } = usePermissions();
  const { isAuthenticated } = useAuth();

  if (loading || !isAuthenticated) {
    return false;
  }

  const { permission, permissions, requireAll = false, role, roles } = options;

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return false;
  }

  // Check multiple permissions
  if (permissions) {
    const hasRequiredPermissions = requireAll 
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
    
    if (!hasRequiredPermissions) {
      return false;
    }
  }

  // Check single role
  if (role && !hasRole(role)) {
    return false;
  }

  // Check multiple roles
  if (roles && !hasAnyRole(roles)) {
    return false;
  }

  return true;
}