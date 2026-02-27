-- Add farm location fields for weather forecasting and daily bulletin
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_latitude NUMERIC(10,7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_longitude NUMERIC(10,7);
ALTER TABLE users ADD COLUMN IF NOT EXISTS farm_city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bulletin_enabled BOOLEAN DEFAULT true;
