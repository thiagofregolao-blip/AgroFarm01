-- Migration: Add email invoice fields
-- Adds invoice import tracking to farm_invoices and invoice email to users

ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS source_email_id TEXT;
ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS source_email_from TEXT;

ALTER TABLE users ADD COLUMN IF NOT EXISTS invoice_email TEXT;
