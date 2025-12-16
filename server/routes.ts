import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSaleSchema, insertClientSchema, insertCategorySchema, insertProductSchema, insertSeasonGoalSchema, insertSeasonSchema, insertExternalPurchaseSchema, insertClientFamilyRelationSchema, insertAlertSettingsSchema, insertAlertSchema, insertPurchaseHistorySchema, insertPurchaseHistoryItemSchema, insertFarmSchema, insertFieldSchema, subcategories, clients, sales, seasons, seasonGoals, categories, products, clientMarketRates, externalPurchases, purchaseHistory, marketBenchmarks, userClientLinks, masterClients, salesHistory, clientFamilyRelations, purchaseHistoryItems, barterSimulations, barterSimulationItems, farms, fields, passwordResetTokens, users, productsPriceTable, globalManagementApplications, clientApplicationTracking, insertClientApplicationTrackingSchema, clientCategoryPipeline, systemSettings } from "@shared/schema";
import { visits } from "@shared/schema.crm";
import { z } from "zod";
import multer from "multer";
import { importExcelFile, importClientsFromExcel } from "./import-excel";
import { setupAuth, requireAuth, requireSuperAdmin, requireManager } from "./auth";
import { db } from "./db";
import { eq, sql, and, gt, desc, inArray } from "drizzle-orm";
import { parseCVALEPDF } from "./parse-cvale-pdf";
import { emailService } from "./email";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function registerRoutes(app: Express): Promise<Server> {
  // Blueprint: javascript_auth_all_persistance - Setup auth routes
  setupAuth(app);

  // Add no-cache headers to all API routes to prevent cross-user data leakage
  app.use('/api/*', (req, res, next) => {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    next();
  });

  // Configure multer for file uploads
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

      res.json({ message: `Auto-populated segments for ${updatedCount} products` });
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
          errors.push(`Sale ${sale.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        message: `Configuração salva com sucesso! O potencial será calculado automaticamente para ${clientCount} clientes com badge (80/20 ou Mercado).`,
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
          rates.map(r => [`${top8020Clients[idx].id}-${r.categoryId}`, r])
        )
      );

      // Fetch all external purchases for this user and active season
      const allExternalPurchases = await Promise.all(
        top8020Clients.map(c => storage.getExternalPurchases(c.id, req.user!.id, seasonId))
      );
      const externalPurchasesMap = new Map(
        allExternalPurchases.flatMap((purchases, idx) =>
          purchases.map(p => [`${top8020Clients[idx].id}-${p.categoryId}`, p])
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
            const key = `${sale.categoryId}-${subcategoryId}`;
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
          const customRate = clientRatesMap.get(`${client.id}-${category.id}`);
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
          const externalPurchase = externalPurchasesMap.get(`${client.id}-${category.id}`);
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
              const cvaleSubAmount = salesBySubcategory[`${category.id}-${subcat.id}`] || 0;
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
              message: `O cliente ${client.name} está no grupo top 80/20 mas ainda não fez compras na safra ${activeSeason.name}.`,
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
            message: `A safra ${activeSeason.name} termina em ${daysUntilEnd} dias. Finalize suas vendas e metas!`,
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
      console.log(`[PDF Import] Available clients (${userClients.length}):`, userClients.map(c => c.name).join(', '));

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

      console.log(`[PDF Import] Matched client: ${matchedClient.name}`);

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

  // Admin routes
  app.get("/api/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ ...u, password: undefined })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/vendedores", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const vendedores = users.filter(u => u.role !== 'administrador');
      res.json(vendedores.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch vendedores" });
    }
  });

  app.get("/api/admin/user-client-links", requireSuperAdmin, async (req, res) => {
    try {
      const links = await db
        .select({
          id: userClientLinks.id,
          userId: userClientLinks.userId,
          masterClientId: userClientLinks.masterClientId,
          customName: userClientLinks.customName,
          isTop80_20: userClientLinks.isTop80_20,
          masterClient: {
            id: masterClients.id,
            name: masterClients.name,
            regionId: masterClients.regionId,
            plantingArea: masterClients.plantingArea,
          }
        })
        .from(userClientLinks)
        .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id));

      res.json(links);
    } catch (error) {
      console.error("Error fetching user client links:", error);
      res.status(500).json({ error: "Failed to fetch user client links" });
    }
  });

  app.delete("/api/admin/user-client-links/user/:userId", requireSuperAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      // Deletar todos os user_client_links do usuário
      await db.delete(userClientLinks)
        .where(eq(userClientLinks.userId, userId));

      res.json({ success: true, message: "Clientes do consultor excluídos com sucesso" });
    } catch (error) {
      console.error("Error deleting user client links:", error);
      res.status(500).json({ error: "Failed to delete user client links" });
    }
  });

  app.patch("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { role, name, managerId } = req.body;
      const updated = await storage.updateUser(req.params.id, { role, name, managerId });
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ ...updated, password: undefined });
    } catch (error) {
      res.status(400).json({ error: "Failed to update user" });
    }
  });

  app.get("/api/admin/users/:id/data-check", requireSuperAdmin, async (req, res) => {
    try {
      const userId = req.params.id;

      const clientsCount = await db.select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(eq(clients.userId, userId));

      const salesCount = await db.select({ count: sql<number>`count(*)` })
        .from(sales)
        .where(eq(sales.userId, userId));

      const goalsCount = await db.select({ count: sql<number>`count(*)` })
        .from(seasonGoals)
        .where(eq(seasonGoals.userId, userId));

      const marketRatesCount = await db.select({ count: sql<number>`count(*)` })
        .from(clientMarketRates)
        .where(eq(clientMarketRates.userId, userId));

      const externalPurchasesCount = await db.select({ count: sql<number>`count(*)` })
        .from(externalPurchases)
        .where(eq(externalPurchases.userId, userId));

      const purchaseHistoryCount = await db.select({ count: sql<number>`count(*)` })
        .from(purchaseHistory)
        .where(eq(purchaseHistory.userId, userId));

      const marketBenchmarksCount = await db.select({ count: sql<number>`count(*)` })
        .from(marketBenchmarks)
        .where(eq(marketBenchmarks.userId, userId));

      res.json({
        hasData: (
          Number(clientsCount[0]?.count || 0) > 0 ||
          Number(salesCount[0]?.count || 0) > 0 ||
          Number(goalsCount[0]?.count || 0) > 0 ||
          Number(marketRatesCount[0]?.count || 0) > 0 ||
          Number(externalPurchasesCount[0]?.count || 0) > 0 ||
          Number(purchaseHistoryCount[0]?.count || 0) > 0 ||
          Number(marketBenchmarksCount[0]?.count || 0) > 0
        ),
        data: {
          clients: Number(clientsCount[0]?.count || 0),
          sales: Number(salesCount[0]?.count || 0),
          goals: Number(goalsCount[0]?.count || 0),
          marketRates: Number(marketRatesCount[0]?.count || 0),
          externalPurchases: Number(externalPurchasesCount[0]?.count || 0),
          purchaseHistory: Number(purchaseHistoryCount[0]?.count || 0),
          marketBenchmarks: Number(marketBenchmarksCount[0]?.count || 0)
        }
      });
    } catch (error) {
      console.error("Error checking user data:", error);
      res.status(500).json({ error: "Failed to check user data" });
    }
  });

  app.delete("/api/admin/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const confirmed = req.query.confirmed === 'true';

      if (!confirmed) {
        return res.status(400).json({ error: "Deletion must be confirmed" });
      }

      // Delete in cascade order (children first, then parent)
      await db.delete(purchaseHistory).where(eq(purchaseHistory.userId, userId));
      await db.delete(externalPurchases).where(eq(externalPurchases.userId, userId));
      await db.delete(marketBenchmarks).where(eq(marketBenchmarks.userId, userId));
      await db.delete(clientMarketRates).where(eq(clientMarketRates.userId, userId));
      await db.delete(seasonGoals).where(eq(seasonGoals.userId, userId));
      await db.delete(sales).where(eq(sales.userId, userId));
      await db.delete(clients).where(eq(clients.userId, userId));

      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(400).json({ error: "Failed to delete user" });
    }
  });

  app.post("/api/admin/categories", requireSuperAdmin, async (req, res) => {
    try {
      const category = insertCategorySchema.parse(req.body);
      const newCategory = await storage.createCategory(category);
      res.status(201).json(newCategory);
    } catch (error) {
      res.status(400).json({ error: "Invalid category data" });
    }
  });

  app.patch("/api/admin/categories/:id", requireSuperAdmin, async (req, res) => {
    try {
      const updated = await storage.updateCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update category" });
    }
  });

  app.post("/api/admin/subcategories", requireSuperAdmin, async (req, res) => {
    try {
      const newSub = await db.insert(subcategories).values(req.body).returning();
      res.status(201).json(newSub[0]);
    } catch (error) {
      res.status(400).json({ error: "Invalid subcategory data" });
    }
  });

  app.patch("/api/admin/subcategories/:id", requireSuperAdmin, async (req, res) => {
    try {
      const updated = await db.update(subcategories)
        .set(req.body)
        .where(eq(subcategories.id, req.params.id))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ error: "Subcategory not found" });
      }
      res.json(updated[0]);
    } catch (error) {
      res.status(400).json({ error: "Failed to update subcategory" });
    }
  });

  app.post("/api/admin/products", requireSuperAdmin, async (req, res) => {
    try {
      const product = insertProductSchema.parse(req.body);
      const newProduct = await storage.createProduct(product);
      res.status(201).json(newProduct);
    } catch (error) {
      res.status(400).json({ error: "Invalid product data" });
    }
  });

  // Import products from Excel/CSV (admin)
  app.post("/api/admin/products/import", requireSuperAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const updateExisting = String(req.body?.updateExisting ?? "true").toLowerCase() !== "false";

      const XLSX = await import("xlsx");
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ error: "Planilha vazia" });
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

      // cache categories/subcategories to resolve by name/type
      const allCategories = (await db.select().from(categories)) as any[];
      const allSubcategories = (await db.select().from(subcategories)) as any[];

      const categoryById = new Map(allCategories.map((c: any) => [c.id, c]));
      const categoryByName = new Map(allCategories.map((c: any) => [String(c.name).trim().toLowerCase(), c]));
      const categoryByType = new Map(allCategories.map((c: any) => [String(c.type).trim().toLowerCase(), c]));

      const subcategoryById = new Map(allSubcategories.map((s: any) => [s.id, s]));
      const subcategoryByName = new Map(
        allSubcategories.map((s: any) => [`${s.categoryId}:${String(s.name).trim().toLowerCase()}`, s]),
      );

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          const rawName =
            row["name"] ??
            row["Name"] ??
            row["NOME"] ??
            row["Nome"] ??
            row["PRODUTO"] ??
            row["Produto"] ??
            row["produto"] ??
            "";
          const name = String(rawName).trim();
          if (!name) {
            errors.push(`Linha ${i + 2}: nome do produto vazio`);
            continue;
          }

          const rawCategory =
            row["categoryId"] ??
            row["CategoryId"] ??
            row["CATEGORIA_ID"] ??
            row["categoria_id"] ??
            row["category"] ??
            row["Category"] ??
            row["CATEGORIA"] ??
            row["Categoria"] ??
            row["categoria"] ??
            row["type"] ??
            row["Tipo"] ??
            row["TIPO"] ??
            "";
          const categoryToken = String(rawCategory).trim();

          let resolvedCategoryId: string | null = null;
          if (categoryToken) {
            const byId = categoryById.get(categoryToken);
            if (byId) resolvedCategoryId = byId.id;
            if (!resolvedCategoryId) {
              const byName = categoryByName.get(categoryToken.toLowerCase());
              if (byName) resolvedCategoryId = byName.id;
            }
            if (!resolvedCategoryId) {
              const byType = categoryByType.get(categoryToken.toLowerCase());
              if (byType) resolvedCategoryId = byType.id;
            }
          }

          if (!resolvedCategoryId) {
            errors.push(`Linha ${i + 2} (${name}): categoria inválida ou não encontrada (${categoryToken || "vazia"})`);
            continue;
          }

          const rawDescription = row["description"] ?? row["Descrição"] ?? row["Descricao"] ?? row["DESCRICAO"] ?? "";
          const description = String(rawDescription).trim() || null;

          const rawMarca = row["marca"] ?? row["Marca"] ?? row["MARCA"] ?? "";
          const marca = String(rawMarca).trim() || null;

          const rawPackageSize =
            row["packageSize"] ?? row["package_size"] ?? row["PackageSize"] ?? row["Tamanho"] ?? row["TAMANHO"] ?? "";
          const packageSizeStr = String(rawPackageSize).trim();
          const packageSize = packageSizeStr === "" ? null : String(packageSizeStr);

          const rawSegment = row["segment"] ?? row["Segmento"] ?? row["SEGMENTO"] ?? "";
          const segment = String(rawSegment).trim() || null;

          const rawSubcategory =
            row["subcategoryId"] ??
            row["SubcategoryId"] ??
            row["SUBCATEGORY_ID"] ??
            row["subcategoria_id"] ??
            row["Subcategoria"] ??
            row["SUBCATEGORIA"] ??
            "";
          const subcategoryToken = String(rawSubcategory).trim();
          let subcategoryId: string | null = null;
          if (subcategoryToken) {
            const byId = subcategoryById.get(subcategoryToken);
            if (byId) {
              subcategoryId = byId.id;
            } else {
              const byName = subcategoryByName.get(`${resolvedCategoryId}:${subcategoryToken.toLowerCase()}`);
              if (byName) subcategoryId = byName.id;
            }
          }

          const rawActive = row["isActive"] ?? row["Ativo"] ?? row["ativo"] ?? "";
          const isActive =
            rawActive === "" ? true : String(rawActive).toLowerCase() === "true" || String(rawActive) === "1";

          if (updateExisting) {
            const existing = await db
              .select({ id: products.id })
              .from(products)
              .where(and(eq(products.name, name), eq(products.categoryId, resolvedCategoryId)))
              .limit(1);
            if (existing.length > 0) {
              await db
                .update(products)
                .set({
                  description,
                  marca,
                  packageSize,
                  segment,
                  subcategoryId,
                  isActive,
                })
                .where(eq(products.id, existing[0].id));
              updated++;
              continue;
            }
          }

          await db.insert(products).values({
            name,
            categoryId: resolvedCategoryId,
            description,
            marca,
            packageSize,
            segment,
            subcategoryId,
            isActive,
          });
          created++;
        } catch (err: any) {
          console.error("Erro importando produto linha", i + 2, err);
          errors.push(`Linha ${i + 2}: ${err?.message || "erro desconhecido"}`);
        }
      }

      res.json({
        success: true,
        totalRows: data.length,
        created,
        updated,
        errors: errors.length ? errors.slice(0, 20) : undefined,
      });
    } catch (error) {
      console.error("Import products error:", error);
      res.status(500).json({ error: "Falha ao importar produtos" });
    }
  });

  app.patch("/api/admin/products/:id", requireSuperAdmin, async (req, res) => {
    try {
      const updated = await storage.updateProduct(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.post("/api/admin/products/auto-classify", requireSuperAdmin, async (req, res) => {
    try {
      const { classifyProductsBatch } = await import("./product-classifier");

      const products = await storage.getAllProducts();
      const agroquimicosProducts = products.filter(p => p.categoryId === 'cat-agroquimicos' && !p.subcategoryId);

      const classifications = classifyProductsBatch(agroquimicosProducts);

      let updatedCount = 0;
      for (const classification of classifications) {
        const updated = await storage.updateProduct(classification.id, {
          subcategoryId: classification.subcategoryId
        });
        if (updated) {
          updatedCount++;
        }
      }

      res.json({
        success: true,
        totalProducts: agroquimicosProducts.length,
        classified: updatedCount,
        details: classifications
      });
    } catch (error) {
      console.error("Error auto-classifying products:", error);
      res.status(500).json({ error: "Failed to auto-classify products" });
    }
  });

  app.post("/api/admin/sales/sync-categories", requireSuperAdmin, async (req, res) => {
    try {
      // Get all sales and products
      const allSales = await storage.getAllSales();
      const products = await storage.getAllProducts();

      // Create a map of productId -> current categoryId
      const productCategoryMap = new Map(
        products.map(p => [p.id, p.categoryId])
      );

      let updatedCount = 0;
      let notFoundCount = 0;

      // Update each sale's category to match current product category
      for (const sale of allSales) {
        const currentCategory = productCategoryMap.get(sale.productId);

        if (!currentCategory) {
          notFoundCount++;
          continue;
        }

        if (sale.categoryId !== currentCategory) {
          await db.update(sales)
            .set({ categoryId: currentCategory })
            .where(eq(sales.id, sale.id));
          updatedCount++;
        }
      }

      res.json({
        success: true,
        totalSales: allSales.length,
        updated: updatedCount,
        productsNotFound: notFoundCount,
        message: `${updatedCount} vendas atualizadas com as categorias atuais dos produtos`
      });
    } catch (error) {
      console.error("Error syncing sale categories:", error);
      res.status(500).json({ error: "Failed to sync sale categories" });
    }
  });

  // Timac Settings - Public endpoint for all authenticated users
  app.get("/api/timac-settings", requireAuth, async (req, res) => {
    try {
      const { timacSettings } = await import("@shared/schema");
      const settings = await db.select().from(timacSettings).limit(1);

      // If no settings exist, return defaults
      if (!settings.length) {
        return res.json({
          consultorValue: "0.76",
          gerentesValue: "0.76",
          faturistasValue: "0.76"
        });
      }

      res.json(settings[0]);
    } catch (error) {
      console.error("Error fetching Timac settings:", error);
      res.status(500).json({ error: "Failed to fetch Timac settings" });
    }
  });

  // Timac Settings Management (Super Admin only)
  app.get("/api/admin/timac-settings", requireSuperAdmin, async (req, res) => {
    try {
      const { timacSettings } = await import("@shared/schema");
      const settings = await db.select().from(timacSettings).limit(1);

      // If no settings exist, return defaults
      if (!settings.length) {
        return res.json({
          consultorValue: "0.76",
          gerentesValue: "0.76",
          faturistasValue: "0.76"
        });
      }

      res.json(settings[0]);
    } catch (error) {
      console.error("Error fetching Timac settings:", error);
      res.status(500).json({ error: "Failed to fetch Timac settings" });
    }
  });

  app.put("/api/admin/timac-settings", requireSuperAdmin, async (req, res) => {
    try {
      const { timacSettings, insertTimacSettingsSchema } = await import("@shared/schema");

      // Validate request body
      const data = insertTimacSettingsSchema.parse({
        consultorValue: String(req.body.consultorValue),
        gerentesValue: String(req.body.gerentesValue),
        faturistasValue: String(req.body.faturistasValue)
      });

      // Check if settings exist
      const existing = await db.select().from(timacSettings).limit(1);

      if (existing.length) {
        // Update existing
        const updated = await db.update(timacSettings)
          .set({
            consultorValue: data.consultorValue,
            gerentesValue: data.gerentesValue,
            faturistasValue: data.faturistasValue,
            updatedAt: new Date()
          })
          .where(eq(timacSettings.id, existing[0].id))
          .returning();
        res.json(updated[0]);
      } else {
        // Insert new
        const created = await db.insert(timacSettings)
          .values(data)
          .returning();
        res.json(created[0]);
      }
    } catch (error) {
      console.error("Error updating Timac settings:", error);
      res.status(500).json({ error: "Failed to update Timac settings" });
    }
  });

  app.patch("/api/admin/products/:id/timac-points", requireSuperAdmin, async (req, res) => {
    try {
      const { products } = await import("@shared/schema");
      const { timacPoints } = req.body;

      // Convert to string for decimal field
      const pointsValue = String(timacPoints || "0");

      const updated = await db.update(products)
        .set({ timacPoints: pointsValue })
        .where(eq(products.id, req.params.id))
        .returning();

      if (!updated.length) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating product Timac points:", error);
      res.status(500).json({ error: "Failed to update product Timac points" });
    }
  });

  // Master Clients Management (Super Admin only)
  app.get("/api/admin/master-clients", requireSuperAdmin, async (req, res) => {
    try {
      const clients = await storage.getAllMasterClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master clients" });
    }
  });

  app.get("/api/admin/master-clients/:id", requireSuperAdmin, async (req, res) => {
    try {
      const client = await storage.getMasterClient(req.params.id);
      if (!client) {
        return res.status(404).json({ error: "Master client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch master client" });
    }
  });

  app.post("/api/admin/master-clients", requireSuperAdmin, async (req, res) => {
    try {
      const { insertMasterClientSchema } = await import("@shared/schema");
      const clientData = insertMasterClientSchema.parse(req.body);
      const newClient = await storage.createMasterClient(clientData);
      res.status(201).json(newClient);
    } catch (error) {
      res.status(400).json({ error: "Invalid master client data" });
    }
  });

  // Specific routes MUST come before parameterized routes to avoid conflicts
  app.post("/api/admin/master-clients/merge", requireSuperAdmin, async (req, res) => {
    try {
      const { sourceId, targetId } = req.body;
      if (!sourceId || !targetId) {
        return res.status(400).json({ error: "sourceId and targetId are required" });
      }
      await storage.mergeMasterClients(sourceId, targetId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to merge master clients" });
    }
  });

  app.delete("/api/admin/master-clients/delete-all", requireSuperAdmin, async (req, res) => {
    try {
      // Execute in transaction to ensure atomicity
      await db.transaction(async (tx) => {
        // 1. Delete deepest level dependencies first
        await tx.delete(barterSimulationItems); // references barter_simulations
        await tx.delete(purchaseHistoryItems); // references purchase_history

        // 2. Delete barter simulations (references user_client_links)
        await tx.delete(barterSimulations);

        // 3. Delete all data that references user_client_links
        await tx.delete(sales);
        await tx.delete(seasonGoals);
        await tx.delete(clientMarketRates);
        await tx.delete(externalPurchases);
        await tx.delete(purchaseHistory);
        await tx.delete(marketBenchmarks);
        await tx.delete(salesHistory);
        await tx.delete(clientFamilyRelations);

        // 4. Delete all user client links (references master_clients)
        await tx.delete(userClientLinks);

        // 5. Finally, delete all master clients
        await tx.delete(masterClients);
      });

      res.json({
        success: true,
        message: "Todos os clientes master e dados relacionados foram excluídos com sucesso"
      });
    } catch (error) {
      console.error('Delete all clients error:', error);
      res.status(500).json({ error: "Failed to delete all clients" });
    }
  });

  // Parameterized routes MUST come after specific routes
  app.patch("/api/admin/master-clients/:id", requireSuperAdmin, async (req, res) => {
    try {
      const updated = await storage.updateMasterClient(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Master client not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Failed to update master client" });
    }
  });

  app.delete("/api/admin/master-clients/:id", requireSuperAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteMasterClient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Master client not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete master client" });
    }
  });

  app.post("/api/admin/migrate-clients", requireSuperAdmin, async (req, res) => {
    try {
      const oldClients = await storage.getAllClients();
      const normalizeClientName = (name: string) => {
        return name.toUpperCase().trim().replace(/[.,\-\s]/g, '');
      };

      const clientsByName = new Map<string, any[]>();
      for (const client of oldClients) {
        const normalized = normalizeClientName(client.name);
        if (!clientsByName.has(normalized)) {
          clientsByName.set(normalized, []);
        }
        clientsByName.get(normalized)!.push(client);
      }

      let masterClientsCreated = 0;
      let linksCreated = 0;

      for (const [normalizedName, clientGroup] of Array.from(clientsByName.entries())) {
        const firstClient = clientGroup[0];

        let masterClient = await storage.findMasterClientByName(firstClient.name);
        if (!masterClient) {
          masterClient = await storage.createMasterClient({
            name: firstClient.name,
            regionId: firstClient.regionId,
            plantingArea: firstClient.plantingArea,
            cultures: firstClient.cultures || [],
            isActive: true
          });
          masterClientsCreated++;
        }

        for (const client of clientGroup) {
          if (!client.userId) continue;

          const existingLink = await storage.getUserClientLink(client.userId, masterClient.id);
          if (!existingLink) {
            await storage.createUserClientLink({
              userId: client.userId,
              masterClientId: masterClient.id,
              customName: null,
              plantingArea: client.plantingArea !== firstClient.plantingArea ? client.plantingArea : null,
              cultures: null,
              plantingProgress: client.plantingProgress || "0.00",
              isTop80_20: client.isTop80_20,
              isActive: client.isActive
            });
            linksCreated++;
          }
        }
      }

      res.json({
        success: true,
        masterClientsCreated,
        linksCreated,
        totalOldClients: oldClients.length
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ error: "Failed to migrate clients" });
    }
  });

  app.post("/api/admin/transfer-clients", requireSuperAdmin, async (req, res) => {
    try {
      const { fromUserId, toUserId } = req.body;

      if (!fromUserId || !toUserId) {
        return res.status(400).json({ error: "fromUserId and toUserId are required" });
      }

      if (fromUserId === toUserId) {
        return res.status(400).json({ error: "Cannot transfer to the same user" });
      }

      // Validate that both users exist and toUserId is not admin
      const fromUser = await storage.getUser(fromUserId);
      const toUser = await storage.getUser(toUserId);

      if (!fromUser || !toUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (toUser.role === 'administrador') {
        return res.status(400).json({ error: "Cannot transfer clients to administrator" });
      }

      // Get all links from source user
      const sourceLinks = await db.select()
        .from(userClientLinks)
        .where(eq(userClientLinks.userId, fromUserId));

      // Get existing links from target user to check for duplicates
      const targetLinks = await db.select()
        .from(userClientLinks)
        .where(eq(userClientLinks.userId, toUserId));

      const targetMasterClientIds = new Set(targetLinks.map(l => l.masterClientId));

      let transferred = 0;
      let skipped = 0;

      for (const link of sourceLinks) {
        if (targetMasterClientIds.has(link.masterClientId)) {
          // Target already has this master client, delete source link
          await db.delete(userClientLinks)
            .where(eq(userClientLinks.id, link.id));
          skipped++;
        } else {
          // Transfer the link
          await db.update(userClientLinks)
            .set({ userId: toUserId })
            .where(eq(userClientLinks.id, link.id));
          transferred++;
        }
      }

      res.json({
        success: true,
        transferred,
        skipped,
        message: `${transferred} clientes transferidos, ${skipped} duplicados removidos`
      });
    } catch (error) {
      console.error('Transfer error:', error);
      res.status(500).json({ error: "Failed to transfer clients" });
    }
  });

  // PRICE TABLE ROUTES (for product management)

  app.get("/api/admin/price-table", requireSuperAdmin, async (req, res) => {
    try {
      const products = await db.select()
        .from(productsPriceTable)
        .where(eq(productsPriceTable.isActive, true))
        .orderBy(productsPriceTable.categoria, productsPriceTable.mercaderia);
      res.json(products);
    } catch (error) {
      console.error('Get price table error:', error);
      res.status(500).json({ error: "Failed to get price table products" });
    }
  });

  app.post("/api/admin/price-table", requireSuperAdmin, async (req, res) => {
    try {
      const productData = {
        mercaderia: req.body.mercaderia,
        principioAtivo: req.body.principioAtivo || null,
        categoria: req.body.categoria,
        subcategory: req.body.subcategory || null,
        dose: req.body.dose || null,
        fabricante: req.body.fabricante || null,
        precoVerde: req.body.precoVerde,
        precoAmarela: req.body.precoAmarela,
        precoVermelha: req.body.precoVermelha,
        unidade: req.body.unidade || "$/ha",
        isActive: true
      };

      const [newProduct] = await db.insert(productsPriceTable)
        .values(productData)
        .returning();

      res.json(newProduct);
    } catch (error) {
      console.error('Create price table product error:', error);
      res.status(500).json({ error: "Failed to create price table product" });
    }
  });

  app.patch("/api/admin/price-table/:id", requireSuperAdmin, async (req, res) => {
    try {
      const updateData = {
        mercaderia: req.body.mercaderia,
        principioAtivo: req.body.principioAtivo || null,
        categoria: req.body.categoria,
        subcategory: req.body.subcategory || null,
        dose: req.body.dose || null,
        fabricante: req.body.fabricante || null,
        precoVerde: req.body.precoVerde,
        precoAmarela: req.body.precoAmarela,
        precoVermelha: req.body.precoVermelha,
        unidade: req.body.unidade || "$/ha",
        updatedAt: sql`now()`
      };

      const [updated] = await db.update(productsPriceTable)
        .set(updateData)
        .where(eq(productsPriceTable.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json(updated);
    } catch (error) {
      console.error('Update price table product error:', error);
      res.status(500).json({ error: "Failed to update price table product" });
    }
  });

  app.delete("/api/admin/price-table/:id", requireSuperAdmin, async (req, res) => {
    try {
      // Soft delete - just mark as inactive
      const [deleted] = await db.update(productsPriceTable)
        .set({ isActive: false, updatedAt: sql`now()` })
        .where(eq(productsPriceTable.id, req.params.id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Delete price table product error:', error);
      res.status(500).json({ error: "Failed to delete price table product" });
    }
  });

  app.post("/api/admin/price-table/import", requireSuperAdmin, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      console.log('Importando planilha com', data.length, 'linhas');
      console.log('Primeira linha:', data[0]);

      let imported = 0;
      let errors: string[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i] as any;
        try {
          // Map Excel columns to database fields
          const productData = {
            mercaderia: (row['Mercadería'] || row['MERCADERIA'] || row['Mercaderia'] || row['mercaderia'] || '').toString().trim(),
            principioAtivo: (row['P.A.'] || row['P.A'] || row['PA'] || row['Principio Ativo'] || row['principio_ativo'] || '').toString().trim(),
            categoria: ((row['CATEGORIA'] || row['Categoria'] || row['categoria'] || 'FUNGICIDAS').toString().trim()).toUpperCase(),
            dose: (row['Dose'] || row['DOSE'] || row['dose'] || '').toString().trim(),
            fabricante: (row['Fabricante'] || row['FABRICANTE'] || row['fabricante'] || '').toString().trim(),
            precoVerde: (row['Verde'] || row['VERDE'] || row['verde'] || row['Preco Verde'] || '0').toString().trim(),
            precoAmarela: (row['Amarela'] || row['AMARELA'] || row['amarela'] || row['Preco Amarela'] || '0').toString().trim(),
            precoVermelha: (row['Vermelha'] || row['VERMELHA'] || row['vermelha'] || row['Preco Vermelha'] || '0').toString().trim(),
            unidade: (row['UNIDADE'] || row['Unidade'] || row['unidade'] || '$/ha').toString().trim()
          };

          if (!productData.mercaderia || productData.mercaderia.trim() === '') {
            errors.push(`Linha ${i + 1}: Mercaderia vazia ou não encontrada. Colunas disponíveis: ${Object.keys(row).join(', ')}`);
            continue;
          }

          console.log(`Importando linha ${i + 1}:`, productData.mercaderia);
          await db.insert(productsPriceTable).values(productData);
          imported++;
        } catch (error: any) {
          console.error(`Erro na linha ${i + 1}:`, error);
          errors.push(`Linha ${i + 1} (${row['MERCADERIA'] || row['Mercaderia'] || 'sem nome'}): ${error.message}`);
        }
      }

      console.log(`Importação finalizada: ${imported} produtos de ${data.length} linhas`);
      if (errors.length > 0) {
        console.log('Erros:', errors.slice(0, 5));
      }

      res.json({
        success: true,
        imported,
        totalRows: data.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined
      });
    } catch (error) {
      console.error('Import price table error:', error);
      res.status(500).json({ error: "Falha ao importar planilha" });
    }
  });

  // Migration endpoint to fix categoria in client_application_tracking
  app.post("/api/admin/migrate-application-categories", requireSuperAdmin, async (req, res) => {
    try {
      const { clientApplicationTracking } = await import("@shared/schema");

      // Map subcategories to main categories (include all variations with/without accents)
      const subcategoryVariations = [
        'FUNGICIDAS',
        'INSETICIDAS',
        'TRATAMENTO_SEMENTE',
        'TRATAMENTO DE SEMENTE',
        'DESSECACAO',
        'DESSECAÇÃO'
      ];

      let updated = 0;

      // Update each subcategory variation
      for (const subcategory of subcategoryVariations) {
        const result = await db.update(clientApplicationTracking)
          .set({ categoria: 'Agroquímicos' })
          .where(eq(clientApplicationTracking.categoria, subcategory));

        console.log(`Migrated ${subcategory} -> Agroquímicos`);
        updated++;
      }

      res.json({
        success: true,
        message: `Migração concluída. ${updated} tipos de subcategorias processadas.`,
        subcategories: subcategoryVariations
      });
    } catch (error) {
      console.error('Migration error:', error);
      res.status(500).json({ error: "Falha na migração de categorias" });
    }
  });

  // SYSTEM SETTINGS - Configurações gerais do sistema (somente super admin)

  app.get("/api/admin/system-settings", requireSuperAdmin, async (req, res) => {
    try {
      const [settings] = await db.select()
        .from(systemSettings)
        .limit(1);

      // Se não existir, criar com valores padrão
      if (!settings) {
        const [newSettings] = await db.insert(systemSettings)
          .values({ allowUserRegistration: true })
          .returning();
        return res.json(newSettings);
      }

      res.json(settings);
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ error: "Failed to get system settings" });
    }
  });

  app.patch("/api/admin/system-settings", requireSuperAdmin, async (req, res) => {
    try {
      const { allowUserRegistration } = req.body;

      if (typeof allowUserRegistration !== 'boolean') {
        return res.status(400).json({ error: "allowUserRegistration must be a boolean" });
      }

      // Pegar o primeiro registro ou criar se não existir
      const [existingSettings] = await db.select()
        .from(systemSettings)
        .limit(1);

      if (!existingSettings) {
        // Criar novo registro
        const [newSettings] = await db.insert(systemSettings)
          .values({ allowUserRegistration })
          .returning();
        return res.json(newSettings);
      }

      // Atualizar registro existente
      const [updated] = await db.update(systemSettings)
        .set({ allowUserRegistration, updatedAt: sql`now()` })
        .where(eq(systemSettings.id, existingSettings.id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error('Update system settings error:', error);
      res.status(500).json({ error: "Failed to update system settings" });
    }
  });

  // PUBLIC API - Check if user registration is allowed (for login page)
  app.get("/api/system-settings", async (req, res) => {
    try {
      const [settings] = await db.select({
        allowUserRegistration: systemSettings.allowUserRegistration
      })
        .from(systemSettings)
        .limit(1);

      // Se não existir configuração, retornar padrão (permitir cadastro)
      res.json({
        allowUserRegistration: settings?.allowUserRegistration ?? true
      });
    } catch (error) {
      console.error('Get system settings error:', error);
      // Em caso de erro, permitir cadastro por padrão
      res.json({
        allowUserRegistration: true
      });
    }
  });

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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
      const userId = (req.user as any).id;
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
    }
  });

  // ========== KANBAN DE METAS ROUTES ==========

  // Get Kanban data (clients with potentials, sales, opportunities)
  app.get("/api/kanban-metas", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const seasonId = req.query.seasonId as string;

      if (!seasonId) {
        return res.status(400).json({ error: "seasonId is required" });
      }

      const data = await storage.getKanbanData(userId, seasonId);
      res.json(data);
    } catch (error) {
      console.error("Error fetching kanban data:", error);
      res.status(500).json({ error: "Failed to fetch kanban data" });
    }
  });

  // Get category cards for Market Opportunity page
  app.get("/api/market-opportunity/category-cards/:seasonId", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const userId = req.user.id;
      const { seasonId } = req.params;

      console.log(`[MARKET-CARDS] Fetching cards for Season: ${seasonId}, User: ${userId}`);

      // Get all categories
      const allCategories = await db.select().from(categories);

      // Get user's clients with badge amarelo (includeInMarketArea) - for potential calculation
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

      console.log(`[MARKET-CARDS] User ${userId}: Found ${salesData.length} total sales`);

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

      console.log(`[MARKET-CARDS] Pipeline Statuses: ${pipelineStatuses.length}`, pipelineStatuses.slice(0, 3));
      console.log(`[MARKET-CARDS] All Apps: ${allApps.length}, Valid Apps: ${validApps.length}`);

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
      console.log(`[MARKET-CARDS] Pipeline Map Keys (Clients): ${pipelineMap.size}`);

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

            const rate = ratesMap.get(client.id)?.get(category.id);

            // Calculate Potential
            let potentialValue = 0;
            let area = parseFloat(client.userArea || client.masterArea || '0');

            if (rate) {
              const investmentPerHa = parseFloat(rate.investmentPerHa || '0') || 0;
              if (!isNaN(investmentPerHa) && !isNaN(area) && area > 0) {
                potentialValue = area * investmentPerHa;
                if (!isNaN(potentialValue)) {
                  catData.potentialUsd += potentialValue;
                  catData.potentialHa += area;
                  clientCatEntry.potentialUsd += potentialValue;
                }
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
          subcategories: {} as Record<string, number>
        },
        fertilizantes: 0,
        sementes: 0,
        corretivos: 0,
        especialidades: 0
      };

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
          }
        } catch (e) {
          // ignore segment error
        }
      });

      // 2. General Segments Breakdown (from CategoryData)
      categoryData.forEach(cat => {
        // Mapping based on category type
        const type = normalizeString(cat.categoryType);
        if (type.includes('fertilizante')) {
          segmentBreakdown.fertilizantes += cat.oportunidadesUsd;
        } else if (type.includes('semente')) {
          segmentBreakdown.sementes += cat.oportunidadesUsd;
        } else if (type.includes('corretivo')) {
          segmentBreakdown.corretivos += cat.oportunidadesUsd;
        } else if (type.includes('especialidade') || type.includes('foliar') || type.includes('biologico')) {
          segmentBreakdown.especialidades += cat.oportunidadesUsd;
        }
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

      // Verify client belongs to user and get client data
      const clientData = await db.select({
        masterClientName: masterClients.name,
        masterClientArea: masterClients.plantingArea,
        userClientArea: userClientLinks.plantingArea,
        masterClientCreditLine: masterClients.creditLine,
        userClientLinkId: userClientLinks.id
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

      const currentSeasonTotal = currentSeasonSales.reduce((sum, sale) => {
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

      // Get potential (clientMarketRates)
      const potentials = await storage.getClientMarketRates(clientId, userId, seasonId);

      // Get market values (clientMarketValues)
      const marketValues = await storage.getClientMarketValues(clientId, userId, seasonId);

      // Get pipeline data
      // Em alguns bancos (como produção antiga) a tabela client_category_pipeline pode não existir ainda.
      // Neste caso, tratamos como se não houvesse pipeline configurado e seguimos normalmente.
      let pipeline: any[] = [];
      try {
        pipeline = await storage.getClientCategoryPipeline(clientId, userId, seasonId);
        console.log(`[CLIENT-MARKET-PANEL] Fetched ${pipeline.length} pipeline records for client ${clientId}, season ${seasonId}`);
        if (pipeline.length > 0) {
          console.log(`[CLIENT-MARKET-PANEL] Pipeline records:`, JSON.stringify(pipeline, null, 2));
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
          const key = `${app.categoria}-${app.applicationNumber}`;
          const clientArea = parseFloat(client.userClientArea || client.masterClientArea || '0') || 0;
          const pricePerHa = parseFloat(app.pricePerHa || '0') || 0;
          const totalValue = app.trackingTotalValue
            ? (parseFloat(app.trackingTotalValue) || 0)
            : (isNaN(pricePerHa) || isNaN(clientArea) ? 0 : pricePerHa * clientArea);

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

      console.log("PATCH /api/client-market-panel", { clientId, userId, creditLine, seasonId });

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
          console.log(`[CLIENT-MARKET-PANEL] Updating pipeline for client ${clientId}, season ${seasonId}, items: ${pipelineStatuses.length}`);
          console.log(`[CLIENT-MARKET-PANEL] Pipeline statuses payload:`, JSON.stringify(pipelineStatuses, null, 2));
          
          const finalSeasonId = seasonId || (await storage.getActiveSeason())?.id;
          if (!finalSeasonId) {
            console.error('[CLIENT-MARKET-PANEL] No seasonId available for pipeline update');
            return res.status(400).json({ error: "seasonId is required" });
          }
          
          for (const ps of pipelineStatuses) {
            // Filter out null statuses - if status is null, we should delete the record or set to ABERTO
            const finalStatus = ps.status === null ? 'ABERTO' : ps.status;
            
            console.log(`[CLIENT-MARKET-PANEL] Upserting pipeline: category=${ps.categoryId}, status=${finalStatus} (original: ${ps.status}), season=${finalSeasonId}`);
            
            const result = await storage.upsertClientCategoryPipeline({
              clientId,
              categoryId: ps.categoryId,
              userId,
              seasonId: finalSeasonId,
              status: finalStatus
            });
            console.log(`[CLIENT-MARKET-PANEL] Pipeline upsert result:`, JSON.stringify(result, null, 2));
          }
          console.log(`[CLIENT-MARKET-PANEL] Successfully updated ${pipelineStatuses.length} pipeline statuses`);

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
        console.log(`[CLIENT-MARKET-PANEL] No pipeline statuses to update (pipelineStatuses=${pipelineStatuses}, length=${pipelineStatuses?.length || 0})`);
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

  // ========== PASSWORD RESET ROUTES ==========

  // Request password reset
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { username } = req.body;

      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      // Find user by username
      const user = await db.select().from(users).where(eq(users.username, username)).limit(1);

      if (!user || user.length === 0) {
        // Don't reveal if user exists or not for security
        return res.json({ message: "If the username exists, a password reset email has been sent." });
      }

      const foundUser = user[0];

      // Generate reset token
      const resetToken = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      // Save token to database
      await db.insert(passwordResetTokens).values({
        userId: foundUser.id,
        token: resetToken,
        expiresAt,
      });

      // Send email (if configured)
      if (emailService.isConfigured()) {
        const emailSent = await emailService.sendPasswordResetEmail(
          username, // Using username as email for now
          resetToken,
          foundUser.name
        );

        if (!emailSent) {
          console.error("Failed to send password reset email");
        }
      } else {
        console.log(`Password reset token for ${username}: ${resetToken} `);
        console.log(`Reset URL: ${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'} /reset-password/${resetToken} `);
      }

      res.json({ message: "If the username exists, a password reset email has been sent." });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Find valid token
      const { isNull } = await import("drizzle-orm");
      const resetTokens = await db
        .select()
        .from(passwordResetTokens)
        .where(
          and(
            eq(passwordResetTokens.token, token),
            gt(passwordResetTokens.expiresAt, new Date()),
            isNull(passwordResetTokens.usedAt)
          )
        )
        .limit(1);

      if (!resetTokens || resetTokens.length === 0) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      const resetToken = resetTokens[0];

      // Hash new password
      const salt = randomBytes(16).toString("hex");
      const buf = (await scryptAsync(newPassword, salt, 64)) as Buffer;
      const hashedPassword = `${buf.toString("hex")}.${salt} `;

      // Update user password
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, resetToken.userId));

      // Mark token as used
      await db
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, resetToken.id));

      res.json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ========== ADMIN DASHBOARD ROUTES ==========

  // Get regional sales analysis for admin dashboard
  app.get("/api/admin/regional-sales", requireSuperAdmin, async (req, res) => {
    try {
      const { sales, userClientLinks, masterClients, products, regions } = await import("@shared/schema");
      const { inArray, sql } = await import("drizzle-orm");

      // Get all sales with client and product details
      const allSales = await db
        .select({
          saleId: sales.id,
          totalAmount: sales.totalAmount,
          quantity: sales.quantity,
          saleDate: sales.saleDate,
          clientId: sales.clientId,
          productId: sales.productId,
          productName: products.name,
          productBrand: products.marca,
          categoryId: products.categoryId,
          clientName: masterClients.name,
          regionId: masterClients.regionId,
        })
        .from(sales)
        .leftJoin(userClientLinks, eq(sales.clientId, userClientLinks.id))
        .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .leftJoin(products, eq(sales.productId, products.id));

      // Get all regions
      const allRegions = await db.select().from(regions);

      // Aggregate data by region
      const regionalData: Record<string, {
        regionName: string;
        totalSales: number;
        totalVolume: number;
        salesCount: number;
        products: Record<string, {
          productName: string;
          brand: string;
          volume: number;
          sales: number;
          category: string;
        }>;
      }> = {};

      // Initialize regions
      allRegions.forEach(region => {
        regionalData[region.id] = {
          regionName: region.name,
          totalSales: 0,
          totalVolume: 0,
          salesCount: 0,
          products: {},
        };
      });

      // Aggregate sales data
      allSales.forEach(sale => {
        const regionId = sale.regionId || 'unknown';

        // Initialize region if not exists
        if (!regionalData[regionId]) {
          regionalData[regionId] = {
            regionName: 'Região Desconhecida',
            totalSales: 0,
            totalVolume: 0,
            salesCount: 0,
            products: {},
          };
        }

        const amount = parseFloat(sale.totalAmount || "0");
        const volume = parseFloat(sale.quantity || "0");

        regionalData[regionId].totalSales += amount;
        regionalData[regionId].totalVolume += volume;
        regionalData[regionId].salesCount++;

        // Aggregate by product
        if (sale.productId && sale.productName) {
          const productKey = `${sale.productId} -${sale.productBrand || 'no-brand'} `;

          if (!regionalData[regionId].products[productKey]) {
            regionalData[regionId].products[productKey] = {
              productName: sale.productName,
              brand: sale.productBrand || 'N/A',
              volume: 0,
              sales: 0,
              category: sale.categoryId || 'N/A',
            };
          }

          regionalData[regionId].products[productKey].volume += volume;
          regionalData[regionId].products[productKey].sales += amount;
        }
      });

      // Convert to array and sort products
      const result = Object.entries(regionalData).map(([regionId, data]) => ({
        regionId,
        regionName: data.regionName,
        totalSales: data.totalSales,
        totalVolume: data.totalVolume,
        salesCount: data.salesCount,
        topProducts: Object.values(data.products)
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 5),
      })).sort((a, b) => b.totalSales - a.totalSales);

      res.json(result);
    } catch (error) {
      console.error("Error fetching regional sales:", error);
      res.status(500).json({ error: "Failed to fetch regional sales data" });
    }
  });

  // ========== MANAGER ROUTES ==========

  // Get team aggregated data for dashboard
  app.get("/api/manager/team-data", requireManager, async (req, res) => {
    try {
      const { users, sales, products } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({
          totalSales: 0,
          salesByCategory: {},
          salesBySeason: {},
          clientSales: {},
          totalTimacPoints: 0,
          teamMembers: [],
        });
      }

      // Get all sales from team with products
      const teamSales = await db
        .select({
          sale: sales,
          product: products,
        })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .where(inArray(sales.userId, teamIds));

      // Calculate aggregations
      let totalSales = 0;
      const salesByCategory: Record<string, number> = {};
      const salesBySeason: Record<string, number> = {};
      const clientSales: Record<string, number> = {};
      const memberSales: Record<string, { totalSales: number; timacPoints: number }> = {};
      let totalTimacPoints = 0;

      // Initialize member sales
      teamMembers.forEach(member => {
        memberSales[member.id] = { totalSales: 0, timacPoints: 0 };
      });

      // Get unique client IDs from sales
      const clientIds = Array.from(new Set(teamSales.map(s => s.sale.clientId).filter(Boolean)));

      // Fetch client details
      const { userClientLinks, masterClients } = await import("@shared/schema");
      const clientDetails = await db
        .select({
          linkId: userClientLinks.id,
          clientName: masterClients.name,
        })
        .from(userClientLinks)
        .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(inArray(userClientLinks.id, clientIds as string[]));

      const clientNameMap = new Map(
        clientDetails.map(c => [c.linkId, c.clientName])
      );

      teamSales.forEach(({ sale, product }) => {
        const value = parseFloat(sale.totalAmount || "0");

        // Total sales
        totalSales += value;

        // Sales by category
        if (sale.categoryId) {
          salesByCategory[sale.categoryId] = (salesByCategory[sale.categoryId] || 0) + value;
        }

        // Sales by season
        if (sale.seasonId) {
          salesBySeason[sale.seasonId] = (salesBySeason[sale.seasonId] || 0) + value;
        }

        // Sales by client (use client name instead of ID)
        if (sale.clientId) {
          const clientName = clientNameMap.get(sale.clientId) || sale.clientId;
          clientSales[clientName] = (clientSales[clientName] || 0) + value;
        }

        // Member sales
        if (memberSales[sale.userId]) {
          memberSales[sale.userId].totalSales += value;
        }

        // Timac points calculation
        if (product && product.marca?.toLowerCase().includes('timac') && sale.categoryId === 'cat-especialidades') {
          const quantity = parseFloat(sale.quantity || "0");
          const packageSize = parseFloat(product.packageSize || "1");
          const timacPoints = parseFloat(product.timacPoints || "0");

          const cantPedido = packageSize > 0 ? quantity / packageSize : 0;
          const quantidadeTotal = cantPedido * packageSize;
          const points = timacPoints * quantidadeTotal;

          totalTimacPoints += points;

          if (memberSales[sale.userId]) {
            memberSales[sale.userId].timacPoints += points;
          }
        }
      });

      // Build team members array with their data
      const teamMembersData = teamMembers.map(member => ({
        id: member.id,
        name: member.name,
        totalSales: memberSales[member.id].totalSales,
        timacPoints: memberSales[member.id].timacPoints,
      }));

      // Get Timac settings for gerentes value
      const { timacSettings } = await import("@shared/schema");
      const timacConfig = await db.select().from(timacSettings).limit(1);
      const gerentesValue = timacConfig[0]?.gerentesValue || "0.76";

      res.json({
        totalSales,
        salesByCategory,
        salesBySeason,
        clientSales,
        totalTimacPoints,
        gerentesValue,
        teamMembers: teamMembersData,
      });
    } catch (error) {
      console.error("Error fetching team data:", error);
      res.status(500).json({ error: "Failed to fetch team data" });
    }
  });

  // Get team consultors
  app.get("/api/manager/team", requireManager, async (req, res) => {
    try {
      const { users } = await import("@shared/schema");
      const managerId = req.user!.id;

      const teamMembers = await db
        .select({
          id: users.id,
          name: users.name,
          username: users.username,
          role: users.role,
        })
        .from(users)
        .where(eq(users.managerId, managerId));

      res.json(teamMembers);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  // Get team consolidated sales (without commissions)
  app.get("/api/manager/team-sales", requireManager, async (req, res) => {
    try {
      const { users, sales } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({
          totalSales: 0,
          salesByCategory: {},
          salesBySeason: {},
          topClients: [],
        });
      }

      // Get all sales from team
      const teamSales = await db
        .select()
        .from(sales)
        .where(inArray(sales.userId, teamIds));

      // Calculate aggregations
      const totalSales = teamSales.reduce((sum, sale) => sum + parseFloat(sale.totalAmount || "0"), 0);

      const salesByCategory: Record<string, number> = {};
      const salesBySeason: Record<string, number> = {};
      const clientSales: Record<string, number> = {};

      // Get unique client IDs from sales
      const clientIds = Array.from(new Set(teamSales.map(s => s.clientId).filter(Boolean)));

      // Fetch client details
      const { userClientLinks, masterClients } = await import("@shared/schema");
      const clientDetails = await db
        .select({
          linkId: userClientLinks.id,
          clientName: masterClients.name,
        })
        .from(userClientLinks)
        .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(inArray(userClientLinks.id, clientIds as string[]));

      const clientNameMap = new Map(
        clientDetails.map(c => [c.linkId, c.clientName])
      );

      teamSales.forEach(sale => {
        const value = parseFloat(sale.totalAmount || "0");

        if (sale.categoryId) {
          salesByCategory[sale.categoryId] = (salesByCategory[sale.categoryId] || 0) + value;
        }
        if (sale.seasonId) {
          salesBySeason[sale.seasonId] = (salesBySeason[sale.seasonId] || 0) + value;
        }
        if (sale.clientId) {
          const clientName = clientNameMap.get(sale.clientId) || sale.clientId;
          clientSales[clientName] = (clientSales[clientName] || 0) + value;
        }
      });

      // Top 5 clients
      const topClients = Object.entries(clientSales)
        .map(([clientId, value]) => ({ clientId, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      res.json({
        totalSales,
        salesByCategory,
        salesBySeason,
        topClients,
      });
    } catch (error) {
      console.error("Error fetching team sales:", error);
      res.status(500).json({ error: "Failed to fetch team sales" });
    }
  });

  // Get team Timac points
  app.get("/api/manager/team-timac-points", requireManager, async (req, res) => {
    try {
      const { users, sales, products } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({ totalPoints: 0, pointsByConsultor: [] });
      }

      // Get all Timac sales (marca = Timac AND categoria = Especialidades)
      const teamSales = await db
        .select({
          sale: sales,
          product: products,
        })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .where(inArray(sales.userId, teamIds));

      let totalPoints = 0;
      const pointsByConsultor: Record<string, { consultorId: string; points: number }> = {};

      teamSales.forEach(({ sale, product }) => {
        if (product && product.marca?.toLowerCase().includes('timac') && sale.categoryId === 'cat-especialidades') {
          const quantity = parseFloat(sale.quantity || "0");
          const packageSize = parseFloat(product.packageSize || "1");
          const timacPoints = parseFloat(product.timacPoints || "0");

          const cantPedido = packageSize > 0 ? quantity / packageSize : 0;
          const quantidadeTotal = cantPedido * packageSize;
          const points = timacPoints * quantidadeTotal;

          totalPoints += points;

          if (!pointsByConsultor[sale.userId]) {
            pointsByConsultor[sale.userId] = { consultorId: sale.userId, points: 0 };
          }
          pointsByConsultor[sale.userId].points += points;
        }
      });

      res.json({
        totalPoints,
        pointsByConsultor: Object.values(pointsByConsultor),
      });
    } catch (error) {
      console.error("Error fetching team Timac points:", error);
      res.status(500).json({ error: "Failed to fetch team Timac points" });
    }
  });

  // Get team season goals aggregated
  app.get("/api/manager/team-goals", requireManager, async (req, res) => {
    try {
      const { users, seasonGoals } = await import("@shared/schema");
      const { inArray, sql } = await import("drizzle-orm");
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json([]);
      }

      // Get aggregated goals by season
      const goals = await db
        .select({
          seasonId: seasonGoals.seasonId,
          totalGoal: sql<number>`SUM(CAST(${seasonGoals.goalAmount} AS NUMERIC))`,
        })
        .from(seasonGoals)
        .where(inArray(seasonGoals.userId, teamIds))
        .groupBy(seasonGoals.seasonId);

      res.json(goals);
    } catch (error) {
      console.error("Error fetching team goals:", error);
      res.status(500).json({ error: "Failed to fetch team goals" });
    }
  });

  // Get team sales evolution (monthly aggregation by category)
  app.get("/api/manager/team-sales-evolution", requireManager, async (req, res) => {
    try {
      const { users, sales, products, categories } = await import("@shared/schema");
      const { inArray, sql } = await import("drizzle-orm");
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json([]);
      }

      // Get sales grouped by month and category
      const monthlySalesByCategory = await db
        .select({
          month: sql<string>`TO_CHAR(${sales.saleDate}, 'YYYY-MM')`,
          category: categories.name,
          totalAmount: sql<number>`SUM(CAST(${sales.totalAmount} AS NUMERIC))`,
        })
        .from(sales)
        .leftJoin(products, eq(sales.productId, products.id))
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(inArray(sales.userId, teamIds))
        .groupBy(sql`TO_CHAR(${sales.saleDate}, 'YYYY-MM')`, categories.name)
        .orderBy(sql`TO_CHAR(${sales.saleDate}, 'YYYY-MM')`);

      res.json(monthlySalesByCategory);
    } catch (error) {
      console.error("Error fetching team sales evolution:", error);
      res.status(500).json({ error: "Failed to fetch team sales evolution" });
    }
  });

  // Get team market benchmarks for multiple seasons (average of consultors' manually entered percentages)
  app.get("/api/manager/team-market-benchmarks-multi", requireManager, async (req, res) => {
    try {
      const { marketBenchmarks, users } = await import("@shared/schema");
      const { inArray: inArrayOp, and } = await import("drizzle-orm");
      const managerId = req.user!.id;
      const seasonIds = (req.query.seasonIds as string)?.split(',').filter(Boolean) || [];

      if (seasonIds.length === 0) {
        return res.json({});
      }

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({});
      }

      // Get categories to map categoryId to name
      const categories = await storage.getAllCategories();
      const categoryMap = new Map(categories.map(c => [c.id, c.name]));

      // Get benchmarks for team members and requested seasons
      const benchmarks = await db
        .select()
        .from(marketBenchmarks)
        .where(and(
          inArrayOp(marketBenchmarks.userId, teamIds),
          inArrayOp(marketBenchmarks.seasonId, seasonIds)
        ));

      // Group by season and calculate average per category
      const result: Record<string, Record<string, number>> = {};

      seasonIds.forEach(seasonId => {
        const seasonBenchmarks = benchmarks.filter(b => b.seasonId === seasonId);

        // Group by category and collect all percentages
        const categoryPercentages: Record<string, number[]> = {};

        seasonBenchmarks.forEach(benchmark => {
          const categoryName = categoryMap.get(benchmark.categoryId);
          if (categoryName) {
            if (!categoryPercentages[categoryName]) {
              categoryPercentages[categoryName] = [];
            }
            categoryPercentages[categoryName].push(parseFloat(benchmark.marketPercentage));
          }
        });

        // Calculate average for each category
        const categoryAverages: Record<string, number> = {};
        Object.entries(categoryPercentages).forEach(([categoryName, percentages]) => {
          if (percentages.length > 0) {
            const average = percentages.reduce((sum, val) => sum + val, 0) / percentages.length;
            categoryAverages[categoryName] = average;
          }
        });

        result[seasonId] = categoryAverages;
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching multi-season team market benchmarks:", error);
      res.status(500).json({ error: "Failed to fetch team market benchmarks" });
    }
  });

  // Get team market benchmarks
  app.get("/api/manager/team-market-benchmarks/:seasonId", requireManager, async (req, res) => {
    try {
      const { users, marketBenchmarks } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      const { seasonId } = req.params;
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json([]);
      }

      // Get any team member's benchmarks (they should all be the same for the organization)
      // Or we could aggregate/average them
      const benchmarks = await db
        .select()
        .from(marketBenchmarks)
        .where(eq(marketBenchmarks.seasonId, seasonId))
        .limit(10); // Get first set of benchmarks for this season

      res.json(benchmarks);
    } catch (error) {
      console.error("Error fetching team market benchmarks:", error);
      res.status(500).json({ error: "Failed to fetch team market benchmarks" });
    }
  });

  // Get team market analysis for multiple seasons
  app.get("/api/manager/team-market-analysis-multi", requireManager, async (req, res) => {
    try {
      const { users, externalPurchases, sales: salesTable } = await import("@shared/schema");
      const { inArray, and } = await import("drizzle-orm");
      const managerId = req.user!.id;
      const seasonIds = (req.query.seasonIds as string)?.split(',').filter(Boolean) || [];

      if (seasonIds.length === 0) {
        return res.json({});
      }

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({});
      }

      const categories = await storage.getAllCategories();
      const products = await storage.getAllProducts();

      // Create product-to-category map
      const productCategoryMap = new Map<string, string>();
      products.forEach(p => {
        if (p.categoryId) {
          productCategoryMap.set(p.id, p.categoryId);
        }
      });

      // Result structure: { seasonId: { categoryName: percentage } }
      const result: Record<string, Record<string, number>> = {};

      for (const seasonId of seasonIds) {
        const categoryDataById: Record<string, {
          categoryName: string;
          cvaleAmount: number;
          totalAmount: number;
        }> = {};

        // Initialize categories
        categories.forEach(cat => {
          categoryDataById[cat.id] = {
            categoryName: cat.name,
            cvaleAmount: 0,
            totalAmount: 0,
          };
        });

        // Get team sales for this season
        const teamSeasonSales = await db
          .select()
          .from(salesTable)
          .where(and(
            inArray(salesTable.userId, teamIds),
            eq(salesTable.seasonId, seasonId)
          ));

        // Get external purchases for this season
        const teamExternalPurchases = await db
          .select()
          .from(externalPurchases)
          .where(and(
            inArray(externalPurchases.userId, teamIds),
            eq(externalPurchases.seasonId, seasonId)
          ));

        // Aggregate C.Vale sales
        teamSeasonSales.forEach(sale => {
          const categoryId = productCategoryMap.get(sale.productId);
          if (categoryId && categoryDataById[categoryId]) {
            const amount = parseFloat(sale.totalAmount || '0');
            categoryDataById[categoryId].cvaleAmount += amount;
            categoryDataById[categoryId].totalAmount += amount;
          }
        });

        // Add external purchases
        teamExternalPurchases.forEach(purchase => {
          const categoryId = purchase.categoryId;
          if (categoryId && categoryDataById[categoryId]) {
            const amount = parseFloat(purchase.amount || '0');
            categoryDataById[categoryId].totalAmount += amount;
          }
        });

        // Transform to category name -> percentage
        const categoryPercentages: Record<string, number> = {};
        Object.values(categoryDataById).forEach(cat => {
          const percentage = cat.totalAmount > 0 ? (cat.cvaleAmount / cat.totalAmount) * 100 : 0;
          categoryPercentages[cat.categoryName] = percentage;
        });

        result[seasonId] = categoryPercentages;
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching multi-season team market analysis:", error);
      res.status(500).json({ error: "Failed to fetch market analysis" });
    }
  });

  // Get team sales vs goals for multiple seasons (percentage achievement)
  app.get("/api/manager/team-sales-vs-goals-multi", requireManager, async (req, res) => {
    try {
      const { users, seasonGoals } = await import("@shared/schema");
      const { inArray, and } = await import("drizzle-orm");
      const managerId = req.user!.id;
      const seasonIds = (req.query.seasonIds as string)?.split(',').filter(Boolean) || [];

      if (seasonIds.length === 0) {
        return res.json({});
      }

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({});
      }

      // Get all necessary data
      const allSales = await storage.getAllSales();
      const categories = await storage.getAllCategories();
      const products = await storage.getAllProducts();

      // Get manager's goals for all requested seasons
      const managerGoals = await db
        .select()
        .from(seasonGoals)
        .where(and(
          eq(seasonGoals.userId, managerId),
          inArray(seasonGoals.seasonId, seasonIds)
        ));

      // Create maps
      const productCategoryMap = new Map<string, string>();
      products.forEach(p => {
        if (p.categoryId) {
          productCategoryMap.set(p.id, p.categoryId);
        }
      });

      const categoryNameMap = new Map<string, string>();
      categories.forEach(cat => {
        categoryNameMap.set(cat.id, cat.name);
      });

      // Category name to meta field mapping
      const categoryMetaFieldMap: Record<string, string> = {
        'Agroquímicos': 'metaAgroquimicos',
        'Especialidades': 'metaEspecialidades',
        'Fertilizantes': 'metaFertilizantes',
        'Corretivos': 'metaCorretivos',
        'Sementes Soja': 'metaSementesSoja',
        'Sementes Milho': 'metaSementesMilho',
        'Sementes Trigo': 'metaSementesTrigo',
        'Sementes Diversas': 'metaSementesDiversas',
      };

      const result: Record<string, Record<string, number>> = {};

      // Process each season
      for (const seasonId of seasonIds) {
        // Find manager's goal for this season
        const seasonGoal = managerGoals.find(g => g.seasonId === seasonId);

        if (!seasonGoal) {
          result[seasonId] = {};
          continue;
        }

        // Get team sales for this season
        const seasonSales = allSales.filter(s =>
          teamIds.includes(s.userId) && s.seasonId === seasonId
        );

        // Aggregate sales by category
        const categorySales: Record<string, number> = {};
        seasonSales.forEach(sale => {
          const categoryId = productCategoryMap.get(sale.productId);
          if (categoryId) {
            const categoryName = categoryNameMap.get(categoryId);
            if (categoryName) {
              if (!categorySales[categoryName]) {
                categorySales[categoryName] = 0;
              }
              categorySales[categoryName] += parseFloat(sale.totalAmount || '0');
            }
          }
        });

        // Calculate percentages (sales / goal * 100)
        const categoryPercentages: Record<string, number> = {};
        Object.entries(categoryMetaFieldMap).forEach(([categoryName, metaField]) => {
          const salesAmount = categorySales[categoryName] || 0;
          const goalAmount = parseFloat((seasonGoal as any)[metaField] || '0');

          const percentage = goalAmount > 0 ? (salesAmount / goalAmount) * 100 : 0;
          categoryPercentages[categoryName] = percentage;
        });

        result[seasonId] = categoryPercentages;
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching team sales vs goals:", error);
      res.status(500).json({ error: "Failed to fetch team sales vs goals" });
    }
  });

  // Get team market percentages for multiple seasons (marketPercentage column)
  app.get("/api/manager/team-market-percentages-multi", requireManager, async (req, res) => {
    try {
      const { users, clientMarketRates, userClientLinks, masterClients, clientApplicationTracking, globalManagementApplications, productsPriceTable } = await import("@shared/schema");
      const { inArray, and } = await import("drizzle-orm");
      const managerId = req.user!.id;
      const seasonIds = (req.query.seasonIds as string)?.split(',').filter(Boolean) || [];

      if (seasonIds.length === 0) {
        return res.json({});
      }

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({});
      }

      const categories = await storage.getAllCategories();
      const products = await storage.getAllProducts();
      const allSales = await storage.getAllSales();

      // Create product-to-category map
      const productCategoryMap = new Map<string, string>();
      products.forEach(p => {
        if (p.categoryId) {
          productCategoryMap.set(p.id, p.categoryId);
        }
      });

      // Create category name map
      const categoryNameMap = new Map<string, string>();
      categories.forEach(cat => {
        categoryNameMap.set(cat.id, cat.name);
      });

      // Result structure: { seasonId: { categoryName: marketPercentage } }
      const result: Record<string, Record<string, number>> = {};

      for (const seasonId of seasonIds) {
        // Get market clients for the team (includeInMarketArea=true)
        const teamMarketClients = await db.select({ id: userClientLinks.id })
          .from(userClientLinks)
          .where(and(
            inArray(userClientLinks.userId, teamIds),
            eq(userClientLinks.includeInMarketArea, true)
          ));

        const teamMarketClientIds = teamMarketClients.map(c => c.id);

        // Get team sales ONLY from market clients
        const teamSales = allSales.filter(s =>
          teamIds.includes(s.userId) &&
          s.seasonId === seasonId &&
          teamMarketClientIds.includes(s.clientId)
        );

        // Aggregate sales by category
        const salesByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          salesByCategory[cat.id] = 0;
        });

        teamSales.forEach(sale => {
          const categoryId = productCategoryMap.get(sale.productId);
          if (categoryId) {
            salesByCategory[categoryId] += parseFloat(sale.totalAmount || '0');
          }
        });

        // Get all client market rates for the team in this season
        // Only include clients marked as includeInMarketArea
        const teamMarketRates = await db.select()
          .from(clientMarketRates)
          .innerJoin(userClientLinks, eq(clientMarketRates.clientId, userClientLinks.id))
          .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
          .where(and(
            inArray(userClientLinks.userId, teamIds),
            eq(clientMarketRates.seasonId, seasonId),
            eq(userClientLinks.includeInMarketArea, true)
          ));

        // Calculate total potential by category
        const potentialByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          potentialByCategory[cat.id] = 0;
        });

        teamMarketRates.forEach(rate => {
          const categoryId = rate.client_market_rates.categoryId;
          const plantingArea = parseFloat(rate.master_clients.plantingArea || '0');
          const investmentPerHa = parseFloat(rate.client_market_rates.investmentPerHa || '0');
          const potential = plantingArea * investmentPerHa;

          if (potentialByCategory.hasOwnProperty(categoryId)) {
            potentialByCategory[categoryId] += potential;
          }
        });

        // Get FECHADO values from client_application_tracking
        // These are applications marked as "lost to competitor" in the Market Management Panel
        // All applications are under Agroquímicos category
        const agroquimicosCategory = categories.find(c => c.type === 'agroquimicos');
        const agroquimicosCategoryId = agroquimicosCategory?.id || '';

        const teamApplicationTrackingRaw = await db.select({
          clientId: clientApplicationTracking.clientId,
          productId: globalManagementApplications.productId,
          plantingArea: masterClients.plantingArea
        })
          .from(clientApplicationTracking)
          .innerJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
          .innerJoin(userClientLinks, eq(clientApplicationTracking.clientId, userClientLinks.id))
          .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
          .where(and(
            inArray(userClientLinks.userId, teamIds),
            eq(globalManagementApplications.seasonId, seasonId),
            eq(userClientLinks.includeInMarketArea, true),
            eq(clientApplicationTracking.status, 'FECHADO')
          ));

        // Get product prices for FECHADO applications
        const productIds = Array.from(new Set(teamApplicationTrackingRaw.map(t => t.productId)));
        const productPrices = productIds.length > 0 ? await db.select({
          id: productsPriceTable.id,
          precoVerde: productsPriceTable.precoVerde
        })
          .from(productsPriceTable)
          .where(inArray(productsPriceTable.id, productIds)) : [];

        const productPriceMap = new Map(productPrices.map(p => [p.id, parseFloat(p.precoVerde || '0')]));

        // Calculate total FECHADO value for Agroquímicos
        let totalFechadoAgroquimicos = 0;
        teamApplicationTrackingRaw.forEach(tracking => {
          const pricePerHa = productPriceMap.get(tracking.productId) || 0;
          const area = parseFloat(tracking.plantingArea || '0');
          totalFechadoAgroquimicos += pricePerHa * area;
        });

        // Aggregate FECHADO values by category
        const fechadoByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          fechadoByCategory[cat.id] = 0;
        });

        if (agroquimicosCategoryId) {
          fechadoByCategory[agroquimicosCategoryId] = totalFechadoAgroquimicos;
        }

        // Calculate Mercado automatically: Mercado = Potencial - C.Vale - FECHADO
        const marketValuesByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          const potential = potentialByCategory[cat.id] || 0;
          const sales = salesByCategory[cat.id] || 0;
          const fechado = fechadoByCategory[cat.id] || 0;

          // Mercado = Potential - Sales - Closed Applications
          const mercado = Math.max(0, potential - sales - fechado);
          marketValuesByCategory[cat.id] = mercado;
        });

        // Calculate market penetration: (C.Vale + Mercado) / potential * 100
        // Mercado = values from clientMarketValues (column Mercado in modal)
        // Ensure we include all major categories even if they have no data
        const categoryPercentages: Record<string, number> = {};

        // Define standard category names to ensure consistency with sales-vs-goals endpoint
        const standardCategories = [
          'Agroquímicos',
          'Especialidades',
          'Fertilizantes',
          'Corretivos',
          'Sementes Soja',
          'Sementes Milho',
          'Sementes Trigo',
          'Sementes Diversas'
        ];

        // Initialize all standard categories with 0
        standardCategories.forEach(catName => {
          categoryPercentages[catName] = 0;
        });

        // Calculate and populate actual values
        categories.forEach(cat => {
          const potential = potentialByCategory[cat.id] || 0;
          const sales = salesByCategory[cat.id] || 0;
          const mercado = marketValuesByCategory[cat.id] || 0;
          const totalWorked = sales + mercado; // C.Vale + Mercado

          const marketPercentage = potential > 0 ? (totalWorked / potential) * 100 : 0;
          const categoryName = categoryNameMap.get(cat.id);
          if (categoryName) {
            categoryPercentages[categoryName] = marketPercentage;
          }
        });

        result[seasonId] = categoryPercentages;
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching team market percentages:", error);
      res.status(500).json({ error: "Failed to fetch team market percentages" });
    }
  });

  // Get team market analysis consolidated
  app.get("/api/manager/team-market-analysis", requireManager, async (req, res) => {
    try {
      const { users, externalPurchases, seasonGoals, clientMarketRates, userClientLinks, masterClients, clientApplicationTracking, globalManagementApplications, productsPriceTable } = await import("@shared/schema");
      const { inArray, and } = await import("drizzle-orm");
      const managerId = req.user!.id;
      const seasonId = req.query.seasonId as string | undefined;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({
          consolidatedByCategory: {},
        });
      }

      // Get sales and categories
      const allSales = await storage.getAllSales();
      const categories = await storage.getAllCategories();
      const products = await storage.getAllProducts();

      // Get manager's goals for the season (if seasonId provided)
      let managerGoals: any = null;
      if (seasonId) {
        const goals = await db.select()
          .from(seasonGoals)
          .where(and(
            eq(seasonGoals.userId, managerId),
            eq(seasonGoals.seasonId, seasonId)
          ))
          .limit(1);
        managerGoals = goals[0] || null;
      }

      // Create product-to-category map (always use categoryId for aggregation)
      const productCategoryMap = new Map<string, string>();
      products.forEach(p => {
        if (p.categoryId) {
          productCategoryMap.set(p.id, p.categoryId);
        }
      });

      // Create category type map (categoryId -> type for segment mapping)
      const categoryToType = new Map<string, string>();
      categories.forEach(cat => {
        categoryToType.set(cat.id, cat.type);
      });

      // Aggregate sales by category for the team
      const consolidatedByCategory: Record<string, {
        categoryName: string;
        cvaleAmount: number;
        totalAmount: number;
        percentage: number;
        marketPercentage: number;
      }> = {};

      // Initialize categories
      categories.forEach(cat => {
        consolidatedByCategory[cat.id] = {
          categoryName: cat.name,
          cvaleAmount: 0,
          totalAmount: 0,
          percentage: 0,
          marketPercentage: 0,
        };
      });

      // Aggregate C.Vale sales (all sales in sales table are C.Vale)
      const teamSales = seasonId
        ? allSales.filter(s => teamIds.includes(s.userId) && s.seasonId === seasonId)
        : allSales.filter(s => teamIds.includes(s.userId));

      teamSales.forEach(sale => {
        const categoryId = productCategoryMap.get(sale.productId);
        if (categoryId && consolidatedByCategory[categoryId]) {
          const amount = parseFloat(sale.totalAmount || '0');
          consolidatedByCategory[categoryId].cvaleAmount += amount;
        }
      });

      // Calculate C.Vale percentage: (vendas equipe / meta do gestor) * 100
      if (managerGoals) {
        const categoryMetaFieldMap: Record<string, string> = {
          'Agroquímicos': 'metaAgroquimicos',
          'Especialidades': 'metaEspecialidades',
          'Fertilizantes': 'metaFertilizantes',
          'Corretivos': 'metaCorretivos',
          'Sementes Soja': 'metaSementesSoja',
        };

        Object.keys(consolidatedByCategory).forEach(catId => {
          const cat = consolidatedByCategory[catId];
          const metaField = categoryMetaFieldMap[cat.categoryName];
          if (metaField) {
            const goalAmount = parseFloat((managerGoals as any)[metaField] || '0');
            cat.percentage = goalAmount > 0 ? (cat.cvaleAmount / goalAmount) * 100 : 0;
          }
        });
      }

      // Calculate Market percentage: (vendas + aplicações FECHADAS) / potencial total * 100
      if (seasonId) {
        // Get all client market rates for the team in this season
        // Only include clients marked as includeInMarketArea
        const teamMarketRates = await db.select()
          .from(clientMarketRates)
          .innerJoin(userClientLinks, eq(clientMarketRates.clientId, userClientLinks.id))
          .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
          .where(and(
            inArray(userClientLinks.userId, teamIds),
            eq(clientMarketRates.seasonId, seasonId),
            eq(userClientLinks.includeInMarketArea, true)
          ));

        // Calculate total potential by category
        const potentialByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          potentialByCategory[cat.id] = 0;
        });

        teamMarketRates.forEach(rate => {
          const categoryId = rate.client_market_rates.categoryId;
          const plantingArea = parseFloat(rate.master_clients.plantingArea || '0');
          const investmentPerHa = parseFloat(rate.client_market_rates.investmentPerHa || '0');
          const potential = plantingArea * investmentPerHa;

          if (potentialByCategory.hasOwnProperty(categoryId)) {
            potentialByCategory[categoryId] += potential;
          }
        });

        // Get all FECHADAS applications for the team in this season
        const fechadasApplications = await db.select()
          .from(clientApplicationTracking)
          .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
          .leftJoin(productsPriceTable, eq(globalManagementApplications.productId, productsPriceTable.id))
          .leftJoin(userClientLinks, eq(clientApplicationTracking.clientId, userClientLinks.id))
          .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
          .where(and(
            inArray(clientApplicationTracking.userId, teamIds),
            eq(clientApplicationTracking.seasonId, seasonId),
            eq(clientApplicationTracking.status, 'FECHADO')
          ));

        // Aggregate FECHADAS by category
        const fechadasByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          fechadasByCategory[cat.id] = 0;
        });

        fechadasApplications.forEach(app => {
          if (!app.client_application_tracking || !app.global_management_applications) return;

          const pricePerHa = parseFloat(app.global_management_applications.pricePerHa || '0');
          const plantingArea = app.master_clients ? parseFloat(app.master_clients.plantingArea || '0') : 0;
          const totalValue = pricePerHa * plantingArea;

          // All fechadas applications are agroquímicos - find the agroquímicos category
          const agroquimicosCategory = categories.find(cat => cat.type === 'agroquimicos');
          if (agroquimicosCategory) {
            if (!fechadasByCategory[agroquimicosCategory.id]) fechadasByCategory[agroquimicosCategory.id] = 0;
            fechadasByCategory[agroquimicosCategory.id] += totalValue;
          }
        });

        // Calculate market percentage: (sales + fechadas) / potential * 100
        Object.keys(consolidatedByCategory).forEach(catId => {
          const cat = consolidatedByCategory[catId];
          const potential = potentialByCategory[catId] || 0;
          const sales = cat.cvaleAmount;
          const fechadas = fechadasByCategory[catId] || 0;
          const totalRealized = sales + fechadas;

          cat.marketPercentage = potential > 0 ? (totalRealized / potential) * 100 : 0;
        });
      }

      res.json({
        consolidatedByCategory,
      });
    } catch (error) {
      console.error("Error fetching team market analysis:", error);
      res.status(500).json({ error: "Failed to fetch team market analysis" });
    }
  });

  // Get team captured totals (ONLY from ABERTO applications - new model)
  // Does NOT include sales_targets (old Kanban model)
  app.get("/api/manager/team-captured-totals", requireManager, async (req, res) => {
    try {
      const { users, seasons, clientApplicationTracking, globalManagementApplications, userClientLinks, masterClients } = await import("@shared/schema");
      const { inArray, and, sql: sqlFn } = await import("drizzle-orm");
      const managerId = req.user!.id;

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({ totalsBySeason: {} });
      }

      // Get all ABERTO applications (opportunities) for the team
      // Only include clients marked as 80-20 (isTop80_20 = true)
      const abertoApplications = await db
        .select({
          seasonId: clientApplicationTracking.seasonId,
          seasonName: sqlFn`COALESCE(${seasons.name}, 'Safra sem nome')`.as('season_name'),
          categoria: clientApplicationTracking.categoria,
          subcategoria: globalManagementApplications.categoria,
          applicationNumber: clientApplicationTracking.applicationNumber,
          pricePerHa: globalManagementApplications.pricePerHa,
          plantingArea: masterClients.plantingArea,
        })
        .from(clientApplicationTracking)
        .leftJoin(seasons, eq(clientApplicationTracking.seasonId, seasons.id))
        .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
        .leftJoin(userClientLinks, eq(clientApplicationTracking.clientId, userClientLinks.id))
        .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
        .where(and(
          inArray(clientApplicationTracking.userId, teamIds),
          eq(clientApplicationTracking.status, 'ABERTO'),
          eq(userClientLinks.isTop80_20, true)
        ));

      // Map segment to category name
      const segmentToCategoryName: Record<string, string> = {
        'fertilizantes': 'Fertilizantes',
        'agroquimicos': 'Agroquímicos',
        'especialidades': 'Especialidades',
        'sementes': 'Sementes',
        'corretivos': 'Corretivos',
      };

      // Map categoria to subcategory name
      const categoriaToSubcategoryName: Record<string, string> = {
        'FUNGICIDAS': 'Fungicidas',
        'INSETICIDAS': 'Inseticidas',
        'TRATAMENTO_SEMENTE': 'Tratamento de semente',
        'DESSECACAO': 'Dessecação',
      };

      // Aggregate by season, then by category
      const totalsBySeason: Record<string, {
        seasonName: string;
        seasonTotal: number;
        categories: Record<string, {
          categoryName: string;
          total: number;
          subcategories?: Record<string, number>;
        }>;
      }> = {};

      // Process ABERTO applications (open opportunities)
      abertoApplications.forEach(app => {
        if (!app.pricePerHa || !app.plantingArea) return;

        const seasonId = app.seasonId;
        const seasonName = String(app.seasonName || 'Safra sem nome');

        // Map category name to segmento (reverse lookup)
        const categoryNameToSegment: Record<string, string> = {
          'Fertilizantes': 'fertilizantes',
          'Agroquímicos': 'agroquimicos',
          'Especialidades': 'especialidades',
          'Sementes': 'sementes',
          'Corretivos': 'corretivos',
        };

        const segmento = categoryNameToSegment[app.categoria] || app.categoria.toLowerCase();
        const categoryName = app.categoria;
        const pricePerHa = parseFloat(app.pricePerHa || '0');
        const plantingArea = parseFloat(app.plantingArea || '0');
        const valor = pricePerHa * plantingArea;

        // Initialize season if not exists
        if (!totalsBySeason[seasonId]) {
          totalsBySeason[seasonId] = {
            seasonName,
            seasonTotal: 0,
            categories: {},
          };
        }

        // Add to season total
        totalsBySeason[seasonId].seasonTotal += valor;

        // Initialize category if not exists
        if (!totalsBySeason[seasonId].categories[segmento]) {
          totalsBySeason[seasonId].categories[segmento] = {
            categoryName,
            total: 0,
          };
        }

        // Add to category total
        totalsBySeason[seasonId].categories[segmento].total += valor;

        // Add to subcategory only for agroquimicos
        if (segmento === 'agroquimicos' && app.subcategoria) {
          const subcatName = categoriaToSubcategoryName[app.subcategoria] || app.subcategoria;
          if (!totalsBySeason[seasonId].categories[segmento].subcategories) {
            totalsBySeason[seasonId].categories[segmento].subcategories = {};
          }
          const subcat = totalsBySeason[seasonId].categories[segmento].subcategories!;
          if (!subcat[subcatName]) {
            subcat[subcatName] = 0;
          }
          subcat[subcatName] += valor;
        }
      });

      res.json({ totalsBySeason });
    } catch (error) {
      console.error("Error fetching team captured totals:", error);
      res.status(500).json({ error: "Failed to fetch team captured totals" });
    }
  });

  // Get team captured targets by category (with client details)
  // IMPORTANT: Only shows clients with isTop80_20 = true (green badge)
  // Uses ONLY ABERTO applications (new model), NOT sales_targets (old Kanban)
  app.get("/api/manager/team-captured-by-category/:segmento", requireManager, async (req, res) => {
    try {
      const { users, userClientLinks, masterClients, clientApplicationTracking, globalManagementApplications } = await import("@shared/schema");
      const { inArray } = await import("drizzle-orm");
      const managerId = req.user!.id;
      const { segmento } = req.params;
      const seasonId = req.query.seasonId as string;

      if (!seasonId) {
        return res.status(400).json({ error: "seasonId is required" });
      }

      // Get team member IDs
      const teamMembers = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.managerId, managerId));

      const teamIds = teamMembers.map(m => m.id);

      if (teamIds.length === 0) {
        return res.json({ clientTargets: [] });
      }

      // Map segment to category name for applications
      const segmentToCategoryName: Record<string, string> = {
        'fertilizantes': 'Fertilizantes',
        'agroquimicos': 'Agroquímicos',
        'especialidades': 'Especialidades',
        'sementes': 'Sementes',
      };
      const categoryName = segmentToCategoryName[segmento.toLowerCase()];

      // Get ABERTO applications for this category AND season (only 80-20 clients)
      let abertoApplications: Array<{
        clientId: string;
        userId: string;
        pricePerHa: string | null;
        plantingArea: string | null;
        applicationNumber: number;
        applicationSubcategory: string | null;
      }> = [];

      if (categoryName) {
        abertoApplications = await db
          .select({
            clientId: clientApplicationTracking.clientId,
            userId: clientApplicationTracking.userId,
            pricePerHa: globalManagementApplications.pricePerHa,
            plantingArea: masterClients.plantingArea,
            applicationNumber: clientApplicationTracking.applicationNumber,
            applicationSubcategory: globalManagementApplications.categoria,
          })
          .from(clientApplicationTracking)
          .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
          .leftJoin(userClientLinks, eq(clientApplicationTracking.clientId, userClientLinks.id))
          .leftJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
          .where(and(
            inArray(clientApplicationTracking.userId, teamIds),
            eq(clientApplicationTracking.status, 'ABERTO'),
            eq(clientApplicationTracking.categoria, categoryName),
            eq(clientApplicationTracking.seasonId, seasonId),
            eq(userClientLinks.isTop80_20, true)
          ));
      }

      // Aggregate by client
      const clientMap = new Map<string, {
        clientId: string;
        userId: string;
        valorCapturado: number;
        subcategories: Record<string, number> | null;
      }>();

      // Process ABERTO applications
      abertoApplications.forEach(app => {
        const pricePerHa = parseFloat(app.pricePerHa || '0');
        const plantingArea = parseFloat(app.plantingArea || '0');
        const totalValue = pricePerHa * plantingArea;

        if (!clientMap.has(app.clientId)) {
          clientMap.set(app.clientId, {
            clientId: app.clientId,
            userId: app.userId,
            valorCapturado: totalValue,
            subcategories: null,
          });
        } else {
          const existing = clientMap.get(app.clientId)!;
          existing.valorCapturado += totalValue;
        }

        // Handle subcategories for agroquimicos
        if (segmento.toLowerCase() === 'agroquimicos' && app.applicationSubcategory) {
          const existing = clientMap.get(app.clientId)!;
          if (!existing.subcategories) {
            existing.subcategories = {};
          }
          if (!existing.subcategories[app.applicationSubcategory]) {
            existing.subcategories[app.applicationSubcategory] = 0;
          }
          existing.subcategories[app.applicationSubcategory] += totalValue;
        }
      });

      // Get client details for all unique clients
      const uniqueClientIds = Array.from(clientMap.keys());
      if (uniqueClientIds.length === 0) {
        return res.json({ clientTargets: [] });
      }

      const userClientLinksData = await db
        .select()
        .from(userClientLinks)
        .where(inArray(userClientLinks.id, uniqueClientIds));

      const masterClientIds = userClientLinksData.map(link => link.masterClientId);
      const masterClientsData = await db
        .select()
        .from(masterClients)
        .where(inArray(masterClients.id, masterClientIds));

      // Build response with client details
      const clientTargets = Array.from(clientMap.values()).map(clientData => {
        const userClientLink = userClientLinksData.find(link => link.id === clientData.clientId);
        const masterClient = masterClientsData.find(mc => mc.id === userClientLink?.masterClientId);
        const consultor = teamMembers.find(m => m.id === clientData.userId);

        return {
          clientId: clientData.clientId,
          clientName: masterClient?.name || 'Cliente Desconhecido',
          consultorName: consultor?.username || 'Desconhecido',
          valorCapturado: clientData.valorCapturado,
          subcategories: clientData.subcategories,
        };
      });

      // Sort by value descending
      clientTargets.sort((a, b) => b.valorCapturado - a.valorCapturado);

      res.json({ clientTargets });
    } catch (error) {
      console.error("Error fetching team captured by category:", error);
      res.status(500).json({ error: "Failed to fetch team captured by category" });
    }
  });

  // Action Plans CRUD
  app.get("/api/manager/action-plans", requireManager, async (req, res) => {
    try {
      const { actionPlans } = await import("@shared/schema");
      const managerId = req.user!.id;

      const plans = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.managerId, managerId));

      res.json(plans);
    } catch (error) {
      console.error("Error fetching action plans:", error);
      res.status(500).json({ error: "Failed to fetch action plans" });
    }
  });

  app.post("/api/manager/action-plans", requireManager, async (req, res) => {
    try {
      const { actionPlans, seasons } = await import("@shared/schema");
      const { title, meetingDate, strengths, challenges, opportunities, nextMeetingDate } = req.body;

      // Get active season
      const [activeSeason] = await db
        .select()
        .from(seasons)
        .where(eq(seasons.isActive, true))
        .limit(1);

      if (!activeSeason) {
        return res.status(400).json({ error: "No active season found" });
      }

      const [plan] = await db.insert(actionPlans).values({
        title,
        managerId: req.user!.id,
        seasonId: activeSeason.id,
        meetingDate: new Date(meetingDate),
        targetAmount: "0",
        currentAmount: "0",
        status: "planejado",
        strengths: strengths || null,
        challenges: challenges || null,
        opportunities: opportunities || null,
        nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : null,
      }).returning();

      res.json(plan);
    } catch (error) {
      console.error("Error creating action plan:", error);
      res.status(400).json({ error: "Failed to create action plan" });
    }
  });

  app.get("/api/manager/action-plans/:id", requireManager, async (req, res) => {
    try {
      const { actionPlans, actionPlanItems, actionPlanParticipants } = await import("@shared/schema");
      const planId = req.params.id;

      const [plan] = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, planId));

      if (!plan) {
        return res.status(404).json({ error: "Action plan not found" });
      }

      if (plan.managerId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const items = await db
        .select()
        .from(actionPlanItems)
        .where(eq(actionPlanItems.planId, planId));

      const participants = await db
        .select()
        .from(actionPlanParticipants)
        .where(eq(actionPlanParticipants.planId, planId));

      res.json({ ...plan, items, participants });
    } catch (error) {
      console.error("Error fetching action plan:", error);
      res.status(500).json({ error: "Failed to fetch action plan" });
    }
  });

  app.patch("/api/manager/action-plans/:id", requireManager, async (req, res) => {
    try {
      const { actionPlans } = await import("@shared/schema");
      const planId = req.params.id;

      const [existing] = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, planId));

      if (!existing || existing.managerId !== req.user!.id) {
        return res.status(404).json({ error: "Action plan not found" });
      }

      const [updated] = await db
        .update(actionPlans)
        .set({ ...req.body, updatedAt: sql`now()` })
        .where(eq(actionPlans.id, planId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating action plan:", error);
      res.status(400).json({ error: "Failed to update action plan" });
    }
  });

  app.delete("/api/manager/action-plans/:id", requireManager, async (req, res) => {
    try {
      const { actionPlans } = await import("@shared/schema");
      const planId = req.params.id;

      const [existing] = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, planId));

      if (!existing || existing.managerId !== req.user!.id) {
        return res.status(404).json({ error: "Action plan not found" });
      }

      await db.delete(actionPlans).where(eq(actionPlans.id, planId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting action plan:", error);
      res.status(500).json({ error: "Failed to delete action plan" });
    }
  });

  // Action Plan Items CRUD
  app.post("/api/manager/action-plans/:planId/items", requireManager, async (req, res) => {
    try {
      const { actionPlans, actionPlanItems, insertActionPlanItemSchema } = await import("@shared/schema");
      const planId = req.params.planId;

      const [plan] = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, planId));

      if (!plan || plan.managerId !== req.user!.id) {
        return res.status(404).json({ error: "Action plan not found" });
      }

      const data = insertActionPlanItemSchema.parse(req.body);

      const [item] = await db.insert(actionPlanItems).values({
        ...data,
        planId,
      }).returning();

      res.json(item);
    } catch (error) {
      console.error("Error creating action plan item:", error);
      res.status(400).json({ error: "Failed to create action plan item" });
    }
  });

  app.patch("/api/manager/action-plan-items/:id", requireManager, async (req, res) => {
    try {
      const { actionPlanItems, actionPlans } = await import("@shared/schema");
      const itemId = req.params.id;

      const [item] = await db
        .select()
        .from(actionPlanItems)
        .where(eq(actionPlanItems.id, itemId));

      if (!item) {
        return res.status(404).json({ error: "Action plan item not found" });
      }

      const [plan] = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, item.planId));

      if (!plan || plan.managerId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const [updated] = await db
        .update(actionPlanItems)
        .set(req.body)
        .where(eq(actionPlanItems.id, itemId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating action plan item:", error);
      res.status(400).json({ error: "Failed to update action plan item" });
    }
  });

  app.delete("/api/manager/action-plan-items/:id", requireManager, async (req, res) => {
    try {
      const { actionPlanItems, actionPlans } = await import("@shared/schema");
      const itemId = req.params.id;

      const [item] = await db
        .select()
        .from(actionPlanItems)
        .where(eq(actionPlanItems.id, itemId));

      if (!item) {
        return res.status(404).json({ error: "Action plan item not found" });
      }

      const [plan] = await db
        .select()
        .from(actionPlans)
        .where(eq(actionPlans.id, item.planId));

      if (!plan || plan.managerId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await db.delete(actionPlanItems).where(eq(actionPlanItems.id, itemId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting action plan item:", error);
      res.status(500).json({ error: "Failed to delete action plan item" });
    }
  });

  // Consultor endpoints - view assigned actions
  app.get("/api/consultor/my-actions", requireAuth, async (req, res) => {
    try {
      const { actionPlanItems } = await import("@shared/schema");
      const userId = req.user!.id;

      const actions = await db
        .select()
        .from(actionPlanItems)
        .where(eq(actionPlanItems.consultorId, userId));

      res.json(actions);
    } catch (error) {
      console.error("Error fetching consultor actions:", error);
      res.status(500).json({ error: "Failed to fetch actions" });
    }
  });

  app.patch("/api/consultor/actions/:id", requireAuth, async (req, res) => {
    try {
      const { actionPlanItems } = await import("@shared/schema");
      const actionId = req.params.id;
      const userId = req.user!.id;

      const [action] = await db
        .select()
        .from(actionPlanItems)
        .where(eq(actionPlanItems.id, actionId));

      if (!action || action.consultorId !== userId) {
        return res.status(404).json({ error: "Action not found" });
      }

      const [updated] = await db
        .update(actionPlanItems)
        .set(req.body)
        .where(eq(actionPlanItems.id, actionId))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating action:", error);
      res.status(400).json({ error: "Failed to update action" });
    }
  });

  // Commodity price endpoint - Soybean price from Twelve Data
  app.get("/api/commodity/soybean", requireAuth, async (req, res) => {
    try {
      const apiKey = process.env.TWELVE_DATA_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "API key not configured" });
      }

      // Try soybean futures symbol ZS (CBOT)
      const response = await fetch(`https://api.twelvedata.com/price?symbol=ZS&apikey=${apiKey}`);

      if (!response.ok) {
        throw new Error(`Twelve Data API returned ${response.status}`);
      }

      const data = await response.json();

      // Check if we got a valid price
      if (data.price) {
        res.json({
          price: parseFloat(data.price),
          name: 'Soybean Futures',
          unit: 'per bushel'
        });
      } else if (data.status === 'error') {
        throw new Error(data.message || 'API error');
      } else {
        throw new Error('Invalid response format from API');
      }
    } catch (error) {
      console.error("Error fetching soybean price:", error);
      res.status(500).json({ error: "Failed to fetch commodity price" });
    }
  });

  // Faturista endpoints - Inventory Control System
  const requireFaturista = (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== 'faturista') {
      return res.status(403).json({ error: "Access denied. Faturista role required." });
    }
    next();
  };

  // Create upload session
  app.post("/api/faturista/upload-session", requireFaturista, async (req, res) => {
    try {
      const { uploadSessions, insertUploadSessionSchema } = await import("@shared/schema");
      const sessionData = insertUploadSessionSchema.parse({
        ...req.body,
        userId: req.user!.id
      });

      const [session] = await db.insert(uploadSessions).values(sessionData).returning();
      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating upload session:", error);
      res.status(400).json({ error: "Failed to create upload session" });
    }
  });

  // Upload inventory PDF
  app.post("/api/faturista/upload-inventory", requireFaturista, upload.single("file"), async (req, res) => {
    try {
      const { inventoryItems, uploadSessions } = await import("@shared/schema");
      const { parseInventoryPDF } = await import("./parse-inventory-pdf");

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const sessionId = req.body.sessionId;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Verify session exists and belongs to user
      const [session] = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.id, sessionId));

      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      const parsedItems = await parseInventoryPDF(req.file.buffer);

      if (!parsedItems || parsedItems.length === 0) {
        return res.status(400).json({
          error: "Nenhum item foi encontrado no PDF. Verifique se o formato está correto (C.VALE com colunas: Cód.Int, Mercaderia, Embalaje, Cantidad)."
        });
      }

      // Insert inventory items
      const items = await db.insert(inventoryItems).values(
        parsedItems.map(item => ({
          productCode: item.productCode,
          productName: item.productName,
          packageType: item.packageType || '',
          quantity: item.quantity.toString(),
          uploadedBy: req.user!.id,
          uploadSessionId: sessionId
        }))
      ).returning();

      // Update session with inventory file name
      await db
        .update(uploadSessions)
        .set({ inventoryFileName: req.file.originalname })
        .where(eq(uploadSessions.id, sessionId));

      res.json({
        success: true,
        itemsCount: items.length,
        items
      });
    } catch (error) {
      console.error("Error uploading inventory:", error);
      res.status(500).json({ error: "Failed to upload inventory" });
    }
  });

  // Upload orders PDF(s)
  app.post("/api/faturista/upload-orders", requireFaturista, upload.array("files", 10), async (req, res) => {
    try {
      const { pendingOrders, uploadSessions } = await import("@shared/schema");
      const { parseOrdersPDF } = await import("./parse-inventory-pdf");

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const sessionId = req.body.sessionId;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Verify session exists and belongs to user
      const [session] = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.id, sessionId));

      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      let allOrders: any[] = [];

      // Parse all PDFs
      for (const file of req.files) {
        const parsedOrders = await parseOrdersPDF(file.buffer);
        allOrders = allOrders.concat(parsedOrders);
      }

      if (!allOrders || allOrders.length === 0) {
        return res.status(400).json({
          error: "Nenhum pedido foi encontrado nos PDFs. Verifique se o formato está correto (C.VALE com colunas: Cód.Int, Mercaderia, Cant. Falta, Cliente, Vendedor)."
        });
      }

      // Insert pending orders
      const orders = await db.insert(pendingOrders).values(
        allOrders.map(order => ({
          productCode: order.productCode,
          productName: order.productName,
          packageType: order.packageType || '',
          quantityPending: order.quantityPending.toString(),
          clientName: order.clientName,
          consultorName: order.consultorName || null,
          orderCode: order.orderCode || null,
          uploadedBy: req.user!.id,
          uploadSessionId: sessionId
        }))
      ).returning();

      // Update session with order files count
      await db
        .update(uploadSessions)
        .set({ orderFilesCount: req.files.length })
        .where(eq(uploadSessions.id, sessionId));

      res.json({
        success: true,
        ordersCount: orders.length,
        filesProcessed: req.files.length,
        orders
      });
    } catch (error) {
      console.error("Error uploading orders:", error);
      res.status(500).json({ error: "Failed to upload orders" });
    }
  });

  // Analyze stock availability
  app.post("/api/faturista/analyze-stock", requireFaturista, async (req, res) => {
    try {
      const { stockAnalysisResults, inventoryItems, pendingOrders, uploadSessions } = await import("@shared/schema");

      const sessionId = req.body.sessionId;
      if (!sessionId) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      // Verify session exists and belongs to user
      const [session] = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.id, sessionId));

      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get inventory items for this session
      const inventory = await db
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.uploadSessionId, sessionId));

      // Get pending orders for this session
      const orders = await db
        .select()
        .from(pendingOrders)
        .where(eq(pendingOrders.uploadSessionId, sessionId));

      // Group orders by product code
      const ordersByProduct = orders.reduce((acc, order) => {
        if (!acc[order.productCode]) {
          acc[order.productCode] = {
            totalQuantity: 0,
            clients: []
          };
        }
        acc[order.productCode].totalQuantity += parseFloat(order.quantityPending);
        acc[order.productCode].clients.push({
          clientName: order.clientName,
          quantity: parseFloat(order.quantityPending)
        });
        return acc;
      }, {} as Record<string, { totalQuantity: number; clients: Array<{ clientName: string; quantity: number }> }>);

      console.log('=== ORDERS BY PRODUCT ===');
      console.log('Order codes:', Object.keys(ordersByProduct).slice(0, 10));
      console.log('Total order types:', Object.keys(ordersByProduct).length);

      // Calculate availability for each inventory item
      const analysisResults = [];

      console.log('=== INVENTORY ITEMS ===');
      console.log('First 10 inventory codes:', inventory.slice(0, 10).map(i => i.productCode));
      console.log('Total inventory items:', inventory.length);

      for (const item of inventory) {
        const stockQty = parseFloat(item.quantity);
        const ordersData = ordersByProduct[item.productCode];
        const ordersQty = ordersData ? ordersData.totalQuantity : 0;

        if (ordersQty > 0) {
          console.log(`Match found: ${item.productCode} - Stock: ${stockQty}, Orders: ${ordersQty}`);
        }

        let status = 'DISPONÍVEL';
        let percentage = 100;

        if (ordersQty > 0) {
          percentage = (stockQty / ordersQty) * 100;

          // Limit percentage to 999.99 (database constraint)
          if (percentage > 999.99) {
            percentage = 999.99;
          }

          if (percentage >= 100) {
            status = 'DISPONÍVEL';
          } else if (percentage >= 50) {
            status = 'PARCIAL';
          } else if (percentage > 0) {
            status = 'CRÍTICO';
          } else {
            status = 'INDISPONÍVEL';
          }
        }

        const result = {
          productCode: item.productCode,
          productName: item.productName,
          stockQuantity: stockQty.toString(),
          ordersQuantity: ordersQty.toString(),
          status,
          percentage: percentage.toFixed(2),
          clientsList: ordersData ? ordersData.clients : [],
          uploadSessionId: sessionId,
          createdBy: req.user!.id
        };

        analysisResults.push(result);
      }

      // Insert analysis results
      const results = await db.insert(stockAnalysisResults).values(analysisResults).returning();

      // Update session status
      await db
        .update(uploadSessions)
        .set({
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(uploadSessions.id, sessionId));

      res.json({
        success: true,
        resultsCount: results.length,
        results
      });
    } catch (error) {
      console.error("Error analyzing stock:", error);
      res.status(500).json({ error: "Failed to analyze stock" });
    }
  });

  // Get all sessions for user
  app.get("/api/faturista/sessions", requireFaturista, async (req, res) => {
    try {
      const { uploadSessions } = await import("@shared/schema");

      const sessions = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.userId, req.user!.id))
        .orderBy(sql`${uploadSessions.createdAt} DESC`);

      res.json(sessions);
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  // Get analysis results for a session
  app.get("/api/faturista/analysis/:sessionId", requireFaturista, async (req, res) => {
    try {
      const { stockAnalysisResults, uploadSessions } = await import("@shared/schema");
      const sessionId = req.params.sessionId;

      // Verify session exists and belongs to user
      const [session] = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.id, sessionId));

      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      const results = await db
        .select()
        .from(stockAnalysisResults)
        .where(eq(stockAnalysisResults.uploadSessionId, sessionId))
        .orderBy(
          sql`CASE 
            WHEN ${stockAnalysisResults.status} = 'INDISPONÍVEL' THEN 1
            WHEN ${stockAnalysisResults.status} = 'CRÍTICO' THEN 2
            WHEN ${stockAnalysisResults.status} = 'PARCIAL' THEN 3
            ELSE 4
          END`,
          sql`CAST(${stockAnalysisResults.percentage} AS DECIMAL)`
        );

      res.json(results);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ error: "Failed to fetch analysis" });
    }
  });

  // Delete session (cascade will delete related data)
  app.delete("/api/faturista/session/:id", requireFaturista, async (req, res) => {
    try {
      const { uploadSessions } = await import("@shared/schema");
      const sessionId = req.params.id;

      // Verify session exists and belongs to user
      const [session] = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.id, sessionId));

      if (!session || session.userId !== req.user!.id) {
        return res.status(404).json({ error: "Session not found" });
      }

      await db.delete(uploadSessions).where(eq(uploadSessions.id, sessionId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting session:", error);
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  // ============ CRM MOBILE ROUTES ============
  const { CRMStorage } = await import("./storage-crm");
  const { parseAgenda } = await import("./services/nlp.service");

  // VISITS
  app.get("/api/visits", requireAuth, async (req: any, res) => {
    const { assignee, updated_since } = req.query as { assignee?: string; updated_since?: string };
    const data = await CRMStorage.getVisits({ assignee, updatedSince: updated_since });

    // Enrich visits with farm coordinates
    const enriched = await Promise.all(data.map(async (visit: any) => {
      if (visit.farm_id) {
        const [farm] = await db.select().from(farms).where(eq(farms.id, visit.farm_id)).limit(1);
        if (farm) {
          return { ...visit, lat: farm.lat, lng: farm.lng };
        }
      }
      return visit;
    }));

    res.json(enriched);
  });

  app.get("/api/visits/route", requireAuth, async (req: any, res) => {
    const { assignee, date } = req.query as { assignee?: string; date?: string };
    const data = await CRMStorage.getRoute({ assignee, date });
    res.json(data);
  });

  app.post("/api/visits", requireAuth, async (req: any, res) => {
    const payload = Array.isArray(req.body) ? req.body : [req.body];

    console.log('📥 [DEBUG] POST /api/visits - Payload recebido:', JSON.stringify(payload, null, 2));

    // Validação: client_id é obrigatório e não pode ser vazio
    const invalidItems = payload.filter((v: any) => {
      const clientId = v.clientId || v.client_id;
      const isInvalid = !clientId || (typeof clientId === 'string' && clientId.trim() === '');

      if (isInvalid) {
        console.log('❌ Item inválido detectado:', {
          id: v.id,
          clientId: v.clientId,
          client_id: v.client_id,
          notes: v.notes
        });
      }

      return isInvalid;
    });

    if (invalidItems.length > 0) {
      console.error('❌ Visitas inválidas sem client_id:', invalidItems);
      return res.status(400).json({
        error: "client_id é obrigatório para todas as visitas",
        invalid_count: invalidItems.length,
        invalid_items: invalidItems.map((v: any) => ({ id: v.id, notes: v.notes }))
      });
    }

    const created = await CRMStorage.createVisitsBulk(payload);
    res.status(201).json(created);
  });

  app.patch("/api/visits/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const data = req.body;

    // Validação: se client_id estiver presente, não pode ser vazio
    if (data.client_id !== undefined) {
      if (!data.client_id || (typeof data.client_id === 'string' && data.client_id.trim() === '')) {
        return res.status(400).json({ error: "client_id não pode ser vazio" });
      }
    }

    const [updated] = await db.update(visits)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(visits.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Visita não encontrada" });
    }

    res.json(updated);
  });

  app.patch("/api/visits/:id/status", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const { status } = req.body as { status: any };
    const updated = await CRMStorage.updateVisitStatus(id, status);
    res.json(updated);
  });

  // TRIPS
  app.post("/api/trips/start", requireAuth, async (req: any, res) => {
    const { visit_id, gps, odometer, op_id } = req.body || {};
    if (!visit_id) return res.status(400).json({ error: "visit_id é obrigatório" });
    const trip = await CRMStorage.startTrip({
      visitId: visit_id,
      odometer: odometer ?? null,
      gps: gps ?? null,
      opId: op_id ?? null,
      actor: req.user?.id ?? null
    });
    res.status(201).json(trip);
  });

  app.post("/api/trips/gps", requireAuth, async (req: any, res) => {
    const batch = Array.isArray(req.body) ? req.body : [];
    const n = await CRMStorage.appendGpsBatch(batch);
    res.json({ inserted: n });
  });

  app.post("/api/trips/:id/end", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const { odometer } = req.body || {};
    const t = await CRMStorage.endTrip(id, odometer ?? null);
    res.json({ ok: true, trip: t });
  });

  // CHECKLISTS
  app.post("/api/checklists/:visitId", requireAuth, async (req: any, res) => {
    const { visitId } = req.params;
    const { template, answers, photos, signatures, finished } = req.body || {};
    const checklist = await CRMStorage.saveChecklist(visitId, {
      template, answers, photos, signatures, finished
    });
    res.status(201).json(checklist);
  });

  // FARMS & FIELDS
  app.get("/api/farms", requireAuth, async (req: any, res) => {
    const farmsData = await db.select().from(farms);
    res.json(farmsData);
  });

  app.post("/api/farms", requireAuth, async (req: any, res) => {
    const data = insertFarmSchema.parse(req.body);
    const [created] = await db.insert(farms).values(data).returning();
    res.status(201).json(created);
  });

  app.delete("/api/farms/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    await db.delete(farms).where(eq(farms.id, id));
    res.json({ success: true });
  });

  app.get("/api/fields", requireAuth, async (req: any, res) => {
    try {
      const { farm_id } = req.query;
      let data;
      if (farm_id) {
        data = await db.query.fields.findMany({
          where: (fields, { eq }) => eq(fields.farmId, farm_id as string)
        });
      } else {
        data = await db.query.fields.findMany();
      }
      res.json(data);
    } catch (err) {
      console.error("Fields error:", err);
      res.status(500).json({ error: "Failed to fetch fields" });
    }
  });

  app.post("/api/fields", requireAuth, async (req: any, res) => {
    try {
      const data = insertFieldSchema.parse(req.body);
      const fieldData: any = {
        farmId: data.farmId,
        name: data.name,
        ...(data.crop && { crop: data.crop }),
        ...(data.season && { season: data.season })
      };
      const [created] = await db.insert(fields).values(fieldData).returning();
      res.status(201).json(created);
    } catch (err) {
      console.error("Field insert error:", err);
      res.status(400).json({ error: "Failed to create field" });
    }
  });

  // GEO
  app.get("/api/geo/fields/:id/contains", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    const { lat, lng } = req.query as any;
    if (!lat || !lng) return res.status(400).json({ error: "lat/lng obrigatórios" });
    const inside = await CRMStorage.pointInsideField(id, parseFloat(lat), parseFloat(lng));
    res.json({ inside });
  });

  // AGENDA (texto → visitas)
  app.post("/api/agenda/parse", requireAuth, async (req: any, res) => {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: "text é obrigatório" });
    const parsed = await parseAgenda(text);
    res.json({ items: parsed.map(p => ({ ...p, match_ok: !!p.client_id })) });
  });

  app.post("/api/agenda/confirm", requireAuth, async (req: any, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items vazio" });

    // Filtra apenas items com client_id válido
    const validItems = items.filter(v => v.client_id);
    const invalidItems = items.filter(v => !v.client_id);

    if (validItems.length === 0) {
      return res.status(400).json({
        error: "Nenhum cliente reconhecido",
        invalid: invalidItems.map(i => i.client_name || i.notes || "Item desconhecido")
      });
    }

    const payload = validItems.map((v: any) => ({
      clientId: v.client_id,
      farmId: v.farm_id ?? null,
      fieldId: v.field_id ?? null,
      scheduledAt: v.date ? new Date(`${v.date}T${v.time ? v.time : "09:00"}:00-03:00`) : new Date(),
      windowStart: v.date ? new Date(`${v.date}T${v.time ? v.time : "09:00"}:00-03:00`) : new Date(),
      windowEnd: null,
      status: "PLANEJADA" as const,
      assignee: req.user?.id ?? null,
      notes: v.notes ?? null
    }));

    const created = await CRMStorage.createVisitsBulk(payload);

    res.status(201).json({
      created: created.length,
      visits: created,
      skipped: invalidItems.length,
      invalid_items: invalidItems.map(i => i.client_name || i.notes || "Item desconhecido")
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
