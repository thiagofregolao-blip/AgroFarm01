-- Farm Stock Management System - Migration
-- Creates all farm_* tables (references users table for auth integration)

CREATE TABLE IF NOT EXISTS farm_properties (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  total_area_ha DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_plots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  property_id TEXT NOT NULL REFERENCES farm_properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area_ha DECIMAL(12,2) NOT NULL,
  crop TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_products_catalog (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  dose_per_ha DECIMAL(12,4),
  category TEXT,
  active_ingredient TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_stock (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES farm_products_catalog(id),
  quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
  average_cost DECIMAL(15,4) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(farmer_id, product_id)
);

CREATE TABLE IF NOT EXISTS farm_invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invoice_number TEXT,
  supplier TEXT,
  issue_date TIMESTAMP,
  currency TEXT DEFAULT 'USD',
  total_amount DECIMAL(15,2),
  status TEXT NOT NULL DEFAULT 'pending',
  raw_pdf_data TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_invoice_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id TEXT NOT NULL REFERENCES farm_invoices(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES farm_products_catalog(id),
  product_code TEXT,
  product_name TEXT NOT NULL,
  unit TEXT,
  quantity DECIMAL(15,4) NOT NULL,
  unit_price DECIMAL(15,4) NOT NULL,
  discount DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) NOT NULL,
  batch TEXT,
  expiry_date TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farm_stock_movements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES farm_products_catalog(id),
  type TEXT NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,4),
  reference_type TEXT,
  reference_id TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_applications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES farm_products_catalog(id),
  plot_id TEXT NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES farm_properties(id) ON DELETE CASCADE,
  quantity DECIMAL(15,4) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT now(),
  applied_by TEXT,
  notes TEXT,
  synced_from_offline BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_expenses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plot_id TEXT REFERENCES farm_plots(id),
  property_id TEXT REFERENCES farm_properties(id),
  category TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(15,2) NOT NULL,
  expense_date TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS farm_pdv_terminals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  property_id TEXT REFERENCES farm_properties(id),
  is_online BOOLEAN DEFAULT false,
  last_heartbeat TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
