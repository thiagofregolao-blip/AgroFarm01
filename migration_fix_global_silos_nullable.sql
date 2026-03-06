-- Migration 28: Fix global_silos latitude/longitude to be nullable
-- Allows creating silos without coordinates (coordinates are optional)
ALTER TABLE global_silos ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE global_silos ALTER COLUMN longitude DROP NOT NULL;
