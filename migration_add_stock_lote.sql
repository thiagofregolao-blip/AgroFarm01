-- Migration: Add lote, expiry_date, package_size to farm_stock and farm_stock_movements
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS lote text;
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS expiry_date timestamp;
ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS package_size decimal(15,4);

ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS lote text;
ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS expiry_date timestamp;
ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS package_size decimal(15,4);
