-- RBAC Schema Migration for Pitchey Platform
-- Creates comprehensive role-based access control system

-- Define all permissions in the system
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'pitch', 'nda', 'investment', 'document', 'user', 'admin'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Define roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL, -- 'creator', 'investor', 'production', 'admin'
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- System roles can't be deleted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Map permissions to roles
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

-- Track user roles (users can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ, -- Optional expiration
  PRIMARY KEY (user_id, role_id)
);

-- Content access rules (for NDA-protected content)
CREATE TABLE IF NOT EXISTS content_access (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL, -- 'pitch', 'document', 'video'
  content_id INTEGER NOT NULL,
  access_level VARCHAR(20) DEFAULT 'view', -- 'view', 'edit', 'admin'
  granted_via VARCHAR(50), -- 'nda', 'ownership', 'team', 'public'
  nda_id INTEGER REFERENCES ndas(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, content_type, content_id)
);

-- Audit log for permission checks
CREATE TABLE IF NOT EXISTS permission_audit (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  permission_required VARCHAR(100),
  granted BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_access_user ON content_access(user_id, content_type);
CREATE INDEX IF NOT EXISTS idx_content_access_content ON content_access(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_access_expires ON content_access(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_permission_audit_user ON permission_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_permission_audit_resource ON permission_audit(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_permission_audit_created ON permission_audit(created_at DESC);