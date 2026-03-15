/**
 * Farm Routes — Orchestrator
 * Registers all farm route modules in the correct order.
 * Each module is self-contained in its own file for maintainability.
 */
import { Express } from "express";

import { registerFarmAuthRoutes } from "./farm-auth-routes";
import { registerFarmPropertyRoutes } from "./farm-property-routes";
import { registerFarmProductRoutes } from "./farm-product-routes";
import { registerFarmStockRoutes } from "./farm-stock-routes";
import { registerFarmInvoiceRoutes } from "./farm-invoice-routes";
import { registerFarmExpenseRoutes } from "./farm-expense-routes";
import { registerFarmCashFlowRoutes } from "./farm-cashflow-routes";
import { registerFarmPdvRoutes } from "./farm-pdv-routes";
import { registerFarmSeasonRoutes } from "./farm-season-routes";
import { registerFarmN8nWebhookRoutes } from "./farm-n8n-webhook-routes";
import { registerFarmRomaneioRoutes } from "./farm-romaneio-routes";
import { registerFarmFinancialRoutes } from "./farm-financial-routes";
import { registerFarmSprint24Routes } from "./farm-sprint24-routes";

export function registerFarmRoutes(app: Express) {
    registerFarmAuthRoutes(app);
    registerFarmPropertyRoutes(app);
    registerFarmProductRoutes(app);
    registerFarmStockRoutes(app);
    registerFarmInvoiceRoutes(app);
    registerFarmExpenseRoutes(app);
    registerFarmCashFlowRoutes(app);
    registerFarmPdvRoutes(app);
    registerFarmSeasonRoutes(app);
    registerFarmN8nWebhookRoutes(app);
    registerFarmRomaneioRoutes(app);
    registerFarmFinancialRoutes(app);
    registerFarmSprint24Routes(app);

    console.log("Farm routes registered (/api/farm/*, /api/pdv/*)");
}
