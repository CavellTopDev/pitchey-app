-- Migration: Add Permission System Tables
-- Creates comprehensive RBAC (Role-Based Access Control) system

-- Create enums for permission system
DO $$ BEGIN
    CREATE TYPE user_type_enhanced AS ENUM (
        'admin', 'super_admin',
        'creator', 'creator_premium', 'creator_verified', 'content_manager',
        'investor', 'investor_accredited', 'investor_institutional', 'fund_manager', 'investment_advisor',
        'production_company', 'producer', 'executive_producer', 'line_producer', 'production_manager', 'distributor', 'sales_agent',
        'moderator', 'content_reviewer', 'support_agent', 'analyst',
        'talent_agent', 'entertainment_lawyer', 'consultant', 'viewer', 'guest'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE permission_category AS ENUM (
        'pitch_management', 'nda_management', 'user_management', 'content_moderation',
        'financial_operations', 'analytics_access', 'system_administration',
        'marketplace_operations', 'communication', 'file_management'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE resource_type AS ENUM (
        'pitch', 'nda', 'user', 'investment', 'message', 'document',
        'analytics', 'system', 'notification', 'comment'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE action_type AS ENUM (
        'create', 'read', 'update', 'delete',
        'approve', 'reject', 'moderate',
        'download', 'upload', 'share',
        'comment', 'rate', 'favorite',
        'invite', 'manage_permissions',
        'export', 'import', 'backup',
        'publish', 'unpublish', 'archive'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL DEFAULT 0,
    is_system_role BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    max_users INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category permission_category NOT NULL,
    resource_type resource_type NOT NULL,
    action action_type NOT NULL,
    conditions JSONB DEFAULT '{}',
    is_system_permission BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(resource_type, action, name)
);

-- Create role-permission mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    conditions JSONB DEFAULT '{}',
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Create user-role mapping table
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
    assigned_by INTEGER REFERENCES users(id),
    assigned_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, role_id)
);

-- Create resource-specific permissions table
CREATE TABLE IF NOT EXISTS resource_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    resource_type resource_type NOT NULL,
    resource_id INTEGER NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
    granted BOOLEAN DEFAULT TRUE,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    conditions JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Create permission groups table
CREATE TABLE IF NOT EXISTS permission_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    category permission_category NOT NULL,
    is_system_group BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create permission group members table
CREATE TABLE IF NOT EXISTS permission_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES permission_groups(id) ON DELETE CASCADE NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE NOT NULL,
    UNIQUE(group_id, permission_id)
);

-- Create access sessions table
CREATE TABLE IF NOT EXISTS access_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    permissions JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_fingerprint TEXT,
    risk_score INTEGER DEFAULT 0,
    is_trusted_device BOOLEAN DEFAULT FALSE,
    last_activity TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create audit log table
