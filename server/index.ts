import express from "express";
// Force restart
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cron from "node-cron";
import { WeatherStationService } from "./services/weather_station_service";
import { logger } from "./lib/logger";
import { errorHandler } from "./lib/error-handler";

const app = express();
app.disable("x-powered-by");

// Strict CORS Configuration based on environment
const isProduction = process.env.NODE_ENV === "production";

app.use(cors({
  origin: isProduction ? ["https://www.agrofarmdigital.com", "https://agrofarmdigital.com"] : true,
  credentials: true,
}));

// Setup Helmet with custom Content-Security-Policy
app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProduction
        ? ["'self'"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://cdnjs.cloudflare.com",
        "https://server.arcgisonline.com",
        "https://mt1.google.com",
        "https://*.tile.openstreetmap.org",
        "https://api.dicebear.com",
        "https://unpkg.com"
      ],
      connectSrc: isProduction
        ? ["'self'", "https://wa.me"]
        : ["'self'", "https://wa.me", "ws:", "wss:"],
      workerSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    }
  }
}));

// Strict Cache-Control for all /api routes
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '20mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});


(async () => {
  // HOTFIX removed: ensureSchema() was causing db locks on Railway zero-downtime deploys
  // const { ensureSchema } = await import("./db");
  // await ensureSchema();

  // Inline migration: grain_granero — must run first to unblock AR create
  try {
    const dbMod = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbMod.dbReady;
    await dbMod.db.execute(sql`ALTER TABLE farm_receivable_items ADD COLUMN IF NOT EXISTS grain_granero text`);
    log("✅ Migration: farm_receivable_items.grain_granero ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration grain_granero: ${migErr.message}`);
  }

  // Inline migration: Notas de Crédito tables
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_credit_notes (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type text NOT NULL,
        note_type text NOT NULL,
        supplier text,
        supplier_id varchar,
        client text,
        timbrado text NOT NULL,
        note_number text NOT NULL,
        issue_date timestamp NOT NULL,
        total_amount numeric(15,2) NOT NULL DEFAULT 0,
        total_exenta numeric(15,2) DEFAULT 0,
        total_iva5 numeric(15,2) DEFAULT 0,
        total_iva10 numeric(15,2) DEFAULT 0,
        status text NOT NULL DEFAULT 'active',
        currency text DEFAULT 'USD',
        season_id varchar,
        notes text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_credit_note_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        credit_note_id varchar NOT NULL REFERENCES farm_credit_notes(id) ON DELETE CASCADE,
        product_id varchar,
        description text NOT NULL,
        quantity numeric(15,4) DEFAULT 0,
        unit_price numeric(15,4) DEFAULT 0,
        tax_regime text NOT NULL DEFAULT 'exenta',
        subtotal numeric(15,2) NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_credit_note_invoices (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        credit_note_id varchar NOT NULL REFERENCES farm_credit_notes(id) ON DELETE CASCADE,
        invoice_id text NOT NULL,
        invoice_type text NOT NULL DEFAULT 'payable',
        allocated_amount numeric(15,2) NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    log("✅ Migration: farm_credit_notes tables ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_credit_notes: ${migErr.message}`);
  }

  // Inline migration: ensure the `type` column exists on farm_pdv_terminals
  try {
    const dbMod = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbMod.dbReady; // MUST access db via module namespace AFTER dbReady — destructuring captures undefined
    await dbMod.db.execute(sql`ALTER TABLE farm_pdv_terminals ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'estoque'`);
    log("✅ Migration: farm_pdv_terminals.type column ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for type column: ${migErr.message}`);
  }

  // Inline migration: ensure the `farm_price_history` table exists
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_price_history (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purchase_date timestamp NOT NULL,
        supplier text,
        product_name text NOT NULL,
        quantity numeric(15, 2) NOT NULL,
        unit_price numeric(15, 2) NOT NULL,
        active_ingredient text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    log("✅ Migration: farm_price_history table ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for farm_price_history table: ${migErr.message}`);
  }

  // Inline migration: ensure the financial accounts tables exist
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_accounts_payable (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invoice_id varchar REFERENCES farm_invoices(id),
        expense_id varchar REFERENCES farm_expenses(id),
        supplier text NOT NULL,
        description text,
        total_amount numeric(15, 2) NOT NULL,
        paid_amount numeric(15, 2) DEFAULT 0,
        currency text NOT NULL DEFAULT 'USD',
        installment_number integer DEFAULT 1,
        total_installments integer DEFAULT 1,
        due_date timestamp NOT NULL,
        paid_date timestamp,
        status text NOT NULL DEFAULT 'aberto',
        cash_transaction_id varchar REFERENCES farm_cash_transactions(id),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_accounts_receivable (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        romaneio_id varchar REFERENCES farm_romaneios(id),
        buyer text NOT NULL,
        description text,
        total_amount numeric(15, 2) NOT NULL,
        received_amount numeric(15, 2) DEFAULT 0,
        currency text NOT NULL DEFAULT 'USD',
        due_date timestamp NOT NULL,
        received_date timestamp,
        status text NOT NULL DEFAULT 'pendente',
        cash_transaction_id varchar REFERENCES farm_cash_transactions(id),
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS received_amount numeric(15, 2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS received_date timestamp`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS cash_transaction_id varchar`);
    log("✅ Migration: financial accounts tables ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for financial accounts: ${migErr.message}`);
  }

  // Inline migration: add new fields to company_products
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`ALTER TABLE company_products ADD COLUMN IF NOT EXISTS active_ingredient text`);
    await db.execute(sql`ALTER TABLE company_products ADD COLUMN IF NOT EXISTS dose text`);
    await db.execute(sql`ALTER TABLE company_products ADD COLUMN IF NOT EXISTS description text`);
    log("✅ Migration: company_products fields ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for company_products: ${migErr.message}`);
  }

  // Inline migration: add reserved_quantity to company_stock
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`ALTER TABLE company_stock ADD COLUMN IF NOT EXISTS reserved_quantity decimal(15,4) NOT NULL DEFAULT 0`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_company_stock_wh_product ON company_stock (warehouse_id, product_id)`);
    log("✅ Migration: company_stock.reserved_quantity column + unique index ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for company_stock.reserved_quantity: ${migErr.message}`);
  }

  // Inline migration: director email settings on company_users
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`ALTER TABLE company_users ADD COLUMN IF NOT EXISTS faturista_email text`);
    await db.execute(sql`ALTER TABLE company_users ADD COLUMN IF NOT EXISTS email_body_template text`);
    log("✅ Migration: company_users director email fields ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for company_users director email fields: ${migErr.message}`);
  }

  // Inline migration: add unique index on company_clients (company_id, lower(name))
  // NOTE: dedup DELETE was removed — it ran once and was potentially deleting valid clients on restart
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_company_clients_unique_name
      ON company_clients (company_id, lower(name))
    `);
    log("✅ Migration: company_clients unique name index ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for company_clients unique index: ${migErr.message}`);
  }

  // ═══ Sprint 24-items: new tables + columns ═══
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    // New table: farm_suppliers (#6)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_suppliers (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        ruc text,
        phone text,
        email text,
        address text,
        notes text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // New table: farm_cheques (#10, #11, #12)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_cheques (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id varchar REFERENCES farm_cash_accounts(id),
        type text NOT NULL,
        cheque_number text NOT NULL,
        bank text NOT NULL,
        holder text,
        amount numeric(15,2) NOT NULL,
        currency text NOT NULL DEFAULT 'USD',
        issue_date timestamp NOT NULL,
        due_date timestamp,
        compensation_date timestamp,
        status text NOT NULL DEFAULT 'emitido',
        owner_type text,
        related_payable_id varchar,
        related_receivable_id varchar,
        cash_transaction_id varchar,
        notes text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // New table: farm_receipts (#15, #16, #17)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_receipts (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receipt_number text NOT NULL,
        type text NOT NULL,
        entity text NOT NULL,
        total_amount numeric(15,2) NOT NULL,
        currency text NOT NULL DEFAULT 'USD',
        payment_type text,
        payment_methods jsonb,
        invoice_refs jsonb,
        notes text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // New table: farm_remissions (#24)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_remissions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        supplier text NOT NULL,
        ruc text,
        remission_number text,
        issue_date timestamp,
        status text NOT NULL DEFAULT 'pendente',
        reconciled_invoice_id varchar,
        notes text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    // New table: farm_remission_items (#24)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_remission_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        remission_id varchar NOT NULL REFERENCES farm_remissions(id) ON DELETE CASCADE,
        product_id varchar REFERENCES farm_products_catalog(id),
        product_name text NOT NULL,
        quantity numeric(15,4) NOT NULL,
        unit text
      )
    `);

    // New columns on existing tables
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS observation text`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS payment_method text`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS cheque_id varchar`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS receipt_number text`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS receipt_file_url text`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS supplier_id varchar`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS season_id varchar`);

    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS account_id varchar`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS receipt_id varchar`);

    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS receipt_id varchar`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS cheque_id varchar`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS payable_id varchar`);

    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS is_remission boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS remission_id varchar`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS supplier_id varchar`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS ruc text`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS expense_category text`);

    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS person_type TEXT`);
    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS entity_type TEXT`);
    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS guarantor_for TEXT`);
    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS supplier_id TEXT`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS supplier_id TEXT`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS receipt_number TEXT`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS payment_batch_id VARCHAR`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS reference_id VARCHAR`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS farm_payment_batch_items (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id VARCHAR NOT NULL,
        payable_id VARCHAR NOT NULL,
        amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        farmer_id VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT now(),
        UNIQUE(batch_id, payable_id)
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS farm_grain_stock (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL,
        crop TEXT NOT NULL,
        season_id VARCHAR,
        quantity DECIMAL(15,2) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(farmer_id, crop, season_id)
    )`);
    // Retroactive fix 1: clear cashTransactionId from APs that are part of batches
    try {
        await db.execute(sql`
            UPDATE farm_accounts_payable
            SET cash_transaction_id = NULL
            WHERE id IN (SELECT DISTINCT payable_id FROM farm_payment_batch_items)
              AND cash_transaction_id IS NOT NULL
        `);
    } catch (_) { /* table may not exist yet */ }
    // Retroactive fix 2: set payable_id on transactions that have none but AP has cash_transaction_id
    try {
        await db.execute(sql`
            UPDATE farm_cash_transactions t
            SET payable_id = ap.id
            FROM farm_accounts_payable ap
            WHERE ap.cash_transaction_id = t.id
              AND t.payable_id IS NULL
              AND ap.cash_transaction_id IS NOT NULL
        `);
    } catch (_) {}
    await db.execute(sql`ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS warehouse_id TEXT`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS skip_stock_entry BOOLEAN DEFAULT false`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS file_mime_type TEXT`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'factura'`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS linked_remision_id VARCHAR`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS linked_invoice_id VARCHAR`);
    await db.execute(sql`ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS pdf_base64 TEXT`);
    await db.execute(sql`ALTER TABLE farm_romaneios ADD COLUMN IF NOT EXISTS file_mime_type TEXT`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS equipment_id VARCHAR`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS supplier TEXT`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS image_base64 TEXT`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pendente'`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'a_vista'`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS due_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS installments INTEGER DEFAULT 1`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS installments_paid INTEGER DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS invoice_id VARCHAR`);
    await db.execute(sql`ALTER TABLE farm_expenses ADD COLUMN IF NOT EXISTS season_id VARCHAR`);

    log("✅ Migration: Sprint 24-items tables and columns ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration Sprint 24-items: ${migErr.message}`);
  }

  // Inline migration: farm_guarantors (#4) and farm_issued_invoices (#29)
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_guarantors (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL,
        client_id VARCHAR,
        guarantor_name TEXT NOT NULL,
        guarantor_ruc TEXT,
        guarantor_phone TEXT,
        guarantor_address TEXT,
        created_at TIMESTAMP DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_issued_invoices (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL,
        client_id VARCHAR,
        invoice_number TEXT,
        description TEXT,
        total_amount TEXT DEFAULT '0',
        currency TEXT DEFAULT 'USD',
        issue_date TIMESTAMP DEFAULT now(),
        due_date TIMESTAMP,
        status TEXT DEFAULT 'pendente',
        notes TEXT,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await db.execute(sql`ALTER TABLE farm_issued_invoices ADD COLUMN IF NOT EXISTS season_id VARCHAR`);

    log("✅ Migration: farm_guarantors + farm_issued_invoices tables ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_guarantors/farm_issued_invoices: ${migErr.message}`);
  }

  // Inline migration: soybean_price_cache table
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS soybean_price_cache (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        trade_date TIMESTAMP NOT NULL,
        price_usd_bushel DECIMAL(15,4) NOT NULL,
        price_usd_saca DECIMAL(15,4) NOT NULL,
        source TEXT DEFAULT 'yahoo_finance',
        fetched_at TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE(trade_date)
      )
    `);

    log("✅ Migration: soybean_price_cache table ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration soybean_price_cache: ${migErr.message}`);
  }

  // Migration: Add property_id to farm_stock for per-warehouse stock tracking
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    await db.execute(sql`ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS property_id VARCHAR`);
    // Drop the old unique constraint that only covers (farmer_id, product_id)
    await db.execute(sql`ALTER TABLE farm_stock DROP CONSTRAINT IF EXISTS farm_stock_farmer_id_product_id_unique`);
    // Create new unique constraint that includes property_id (using COALESCE for NULLs)
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_stock_farmer_product_property ON farm_stock (farmer_id, product_id, COALESCE(property_id, '__none__'))`);

    log("✅ Migration: farm_stock.property_id column + unique index ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_stock.property_id: ${migErr.message}`);
  }

  // Migration: AR parcelas + fatura pre-impressa + invoice config
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    // Novos campos na tabela farm_accounts_receivable
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS installment_number integer DEFAULT 1`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS total_installments integer DEFAULT 1`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS season_id varchar`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS invoice_number text`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS payment_condition text DEFAULT 'contado'`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS customer_ruc text`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS customer_address text`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS subtotal_exenta numeric(15,2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS subtotal_gravada_5 numeric(15,2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS subtotal_gravada_10 numeric(15,2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS iva_5 numeric(15,2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS iva_10 numeric(15,2) DEFAULT 0`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS observation text`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS due_date timestamp`);

    // Tabela de itens da fatura de venda
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_receivable_items (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        receivable_id varchar NOT NULL REFERENCES farm_accounts_receivable(id) ON DELETE CASCADE,
        product_id varchar REFERENCES farm_products_catalog(id),
        product_name text NOT NULL,
        unit text DEFAULT 'UN',
        quantity numeric(15,4) NOT NULL,
        unit_price numeric(15,2) NOT NULL,
        iva_rate text DEFAULT '10',
        total_price numeric(15,2) NOT NULL
      )
    `);
    // Grain tracking columns for receivable items
    await db.execute(sql`ALTER TABLE farm_receivable_items ADD COLUMN IF NOT EXISTS grain_crop text`);
    await db.execute(sql`ALTER TABLE farm_receivable_items ADD COLUMN IF NOT EXISTS grain_season_id varchar`);

    // Tabela de configuracao do timbrado
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_invoice_config (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        timbrado text,
        timbrado_start_date timestamp,
        timbrado_end_date timestamp,
        establecimiento text DEFAULT '001',
        punto_expedicion text DEFAULT '001',
        last_sequence integer DEFAULT 0,
        ruc text,
        razon_social text,
        direccion text,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);

    log("✅ Migration: AR parcelas + fatura pre-impressa + invoice_config ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration AR parcelas/invoice_config: ${migErr.message}`);
  }

  // ─── Migration: farm_deposits + deposit_id in farm_stock ───
  try {
    const { db: depDb, dbReady: depReady } = await import("./db");
    const { sql: depSql } = await import("drizzle-orm");
    await depReady;
    await depDb.execute(depSql`
      CREATE TABLE IF NOT EXISTS farm_deposits (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name text NOT NULL,
        deposit_type text NOT NULL DEFAULT 'fazenda',
        location text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    // deposit_id columns removed — property_id is the canonical column for deposits
    // Unique constraint handled in farm_stock cleanup migration below
    log("✅ Migration: farm_deposits table ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_deposits: ${migErr.message}`);
  }

  // Lote, vencimento e embalagem (bloco separado para garantir execução)
  try {
    const { db: loteDb, dbReady: loteReady } = await import("./db");
    const { sql: loteSql } = await import("drizzle-orm");
    await loteReady;
    await loteDb.execute(loteSql`ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS lote text`);
    await loteDb.execute(loteSql`ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS expiry_date timestamp`);
    await loteDb.execute(loteSql`ALTER TABLE farm_stock ADD COLUMN IF NOT EXISTS package_size decimal(15,4)`);
    await loteDb.execute(loteSql`ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS lote text`);
    await loteDb.execute(loteSql`ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS expiry_date timestamp`);
    await loteDb.execute(loteSql`ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS package_size decimal(15,4)`);
    log("✅ Migration: lote/expiry_date/package_size columns ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration lote/expiry/package: ${migErr.message}`);
  }

  // ─── Cleanup: remove invalid cheque records (amount=0 or bank='') ───
  try {
    const { db: cleanDb, dbReady: cleanReady } = await import("./db");
    const { sql: cleanSql } = await import("drizzle-orm");
    await cleanReady;
    await cleanDb.execute(cleanSql`DELETE FROM farm_cheques WHERE (amount = 0 OR bank = '') AND status = 'emitido'`);
    log("✅ Cleanup: cheques invalidos removidos");
  } catch (migErr: any) {
    log(`⚠️  Cleanup cheques invalidos: ${migErr.message}`);
  }

  // ─── Safety migration: ensure all AR columns exist + backfill null due_date ───
  try {
    const { db: arDb, dbReady: arReady } = await import("./db");
    const { sql: arSql } = await import("drizzle-orm");
    await arReady;
    await arDb.execute(arSql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS supplier_id text`);
    await arDb.execute(arSql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS due_date timestamp`);
    // Backfill existing records that have null due_date (set to created_at as fallback)
    await arDb.execute(arSql`UPDATE farm_accounts_receivable SET due_date = created_at WHERE due_date IS NULL`);
    // grain_granero: tracks which silo/buyer the grain came from (for per-silo stock display)
    await arDb.execute(arSql`ALTER TABLE farm_receivable_items ADD COLUMN IF NOT EXISTS grain_granero text`);
    log("✅ Migration: farm_accounts_receivable safety + grain_granero ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration AR safety: ${migErr.message}`);
  }

  // Inline migration: receituário agronômico (tank capacity + flow rate)
  try {
    const { db: recDb, dbReady: recReady } = await import("./db");
    const { sql: recSql } = await import("drizzle-orm");
    await recReady;
    await recDb.execute(recSql`ALTER TABLE farm_equipment ADD COLUMN IF NOT EXISTS tank_capacity_l decimal(10,2)`);
    await recDb.execute(recSql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS flow_rate_l_ha decimal(10,2)`);
    await recDb.execute(recSql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS season_id varchar REFERENCES farm_seasons(id)`);
    log("✅ Migration: receituário columns + season_id ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration receituário: ${(migErr as Error).message}`);
  }

  // Inline migration: farm_season_plots table
  try {
    await db.execute(sql`CREATE TABLE IF NOT EXISTS farm_season_plots (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      season_id varchar NOT NULL REFERENCES farm_seasons(id) ON DELETE CASCADE,
      plot_id varchar NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
      farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      area_percentage numeric(5,2) NOT NULL DEFAULT 100,
      UNIQUE(season_id, plot_id)
    )`);
    log("✅ Migration: farm_season_plots table ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_season_plots: ${(migErr as Error).message}`);
  }

  // Inline migration: farm_employees table + signature column
  try {
    const { db: empDb, dbReady: empReady } = await import("./db");
    const { sql: empSql } = await import("drizzle-orm");
    await empReady;
    await empDb.execute(empSql`CREATE TABLE IF NOT EXISTS farm_employees (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      role text NOT NULL,
      phone text,
      status text DEFAULT 'Ativo',
      photo_base64 text,
      signature_base64 text,
      created_at timestamp NOT NULL DEFAULT now()
    )`);
    await empDb.execute(empSql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS signature_base64 text`);
    await empDb.execute(empSql`ALTER TABLE farm_employees ADD COLUMN IF NOT EXISTS face_embedding text`);
    await empDb.execute(empSql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS employee_name text`);
    await empDb.execute(empSql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS photo_base64 text`);
    log("✅ Migration: farm_employees table + signature_base64 + face_embedding + employee_name + photo_base64 ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_employees: ${(migErr as Error).message}`);
  }

  // ─── Migration: consolidar registros duplicados em farm_stock e dropar deposit_id ───
  try {
    const { db: fixDb, dbReady: fixReady } = await import("./db");
    const { sql: fixSql } = await import("drizzle-orm");
    await fixReady;

    // 1. Consolidar duplicados: para cada (farmer_id, product_id, property_id) com mais de 1 registro,
    //    somar quantidades e manter o maior average_cost, deletar registros extras
    await fixDb.execute(fixSql`
      WITH duplicates AS (
        SELECT farmer_id, product_id, COALESCE(property_id, '__none__') AS prop,
               SUM(CAST(quantity AS numeric)) AS total_qty,
               MAX(CAST(average_cost AS numeric)) AS max_cost,
               MIN(id) AS keep_id,
               COUNT(*) AS cnt
        FROM farm_stock
        GROUP BY farmer_id, product_id, COALESCE(property_id, '__none__')
        HAVING COUNT(*) > 1
      )
      UPDATE farm_stock SET
        quantity = d.total_qty::text,
        average_cost = d.max_cost::text,
        updated_at = now()
      FROM duplicates d
      WHERE farm_stock.id = d.keep_id
    `);
    await fixDb.execute(fixSql`
      WITH duplicates AS (
        SELECT farmer_id, product_id, COALESCE(property_id, '__none__') AS prop,
               MIN(id) AS keep_id
        FROM farm_stock
        GROUP BY farmer_id, product_id, COALESCE(property_id, '__none__')
        HAVING COUNT(*) > 1
      )
      DELETE FROM farm_stock
      WHERE id NOT IN (SELECT keep_id FROM duplicates)
        AND EXISTS (
          SELECT 1 FROM duplicates d
          WHERE d.farmer_id = farm_stock.farmer_id
            AND d.product_id = farm_stock.product_id
            AND d.prop = COALESCE(farm_stock.property_id, '__none__')
            AND farm_stock.id != d.keep_id
        )
    `);

    // 2. Deletar registros fantasmas: quantidade negativa + sem depósito,
    //    quando existe outro registro do mesmo produto COM depósito (o real)
    await fixDb.execute(fixSql`
      DELETE FROM farm_stock
      WHERE property_id IS NULL
        AND CAST(quantity AS numeric) < 0
        AND EXISTS (
          SELECT 1 FROM farm_stock fs2
          WHERE fs2.farmer_id = farm_stock.farmer_id
            AND fs2.product_id = farm_stock.product_id
            AND fs2.property_id IS NOT NULL
            AND CAST(fs2.quantity AS numeric) > 0
        )
    `);

    // 3. Dropar coluna deposit_id (sempre NULL, substituída por property_id)
    await fixDb.execute(fixSql`ALTER TABLE farm_stock DROP COLUMN IF EXISTS deposit_id`);

    // 3. Garantir unique index correto
    await fixDb.execute(fixSql`DROP INDEX IF EXISTS idx_farm_stock_farmer_product_deposit`);
    await fixDb.execute(fixSql`CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_stock_farmer_product_property ON farm_stock (farmer_id, product_id, COALESCE(property_id, '__none__'))`);

    log("✅ Migration: farm_stock duplicados consolidados + deposit_id removido");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_stock cleanup: ${(migErr as Error).message}`);
  }

  // Inline migration: employee access system (user_id on farm_employees + access_level on user_modules)
  try {
    const { db: empDb, dbReady: empReady } = await import("./db");
    const { sql: empSql } = await import("drizzle-orm");
    await empReady;
    await empDb.execute(empSql`ALTER TABLE farm_employees ADD COLUMN IF NOT EXISTS user_id VARCHAR`);
    await empDb.execute(empSql`ALTER TABLE user_modules ADD COLUMN IF NOT EXISTS access_level VARCHAR DEFAULT 'view'`);
    log("✅ Migration: employee access system columns ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration employee access: ${(migErr as Error).message}`);
  }

  // Inline migration: farm_activity_logs table for audit trail
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_activity_logs (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        user_name VARCHAR,
        action VARCHAR NOT NULL,
        entity VARCHAR NOT NULL,
        entity_id VARCHAR,
        details JSONB,
        ip_address VARCHAR,
        created_at TIMESTAMP DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farm_activity_logs_farmer ON farm_activity_logs(farmer_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_farm_activity_logs_created ON farm_activity_logs(created_at)`);
    log("✅ Migration: farm_activity_logs table + indexes ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_activity_logs: ${(migErr as Error).message}`);
  }

  // Inline migration: grain contracts + deliveries
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_grain_contracts (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        season_id VARCHAR,
        buyer TEXT NOT NULL,
        crop TEXT NOT NULL,
        contract_number TEXT,
        contract_type TEXT NOT NULL DEFAULT 'spot',
        total_quantity NUMERIC(15,2) NOT NULL,
        delivered_quantity NUMERIC(15,2) NOT NULL DEFAULT 0,
        price_per_ton NUMERIC(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD',
        total_value NUMERIC(15,2) NOT NULL,
        delivery_start_date TIMESTAMP,
        delivery_end_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'aberto',
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS farm_grain_deliveries (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        contract_id VARCHAR NOT NULL REFERENCES farm_grain_contracts(id) ON DELETE CASCADE,
        romaneio_id VARCHAR,
        quantity NUMERIC(15,2) NOT NULL,
        gross_weight NUMERIC(15,2),
        tare_weight NUMERIC(15,2),
        net_weight NUMERIC(15,2),
        moisture NUMERIC(5,2),
        impurity NUMERIC(5,2),
        final_weight NUMERIC(15,2),
        truck_plate TEXT,
        driver_name TEXT,
        delivery_date TIMESTAMP NOT NULL DEFAULT now(),
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    log("✅ Migration: farm_grain_contracts + farm_grain_deliveries tables ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration grain_contracts/deliveries: ${(migErr as Error).message}`);
  }

  // Inline migration: idempotency_key for PDV applications + retroactive duplicate cleanup
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;

    // Add idempotency_key column
    await db.execute(sql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(100)`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_applications_idempotency ON farm_applications (idempotency_key) WHERE idempotency_key IS NOT NULL`);

    // display_order: ordem de selecao do cliente no PDV (preserva sequencia no caderno/PDF)
    await db.execute(sql`ALTER TABLE farm_applications ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0`);

    // Find duplicate applications: same farmer_id + product_id + plot_id + quantity within 120 seconds
    // Keep the oldest (smallest created_at), delete the rest + their movements + restore stock
    const dupResult = await db.execute(sql`
      WITH ordered AS (
        SELECT
          a.id,
          a.farmer_id,
          a.product_id,
          a.property_id,
          a.quantity,
          a.applied_at,
          LAG(a.id) OVER (
            PARTITION BY a.farmer_id, a.product_id, COALESCE(a.plot_id::text, ''), a.quantity
            ORDER BY a.applied_at ASC
          ) AS prev_id,
          LAG(a.applied_at) OVER (
            PARTITION BY a.farmer_id, a.product_id, COALESCE(a.plot_id::text, ''), a.quantity
            ORDER BY a.applied_at ASC
          ) AS prev_at
        FROM farm_applications a
      )
      SELECT id, farmer_id, product_id, property_id, quantity
      FROM ordered
      WHERE prev_id IS NOT NULL
        AND EXTRACT(EPOCH FROM (applied_at - prev_at)) < 120
    `);
    const dupRows: any[] = (dupResult as any).rows ?? (dupResult as any) ?? [];

    if (dupRows.length > 0) {
      for (const dup of dupRows) {
        // Delete the movement for this duplicate application
        await db.execute(sql`
          DELETE FROM farm_stock_movements
          WHERE reference_type = 'pdv' AND reference_id = ${dup.id}
        `);
        // Restore the stock quantity that was erroneously deducted
        await db.execute(sql`
          UPDATE farm_stock
          SET quantity = CAST(quantity AS NUMERIC) + ABS(CAST(${dup.quantity} AS NUMERIC))
          WHERE farmer_id = ${dup.farmer_id}
            AND product_id = ${dup.product_id}
            AND COALESCE(property_id::text, '') = COALESCE(${dup.property_id ?? ''}::text, '')
        `);
        // Delete the duplicate application
        await db.execute(sql`DELETE FROM farm_applications WHERE id = ${dup.id}`);
      }
      log(`✅ Migration: ${dupRows.length} duplicate PDV applications removed and stock restored`);
    } else {
      log("✅ Migration: PDV idempotency_key column ensured (no duplicates found)");
    }
  } catch (migErr: any) {
    log(`⚠️  Migration PDV idempotency: ${migErr.message}`);
  }

  // Inline migration: farm_loans + farm_loan_installments
  try {
    const { db: loanDb, dbReady: loanReady } = await import("./db");
    const { sql: loanSql } = await import("drizzle-orm");
    await loanReady;
    await loanDb.execute(loanSql`
      CREATE TABLE IF NOT EXISTS farm_loans (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        farmer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'payable',
        counterpart_id VARCHAR,
        counterpart_name TEXT NOT NULL,
        description TEXT,
        currency TEXT NOT NULL DEFAULT 'USD',
        account_id VARCHAR,
        total_amount NUMERIC(15,2) NOT NULL,
        interest_rate NUMERIC(8,4),
        paid_amount NUMERIC(15,2) DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'aberto',
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await loanDb.execute(loanSql`
      CREATE TABLE IF NOT EXISTS farm_loan_installments (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        loan_id VARCHAR NOT NULL REFERENCES farm_loans(id) ON DELETE CASCADE,
        installment_number INTEGER NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        due_date TIMESTAMP NOT NULL,
        paid_amount NUMERIC(15,2) DEFAULT 0,
        paid_date TIMESTAMP,
        status TEXT NOT NULL DEFAULT 'pendente',
        cash_transaction_id VARCHAR,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    // Numero serial por emprestimo: PRST-YYYY-NNNN onde NNNN reseta por farmer+ano
    await db.execute(sql`ALTER TABLE farm_loans ADD COLUMN IF NOT EXISTS loan_number INTEGER`);
    await db.execute(sql`ALTER TABLE farm_loans ADD COLUMN IF NOT EXISTS loan_year INTEGER`);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_farm_loans_number
      ON farm_loans(farmer_id, loan_year, loan_number)
      WHERE loan_number IS NOT NULL
    `);
    // Backfill: numera emprestimos existentes por ordem cronologica, separados por farmer+ano
    await db.execute(sql`
      UPDATE farm_loans SET
        loan_year = sub.yr,
        loan_number = sub.rn
      FROM (
        SELECT id,
               EXTRACT(YEAR FROM created_at)::int AS yr,
               ROW_NUMBER() OVER (
                 PARTITION BY farmer_id, EXTRACT(YEAR FROM created_at)
                 ORDER BY created_at
               ) AS rn
        FROM farm_loans
        WHERE loan_number IS NULL
      ) sub
      WHERE farm_loans.id = sub.id
    `);
    log("✅ Migration: farm_loans + farm_loan_installments tables ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration farm_loans: ${migErr.message}`);
  }

  // Register activity log middleware before routes
  const { activityLogMiddleware } = await import("./lib/activity-logger");
  app.use(activityLogMiddleware);

  const server = await registerRoutes(app);

  // Register Farm Stock Management routes
  const { registerFarmRoutes } = await import("./farm-routes");
  registerFarmRoutes(app);

  // Register Farm Report routes
  const { registerReportRoutes } = await import("./report-routes");
  registerReportRoutes(app);

  // Register Field Notebook routes
  const { registerFieldNotebookRoutes } = await import("./field-notebook-routes");
  registerFieldNotebookRoutes(app);

  // Register Quotation Network routes
  const { registerQuotationNetworkRoutes } = await import("./quotation-network-routes");
  registerQuotationNetworkRoutes(app);

  // Register Soybean Price (Cotacao Soja) routes
  const { registerSojaCotacaoRoutes } = await import("./soja-cotacao-routes");
  registerSojaCotacaoRoutes(app);

  // Register NDVI satellite routes
  const { registerNdviRoutes } = await import("./ndvi-routes");
  registerNdviRoutes(app);

  // Register Invoice Email Import routes (Mailgun webhook)
  const { registerInvoiceEmailRoutes } = await import("./invoice-email-routes");
  registerInvoiceEmailRoutes(app);
  log("✅ Invoice Email Import routes registered (/api/webhooks/mailgun/*)");

  // Register Commercial Module routes
  const { registerCommercialRoutes } = await import("./commercial-routes");
  registerCommercialRoutes(app);
  log("✅ Commercial Module routes registered (/api/company/* /api/admin/companies/*)");

  // Register Admin Report Routes (Dashboards Diretoria)
  const { registerAdminReportRoutes } = await import("./admin-report-routes");
  registerAdminReportRoutes(app);
  log("✅ Admin Report routes registered (/api/company/admin-reports/*)");

  // Register Farm Loans routes
  const { registerFarmLoansRoutes } = await import("./farm-loans-routes");
  registerFarmLoansRoutes(app);
  log("✅ Farm Loans routes registered (/api/farm/loans/*)");

  // Register WhatsApp routes (if configured)
  if (process.env.ZAPI_INSTANCE_ID && process.env.ZAPI_TOKEN && process.env.GEMINI_API_KEY) {
    const { WhatsAppService } = await import("./whatsapp/whatsapp-service");
    const { registerWhatsAppRoutes } = await import("./whatsapp/webhook");

    const whatsappService = new WhatsAppService({
      zapiInstanceId: process.env.ZAPI_INSTANCE_ID,
      zapiToken: process.env.ZAPI_TOKEN,
      zapiClientToken: process.env.ZAPI_CLIENT_TOKEN,
      geminiApiKey: process.env.GEMINI_API_KEY,
      zapiBaseUrl: process.env.ZAPI_BASE_URL,
    });

    registerWhatsAppRoutes(app, whatsappService);
    log("✅ WhatsApp routes registered (/api/whatsapp/*)");
  } else {
    log("⚠️  WhatsApp not configured (missing ZAPI_INSTANCE_ID, ZAPI_TOKEN, or GEMINI_API_KEY)");
  }

  // Dynamic Multi-tenant Manifest for the POS (PDV) PWA setup
  app.get("/manifest-pdv.json", (_req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      name: "AgroFarm PDV",
      short_name: "PDV",
      description: "Ponto de Venda do AgroFarm",
      theme_color: "#16A249",
      background_color: "#ffffff",
      display: "standalone",
      orientation: "portrait",
      start_url: "/pdv/login",
      scope: "/pdv/",
      icons: [
        { src: "icon-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "icon-512x512.png", sizes: "512x512", type: "image/png" },
        { src: "icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    });
  });

  // ── Bot chat route (antes do error handler) ──
  const { botChatHandler } = await import("./bot/chat-handler");
  app.post("/api/bot/chat", botChatHandler);

  // ── Download page: validate password and return latest release links ──
  app.post("/api/download/auth", (req: any, res: any) => {
    const DOWNLOAD_PASSWORD = process.env.DOWNLOAD_PASSWORD || "agrofarm2025";
    const { password } = req.body || {};
    if (!password || password !== DOWNLOAD_PASSWORD) {
      return res.status(401).json({ error: "Senha incorreta" });
    }
    // Links do GitHub Releases — atualize a tag conforme nova versão
    const GH_REPO = "thiagofregolao-blip/AgroFarm01";
    const LATEST_TAG = process.env.ELECTRON_VERSION || "v1.0.4";
    const ver = LATEST_TAG.replace("v", "");
    const base = `https://github.com/${GH_REPO}/releases/download/${LATEST_TAG}`;
    res.json({
      version: LATEST_TAG,
      mac: `${base}/AgroFarm-Digital-${ver}-arm64.dmg`,      // Apple Silicon
      macIntel: `${base}/AgroFarm-Digital-${ver}-x64.dmg`,  // Intel
      win: `${base}/AgroFarm-Digital-${ver}-x64.exe`,
    });
  });

  // ── Monitor test error endpoint (gera erro proposital pra testar) ──
  app.post("/api/monitor/test-error", (req: any, res: any, next: any) => {
    const level = (req.body?.level || req.query?.level || "warning") as string;
    const message = (req.body?.message || req.query?.message || "Erro de teste simulado pelo admin") as string;
    const err = new Error(`[TEST] ${message}`);
    (err as any).testLevel = level;
    next(err);
  });
  // GET version for easy browser testing
  app.get("/api/monitor/test-error", (req: any, res: any, next: any) => {
    const level = (req.query?.level || "warning") as string;
    const message = (req.query?.message || "Erro de teste via browser") as string;
    const err = new Error(`[TEST] ${message}`);
    (err as any).testLevel = level;
    next(err);
  });

  // ── Monitor status endpoint ──
  app.get("/api/monitor/status", async (_req, res) => {
    try {
      const { getRecentErrors } = await import("./monitor/error-filter");
      const errors = getRecentErrors(24, "all");
      res.json({
        active: true,
        anthropicKey: !!process.env.ANTHROPIC_API_KEY,
        notionToken: !!process.env.NOTION_TOKEN,
        errors24h: errors.length,
        critical: errors.filter(e => e.severity === "critical").length,
        warnings: errors.filter(e => e.severity === "warning").length,
        lastError: errors[0] ? { message: errors[0].message.slice(0, 80), severity: errors[0].severity, module: errors[0].module, time: errors[0].lastSeen } : null,
      });
    } catch { res.json({ active: false }); }
  });

  // ── Monitor middleware (ANTES do error handler para capturar erros) ──
  try {
    const { monitorMiddleware, setupGlobalHandlers } = await import("./monitor/monitor-middleware");
    app.use(monitorMiddleware());
    setupGlobalHandlers();
  } catch (err) {
    log("⚠️  Monitor middleware nao carregou: " + (err as Error).message);
  }

  app.use(errorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, "0.0.0.0", async () => {
    log(`serving on port ${port}`);

    // Schedule weather background updates every 3 hours
    cron.schedule('0 */3 * * *', async () => {
      try {
        await WeatherStationService.pollAllActiveStations();
      } catch (err) {
        logger.error('Cron weather polling failed', {}, err instanceof Error ? err : new Error(String(err)));
      }
    });

    // #1: Daily backup at 2 AM — exports key tables as JSON to console log
    cron.schedule('0 2 * * *', async () => {
      try {
        const { db: backupDb } = await import("./db");
        const { sql: bkSql } = await import("drizzle-orm");
        const tables = ['farm_cash_accounts', 'farm_cash_transactions', 'farm_expenses', 'farm_invoices',
            'farm_accounts_payable', 'farm_accounts_receivable', 'farm_stock', 'farm_stock_movements',
            'farm_suppliers', 'farm_cheques', 'farm_receipts', 'farm_remissions'];
        const backup: Record<string, any> = { timestamp: new Date().toISOString() };
        for (const t of tables) {
          try {
            const r = await backupDb.execute(bkSql.raw(`SELECT count(*) as cnt FROM ${t}`));
            backup[t] = ((r as any).rows ?? r)[0]?.cnt ?? 0;
          } catch { backup[t] = 'N/A'; }
        }
        logger.info('Cron daily backup check completed', backup);
      } catch (err) {
        logger.error('Cron daily backup check failed', {}, err instanceof Error ? err : new Error(String(err)));
      }
    });

    // Start daily bulletin scheduler (production only)
    if (process.env.NODE_ENV === 'production') {
      try {
        const { scheduleDailyBulletin } = await import("./services/bulletin-service");
        scheduleDailyBulletin();
      } catch (e) {
        logger.error('Failed to start bulletin scheduler', {}, e instanceof Error ? e : new Error(String(e)));
      }
    }
  });
})();
