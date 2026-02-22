-- Adiciona coluna skip_stock_entry na tabela farm_invoices
-- Quando true, a fatura é registrada financeiramente mas NÃO dá entrada no estoque
ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS skip_stock_entry BOOLEAN NOT NULL DEFAULT false;
