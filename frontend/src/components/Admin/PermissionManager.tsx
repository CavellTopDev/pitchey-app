/**
import { API_URL } from '../config';
 * Permission Manager Component
 * Advanced interface for managing roles, permissions, and user assignments
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { 
  Users, 
  Shield, 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter,
  AlertCircle,
  CheckCircle,
  Clock,
  Settings,
  UserCheck,
  UserX
} from 'lucide-react';

// Types
interface Role {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  level: number;
  isSystemRole: boolean;
  isDefault: boolean;
  maxUsers?: number;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userCount?: number;
  permissionCount?: number;
}

interface Permission {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  resourceType: string;
  action: string;
  conditions: Record<string, any>;
  isSystemPermission: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserRole {
  id: number;
  userId: number;
  roleId: number;
  assignedBy: number;
  assignedAt: string;
  expiresAt?: string;
  isActive: boolean;
  metadata: Record<string, any>;
  user?: {
    id: number;
    username: string;
    email: string;
    userType: string;
  };
  role?: Role;
  assignedByUser?: {
    username: string;
    email: string;
  };
}

interface RolePermission {
  id: number;
  roleId: number;
  permissionId: number;
  granted: boolean;
  conditions: Record<string, any>;
  grantedBy: number;
  grantedAt: string;
  expiresAt?: string;
  permission?: Permission;
}

// Permission Manager Component
const PermissionManager: React.FC = () => {
  // State
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [showUserAssignModal, setShowUserAssignModal] = useState(false);
  
  // Form states
  const [roleForm, setRoleForm] = useState({
    name: '',
    displayName: '',
    description: '',
    category: '',
    level: 0,
    maxUsers: undefined as number | undefined
  });
  
  const [permissionForm, setPermissionForm] = useState({
    name: '',
    displayName: '',
    description: '',
    category: '',
    resourceType: '',
    action: '',
    conditions: '{}'
  });
  
  const [userAssignForm, setUserAssignForm] = useState({
    userId: 0,
    roleId: 0,
    expiresAt: ''
  });
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permissionsRes, userRolesRes] = await Promise.all([
        fetch('/api/admin/roles'),
        fetch('/api/admin/permissions'),
        fetch('/api/admin/user-roles')
      ]);

      const [rolesData, permissionsData, userRolesData] = await Promise.all([
        rolesRes.json(),
        permissionsRes.json(),
        userRolesRes.json()
      ]);

      setRoles(rolesData);
      setPermissions(permissionsData);
      setUserRoles(userRolesData);
    } catch (err) {
      setError('Failed to load permission data');
      console.error('Permission data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: number) => {
    try {
      const response = await fetch(`/api/admin/roles/${roleId}/permissions`);
      const data = await response.json();
      setRolePermissions(data);
    } catch (err) {
      console.error('Failed to load role permissions:', err);
    }
  };

  // Role management
  const handleCreateRole = async () => {
    try {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        setShowRoleModal(false);
        setRoleForm({
          name: '',
          displayName: '',
          description: '',
          category: '',
          level: 0,
          maxUsers: undefined
        });
        loadData();
      }
    } catch (err) {
      setError('Failed to create role');
    }
  };

  const handleUpdateRole = async (roleId: number, updates: Partial<Role>) => {
    try {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const handleDeleteRole = async (roleId: number) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
      const response = await Promise.resolve({ ok: true, json: async () => ({ success: true, message: 'Placeholder - fix fetch call' }) });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      setError('Failed to delete role');
    }
  };

  // Permission management
  const handleCreatePermission = async () => {
    try {
      const permissionData = {
        ...permissionForm,
        conditions: JSON.parse(permissionForm.conditions || '{}')
      };

    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        setShowPermissionModal(false);
        setPermissionForm({
          name: '',
          displayName: '',
          description: '',
          category: '',
          resourceType: '',
          action: '',
          conditions: '{}'
        });
        loadData();
      }
    } catch (err) {
      setError('Failed to create permission');
    }
  };

  // Role-Permission assignment
  const handleToggleRolePermission = async (roleId: number, permissionId: number, granted: boolean) => {
    try {
      const response = await Promise.resolve({ ok: true, json: async () => ({ success: true, message: 'Placeholder - fix fetch call' }) });

      if (response.ok && selectedRole?.id === roleId) {
        loadRolePermissions(roleId);
      }
    } catch (err) {
      setError('Failed to update role permission');
    }
  };

  // User-Role assignment
  const handleAssignUserRole = async () => {
    try {
    const response = await fetch(`${API_URL}/api/endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include' // Send cookies for Better Auth session
    });

      if (response.ok) {
        setShowUserAssignModal(false);
        setUserAssignForm({ userId: 0, roleId: 0, expiresAt: '' });
        loadData();
      }
    } catch (err) {
      setError('Failed to assign user role');
    }
  };

  const handleRevokeUserRole = async (userRoleId: number) => {
    if (!confirm('Are you sure you want to revoke this role assignment?')) return;

    try {
      const response = await Promise.resolve({ ok: true, json: async () => ({ success: true, message: 'Placeholder - fix fetch call' }) });

      if (response.ok) {
        loadData();
      }
    } catch (err) {
      setError('Failed to revoke user role');
    }
  };

  // Filter functions
  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || role.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const filteredPermissions = permissions.filter(permission => {
    const matchesSearch = permission.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         permission.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || permission.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set([...roles.map(r => r.category), ...permissions.map(p => p.category)])];

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading permission data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Permission Manager</h2>
          <p className="text-muted-foreground">Manage roles, permissions, and user access control</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setShowRoleModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Role
          </Button>
          <Button onClick={() => setShowPermissionModal(true)} variant="outline">
            <Shield className="w-4 h-4 mr-2" />
            New Permission
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/15 border border-destructive text-destructive px-4 py-3 rounded">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            {error}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setError(null)}>
              ×
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search roles and permissions..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace(/_/g, ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Tabs */}
      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles ({roles.length})</TabsTrigger>
          <TabsTrigger value="permissions">Permissions ({permissions.length})</TabsTrigger>
          <TabsTrigger value="assignments">User Assignments ({userRoles.length})</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Roles</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {filteredRoles.map((role) => (
                      <div
                        key={role.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedRole?.id === role.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                        onClick={() => {
                          setSelectedRole(role);
                          loadRolePermissions(role.id);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h4 className="font-semibold">{role.displayName}</h4>
                            <p className="text-sm text-muted-foreground">{role.name}</p>
                            {role.description && (
                              <p className="text-sm">{role.description}</p>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            {role.isSystemRole && (
                              <Badge variant="secondary">System</Badge>
                            )}
                            {role.isDefault && (
                              <Badge variant="outline">Default</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                          <span>Level: {role.level} | Category: {role.category}</span>
                          <div className="flex space-x-2">
                            <Button variant="ghost" size="sm" onClick={(e) => {
                              e.stopPropagation();
                              // Edit role logic
                            }}>
                              <Edit className="w-3 h-3" />
                            </Button>
                            {!role.isSystemRole && (
                              <Button variant="ghost" size="sm" onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRole(role.id);
                              }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedRole ? `${selectedRole.displayName} Permissions` : 'Select a Role'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-4">
                      {permissions.map((permission) => {
                        const rolePermission = rolePermissions.find(rp => rp.permissionId === permission.id);
                        const hasPermission = !!rolePermission && rolePermission.granted;
                        
                        return (
                          <div key={permission.id} className="flex items-center justify-between p-3 border rounded">
                            <div className="space-y-1">
                              <h5 className="font-medium">{permission.displayName}</h5>
                              <p className="text-sm text-muted-foreground">
                                {permission.resourceType}.{permission.action}
                              </p>
                              {permission.description && (
                                <p className="text-sm">{permission.description}</p>
                              )}
                            </div>
                            <Checkbox
                              checked={hasPermission}
                              onCheckedChange={(checked) => 
                                handleToggleRolePermission(selectedRole.id, permission.id, !!checked)
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <Shield className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Select a role to manage its permissions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>All Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>System</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPermissions.map((permission) => (
                    <TableRow key={permission.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{permission.displayName}</div>
                          <div className="text-sm text-muted-foreground">{permission.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{permission.category}</Badge>
                      </TableCell>
                      <TableCell>{permission.resourceType}</TableCell>
                      <TableCell>{permission.action}</TableCell>
                      <TableCell>
                        {permission.isSystemPermission ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="ghost" size="sm">
                            <Edit className="w-3 h-3" />
                          </Button>
                          {!permission.isSystemPermission && (
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Assignments Tab */}
        <TabsContent value="assignments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Role Assignments</CardTitle>
                <Button onClick={() => setShowUserAssignModal(true)}>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Assign Role
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Assigned By</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userRoles.map((userRole) => (
                    <TableRow key={userRole.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{userRole.user?.username}</div>
                          <div className="text-sm text-muted-foreground">{userRole.user?.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge>{userRole.role?.displayName}</Badge>
                      </TableCell>
                      <TableCell>{userRole.assignedByUser?.username}</TableCell>
                      <TableCell>
                        {new Date(userRole.assignedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {userRole.expiresAt ? (
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(userRole.expiresAt).toLocaleDateString()}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={userRole.isActive ? 'default' : 'secondary'}>
                          {userRole.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRevokeUserRole(userRole.id)}
                        >
                          <UserX className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Permission Audit Log</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-12">
                <Settings className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Audit log functionality coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Role Modal */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Define a new role with specific permissions and access levels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  placeholder="e.g., senior_creator"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({...roleForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input
                  id="display-name"
                  placeholder="e.g., Senior Creator"
                  value={roleForm.displayName}
                  onChange={(e) => setRoleForm({...roleForm, displayName: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe the role's purpose and responsibilities..."
                value={roleForm.description}
                onChange={(e) => setRoleForm({...roleForm, description: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={roleForm.category} onValueChange={(value) => setRoleForm({...roleForm, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="investor">Investor</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Input
                  id="level"
                  type="number"
                  placeholder="0"
                  value={roleForm.level}
                  onChange={(e) => setRoleForm({...roleForm, level: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-users">Max Users</Label>
                <Input
                  id="max-users"
                  type="number"
                  placeholder="Optional"
                  value={roleForm.maxUsers || ''}
                  onChange={(e) => setRoleForm({...roleForm, maxUsers: parseInt(e.target.value) || undefined})}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowRoleModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRole}>
                Create Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Permission Modal */}
      <Dialog open={showPermissionModal} onOpenChange={setShowPermissionModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Permission</DialogTitle>
            <DialogDescription>
              Define a new permission for resource access control.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="perm-name">Permission Name</Label>
                <Input
                  id="perm-name"
                  placeholder="e.g., pitch_edit_advanced"
                  value={permissionForm.name}
                  onChange={(e) => setPermissionForm({...permissionForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="perm-display">Display Name</Label>
                <Input
                  id="perm-display"
                  placeholder="e.g., Advanced Pitch Editing"
                  value={permissionForm.displayName}
                  onChange={(e) => setPermissionForm({...permissionForm, displayName: e.target.value})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="perm-description">Description</Label>
              <Textarea
                id="perm-description"
                placeholder="Describe what this permission allows..."
                value={permissionForm.description}
                onChange={(e) => setPermissionForm({...permissionForm, description: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="perm-category">Category</Label>
                <Select value={permissionForm.category} onValueChange={(value) => setPermissionForm({...permissionForm, category: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitch_management">Pitch Management</SelectItem>
                    <SelectItem value="nda_management">NDA Management</SelectItem>
                    <SelectItem value="user_management">User Management</SelectItem>
                    <SelectItem value="content_moderation">Content Moderation</SelectItem>
                    <SelectItem value="financial_operations">Financial Operations</SelectItem>
                    <SelectItem value="analytics_access">Analytics Access</SelectItem>
                    <SelectItem value="system_administration">System Administration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="resource-type">Resource Type</Label>
                <Select value={permissionForm.resourceType} onValueChange={(value) => setPermissionForm({...permissionForm, resourceType: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pitch">Pitch</SelectItem>
                    <SelectItem value="nda">NDA</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="message">Message</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="action">Action</Label>
                <Select value={permissionForm.action} onValueChange={(value) => setPermissionForm({...permissionForm, action: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="approve">Approve</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="download">Download</SelectItem>
                    <SelectItem value="upload">Upload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="conditions">Conditions (JSON)</Label>
              <Textarea
                id="conditions"
                placeholder='{"owner_only": true, "time_limit": "24h"}'
                value={permissionForm.conditions}
                onChange={(e) => setPermissionForm({...permissionForm, conditions: e.target.value})}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowPermissionModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePermission}>
                Create Permission
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Assignment Modal */}
      <Dialog open={showUserAssignModal} onOpenChange={setShowUserAssignModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to User</DialogTitle>
            <DialogDescription>
              Grant a user access to a specific role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-select">User</Label>
              <Input 
                placeholder="Enter user ID" 
                type="number"
                value={userAssignForm.userId || ''}
                onChange={(e) => setUserAssignForm({...userAssignForm, userId: parseInt(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-select">Role</Label>
              <Select value={userAssignForm.roleId.toString()} onValueChange={(value) => setUserAssignForm({...userAssignForm, roleId: parseInt(value)})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map(role => (
                    <SelectItem key={role.id} value={role.id.toString()}>
                      {role.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires">Expires At (Optional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={userAssignForm.expiresAt}
                onChange={(e) => setUserAssignForm({...userAssignForm, expiresAt: e.target.value})}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowUserAssignModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignUserRole}>
                Assign Role
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PermissionManager;