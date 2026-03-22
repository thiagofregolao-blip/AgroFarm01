import type { Express } from "express";
import { storage } from "./storage";
import { insertSaleSchema, insertClientSchema, insertCategorySchema, insertProductSchema, insertSeasonGoalSchema, insertSeasonSchema, insertExternalPurchaseSchema, insertClientFamilyRelationSchema, insertAlertSettingsSchema, insertAlertSchema, insertPurchaseHistorySchema, insertPurchaseHistoryItemSchema, subcategories, clients, sales, seasons, seasonGoals, categories, products, clientMarketRates, externalPurchases, purchaseHistory, marketBenchmarks, userClientLinks, masterClients, salesHistory, clientFamilyRelations, purchaseHistoryItems, users } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { importExcelFile, importClientsFromExcel } from "./import-excel";
import { requireAuth, requireSuperAdmin, requireManager } from "./auth";
import { db } from "./db";
import { eq, sql, and, inArray, or, sum, count } from "drizzle-orm";
import { parseCVALEPDF } from "./parse-cvale-pdf";

export function registerCrmRoutes(app: Express) {
  const upload = multer({ storage: multer.memoryStorage() });

  // Categories
  app.get("/api/categories", requireAuth, async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", requireSuperAdmin, async (req, res) => {
    try {
      const category = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(category);
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });

  // Subcategories
  app.get("/api/subcategories", requireAuth, async (req, res) => {
    try {
      const { categoryId } = req.query;

      if (categoryId) {
        const subs = await db.select()
          .from(subcategories)
          .where(eq(subcategories.categoryId, categoryId as string))
          .orderBy(subcategories.displayOrder);
        return res.json(subs);
      }

      const allSubs = await db.select()
        .from(subcategories)
        .orderBy(subcategories.categoryId, subcategories.displayOrder);
      res.json(allSubs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subcategories" });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const { categoryId } = req.query;
      const products = categoryId
        ? await storage.getProductsByCategory(categoryId as string)
        : await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.post("/api/products", requireSuperAdmin, async (req, res) => {
    try {
      const product = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(product);
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  app.patch("/api/products/:id", requireSuperAdmin, async (req, res) => {
    try {
      const existingProduct = await storage.getAllProducts().then(products =>
        products.find(p => p.id === req.params.id)
      );

      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      const categories = await storage.getAllCategories();
      const currentCategory = categories.find(c => c.id === existingProduct.categoryId);
      const targetCategoryId = req.body.categoryId || existingProduct.categoryId;
      const targetCategory = categories.find(c => c.id === targetCategoryId);

      const updateData = { ...req.body };

      const isCurrentlyAgro = currentCategory?.type === 'agroquimicos';
      const willBeAgro = targetCategory?.type === 'agroquimicos';

      if (isCurrentlyAgro && existingProduct.segment) {
        if ('segment' in req.body && !req.body.segment) {
          return res.status(400).json({ error: "Cannot clear segment for existing agrochemical products" });
        }
        if (!('segment' in req.body)) {
          updateData.segment = existingProduct.segment;
        }
      }

      if (willBeAgro) {
        const finalSegment = 'segment' in updateData ? updateData.segment : existingProduct.segment;
        if (!finalSegment) {
          return res.status(400).json({ error: "Segment is required for agrochemical products" });
        }
      }

      const updated = await storage.updateProduct(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.post("/api/products/auto-populate-segments", requireSuperAdmin, async (req, res) => {
    try {
      const detectAgrochemicalSegment = (productName: string): string => {
        const name = productName.toLowerCase();

        if (name.includes('tratamento') || name.includes('seed treatment') || name.startsWith('ts ') ||
          name.includes(' ts ') || name.endsWith(' ts') || /\bts\b/.test(name) ||
          name.includes('fipronil') || name.includes('tiabendazol')) {
          return 'ts';
        }

        if (name.includes('fungicida') || name.includes('azoxistrobina') || name.includes('tebuconazol') ||
          name.includes('trifloxistrobina') || name.includes('piraclostrobina') || name.includes('protioconazol') ||
          name.includes('mancozeb') || name.includes('fluxapiroxade') || name.includes('carbendazim')) {
          return 'fungicida';
        }

        if (name.includes('inseticida') || name.includes('imidacloprid') || name.includes('lambda') ||
          name.includes('cipermetrina') || name.includes('clorantraniliprole') || name.includes('tiametoxam') ||
          name.includes('metoxifenozida') || name.includes('ciantraniliprole')) {
          return 'inseticida';
        }

        if (name.includes('herbicida') || name.includes('glifosato') || name.includes('paraquat') ||
          name.includes('atrazina') || name.includes('2,4-d') || name.includes('dicamba') ||
          name.includes('imazetapir') || name.includes('haloxifop') || name.includes('glufosinato') ||
          name.includes('fluroxipir') || name.includes('imazapir')) {
          return 'herbicida';
        }

        return 'outros';
      };

      const allProducts = await storage.getAllProducts();
      const categories = await storage.getAllCategories();
      const agrochemicalCategory = categories.find(c => c.type === 'agroquimicos');

      if (!agrochemicalCategory) {
        return res.status(404).json({ error: "Agrochemical category not found" });
      }

      let updatedCount = 0;
      for (const product of allProducts) {
        if (product.categoryId === agrochemicalCategory.id && !product.segment) {
          const segment = detectAgrochemicalSegment(product.name);
          await storage.updateProduct(product.id, { segment });
          updatedCount++;
        }
      }

      res.json({ message: `Auto - populated segments for ${updatedCount} products` });
    } catch (error) {
      res.status(500).json({ error: "Failed to auto-populate segments" });
    }
  });

  app.post("/api/products/process-soja-spreadsheet", requireSuperAdmin, async (req, res) => {
    try {
      const allProducts = await storage.getAllProducts();
      const categories = await storage.getAllCategories();
      const agrochemicalCategory = categories.find(c => c.type === 'agroquimicos');

      if (!agrochemicalCategory) {
        return res.status(404).json({ error: "Agrochemical category not found" });
      }

      const spreadsheetData = {
        'subcat-ts': ['RIZOSPIRILUM', 'VITAGROW TS', 'RIZOLIQ TOP', 'DERMACOR', 'CLORANTE 62', 'HURACAN', 'MAXIN RFC', 'CROPSTAR', 'RANCONA', 'EVERGOL', 'RIZODERMA MAX'],
        'subcat-dessecacao': ['2,4 D AMINA', '2,4 D Amina', 'CLETODIN 24%', 'CLOMAZERB 48', 'CONFIRM', 'APRESA', 'FLUMITOP', 'FOMEFLAG', 'GLIFOSATO 60,8%', 'GLIFOSATO 60.8%', 'TECNUP PREMIUM 2', 'TECNUP XTRA', 'GLUFOSINATO 40', 'GLUFOSEC P40', 'PIXXARO', 'TEXARO', 'VERDICT ULTRA', 'ZETAPIR', 'PARAQUAT 24%', 'SAFLUNEX', 'STRIM', 'SUNZONE XTRA', 'TRICLON'],
        'subcat-inseticidas': ['LASCAR', 'PERITO ULTRA', 'ABAMEC 8,4', 'ABAMEC 8.4', 'BATTUS GOLD', 'ACEGOAL XTRA', 'AGUILA', 'MONITOR 30%', 'BULLDOCK', 'TOXATRIM', 'FENTHRIN 40', 'GALIL', 'AMPLIGO', 'CLORANTE WG', 'OVERTOP', 'CLORPIRIFOS NORTOX', 'OBERON', 'CRICKET WG', 'FULMINANTE 80WG', 'BELT', 'CAYENNE', 'LOYER', 'CORAZA', 'POINT 5', 'METOMYL 90%', 'INTREPID', 'PIRY PANDA', 'EXALT', 'QUINTAL XTRA', 'EXPEDITION', 'SOYGUARD', 'THIODICARB 80 WP', 'ONLY 60', 'THIAMEXPLANT', 'ONLY 75', 'ALSYSTIN'],
        'subcat-fungicidas': ['VESSARYA', 'CLOROTALONIL 72%', 'ARMERO', 'MURALLA', 'VIOVAN', 'APROACH PRIMA', 'APROACH POWER', 'AZIMUT', 'DANKE', 'ZAFIRO 43', 'WETTER', 'CRIPTON XPRO SC', 'CRIPTON XPRO', 'NATIVO', 'CRIPTON SC']
      };

      const segmentMap: Record<string, string> = {
        'subcat-ts': 'ts',
        'subcat-dessecacao': 'herbicida',
        'subcat-inseticidas': 'inseticida',
        'subcat-fungicidas': 'fungicida'
      };

      const normalizeProductName = (name: string): string => {
        return name
          .toUpperCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^A-Z0-9]/g, '')
          .trim();
      };

      const results = {
        updated: [] as Array<{ id: string; name: string; subcategory: string; segment: string }>,
        notFound: [] as Array<{ name: string; subcategory: string }>
      };

      for (const [subcategoryId, productNames] of Object.entries(spreadsheetData)) {
        const segment = segmentMap[subcategoryId];

        for (const spreadsheetName of productNames) {
          const normalizedSpreadsheetName = normalizeProductName(spreadsheetName);

          const matchedProduct = allProducts.find(p => {
            if (p.categoryId !== agrochemicalCategory.id) return false;
            const normalizedDbName = normalizeProductName(p.name);
            return normalizedDbName.includes(normalizedSpreadsheetName) ||
              normalizedSpreadsheetName.includes(normalizedDbName);
          });

          if (matchedProduct) {
            await storage.updateProduct(matchedProduct.id, {
              subcategoryId,
              segment
            });
            results.updated.push({
              id: matchedProduct.id,
              name: matchedProduct.name,
              subcategory: subcategoryId,
              segment
            });
          } else {
            results.notFound.push({
              name: spreadsheetName,
              subcategory: subcategoryId
            });
          }
        }
      }

      res.json({
        success: true,
        totalProcessed: results.updated.length + results.notFound.length,
        updated: results.updated.length,
        notFound: results.notFound.length,
        details: results
      });
    } catch (error) {
      console.error("Error processing SOJA spreadsheet:", error);
      res.status(500).json({ error: "Failed to process spreadsheet" });
    }
  });

  // Regions
  app.get("/api/regions", async (req, res) => {
    try {
      const regions = await storage.getAllRegions();
      res.json(regions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch regions" });
    }
  });

  // Clients
  app.get("/api/clients", requireAuth, async (req, res) => {
    try {
      const { top8020 } = req.query;
      // Todos os usuários veem apenas seus próprios clientes via user_client_links
      const clients = await storage.getClientsForUser(req.user!.id, top8020 === "true");
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.post("/api/clients", requireAuth, async (req, res) => {
    try {
      const clientData = insertClientSchema.parse(req.body);
      // Forçar userId do usuário autenticado
      const client = { ...clientData, userId: req.user!.id };
      const newClient = await storage.createClient(client);
      res.status(201).json(newClient);
    } catch (error) {
      res.status(400).json({ error: "Invalid client data" });
    }
  });

  app.patch("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verificar se o cliente pertence ao usuário
      const existingClient = await storage.getClient(id);
      if (!existingClient) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (existingClient.userId !== userId) {
        return res.status(403).json({ error: "Não autorizado a editar este cliente" });
      }

      const updates = req.body;
      const updatedClient = await storage.updateClient(id, updates);

      // Se acabou de marcar como 80/20, aplicar potenciais gerais automaticamente
      if (updates.isTop80_20 === true && !existingClient.isTop80_20) {
        const { seasons, userClientLinks, clientMarketRates } = await import("@shared/schema");
        const { inArray, ne } = await import("drizzle-orm");

        // Buscar safra ativa
        const activeSeasons = await db.select()
          .from(seasons)
          .where(eq(seasons.isActive, true))
          .limit(1);

        if (activeSeasons.length > 0) {
          const activeSeason = activeSeasons[0];

          // Buscar outros clientes 80/20 do mesmo usuário (excluindo o cliente atual)
          const otherTop8020Clients = await db.select()
            .from(userClientLinks)
            .where(and(
              eq(userClientLinks.userId, userId),
              eq(userClientLinks.isTop80_20, true),
              eq(userClientLinks.isActive, true),
              ne(userClientLinks.id, id) // Excluir o cliente atual
            ));

          if (otherTop8020Clients.length > 0) {
            const otherClientIds = otherTop8020Clients.map(c => c.id);

            // Buscar potenciais gerais existentes de outros clientes 80/20 nesta safra
            const existingRates = await db.select()
              .from(clientMarketRates)
              .where(and(
                eq(clientMarketRates.userId, userId),
                inArray(clientMarketRates.clientId, otherClientIds),
                eq(clientMarketRates.seasonId, activeSeason.id)
              ));

            if (existingRates.length > 0) {
              // Agrupar por categoryId e pegar o valor mais comum (moda)
              const ratesByCategory = new Map<string, string[]>();
              existingRates.forEach(rate => {
                if (!ratesByCategory.has(rate.categoryId)) {
                  ratesByCategory.set(rate.categoryId, []);
                }
                ratesByCategory.get(rate.categoryId)!.push(rate.investmentPerHa);
              });

              // Para cada categoria, copiar o potencial geral para o novo cliente 80/20
              for (const [categoryId, investmentValues] of Array.from(ratesByCategory.entries())) {
                // Usar o valor mais frequente (ou o primeiro se houver empate)
                const investmentPerHa = investmentValues[0];

                // Verificar se já existe rate para este cliente/categoria/safra
                const existing = await db.select()
                  .from(clientMarketRates)
                  .where(and(
                    eq(clientMarketRates.userId, userId),
                    eq(clientMarketRates.clientId, id),
                    eq(clientMarketRates.categoryId, categoryId),
                    eq(clientMarketRates.seasonId, activeSeason.id)
                  ))
                  .limit(1);

                if (existing.length === 0) {
                  // Criar novo potencial para este cliente
                  await db.insert(clientMarketRates).values({
                    userId,
                    clientId: id,
                    categoryId,
                    seasonId: activeSeason.id,
                    investmentPerHa
                  });
                }
              }
            }
          }
        }
      }

      res.json(updatedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      res.status(400).json({ error: "Invalid update data" });
    }
  });

  app.delete("/api/clients/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Verificar se o cliente pertence ao usuário
      const existingClient = await storage.getClient(id);
      if (!existingClient) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (existingClient.userId !== req.user!.id) {
        return res.status(403).json({ error: "Não autorizado a deletar este cliente" });
      }

      const deleted = await storage.deleteClient(id);

      res.json({ success: true, message: "Client deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // Import clients from Excel
  const clientUpload = multer({ storage: multer.memoryStorage() });

  app.post("/api/clients/import", requireAuth, clientUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const vendedorId = req.body.vendedorId || req.user!.id;
      const result = await importClientsFromExcel(req.file.buffer, vendedorId);

      if (!result.success && result.errors.length > 0) {
        return res.status(400).json({
          message: result.errors[0],
          created: result.created,
          updated: result.updated,
          errors: result.errors
        });
      }

      res.json({
        success: result.success,
        created: result.created,
        updated: result.updated,
        message: `Importação concluída: ${result.created} clientes criados, ${result.updated} atualizados`
      });
    } catch (error) {
      console.error("Error importing clients:", error);
      res.status(500).json({ error: "Failed to import clients" });
    }
  });

  // Client Family Relations
  app.get("/api/clients/:id/family", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const relatedClientIds = await storage.getClientFamilyRelations(id, req.user!.id);
      res.json(relatedClientIds);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch family relations" });
    }
  });

  // Batch endpoint for family relations
  app.post("/api/clients/family/batch", requireAuth, async (req, res) => {
    try {
      const { clientIds } = req.body;
      if (!Array.isArray(clientIds)) {
        return res.status(400).json({ error: "clientIds must be an array" });
      }

      const relationsMap = await storage.getBatchClientFamilyRelations(clientIds, req.user!.id);

      // Convert Map to object for JSON serialization
      const result: Record<string, string[]> = {};
      relationsMap.forEach((value, key) => {
        result[key] = value;
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching batch family relations:", error);
      res.status(500).json({ error: "Failed to fetch batch family relations" });
    }
  });

  app.post("/api/clients/:id/family", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { relatedClientId } = req.body;

      const relation = insertClientFamilyRelationSchema.parse({
        clientId: id,
        relatedClientId,
        userId: req.user!.id
      });

      const newRelation = await storage.addClientFamilyRelation(relation);
      res.status(201).json(newRelation);
    } catch (error) {
      res.status(400).json({ error: "Invalid family relation data" });
    }
  });

  app.delete("/api/clients/:id/family/:relatedId", requireAuth, async (req, res) => {
    try {
      const { id, relatedId } = req.params;
      const deleted = await storage.removeClientFamilyRelation(id, relatedId, req.user!.id);

      if (!deleted) {
        return res.status(404).json({ error: "Family relation not found" });
      }

      res.json({ success: true, message: "Family relation removed successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove family relation" });
    }
  });

  // Seasons
  app.get("/api/seasons", async (req, res) => {
    try {
      const seasons = await storage.getAllSeasons();
      res.json(seasons);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch seasons" });
    }
  });

  app.get("/api/seasons/active", async (req, res) => {
    try {
      const activeSeason = await storage.getActiveSeason();
      res.json(activeSeason);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active season" });
    }
  });

  app.post("/api/seasons", async (req, res) => {
    try {
      console.log("[DEBUG] POST /api/seasons - Request body:", JSON.stringify(req.body, null, 2));

      // Coerce date strings to Date objects
      const bodyWithDates = {
        ...req.body,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      };

      const season = insertSeasonSchema.parse(bodyWithDates);
      const newSeason = await storage.createSeason(season);
      res.status(201).json(newSeason);
    } catch (error) {
      console.log("[DEBUG] POST /api/seasons - Validation error:", error);
      res.status(400).json({ error: "Invalid season data", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Season Goals
  app.get("/api/season-goals", requireAuth, async (req, res) => {
    try {
      const allGoals = await storage.getAllSeasonGoals();
      // Cada usuário vê apenas suas próprias metas
      const userGoals = allGoals.filter(goal => goal.userId === req.user!.id);
      res.json(userGoals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch season goals" });
    }
  });

  app.get("/api/season-goals/:seasonId", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.params;
      // Always use authenticated user's ID, never accept userId from params
      const goal = await storage.getSeasonGoal(seasonId, req.user!.id);
      res.json(goal);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch season goal" });
    }
  });

  app.post("/api/season-goals", requireAuth, async (req, res) => {
    try {
      const goalData = insertSeasonGoalSchema.parse(req.body);
      // Override userId with authenticated user's ID for security
      const goal = { ...goalData, userId: req.user!.id };
      const newGoal = await storage.createSeasonGoal(goal);
      res.status(201).json(newGoal);
    } catch (error) {
      res.status(400).json({ error: "Invalid goal data" });
    }
  });

  app.patch("/api/season-goals/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId: _, ...updates } = req.body;

      // Verify the goal belongs to the authenticated user
      const allGoals = await storage.getAllSeasonGoals();
      const existingGoal = allGoals.find(g => g.id === id);

      if (!existingGoal) {
        return res.status(404).json({ error: "Season goal not found" });
      }

      if (existingGoal.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to update this goal" });
      }

      const updatedGoal = await storage.updateSeasonGoal(id, updates);
      res.json(updatedGoal);
    } catch (error) {
      res.status(400).json({ error: "Failed to update season goal" });
    }
  });

  app.delete("/api/season-goals/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Verify the goal belongs to the authenticated user
      const allGoals = await storage.getAllSeasonGoals();
      const existingGoal = allGoals.find(g => g.id === id);

      if (!existingGoal) {
        return res.status(404).json({ error: "Season goal not found" });
      }

      if (existingGoal.userId !== req.user!.id) {
        return res.status(403).json({ error: "Not authorized to delete this goal" });
      }

      const deleted = await storage.deleteSeasonGoal(id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Season goal not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete season goal" });
    }
  });

  // Sales
  app.get("/api/sales", requireAuth, async (req, res) => {
    try {
      const { clientId, seasonId } = req.query;
      let sales;

      if (clientId) {
        sales = await storage.getSalesByClient(clientId as string);
      } else if (seasonId) {
        sales = await storage.getSalesBySeason(seasonId as string);
      } else {
        sales = await storage.getAllSales();
      }

      // Cada usuário vê apenas suas próprias vendas
      sales = sales.filter(sale => sale.userId === req.user!.id);

      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.post("/api/sales", requireAuth, async (req, res) => {
    try {
      const saleData = insertSaleSchema.parse(req.body);
      // Override userId with authenticated user's ID for security
      const sale = { ...saleData, userId: req.user!.id };
      const newSale = await storage.createSale(sale);
      res.status(201).json(newSale);
    } catch (error) {
      res.status(400).json({ error: "Invalid sale data" });
    }
  });

  app.patch("/api/sales/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { userId: _, ...updates } = req.body; // Remove userId from updates to prevent ownership change

      // First verify the sale belongs to the authenticated user
      const existingSale = await storage.getSale(id);
      if (!existingSale) {
        return res.status(404).json({ error: "Sale not found" });
      }
      if (existingSale.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden: Cannot edit another user's sale" });
      }

      // Convert date strings to Date objects
      const processedUpdates: any = { ...updates };

      // Convert all timestamp fields
      if (processedUpdates.dueDate) {
        processedUpdates.dueDate = new Date(processedUpdates.dueDate);
      }
      if (processedUpdates.saleDate) {
        processedUpdates.saleDate = new Date(processedUpdates.saleDate);
      }

      const updatedSale = await storage.updateSale(id, processedUpdates);
      res.json(updatedSale);
    } catch (error) {
      console.error("Error updating sale:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid update data" });
    }
  });

  app.patch("/api/sales/barter/:clientId/manual-commission", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;

      // Validate commission amount with Zod
      const commissionSchema = z.object({
        commissionAmount: z.number().min(0, "Commission amount must be >= 0")
      });

      const validationResult = commissionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid commission amount. Must be a number >= 0" });
      }

      const { commissionAmount } = validationResult.data;

      // Verify client belongs to user (unless admin)
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      if (client.userId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden: Cannot edit another user's client sales" });
      }

      // Get barter sales for this client
      const allSales = await storage.getAllSales();
      const barterSales = allSales.filter(
        sale => sale.clientId === clientId &&
          sale.commissionTier === 'barter' &&
          sale.userId === req.user!.id
      );

      if (barterSales.length === 0) {
        return res.status(404).json({ error: "No barter sales found for this client" });
      }

      // Apply total commission to first product, zero to others
      const updatedSales = [];
      for (let i = 0; i < barterSales.length; i++) {
        const sale = barterSales[i];
        const updated = await storage.updateSale(sale.id, {
          commissionAmount: i === 0 ? commissionAmount.toString() : "0",
          isManual: true,
        });
        if (updated) {
          updatedSales.push(updated);
        }
      }

      res.json({
        success: true,
        updatedCount: updatedSales.length,
        sales: updatedSales
      });
    } catch (error) {
      console.error("Error updating barter commission:", error);
      res.status(500).json({ error: "Failed to update barter commission" });
    }
  });

  // Endpoint de Setup para Migração do Banco de Dados (Planejamento 2026)
  // Útil quando não se tem acesso ao console do Railway
  // Endpoint de Setup para Migração do Banco de Dados (Planejamento 2026)
  // Útil quando não se tem acesso ao console do Railway
  // Modificado para usar SQL inline e evitar erro de leitura de arquivo em produção
  app.get("/api/admin/setup-planning-db", requireSuperAdmin, async (req, res) => {
    try {
      const migrationSql = `
CREATE TABLE IF NOT EXISTS "planning_products_base"(
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "segment" text,
  "dose_per_ha" numeric(10, 3),
  "price" numeric(10, 2),
  "unit" text,
  "season_id" varchar REFERENCES "seasons"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sales_planning"(
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" varchar NOT NULL REFERENCES "user_client_links"("id") ON DELETE cascade,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "season_id" varchar NOT NULL REFERENCES "seasons"("id"),
  "total_planting_area" numeric(10, 2),
  "fungicides_area" numeric(10, 2) DEFAULT '0.00',
  "insecticides_area" numeric(10, 2) DEFAULT '0.00',
  "herbicides_area" numeric(10, 2) DEFAULT '0.00',
  "seed_treatment_area" numeric(10, 2) DEFAULT '0.00',
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "sales_planning_unique" UNIQUE("client_id", "season_id")
);

CREATE TABLE IF NOT EXISTS "sales_planning_items"(
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "planning_id" varchar NOT NULL REFERENCES "sales_planning"("id") ON DELETE cascade,
  "product_id" varchar NOT NULL REFERENCES "planning_products_base"("id"),
  "quantity" numeric(15, 2) NOT NULL,
  "total_amount" numeric(15, 2) NOT NULL
);
`;

      const { pool } = await import("./db");

      if (pool && typeof pool.unsafe === 'function') {
        // Driver postgres-js (Railway)
        await pool.unsafe(migrationSql);
        return res.json({ success: true, message: "Migração executada com postgres-js (SQL Inline)!" });
      }
      else if (pool && typeof pool.query === 'function') {
        // Driver pg ou neon (Pool)
        await pool.query(migrationSql);
        return res.json({ success: true, message: "Migração executada com pg/neon pool (SQL Inline)!" });
      }
      else {
        return res.status(500).json({ error: "Driver de banco de dados não suportado para migração remota." });
      }

    } catch (error) {
      console.error("Erro na migração via web:", error);
      res.status(500).json({
        error: "Falha ao executar migração",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.post("/api/sales/recalculate-all", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;

      // Fetch all required data
      const [sales, categories, products] = await Promise.all([
        storage.getAllSales(),
        storage.getAllCategories(),
        storage.getAllProducts(),
      ]);

      // Filter sales by user
      const userSales = sales.filter(sale => sale.userId === userId);

      // Create lookup maps
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      const productMap = new Map(products.map(p => [p.id, p]));

      let updatedCount = 0;
      const errors: string[] = [];

      for (const sale of userSales) {
        try {
          const category = categoryMap.get(sale.categoryId);
          const product = productMap.get(sale.productId);

          if (!category) {
            errors.push(`Sale ${sale.id}: Category not found`);
            continue;
          }

          const margin = parseFloat(sale.margin.toString());
          const totalAmount = parseFloat(sale.totalAmount.toString());
          const ivaRate = parseFloat(sale.ivaRate.toString());

          // 1. Recalculate commission
          const greenMarginMin = parseFloat(category.greenMarginMin);
          const yellowMarginMin = parseFloat(category.yellowMarginMin);
          const yellowMarginMax = parseFloat(category.yellowMarginMax);
          const redMarginMin = parseFloat(category.redMarginMin);
          const redMarginMax = parseFloat(category.redMarginMax);

          let commissionTier: string;
          let commissionRate: number;

          if (margin >= greenMarginMin) {
            commissionTier = "verde";
            commissionRate = parseFloat(category.greenCommission);
          } else if (margin >= yellowMarginMin && margin <= yellowMarginMax) {
            commissionTier = "amarela";
            commissionRate = parseFloat(category.yellowCommission);
          } else if (margin >= redMarginMin && margin <= redMarginMax) {
            commissionTier = "vermelha";
            commissionRate = parseFloat(category.redCommission);
          } else {
            commissionTier = "abaixo_lista";
            commissionRate = parseFloat(category.belowListCommission);
          }

          const amountBeforeIva = totalAmount / (1 + ivaRate / 100);
          const commissionAmount = amountBeforeIva * (commissionRate / 100);

          // 2. Recalculate Timac points
          let timacPoints = null;
          if (product && category.id === 'cat-especialidades') {
            const normalizedMarca = product.marca
              ?.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .replace(/\s+/g, '') || '';

            if (normalizedMarca.startsWith('TIMAC')) {
              const quantity = sale.quantity ? parseFloat(sale.quantity.toString()) : 0;
              const normalizedProductName = product.name
                ?.normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toUpperCase() || '';

              const pointsPerUnit = normalizedProductName.includes('FERTIACTYL') &&
                normalizedProductName.includes('LEGUMINOSAS') ? 3 : 1;

              timacPoints = quantity * pointsPerUnit;
            }
          }

          // Update sale
          await storage.updateSale(sale.id, {
            commissionTier,
            commissionRate: commissionRate.toString(),
            commissionAmount: commissionAmount.toString(),
            timacPoints: timacPoints !== null ? timacPoints.toString() : null,
          });

          updatedCount++;
        } catch (error) {
          errors.push(`Sale ${sale.id}: ${error instanceof Error ? error.message : 'Unknown error'} `);
        }
      }

      res.json({
        success: true,
        totalSales: userSales.length,
        updatedCount,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error("Error recalculating sales:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to recalculate sales"
      });
    }
  });

  // Analytics
  app.get("/api/analytics/sales", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.query;
      // Cada usuário vê apenas suas próprias analytics
      const analytics = await storage.getSalesAnalytics(seasonId as string, req.user!.id);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales analytics" });
    }
  });

  app.get("/api/analytics/opportunities", async (req, res) => {
    try {
      const { clientId } = req.query;
      const opportunities = await storage.getOpportunityAlerts(clientId as string);
      res.json(opportunities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch opportunity alerts" });
    }
  });

  // Season Parameters
  app.get("/api/season-parameters", async (req, res) => {
    try {
      const parameters = await storage.getAllSeasonParameters();
      res.json(parameters);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch season parameters" });
    }
  });

  // Excel Import
  app.post("/api/sales/import-excel", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Nenhum arquivo foi enviado"
        });
      }

      const seasonId = req.body.seasonId;
      if (!seasonId) {
        return res.status(400).json({
          success: false,
          message: "Safra não selecionada. Por favor, selecione uma safra."
        });
      }

      const result = await importExcelFile(req.file.buffer, seasonId, req.user!.id);

      console.log('Import result:', JSON.stringify(result, null, 2));

      if (result.success) {
        res.json({
          success: true,
          message: `Importação concluída com sucesso! ${result.importedSales} vendas importadas.`,
          importedSales: result.importedSales,
          createdClients: result.createdClients,
          createdProducts: result.createdProducts,
        });
      } else {
        const errorMessage = result.errors.length > 0
          ? result.errors.join('; ')
          : 'Nenhuma venda foi importada. Verifique o formato do arquivo.';

        res.status(400).json({
          success: false,
          message: errorMessage,
          totalRows: result.totalRows,
          importedSales: result.importedSales,
          errors: result.errors,
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Erro desconhecido ao importar arquivo",
      });
    }
  });

  // Import Batches Management
  app.get("/api/sales/import-batches", requireAuth, async (req, res) => {
    try {
      const allBatches = await storage.getImportBatches();
      // Filter batches by authenticated user
      const userBatches = allBatches.filter(batch => batch.userId === req.user!.id);
      res.json(userBatches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch import batches" });
    }
  });

  app.delete("/api/sales/import-batches/:batchId", requireAuth, async (req, res) => {
    try {
      const { batchId } = req.params;
      await storage.deleteImportBatch(batchId);
      res.json({ success: true, message: "Lote deletado com sucesso" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete import batch" });
    }
  });

  // Temporary admin route to delete all sales
  app.delete("/api/admin/reset-sales", requireSuperAdmin, async (req, res) => {
    try {
      await storage.deleteAllSales();
      res.json({ success: true, message: "Todas as vendas foram deletadas" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete sales" });
    }
  });

  // Client Market Rates (Investment per Ha configuration)
  app.get("/api/clients/:clientId/market-rates/:seasonId", requireAuth, async (req, res) => {
    try {
      const { clientId, seasonId } = req.params;
      const rates = await storage.getClientMarketRates(clientId, req.user!.id, seasonId);
      res.json(rates);
    } catch (error) {
      console.error('Error fetching client market rates:', error);
      res.status(500).json({ error: "Failed to fetch client market rates" });
    }
  });

  // Manager endpoint to get current market rates for a season
  app.get("/api/clients/manager-team/market-rates/:seasonId", requireManager, async (req, res) => {
    try {
      const { seasonId } = req.params;
      const rates = await storage.getManagerTeamRates(req.user!.id, seasonId);
      res.json(rates);
    } catch (error) {
      console.error('Error fetching team market rates:', error);
      res.status(500).json({ error: "Failed to fetch team market rates" });
    }
  });

  // Manager-specific endpoint to apply market rates to entire team
  app.post("/api/clients/manager-team/market-rates", requireManager, async (req, res) => {
    try {
      const { allRates } = req.body;

      console.log('POST /api/clients/manager-team/market-rates');
      console.log('Manager ID:', req.user!.id);

      if (allRates && Array.isArray(allRates) && allRates.length > 0) {
        // Process each category
        for (const rateConfig of allRates) {
          const { categoryId, seasonId, investmentPerHa, subcategories } = rateConfig;

          // Save to manager_team_rates
          await storage.upsertManagerTeamRate({
            managerId: req.user!.id,
            seasonId,
            categoryId,
            investmentPerHa,
            subcategories: subcategories || null
          });
        }
      }

      // Get count of clients that might be affected (just for info)
      // Clients with badges (80/20 OR Market) belonging to this manager's team
      const teamConsultants = await db.select().from(users).where(eq(users.managerId, req.user!.id));
      const teamIds = teamConsultants.map(u => u.id);
      teamIds.push(req.user!.id); // Include manager

      const affectedClients = await db.select({ count: sql<number>`count(*)` })
        .from(userClientLinks)
        .where(and(
          inArray(userClientLinks.userId, teamIds),
          or(
            eq(userClientLinks.isTop80_20, true),
            eq(userClientLinks.includeInMarketArea, true)
          )
        ));

      const clientCount = Number(affectedClients[0]?.count || 0);

      res.json({
        success: true,
        message: `Configuração salva com sucesso! O potencial será calculado automaticamente para ${clientCount} clientes com badge(80 / 20 ou Mercado).`,
        clientCount
      });

    } catch (error) {
      console.error('Error saving team market rates:', error);
      res.status(500).json({ error: "Failed to save team market rates" });
    }
  });


  app.post("/api/clients/:clientId/market-rates", requireAuth, async (req, res) => {
    try {
      // Only managers can configure market rates (will be replicated to team)
      if (req.user!.role !== 'gerente') {
        return res.status(403).json({ error: "Apenas gerentes podem configurar potencial de mercado" });
      }

      const { categoryId, seasonId, investmentPerHa, subcategories } = req.body;

      // Get all consultants in this manager's team
      const teamConsultants = await db.select()
        .from(users)
        .where(eq(users.managerId, req.user!.id));

      const consultantIds = teamConsultants.map(c => c.id);

      // If no team members found, just return empty
      if (consultantIds.length === 0) {
        return res.json({ success: true, message: "Nenhum consultor na equipe" });
      }

      // Get all clients for these consultants (only those included in market area)
      const teamClients = await db.select()
        .from(userClientLinks)
        .where(and(
          inArray(userClientLinks.userId, consultantIds),
          eq(userClientLinks.includeInMarketArea, true)
        ));

      // Create/update market rates for ALL clients in the team
      const rates = [];
      for (const client of teamClients) {
        const rate = await storage.upsertClientMarketRate({
          clientId: client.id,
          categoryId,
          userId: client.userId, // Use the consultant's userId, not the manager's
          seasonId,
          investmentPerHa,
          subcategories: subcategories || null
        });
        rates.push(rate);
      }

      res.json({ success: true, count: rates.length, message: `Configuração aplicada a ${rates.length} cliente(s)` });
    } catch (error) {
      console.error('Error upserting client market rate:', error);
      res.status(500).json({ error: "Failed to save client market rate" });
    }
  });

  app.delete("/api/clients/:clientId/market-rates/:categoryId/:seasonId", requireAuth, async (req, res) => {
    try {
      const { clientId, categoryId, seasonId } = req.params;
      await storage.deleteClientMarketRate(clientId, categoryId, req.user!.id, seasonId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting client market rate:', error);
      res.status(500).json({ error: "Failed to delete client market rate" });
    }
  });

  // Market Benchmarks
  app.get("/api/market-benchmarks/:seasonId", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.params;
      const benchmarks = await storage.getMarketBenchmarks(req.user!.id, seasonId);
      res.json(benchmarks);
    } catch (error) {
      console.error('Error fetching market benchmarks:', error);
      res.status(500).json({ error: "Failed to fetch market benchmarks" });
    }
  });

  app.post("/api/market-benchmarks", requireAuth, async (req, res) => {
    try {
      const { categoryId, seasonId, marketPercentage } = req.body;

      const benchmark = await storage.upsertMarketBenchmark({
        userId: req.user!.id,
        categoryId,
        seasonId,
        marketPercentage
      });

      res.json(benchmark);
    } catch (error) {
      console.error('Error upserting market benchmark:', error);
      res.status(500).json({ error: "Failed to save market benchmark" });
    }
  });

  app.delete("/api/market-benchmarks/:categoryId/:seasonId", requireAuth, async (req, res) => {
    try {
      const { categoryId, seasonId } = req.params;
      await storage.deleteMarketBenchmark(req.user!.id, categoryId, seasonId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting market benchmark:', error);
      res.status(500).json({ error: "Failed to delete market benchmark" });
    }
  });

  app.get("/api/market-potential", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.query;

      if (!seasonId || typeof seasonId !== 'string') {
        return res.status(400).json({ error: "Season ID is required" });
      }

      const potentials = await storage.getMarketPotentialByCategory(req.user!.id, seasonId);
      res.json(potentials);
    } catch (error) {
      console.error('Error getting market potential:', error);
      res.status(500).json({ error: "Failed to get market potential" });
    }
  });

  // External Purchases
  app.get("/api/clients/:clientId/external-purchases/:seasonId", requireAuth, async (req, res) => {
    try {
      const { clientId, seasonId } = req.params;
      const purchases = await storage.getExternalPurchases(clientId, req.user!.id, seasonId);
      res.json(purchases);
    } catch (error) {
      console.error('Error fetching external purchases:', error);
      res.status(500).json({ error: "Failed to fetch external purchases" });
    }
  });

  app.post("/api/external-purchases", requireAuth, async (req, res) => {
    try {
      const purchaseData = insertExternalPurchaseSchema.parse({
        ...req.body,
        userId: req.user!.id
      });
      const purchase = await storage.upsertExternalPurchase(purchaseData);
      res.json(purchase);
    } catch (error) {
      console.error('Error upserting external purchase:', error);
      res.status(500).json({ error: "Failed to save external purchase" });
    }
  });

  app.delete("/api/external-purchases", requireAuth, async (req, res) => {
    try {
      const { clientId, categoryId, seasonId } = req.body;
      await storage.deleteExternalPurchase(req.user!.id, clientId, categoryId, seasonId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting external purchase:', error);
      res.status(500).json({ error: "Failed to delete external purchase" });
    }
  });

  // Market Analysis
  app.get("/api/market-analysis", requireAuth, async (req, res) => {
    try {
      const rates = await storage.getMarketInvestmentRates();
      const allSales = await storage.getAllSales();
      const categories = await storage.getAllCategories();
      const activeSeason = await storage.getActiveSeason();
      const products = await storage.getAllProducts();

      // Use provided seasonId or fallback to active season
      const seasonId = (req.query.seasonId as string) || activeSeason?.id || '';

      // Filter sales by authenticated user AND selected season
      const sales = allSales.filter(s => s.userId === req.user!.id && s.seasonId === seasonId);

      // Create product-to-subcategory map
      const productSubcategoryMap = new Map(
        products
          .filter(p => p.subcategoryId)
          .map(p => [p.id, p.subcategoryId!])
      );

      // Get only top 80/20 clients for this user from user_client_links
      const top8020Clients = await storage.getClientsForUser(req.user!.id, true);

      // Fetch all family relations for top 80/20 clients
      const allFamilyRelations = await Promise.all(
        top8020Clients.map(c => storage.getClientFamilyRelations(c.id, req.user!.id))
      );

      // Build family groups using union-find approach
      const clientToGroup = new Map<string, Set<string>>();

      top8020Clients.forEach((client, idx) => {
        const relatedIds = allFamilyRelations[idx];

        if (relatedIds.length === 0) {
          // Client has no family relations, create solo group
          clientToGroup.set(client.id, new Set([client.id]));
        } else {
          // Find existing group or create new one
          let existingGroup: Set<string> | null = null;

          // Check if client or any related client already in a group
          for (const relatedId of [client.id, ...relatedIds]) {
            if (clientToGroup.has(relatedId)) {
              existingGroup = clientToGroup.get(relatedId)!;
              break;
            }
          }

          if (!existingGroup) {
            existingGroup = new Set();
          }

          // Add all members to the group
          existingGroup.add(client.id);
          relatedIds.forEach(id => existingGroup!.add(id));

          // Update all members to point to this group
          existingGroup.forEach(id => clientToGroup.set(id, existingGroup!));
        }
      });

      // For each family group, determine the client with max planting area
      const effectivePlantingArea = new Map<string, number>();
      const processedGroups = new Set<Set<string>>();

      top8020Clients.forEach(client => {
        const group = clientToGroup.get(client.id);
        if (!group || processedGroups.has(group)) return;

        processedGroups.add(group);

        // Find client with max planting area in this group
        let maxArea = 0;
        let maxAreaClientId = client.id;

        group.forEach(clientId => {
          const groupClient = top8020Clients.find(c => c.id === clientId);
          if (groupClient) {
            const area = parseFloat(groupClient.plantingArea);
            if (area > maxArea) {
              maxArea = area;
              maxAreaClientId = clientId;
            }
          }
        });

        // Set effective area: max area for representative client, 0 for others
        group.forEach(clientId => {
          effectivePlantingArea.set(
            clientId,
            clientId === maxAreaClientId ? maxArea : 0
          );
        });
      });

      // Create category map for easy lookup
      const categoryMap = new Map(categories.map(c => [c.id, c]));
      const rateMap = new Map(rates.map(r => [r.categoryId, r]));

      // Fetch all client market rates for this user and active season
      const allClientRates = await Promise.all(
        top8020Clients.map(c => storage.getClientMarketRates(c.id, req.user!.id, seasonId))
      );
      const clientRatesMap = new Map(
        allClientRates.flatMap((rates, idx) =>
          rates.map(r => [`${top8020Clients[idx].id} -${r.categoryId} `, r])
        )
      );

      // Fetch all external purchases for this user and active season
      const allExternalPurchases = await Promise.all(
        top8020Clients.map(c => storage.getExternalPurchases(c.id, req.user!.id, seasonId))
      );
      const externalPurchasesMap = new Map(
        allExternalPurchases.flatMap((purchases, idx) =>
          purchases.map(p => [`${top8020Clients[idx].id} -${p.categoryId} `, p])
        )
      );

      const clientAnalysis = top8020Clients.map(client => {
        const clientSales = sales.filter(s => s.clientId === client.id);

        // Calculate sales by category
        const salesByCategory = clientSales.reduce((acc, sale) => {
          const amount = parseFloat(sale.totalAmount);
          acc[sale.categoryId] = (acc[sale.categoryId] || 0) + amount;
          return acc;
        }, {} as Record<string, number>);

        // Calculate sales by category and subcategory (for Agroquímicos)
        const salesBySubcategory = clientSales.reduce((acc, sale) => {
          const subcategoryId = productSubcategoryMap.get(sale.productId);
          if (subcategoryId) {
            const key = `${sale.categoryId} -${subcategoryId} `;
            const amount = parseFloat(sale.totalAmount);
            acc[key] = (acc[key] || 0) + amount;
          }
          return acc;
        }, {} as Record<string, number>);

        // Calculate potential and % for each category
        const categoryDetails: Record<string, any> = {};
        let totalPotential = 0;
        let totalRealized = 0;

        // Iterate over all categories instead of just market investment rates
        categories.forEach(category => {
          // Check if there's a custom rate for this client and category
          const customRate = clientRatesMap.get(`${client.id} -${category.id} `);
          const defaultRate = rateMap.get(category.id);

          // Use custom rate if available, otherwise use default rate
          let investmentPerHa = 0;
          if (customRate) {
            investmentPerHa = parseFloat(customRate.investmentPerHa);
          } else if (defaultRate) {
            investmentPerHa = parseFloat(defaultRate.investmentPerHa);
          }

          // Use effective planting area (accounting for family groups)
          const plantingAreaForCalc = effectivePlantingArea.get(client.id) ?? parseFloat(client.plantingArea);
          const potential = plantingAreaForCalc * investmentPerHa;
          const cvaleAmount = salesByCategory[category.id] || 0;

          // Get external purchases for this client and category
          const externalPurchase = externalPurchasesMap.get(`${client.id} -${category.id} `);
          const externalAmount = externalPurchase ? parseFloat(externalPurchase.amount) : 0;

          const categoryTotalRealized = cvaleAmount + externalAmount;
          const percentage = potential > 0 ? (categoryTotalRealized / potential) * 100 : 0;
          const opportunity = potential - categoryTotalRealized;
          const isClosed = percentage >= 100;

          totalPotential += potential;
          totalRealized += categoryTotalRealized;

          // Build detailed subcategory breakdown for Agroquímicos
          let subcategoryDetails = null;
          if (category.id === 'cat-agroquimicos') {
            // Fetch subcategories for this category
            const agroquimicosSubcategories = [
              { id: 'sub-tratamento-sementes', name: 'Tratamento de semente' },
              { id: 'sub-dessecacao', name: 'Dessecação' },
              { id: 'sub-inseticidas', name: 'Inseticidas' },
              { id: 'sub-fungicidas', name: 'Fungicidas' }
            ];

            const externalSubcategories = (externalPurchase?.subcategories as Record<string, number>) || {};

            subcategoryDetails = agroquimicosSubcategories.map(subcat => {
              const cvaleSubAmount = salesBySubcategory[`${category.id} -${subcat.id} `] || 0;
              const externalSubAmount = externalSubcategories[subcat.id] || 0;
              const totalSubAmount = cvaleSubAmount + externalSubAmount;

              // Get products sold in this subcategory for this client
              const subcategorySales = clientSales.filter(sale => {
                const productSubcategoryId = productSubcategoryMap.get(sale.productId);
                return sale.categoryId === category.id && productSubcategoryId === subcat.id;
              });

              // Group by product
              const productDetails = subcategorySales.reduce((acc, sale) => {
                const product = products.find(p => p.id === sale.productId);
                if (!product) return acc;

                if (!acc[product.id]) {
                  acc[product.id] = {
                    productId: product.id,
                    productName: product.name,
                    quantity: 0,
                    cvaleAmount: 0
                  };
                }

                acc[product.id].quantity += sale.quantity ? parseFloat(sale.quantity) : 0;
                acc[product.id].cvaleAmount += parseFloat(sale.totalAmount);

                return acc;
              }, {} as Record<string, { productId: string; productName: string; quantity: number; cvaleAmount: number }>);

              return {
                id: subcat.id,
                name: subcat.name,
                cvaleAmount: cvaleSubAmount,
                externalAmount: externalSubAmount,
                totalAmount: totalSubAmount,
                products: Object.values(productDetails)
              };
            });
          }

          categoryDetails[category.id] = {
            categoryName: category.name,
            potential,
            cvaleAmount,
            externalAmount,
            externalCompany: externalPurchase?.company || null,
            totalRealized: categoryTotalRealized,
            opportunity: opportunity > 0 ? opportunity : 0,
            isClosed,
            percentage,
            hasCustomRate: !!customRate,
            subcategories: subcategoryDetails
          };
        });

        const totalPercentage = totalPotential > 0 ? (totalRealized / totalPotential) * 100 : 0;

        return {
          clientId: client.id,
          clientName: client.name,
          plantingArea: parseFloat(client.plantingArea),
          totalPotential,
          totalRealized,
          totalPercentage,
          categoryDetails
        };
      });

      // Calculate regional benchmark (average % by category)
      const benchmark: Record<string, number> = {};
      categories.forEach(category => {
        const percentages = clientAnalysis
          .map(c => c.categoryDetails[category.id]?.percentage || 0)
          .filter(p => p > 0);

        const average = percentages.length > 0
          ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length
          : 0;

        benchmark[category.id] = average;
      });

      // Calculate opportunities (gaps)
      const opportunities = clientAnalysis.flatMap(client =>
        Object.entries(client.categoryDetails).map(([categoryId, details]) => ({
          clientId: client.clientId,
          clientName: client.clientName,
          categoryId,
          categoryName: details.categoryName,
          clientPercentage: details.percentage,
          marketPercentage: benchmark[categoryId] || 0,
          gap: (benchmark[categoryId] || 0) - details.percentage,
          potential: details.potential,
          realized: details.realized
        }))
      ).filter(opp => opp.gap > 5); // Only show significant gaps

      res.json({
        clientAnalysis,
        benchmark,
        opportunities: opportunities.sort((a, b) => b.gap - a.gap) // Sort by biggest gaps first
      });
    } catch (error) {
      console.error('Market analysis error:', error);
      res.status(500).json({ error: "Failed to generate market analysis" });
    }
  });

  // Timac Points Reward
  app.get("/api/timac-points", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.query;

      // Buscar todas as vendas do usuário autenticado com pontos Timac
      const allSales = await storage.getAllSales();
      let sales = allSales.filter(s => s.userId === req.user!.id);

      // Filtrar por season se fornecido
      if (seasonId) {
        sales = sales.filter(s => s.seasonId === seasonId);
      }

      // Somar pontos Timac
      const totalPoints = sales.reduce((sum, sale) => {
        if (sale.timacPoints) {
          return sum + parseFloat(sale.timacPoints);
        }
        return sum;
      }, 0);

      // Calcular premiação: total pontos × $0.76 USD
      const rewardPerPoint = 0.76;
      const totalReward = totalPoints * rewardPerPoint;

      res.json({
        totalPoints: totalPoints.toFixed(2),
        rewardPerPoint: rewardPerPoint.toFixed(2),
        totalReward: totalReward.toFixed(2),
        currency: 'USD'
      });
    } catch (error) {
      console.error('Timac points error:', error);
      res.status(500).json({ error: "Failed to calculate Timac points" });
    }
  });

  // Alert Settings
  app.get("/api/alert-settings", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAlertSettings(req.user!.id);

      if (!settings) {
        const defaults = {
          userId: req.user!.id,
          emailEnabled: false,
          notificationsEnabled: true,
          goalAlerts: true,
          opportunityAlerts: true,
          seasonDeadlineAlerts: true,
          goalThresholdPercent: "80.00",
          email: null
        };
        return res.json(defaults);
      }

      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alert settings" });
    }
  });

  app.put("/api/alert-settings", requireAuth, async (req, res) => {
    try {
      const settingsData = insertAlertSettingsSchema.parse(req.body);
      const settings = await storage.upsertAlertSettings({ ...settingsData, userId: req.user!.id });
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Invalid alert settings data" });
    }
  });

  // Alerts
  app.get("/api/alerts", requireAuth, async (req, res) => {
    try {
      const alerts = await storage.getAlerts(req.user!.id);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadAlertsCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.post("/api/alerts/:id/mark-read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.markAlertAsRead(id, req.user!.id);

      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ success: true, message: "Alert marked as read" });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark alert as read" });
    }
  });

  app.post("/api/alerts/mark-all-read", requireAuth, async (req, res) => {
    try {
      const success = await storage.markAllAlertsAsRead(req.user!.id);
      res.json({ success, message: "All alerts marked as read" });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all alerts as read" });
    }
  });

  app.delete("/api/alerts/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteAlert(id, req.user!.id);

      if (!success) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ success: true, message: "Alert deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete alert" });
    }
  });

  app.post("/api/alerts/check", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      let alertsCreated = 0;

      const activeSeason = await storage.getActiveSeason();
      if (!activeSeason) {
        return res.json({ alertsCreated: 0, message: "No active season found" });
      }

      const settings = await storage.getAlertSettings(userId);
      const threshold = settings?.goalThresholdPercent ? parseFloat(settings.goalThresholdPercent) : 80;

      const existingAlerts = await storage.getAlerts(userId);
      const recentAlertCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const hasRecentAlert = (type: string, relatedId?: string) => {
        return existingAlerts.some(alert =>
          alert.type === type &&
          alert.relatedId === relatedId &&
          new Date(alert.createdAt) > recentAlertCutoff
        );
      };

      if (settings?.goalAlerts !== false) {
        const goal = await storage.getSeasonGoal(activeSeason.id, userId);

        if (goal) {
          const allSales = await storage.getAllSales();
          const seasonSales = allSales.filter(s =>
            s.userId === userId && s.seasonId === activeSeason.id
          );

          const totalSales = seasonSales.reduce((sum, sale) =>
            sum + parseFloat(sale.totalAmount), 0
          );

          const goalAmount = parseFloat(goal.goalAmount);
          const progress = goalAmount > 0 ? (totalSales / goalAmount) * 100 : 0;

          if (progress >= threshold && progress < 100 && !hasRecentAlert("meta", activeSeason.id)) {
            await storage.createAlert({
              userId,
              type: "meta",
              title: "Meta próxima de ser atingida",
              message: `Você atingiu ${progress.toFixed(1)}% da meta para ${activeSeason.name}. Faltam USD ${(goalAmount - totalSales).toFixed(2)} para completar!`,
              severity: progress >= 90 ? "warning" : "info",
              relatedId: activeSeason.id,
              relatedType: "season",
              isRead: false
            });
            alertsCreated++;
          }
        }
      }

      if (settings?.opportunityAlerts !== false) {
        const topClients = await storage.getTop80_20Clients();
        const allSales = await storage.getAllSales();
        const seasonSales = allSales.filter(s =>
          s.userId === userId && s.seasonId === activeSeason.id
        );

        const clientsWithSales = new Set(seasonSales.map(s => s.clientId));
        const clientsWithoutSales = topClients.filter(c => !clientsWithSales.has(c.id));

        for (const client of clientsWithoutSales) {
          if (!hasRecentAlert("oportunidade", client.id)) {
            await storage.createAlert({
              userId,
              type: "oportunidade",
              title: "Cliente top sem compras",
              message: `O cliente ${client.name} está no grupo top 80 / 20 mas ainda não fez compras na safra ${activeSeason.name}.`,
              severity: "warning",
              relatedId: client.id,
              relatedType: "client",
              isRead: false
            });
            alertsCreated++;
          }
        }
      }

      if (settings?.seasonDeadlineAlerts !== false) {
        const now = new Date();
        const endDate = new Date(activeSeason.endDate);
        const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilEnd <= 30 && daysUntilEnd > 0 && !hasRecentAlert("prazo_safra", activeSeason.id)) {
          await storage.createAlert({
            userId,
            type: "prazo_safra",
            title: "Safra próxima do fim",
            message: `A safra ${activeSeason.name} termina em ${daysUntilEnd} dias.Finalize suas vendas e metas!`,
            severity: daysUntilEnd <= 7 ? "urgent" : "warning",
            relatedId: activeSeason.id,
            relatedType: "season",
            isRead: false
          });
          alertsCreated++;
        }
      }

      res.json({
        alertsCreated,
        message: alertsCreated > 0
          ? `${alertsCreated} novo(s) alerta(s) criado(s)`
          : "Nenhum novo alerta"
      });
    } catch (error) {
      console.error('Alert check error:', error);
      res.status(500).json({ error: "Failed to check alerts" });
    }
  });

  // Purchase History
  app.post("/api/purchase-history/parse-pdf", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const parsed = await parseCVALEPDF(req.file.buffer);
      const vendedorId = req.body.vendedorId || req.user!.id;

      // Buscar clientes do usuário via user_client_links
      const userClients = await storage.getClientsForUser(vendedorId, false);

      console.log(`[PDF Import] Looking for client: "${parsed.clientName}"`);
      console.log(`[PDF Import] Available clients(${userClients.length}): `, userClients.map(c => c.name).join(', '));

      const matchedClient = userClients.find(c =>
        parsed.clientName && (
          c.name.toUpperCase().includes(parsed.clientName.toUpperCase()) ||
          parsed.clientName.toUpperCase().includes(c.name.toUpperCase())
        )
      );

      if (!matchedClient) {
        console.log(`[PDF Import] No match found for "${parsed.clientName}"`);
        return res.status(400).json({
          error: "Cliente não encontrado no sistema",
          clientName: parsed.clientName,
          suggestion: "Cadastre o cliente antes de importar o histórico"
        });
      }

      console.log(`[PDF Import] Matched client: ${matchedClient.name} `);

      const allSeasons = await storage.getAllSeasons();
      const matchedSeason = allSeasons.find(s =>
        parsed.seasonName.includes(s.name) ||
        s.name.includes(parsed.seasonName.split(' ')[1] || '')
      );

      const allProducts = await storage.getAllProducts();
      const allCategories = await storage.getAllCategories();
      const categoryIds = new Set(allCategories.map(c => c.id));

      let outrosCategory = allCategories.find(c => c.name === 'Outros');
      if (!outrosCategory) {
        outrosCategory = await storage.createCategory({
          name: 'Outros',
          type: 'outros',
          greenCommission: '0.000',
          greenMarginMin: '0.00',
          yellowCommission: '0.000',
          yellowMarginMin: '0.00',
          yellowMarginMax: '0.00',
          redCommission: '0.000',
          redMarginMin: '0.00',
          redMarginMax: '0.00',
          belowListCommission: '0.000',
          defaultIva: '10.00'
        });
      }

      const autoCreatedProducts: Array<{
        productName: string;
        productCode: string;
        categoryId: string;
        hasCategory: true;
      }> = [];

      const uncategorizedProducts: Array<{
        productName: string;
        productCode: string;
        categoryId: string;
        hasCategory: false;
      }> = [];

      for (const item of parsed.items) {
        const existingProduct = allProducts.find(p =>
          p.name.toUpperCase().includes(item.productName.toUpperCase()) ||
          item.productName.toUpperCase().includes(p.name.toUpperCase())
        );

        if (!existingProduct) {
          const { detectCategoryFromProductName } = await import('./parse-cvale-pdf');
          const detectedCategoryId = detectCategoryFromProductName(item.productName);

          if (detectedCategoryId && categoryIds.has(detectedCategoryId)) {
            const newProduct = await storage.createProduct({
              name: item.productName,
              categoryId: detectedCategoryId
            });

            autoCreatedProducts.push({
              productName: newProduct.name,
              productCode: item.productCode,
              categoryId: detectedCategoryId,
              hasCategory: true
            });

            allProducts.push(newProduct);
          } else {
            const newProduct = await storage.createProduct({
              name: item.productName,
              categoryId: outrosCategory.id
            });

            uncategorizedProducts.push({
              productName: newProduct.name,
              productCode: item.productCode,
              categoryId: outrosCategory.id,
              hasCategory: false
            });

            allProducts.push(newProduct);
          }
        }
      }

      res.json({
        clientId: matchedClient.id,
        clientName: matchedClient.name,
        seasonId: matchedSeason?.id || null,
        seasonName: parsed.seasonName,
        totalAmount: parsed.totalAmount,
        itemsCount: parsed.items.length,
        items: parsed.items,
        fileName: req.file.originalname,
        autoCreatedProducts,
        uncategorizedProducts
      });
    } catch (error) {
      console.error("PDF parse error:", error);
      res.status(500).json({ error: "Failed to parse PDF" });
    }
  });

  app.post("/api/purchase-history", requireAuth, async (req, res) => {
    try {
      const vendedorId = req.body.vendedorId || req.user!.id;
      const { items, ...historyData } = req.body;

      const validatedHistory = insertPurchaseHistorySchema.parse({
        ...historyData,
        userId: vendedorId
      });

      const history = await storage.createPurchaseHistory(validatedHistory);

      for (const item of items) {
        const validatedItem = insertPurchaseHistoryItemSchema.parse({
          ...item,
          purchaseHistoryId: history.id,
          purchaseDate: new Date(item.purchaseDate)
        });

        await storage.createPurchaseHistoryItem(validatedItem);
      }

      res.status(201).json(history);
    } catch (error) {
      console.error("Error creating purchase history:", error);
      res.status(400).json({ error: "Failed to create purchase history" });
    }
  });

  app.get("/api/purchase-history", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { clientId, seasonId } = req.query;

      const histories = await storage.getPurchaseHistories(
        userId,
        clientId as string | undefined,
        seasonId as string | undefined
      );

      res.json(histories);
    } catch (error) {
      console.error("Error fetching purchase histories:", error);
      res.status(500).json({ error: "Failed to fetch purchase histories" });
    }
  });

  app.get("/api/clients/:clientId/purchase-history", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const userId = req.user!.id;

      const histories = await storage.getPurchaseHistories(userId, clientId, undefined);
      res.json(histories);
    } catch (error) {
      console.error("Error fetching client purchase histories:", error);
      res.status(500).json({ error: "Failed to fetch purchase histories" });
    }
  });

  app.get("/api/purchase-history/:id/items", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const history = await storage.getPurchaseHistory(id, userId);
      if (!history) {
        return res.status(404).json({ error: "Purchase history not found" });
      }

      const items = await storage.getPurchaseHistoryItems(id);
      res.json(items);
    } catch (error) {
      console.error("Error fetching purchase history items:", error);
      res.status(500).json({ error: "Failed to fetch items" });
    }
  });

  app.get("/api/purchase-history/:id/opportunities", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { seasonId } = req.query;
      const userId = req.user!.id;

      const history = await storage.getPurchaseHistory(id, userId);
      if (!history) {
        return res.status(404).json({ error: "Purchase history not found" });
      }

      const historyItems = await storage.getPurchaseHistoryItems(id);

      const allSales = await storage.getAllSales();
      const clientSales = allSales.filter(s => s.userId === userId && s.clientId === history.clientId);

      const comparisonSeasonId = seasonId as string || history.seasonId;
      const currentSeasonSales = comparisonSeasonId
        ? clientSales.filter(s => s.seasonId === comparisonSeasonId)
        : clientSales;

      const allProducts = await storage.getAllProducts();
      const allCategories = await storage.getAllCategories();
      const productMap = new Map(allProducts.map(p => [p.id, p]));
      const categoryMap = new Map(allCategories.map(c => [c.id, c]));

      const outrosCategory = allCategories.find(c => c.name === 'Outros');
      const outrosCategoryId = outrosCategory?.id || 'uncategorized';

      const findProductAndCategory = (historyItemName: string) => {
        const matchedProduct = allProducts.find(p =>
          p.name.toUpperCase() === historyItemName.toUpperCase() ||
          p.name.toUpperCase().includes(historyItemName.toUpperCase()) ||
          historyItemName.toUpperCase().includes(p.name.toUpperCase())
        );
        return {
          categoryId: matchedProduct ? matchedProduct.categoryId : outrosCategoryId,
          segment: matchedProduct?.segment || null,
          subcategoryId: matchedProduct?.subcategoryId || null
        };
      };

      const groupedByCategory: Record<string, {
        categoryId: string;
        categoryName: string;
        historicalProducts: any[];
        currentSeasonProducts: any[];
      }> = {};

      historyItems.forEach(item => {
        const { categoryId, segment, subcategoryId } = findProductAndCategory(item.productName);
        const categoryName = categoryMap.get(categoryId)?.name || 'Não Categorizado';

        if (!groupedByCategory[categoryId]) {
          groupedByCategory[categoryId] = {
            categoryId,
            categoryName,
            historicalProducts: [],
            currentSeasonProducts: []
          };
        }

        groupedByCategory[categoryId].historicalProducts.push({
          productCode: item.productCode,
          productName: item.productName,
          packageType: item.packageType,
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          totalPrice: parseFloat(item.totalPrice.toString()),
          purchaseDate: item.purchaseDate,
          segment: segment,
          subcategoryId: subcategoryId
        });
      });

      currentSeasonSales.forEach(sale => {
        const product = productMap.get(sale.productId);
        if (!product) return;

        const categoryId = product.categoryId;
        const categoryName = categoryMap.get(categoryId)?.name || 'Não Categorizado';

        if (!groupedByCategory[categoryId]) {
          groupedByCategory[categoryId] = {
            categoryId,
            categoryName,
            historicalProducts: [],
            currentSeasonProducts: []
          };
        }

        const quantity = sale.quantity ? parseFloat(sale.quantity.toString()) : 0;
        const totalAmount = parseFloat(sale.totalAmount.toString());
        const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;

        groupedByCategory[categoryId].currentSeasonProducts.push({
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice,
          totalPrice: totalAmount,
          saleDate: sale.saleDate,
          segment: product.segment || null,
          subcategoryId: product.subcategoryId || null
        });
      });

      const categoriesData = Object.values(groupedByCategory).sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName)
      );

      const monthlyTimeline = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthItems = historyItems.filter(item =>
          new Date(item.purchaseDate).getMonth() === i
        );

        return {
          month,
          monthName: new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
          hasPurchases: monthItems.length > 0,
          itemCount: monthItems.length,
          totalValue: monthItems.reduce((sum, item) =>
            sum + parseFloat(item.totalPrice.toString()), 0
          ),
          isCurrentMonth: new Date().getMonth() === i
        };
      });

      const currentSeasonMonthlyTimeline = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const monthSales = currentSeasonSales.filter(sale =>
          new Date(sale.saleDate).getMonth() === i
        );

        return {
          month,
          monthName: new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'short' }),
          hasPurchases: monthSales.length > 0,
          itemCount: monthSales.length,
          totalValue: monthSales.reduce((sum, sale) =>
            sum + parseFloat(sale.totalAmount.toString()), 0
          ),
          isCurrentMonth: new Date().getMonth() === i
        };
      });

      const totalSoldProducts = currentSeasonSales.length;
      const totalHistoricalProducts = historyItems.length;

      const summary = {
        totalHistoricalProducts,
        totalSoldThisSeason: totalSoldProducts,
        conversionRate: totalHistoricalProducts > 0
          ? ((totalSoldProducts / totalHistoricalProducts) * 100).toFixed(1)
          : '0'
      };

      let comparisonSeasonName = 'Safra Atual';
      if (comparisonSeasonId) {
        const allSeasons = await storage.getAllSeasons();
        const comparisonSeason = allSeasons.find(s => s.id === comparisonSeasonId);
        if (comparisonSeason) {
          comparisonSeasonName = comparisonSeason.name;
        }
      }

      res.json({
        clientId: history.clientId,
        seasonName: comparisonSeasonName,
        historicalSeasonName: history.seasonName,
        categoriesData,
        monthlyTimeline,
        currentSeasonMonthlyTimeline,
        summary
      });
    } catch (error) {
      console.error("Error fetching opportunities:", error);
      res.status(500).json({ error: "Failed to fetch opportunities" });
    }
  });

  app.delete("/api/purchase-history/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const success = await storage.deletePurchaseHistory(id, userId);
      if (!success) {
        return res.status(404).json({ error: "Purchase history not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting purchase history:", error);
      res.status(500).json({ error: "Failed to delete purchase history" });
    }
  });

}
