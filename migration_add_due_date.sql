-- Migration 31: Add due_date column to farm_invoices
ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;
