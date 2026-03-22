import type { Express } from "express";
import { storage } from "./storage";
import { subcategories, clients, sales, seasons, categories, products, clientMarketRates, externalPurchases, userClientLinks, masterClients, barterSimulations, barterSimulationItems, productsPriceTable, globalManagementApplications, clientApplicationTracking, insertClientApplicationTrackingSchema, clientCategoryPipeline, insertPlanningGlobalConfigurationSchema, users, seasonGoals, marketBenchmarks } from "@shared/schema";
import multer from "multer";
import { requireAuth, requireSuperAdmin } from "./auth";
import { db } from "./db";
import { eq, sql, and, desc, inArray, or, sum, count } from "drizzle-orm";

export function registerPlanningRoutes(app: Express) {
  const upload = multer({ storage: multer.memoryStorage() });

  // PRICE TABLE PRODUCTS FOR CONSULTANTS (read-only access to products)

  app.get("/api/price-table-products", requireAuth, async (req, res) => {
    try {
      const { categoria } = req.query;

      const whereConditions = [eq(productsPriceTable.isActive, true)];
      if (categoria) {
        whereConditions.push(eq(productsPriceTable.categoria, categoria as string));
      }

      const products = await db.select()
        .from(productsPriceTable)
        .where(and(...whereConditions))
        .orderBy(productsPriceTable.mercaderia);

      res.json(products);
    } catch (error) {
      console.error('Get price table products error:', error);
      res.status(500).json({ error: "Failed to get products" });
    }
  });

  // GLOBAL MANAGEMENT APPLICATIONS ROUTES (Consultant's crop management plan)

  app.get("/api/global-management", requireAuth, async (req, res) => {
    try {
      const seasonId = req.query.seasonId as string | undefined;

      if (!seasonId) {
        return res.status(400).json({ error: "Season ID is required" });
      }

      // GLOBAL applications - fetch ALL for the season (not filtered by user)
      const applications = await db.select()
        .from(globalManagementApplications)
        .leftJoin(productsPriceTable, eq(globalManagementApplications.productId, productsPriceTable.id))
        .where(eq(globalManagementApplications.seasonId, seasonId))
        .orderBy(globalManagementApplications.categoria, globalManagementApplications.applicationNumber);

      // Transform to include product details
      const result = applications.map(app => ({
        ...app.global_management_applications,
        product: app.products_price_table
      }));

      res.json(result);
    } catch (error) {
      console.error('Get global management error:', error);
      res.status(500).json({ error: "Failed to get global management applications" });
    }
  });

  app.post("/api/global-management", requireAuth, async (req, res) => {
    try {
      // Only managers can configure global management
      if (req.user!.role !== "gerente") {
        return res.status(403).json({ error: "Apenas gerentes podem configurar manejo global" });
      }

      const { categoria, applicationNumber, productId, priceTier, seasonId, customName, customPricePerHa } = req.body as any;

      if (!seasonId) {
        return res.status(400).json({ error: "Season ID is required" });
      }

      let finalProductId: string | undefined = productId;
      let finalPricePerHa = "0.00";
      let finalPriceTier = priceTier || "verde";

      if (customName && customPricePerHa) {
        // Criar produto sintético na tabela de preços para categorias livres
        const [createdProduct] = await db
          .insert(productsPriceTable)
          .values({
            mercaderia: String(customName),
            principioAtivo: null,
            categoria: String(categoria).toUpperCase(),
            subcategory: null,
            dose: null,
            fabricante: null,
            precoVerde: String(customPricePerHa),
            precoAmarela: String(customPricePerHa),
            precoVermelha: String(customPricePerHa),
            unidade: "$/ha",
          })
          .returning();

        finalProductId = createdProduct.id;
        finalPricePerHa = parseFloat(String(customPricePerHa)).toFixed(2);
        finalPriceTier = "verde";
      } else {
        if (!productId) {
          return res
            .status(400)
            .json({ error: "Product ID or customName/customPricePerHa is required" });
        }

        // Get product to extract price
        const [product] = await db
          .select()
          .from(productsPriceTable)
          .where(eq(productsPriceTable.id, productId))
          .limit(1);

        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }

        // Get price based on tier and calculate cost per hectare (price × dose)
        let basePrice = "0.00";
        if (priceTier === "verde") basePrice = product.precoVerde;
        else if (priceTier === "amarela") basePrice = product.precoAmarela;
        else if (priceTier === "vermelha") basePrice = product.precoVermelha;

        // Extract numeric dose from text (handles "2ml/Kg", "0,5ml/Kg", etc.)
        let dose = 1;
        if (product.dose) {
          const doseStr = product.dose.toString().replace(",", ".");
          const doseMatch = doseStr.match(/[\d.]+/);
          if (doseMatch) {
            dose = parseFloat(doseMatch[0]);
          }
        }

        finalProductId = product.id;
        finalPricePerHa = (parseFloat(basePrice) * dose).toFixed(2);
      }

      // GLOBAL application - shared across all consultants in the team
      const [newApp] = await db
        .insert(globalManagementApplications)
        .values({
          seasonId,
          categoria,
          applicationNumber,
          productId: finalProductId!,
          priceTier: finalPriceTier,
          pricePerHa: finalPricePerHa,
        })
        .returning();

      res.json(newApp);
    } catch (error) {
      console.error("Create global management error:", error);
      res.status(500).json({ error: "Failed to create global management application" });
    }
  });

  app.delete("/api/global-management/:id", requireAuth, async (req, res) => {
    try {
      // Only managers can delete global management applications
      if (req.user!.role !== 'gerente') {
        return res.status(403).json({ error: "Apenas gerentes podem excluir aplicações de manejo" });
      }

      const [deleted] = await db.delete(globalManagementApplications)
        .where(eq(globalManagementApplications.id, req.params.id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Application not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete global management error:', error);
      res.status(500).json({ error: "Failed to delete global management application" });
    }
  });

  // CLIENT APPLICATION TRACKING ROUTES (Tracking applications per client)
  app.get("/api/client-application-tracking/:clientId/:seasonId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId, seasonId } = req.params;

      const trackingRecords = await db.select()
        .from(clientApplicationTracking)
        .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
        .leftJoin(productsPriceTable, eq(globalManagementApplications.productId, productsPriceTable.id))
        .where(
          and(
            eq(clientApplicationTracking.userId, userId),
            eq(clientApplicationTracking.clientId, clientId),
            eq(clientApplicationTracking.seasonId, seasonId)
          )
        )
        .orderBy(clientApplicationTracking.categoria, clientApplicationTracking.applicationNumber);

      const result = trackingRecords.map(record => ({
        ...record.client_application_tracking,
        globalApplication: record.global_management_applications,
        product: record.products_price_table
      }));

      res.json(result);
    } catch (error) {
      console.error('Get client application tracking error:', error);
      res.status(500).json({ error: "Failed to get client application tracking" });
    }
  });

  app.post("/api/client-application-tracking", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const trackingData = insertClientApplicationTrackingSchema.parse({
        ...req.body,
        userId
      });

      // UPSERT: Insert ou Update se já existir (baseado na unique constraint)
      const [newTracking] = await db.insert(clientApplicationTracking)
        .values(trackingData)
        .onConflictDoUpdate({
          target: [
            clientApplicationTracking.clientId,
            clientApplicationTracking.seasonId,
            clientApplicationTracking.globalApplicationId
          ],
          set: {
            status: trackingData.status,
            isLostToCompetitor: trackingData.isLostToCompetitor,
            soldValue: trackingData.soldValue,
            totalValue: trackingData.totalValue,
            updatedAt: new Date()
          }
        })
        .returning();

      res.status(201).json(newTracking);
    } catch (error) {
      console.error('Create client application tracking error:', error);
      res.status(500).json({ error: "Failed to create client application tracking" });
    }
  });

  app.patch("/api/client-application-tracking/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { status, isLostToCompetitor, soldValue } = req.body;

      const [updated] = await db.update(clientApplicationTracking)
        .set({
          status: status !== undefined ? status : undefined,
          isLostToCompetitor: isLostToCompetitor !== undefined ? isLostToCompetitor : undefined,
          soldValue: soldValue !== undefined ? String(soldValue) : undefined,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(clientApplicationTracking.id, req.params.id),
            eq(clientApplicationTracking.userId, userId)
          )
        )
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Tracking record not found or unauthorized" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Update client application tracking error:', error);
      res.status(500).json({ error: "Failed to update client application tracking" });
    }
  });

  // BARTER MODULE ROUTES

  // Barter Products (Super Admin only)
  app.get("/api/admin/barter/products", requireSuperAdmin, async (req, res) => {
    try {
      const products = await storage.getAllBarterProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch barter products" });
    }
  });

  app.post("/api/admin/barter/products", requireSuperAdmin, async (req, res) => {
    try {
      const { insertBarterProductSchema } = await import("@shared/schema");
      const productData = insertBarterProductSchema.parse(req.body);
      const newProduct = await storage.createBarterProduct(productData);
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error creating barter product:", error);
      res.status(400).json({ error: "Invalid barter product data" });
    }
  });

  app.patch("/api/admin/barter/products/:id", requireSuperAdmin, async (req, res) => {
    try {
      console.log("Updating barter product:", req.params.id, "with data:", req.body);

      // Convert number fields to strings for decimal type validation
      const updateData = { ...req.body };
      if (updateData.priceUsd !== undefined && updateData.priceUsd !== null) {
        updateData.priceUsd = String(updateData.priceUsd);
      }
      if (updateData.priceVerde !== undefined && updateData.priceVerde !== null) {
        updateData.priceVerde = String(updateData.priceVerde);
      }
      if (updateData.priceAmarela !== undefined && updateData.priceAmarela !== null) {
        updateData.priceAmarela = String(updateData.priceAmarela);
      }
      if (updateData.priceVermelha !== undefined && updateData.priceVermelha !== null) {
        updateData.priceVermelha = String(updateData.priceVermelha);
      }

      const updated = await storage.updateBarterProduct(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Barter product not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating barter product:", error);
      res.status(400).json({ error: "Failed to update barter product" });
    }
  });

  app.delete("/api/admin/barter/products/:id", requireSuperAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteBarterProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Barter product not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete barter product" });
    }
  });

  app.delete("/api/admin/barter/products", requireSuperAdmin, async (req, res) => {
    try {
      await storage.deleteAllBarterProducts();
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting all barter products:", error);
      res.status(500).json({ error: "Failed to delete all barter products" });
    }
  });

  // Bulk import barter products from Excel/PDF
  app.post("/api/admin/barter/products/bulk-import", requireSuperAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { parsePdfBarterProducts, parseExcelBarterProducts } = await import("./parse-barter-products");
      const { insertBarterProductSchema } = await import("@shared/schema");

      let parsedProducts;
      const fileExtension = req.file.originalname.split('.').pop()?.toLowerCase();

      if (fileExtension === 'pdf') {
        parsedProducts = await parsePdfBarterProducts(req.file.buffer);
      } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
        parsedProducts = await parseExcelBarterProducts(req.file.buffer);
      } else {
        return res.status(400).json({ error: "Unsupported file format. Use PDF or Excel." });
      }

      // Preview mode - just return parsed products without saving
      if (req.body.preview === 'true') {
        return res.json({ products: parsedProducts, count: parsedProducts.length });
      }

      // Import mode - validate and save products
      const created = [];
      const errors = [];
      const seasonId = req.body.seasonId || undefined;

      for (const product of parsedProducts) {
        try {
          // Keep prices as strings for decimal type
          const priceVerde = product.priceVerde || '0';
          const priceAmarela = product.priceAmarela || '0';
          const priceVermelha = product.priceVermelha || '0';

          const productData = {
            name: product.name,
            category: product.category,
            principioAtivo: product.principioAtivo,
            dosePerHa: product.dosePerHa,
            fabricante: product.fabricante,
            unit: product.unit,
            priceUsd: parseFloat(priceVerde) > 0 ? priceVerde : (parseFloat(priceAmarela) > 0 ? priceAmarela : priceVermelha),
            priceVerde: parseFloat(priceVerde) > 0 ? priceVerde : undefined,
            priceAmarela: parseFloat(priceAmarela) > 0 ? priceAmarela : undefined,
            priceVermelha: parseFloat(priceVermelha) > 0 ? priceVermelha : undefined,
            seasonId: seasonId,
            isActive: true,
          };

          const validated = insertBarterProductSchema.parse(productData);
          const newProduct = await storage.createBarterProduct(validated);
          created.push(newProduct);
        } catch (err: any) {
          const errorMsg = err?.issues ? JSON.stringify(err.issues) : String(err);
          errors.push({ product: product.name, error: errorMsg });
        }
      }

      const result = {
        success: true,
        created: created.length,
        errors: errors.length,
        errorDetails: errors,
      };

      console.log(`Bulk import result: ${created.length} created, ${errors.length} errors`);
      if (errors.length > 0) {
        console.log('First 5 errors:', errors.slice(0, 5));
      }

      res.json(result);
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({ error: "Failed to import products" });
    }
  });

  // Barter Settings (Super Admin only)
  app.get("/api/admin/barter/settings", requireSuperAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllBarterSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch barter settings" });
    }
  });

  app.put("/api/admin/barter/settings/:key", requireSuperAdmin, async (req, res) => {
    try {
      const { value, description } = req.body;
      if (!value) {
        return res.status(400).json({ error: "Value is required" });
      }
      const setting = await storage.upsertBarterSetting(req.params.key, value, description);
      res.json(setting);
    } catch (error) {
      res.status(400).json({ error: "Failed to update barter setting" });
    }
  });

  // Barter Simulations (All authenticated users)
  app.get("/api/barter/simulations", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const simulations = await storage.getBarterSimulationsByUser(userId);
      res.json(simulations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch simulations" });
    }
  });

  app.get("/api/barter/simulations/:id", requireAuth, async (req, res) => {
    try {
      const simulation = await storage.getBarterSimulation(req.params.id);
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      if (simulation.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      res.json(simulation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch simulation" });
    }
  });

  app.post("/api/barter/simulations", requireAuth, async (req, res) => {
    try {
      const { insertBarterSimulationSchema } = await import("@shared/schema");
      const simulationData = {
        ...req.body,
        userId: req.user!.id,
        areaHa: typeof req.body.areaHa === 'number' ? req.body.areaHa.toString() : req.body.areaHa,
        totalUsd: typeof req.body.totalUsd === 'number' ? req.body.totalUsd.toString() : req.body.totalUsd,
        sackPriceUsd: typeof req.body.sackPriceUsd === 'number' ? req.body.sackPriceUsd.toString() : req.body.sackPriceUsd,
        bufferPercentage: typeof req.body.bufferPercentage === 'number' ? req.body.bufferPercentage.toString() : req.body.bufferPercentage,
        grainQuantityKg: typeof req.body.grainQuantityKg === 'number' ? req.body.grainQuantityKg.toString() : req.body.grainQuantityKg,
        grainQuantitySacks: typeof req.body.grainQuantitySacks === 'number' ? req.body.grainQuantitySacks.toString() : req.body.grainQuantitySacks,
      };
      const validatedData = insertBarterSimulationSchema.parse(simulationData);

      // Convert numeric fields to strings in items
      const items = (req.body.items || []).map((item: any) => ({
        ...item,
        quantity: typeof item.quantity === 'number' ? item.quantity.toString() : item.quantity,
        priceUsd: typeof item.priceUsd === 'number' ? item.priceUsd.toString() : item.priceUsd,
        totalUsd: typeof item.totalUsd === 'number' ? item.totalUsd.toString() : item.totalUsd,
      }));

      const newSimulation = await storage.createBarterSimulation(validatedData, items);
      res.status(201).json(newSimulation);
    } catch (error) {
      console.error("Error creating simulation:", error);
      res.status(400).json({ error: "Invalid simulation data" });
    }
  });

  app.patch("/api/barter/simulations/:id", requireAuth, async (req, res) => {
    try {
      const simulation = await storage.getBarterSimulation(req.params.id);
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      if (simulation.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const updated = await storage.updateBarterSimulation(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update simulation" });
    }
  });

  app.delete("/api/barter/simulations/:id", requireAuth, async (req, res) => {
    try {
      const simulation = await storage.getBarterSimulation(req.params.id);
      if (!simulation) {
        return res.status(404).json({ error: "Simulation not found" });
      }
      if (simulation.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await storage.deleteBarterSimulation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete simulation" });
    }
  });

  app.get("/api/barter/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getAllBarterProducts();
      const activeProducts = products.filter(p => p.isActive);
      res.json(activeProducts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch barter products" });
    }
  });

  app.get("/api/barter/settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAllBarterSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch barter settings" });
      res.status(500).json({ error: "Failed to fetch kanban data" });
    }
  });

  // Summary Dashboard
  app.get("/api/planning/summary", requireAuth, async (req, res) => {
    const seasonId = req.query.seasonId as string;
    if (!seasonId) return res.status(400).json({ message: "seasonId is required" });

    try {
      const summary = await storage.getSalesPlanningSummary(req.user!.id, seasonId);
      res.json(summary);
    } catch (error) {
      console.error("[PLANNING_SUMMARY] Error:", error);
      res.status(500).json({ message: "Failed to fetch planning summary" });
    }
  });

  // GET /api/planning/:clientId -> Get specific client planning
  app.get("/api/planning/:clientId", requireAuth, async (req, res) => {
    const { clientId } = req.params;
    const seasonId = req.query.seasonId as string;
    if (!seasonId) return res.status(400).json({ message: "seasonId is required" });

    const result = await storage.getSalesPlanning(clientId, seasonId);
    if (!result) return res.json(null); // Not found -> empty planning for frontend to init
    res.json(result);
  });

  // Get category cards for Market Opportunity page
  app.get("/api/market-opportunity/category-cards/:seasonId", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userId = req.user.id;
      const { seasonId } = req.params;

      console.log(`[MARKET - CARDS] Fetching cards for Season: ${seasonId}, User: ${userId} `);

      // Get all categories
      let allCategories = await db.select().from(categories);

      // Rule: In "Milho" season, exclude "Sementes Soja"
      try {
        const currentSeason = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
        const seasonName = currentSeason[0]?.name || '';
        if (seasonName.toLowerCase().includes('milho')) {
          allCategories = allCategories.filter(c => !c.name.toLowerCase().includes('soja'));
        }
      } catch (err) {
        console.error('[MARKET-CARDS] Error filtering categories by season:', err);
      }

      // Get user's clients with badge amarelo (includeInMarketArea) ONLY - for market potential calculation
      // NOTE: 80/20 badge is for different purpose, not for market potential
      const clientsAmarelo = await db.select({
        id: userClientLinks.id,
        name: masterClients.name,
        userArea: userClientLinks.plantingArea,
        masterArea: masterClients.plantingArea
      })
        .from(userClientLinks)
        .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(and(
          eq(userClientLinks.userId, userId),
          eq(userClientLinks.includeInMarketArea, true)
        ));

      const clientAmareloIds = clientsAmarelo.map(c => c.id);

      // Get client market rates for potential calculation (badge amarelo only)
      let marketRates: any[] = [];
      try {
        if (clientAmareloIds.length > 0) {
          marketRates = await db.select()
            .from(clientMarketRates)
            .where(and(
              eq(clientMarketRates.userId, userId),
              eq(clientMarketRates.seasonId, seasonId),
              inArray(clientMarketRates.clientId, clientAmareloIds)
            ));
        }
      } catch (rateError) {
        console.error('[MARKET-CARDS] Error fetching market rates:', rateError);
        marketRates = [];
      }

      // Get Manager Team Rates (Potencial Geral) for Fallback
      let managerRatesMap = new Map<string, any>();
      try {
        const currentUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
        const managerId = currentUser[0]?.managerId || userId;
        const managerRates = await storage.getManagerTeamRates(managerId, seasonId);
        managerRates.forEach(r => managerRatesMap.set(r.categoryId, r));
        console.log(`[MARKET - CARDS] Found ${managerRates.length} manager team rates for manager ${managerId}`);
      } catch (mgrRateError) {
        console.error('[MARKET-CARDS] Error fetching manager rates:', mgrRateError);
      }

      // Get ALL sales (C.Vale) for this user, regardless of badge
      let salesData: any[] = [];
      try {
        salesData = await db.select({
          categoryId: sales.categoryId,
          totalAmount: sales.totalAmount,
          clientId: sales.clientId,
          saleDate: sales.saleDate
        })
          .from(sales)
          .where(and(
            eq(sales.userId, userId),
            eq(sales.seasonId, seasonId)
          ));
      } catch (salesError) {
        console.error('[MARKET-CARDS] Error fetching sales:', salesError);
        salesData = [];
      }

      console.log(`[MARKET - CARDS] User ${userId}: Found ${salesData.length} total sales`);

      // Calculate Monthly Sales for Chart
      const monthlySalesMap = new Array(12).fill(0);
      salesData.forEach((sale: typeof salesData[0]) => {
        try {
          if (sale.saleDate) {
            const date = new Date(sale.saleDate);
            const month = date.getMonth(); // 0 = Jan, 11 = Dec
            if (!isNaN(month) && month >= 0 && month <= 11) {
              monthlySalesMap[month] += parseFloat(sale.totalAmount || '0');
            }
          }
        } catch (e) {
          // Ignore individual sale error
        }
      });

      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      const monthlySales = monthlySalesMap.map((total: number, index: number) => ({
        month: monthNames[index],
        total: isNaN(total) ? 0 : total
      }));

      // Get ALL pipeline statuses (General Categories)
      let pipelineStatuses: any[] = [];
      try {
        pipelineStatuses = await db.select()
          .from(clientCategoryPipeline)
          .where(and(
            eq(clientCategoryPipeline.userId, userId),
            eq(clientCategoryPipeline.seasonId, seasonId)
          ));
      } catch (pipelineError) {
        console.error('[MARKET-CARDS] Error fetching pipeline statuses:', pipelineError);
        pipelineStatuses = [];
      }

      // Get ALL application tracking (Agroquimicos)
      let allApps: any[] = [];
      let validApps: any[] = [];
      try {
        allApps = await db.select({
          id: clientApplicationTracking.id,
          clientId: clientApplicationTracking.clientId,
          globalApplicationId: clientApplicationTracking.globalApplicationId,
          seasonId: clientApplicationTracking.seasonId,
          userId: clientApplicationTracking.userId,
          status: clientApplicationTracking.status,
          totalValue: clientApplicationTracking.totalValue,
          categoria: clientApplicationTracking.categoria,
          globalCategory: globalManagementApplications.categoria
        })
          .from(clientApplicationTracking)
          .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
          .where(and(
            eq(clientApplicationTracking.userId, userId),
            eq(clientApplicationTracking.seasonId, seasonId)
          ));

        // Safety: filter out any apps with missing critical data
        validApps = allApps.filter(app => {
          const hasCategoria = app.categoria || app.globalCategory;
          const hasClientId = app.clientId;
          return hasCategoria && hasClientId;
        });
      } catch (appError) {
        console.error('[MARKET-CARDS] Error fetching applications:', appError);
        // Continue with empty array if apps query fails
        validApps = [];
      }

      console.log(`[MARKET - CARDS] Pipeline Statuses: ${pipelineStatuses.length} `, pipelineStatuses.slice(0, 3));
      console.log(`[MARKET - CARDS] All Apps: ${allApps.length}, Valid Apps: ${validApps.length} `);

      // Helper to differentiate Agroquimicos
      const isAgroquimico = (type: string | null | undefined) => {
        if (!type) return false;
        const t = type.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return t === 'agroquimicos';
      };

      // Normalize category helper
      const normalizeCategoryName = (name: string | null | undefined): string => {
        if (!name) return 'Outros';
        const agroquimicoVariants = ['FUNGICIDAS', 'INSETICIDAS', 'DESSECAÇÃO', 'TRATAMENTO DE SEMENTE', 'TS'];
        if (agroquimicoVariants.includes(name.toUpperCase())) {
          return 'Agroquímicos';
        }
        return name;
      };

      const normalizeString = (str: any) => {
        if (!str) return "";
        return String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      };

      // Calculate data per category
      const categoryData = new Map<string, {
        categoryId: string;
        categoryName: string;
        categoryType: string;
        potentialUsd: number;
        potentialHa: number;
        cvaleUsd: number;       // Global Sales
        cvaleMarketUsd: number; // Market Badge Clients Sales
        oportunidadesUsd: number;
        jaNegociadoUsd: number;
      }>();

      // Client Breakdown Map: ClientID -> { clientName, categories: { [catId]: { potential, sales, ops, negotiated } } }
      const clientBreakdownMap = new Map<string, {
        clientId: string;
        clientName: string;
        categories: Map<string, {
          potentialUsd: number;
          salesUsd: number;
          oportunidadesUsd: number;
          jaNegociadoUsd: number;
        }>
      }>();


      // Initialize all categories
      allCategories.forEach(cat => {
        categoryData.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryType: cat.type,
          potentialUsd: 0,
          potentialHa: 0,
          cvaleUsd: 0,
          cvaleMarketUsd: 0,
          oportunidadesUsd: 0,
          jaNegociadoUsd: 0
        });
      });

      // Map Sales by Client -> Category
      const salesMap = new Map<string, Map<string, number>>();
      salesData.forEach(sale => {
        if (!sale.clientId) return;
        if (!salesMap.has(sale.clientId)) salesMap.set(sale.clientId, new Map());
        const clientSales = salesMap.get(sale.clientId)!;
        const current = clientSales.get(sale.categoryId!) || 0; // Use non-null assertion if safe or optional chaining
        // Safe check for categoryId
        if (sale.categoryId) {
          clientSales.set(sale.categoryId, current + parseFloat(sale.totalAmount || '0'));
        }
      });

      // Map Pipeline Status by Client -> Category
      const pipelineMap = new Map<string, Map<string, string>>();
      pipelineStatuses.forEach(p => {
        if (!pipelineMap.has(p.clientId)) pipelineMap.set(p.clientId, new Map());
        if (p.categoryId) { // Check existence
          pipelineMap.get(p.clientId)!.set(p.categoryId, p.status || 'ABERTO');
        }
      });
      console.log(`[MARKET - CARDS] Pipeline Map Keys(Clients): ${pipelineMap.size} `);

      // 0. Calculate Global Sales (C.Vale) - All clients, regardless of badge
      salesData.forEach(sale => {
        if (!sale.categoryId) return;
        const catData = categoryData.get(sale.categoryId);
        if (catData) {
          catData.cvaleUsd += parseFloat(sale.totalAmount || '0');
        }
      });

      // map market rates
      const ratesMap = new Map<string, Map<string, typeof marketRates[0]>>();
      marketRates.forEach(r => {
        if (!ratesMap.has(r.clientId)) ratesMap.set(r.clientId, new Map());
        ratesMap.get(r.clientId)!.set(r.categoryId, r);
      });

      // 1. Process General Categories (Fertilizers, Seeds, etc.)
      clientsAmarelo.forEach(client => {
        try {
          // Initialize client breakdown entry
          if (!clientBreakdownMap.has(client.id)) {
            clientBreakdownMap.set(client.id, {
              clientId: client.id,
              clientName: client.name || 'Unknown Client',
              categories: new Map()
            });
          }
          const clientEntry = clientBreakdownMap.get(client.id)!;

          allCategories.forEach(category => {
            const catData = categoryData.get(category.id);
            if (!catData) return;

            // Initialize category entry for client
            if (!clientEntry.categories.has(category.id)) {
              clientEntry.categories.set(category.id, {
                potentialUsd: 0,
                salesUsd: 0,
                oportunidadesUsd: 0,
                jaNegociadoUsd: 0
              });
            }
            const clientCatEntry = clientEntry.categories.get(category.id)!;

            const clientRate = ratesMap.get(client.id)?.get(category.id);
            const managerRate = managerRatesMap.get(category.id);

            // Calculate Potential - Use Client Rate if exists, otherwise fallback to Manager Rate
            let potentialValue = 0;
            let area = parseFloat(client.userArea || client.masterArea || '0');

            let investmentPerHa = 0;
            if (clientRate) {
              investmentPerHa = parseFloat(clientRate.investmentPerHa || '0') || 0;
            } else if (managerRate) {
              investmentPerHa = parseFloat(managerRate.investmentPerHa || '0') || 0;
            }

            if (!isNaN(investmentPerHa) && !isNaN(area) && area > 0) {
              potentialValue = area * investmentPerHa;
              if (!isNaN(potentialValue)) {
                catData.potentialUsd += potentialValue;
                catData.potentialHa += area;
                clientCatEntry.potentialUsd += potentialValue;
              }
            }

            // Sales for this specific client/category (for Residual calculation only)
            const clientSalesValue = salesMap.get(client.id)?.get(category.id) || 0;
            catData.cvaleMarketUsd += clientSalesValue;
            clientCatEntry.salesUsd += clientSalesValue;

            // Logic for Oportunidades / Já Negociado (General Categories Only)
            if (!isAgroquimico(catData.categoryType)) {
              const residual = Math.max(0, potentialValue - clientSalesValue);
              const status = pipelineMap.get(client.id)?.get(category.id);

              if (status === 'FECHADO') {
                catData.jaNegociadoUsd += residual;
                clientCatEntry.jaNegociadoUsd += residual;
              } else if (status === 'PARCIAL') {
                catData.jaNegociadoUsd += residual / 2;
                catData.oportunidadesUsd += residual / 2;
                clientCatEntry.jaNegociadoUsd += residual / 2;
                clientCatEntry.oportunidadesUsd += residual / 2;
              } else {
                // ABERTO or null
                catData.oportunidadesUsd += residual;
                clientCatEntry.oportunidadesUsd += residual;
              }
            }
          });
        } catch (err) {
          console.error('[MARKET-CARDS] Error processing client:', client.id, err);
        }
      });

      // 2. Process Agroquimicos via Application Tracking
      validApps.forEach(app => {
        try {
          // Map application categoria to main category (Agroquimicos)
          if (!app.categoria && !app.globalCategory) {
            return;
          }
          const normalizedName = normalizeCategoryName(app.categoria || app.globalCategory || '');
          const target = normalizeString(normalizedName);

          const category = allCategories.find(c => {
            return normalizeString(c.name) === target || normalizeString(c.type) === target;
          });

          if (category) {
            const catData = categoryData.get(category.id);

            if (catData && isAgroquimico(catData.categoryType)) {
              const clientEntry = clientBreakdownMap.get(app.clientId);

              if (clientEntry) {
                if (!clientEntry.categories.has(category.id)) {
                  clientEntry.categories.set(category.id, {
                    potentialUsd: 0,
                    salesUsd: 0,
                    oportunidadesUsd: 0,
                    jaNegociadoUsd: 0
                  });
                }
                const clientCatEntry = clientEntry.categories.get(category.id)!;

                const val = parseFloat(app.totalValue || '0');

                if (app.status === 'FECHADO') {
                  catData.jaNegociadoUsd += val;
                  clientCatEntry.jaNegociadoUsd += val;
                } else if (app.status === 'PARCIAL') {
                  catData.jaNegociadoUsd += val / 2;
                  catData.oportunidadesUsd += val / 2;
                  clientCatEntry.jaNegociadoUsd += val / 2;
                  clientCatEntry.oportunidadesUsd += val / 2;
                } else if (app.status === 'ABERTO' || !app.status) {
                  catData.oportunidadesUsd += val;
                  clientCatEntry.oportunidadesUsd += val;
                }
              }
            }
          }
        } catch (err) {
          console.error('[MARKET-CARDS] Error processing app:', app.id, err);
        }
      });

      // Build response
      const cards = Array.from(categoryData.values())
        .filter(cat => {
          const hasData = (cat.potentialUsd > 0 || cat.cvaleUsd > 0 || cat.oportunidadesUsd > 0 || cat.jaNegociadoUsd > 0);
          // Safety: ensure all values are valid numbers
          return hasData &&
            !isNaN(cat.potentialUsd) &&
            !isNaN(cat.cvaleUsd) &&
            !isNaN(cat.oportunidadesUsd) &&
            !isNaN(cat.jaNegociadoUsd);
        })
        .map(cat => {
          try {
            const totalCapturedUsd = (cat.cvaleUsd || 0) + (cat.jaNegociadoUsd || 0);
            const penetrationPercent = cat.potentialUsd > 0 && !isNaN(cat.potentialUsd)
              ? Math.min((totalCapturedUsd / cat.potentialUsd) * 100, 100)
              : 0;

            return {
              categoryId: cat.categoryId,
              categoryName: cat.categoryName || 'Unknown',
              categoryType: cat.categoryType || 'other',
              potentialUsd: isNaN(cat.potentialUsd) ? 0 : cat.potentialUsd,
              potentialHa: isNaN(cat.potentialHa) ? 0 : cat.potentialHa,
              cvaleUsd: isNaN(cat.cvaleUsd) ? 0 : cat.cvaleUsd,
              oportunidadesUsd: isNaN(cat.oportunidadesUsd) ? 0 : cat.oportunidadesUsd,
              jaNegociadoUsd: isNaN(cat.jaNegociadoUsd) ? 0 : cat.jaNegociadoUsd,
              totalCapturedUsd: isNaN(totalCapturedUsd) ? 0 : totalCapturedUsd,
              penetrationPercent: isNaN(penetrationPercent) ? 0 : penetrationPercent
            };
          } catch (cardError) {
            console.error('[MARKET-CARDS] Error building card for category:', cat.categoryId, cardError);
            return null;
          }
        })
        .filter((card): card is NonNullable<typeof card> => card !== null);

      // Convert Client Breakdown Map to Array
      const clientBreakdown = Array.from(clientBreakdownMap.values()).map(client => ({
        clientId: client.clientId,
        clientName: client.clientName,
        categories: Object.fromEntries(
          Array.from(client.categories.entries()).map(([catId, data]) => [catId, data])
        )
      }));


      // Calculate Segment Breakdown for Dashboard
      const segmentBreakdown = {
        agroquimicos: {
          total: 0,
          subcategories: {} as Record<string, number>,
          clients: [] as Array<{ id: string; name: string; value: number }>
        },
        fertilizantes: { total: 0, clients: [] as Array<{ id: string; name: string; value: number }> },
        sementes: { total: 0, clients: [] as Array<{ id: string; name: string; value: number }> },
        corretivos: { total: 0, clients: [] as Array<{ id: string; name: string; value: number }> },
        especialidades: { total: 0, clients: [] as Array<{ id: string; name: string; value: number }> }
      };

      // Helper to map client ID to Name
      const clientNameMap = new Map<string, string>();
      clientsAmarelo.forEach(c => clientNameMap.set(c.id, c.name));

      // 1. Agroquimicos Breakdown (from Applications)
      validApps.forEach(app => {
        try {
          if (!app.categoria && !app.globalCategory) {
            return;
          }
          let val = 0;
          const totalVal = parseFloat(app.totalValue || '0');

          if (app.status === 'ABERTO' || !app.status) {
            val = totalVal;
          } else if (app.status === 'PARCIAL') {
            val = totalVal / 2;
          }

          if (val > 0) {
            let subName = app.globalCategory || app.categoria || 'Outros';
            subName = subName.charAt(0).toUpperCase() + subName.slice(1).toLowerCase();

            segmentBreakdown.agroquimicos.total += val;
            segmentBreakdown.agroquimicos.subcategories[subName] = (segmentBreakdown.agroquimicos.subcategories[subName] || 0) + val;

            // Add to client list (aggregate if already exists)
            const clientName = clientNameMap.get(app.clientId) || 'Cliente Externo';
            const existingClient = segmentBreakdown.agroquimicos.clients.find(c => c.id === app.clientId);
            if (existingClient) {
              existingClient.value += val;
            } else {
              segmentBreakdown.agroquimicos.clients.push({ id: app.clientId, name: clientName, value: val });
            }
          }
        } catch (e) {
          // ignore segment error
        }
      });

      // Sort Agroquimicos clients descending
      segmentBreakdown.agroquimicos.clients.sort((a, b) => b.value - a.value);

      // 2. General Segments Breakdown (from ClientBreakdown)
      // We iterate clientBreakdown to get opportunities per client per category
      clientBreakdown.forEach(client => {
        Object.entries(client.categories).forEach(([catId, data]) => {
          if (data.oportunidadesUsd > 0) {
            const catData = categoryData.get(catId);
            if (catData) {
              const type = normalizeString(catData.categoryType);
              let targetSegment: keyof typeof segmentBreakdown | null = null;

              if (type.includes('fertilizante')) targetSegment = 'fertilizantes';
              else if (type.includes('semente')) targetSegment = 'sementes';
              else if (type.includes('corretivo')) targetSegment = 'corretivos';
              else if (type.includes('especialidade') || type.includes('foliar') || type.includes('biologico')) targetSegment = 'especialidades';

              if (targetSegment && targetSegment !== 'agroquimicos') {
                segmentBreakdown[targetSegment].total += data.oportunidadesUsd;
                segmentBreakdown[targetSegment].clients.push({
                  id: client.clientId,
                  name: client.clientName,
                  value: data.oportunidadesUsd
                });
              }
            }
          }
        });
      });

      // Sort clients for other segments
      (['fertilizantes', 'sementes', 'corretivos', 'especialidades'] as const).forEach(key => {
        segmentBreakdown[key].clients.sort((a, b) => b.value - a.value);
      });

      return res.json({
        cards,
        clientBreakdown,
        monthlySales,
        segmentBreakdown
      });

    } catch (error) {
      console.error('[MARKET-CARDS] Critical Error:', error);
      console.error('[MARKET-CARDS] Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
      return res.status(500).json({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  });

  // Update client potential for a specific category
  app.patch("/api/kanban/client-potential/:clientId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId } = req.params;
      const { segmento, investmentPerHa, seasonId } = req.body;

      if (!segmento || investmentPerHa === undefined || !seasonId) {
        return res.status(400).json({ error: "segmento, investmentPerHa, and seasonId are required" });
      }

      // Verificar se o cliente pertence ao usuário
      const [clientLink] = await db.select()
        .from(userClientLinks)
        .where(and(
          eq(userClientLinks.id, clientId),
          eq(userClientLinks.userId, userId)
        ))
        .limit(1);

      if (!clientLink) {
        return res.status(403).json({ error: "Access denied: client does not belong to user" });
      }

      // Buscar a categoria correspondente ao segmento
      const categoryData = await db.execute(sql`
        SELECT id FROM categories WHERE type = ${segmento} LIMIT 1
      `);

      if (categoryData.rows.length === 0) {
        return res.status(404).json({ error: "Category not found for segment" });
      }

      const categoryId = (categoryData.rows[0] as any).id;

      // Verificar se já existe um registro de taxa para este cliente/categoria/safra
      const existingRate = await db.select()
        .from(clientMarketRates)
        .where(and(
          eq(clientMarketRates.userId, userId),
          eq(clientMarketRates.clientId, clientId),
          eq(clientMarketRates.categoryId, categoryId),
          eq(clientMarketRates.seasonId, seasonId)
        ))
        .limit(1);

      if (existingRate.length > 0) {
        // Atualizar registro existente
        const [updated] = await db.update(clientMarketRates)
          .set({
            investmentPerHa: investmentPerHa.toString(),
            updatedAt: new Date()
          })
          .where(eq(clientMarketRates.id, existingRate[0].id))
          .returning();

        res.json(updated);
      } else {
        // Criar novo registro
        const [created] = await db.insert(clientMarketRates)
          .values({
            userId,
            clientId,
            categoryId,
            seasonId,
            investmentPerHa: investmentPerHa.toString()
          })
          .returning();

        res.json(created);
      }
    } catch (error) {
      console.error("Error updating client potential:", error);
      res.status(500).json({ error: "Failed to update client potential" });
    }
  });

  // Get consolidated client market data for Market Management Panel
  app.get("/api/client-market-panel/:clientId/:seasonId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId, seasonId } = req.params;

      // Verify client belongs to user and get client data INCLUDING badge status
      const clientData = await db.select({
        masterClientName: masterClients.name,
        masterClientArea: masterClients.plantingArea,
        userClientArea: userClientLinks.plantingArea,
        masterClientCreditLine: masterClients.creditLine,
        userClientLinkId: userClientLinks.id,
        isTop80_20: userClientLinks.isTop80_20,
        includeInMarketArea: userClientLinks.includeInMarketArea
      })
        .from(userClientLinks)
        .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(and(
          eq(userClientLinks.id, clientId),
          eq(userClientLinks.userId, userId)
        ))
        .limit(1);

      if (clientData.length === 0) {
        return res.status(403).json({ error: "Access denied: client does not belong to user" });
      }

      const client = clientData[0];
      const clientArea = parseFloat(client.userClientArea || client.masterClientArea || '0');
      const hasEligibleBadge = client.isTop80_20 || client.includeInMarketArea;

      // Get current and previous season
      const currentSeason = await db.select().from(seasons).where(eq(seasons.id, seasonId)).limit(1);
      if (currentSeason.length === 0) {
        return res.status(404).json({ error: "Season not found" });
      }

      // Get previous season (simple approach: get the season before the current one)
      const previousSeason = await db.select()
        .from(seasons)
        .where(sql`${seasons.name} <${currentSeason[0].name}`)
        .orderBy(desc(seasons.name))
        .limit(1);

      // Get sales for current season
      const currentSeasonSales = await db.select()
        .from(sales)
        .where(and(
          eq(sales.clientId, clientId),
          eq(sales.seasonId, seasonId),
          eq(sales.userId, userId)
        ));

      const currentSeasonTotal = currentSeasonSales.reduce((sum: number, sale: any) => {
        const amount = parseFloat(sale.totalAmount || '0') || 0;
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      // Get sales for previous season
      // IMPORTANTE:
      // Neste momento vamos ZERAR a safra anterior no painel,
      // pois existem dados históricos herdados do ambiente antigo
      // que não representam a realidade atual.
      // Quando quisermos voltar a considerar vendas de safra anterior,
      // podemos reativar o cálculo abaixo ou criar uma nova regra.
      let previousSeasonTotal = 0;
      // if (previousSeason.length > 0) {
      //   const previousSeasonSales = await db.select()
      //     .from(sales)
      //     .where(and(
      //       eq(sales.clientId, clientId),
      //       eq(sales.seasonId, previousSeason[0].id),
      //       eq(sales.userId, userId)
      //     ));
      //   previousSeasonTotal = previousSeasonSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount || '0'), 0);
      // }

      // IMPORTANT: Get MANAGER TEAM RATES for potential calculation (not per-client rates)
      // This uses the global rates set by the manager in the admin panel
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      const managerId = user[0]?.managerId || userId; // If consultant, use managerId. If manager, use self.

      let potentials: Array<{ categoryId: string; investmentPerHa: string; subcategories: any }> = [];

      // Only calculate potential if client has badge (80/20 OR Market)
      if (hasEligibleBadge && clientArea > 0) {
        const managerRates = await storage.getManagerTeamRates(managerId, seasonId);
        potentials = managerRates.map(rate => ({
          categoryId: rate.categoryId,
          investmentPerHa: rate.investmentPerHa || '0',
          subcategories: rate.subcategories
        }));
      }
      // If no badge or no area, potentials stays empty -> $0 potential

      // Get market values (clientMarketValues)
      const marketValues = await storage.getClientMarketValues(clientId, userId, seasonId);

      // Get pipeline data
      // Em alguns bancos (como produção antiga) a tabela client_category_pipeline pode não existir ainda.
      // Neste caso, tratamos como se não houvesse pipeline configurado e seguimos normalmente.
      let pipeline: any[] = [];
      try {
        pipeline = await storage.getClientCategoryPipeline(clientId, userId, seasonId);
        console.log(`[CLIENT - MARKET - PANEL] Fetched ${pipeline.length} pipeline records for client ${clientId}, season ${seasonId} `);
        if (pipeline.length > 0) {
          console.log(`[CLIENT - MARKET - PANEL] Pipeline records: `, JSON.stringify(pipeline, null, 2));
        }
      } catch (pipelineError: any) {
        console.error('[CLIENT-MARKET-PANEL] Error fetching pipeline:', pipelineError);
        const message = pipelineError?.message || String(pipelineError);
        if (message.includes('client_category_pipeline') || message.includes('relation "client_category_pipeline" does not exist')) {
          console.warn('[CLIENT-MARKET-PANEL] client_category_pipeline table missing, continuing with empty pipeline.');
          pipeline = [];
        } else {
          // Se for outro erro, relança para ser tratado pelo catch externo
          throw pipelineError;
        }
      }

      // Get C.Vale (vendas reais) by category
      const categoriesList = await db.select().from(categories);
      const productsList = await db.select().from(products);
      const productToCategory = new Map<string, string>();
      const productToName = new Map<string, string>();
      productsList.forEach(prod => {
        productToCategory.set(prod.id, prod.categoryId);
        productToName.set(prod.id, prod.name);
      });

      // Import product classifier for subcategory detection
      const { detectSubcategory } = await import("./product-classifier");

      // Map subcategory IDs to friendly names
      const subcategoryNames: Record<string, string> = {
        'sub-tratamento-sementes': 'Tratamento de semente',
        'sub-dessecacao': 'Dessecação',
        'sub-inseticidas': 'Inseticidas',
        'sub-fungicidas': 'Fungicidas'
      };

      const cValeByCategoryId: Record<string, { total: number; subcategories?: Record<string, number> }> = {};
      currentSeasonSales.forEach(sale => {
        try {
          const categoryId = productToCategory.get(sale.productId);
          const productName = productToName.get(sale.productId);
          const saleAmount = parseFloat(sale.totalAmount || '0') || 0;

          if (categoryId && !isNaN(saleAmount)) {
            if (!cValeByCategoryId[categoryId]) {
              cValeByCategoryId[categoryId] = { total: 0, subcategories: {} };
            }
            cValeByCategoryId[categoryId].total += saleAmount;

            // For Agroquímicos, also classify by subcategory
            if (categoryId === 'cat-agroquimicos' && productName) {
              try {
                const classification = detectSubcategory(productName);
                if (classification) {
                  const subcategoryName = subcategoryNames[classification.subcategoryId];
                  if (subcategoryName) {
                    if (!cValeByCategoryId[categoryId].subcategories) {
                      cValeByCategoryId[categoryId].subcategories = {};
                    }
                    cValeByCategoryId[categoryId].subcategories[subcategoryName] =
                      (cValeByCategoryId[categoryId].subcategories[subcategoryName] || 0) + saleAmount;
                  }
                }
              } catch (classifyError) {
                // Ignore classification errors
              }
            }
          }
        } catch (saleError) {
          console.error('[CLIENT-MARKET-PANEL] Error processing sale:', sale, saleError);
        }
      });

      // Get applications from Global Management
      // CRITICAL: Fetch ALL global applications for the season, then LEFT JOIN with client tracking
      let applications: any[] = [];
      try {
        const { clientApplicationTracking, globalManagementApplications, productsPriceTable } = await import("@shared/schema");

        applications = await db.select({
          globalAppId: globalManagementApplications.id,
          categoria: globalManagementApplications.categoria,
          applicationNumber: globalManagementApplications.applicationNumber,
          productName: productsPriceTable.mercaderia,
          pricePerHa: globalManagementApplications.pricePerHa,
          trackingId: clientApplicationTracking.id,
          trackingStatus: clientApplicationTracking.status,
          trackingTotalValue: clientApplicationTracking.totalValue
        })
          .from(globalManagementApplications)
          .innerJoin(productsPriceTable, eq(globalManagementApplications.productId, productsPriceTable.id))
          .leftJoin(clientApplicationTracking, and(
            eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id),
            eq(clientApplicationTracking.clientId, clientId),
            eq(clientApplicationTracking.seasonId, seasonId)
          ))
          .where(eq(globalManagementApplications.seasonId, seasonId))
          .orderBy(globalManagementApplications.categoria, globalManagementApplications.applicationNumber);
      } catch (appError) {
        console.error('[CLIENT-MARKET-PANEL] Error fetching applications:', appError);
        applications = [];
      }

      // GROUP products by categoria + applicationNumber (one application can have multiple products)
      const applicationsGrouped = new Map<string, {
        categoria: string;
        applicationNumber: number;
        products: Array<{
          globalApplicationId: string;
          productName: string;
          pricePerHa: number;
          totalValue: number;
          trackingId: string | null;
        }>;
        status: string | null;
      }>();

      applications.forEach(app => {
        try {
          if (!app.categoria || app.applicationNumber === undefined || app.applicationNumber === null) {
            console.warn('[CLIENT-MARKET-PANEL] Skipping app with missing categoria or applicationNumber:', app);
            return;
          }
          const key = `${app.categoria} -${app.applicationNumber} `;
          const clientArea = parseFloat(client.userClientArea || client.masterClientArea || '0') || 0;
          const pricePerHa = parseFloat(app.pricePerHa || '0') || 0;
          // ALWAYS calculate dynamically based on current client area
          // This ensures potential updates when area is changed
          const totalValue = (isNaN(pricePerHa) || isNaN(clientArea) ? 0 : pricePerHa * clientArea);

          if (!applicationsGrouped.has(key)) {
            applicationsGrouped.set(key, {
              categoria: app.categoria || 'Unknown',
              applicationNumber: app.applicationNumber,
              products: [],
              status: app.trackingStatus || null
            });
          }

          const group = applicationsGrouped.get(key)!;
          group.products.push({
            globalApplicationId: app.globalAppId || '',
            productName: app.productName || 'Unknown Product',
            pricePerHa: isNaN(pricePerHa) ? 0 : pricePerHa,
            totalValue: isNaN(totalValue) ? 0 : totalValue,
            trackingId: app.trackingId || null
          });
        } catch (appProcessError) {
          console.error('[CLIENT-MARKET-PANEL] Error processing application:', app, appProcessError);
        }
      });

      const applicationsData = Array.from(applicationsGrouped.values()).map(group => ({
        categoria: group.categoria,
        applicationNumber: group.applicationNumber,
        products: group.products,
        totalValue: group.products.reduce((sum, p) => sum + p.totalValue, 0),
        status: group.status
      }));

      res.json({
        season: {
          id: currentSeason[0].id,
          name: currentSeason[0].name
        },
        client: {
          id: clientId,
          name: client.masterClientName,
          area: parseFloat(client.userClientArea || client.masterClientArea || '0'),
          creditLine: client.masterClientCreditLine ? parseFloat(client.masterClientCreditLine) : null
        },
        sales: {
          currentSeason: currentSeasonTotal,
          previousSeason: previousSeasonTotal
        },
        potentials: potentials.map(p => ({
          categoryId: p.categoryId,
          investmentPerHa: parseFloat(p.investmentPerHa || '0'),
          subcategories: p.subcategories
        })),
        cVale: Object.entries(cValeByCategoryId).map(([categoryId, data]) => ({
          categoryId,
          value: data.total,
          subcategories: data.subcategories
        })),
        marketValues: marketValues.map(m => ({
          categoryId: m.categoryId,
          marketValue: parseFloat(m.marketValue || '0'),
          subcategories: m.subcategories
        })),
        pipeline: pipeline.map(p => ({
          categoryId: p.categoryId,
          status: p.status
        })),
        applications: applicationsData,
        categories: categoriesList.map(cat => ({
          id: cat.id,
          name: cat.name,
          type: cat.type
        }))
      });
    } catch (error) {
      console.error("[CLIENT-MARKET-PANEL] Critical Error:", error);
      console.error("[CLIENT-MARKET-PANEL] Error Stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({
        error: "Failed to fetch client market panel data",
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
      });
    }
  });

  // PATCH endpoint to update market values and credit line
  app.patch("/api/client-market-panel/:clientId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId } = req.params;
      const { creditLine, marketValues, applicationStatuses, pipelineStatuses, seasonId } = req.body;

      console.log("PATCH /api/client-market-panel RAW BODY:", JSON.stringify(req.body, null, 2));
      console.log("PATCH /api/client-market-panel", { clientId, userId, creditLine, seasonId });
      console.log("PATCH pipelineStatuses from body:", JSON.stringify(pipelineStatuses, null, 2));
      console.log("PATCH pipelineStatuses type:", typeof pipelineStatuses, "isArray:", Array.isArray(pipelineStatuses), "length:", pipelineStatuses?.length);

      // Verify client belongs to user and get masterClientId + area
      const clientData = await db.select({
        masterClientId: userClientLinks.masterClientId,
        masterClientArea: masterClients.plantingArea,
        userClientArea: userClientLinks.plantingArea
      })
        .from(userClientLinks)
        .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(and(
          eq(userClientLinks.id, clientId),
          eq(userClientLinks.userId, userId)
        ))
        .limit(1);

      if (clientData.length === 0) {
        console.log("Client not found or access denied", { clientId, userId });
        return res.status(403).json({ error: "Access denied: client does not belong to user" });
      }

      const { masterClientId, masterClientArea, userClientArea } = clientData[0];
      console.log("Found masterClientId:", masterClientId);

      // Update credit line on master client
      if (creditLine !== undefined) {
        console.log("Updating credit line to:", creditLine);
        await db.update(masterClients)
          .set({ creditLine: creditLine.toString() })
          .where(eq(masterClients.id, masterClientId));
        console.log("Credit line updated successfully");
      }

      // Update market values
      if (marketValues && Array.isArray(marketValues)) {
        for (const mv of marketValues) {
          await storage.upsertClientMarketValue({
            clientId,
            categoryId: mv.categoryId,
            userId,
            seasonId: seasonId || (await storage.getActiveSeason())?.id, // Fallback if seasonId not provided
            marketValue: mv.marketValue.toString(),
            subcategories: mv.subcategories
          });
        }
      }

      // Update pipeline statuses
      if (pipelineStatuses && Array.isArray(pipelineStatuses) && pipelineStatuses.length > 0) {
        try {
          console.log(`[CLIENT - MARKET - PANEL] Updating pipeline for client ${clientId}, season ${seasonId}, items: ${pipelineStatuses.length} `);
          console.log(`[CLIENT - MARKET - PANEL] Pipeline statuses payload: `, JSON.stringify(pipelineStatuses, null, 2));

          const finalSeasonId = seasonId || (await storage.getActiveSeason())?.id;
          if (!finalSeasonId) {
            console.error('[CLIENT-MARKET-PANEL] No seasonId available for pipeline update');
            return res.status(400).json({ error: "seasonId is required" });
          }

          for (const ps of pipelineStatuses) {
            // Filter out null statuses - if status is null, we should delete the record or set to ABERTO
            const finalStatus = ps.status === null ? 'ABERTO' : ps.status;

            console.log(`[CLIENT - MARKET - PANEL] Upserting pipeline: category = ${ps.categoryId}, status = ${finalStatus} (original: ${ps.status}), season = ${finalSeasonId} `);

            const result = await storage.upsertClientCategoryPipeline({
              clientId,
              categoryId: ps.categoryId,
              userId,
              seasonId: finalSeasonId,
              status: finalStatus
            });
            console.log(`[CLIENT - MARKET - PANEL] Pipeline upsert result: `, JSON.stringify(result, null, 2));
          }
          console.log(`[CLIENT - MARKET - PANEL] Successfully updated ${pipelineStatuses.length} pipeline statuses`);

        } catch (pipelineError: any) {
          console.error('[CLIENT-MARKET-PANEL] Pipeline update error:', pipelineError);
          console.error('[CLIENT-MARKET-PANEL] Error message:', pipelineError?.message);
          console.error('[CLIENT-MARKET-PANEL] Error stack:', pipelineError?.stack);
          const message = pipelineError?.message || String(pipelineError);
          if (message.includes('client_category_pipeline') || message.includes('relation \"client_category_pipeline\" does not exist')) {
            console.warn('[CLIENT-MARKET-PANEL] client_category_pipeline table missing on PATCH, skipping pipeline update.');
            // segue sem falhar a requisição — crédito e marketValues continuam sendo salvos
          } else {
            // Re-throw to fail the request so user knows something went wrong
            console.error('[CLIENT-MARKET-PANEL] Pipeline error is not about missing table, re-throwing');
            throw pipelineError;
          }
        }
      } else {
        console.log(`[CLIENT - MARKET - PANEL] No pipeline statuses to update(pipelineStatuses = ${pipelineStatuses}, length = ${pipelineStatuses?.length || 0})`);
      }

      // Update application statuses
      // Now using categoria-applicationNumber key (e.g., "FUNGICIDAS-2")
      if (applicationStatuses && Array.isArray(applicationStatuses)) {
        const { clientApplicationTracking, globalManagementApplications } = await import("@shared/schema");

        for (const appStatus of applicationStatuses) {
          // Parse the key "FUNGICIDAS-2" -> categoria: FUNGICIDAS, applicationNumber: 2
          const [categoria, appNumStr] = appStatus.id.split('-');
          const applicationNumber = parseInt(appNumStr, 10);

          // Get all global applications for this categoria + applicationNumber
          const globalApps = await db.select()
            .from(globalManagementApplications)
            .where(and(
              eq(globalManagementApplications.seasonId, seasonId),
              eq(globalManagementApplications.categoria, categoria),
              eq(globalManagementApplications.applicationNumber, applicationNumber)
            ));

          // Update or create tracking for each global application
          for (const globalApp of globalApps) {
            // Check if tracking exists
            const existing = await db.select()
              .from(clientApplicationTracking)
              .where(and(
                eq(clientApplicationTracking.clientId, clientId),
                eq(clientApplicationTracking.globalApplicationId, globalApp.id)
              ))
              .limit(1);

            if (existing.length > 0) {
              // Update existing
              await db.update(clientApplicationTracking)
                .set({ status: appStatus.status })
                .where(eq(clientApplicationTracking.id, existing[0].id));
            } else {
              // Create new tracking
              const clientArea = parseFloat(userClientArea || masterClientArea || '0');
              const pricePerHa = parseFloat(globalApp.pricePerHa || '0');
              const totalValue = pricePerHa * clientArea;

              // Map subcategory to main category
              const subcategoryToCategory: Record<string, string> = {
                'FUNGICIDAS': 'Agroquímicos',
                'INSETICIDAS': 'Agroquímicos',
                'TRATAMENTO_SEMENTE': 'Agroquímicos',
                'TRATAMENTO DE SEMENTE': 'Agroquímicos',
                'DESSECACAO': 'Agroquímicos',
                'DESSECAÇÃO': 'Agroquímicos',
              };
              const mainCategoria = subcategoryToCategory[globalApp.categoria.toUpperCase()] || globalApp.categoria;

              await db.insert(clientApplicationTracking)
                .values({
                  userId,
                  clientId,
                  seasonId,
                  globalApplicationId: globalApp.id,
                  categoria: mainCategoria,
                  applicationNumber: globalApp.applicationNumber,
                  totalValue: totalValue.toString(),
                  status: appStatus.status
                });
            }
          }
        }
      }

      console.log("PATCH completed successfully");
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating client market panel data:", error);
      res.status(500).json({ error: "Failed to update client market panel data", details: (error as Error).message });
    }
  });

  // Get sales targets for user
  app.get("/api/sales-targets", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const seasonId = req.query.seasonId as string | undefined;
      const targets = await storage.getSalesTargets(userId, seasonId);
      res.json(targets);
    } catch (error) {
      console.error("Error fetching sales targets:", error);
      res.status(500).json({ error: "Failed to fetch sales targets" });
    }
  });

  // Create a new sales target (capture opportunity)
  app.post("/api/sales-targets", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId, segmento, valorCapturado, seasonId, subcategories } = req.body;

      if (!clientId || !segmento || typeof valorCapturado !== 'number' || !seasonId) {
        return res.status(400).json({ error: "clientId, segmento, valorCapturado, and seasonId are required" });
      }

      const target = await storage.createSalesTarget(userId, clientId, segmento, valorCapturado, seasonId, subcategories);
      res.status(201).json(target);
    } catch (error) {
      console.error("Error creating sales target:", error);
      res.status(500).json({ error: "Failed to create sales target" });
    }
  });

  // Create multiple sales targets in batch (for multi-segment capture)
  app.post("/api/sales-targets/batch", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { targets, seasonId } = req.body;

      if (!Array.isArray(targets) || targets.length === 0 || !seasonId) {
        return res.status(400).json({ error: "targets array and seasonId are required" });
      }

      // Validate each target
      for (const target of targets) {
        if (!target.clientId || !target.segmento || typeof target.valorCapturado !== 'number') {
          return res.status(400).json({ error: "Each target must have clientId, segmento, and valorCapturado" });
        }
      }

      // Create all targets in a transaction-like manner
      const createdTargets = [];
      for (const target of targets) {
        const created = await storage.createSalesTarget(
          userId,
          target.clientId,
          target.segmento,
          target.valorCapturado,
          seasonId,
          target.subcategories
        );
        createdTargets.push(created);
      }

      res.status(201).json({ success: true, targets: createdTargets });
    } catch (error) {
      console.error("Error creating batch sales targets:", error);
      res.status(500).json({ error: "Failed to create batch sales targets" });
    }
  });

  // Update sales target
  app.patch("/api/sales-targets/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { valorCapturado, subcategories } = req.body;

      if (typeof valorCapturado !== 'number') {
        return res.status(400).json({ error: "valorCapturado is required" });
      }

      const updated = await storage.updateSalesTarget(id, valorCapturado, subcategories);
      res.json(updated);
    } catch (error) {
      console.error("Error updating sales target:", error);
      res.status(500).json({ error: "Failed to update sales target" });
    }
  });

  // Delete sales target (uncapture)
  app.delete("/api/sales-targets/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { salesTargets } = await import("@shared/schema");

      // Primeiro, buscar o target para pegar clientId e seasonId
      const [target] = await db.select()
        .from(salesTargets)
        .where(
          and(
            eq(salesTargets.id, id),
            eq(salesTargets.userId, userId)
          )
        )
        .limit(1);

      if (!target) {
        return res.status(404).json({ error: "Sales target not found" });
      }

      // Deletar tracking records associados a este cliente + temporada
      // Apenas para agroquímicos (que têm tracking de aplicações)
      if (target.segmento === 'agroquimicos') {
        console.log('[DELETE TARGET] Deletando tracking records para:', {
          clientId: target.clientId,
          seasonId: target.seasonId,
          userId,
          segmento: target.segmento
        });

        const result = await db.delete(clientApplicationTracking)
          .where(
            and(
              eq(clientApplicationTracking.clientId, target.clientId),
              eq(clientApplicationTracking.seasonId, target.seasonId),
              eq(clientApplicationTracking.userId, userId)
            )
          );

        console.log('[DELETE TARGET] Tracking records deletados:', result);
      }

      // Deletar o target
      await storage.deleteSalesTarget(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting sales target:", error);
      res.status(500).json({ error: "Failed to delete sales target" });
    }
  });

  // Get automatic market percentage calculation for each segment
  app.get("/api/market-percentage/:seasonId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { seasonId } = req.params;
      const { categories, products, clientApplicationTracking, globalManagementApplications, productsPriceTable, userClientLinks, masterClients } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");

      // Get categories to map categoryId -> segmento
      const categoriesList = await db.select().from(categories);
      const categoryToSegment = new Map<string, string>();
      categoriesList.forEach(cat => {
        categoryToSegment.set(cat.id, cat.type);
      });

      // Get market clients (includeInMarketArea=true) to filter sales
      const marketClientIds = await db.select({ id: userClientLinks.id })
        .from(userClientLinks)
        .where(and(
          eq(userClientLinks.userId, userId),
          eq(userClientLinks.includeInMarketArea, true)
        ));

      const marketClientIdList = marketClientIds.map(c => c.id);

      // Get sales ONLY from market clients
      const userSales = marketClientIdList.length > 0
        ? await db.select()
          .from(sales)
          .where(and(
            eq(sales.userId, userId),
            eq(sales.seasonId, seasonId),
            inArray(sales.clientId, marketClientIdList)
          ))
        : [];

      // Get all products to map productId -> categoryId
      const productsList = await db.select().from(products);
      const productToCategory = new Map<string, string>();
      productsList.forEach(prod => {
        productToCategory.set(prod.id, prod.categoryId);
      });

      // Aggregate sales by segment
      const salesBySegment: Record<string, number> = {
        fertilizantes: 0,
        agroquimicos: 0,
        especialidades: 0,
        sementes_soja: 0,
        corretivos: 0
      };

      userSales.forEach(sale => {
        const categoryId = productToCategory.get(sale.productId);
        if (categoryId) {
          const segmento = categoryToSegment.get(categoryId);
          if (segmento && salesBySegment.hasOwnProperty(segmento)) {
            salesBySegment[segmento] += parseFloat(sale.totalAmount || '0');
          }
        }
      });

      // Get FECHADAS applications (lost opportunities) for this user in this season
      const fechadasApplications = await db.select()
        .from(clientApplicationTracking)
        .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
        .leftJoin(productsPriceTable, eq(globalManagementApplications.productId, productsPriceTable.id))
        .leftJoin(userClientLinks, eq(clientApplicationTracking.clientId, userClientLinks.id))
        .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(and(
          eq(clientApplicationTracking.userId, userId),
          eq(clientApplicationTracking.seasonId, seasonId),
          eq(clientApplicationTracking.status, 'FECHADO')
        ));

      // Aggregate FECHADAS by segment (only agroquímicos)
      const fechadasBySegment: Record<string, number> = {
        fertilizantes: 0,
        agroquimicos: 0,
        especialidades: 0,
        sementes_soja: 0,
        corretivos: 0
      };

      fechadasApplications.forEach(app => {
        if (!app.client_application_tracking || !app.global_management_applications) return;

        const pricePerHa = parseFloat(app.global_management_applications.pricePerHa || '0');
        const plantingArea = app.master_clients ? parseFloat(app.master_clients.plantingArea || '0') : 0;
        const totalValue = pricePerHa * plantingArea;

        // All fechadas applications are agroquímicos
        fechadasBySegment.agroquimicos += totalValue;
      });

      // Get ALL client market rates for this user in this season (including all categories)
      // This gives us the TOTAL configured potential per segment
      // Only include clients marked as includeInMarketArea
      const allClientRates = await db.select()
        .from(clientMarketRates)
        .innerJoin(userClientLinks, eq(clientMarketRates.clientId, userClientLinks.id))
        .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(and(
          eq(userClientLinks.userId, userId),
          eq(clientMarketRates.seasonId, seasonId),
          eq(userClientLinks.includeInMarketArea, true)
        ));

      // Aggregate potential by segment
      // Potential = plantingArea * investmentPerHa for each client/category combination
      const potentialBySegment: Record<string, number> = {
        fertilizantes: 0,
        agroquimicos: 0,
        especialidades: 0,
        sementes_soja: 0,
        corretivos: 0
      };

      allClientRates.forEach(rate => {
        const marketRate = rate.client_market_rates;
        const client = rate.master_clients;
        const categoryId = marketRate.categoryId;
        const segmento = categoryToSegment.get(categoryId);

        if (segmento && potentialBySegment.hasOwnProperty(segmento)) {
          // Potential = plantingArea * investmentPerHa
          const plantingArea = parseFloat(client.plantingArea || '0');
          const investmentPerHa = parseFloat(marketRate.investmentPerHa || '0');
          const clientPotential = plantingArea * investmentPerHa;
          potentialBySegment[segmento] += clientPotential;
        }
      });

      // Calculate percentage for each segment: (sales + fechadas) / potential * 100
      const percentageBySegment: Record<string, number> = {};

      Object.keys(salesBySegment).forEach(segmento => {
        const totalRealized = salesBySegment[segmento] + fechadasBySegment[segmento];
        const potential = potentialBySegment[segmento];

        if (potential > 0) {
          percentageBySegment[segmento] = (totalRealized / potential) * 100;
        } else {
          percentageBySegment[segmento] = 0;
        }
      });

      res.json(percentageBySegment);
    } catch (error) {
      console.error('Get market percentage error:', error);
      res.status(500).json({ error: "Failed to calculate market percentage" });
    }
  });

  // Get client sales history by category (for showing in capture modal)
  app.get("/api/client-sales-history/:clientId/:categoryId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId, categoryId } = req.params;
      const currentSeasonId = req.query.seasonId as string;
      const { sales: salesTable, products, seasons, categories: categoriesTable } = await import("@shared/schema");
      const { and, desc, inArray, lt } = await import("drizzle-orm");

      if (!currentSeasonId) {
        return res.status(400).json({ error: "seasonId is required" });
      }

      // Get all products for this category
      const categoryProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.categoryId, categoryId));

      const productIds = categoryProducts.map(p => p.id);

      if (productIds.length === 0) {
        return res.json({ totalSales: 0, lastSeasonName: null, lastSeasonSales: 0 });
      }

      // Get current season to find its type
      const currentSeasonResult = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, currentSeasonId))
        .limit(1);

      if (currentSeasonResult.length === 0) {
        return res.json({ totalSales: 0, lastSeasonName: null, lastSeasonSales: 0 });
      }

      const currentSeason = currentSeasonResult[0];

      // Get all seasons of the same type with year less than current
      const previousSeasons = await db
        .select()
        .from(seasons)
        .where(and(
          eq(seasons.type, currentSeason.type),
          lt(seasons.year, currentSeason.year)
        ))
        .orderBy(desc(seasons.year))
        .limit(1);

      if (previousSeasons.length === 0) {
        return res.json({ totalSales: 0, lastSeasonName: null, lastSeasonSales: 0 });
      }

      const lastSeason = previousSeasons[0];

      // Get sales for this client in this category in the last season
      const clientSales = await db
        .select()
        .from(salesTable)
        .where(and(
          eq(salesTable.userId, userId),
          eq(salesTable.clientId, clientId),
          eq(salesTable.seasonId, lastSeason.id),
          inArray(salesTable.productId, productIds)
        ));

      // Calculate total
      const lastSeasonSales = clientSales.reduce((sum, sale) => {
        return sum + parseFloat(sale.totalAmount || '0');
      }, 0);

      res.json({
        totalSales: lastSeasonSales,
        lastSeasonName: lastSeason.name,
        lastSeasonSales: lastSeasonSales
      });
    } catch (error) {
      console.error("Error fetching client sales history:", error);
      res.status(500).json({ error: "Failed to fetch sales history" });
    }
  });

  // Get detailed product sales history (for modal)
  app.get("/api/client-sales-history-details/:clientId/:categoryId", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId, categoryId } = req.params;
      const currentSeasonId = req.query.seasonId as string;
      const { sales: salesTable, products, seasons } = await import("@shared/schema");
      const { and, desc, inArray, lt } = await import("drizzle-orm");

      if (!currentSeasonId) {
        return res.status(400).json({ error: "seasonId is required" });
      }

      // Get all products for this category
      const categoryProducts = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.categoryId, categoryId));

      const productIds = categoryProducts.map(p => p.id);

      if (productIds.length === 0) {
        return res.json({ sales: [], lastSeasonName: null });
      }

      // Get current season to find its type
      const currentSeasonResult = await db
        .select()
        .from(seasons)
        .where(eq(seasons.id, currentSeasonId))
        .limit(1);

      if (currentSeasonResult.length === 0) {
        return res.json({ sales: [], lastSeasonName: null });
      }

      const currentSeason = currentSeasonResult[0];

      // Get all seasons of the same type with year less than current
      const previousSeasons = await db
        .select()
        .from(seasons)
        .where(and(
          eq(seasons.type, currentSeason.type),
          lt(seasons.year, currentSeason.year)
        ))
        .orderBy(desc(seasons.year))
        .limit(1);

      if (previousSeasons.length === 0) {
        return res.json({ sales: [], lastSeasonName: null });
      }

      const lastSeason = previousSeasons[0];

      // Get sales with product details
      const clientSales = await db
        .select({
          saleId: salesTable.id,
          productName: products.name,
          quantity: salesTable.quantity,
          totalAmount: salesTable.totalAmount,
        })
        .from(salesTable)
        .innerJoin(products, eq(salesTable.productId, products.id))
        .where(and(
          eq(salesTable.userId, userId),
          eq(salesTable.clientId, clientId),
          eq(salesTable.seasonId, lastSeason.id),
          inArray(salesTable.productId, productIds)
        ));

      res.json({
        sales: clientSales,
        lastSeasonName: lastSeason.name
      });
    } catch (error) {
      console.error("Error fetching client sales history details:", error);
      res.status(500).json({ error: "Failed to fetch sales history details" });
    }
  });

}
