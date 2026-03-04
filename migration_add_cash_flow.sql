-- Contas/Bancos do fluxo de caixa
CREATE TABLE IF NOT EXISTS farm_cash_accounts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  initial_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Movimentações do fluxo de caixa
CREATE TABLE IF NOT EXISTS farm_cash_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id VARCHAR NOT NULL REFERENCES farm_cash_accounts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL,
  description TEXT,
  payment_method TEXT,
  expense_id VARCHAR REFERENCES farm_expenses(id),
  invoice_id VARCHAR REFERENCES farm_invoices(id),
  reference_type TEXT NOT NULL DEFAULT 'manual',
  transaction_date TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Contexto de conversa pendente do WhatsApp
CREATE TABLE IF NOT EXISTS farm_whatsapp_pending_context (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone VARCHAR NOT NULL,
  step TEXT NOT NULL,
  expense_id VARCHAR REFERENCES farm_expenses(id),
  invoice_id VARCHAR REFERENCES farm_invoices(id),
  data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_farmer ON farm_cash_transactions(farmer_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_account ON farm_cash_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_date ON farm_cash_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_whatsapp_context_farmer ON farm_whatsapp_pending_context(farmer_id, phone);
