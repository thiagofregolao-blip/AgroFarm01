-- Migration 33: Commercial Module
-- Tables: companies, company_users, company_clients, company_products,
--         company_price_lists, company_price_list_items, company_warehouses,
--         company_stock, company_stock_movements, sales_orders, sales_order_items,
--         sales_invoices, sales_invoice_items, sales_order_invoice_links,
--         company_remissions, company_remission_items, company_pagares

-- =====================================================================
-- COMPANIES
-- =====================================================================
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    ruc TEXT,
    address TEXT,
    city TEXT,
    phone TEXT,
    email TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- COMPANY USERS (users <-> companies with roles)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'consultor', -- consultor | director | faturista | financeiro | admin
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(company_id, user_id)
);

-- =====================================================================
-- COMPANY CLIENTS (client portfolio - separate from farmers)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_clients (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    ruc TEXT,
    cedula TEXT,
    client_type TEXT NOT NULL DEFAULT 'person', -- person | company
    address TEXT,
    city TEXT,
    department TEXT,
    phone TEXT,
    email TEXT,
    credit_limit DECIMAL(15,2) DEFAULT 0,
    credit_used DECIMAL(15,2) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_consultant_id VARCHAR REFERENCES users(id),
    notes TEXT,
    import_batch TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- COMPANY PRODUCTS (product catalog per company)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_products (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    code TEXT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'UNI', -- SC, KG, LT, UNI, etc.
    category TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- PRICE LISTS (managed by director, multiple active lists supported)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_price_lists (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from TIMESTAMP,
    valid_until TIMESTAMP,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_price_list_items (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id VARCHAR NOT NULL REFERENCES company_price_lists(id) ON DELETE CASCADE,
    product_id VARCHAR REFERENCES company_products(id),
    product_code TEXT,
    product_name TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'UNI',
    price_usd DECIMAL(15,4),
    price_pyg DECIMAL(15,0),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- WAREHOUSES (depósitos: Santa Rita, Katueté, Cidade do Leste, Assunção)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_warehouses (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- STOCK (current stock snapshot per warehouse per product)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_stock (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id VARCHAR NOT NULL REFERENCES company_warehouses(id) ON DELETE CASCADE,
    product_id VARCHAR NOT NULL REFERENCES company_products(id) ON DELETE CASCADE,
    quantity DECIMAL(15,4) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(warehouse_id, product_id)
);

CREATE TABLE IF NOT EXISTS company_stock_movements (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    warehouse_id VARCHAR NOT NULL REFERENCES company_warehouses(id),
    product_id VARCHAR NOT NULL REFERENCES company_products(id),
    type TEXT NOT NULL, -- in | out | transfer_out | transfer_in | manual_adjust
    quantity DECIMAL(15,4) NOT NULL,
    reference_type TEXT, -- order | invoice | remission | manual
    reference_id VARCHAR,
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- SALES ORDERS
-- =====================================================================
CREATE TABLE IF NOT EXISTS sales_orders (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    client_id VARCHAR NOT NULL REFERENCES company_clients(id),
    consultant_id VARCHAR NOT NULL REFERENCES users(id),
    price_list_id VARCHAR REFERENCES company_price_lists(id),
    payment_type TEXT NOT NULL DEFAULT 'credito', -- contado | credito | anticipado
    freight_payer TEXT DEFAULT 'cliente', -- company | cliente
    delivery_location TEXT,
    payment_location TEXT,
    due_date TIMESTAMP,
    agricultural_year TEXT,
    zafra TEXT,
    culture TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    -- draft | pending_director | approved | pending_billing | pending_finance
    -- | invoiced | partially_invoiced | cancelled
    observations TEXT,
    total_amount_usd DECIMAL(15,2),
    total_amount_pyg DECIMAL(15,0),
    currency TEXT NOT NULL DEFAULT 'USD',
    approved_by_id VARCHAR REFERENCES users(id),
    approved_at TIMESTAMP,
    invoiced_by_id VARCHAR REFERENCES users(id),
    invoiced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(company_id, order_number)
);

CREATE TABLE IF NOT EXISTS sales_order_items (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id VARCHAR REFERENCES company_products(id),
    product_code TEXT,
    product_name TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'UNI',
    unit_price_usd DECIMAL(15,4),
    total_price_usd DECIMAL(15,2),
    warehouse_id VARCHAR REFERENCES company_warehouses(id), -- Local Ret. (pickup warehouse)
    invoiced_quantity DECIMAL(15,4) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open', -- open | partially_invoiced | invoiced
    notes TEXT
);

-- =====================================================================
-- SALES INVOICES (received from external billing system via email or upload)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sales_invoices (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id VARCHAR REFERENCES company_clients(id),
    invoice_number TEXT,
    issue_date TIMESTAMP,
    due_date TIMESTAMP,
    total_amount_usd DECIMAL(15,2),
    total_amount_pyg DECIMAL(15,0),
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending', -- pending | reconciled | partial | cancelled
    reconciliation_status TEXT NOT NULL DEFAULT 'unmatched', -- unmatched | partial | matched
    source TEXT NOT NULL DEFAULT 'manual', -- manual | email_import
    source_email_id TEXT,
    source_email_from TEXT,
    pdf_base64 TEXT,
    raw_data TEXT,
    created_by VARCHAR REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id VARCHAR NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    product_id VARCHAR REFERENCES company_products(id),
    product_code TEXT,
    product_name TEXT NOT NULL,
    quantity DECIMAL(15,4) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'UNI',
    unit_price_usd DECIMAL(15,4),
    total_price_usd DECIMAL(15,2),
    warehouse_id VARCHAR REFERENCES company_warehouses(id),
    order_item_id VARCHAR REFERENCES sales_order_items(id),
    is_reconciled BOOLEAN NOT NULL DEFAULT false
);

-- =====================================================================
-- ORDER <-> INVOICE RECONCILIATION LINKS (supports partial invoicing)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sales_order_invoice_links (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
    invoice_id VARCHAR NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    order_item_id VARCHAR REFERENCES sales_order_items(id),
    invoice_item_id VARCHAR REFERENCES sales_invoice_items(id),
    quantity_linked DECIMAL(15,4) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- =====================================================================
-- REMISSIONS (stock transfers between warehouses)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_remissions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    remission_number TEXT NOT NULL,
    from_warehouse_id VARCHAR NOT NULL REFERENCES company_warehouses(id),
    to_warehouse_id VARCHAR NOT NULL REFERENCES company_warehouses(id),
    status TEXT NOT NULL DEFAULT 'draft', -- draft | in_transit | completed | cancelled
    notes TEXT,
    created_by VARCHAR REFERENCES users(id),
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_remission_items (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    remission_id VARCHAR NOT NULL REFERENCES company_remissions(id) ON DELETE CASCADE,
    product_id VARCHAR NOT NULL REFERENCES company_products(id),
    quantity DECIMAL(15,4) NOT NULL,
    notes TEXT
);

-- =====================================================================
-- PAGARÉS (debt acknowledgment documents - registered manually)
-- =====================================================================
CREATE TABLE IF NOT EXISTS company_pagares (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id VARCHAR NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    client_id VARCHAR NOT NULL REFERENCES company_clients(id),
    invoice_id VARCHAR REFERENCES sales_invoices(id),
    order_id VARCHAR REFERENCES sales_orders(id),
    pagare_number TEXT,
    amount_usd DECIMAL(15,2),
    amount_pyg DECIMAL(15,0),
    currency TEXT NOT NULL DEFAULT 'USD',
    issue_date TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente', -- pendente | pago | protestado | cancelado
    notes TEXT,
    registered_by VARCHAR REFERENCES users(id),
    paid_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
