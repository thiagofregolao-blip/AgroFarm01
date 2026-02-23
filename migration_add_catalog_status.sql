-- Add status and is_draft fields to track products auto-created by users
ALTER TABLE farm_products_catalog
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE farm_products_catalog
ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT false;
