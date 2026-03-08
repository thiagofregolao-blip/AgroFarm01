ALTER TABLE company_products
  ADD COLUMN IF NOT EXISTS active_ingredient text,
  ADD COLUMN IF NOT EXISTS dose text,
  ADD COLUMN IF NOT EXISTS description text;
