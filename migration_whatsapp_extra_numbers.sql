-- Migration: Add whatsapp_extra_numbers column to users table
-- For storing additional WhatsApp numbers for group participants

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_extra_numbers TEXT;
