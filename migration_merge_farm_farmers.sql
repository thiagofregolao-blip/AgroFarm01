-- Migration to merge farm_farmers back into users

-- 1. Add fields to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS document TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS property_size DECIMAL(12,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS main_culture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region TEXT;

-- 2. Remove the unused farm_farmers table
DROP TABLE IF EXISTS farm_farmers CASCADE;
