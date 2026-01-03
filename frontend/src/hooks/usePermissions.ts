import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { apiClient } from '../services/api-client';

interface PermissionContextType {
  roles: string[];
  permissions: string[];
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  canAccessAdmin: boolean;
  capabilities: {
    canCreatePitch: boolean;
    canInvest: boolean;
    canRequestNDA: boolean;
    canApproveNDA: boolean;
    canUploadDocuments: boolean;
    canSendMessages: boolean;
    canViewAnalytics: boolean;
  };
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

interface PermissionProviderProps {
  children: ReactNode;
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    if (!isAuthenticated || !user) {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.get('/api/user/permissions');
      
      if (response.success && response.data) {
        setRoles(response.data.roles || []);
        setPermissions(response.data.permissions || []);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
      // Fallback to basic permissions based on user type
      if (user.userType) {
        setRoles([user.userType]);
        // Set basic permissions based on user type
        switch (user.userType) {
          case 'creator':
            setPermissions([
              'pitch:create', 'pitch:read', 'pitch:update_own', 
              'nda:approve', 'document:upload'
            ]);
            break;
          case 'investor':
            setPermissions([
              'pitch:read', 'nda:request', 'investment:create'
            ]);
            break;
          case 'production':
            setPermissions([
              'pitch:read', 'nda:request', 'investment:create',
              'document:upload'
            ]);
            break;
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [isAuthenticated, user]);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    return roles.includes(role);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    return perms.every(p => permissions.includes(p));
  };

  const hasAnyRole = (roleList: string[]): boolean => {
    return roleList.some(r => roles.includes(r));
  };

  const value: PermissionContextType = {
    roles,
    permissions,
    loading,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    hasAnyRole,
    canAccessAdmin: hasAnyPermission(['admin:manage_users', 'admin:manage_content', 'admin:view_audit']),
    capabilities: {
      canCreatePitch: hasPermission('pitch:create'),
      canInvest: hasPermission('investment:create'),
      canRequestNDA: hasPermission('nda:request'),
      canApproveNDA: hasPermission('nda:approve'),
      canUploadDocuments: hasPermission('document:upload'),
      canSendMessages: hasPermission('message:send'),
      canViewAnalytics: hasAnyPermission(['analytics:view_own', 'analytics:view_all'])
    },
    refresh: fetchPermissions
  };

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}