-- Migration: Add new fields to farm_romaneios for AI import & WhatsApp flow
-- Run this migration before deploying the new romaneio import feature

ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS driver TEXT;
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS discounts JSONB;
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed';
