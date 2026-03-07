-- Migration: Add payment period fields to farm_seasons and due_date to farm_invoices
-- This supports the auto-linking of invoices to seasons based on payment dates

ALTER TABLE farm_seasons ADD COLUMN IF NOT EXISTS crop text;
ALTER TABLE farm_seasons ADD COLUMN IF NOT EXISTS payment_start_date timestamp;
ALTER TABLE farm_seasons ADD COLUMN IF NOT EXISTS payment_end_date timestamp;

ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS due_date timestamp;
