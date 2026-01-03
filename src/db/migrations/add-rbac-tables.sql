-- RBAC Tables Migration
-- Adds role and permission tracking for granular access control

-- Add role column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'viewer';

-- Update existing users based on user_type
UPDATE users SET role = 
  CASE 
    WHEN user_type = 'creator' THEN 'creator'
    WHEN user_type = 'investor' THEN 'investor'
    WHEN user_type = 'production' THEN 'production'
    WHEN email LIKE '%admin%' THEN 'admin'
    ELSE 'viewer'
  END
WHERE role IS NULL OR role = 'viewer';

-- Create user_permissions table for additional permissions
CREATE TABLE IF NOT EXISTS user_permissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, permission)
);

-- Create role_overrides table for temporary role changes
CREATE TABLE IF NOT EXISTS role_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_role VARCHAR(50) NOT NULL,
  override_role VARCHAR(50) NOT NULL,
  reason TEXT,
  granted_by INTEGER REFERENCES users(id),
  starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit_log table for permission checks
CREATE TABLE IF NOT EXISTS permission_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  permission VARCHAR(100),
  granted BOOLEAN NOT NULL,
  denial_reason TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_role_overrides_user ON role_overrides(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON permission_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON permission_audit_log(resource_type, resource_id);

-- Add role-based fields to other tables

-- Add permission_level to pitches for fine-grained access
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS permission_level VARCHAR(50) DEFAULT 'public';
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS allowed_roles TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE pitches ADD COLUMN IF NOT EXISTS blocked_users INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- Add role requirements to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS required_role VARCHAR(50);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS min_permission_level VARCHAR(50) DEFAULT 'viewer';

-- Add role to nda_requests for tracking
ALTER TABLE nda_requests ADD COLUMN IF NOT EXISTS requester_role VARCHAR(50);

-- Add role-based pricing to investments
ALTER TABLE investments ADD COLUMN IF NOT EXISTS investor_role VARCHAR(50);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS role_discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Helper functions for permission checking

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id INTEGER,
  p_permission VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
  v_has_permission BOOLEAN;
BEGIN
  -- Check if user has the specific permission
  SELECT EXISTS(
    SELECT 1 FROM user_permissions
    WHERE user_id = p_user_id
      AND permission = p_permission
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's effective role (considering overrides)
CREATE OR REPLACE FUNCTION get_effective_role(
  p_user_id INTEGER
) RETURNS VARCHAR(50) AS $$
DECLARE
  v_role VARCHAR(50);
BEGIN
  -- Check for active role override first
  SELECT override_role INTO v_role
  FROM role_overrides
  WHERE user_id = p_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- If no override, get base role
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM users
    WHERE id = p_user_id;
  END IF;
  
  RETURN COALESCE(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql;

-- Function to log permission check
CREATE OR REPLACE FUNCTION log_permission_check(
  p_user_id INTEGER,
  p_action VARCHAR(100),
  p_resource_type VARCHAR(50),
  p_resource_id INTEGER,
  p_permission VARCHAR(100),
  p_granted BOOLEAN,
  p_denial_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO permission_audit_log (
    user_id, action, resource_type, resource_id, 
    permission, granted, denial_reason
  ) VALUES (
    p_user_id, p_action, p_resource_type, p_resource_id,
    p_permission, p_granted, p_denial_reason
  );
END;
$$ LANGUAGE plpgsql;

-- Grant demo admin permissions
INSERT INTO user_permissions (user_id, permission, granted_by)
SELECT id, 'admin.access', 1
FROM users 
WHERE email = 'admin@demo.com'
ON CONFLICT (user_id, permission) DO NOTHING;

-- Grant creator permissions to demo creator
INSERT INTO user_permissions (user_id, permission, granted_by)
SELECT id, unnest(ARRAY[
  'pitch.publish',
  'nda.upload.custom'
]), 1
FROM users 
WHERE email = 'alex.creator@demo.com'
ON CONFLICT (user_id, permission) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE user_permissions IS 'Stores additional permissions granted to users beyond their base role';
COMMENT ON TABLE role_overrides IS 'Tracks temporary role changes for users';
COMMENT ON TABLE permission_audit_log IS 'Audit trail for permission checks and access attempts';
COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission';
COMMENT ON FUNCTION get_effective_role IS 'Get user effective role considering overrides';
COMMENT ON FUNCTION log_permission_check IS 'Log permission check for audit trail';