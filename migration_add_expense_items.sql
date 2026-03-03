ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS supplier TEXT;
ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS image_base64 TEXT;

CREATE TABLE IF NOT EXISTS farm_expense_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id VARCHAR NOT NULL REFERENCES farm_expenses(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  quantity NUMERIC(15, 4) NOT NULL,
  unit TEXT,
  unit_price NUMERIC(15, 4) NOT NULL,
  total_price NUMERIC(15, 2) NOT NULL
);
