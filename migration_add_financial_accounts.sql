-- Migration: Create farm_accounts_payable and farm_accounts_receivable tables
-- Also adds missing columns if tables already exist

-- ==================== CONTAS A PAGAR ====================
CREATE TABLE IF NOT EXISTS farm_accounts_payable (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_id varchar REFERENCES farm_invoices(id),
  expense_id varchar REFERENCES farm_expenses(id),
  supplier text NOT NULL,
  description text,
  total_amount numeric(15, 2) NOT NULL,
  paid_amount numeric(15, 2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  installment_number integer DEFAULT 1,
  total_installments integer DEFAULT 1,
  due_date timestamp NOT NULL,
  paid_date timestamp,
  status text NOT NULL DEFAULT 'aberto',
  cash_transaction_id varchar REFERENCES farm_cash_transactions(id),
  created_at timestamp NOT NULL DEFAULT now()
);

-- ==================== CONTAS A RECEBER ====================
CREATE TABLE IF NOT EXISTS farm_accounts_receivable (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  romaneio_id varchar REFERENCES farm_romaneios(id),
  buyer text NOT NULL,
  description text,
  total_amount numeric(15, 2) NOT NULL,
  received_amount numeric(15, 2) DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  due_date timestamp NOT NULL,
  received_date timestamp,
  status text NOT NULL DEFAULT 'pendente',
  cash_transaction_id varchar REFERENCES farm_cash_transactions(id),
  created_at timestamp NOT NULL DEFAULT now()
);

-- Add received_amount column if it's missing (for existing tables)
ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS received_amount numeric(15, 2) DEFAULT 0;
