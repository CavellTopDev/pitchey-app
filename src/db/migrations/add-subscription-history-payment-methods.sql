-- Migration: Add subscription history and payment methods tables
-- Created: 2025-10-24
-- Purpose: Track subscription changes and store user payment method details

-- Subscription History Table - Track subscription changes and billing history
CREATE TABLE IF NOT EXISTS subscription_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Previous and new subscription details
    previous_tier VARCHAR(50),
    new_tier VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- upgrade, downgrade, cancel, renew, create
    
    -- Stripe details
    stripe_subscription_id TEXT,
    stripe_price_id TEXT,
    stripe_invoice_id TEXT,
    
    -- Billing details
    amount DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'usd',
    billing_interval VARCHAR(20), -- monthly, yearly
    
    -- Period details
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    
    -- Status and metadata
    status VARCHAR(50) NOT NULL, -- active, canceled, expired, pending
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for subscription_history table
CREATE INDEX IF NOT EXISTS idx_subscription_history_user_id ON subscription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_status ON subscription_history(status);
CREATE INDEX IF NOT EXISTS idx_subscription_history_stripe_subscription ON subscription_history(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_history_timestamp ON subscription_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_subscription_history_action ON subscription_history(action);

-- Payment Methods Table - Store user payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Stripe details
    stripe_payment_method_id TEXT NOT NULL UNIQUE,
    stripe_customer_id TEXT NOT NULL,
    
    -- Payment method details
    type VARCHAR(20) NOT NULL, -- card, bank_account, paypal, etc.
    
    -- Card details (for card type)
    brand VARCHAR(20), -- visa, mastercard, amex, etc.
    last_four VARCHAR(4),
    exp_month INTEGER,
    exp_year INTEGER,
    
    -- Bank account details (for bank_account type)
    bank_name VARCHAR(100),
    account_type VARCHAR(20), -- checking, savings
    
    -- Status and preferences
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Billing details
    billing_name VARCHAR(255),
    billing_email VARCHAR(255),
    billing_address JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for payment_methods table
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_payment_method ON payment_methods(stripe_payment_method_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe_customer ON payment_methods(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_type ON payment_methods(type);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_active ON payment_methods(is_active);

-- Ensure only one default payment method per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_default 
ON payment_methods(user_id) 
WHERE is_default = TRUE;

-- Function to update the updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for payment_methods updated_at
DROP TRIGGER IF EXISTS update_payment_methods_updated_at ON payment_methods;
CREATE TRIGGER update_payment_methods_updated_at
    BEFORE UPDATE ON payment_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing (optional)
-- COMMENT: These are examples of subscription history entries
INSERT INTO subscription_history (user_id, previous_tier, new_tier, action, amount, currency, status, metadata) VALUES
(1, 'free', 'basic', 'upgrade', 9.99, 'usd', 'active', '{"promotion": "first_month_discount"}'),
(1, 'basic', 'pro', 'upgrade', 29.99, 'usd', 'active', '{}'),
(2, 'free', 'pro', 'upgrade', 29.99, 'usd', 'active', '{}')
ON CONFLICT DO NOTHING;

-- COMMENT: These are examples of payment methods
-- Note: In real implementation, these would be created via Stripe webhooks
INSERT INTO payment_methods (user_id, stripe_payment_method_id, stripe_customer_id, type, brand, last_four, exp_month, exp_year, is_default, billing_name) VALUES
(1, 'pm_test_card_visa_4242', 'cus_test_user_1', 'card', 'visa', '4242', 12, 2027, TRUE, 'Alex Creator'),
(2, 'pm_test_card_mastercard_5555', 'cus_test_user_2', 'card', 'mastercard', '5555', 6, 2026, TRUE, 'Sarah Investor')
ON CONFLICT (stripe_payment_method_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE subscription_history IS 'Tracks all subscription changes including upgrades, downgrades, cancellations, and renewals';
COMMENT ON TABLE payment_methods IS 'Stores user payment method details with Stripe integration';

COMMENT ON COLUMN subscription_history.action IS 'Type of subscription action: upgrade, downgrade, cancel, renew, create';
COMMENT ON COLUMN subscription_history.status IS 'Current status: active, canceled, expired, pending';
COMMENT ON COLUMN payment_methods.type IS 'Payment method type: card, bank_account, paypal, etc.';
COMMENT ON COLUMN payment_methods.is_default IS 'Whether this is the users default payment method';