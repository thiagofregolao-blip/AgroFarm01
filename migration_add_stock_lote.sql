-- Migration: Add lote, expiry_date, package_size to farm_stock and farm_stock_movements
-- Also ensure deposit_id exists (Drizzle schema references it)
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS deposit_id varchar;
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS lote text;
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS expiry_date timestamp;
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS package_size decimal(15,4);

ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS deposit_id varchar;
ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS lote text;
ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS expiry_date timestamp;
ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS package_size decimal(15,4);
