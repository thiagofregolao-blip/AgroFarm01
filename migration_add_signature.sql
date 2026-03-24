-- Add signature field to farm_applications for diesel receipt signing
ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS signature_base64 text;
