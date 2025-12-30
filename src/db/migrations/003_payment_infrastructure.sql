-- Migration: Payment Infrastructure Tables
-- Description: Add complete payment processing infrastructure
-- Date: December 29, 2024

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('card', 'bank_account', 'paypal')),
  provider VARCHAR(20) DEFAULT 'stripe' CHECK (provider IN ('stripe', 'paypal')),
  provider_id VARCHAR(255) NOT NULL,
  last_four VARCHAR(4),
  brand VARCHAR(20),
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  payment_method_id UUID REFERENCES payment_methods(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('charge', 'refund', 'payout', 'subscription', 'investment')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  provider_transaction_id VARCHAR(255),
  description TEXT,
  metadata JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Escrow Accounts Table
CREATE TABLE IF NOT EXISTS escrow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id UUID REFERENCES pitches(id) ON DELETE CASCADE,
  investment_id UUID,
  balance_cents INTEGER DEFAULT 0 CHECK (balance_cents >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'released', 'disputed')),
  release_conditions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wire Transfers Table
CREATE TABLE IF NOT EXISTS wire_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  transaction_id UUID REFERENCES payment_transactions(id),
  account_number VARCHAR(100),
  routing_number VARCHAR(20),
  swift_code VARCHAR(20),
  bank_name VARCHAR(255),
  account_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending',
  verification_code VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ
);

-- Refunds Table
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_transactions(id) NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  provider_refund_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Tax Documents Table
CREATE TABLE IF NOT EXISTS tax_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  year INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('1099', 'K1', 'W9', 'W8BEN')),
  document_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  transaction_id UUID REFERENCES payment_transactions(id),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'unpaid',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  line_items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(user_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_type ON payment_transactions(type);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created ON payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_pitch ON escrow_accounts(pitch_id);
CREATE INDEX IF NOT EXISTS idx_wire_transfers_user ON wire_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_refunds_transaction ON refunds(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tax_documents_user ON tax_documents(user_id, year);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Add comments
COMMENT ON TABLE payment_methods IS 'User payment methods for transactions and subscriptions';
COMMENT ON TABLE payment_transactions IS 'All financial transactions in the system';
COMMENT ON TABLE escrow_accounts IS 'Escrow accounts for investment protection';
COMMENT ON TABLE wire_transfers IS 'Wire transfer details for large investments';
COMMENT ON TABLE refunds IS 'Refund records for reversed transactions';
COMMENT ON TABLE tax_documents IS 'Tax documents for regulatory compliance';
COMMENT ON TABLE invoices IS 'Invoice records for billing';