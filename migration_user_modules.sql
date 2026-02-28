-- Migration: User Modules (per-client module access control)
-- Each farmer can have modules enabled/disabled by admin

CREATE TABLE IF NOT EXISTS user_modules (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, module_key)
);
