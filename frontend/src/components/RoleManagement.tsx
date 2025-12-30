import React, { useState, useEffect } from 'react';
import { Shield, Users, Key, Settings, Check, X, Edit2, Save, AlertCircle } from 'lucide-react';
import { API_URL } from '../config';

interface User {
  id: number;
  email: string;
  username: string;
  userType: string;
  firstName?: string;
  lastName?: string;
  emailVerified: boolean;
  createdAt: string;
  customPermissions?: Permission[];
}

interface Permission {
  action: string;
  subject: string;
  conditions?: any;
  granted: boolean;
}

interface Role {
  name: string;
  description: string;
  priority: number;
  userCount?: number;
  permissions?: string[];
}

const RoleManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<{ [key: number]: 'saving' | 'saved' | 'error' }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  // Available actions and subjects for permission management
  const availableActions = [
    'manage', 'create', 'read', 'update', 'delete',
    'approve', 'reject', 'request', 'sign',
    'invest', 'withdraw', 'track',
    'message', 'broadcast',
    'moderate', 'feature', 'archive',
    'export', 'import',
    'view_analytics', 'view_sensitive'
  ];

  const availableSubjects = [
    'all', 'Pitch', 'User', 'NDA', 'Investment', 'Message',
    'Analytics', 'Settings', 'Report', 'Export',
    'Dashboard', 'Profile', 'Document', 'Review'
  ];

  // Predefined roles
  const roleDefinitions: Record<string, Role> = {
    superAdmin: {
      name: 'Super Administrator',
      description: 'Complete system access with all permissions',
      priority: 100
    },
    admin: {
      name: 'Administrator',
      description: 'Platform administration and moderation',
      priority: 90
    },
    creator: {
      name: 'Creator',
      description: 'Content creators who can create and manage pitches',
      priority: 50
    },
    investor: {
      name: 'Investor',
      description: 'Investors who can browse pitches and make investments',
      priority: 40
    },
    productionCompany: {
      name: 'Production Company',
      description: 'Production companies evaluating pitches',
      priority: 45
    },
    moderator: {
      name: 'Moderator',
      description: 'Content moderation and quality control',
      priority: 60
    },
    viewer: {
      name: 'Viewer',
      description: 'Basic viewing permissions for public content',
      priority: 10
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'GET',
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        const data = await response.json();
        const rolesWithCounts = data.data || [];
        
        // Merge with role definitions
        const mergedRoles = Object.keys(roleDefinitions).map(key => ({
          ...roleDefinitions[key],
          key,
          userCount: rolesWithCounts.find(r => r.name === key)?.userCount || 0
        }));
        
        setRoles(mergedRoles);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const updateUserRole = async (userId: number, newRole: string) => {
    setSaveStatus({ ...saveStatus, [userId]: 'saving' });
    
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        // Update local state
        setUsers(users.map(user => 
          user.id === userId ? { ...user, userType: newRole } : user
        ));
        setSaveStatus({ ...saveStatus, [userId]: 'saved' });
        
        // Clear saved status after 2 seconds
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [userId]: undefined }));
        }, 2000);
        
        // Refresh role counts
        fetchRoles();
      } else {
        setSaveStatus({ ...saveStatus, [userId]: 'error' });
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      setSaveStatus({ ...saveStatus, [userId]: 'error' });
    }
  };

  const addCustomPermission = async (userId: number, permission: Permission) => {
    try {
      const token = localStorage.getItem('authToken');
    const response = await fetch(`${config.API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        // Update local state
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser) {
          const newPermissions = [...(updatedUser.customPermissions || []), permission];
          setUsers(users.map(user => 
            user.id === userId ? { ...user, customPermissions: newPermissions } : user
          ));
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error adding permission:', error);
    }
    
    return false;
  };

  const removeCustomPermission = async (userId: number, permissionIndex: number) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(
        `${API_URL}/api/admin/users/${userId}/permissions/${permissionIndex}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        // Update local state
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser && updatedUser.customPermissions) {
          const newPermissions = updatedUser.customPermissions.filter((_, i) => i !== permissionIndex);
          setUsers(users.map(user => 
            user.id === userId ? { ...user, customPermissions: newPermissions } : user
          ));
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error removing permission:', error);
    }
    
    return false;
  };

  // Filter users based on search and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.userType === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeColor = (role: string) => {
    const colors = {
      superAdmin: 'bg-red-500',
      admin: 'bg-purple-500',
      creator: 'bg-blue-500',
      investor: 'bg-green-500',
      productionCompany: 'bg-yellow-500',
      moderator: 'bg-orange-500',
      viewer: 'bg-gray-500'
    };
    
    return colors[role] || 'bg-gray-400';
  };

  const PermissionEditor = ({ user }: { user: User }) => {
    const [newPermission, setNewPermission] = useState<Permission>({
      action: 'read',
      subject: 'Pitch',
      granted: true
    });
    
    const handleAddPermission = async () => {
      const success = await addCustomPermission(user.id, newPermission);
      if (success) {
        setNewPermission({ action: 'read', subject: 'Pitch', granted: true });
      }
    };
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Custom Permissions</h4>
        
        {/* Existing permissions */}
        {user.customPermissions && user.customPermissions.length > 0 && (
          <div className="space-y-2 mb-4">
            {user.customPermissions.map((perm, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                <div className="flex items-center space-x-2">
                  {perm.granted ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <X className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-sm">
                    {perm.granted ? 'Can' : 'Cannot'} {perm.action} {perm.subject}
                  </span>
                </div>
                <button
                  onClick={() => removeCustomPermission(user.id, index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        {/* Add new permission */}
        <div className="flex items-center space-x-2">
          <select
            value={newPermission.granted ? 'grant' : 'deny'}
            onChange={(e) => setNewPermission({ ...newPermission, granted: e.target.value === 'grant' })}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="grant">Grant</option>
            <option value="deny">Deny</option>
          </select>
          
          <select
            value={newPermission.action}
            onChange={(e) => setNewPermission({ ...newPermission, action: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            {availableActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
          
          <select
            value={newPermission.subject}
            onChange={(e) => setNewPermission({ ...newPermission, subject: e.target.value })}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            {availableSubjects.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          
          <button
            onClick={handleAddPermission}
            className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
          >
            Add
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Shield className="w-8 h-8 mr-3 text-blue-500" />
          Role & Permission Management
        </h2>
        <p className="text-gray-600 mt-1">Manage user roles and granular permissions</p>
      </div>

      {/* Role Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {roles.map(role => (
          <div key={role.name} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{role.name}</p>
                <p className="text-2xl font-bold">{role.userCount || 0}</p>
              </div>
              <div className={`p-3 rounded-full ${getRoleBadgeColor(role.key || role.name)} bg-opacity-10`}>
                <Users className={`w-6 h-6 ${getRoleBadgeColor(role.key || role.name).replace('bg-', 'text-')}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              {Object.entries(roleDefinitions).map(([key, role]) => (
                <option key={key} value={key}>{role.name}</option>
              ))}
            </select>
          </div>
          
          <div className="mt-4 md:mt-0">
            <span className="text-sm text-gray-500">
              Showing {filteredUsers.length} of {users.length} users
            </span>
          </div>
        </div>
      </div>

      {/* User List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map(user => (
              <React.Fragment key={user.id}>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.username}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingUserId === user.id ? (
                      <select
                        value={user.userType}
                        onChange={(e) => {
                          updateUserRole(user.id, e.target.value);
                          setEditingUserId(null);
                        }}
                        onBlur={() => setEditingUserId(null)}
                        className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        autoFocus
                      >
                        {Object.entries(roleDefinitions).map(([key, role]) => (
                          <option key={key} value={key}>{role.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white ${getRoleBadgeColor(user.userType)}`}>
                          {roleDefinitions[user.userType]?.name || user.userType}
                        </span>
                        {saveStatus[user.id] === 'saved' && (
                          <Check className="w-4 h-4 ml-2 text-green-500" />
                        )}
                        {saveStatus[user.id] === 'saving' && (
                          <div className="ml-2 animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                        )}
                        {saveStatus[user.id] === 'error' && (
                          <AlertCircle className="w-4 h-4 ml-2 text-red-500" />
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.emailVerified ? (
                        <>
                          <Check className="w-4 h-4 text-green-500 mr-1" />
                          <span className="text-sm text-green-600">Verified</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-yellow-500 mr-1" />
                          <span className="text-sm text-yellow-600">Unverified</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setEditingUserId(user.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit Role"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setSelectedUser(selectedUser?.id === user.id ? null : user)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Manage Permissions"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
                {selectedUser?.id === user.id && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 bg-gray-50">
                      <PermissionEditor user={user} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RoleManagement;