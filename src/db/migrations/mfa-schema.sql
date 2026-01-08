-- Multi-Factor Authentication Schema
-- Supports TOTP, backup codes, and audit logging

-- MFA settings for users
CREATE TABLE IF NOT EXISTS user_mfa (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    method VARCHAR(20) DEFAULT 'totp', -- totp, sms, email
    secret TEXT, -- Encrypted TOTP secret
    backup_codes TEXT[], -- Hashed backup codes
    backup_codes_used INTEGER DEFAULT 0,
    phone_number VARCHAR(20), -- For SMS 2FA
    phone_verified BOOLEAN DEFAULT false,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MFA challenges (temporary verification sessions)
CREATE TABLE IF NOT EXISTS mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    challenge_type VARCHAR(20) NOT NULL, -- totp, backup, sms, email
    challenge_data JSONB, -- Additional challenge data
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- MFA audit log for security tracking
CREATE TABLE IF NOT EXISTS mfa_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    event VARCHAR(50) NOT NULL, -- enabled, disabled, verified, failed, backup_used, recovered
    method VARCHAR(20),
    ip VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trusted devices (remember this device)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    device_fingerprint TEXT NOT NULL,
    device_name VARCHAR(255),
    browser VARCHAR(100),
    os VARCHAR(100),
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, device_fingerprint)
);

-- Recovery codes (separate from backup codes for account recovery)
CREATE TABLE IF NOT EXISTS recovery_codes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user_id ON mfa_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_challenges_expires_at ON mfa_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_log_user_id ON mfa_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_audit_log_timestamp ON mfa_audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_recovery_codes_user_id ON recovery_codes(user_id);

-- Add MFA columns to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_method VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS require_mfa BOOLEAN DEFAULT false; -- Admin can force MFA

-- Function to clean up expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_mfa_challenges()
RETURNS void AS $$
BEGIN
    DELETE FROM mfa_challenges 
    WHERE expires_at < CURRENT_TIMESTAMP 
    AND completed_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user needs MFA
CREATE OR REPLACE FUNCTION check_mfa_required(
    p_user_id INTEGER,
    p_action VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    v_user_type VARCHAR(50);
    v_mfa_enabled BOOLEAN;
    v_require_mfa BOOLEAN;
BEGIN
    SELECT user_type, mfa_enabled, require_mfa 
    INTO v_user_type, v_mfa_enabled, v_require_mfa
    FROM users 
    WHERE id = p_user_id;
    
    -- Admin forced MFA
    IF v_require_mfa THEN
        RETURN true;
    END IF;
    
    -- User has MFA enabled
    IF v_mfa_enabled THEN
        RETURN true;
    END IF;
    
    -- High-risk actions require MFA
    IF p_action IN (
        'investment.create',
        'investment.approve', 
        'payment.process',
        'user.delete',
        'admin.access',
        'nda.sign',
        'pitch.delete'
    ) THEN
        RETURN true;
    END IF;
    
    -- Investor-specific requirements
    IF v_user_type = 'investor' AND p_action LIKE 'investment.%' THEN
        RETURN true;
    END IF;
    
    -- Production company requirements
    IF v_user_type = 'production' AND p_action LIKE 'contract.%' THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Sample data for testing (demo accounts with MFA)
-- Password for all: Demo123
-- TOTP Secret for testing: JBSWY3DPEHPK3PXP (base32)

INSERT INTO user_mfa (user_id, enabled, method, secret, backup_codes)
SELECT 
    id, 
    true, 
    'totp',
    'encrypted_secret_here', -- In production, encrypt this
    ARRAY['ABCD-1234', 'EFGH-5678', 'IJKL-9012', 'MNOP-3456', 'QRST-7890']
FROM users 
WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com')
ON CONFLICT (user_id) DO NOTHING;

-- Update users to reflect MFA status
UPDATE users 
SET mfa_enabled = true, mfa_method = 'totp'
WHERE email IN ('alex.creator@demo.com', 'sarah.investor@demo.com');

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_mfa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_challenges TO authenticated;
GRANT INSERT ON mfa_audit_log TO authenticated;
GRANT SELECT ON mfa_audit_log TO authenticated WHERE user_id = current_user_id();
GRANT SELECT, INSERT, UPDATE, DELETE ON trusted_devices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON recovery_codes TO authenticated;