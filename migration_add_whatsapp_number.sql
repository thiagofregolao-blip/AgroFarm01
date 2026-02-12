-- Migration: Adicionar campo whatsapp_number nas tabelas users e farm_farmers
-- Data: 2026-02-11

-- 1. Adicionar campo whatsapp_number na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- 2. Criar índice para busca rápida por número de WhatsApp
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_number ON users(whatsapp_number) WHERE whatsapp_number IS NOT NULL;

-- 3. Adicionar campo whatsapp_number na tabela farm_farmers (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'farm_farmers') THEN
        ALTER TABLE farm_farmers ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
        CREATE INDEX IF NOT EXISTS idx_farm_farmers_whatsapp_number ON farm_farmers(whatsapp_number) WHERE whatsapp_number IS NOT NULL;
    END IF;
END $$;

-- 4. Comentário explicativo
COMMENT ON COLUMN users.whatsapp_number IS 'Número de WhatsApp do usuário no formato: 5511999999999 (sem +)';

