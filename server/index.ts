import express, { type Request, Response, NextFunction } from "express";
// Force restart
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import cron from "node-cron";
import { WeatherStationService } from "./services/weather_station_service";

const app = express();

app.use(cors({
  origin: true,
  credentials: true,
}));

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
    log("✅ Migration: financial accounts tables ensured");
  } catch (migErr: any) {
    log(`⚠️  Migration check for financial accounts: ${migErr.message}`);
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
