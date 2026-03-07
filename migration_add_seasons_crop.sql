-- Migration 32: Add crop and payment date columns to farm_seasons
ALTER TABLE farm_seasons ADD COLUMN IF NOT EXISTS crop TEXT;
ALTER TABLE farm_seasons ADD COLUMN IF NOT EXISTS payment_start_date TIMESTAMP;
ALTER TABLE farm_seasons ADD COLUMN IF NOT EXISTS payment_end_date TIMESTAMP;
