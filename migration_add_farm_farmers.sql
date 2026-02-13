CREATE TABLE IF NOT EXISTS farm_farmers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  document TEXT,
  role TEXT NOT NULL DEFAULT 'farmer',
  manager_id TEXT, -- Optional reference to a manager
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_farm_farmers_username ON farm_farmers(username);
