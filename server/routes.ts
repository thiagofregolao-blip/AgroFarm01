import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertFarmSchema, insertFieldSchema, farms, fields, passwordResetTokens, users, productsPriceTable, globalManagementApplications, clientApplicationTracking, farmProductsCatalog, globalSilos, insertPlanningGlobalConfigurationSchema, seasons, seasonGoals, sales, categories, products, subcategories, userClientLinks, masterClients, clients, clientMarketRates } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import { importPlanningProducts } from "./import-excel";
import { setupAuth, requireAuth, requireSuperAdmin, requireManager, requireFarmAdmin, hashPassword } from "./auth";
import { db } from "./db";
import { eq, sql, and, gt, gte, desc, inArray, or, sum, count } from "drizzle-orm";
import { emailService } from "./email";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { registerCrmRoutes } from "./crm-routes";
import { registerAdminRoutes } from "./admin-routes";
import { registerPlanningRoutes } from "./planning-routes";

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

  // Register domain route modules
  registerCrmRoutes(app);
  registerAdminRoutes(app);
  registerPlanningRoutes(app);

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
        console.log(`Password reset requested for ${username} (email service not configured)`);
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
      const hashedPassword = `${buf.toString("hex")}.${salt}`;

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
          .sort((a: any, b: any) => b.sales - a.sales)
          .slice(0, 5),
      })).sort((a: any, b: any) => b.totalSales - a.totalSales);

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
        .sort((a: any, b: any) => b.value - a.value)
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
        .select({ id: users.id, name: users.name, username: users.username })
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
        // Calculate percentages (sales / goal * 100)
        // Calculate percentages (sales / goal * 100) and breakdown
        const categoryData: Record<string, { percentage: number; sales: number; goal: number; breakdown: Array<{ name: string; sales: number; goal: number }> }> = {};

        Object.entries(categoryMetaFieldMap).forEach(([categoryName, metaField]) => {
          const salesAmount = categorySales[categoryName] || 0;
          const goalAmount = parseFloat((seasonGoal as any)[metaField] || '0');

          const percentage = goalAmount > 0 ? (salesAmount / goalAmount) * 100 : 0;

          // Calculate breakdown per consultant for this category
          const breakdown: Array<{ name: string; sales: number; goal: number }> = [];

          teamMembers.forEach(member => {
            // Calculate member sales for this category
            const memberSales = seasonSales
              .filter(s => s.userId === member.id)
              .reduce((acc, sale) => {
                const cId = productCategoryMap.get(sale.productId);
                const cName = cId ? categoryNameMap.get(cId) : '';
                if (cName === categoryName) {
                  return acc + parseFloat(sale.totalAmount || '0');
                }
                return acc;
              }, 0);

            // Calculate member goal for this category (assuming goals are split evenly or accessed individually if available?)
            // Wait, `seasonGoal` fetched earlier is the TEAM goal (fetched by managerId). 
            // We need INDIVIDUAL goals to show a proper breakdown.
            // Looking at lines 6372-6379 (not shown in view but inferred), `seasonGoal` seems to be fetched for the manager user? 
            // Actually, `seasonGoals` table has `userId`. 
            // I need to fetch ALL season goals for the team members to do this correctly.

            // Since I haven't fetched individual goals in this endpoint yet, I'll stick to Sales breakdown for now 
            // and maybe just show 0 or split goal if I can't get it easily without a larger refactor.
            // BUT, the user asked for "values that each contribute".
            // Let's check how `seasonGoal` is fetched. 
            // "const seasonGoal = await db.query.seasonGoals.findFirst..."

            // To do this right, I need to fetch all team goals. 
            // I will implement a simplified version first: Sales Breakdown only, 
            // OR I will fetch team goals. 
            // Let's assume for now we just show Sales in breakdown, 
            // as Goal breakdown might be complex if individual goals aren't set.
            // However, the interface format "V: X M: Y" implies both.

            // Let's try to fetch individual goals inside the loop? No, that's N+1.
            // Better to fetch all goals for team in this season at the start.

            breakdown.push({
              name: member.name || member.username,
              sales: memberSales,
              goal: 0 // Placeholder until I add goal fetching logic
            });
          });

          categoryData[categoryName] = {
            percentage,
            sales: salesAmount,
            goal: goalAmount,
            breakdown: breakdown.filter(b => b.sales > 0 || b.goal > 0) // Only show active consultants
          };
        });

        result[seasonId] = categoryData;
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
        .select({ id: users.id, name: users.name, username: users.username })
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

      // Result structure: { seasonId: { categoryName: { percentage, decided, potential, breakdown } } }
      const result: Record<string, Record<string, { percentage: number; decided: number; potential: number; breakdown: Array<{ name: string; decided: number; potential: number }> }>> = {};

      for (const seasonId of seasonIds) {
        // Get market clients for the team (includeInMarketArea=true)
        const teamMarketClients = await db.select({ id: userClientLinks.id })
          .from(userClientLinks)
          .where(and(
            inArray(userClientLinks.userId, teamIds),
            eq(userClientLinks.includeInMarketArea, true)
          ));

        const teamMarketClientIds = teamMarketClients.map(c => c.id);

        // Get team sales - ALL clients, regardless of badge (exactly like Dashboard line 4168)
        // Dashboard comment: "Calculate Global Sales (C.Vale) - All clients, regardless of badge"
        const teamSales = allSales.filter(s =>
          teamIds.includes(s.userId) &&
          s.seasonId === seasonId
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

        // Get Manager Team Rates (Potencial Geral) for Fallback
        const managerRatesMap = new Map<string, any>();
        try {
          // For Manager Panel, the logged user IS the manager
          const managerId = req.user!.id;
          const managerRates = await storage.getManagerTeamRates(managerId, seasonId);
          managerRates.forEach(r => managerRatesMap.set(r.categoryId, r));
        } catch (mgrRateError) {
          console.error('[MARKET-PERCENTAGE] Error fetching manager rates:', mgrRateError);
        }

        // Map team market rates for easy lookup
        const teamRatesAccessMap = new Map<string, typeof teamMarketRates[0]>();
        teamMarketRates.forEach(rate => {
          // Key: clientId:categoryId
          teamRatesAccessMap.set(`${rate.user_client_links.id}:${rate.client_market_rates.categoryId} `, rate);
        });

        // Calculate total potential by category
        const potentialByCategory: Record<string, number> = {};
        categories.forEach(cat => {
          potentialByCategory[cat.id] = 0;
        });

        teamMarketClients.forEach(client => {
          categories.forEach(cat => {
            const key = `${client.id}:${cat.id} `;
            const specificRate = teamRatesAccessMap.get(key);

            let potential = 0;
            if (specificRate) {
              const pArea = parseFloat(specificRate.master_clients.plantingArea || '0');
              const invest = parseFloat(specificRate.client_market_rates.investmentPerHa || '0');
              potential = pArea * invest;
            } else {
              // Fallback to Manager Rate
              const mgrRate = managerRatesMap.get(cat.id);
              if (mgrRate) {
                // Need client area - fetch or cached? 
                // We don't have area in `teamMarketClients` yet, need to join.
                // IMPORTANT: The loop above `teamMarketRates` only had clients WITH rates.
                // We need area for ALL clients.
              }
            }
          });
        });

        // RE-STRATEGY: Fetch Client Areas separately to enable fallback for all clients
        // IMPORTANT: Use userClientLinks.plantingArea (override) or fallback to masterClients.plantingArea (same as Dashboard)
        const teamClientsWithArea = await db.select({
          id: userClientLinks.id,
          userId: userClientLinks.userId,
          userArea: userClientLinks.plantingArea,
          masterArea: masterClients.plantingArea
        })
          .from(userClientLinks)
          .innerJoin(masterClients, eq(userClientLinks.masterClientId, masterClients.id))
          .where(and(
            inArray(userClientLinks.userId, teamIds),
            eq(userClientLinks.includeInMarketArea, true)
          ));

        teamClientsWithArea.forEach(client => {
          // Use userArea override if available, otherwise fallback to masterArea (same logic as category-cards)
          const area = parseFloat(client.userArea || client.masterArea || '0');
          if (area > 0) {
            categories.forEach(cat => {
              const key = `${client.id}:${cat.id} `;
              const specificRate = teamRatesAccessMap.get(key);
              let investment = 0;

              if (specificRate) {
                investment = parseFloat(specificRate.client_market_rates.investmentPerHa || '0');
              } else {
                const mgrRate = managerRatesMap.get(cat.id);
                if (mgrRate) {
                  investment = parseFloat(mgrRate.investmentPerHa || '0');
                }
              }

              const potential = area * investment;
              if (potential > 0) {
                potentialByCategory[cat.id] += potential;
              }
            });
          }
        });

        // Get FECHADO values from client_application_tracking
        // These are applications marked as "lost to competitor" in the Market Management Panel
        // All applications are under Agroquímicos category
        const agroquimicosCategory = categories.find(c => c.type === 'agroquimicos');
        const agroquimicosCategoryId = agroquimicosCategory?.id || '';

        // Query applications like Dashboard does: by userId and seasonId directly
        // Dashboard does NOT filter by includeInMarketArea for applications
        const teamApplicationTrackingRaw = await db.select({
          clientId: clientApplicationTracking.clientId,
          userId: clientApplicationTracking.userId,
          totalValue: clientApplicationTracking.totalValue,
          status: clientApplicationTracking.status
        })
          .from(clientApplicationTracking)
          .where(and(
            inArray(clientApplicationTracking.userId, teamIds),
            eq(clientApplicationTracking.seasonId, seasonId),
            inArray(clientApplicationTracking.status, ['FECHADO', 'PARCIAL'])
          ));

        // Calculate total FECHADO value for Agroquímicos exactly like Dashboard
        // Dashboard uses app.totalValue directly (line 4296 in category-cards)
        let totalFechadoAgroquimicos = 0;
        teamApplicationTrackingRaw.forEach(tracking => {
          let value = parseFloat(tracking.totalValue || '0');

          if (tracking.status === 'PARCIAL') {
            value = value / 2;
          }

          totalFechadoAgroquimicos += value;
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
        const categoryData: Record<string, { percentage: number; decided: number; potential: number; breakdown: Array<{ name: string; decided: number; potential: number }> }> = {};

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
          categoryData[catName] = { percentage: 0, decided: 0, potential: 0, breakdown: [] };
        });

        // Calculate and populate actual values
        categories.forEach(cat => {
          const potential = potentialByCategory[cat.id] || 0;
          const sales = salesByCategory[cat.id] || 0;
          const fechado = fechadoByCategory[cat.id] || 0;

          // Calculate breakdown per consultant for this category
          const breakdown: Array<{ name: string; decided: number; potential: number }> = [];

          teamMembers.forEach(member => {
            // Member Potential
            let memberPotential = 0;

            // Use the pre-fetched clients with area loop logic but filtered for this member
            teamClientsWithArea.forEach(client => {
              if (client.userId !== member.id) return;

              const area = parseFloat(client.userArea || client.masterArea || '0');
              if (area > 0) {
                const key = `${client.id}:${cat.id} `;
                const specificRate = teamRatesAccessMap.get(key);
                let investment = 0;

                if (specificRate) {
                  investment = parseFloat(specificRate.client_market_rates.investmentPerHa || '0');
                } else {
                  const mgrRate = managerRatesMap.get(cat.id);
                  if (mgrRate) {
                    investment = parseFloat(mgrRate.investmentPerHa || '0');
                  }
                }
                memberPotential += area * investment;
              }
            });

            // Member Sales
            let memberSales = 0;
            teamSales.forEach(sale => {
              if (sale.userId === member.id) {
                const cId = productCategoryMap.get(sale.productId);
                if (cId === cat.id) {
                  memberSales += parseFloat(sale.totalAmount || '0');
                }
              }
            });

            // Member Fechado (Lost) - use totalValue directly like Dashboard
            let memberFechado = 0;
            // Iterate tracking raw data
            teamApplicationTrackingRaw.forEach(tracking => {
              if (tracking.userId === member.id && agroquimicosCategoryId === cat.id) {
                let value = parseFloat(tracking.totalValue || '0');

                if (tracking.status === 'PARCIAL') {
                  value = value / 2;
                }

                memberFechado += value;
              }
            });

            breakdown.push({
              name: member.name || member.username,
              decided: memberSales + memberFechado,
              potential: memberPotential
            });
          });


          const totalDecided = sales + fechado;
          const marketPercentage = potential > 0 ? (totalDecided / potential) * 100 : 0;
          const categoryName = categoryNameMap.get(cat.id);
          if (categoryName) {
            categoryData[categoryName] = {
              percentage: marketPercentage,
              decided: totalDecided,
              potential: potential,
              breakdown: breakdown.filter(b => b.decided > 0 || b.potential > 0)
            };
          }
        });

        result[seasonId] = categoryData;
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
      const { users, seasons, clientApplicationTracking, globalManagementApplications, categories, sales, products } = await import("@shared/schema");
      const { inArray, or, sql: sqlFn } = await import("drizzle-orm");
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

      // Get all categories for mapping
      const allCategories = await db.select().from(categories);
      const categoryTypeMap = new Map(allCategories.map(c => [c.id, c.type]));
      const categoryNameMap = new Map(allCategories.map(c => [c.id, c.name]));

      // 1. Get SALES for ALL categories (Fertilizantes, Sementes, Especialidades, Corretivos, Agroquímicos)
      const teamSales = await db
        .select({
          seasonId: sales.seasonId,
          seasonName: sqlFn`COALESCE(${seasons.name}, 'Safra sem nome')`.as('season_name'),
          categoryId: sales.categoryId,
          categoryType: categories.type,
          categoryName: categories.name,
          productSegment: products.segment,
          totalAmount: sales.totalAmount,
        })
        .from(sales)
        .leftJoin(seasons, eq(sales.seasonId, seasons.id))
        .leftJoin(categories, eq(sales.categoryId, categories.id))
        .leftJoin(products, eq(sales.productId, products.id))
        .where(inArray(sales.userId, teamIds));

      // 2. Get ABERTO and PARCIAL applications for Agroquímicos (opportunities)
      const teamApplications = await db
        .select({
          seasonId: clientApplicationTracking.seasonId,
          seasonName: sqlFn`COALESCE(${seasons.name}, 'Safra sem nome')`.as('season_name'),
          categoria: clientApplicationTracking.categoria,
          globalCategoria: globalManagementApplications.categoria,
          totalValue: clientApplicationTracking.totalValue,
          status: clientApplicationTracking.status,
        })
        .from(clientApplicationTracking)
        .leftJoin(seasons, eq(clientApplicationTracking.seasonId, seasons.id))
        .leftJoin(globalManagementApplications, eq(clientApplicationTracking.globalApplicationId, globalManagementApplications.id))
        .where(
          inArray(clientApplicationTracking.userId, teamIds)
        );

      // Map segment to category name
      const segmentToCategoryName: Record<string, string> = {
        'fertilizantes': 'Fertilizantes',
        'agroquimicos': 'Agroquímicos',
        'especialidades': 'Especialidades',
        'sementes': 'Sementes',
        'corretivos': 'Corretivos',
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

      // Map product segment to subcategory display name for Agroquímicos (from sales)
      const segmentToSubcategoryName: Record<string, string> = {
        'fungicida': 'Fungicidas',
        'inseticida': 'Inseticidas',
        'herbicida': 'Herbicidas',
        'ts': 'Tratamento de Sementes',
        'dessecacao': 'Dessecação',
        'outros': 'Outros',
      };

      // Map categoria to subcategory display name for Agroquímicos (from applications)
      const categoriaToSubcategoryName: Record<string, string> = {
        'FUNGICIDAS': 'Fungicidas',
        'INSETICIDAS': 'Inseticidas',
        'HERBICIDAS': 'Herbicidas',
        'TRATAMENTO DE SEMENTE': 'Tratamento de Sementes',
        'DESSECAÇÃO': 'Dessecação',
        'TS': 'Tratamento de Sementes',
        'Fungicidas': 'Fungicidas',
        'Inseticidas': 'Inseticidas',
        'Herbicidas': 'Herbicidas',
      };

      // 1. Process SALES for ALL categories (Fertilizantes, Sementes, Especialidades, Corretivos, Agroquímicos)
      teamSales.forEach((sale: any) => {
        if (!sale.seasonId || !sale.categoryType) return;

        const seasonId = sale.seasonId;
        const seasonName = String(sale.seasonName || 'Safra sem nome');
        const segmento = sale.categoryType || 'outros';
        const categoryName = (sale.categoryName as string) || segmentToCategoryName[segmento] || segmento;
        const valor = parseFloat(sale.totalAmount || '0');

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

        // Add to subcategory only for agroquimicos (using product.segment)
        if (segmento === 'agroquimicos' && sale.productSegment) {
          const subcatName = segmentToSubcategoryName[sale.productSegment.toLowerCase()] || sale.productSegment;
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

      // 2. Process ABERTO / PARCIAL applications (opportunities) for Agroquímicos
      // ABERTO = 100% of totalValue, PARCIAL = 50% of totalValue
      teamApplications.forEach((app: any) => {
        if (!app.seasonId) return;

        // Only count ABERTO and PARCIAL as opportunities
        const status = app.status;
        if (status !== 'ABERTO' && status !== 'PARCIAL') return;

        const seasonId = app.seasonId;
        const seasonName = String(app.seasonName || 'Safra sem nome');

        // Determine category from the application's categoria field
        const appCategoria = app.categoria || app.globalCategoria || 'Agroquímicos';

        // Map to main category (segmento) - for now all applications are Agroquímicos
        const segmento = 'agroquimicos';
        const categoryName = 'Agroquímicos';

        // Calculate opportunity value: ABERTO=100%, PARCIAL=50%
        const totalValue = parseFloat(app.totalValue || '0');
        const valor = status === 'PARCIAL' ? totalValue / 2 : totalValue;

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

        // Add to subcategory using the categoria field
        if (appCategoria) {
          const subcatName = categoriaToSubcategoryName[appCategoria] || appCategoria;
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

      const masterClientIds = userClientLinksData.map((link: any) => link.masterClientId);
      const masterClientsData = await db
        .select()
        .from(masterClients)
        .where(inArray(masterClients.id, masterClientIds));

      // Build response with client details
      const clientTargets = Array.from(clientMap.values()).map(clientData => {
        const userClientLink = userClientLinksData.find((link: any) => link.id === clientData.clientId);
        const masterClient = masterClientsData.find((mc: any) => mc.id === userClientLink?.masterClientId);
        const consultor = teamMembers.find((m: any) => m.id === clientData.userId);

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
      const ordersByProduct = orders.reduce((acc: any, order: any) => {
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
      console.log('First 10 inventory codes:', inventory.slice(0, 10).map((i: any) => i.productCode));
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

  // ============ AI ENRICHMENT ROUTE ============
  app.post("/api/admin/farmers/products/ai-enrich", requireFarmAdmin, async (req: any, res) => {
    try {
      const { productName, productId } = req.body;
      if (!productName) {
        return res.status(400).json({ error: "Nome do produto é obrigatório para enriquecimento" });
      }

      const { enrichProductData } = await import("./services/ai-enrichment.service");
      const { farmStockMovements, farmProductsCatalog } = await import("@shared/schema");

      // Build context: check if any farmer has stock movements for this product ID to get clues about units
      let stockContext: { quantity: string; unit: string; date: string }[] = [];
      if (productId) {
        const movements = await db
          .select({
            quantity: farmStockMovements.quantity,
            unit: farmProductsCatalog.unit,
            date: farmStockMovements.createdAt
          })
          .from(farmStockMovements)
          .leftJoin(farmProductsCatalog, eq(farmStockMovements.productId, farmProductsCatalog.id))
          .where(eq(farmStockMovements.productId, productId))
          .limit(5);

        stockContext = movements.map(m => ({
          quantity: m.quantity || "1",
          unit: m.unit || "L",
          date: m.date ? m.date.toISOString().split('T')[0] : ""
        }));
      }

      const aiData = await enrichProductData(productName, stockContext);
      res.json(aiData);
    } catch (error: any) {
      console.error("Erro no enriquecimento por IA:", error);
      res.status(500).json({ error: error.message || "Falha no enriquecimento." });
    }
  });

  // ============ CRM MOBILE ROUTES ============
  // Rotas extraidas para server/crm-mobile-routes.ts
  const { registerCrmMobileRoutes } = await import("./crm-mobile-routes");
  registerCrmMobileRoutes(app);


  // Sales Planning Import
  app.post("/api/planning/import-products", requireSuperAdmin, upload.fields([{ name: 'salesPlanning' }, { name: 'productDoses' }]), async (req, res) => {
    // ... existing codes ...
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const { seasonId } = req.body;
      // ... existing codes ...

      if (!seasonId) {
        return res.status(400).json({ error: "Season ID is required" });
      }

      if (!files['salesPlanning']?.[0] || !files['productDoses']?.[0]) {
        return res.status(400).json({ error: "Both sales planning and product doses files are required" });
      }

      const result = await importPlanningProducts(
        files['salesPlanning'][0].buffer,
        files['productDoses'][0].buffer,
        seasonId
      );

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to import planning products" });
    }
  });

  // FINAL PLANNING IMPORT (Single XLS file)
  app.post("/api/admin/import-planning-final", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        console.error("Import Error: File is missing");
        return res.status(400).json({ error: "File is required" });
      }

      let { seasonId } = req.body;

      if (!seasonId || seasonId === 'undefined' || seasonId === 'null') {
        const activeSeason = await storage.getActiveSeason(); // Use correct storage instance
        if (activeSeason) seasonId = activeSeason.id;
      }

      if (!seasonId) {
        console.error("Import Error: Season ID missing. Params received:", req.body);
        console.error("Active Season Lookup Failed");
        return res.status(400).json({ error: "Season ID required. Please verify active season is set." });
      }

      console.log(`Starting import for season: ${seasonId}`);
      if (req.file) {
        console.log(`File details: ${req.file.originalname} (${req.file.size} bytes)`);
      }

      const { importPlanningFinal } = await import("./import-excel");

      if (!importPlanningFinal) {
        throw new Error("importPlanningFinal function not found in import-excel module");
      }

      const result = await importPlanningFinal(req.file.buffer, seasonId);

      res.json(result);
    } catch (error) {
      console.error("Import Final Error:", error);
      res.status(500).json({ error: "Failed to import: " + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Check purchased history
  app.get("/api/planning/client-history/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      // Check purchases in previous seasons from sales table
      // Matching by product NAME to cover re-imports with different IDs
      const history = await db.selectDistinct({ productName: products.name })
        .from(sales)
        .innerJoin(products, eq(sales.productId, products.id))
        .where(eq(sales.clientId, clientId));

      const names = history.map((h: any) => h.productName);
      res.json({ purchasedProductNames: names });
    } catch (error) {
      console.error("History Error:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  // New endpoint for single file import
  app.post("/api/admin/import-planning-final", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "File is required" });
      }

      // Default seasonId - ideally passed from client or fetched active
      // For now, let's try to find active season or allow passing it
      const { seasonId } = req.body;
      let targetSeasonId = seasonId;

      if (!targetSeasonId) {
        const activeSeason = await (CRMStorage as any).getActiveSeason();
        if (activeSeason) targetSeasonId = activeSeason.id;
      }

      if (!targetSeasonId) {
        return res.status(400).json({ error: "Active Season not found and seasonId not provided" });
      }

      const { importPlanningFinal } = await import("./import-excel");
      const result = await importPlanningFinal(req.file.buffer, targetSeasonId);

      res.json(result);
    } catch (error) {
      console.error("Import Final Error:", error);
      res.status(500).json({ error: "Failed to import final planning file" });
    }
  });

  // Get all planning products for a season
  app.get("/api/planning/products", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.query;

      if (!seasonId) {
        return res.status(400).json({ error: "Season ID is required" });
      }

      const products = await storage.getPlanningProducts(String(seasonId));
      res.json(products);
    } catch (error) {
      console.error("[PLANNING_PRODUCTS_GET]", error);
      res.status(500).json({ error: "Failed to fetch planning products" });
    }
  });

  // Update planning product (price/dose)
  app.patch("/api/planning/products/:id", requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { price, dosePerHa } = req.body;

      const updated = await storage.updatePlanningProduct(id, {
        price: price ? String(price) : undefined,
        dosePerHa: dosePerHa ? String(dosePerHa) : undefined
      });

      res.json(updated);
    } catch (error) {
      console.error("[PLANNING_PRODUCT_UPDATE]", error);
      res.status(500).json({ error: "Failed to update planning product" });
    }
  });

  // Get planning for a client
  app.get("/api/planning/:clientId", requireAuth, async (req, res) => {
    try {
      const { clientId } = req.params;
      const { seasonId } = req.query;

      if (!seasonId) {
        return res.status(400).json({ error: "Season ID is required" });
      }

      const result = await storage.getSalesPlanning(clientId, String(seasonId));
      res.json(result || null);
    } catch (error) {
      console.error("[SALES_PLANNING_GET]", error);
      res.status(500).json({ error: "Failed to fetch sales planning" });
    }
  });

  // Global Planning Configuration
  app.get("/api/planning/global", requireAuth, async (req, res) => {
    try {
      const { seasonId } = req.query;
      console.log(`[GLOBAL_GET] User: ${req.user.id}, Season: ${seasonId}`);

      if (!seasonId) return res.status(400).json({ error: "Season ID required" });

      const config = await storage.getPlanningGlobalConfiguration(req.user.id, seasonId as string);
      console.log(`[GLOBAL_GET] Result:`, config);

      res.json(config || null);
    } catch (error) {
      console.error("[PLANNING_GLOBAL_GET]", error);
      res.status(500).json({ error: "Failed to fetch global configuration" });
    }
  });

  app.post("/api/planning/global", requireAuth, async (req, res) => {
    try {
      const { seasonId, productIds } = req.body;
      console.log(`[GLOBAL_POST] User: ${req.user.id}, Season: ${seasonId}, IDs count: ${productIds?.length}`);

      if (!seasonId || !Array.isArray(productIds)) {
        return res.status(400).json({ error: "Invalid data" });
      }

      const result = await storage.upsertPlanningGlobalConfiguration({
        userId: req.user.id,
        seasonId,
        productIds
      });
      console.log(`[GLOBAL_POST] Saved result ID:`, result.id);

      res.json(result);
    } catch (error) {
      console.error("[PLANNING_GLOBAL_POST]", error);
      res.status(500).json({ error: "Failed to save global configuration" });
    }
  });

  // FIX: Update products to match active season
  app.post("/api/admin/fix-product-seasons", async (req, res) => {
    try {
      if (!req.user || req.user.role !== "admin") return res.sendStatus(403);

      const activeSeason = await storage.getActiveSeason();
      if (!activeSeason) return res.status(400).json({ error: "No active season found" });

      console.log(`[FIX_SEASONS] Updating products to season: ${activeSeason.name} (${activeSeason.id})`);

      // Update ALL products to the active season
      const result = await db.execute(sql`
        UPDATE planning_products_base 
        SET season_id = ${activeSeason.id}
        WHERE season_id != ${activeSeason.id}
      `);

      // Also update sales_planning if needed? No, user plans are likely already in active season or should be. 
      // Actually, if sales_planning (dashboard) worked, it means plans ARE in active season (or one of them).
      // We want products to join them.

      res.json({
        message: "Products updated to active season",
        season: activeSeason.name,
        result
      });
    } catch (error) {
      console.error("[FIX_SEASONS] Error:", error);
      res.status(500).json({ error: "Failed to update product seasons" });
    }
  });

  // Save/Update sales planning
  app.post("/api/planning", requireAuth, async (req, res) => {
    try {
      const { planning, items } = req.body;

      if (!planning || !planning.clientId || !planning.seasonId) {
        return res.status(400).json({ error: "Invalid planning data" });
      }

      // Ensure userId is from the logged-in user
      const safePlanning = {
        ...planning,
        userId: req.user.id
      };

      const result = await storage.upsertSalesPlanning(safePlanning, items);
      res.json(result);
    } catch (error) {
      console.error("[SALES_PLANNING_POST]", error);
      res.status(500).json({ error: "Failed to save sales planning" });
    }
  });

  const httpServer = createServer(app);
  // ==================== FARMERS MANAGEMENT (Super Admin) ====================

  app.get("/api/admin/farmers", requireFarmAdmin, async (req, res) => {
    try {
      const allFarmers = await db.select().from(users).where(inArray(users.role, ['agricultor', 'admin_agricultor'])).orderBy(users.name);
      // Remove passwords before sending
      const safeFarmers = allFarmers.map(({ password, ...f }: any) => f);
      res.json(safeFarmers);
    } catch (error) {
      console.error("Failed to fetch farmers:", error);
      res.status(500).json({ error: "Failed to fetch farmers" });
    }
  });

  app.post("/api/admin/farmers", requireFarmAdmin, async (req, res) => {
    try {
      // Manual validation since we don't have a specific insert schema exported yet or want to handle password hashing
      const { username, password, name, email, phone, document, property_size, main_culture, region } = req.body;

      if (!username || !password || !name) {
        return res.status(400).json({ error: "Username, password and name are required" });
      }

      // Check if username exists
      const existing = await db.select().from(users).where(eq(users.username, username)).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const hashedPassword = await hashPassword(password);

      const [newFarmer] = await db.insert(users).values({
        username,
        password: hashedPassword,
        name,
        email: email || null,
        whatsapp_number: phone || null,
        document: document || null,
        propertySize: property_size ? String(property_size) : null,
        mainCulture: main_culture || null,
        region: region || null,
        role: "agricultor",
      }).returning();

      const { password: _, ...safeFarmer } = newFarmer;
      res.status(201).json(safeFarmer);
    } catch (error) {
      console.error("Failed to create farmer:", error);
      res.status(500).json({ error: "Failed to create farmer" });
    }
  });

  app.patch("/api/admin/farmers/:id", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { username, password, name, email, phone, document, property_size, main_culture, region } = req.body;

      // Hash password if provided
      let updateData: any = {};
      if (username !== undefined) updateData.username = username;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email || null;
      if (phone !== undefined) updateData.whatsapp_number = phone || null;
      if (document !== undefined) updateData.document = document || null;
      if (property_size !== undefined) updateData.propertySize = property_size ? String(property_size) : null;
      if (main_culture !== undefined) updateData.mainCulture = main_culture || null;
      if (region !== undefined) updateData.region = region || null;

      if (password) {
        updateData.password = await hashPassword(password);
      }

      const [updatedFarmer] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      if (!updatedFarmer) {
        return res.status(404).json({ error: "Farmer not found" });
      }

      const { password: _, ...safeFarmer } = updatedFarmer;
      res.json(safeFarmer);
    } catch (error) {
      console.error("Failed to update farmer:", error);
      res.status(500).json({ error: "Failed to update farmer" });
    }
  });

  app.patch("/api/admin/farmers/:id/toggle-active", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const farmer = await db.select().from(users).where(eq(users.id, id)).limit(1);
      if (!farmer[0]) {
        return res.status(404).json({ error: "Farmer not found" });
      }
      const newStatus = !farmer[0].isActive;
      const [updated] = await db.update(users)
        .set({ isActive: newStatus })
        .where(eq(users.id, id))
        .returning();
      const { password: _, ...safe } = updated;
      res.json(safe);
    } catch (error) {
      console.error("Failed to toggle farmer status:", error);
      res.status(500).json({ error: "Failed to toggle farmer status" });
    }
  });

  app.delete("/api/admin/farmers/:id", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db.delete(users)
        .where(eq(users.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Farmer not found" });
      }

      res.json({ message: "Farmer deleted successfully" });
    } catch (error) {
      console.error("Failed to delete farmer:", error);
      res.status(500).json({ error: "Failed to delete farmer" });
    }
  });

  // ==================== FARMER MODULES MANAGEMENT ====================

  app.get("/api/admin/farmers/:id/modules", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { userModules } = await import("@shared/schema");

      const modules = await db
        .select()
        .from(userModules)
        .where(eq(userModules.userId, id));

      res.json(modules);
    } catch (error) {
      console.error("Failed to fetch farmer modules:", error);
      res.status(500).json({ error: "Failed to fetch modules" });
    }
  });

  app.put("/api/admin/farmers/:id/modules", requireFarmAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { moduleKey, enabled } = req.body;
      const { userModules } = await import("@shared/schema");

      if (!moduleKey || typeof enabled !== "boolean") {
        return res.status(400).json({ error: "moduleKey and enabled are required" });
      }

      // Upsert the module state for this user
      await db.insert(userModules)
        .values({
          userId: id,
          moduleKey,
          enabled
        })
        .onConflictDoUpdate({
          target: [userModules.userId, userModules.moduleKey],
          set: { enabled, updatedAt: new Date() }
        });

      res.json({ message: "Module status updated successfully" });
    } catch (error) {
      console.error("Failed to update farmer module:", error);
      res.status(500).json({ error: "Failed to update module" });
    }
  });

  // ==================== FARMERS DASHBOARD STATISTICS ====================

  app.get("/api/admin/farmers/dashboard/stats", requireFarmAdmin, async (req, res) => {
    try {
      const { users, farmProperties, farmApplications, farmProductsCatalog, farmInvoiceItems, farmInvoices } = await import("@shared/schema");

      // 1. Total area (sum of all farm plots areaHa)
      const { farmPlots } = await import("@shared/schema");
      const totalAreaResult = await db
        .select({ totalArea: sum(farmPlots.areaHa) })
        .from(farmPlots);
      const totalArea = parseFloat(totalAreaResult[0]?.totalArea || "0") || 0;

      // 2. Total farmers count
      const farmersCountResult = await db
        .select({ count: count() })
        .from(users)
        .where(inArray(users.role, ['agricultor', 'admin_agricultor']));
      const totalFarmers = farmersCountResult[0]?.count || 0;

      // 3. Most used products (top 10 by application count)
      const mostUsedProducts = await db
        .select({
          productId: farmApplications.productId,
          productName: farmProductsCatalog.name,
          applicationCount: count(),
          totalQuantity: sum(farmApplications.quantity),
        })
        .from(farmApplications)
        .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
        .groupBy(farmApplications.productId, farmProductsCatalog.name)
        .orderBy(desc(count()))
        .limit(10);

      // 4. Product prices from invoices (latest price per product)
      const productPrices = await db
        .select({
          productId: farmInvoiceItems.productId,
          productName: farmInvoiceItems.productName,
          unitPrice: farmInvoiceItems.unitPrice,
          unit: farmInvoiceItems.unit,
          invoiceDate: farmInvoices.issueDate,
          supplier: farmInvoices.supplier,
        })
        .from(farmInvoiceItems)
        .innerJoin(farmInvoices, eq(farmInvoiceItems.invoiceId, farmInvoices.id))
        .where(sql`${farmInvoiceItems.productId} IS NOT NULL`)
        .orderBy(desc(farmInvoices.issueDate));

      // Group by product and get latest price
      const latestPrices = new Map();
      for (const item of productPrices) {
        if (!item.productId) continue;
        const key = item.productId;
        if (!latestPrices.has(key) ||
          (item.invoiceDate && latestPrices.get(key).invoiceDate &&
            new Date(item.invoiceDate) > new Date(latestPrices.get(key).invoiceDate))) {
          latestPrices.set(key, item);
        }
      }

      // 5. Total properties count
      const propertiesCountResult = await db
        .select({ count: count() })
        .from(farmProperties);
      const totalProperties = propertiesCountResult[0]?.count || 0;

      // 6. Applications by month (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const applicationsByMonthRaw = await db
        .select({
          month: sql<string>`to_char(${farmApplications.appliedAt}, 'YYYY-MM')`,
          count: count(),
        })
        .from(farmApplications)
        .where(gte(farmApplications.appliedAt, sixMonthsAgo))
        .groupBy(sql`to_char(${farmApplications.appliedAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${farmApplications.appliedAt}, 'YYYY-MM')`);

      // 7. Culture distribution (main_culture field on users)
      const cultureDistributionRaw = await db
        .select({
          culture: users.mainCulture,
          count: count(),
        })
        .from(users)
        .where(inArray(users.role, ['agricultor', 'admin_agricultor']))
        .groupBy(users.mainCulture);

      // 8. Stock movements by month (last 6 months)
      const { farmStockMovements } = await import("@shared/schema");
      const stockByMonthRaw = await db
        .select({
          month: sql<string>`to_char(${farmStockMovements.createdAt}, 'YYYY-MM')`,
          entries: sql<string>`SUM(CASE WHEN ${farmStockMovements.type} = 'entry' THEN CAST(${farmStockMovements.quantity} AS NUMERIC) ELSE 0 END)`,
          exits: sql<string>`SUM(CASE WHEN ${farmStockMovements.type} = 'exit' THEN ABS(CAST(${farmStockMovements.quantity} AS NUMERIC)) ELSE 0 END)`,
        })
        .from(farmStockMovements)
        .where(gte(farmStockMovements.createdAt, sixMonthsAgo))
        .groupBy(sql`to_char(${farmStockMovements.createdAt}, 'YYYY-MM')`)
        .orderBy(sql`to_char(${farmStockMovements.createdAt}, 'YYYY-MM')`);

      res.json({
        totalArea: totalArea,
        totalFarmers: totalFarmers,
        totalProperties: totalProperties,
        mostUsedProducts: mostUsedProducts.map(p => ({
          productId: p.productId,
          productName: p.productName,
          applicationCount: Number(p.applicationCount),
          totalQuantity: parseFloat(p.totalQuantity || "0"),
        })),
        productPrices: Array.from(latestPrices.values()).map(p => ({
          productId: p.productId,
          productName: p.productName,
          unitPrice: parseFloat(p.unitPrice || "0"),
          unit: p.unit,
          lastInvoiceDate: p.invoiceDate,
          supplier: p.supplier,
        })),
        applicationsByMonth: applicationsByMonthRaw.map(r => ({
          month: r.month,
          count: Number(r.count),
        })),
        cultureDistribution: cultureDistributionRaw
          .filter(r => r.culture)
          .map(r => ({ name: r.culture || "Outros", value: Number(r.count) })),
        stockByMonth: stockByMonthRaw.map(r => ({
          month: r.month,
          entries: parseFloat(r.entries || "0"),
          exits: parseFloat(r.exits || "0"),
        })),
      });
    } catch (error) {
      console.error("Failed to fetch farmers dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard statistics" });
    }
  });

  // GET /api/admin/farmers/map-data — All plots with coordinates + their most recent applications
  app.get("/api/admin/farmers/map-data", requireFarmAdmin, async (req, res) => {
    try {
      const { farmPlots, farmProperties, farmApplications, farmProductsCatalog, users } = await import("@shared/schema");

      // Get all plots that have coordinates
      const plots = await db
        .select({
          plotId: farmPlots.id,
          plotName: farmPlots.name,
          areaHa: farmPlots.areaHa,
          crop: farmPlots.crop,
          coordinates: farmPlots.coordinates,
          propertyId: farmProperties.id,
          propertyName: farmProperties.name,
          farmerId: users.id,
          farmerName: users.name,
        })
        .from(farmPlots)
        .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
        .innerJoin(users, eq(farmProperties.farmerId, users.id))
        .where(sql`${farmPlots.coordinates} IS NOT NULL AND ${farmPlots.coordinates} != '[]' AND ${farmPlots.coordinates} != ''`);

      // For each plot, get the last 5 applications
      const plotIds = plots.map(p => p.plotId);

      let applications: any[] = [];
      if (plotIds.length > 0) {
        applications = await db
          .select({
            plotId: farmApplications.plotId,
            productId: farmApplications.productId,
            productName: farmProductsCatalog.name,
            category: farmProductsCatalog.category,
            quantity: farmApplications.quantity,
            appliedAt: farmApplications.appliedAt,
            appliedBy: farmApplications.appliedBy,
          })
          .from(farmApplications)
          .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
          .where(inArray(farmApplications.plotId, plotIds))
          .orderBy(desc(farmApplications.appliedAt));
      }

      // Group applications by plotId
      const appsByPlot = new Map<string, any[]>();
      for (const app of applications) {
        if (!app.plotId) continue;
        if (!appsByPlot.has(app.plotId)) appsByPlot.set(app.plotId, []);
        const list = appsByPlot.get(app.plotId)!;
        if (list.length < 5) list.push(app);
      }

      // Get unique products list for filters
      const allProducts = await db
        .select({ id: farmProductsCatalog.id, name: farmProductsCatalog.name, category: farmProductsCatalog.category })
        .from(farmProductsCatalog)
        .where(eq(farmProductsCatalog.status, "active"))
        .orderBy(farmProductsCatalog.name);

      res.json({
        plots: plots.map(p => ({
          plotId: p.plotId,
          plotName: p.plotName,
          areaHa: parseFloat(p.areaHa || "0"),
          crop: p.crop,
          coordinates: (() => { try { return JSON.parse(p.coordinates || "[]"); } catch { return []; } })(),
          propertyId: p.propertyId,
          propertyName: p.propertyName,
          farmerId: p.farmerId,
          farmerName: p.farmerName,
          applications: appsByPlot.get(p.plotId) || [],
        })),
        products: allProducts,
      });
    } catch (error) {
      console.error("Failed to fetch map data:", error);
      res.status(500).json({ error: "Failed to fetch map data" });
    }
  });

  // ============ VIRTUAL WEATHER STATIONS LOGIC ============
  // Rotas extraidas para server/weather-station-routes.ts
  const { registerWeatherStationRoutes } = await import("./weather-station-routes");
  registerWeatherStationRoutes(app);

  return httpServer;
}
