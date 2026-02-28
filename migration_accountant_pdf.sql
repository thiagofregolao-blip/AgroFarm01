-- Migration: Add accountant email to users + PDF storage for invoices
-- Date: 2026-02-28

-- 1. Email do contador no perfil do agricultor
ALTER TABLE users ADD COLUMN IF NOT EXISTS accountant_email TEXT;

-- 2. Armazenamento do PDF original da fatura (base64)
ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS pdf_base64 TEXT;
