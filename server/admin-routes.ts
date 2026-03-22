import type { Express } from "express";
import { storage } from "./storage";
import { subcategories, clients, sales, categories, products, clientMarketRates, externalPurchases, purchaseHistory, marketBenchmarks, userClientLinks, masterClients, salesHistory, clientFamilyRelations, purchaseHistoryItems, barterSimulations, barterSimulationItems, farms, fields, users, productsPriceTable, globalManagementApplications, clientApplicationTracking, farmProductsCatalog, globalSilos, insertGlobalSiloSchema, systemSettings, seasonGoals, insertCategorySchema, insertProductSchema } from "@shared/schema";
import multer from "multer";
import { requireAuth, requireSuperAdmin, requireFarmAdmin, hashPassword } from "./auth";
import { db } from "./db";
import { eq, sql, and, desc, count } from "drizzle-orm";

export function registerAdminRoutes(app: Express) {
  const upload = multer({ storage: multer.memoryStorage() });

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
      const { role, name, managerId, username, password } = req.body;
      const updateData: any = { role, name, managerId };

      // Include username if provided
      if (username) {
        updateData.username = username;
      }

      // Hash password if provided using scryptSync (same as used in auth.ts)
      if (password && password.trim()) {
        const { scryptSync, randomBytes } = await import("crypto");
        const salt = randomBytes(16).toString("hex");
        const buf = scryptSync(password, salt, 64);
        updateData.password = `${buf.toString("hex")}.${salt} `;
      }

      const updated = await storage.updateUser(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ ...updated, password: undefined });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(400).json({ error: "Failed to update user: " + (error as Error).message });
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

  // ==================== GLOBAL PRODUCTS CATALOG (SUPER ADMIN) ====================

  app.get("/api/admin/global-products", requireFarmAdmin, async (req, res) => {
    try {
      const products = await db.select().from(farmProductsCatalog).orderBy(desc(farmProductsCatalog.createdAt));
      res.json(products);
    } catch (error) {
      console.error("Error fetching global products:", error);
      res.status(500).json({ error: "Failed to fetch global products" });
    }
  });

  app.post("/api/admin/global-products", requireFarmAdmin, async (req, res) => {
    try {
      const { name, activeIngredient, dosePerHa, category, unit, status } = req.body;
      const [newProduct] = await db.insert(farmProductsCatalog).values({
        name,
        activeIngredient,
        dosePerHa: dosePerHa ? String(dosePerHa) : null,
        category,
        unit: unit || 'LT',
        status: status || 'active',
        isDraft: false
      }).returning();
      res.status(201).json(newProduct);
    } catch (error) {
      console.error("Error creating global product:", error);
      res.status(400).json({ error: "Failed to create product" });
    }
  });

  app.patch("/api/admin/global-products/:id", requireFarmAdmin, async (req, res) => {
    try {
      const { name, activeIngredient, dosePerHa, category, unit, status, isDraft } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (activeIngredient !== undefined) updateData.activeIngredient = activeIngredient;
      if (dosePerHa !== undefined) updateData.dosePerHa = dosePerHa ? String(dosePerHa) : null;
      if (category !== undefined) updateData.category = category;
      if (unit !== undefined) updateData.unit = unit;
      if (status !== undefined) updateData.status = status;
      if (isDraft !== undefined) updateData.isDraft = isDraft;

      const [updated] = await db.update(farmProductsCatalog)
        .set(updateData)
        .where(eq(farmProductsCatalog.id, req.params.id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating global product:", error);
      res.status(400).json({ error: "Failed to update product" });
    }
  });

  app.post("/api/admin/global-products/import", requireFarmAdmin, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No PDF file uploaded" });
      }

      const mimeType = req.file.mimetype;
      if (mimeType !== 'application/pdf') {
        return res.status(400).json({ error: "Apenas arquivos PDF são permitidos para importação." });
      }

      console.log(`[GLOBAL_CATALOG_IMPORT] Processing PDF: ${req.file.originalname} (${req.file.size} bytes)`);
      const { parseGlobalCatalogPdf } = await import("./whatsapp/gemini-client");

      const parsedProducts = await parseGlobalCatalogPdf(req.file.buffer);
      console.log(`[GLOBAL_CATALOG_IMPORT] Gemini extracted ${parsedProducts.length} products`);

      const results = {
        created: 0,
        updated: 0,
        errors: 0,
        details: [] as string[]
      };

      for (const p of parsedProducts) {
        try {
          // Check if product already exists by exact name
          const existing = await db.select().from(farmProductsCatalog)
            .where(eq(farmProductsCatalog.name, p.name))
            .limit(1);

          if (existing.length > 0) {
            // Update existing
            await db.update(farmProductsCatalog).set({
              activeIngredient: p.activeIngredient || existing[0].activeIngredient,
              category: p.category || existing[0].category,
              dosePerHa: p.dosePerHa ? String(p.dosePerHa) : existing[0].dosePerHa,
              unit: p.unit || existing[0].unit,
              status: 'active', // clear any draft status if it was pending
              isDraft: false
            }).where(eq(farmProductsCatalog.id, existing[0].id));
            results.updated++;
          } else {
            // Create new
            await db.insert(farmProductsCatalog).values({
              name: p.name,
              activeIngredient: p.activeIngredient || null,
              category: p.category || 'Outros',
              dosePerHa: p.dosePerHa ? String(p.dosePerHa) : null,
              unit: p.unit || 'LT',
              status: 'active',
              isDraft: false
            });
            results.created++;
          }
        } catch (err) {
          console.error(`[GLOBAL_CATALOG_IMPORT] Error processing product ${p.name}: `, err);
          results.errors++;
          results.details.push(`Falha ao processar: ${p.name} `);
        }
      }

      res.json({
        success: true,
        message: `Importação concluída.${results.created} criados, ${results.updated} atualizados.`,
        results
      });
    } catch (error) {
      console.error("[GLOBAL_CATALOG_IMPORT_ERROR]", error);
      res.status(500).json({ error: "Falha ao processar o PDF do catálogo." });
    }
  });

  app.delete("/api/admin/global-products/:id", requireFarmAdmin, async (req, res) => {
    try {
      // Hard delete product (fails if bound to an invoice due to foreign key constraints, which is correct behavior)
      await db.delete(farmProductsCatalog).where(eq(farmProductsCatalog.id, req.params.id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting global product (it might be in use):", error);
      res.status(400).json({ error: "Não é possível excluir o produto porque ele está sendo usado em faturas ou estoques." });
    }
  });

  // ==================== GLOBAL SILOS (ADMIN + FARM ADMIN) ====================
  app.get("/api/admin/global-silos", requireFarmAdmin, async (req, res) => {
    try {
      const silos = await db.select().from(globalSilos).orderBy(globalSilos.companyName);
      res.json(silos);
    } catch (error) {
      console.error("Error fetching global silos:", error);
      res.status(500).json({ error: "Failed to fetch global silos" });
    }
  });

  app.post("/api/admin/global-silos", requireFarmAdmin, async (req, res) => {
    try {
      const siloData = insertGlobalSiloSchema.parse(req.body);
      const [newSilo] = await db.insert(globalSilos).values(siloData).returning();
      res.status(201).json(newSilo);
    } catch (error) {
      console.error("Error creating global silo:", error);
      res.status(400).json({ error: "Invalid silo data" });
    }
  });

  app.patch("/api/admin/global-silos/:id", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const [updatedSilo] = await db
        .update(globalSilos)
        .set(updates)
        .where(eq(globalSilos.id, id))
        .returning();

      if (!updatedSilo) {
        return res.status(404).json({ error: "Global Silo not found" });
      }
      res.json(updatedSilo);
    } catch (error) {
      console.error("Error updating global silo:", error);
      res.status(400).json({ error: "Failed to update global silo" });
    }
  });

  app.delete("/api/admin/global-silos/:id", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.delete(globalSilos).where(eq(globalSilos.id, id)).returning();
      if (!deleted) {
        return res.status(404).json({ error: "Global Silo not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting global silo (might be in use by romaneios):", error);
      res.status(400).json({ error: "Não é possível excluir este Silo pois estã em uso por romaneios de produtores." });
    }
  });

  // =================================================================================

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
        allSubcategories.map((s: any) => [`${s.categoryId}:${String(s.name).trim().toLowerCase()} `, s]),
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
            errors.push(`Linha ${i + 2} (${name}): categoria inválida ou não encontrada(${categoryToken || "vazia"})`);
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
              const byName = subcategoryByName.get(`${resolvedCategoryId}:${subcategoryToken.toLowerCase()} `);
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
          errors.push(`Linha ${i + 2}: ${err?.message || "erro desconhecido"} `);
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
            errors.push(`Linha ${i + 1}: Mercaderia vazia ou não encontrada.Colunas disponíveis: ${Object.keys(row).join(', ')} `);
            continue;
          }

          console.log(`Importando linha ${i + 1}: `, productData.mercaderia);
          await db.insert(productsPriceTable).values(productData);
          imported++;
        } catch (error: any) {
          console.error(`Erro na linha ${i + 1}: `, error);
          errors.push(`Linha ${i + 1} (${row['MERCADERIA'] || row['Mercaderia'] || 'sem nome'}): ${error.message} `);
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
        message: `Migração concluída.${updated} tipos de subcategorias processadas.`,
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

}
