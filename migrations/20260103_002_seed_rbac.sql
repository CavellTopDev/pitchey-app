-- Seed Default Roles & Permissions for Pitchey RBAC

-- Insert system roles
INSERT INTO roles (name, description, is_system) VALUES
  ('creator', 'Content creators who submit pitches', true),
  ('investor', 'Investors who fund pitches', true),
  ('production', 'Production companies', true),
  ('admin', 'Platform administrators', true)
ON CONFLICT (name) DO NOTHING;

-- Insert permissions
INSERT INTO permissions (name, description, category) VALUES
  -- Pitch permissions
  ('pitch:create', 'Create new pitches', 'pitch'),
  ('pitch:read', 'View pitch listings', 'pitch'),
  ('pitch:read_own', 'View own pitches', 'pitch'),
  ('pitch:read_protected', 'View NDA-protected pitch details', 'pitch'),
  ('pitch:update_own', 'Edit own pitches', 'pitch'),
  ('pitch:delete_own', 'Delete own pitches', 'pitch'),
  ('pitch:publish', 'Publish pitches publicly', 'pitch'),
  
  -- NDA permissions
  ('nda:request', 'Request NDAs from creators', 'nda'),
  ('nda:approve', 'Approve NDA requests', 'nda'),
  ('nda:reject', 'Reject NDA requests', 'nda'),
  ('nda:view_own', 'View own NDAs', 'nda'),
  ('nda:revoke', 'Revoke approved NDAs', 'nda'),
  
  -- Investment permissions
  ('investment:create', 'Make investments', 'investment'),
  ('investment:view_own', 'View own investments', 'investment'),
  ('investment:receive', 'Receive investments', 'investment'),
  ('investment:refund', 'Process refunds', 'investment'),
  
  -- Document permissions
  ('document:upload', 'Upload documents', 'document'),
  ('document:view_own', 'View own documents', 'document'),
  ('document:view_granted', 'View documents with access', 'document'),
  ('document:delete_own', 'Delete own documents', 'document'),
  ('document:share', 'Share documents with others', 'document'),
  
  -- Messaging permissions
  ('message:send', 'Send messages', 'messaging'),
  ('message:receive', 'Receive messages', 'messaging'),
  ('message:delete_own', 'Delete own messages', 'messaging'),
  
  -- User permissions
  ('user:read_profile', 'View user profiles', 'user'),
  ('user:update_own', 'Update own profile', 'user'),
  ('user:follow', 'Follow other users', 'user'),
  ('user:block', 'Block other users', 'user'),
  
  -- Analytics permissions
  ('analytics:view_own', 'View own analytics', 'analytics'),
  ('analytics:view_all', 'View all analytics', 'analytics'),
  
  -- Admin permissions
  ('admin:manage_users', 'Manage all users', 'admin'),
  ('admin:manage_content', 'Manage all content', 'admin'),
  ('admin:view_audit', 'View audit logs', 'admin'),
  ('admin:manage_roles', 'Manage roles and permissions', 'admin'),
  ('admin:system_config', 'Configure system settings', 'admin')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to Creator role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'creator' AND p.name IN (
  'pitch:create', 'pitch:read', 'pitch:read_own', 'pitch:update_own', 
  'pitch:delete_own', 'pitch:publish', 'nda:approve', 'nda:reject', 
  'nda:view_own', 'nda:revoke', 'investment:receive', 'document:upload', 
  'document:view_own', 'document:delete_own', 'document:share',
  'message:send', 'message:receive', 'message:delete_own',
  'user:read_profile', 'user:update_own', 'user:follow', 'user:block',
  'analytics:view_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Investor role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'investor' AND p.name IN (
  'pitch:read', 'pitch:read_protected', 'nda:request', 'nda:view_own',
  'investment:create', 'investment:view_own', 'investment:refund',
  'document:view_granted', 'message:send', 'message:receive', 'message:delete_own',
  'user:read_profile', 'user:update_own', 'user:follow', 'user:block',
  'analytics:view_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Production role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'production' AND p.name IN (
  'pitch:read', 'pitch:read_protected', 'nda:request', 'nda:view_own',
  'investment:create', 'investment:view_own', 'investment:refund',
  'document:view_granted', 'document:upload', 'document:view_own',
  'document:share', 'message:send', 'message:receive', 'message:delete_own',
  'user:read_profile', 'user:update_own', 'user:follow', 'user:block',
  'analytics:view_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign all permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;