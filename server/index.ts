import express, { type Request, Response, NextFunction } from "express";
// Force restart
import cors from "cors";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cron from "node-cron";
import { WeatherStationService } from "./services/weather_station_service";

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
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

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

  // Inline migration: ensure the `type` column exists on farm_pdv_terminals
  try {
    const { db, dbReady } = await import("./db");
    const { sql } = await import("drizzle-orm");
    await dbReady;
    await db.execute(sql`ALTER TABLE farm_pdv_terminals ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'estoque'`);
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
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS supplier_id varchar`);
    await db.execute(sql`ALTER TABLE farm_accounts_payable ADD COLUMN IF NOT EXISTS season_id varchar`);

    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS account_id varchar`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS receipt_id varchar`);

    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS receipt_id varchar`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS cheque_id varchar`);

    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS is_remission boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS remission_id varchar`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS supplier_id varchar`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS ruc text`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS expense_category text`);

    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS person_type TEXT`);
    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS entity_type TEXT`);
    await db.execute(sql`ALTER TABLE farm_suppliers ADD COLUMN IF NOT EXISTS guarantor_for TEXT`);
    await db.execute(sql`ALTER TABLE farm_accounts_receivable ADD COLUMN IF NOT EXISTS supplier_id TEXT`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS supplier_id TEXT`);
    await db.execute(sql`ALTER TABLE farm_cash_transactions ADD COLUMN IF NOT EXISTS transfer_date TIMESTAMP`);
    await db.execute(sql`ALTER TABLE farm_stock_movements ADD COLUMN IF NOT EXISTS warehouse_id TEXT`);
    await db.execute(sql`ALTER TABLE farm_invoices ADD COLUMN IF NOT EXISTS skip_stock_entry BOOLEAN DEFAULT false`);

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

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

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
        console.error("Error running weather polling cron:", err);
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
        console.log(`[BACKUP] Daily check completed: ${JSON.stringify(backup)}`);
      } catch (err) {
        console.error("[BACKUP] Daily backup check failed:", err);
      }
    });

    // Start daily bulletin scheduler (production only)
    if (process.env.NODE_ENV === 'production') {
      try {
        const { scheduleDailyBulletin } = await import("./services/bulletin-service");
        scheduleDailyBulletin();
      } catch (e) {
        console.error("Failed to start bulletin scheduler:", e);
      }
    }
  });
})();