CREATE TABLE IF NOT EXISTS permission_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    target_user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type resource_type,
    resource_id INTEGER,
    permission_id INTEGER REFERENCES permissions(id),
    role_id INTEGER REFERENCES roles(id),
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id INTEGER REFERENCES access_sessions(id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_active ON user_roles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_user_resource ON resource_permissions(resource_type, resource_id, user_id);
CREATE INDEX IF NOT EXISTS idx_resource_permissions_user_type ON resource_permissions(user_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_access_sessions_token ON access_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_access_sessions_user_expires ON access_sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON permission_audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_created ON permission_audit_log(target_user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created ON permission_audit_log(action, created_at);

-- Insert default system roles
INSERT INTO roles (name, display_name, description, category, level, is_system_role, is_default) VALUES
    ('super_admin', 'Super Administrator', 'Full system access with all permissions', 'admin', 100, TRUE, FALSE),
    ('admin', 'Administrator', 'Administrative access with user and content management', 'admin', 90, TRUE, FALSE),
    ('moderator', 'Moderator', 'Content moderation and user management capabilities', 'moderator', 70, TRUE, FALSE),
    ('creator', 'Creator', 'Basic creator with pitch creation and management', 'creator', 50, TRUE, TRUE),
    ('creator_premium', 'Premium Creator', 'Enhanced creator with additional features', 'creator', 60, TRUE, FALSE),
    ('creator_verified', 'Verified Creator', 'Verified creator with extended capabilities', 'creator', 65, TRUE, FALSE),
    ('investor', 'Investor', 'Basic investor with pitch viewing and NDA access', 'investor', 50, TRUE, FALSE),
    ('investor_accredited', 'Accredited Investor', 'Accredited investor with enhanced access', 'investor', 60, TRUE, FALSE),
    ('investor_institutional', 'Institutional Investor', 'Institutional investor with full access', 'investor', 70, TRUE, FALSE),
    ('producer', 'Producer', 'Production company representative', 'production', 55, TRUE, FALSE),
    ('production_company', 'Production Company', 'Production company with full production access', 'production', 65, TRUE, FALSE),
    ('guest', 'Guest', 'Limited guest access for browsing public content', 'guest', 10, TRUE, FALSE)
ON CONFLICT (name) DO NOTHING;

-- Insert default system permissions
INSERT INTO permissions (name, display_name, description, category, resource_type, action, is_system_permission) VALUES
    -- Pitch management permissions
    ('pitch_create', 'Create Pitches', 'Create new pitch presentations', 'pitch_management', 'pitch', 'create', TRUE),
    ('pitch_read', 'View Pitches', 'View pitch presentations', 'pitch_management', 'pitch', 'read', TRUE),
    ('pitch_update', 'Edit Pitches', 'Edit existing pitch presentations', 'pitch_management', 'pitch', 'update', TRUE),
    ('pitch_delete', 'Delete Pitches', 'Delete pitch presentations', 'pitch_management', 'pitch', 'delete', TRUE),
    ('pitch_publish', 'Publish Pitches', 'Publish pitches to platform', 'pitch_management', 'pitch', 'publish', TRUE),
    ('pitch_moderate', 'Moderate Pitches', 'Moderate and review pitch content', 'content_moderation', 'pitch', 'moderate', TRUE),
    ('pitch_feature', 'Feature Pitches', 'Feature pitches on platform', 'pitch_management', 'pitch', 'publish', TRUE),
    
    -- NDA management permissions
    ('nda_request', 'Request NDAs', 'Request NDA access to pitches', 'nda_management', 'nda', 'create', TRUE),
    ('nda_approve', 'Approve NDAs', 'Approve NDA requests', 'nda_management', 'nda', 'approve', TRUE),
    ('nda_reject', 'Reject NDAs', 'Reject NDA requests', 'nda_management', 'nda', 'reject', TRUE),
    ('nda_sign', 'Sign NDAs', 'Sign NDA agreements', 'nda_management', 'nda', 'update', TRUE),
    ('nda_manage', 'Manage NDAs', 'Full NDA management capabilities', 'nda_management', 'nda', 'update', TRUE),
    ('nda_view_all', 'View All NDAs', 'View all NDA requests and statuses', 'nda_management', 'nda', 'read', TRUE),
    
    -- User management permissions
    ('user_create', 'Create Users', 'Create new user accounts', 'user_management', 'user', 'create', TRUE),
    ('user_read', 'View Users', 'View user profiles and information', 'user_management', 'user', 'read', TRUE),
    ('user_update', 'Edit Users', 'Edit user profiles and settings', 'user_management', 'user', 'update', TRUE),
    ('user_delete', 'Delete Users', 'Delete user accounts', 'user_management', 'user', 'delete', TRUE),
    ('user_moderate', 'Moderate Users', 'Moderate user behavior and content', 'user_management', 'user', 'moderate', TRUE),
    ('user_assign_roles', 'Assign User Roles', 'Assign roles to users', 'user_management', 'user', 'update', TRUE),
    
    -- Content moderation permissions
    ('content_review', 'Review Content', 'Review user-generated content', 'content_moderation', 'pitch', 'read', TRUE),
    ('content_approve', 'Approve Content', 'Approve content for publication', 'content_moderation', 'pitch', 'approve', TRUE),
    ('content_reject', 'Reject Content', 'Reject inappropriate content', 'content_moderation', 'pitch', 'reject', TRUE),
    ('content_flag', 'Flag Content', 'Flag content for review', 'content_moderation', 'pitch', 'update', TRUE),
    ('content_moderate', 'Moderate Content', 'Full content moderation capabilities', 'content_moderation', 'pitch', 'moderate', TRUE),
    
    -- Financial operations permissions
    ('finance_view', 'View Financials', 'View financial information', 'financial_operations', 'investment', 'read', TRUE),
    ('finance_process', 'Process Payments', 'Process financial transactions', 'financial_operations', 'investment', 'update', TRUE),
    ('finance_manage', 'Manage Finances', 'Full financial management', 'financial_operations', 'investment', 'update', TRUE),
    ('payment_process', 'Process Payments', 'Process payment transactions', 'financial_operations', 'investment', 'create', TRUE),
    ('investment_view', 'View Investments', 'View investment information', 'financial_operations', 'investment', 'read', TRUE),
    ('investment_manage', 'Manage Investments', 'Manage investment portfolios', 'financial_operations', 'investment', 'update', TRUE),
    
    -- Analytics access permissions
    ('analytics_view', 'View Analytics', 'View platform analytics', 'analytics_access', 'analytics', 'read', TRUE),
    ('analytics_export', 'Export Analytics', 'Export analytics data', 'analytics_access', 'analytics', 'export', TRUE),
    ('analytics_manage', 'Manage Analytics', 'Configure analytics settings', 'analytics_access', 'analytics', 'update', TRUE),
    ('report_generate', 'Generate Reports', 'Generate custom reports', 'analytics_access', 'analytics', 'create', TRUE),
    
    -- System administration permissions
    ('system_config', 'System Configuration', 'Configure system settings', 'system_administration', 'system', 'update', TRUE),
    ('system_backup', 'System Backup', 'Perform system backups', 'system_administration', 'system', 'backup', TRUE),
    ('system_monitor', 'System Monitoring', 'Monitor system performance', 'system_administration', 'system', 'read', TRUE),
    ('permission_manage', 'Manage Permissions', 'Manage user permissions', 'system_administration', 'user', 'manage_permissions', TRUE),
    ('role_manage', 'Manage Roles', 'Manage user roles', 'system_administration', 'user', 'update', TRUE),
    
    -- Communication permissions
    ('message_send', 'Send Messages', 'Send messages to other users', 'communication', 'message', 'create', TRUE),
    ('message_read', 'Read Messages', 'Read received messages', 'communication', 'message', 'read', TRUE),
    ('message_moderate', 'Moderate Messages', 'Moderate user messages', 'communication', 'message', 'moderate', TRUE),
    ('notification_send', 'Send Notifications', 'Send notifications to users', 'communication', 'notification', 'create', TRUE),
    
    -- File management permissions
    ('file_upload', 'Upload Files', 'Upload files to platform', 'file_management', 'document', 'upload', TRUE),
    ('file_download', 'Download Files', 'Download files from platform', 'file_management', 'document', 'download', TRUE),
    ('file_delete', 'Delete Files', 'Delete uploaded files', 'file_management', 'document', 'delete', TRUE),
    ('file_moderate', 'Moderate Files', 'Moderate uploaded files', 'file_management', 'document', 'moderate', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to default roles
-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin gets most permissions except super admin exclusives
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'admin' 
  AND p.name NOT IN ('system_config', 'system_backup', 'role_manage', 'permission_manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Moderator permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'moderator' 
  AND p.name IN (
    'pitch_read', 'pitch_moderate', 'content_review', 'content_approve', 'content_reject', 'content_moderate',
    'user_read', 'user_moderate', 'message_moderate', 'file_moderate', 'nda_view_all'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Creator permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'creator' 
  AND p.name IN (
    'pitch_create', 'pitch_read', 'pitch_update', 'pitch_delete', 'pitch_publish',
    'nda_approve', 'nda_reject', 'nda_sign', 'nda_manage',
    'file_upload', 'file_download', 'file_delete',
    'message_send', 'message_read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Premium Creator gets additional permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'creator_premium' 
  AND p.name IN (
    'pitch_create', 'pitch_read', 'pitch_update', 'pitch_delete', 'pitch_publish', 'pitch_feature',
    'nda_approve', 'nda_reject', 'nda_sign', 'nda_manage', 'nda_view_all',
    'file_upload', 'file_download', 'file_delete',
    'message_send', 'message_read', 'analytics_view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Investor permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'investor' 
  AND p.name IN (
    'pitch_read', 'nda_request', 'nda_sign',
    'investment_view', 'message_send', 'message_read',
    'file_download'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Accredited Investor gets additional permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'investor_accredited' 
  AND p.name IN (
    'pitch_read', 'nda_request', 'nda_sign',
    'investment_view', 'investment_manage', 'finance_view',
    'message_send', 'message_read', 'file_download', 'analytics_view'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Producer permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'producer' 
  AND p.name IN (
    'pitch_read', 'nda_request', 'nda_sign',
    'investment_view', 'message_send', 'message_read',
    'file_download', 'file_upload'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Production Company gets additional permissions
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'production_company' 
  AND p.name IN (
    'pitch_read', 'pitch_moderate', 'nda_request', 'nda_sign', 'nda_view_all',
    'investment_view', 'investment_manage', 'finance_view',
    'message_send', 'message_read', 'file_download', 'file_upload',
    'analytics_view', 'user_read'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Guest permissions (very limited)
INSERT INTO role_permissions (role_id, permission_id, granted)
SELECT r.id, p.id, TRUE
FROM roles r, permissions p
WHERE r.name = 'guest' 
  AND p.name IN ('pitch_read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
DROP TRIGGER IF EXISTS update_roles_updated_at ON roles;
CREATE TRIGGER update_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_permissions_updated_at ON permissions;
CREATE TRIGGER update_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_permission_groups_updated_at ON permission_groups;
CREATE TRIGGER update_permission_groups_updated_at
    BEFORE UPDATE ON permission_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();