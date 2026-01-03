-- Migrate Existing Users to RBAC System (Fixed for actual schema)

-- Assign roles based on existing user.user_type column
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON LOWER(u.user_type) = r.name
WHERE u.user_type IS NOT NULL
ON CONFLICT DO NOTHING;

-- Grant ownership access to creators for their existing pitches
INSERT INTO content_access (user_id, content_type, content_id, access_level, granted_via)
SELECT user_id, 'pitch', id, 'admin', 'ownership'
FROM pitches
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, content_type, content_id) DO NOTHING;

-- Grant access based on existing approved NDAs
-- First check if NDAs table has the needed columns
INSERT INTO content_access (user_id, content_type, content_id, access_level, granted_via, nda_id)
SELECT 
  n.user_id,  -- requester is the user_id in ndas table
  'pitch', 
  n.pitch_id, 
  'view', 
  'nda', 
  n.id
FROM ndas n
WHERE n.status = 'approved'
  AND n.approved_at IS NOT NULL
ON CONFLICT (user_id, content_type, content_id) DO NOTHING;

-- Add admin role to specific admin users (if they exist)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE r.name = 'admin'
  AND u.email IN (
    'admin@pitchey.com',
    'support@pitchey.com'
  )
ON CONFLICT DO NOTHING;

-- Log migration completion
INSERT INTO permission_audit (user_id, action, permission_required, granted, metadata)
VALUES (
  NULL,
  'RBAC_MIGRATION',
  'system:migrate',
  true,
  jsonb_build_object(
    'migration_date', NOW(),
    'version', '20260103_fixed',
    'users_migrated', (SELECT COUNT(DISTINCT user_id) FROM user_roles),
    'content_access_created', (SELECT COUNT(*) FROM content_access)
  )
);