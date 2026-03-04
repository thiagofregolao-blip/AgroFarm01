-- Tabela de categorias personalizadas
CREATE TABLE IF NOT EXISTS farm_expense_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'saida',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_farmer ON farm_expense_categories(farmer_id);

-- Novos campos de pagamento em farm_expenses
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendente';
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'a_vista';
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1;
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS installments_paid INTEGER DEFAULT 0;
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15, 2) DEFAULT 0;
