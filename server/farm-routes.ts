/**
 * Farm Stock Management System — API Routes
 * Endpoints: /api/farm/*
 */
import { Express, Request, Response, NextFunction } from "express";
import { farmStorage } from "./farm-storage";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import multer from "multer";
import { parseFarmInvoicePDF } from "./parse-farm-invoice";

const scryptAsync = promisify(scrypt);
const upload = multer({ storage: multer.memoryStorage() });

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Middleware: require authenticated user with role 'agricultor' or 'administrador'
function requireFarmer(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Autenticação necessária" });
    }
    const role = (req.user as any)?.role;
    if (role !== 'agricultor' && role !== 'administrador') {
        return res.status(403).json({ error: "Acesso restrito a agricultores" });
    }
    next();
}

// Middleware: require PDV session
function requirePdv(req: Request, res: Response, next: NextFunction) {
    if (!(req.session as any).pdvTerminalId) {
        return res.status(401).json({ error: "PDV authentication required" });
    }
    next();
}

export function registerFarmRoutes(app: Express) {
    // ==================== FARMER AUTH (uses existing passport auth) ====================

    // /api/farm/me → returns current user info (no separate login needed)
    app.get("/api/farm/me", requireFarmer, async (req, res) => {
        try {
            const user = req.user as any;
            res.json({
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
            });
        } catch (error) {
            console.error("[FARM_ME]", error);
            res.status(500).json({ error: "Failed to get user" });
        }
    });


    // ==================== PROPERTIES ====================

    app.get("/api/farm/properties", requireFarmer, async (req, res) => {
        try {
            const properties = await farmStorage.getProperties((req.user as any).id);
            res.json(properties);
        } catch (error) {
            console.error("[FARM_PROPERTIES_GET]", error);
            res.status(500).json({ error: "Failed to get properties" });
        }
    });

    app.post("/api/farm/properties", requireFarmer, async (req, res) => {
        try {
            const { name, location, totalAreaHa } = req.body;
            if (!name) return res.status(400).json({ error: "Property name required" });

            const property = await farmStorage.createProperty({
                farmerId: (req.user as any).id,
                name,
                location,
                totalAreaHa: totalAreaHa ? String(totalAreaHa) : null,
            });
            res.status(201).json(property);
        } catch (error) {
            console.error("[FARM_PROPERTY_CREATE]", error);
            res.status(500).json({ error: "Failed to create property" });
        }
    });

    app.put("/api/farm/properties/:id", requireFarmer, async (req, res) => {
        try {
            const { name, location, totalAreaHa } = req.body;
            const property = await farmStorage.updateProperty(req.params.id, {
                name,
                location,
                totalAreaHa: totalAreaHa ? String(totalAreaHa) : undefined,
            });
            res.json(property);
        } catch (error) {
            console.error("[FARM_PROPERTY_UPDATE]", error);
            res.status(500).json({ error: "Failed to update property" });
        }
    });

    app.delete("/api/farm/properties/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteProperty(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PROPERTY_DELETE]", error);
            res.status(500).json({ error: "Failed to delete property" });
        }
    });

    // ==================== PLOTS ====================

    app.get("/api/farm/properties/:propertyId/plots", requireFarmer, async (req, res) => {
        try {
            const plots = await farmStorage.getPlots(req.params.propertyId);
            res.json(plots);
        } catch (error) {
            console.error("[FARM_PLOTS_GET]", error);
            res.status(500).json({ error: "Failed to get plots" });
        }
    });

    app.get("/api/farm/plots", requireFarmer, async (req, res) => {
        try {
            const plots = await farmStorage.getPlotsByFarmer((req.user as any).id);
            res.json(plots);
        } catch (error) {
            console.error("[FARM_ALL_PLOTS_GET]", error);
            res.status(500).json({ error: "Failed to get plots" });
        }
    });

    app.post("/api/farm/properties/:propertyId/plots", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop, coordinates } = req.body;
            if (!name || !areaHa) return res.status(400).json({ error: "Plot name and area required" });

            const plot = await farmStorage.createPlot({
                propertyId: req.params.propertyId,
                name,
                areaHa: String(areaHa),
                crop,
                coordinates: coordinates ? JSON.stringify(coordinates) : null,
            });
            res.status(201).json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_CREATE]", error);
            res.status(500).json({ error: "Failed to create plot" });
        }
    });

    app.put("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop, coordinates } = req.body;
            const plot = await farmStorage.updatePlot(req.params.id, {
                name,
                areaHa: areaHa ? String(areaHa) : undefined,
                crop,
                coordinates: coordinates !== undefined ? (coordinates ? JSON.stringify(coordinates) : null) : undefined,
            });
            res.json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update plot" });
        }
    });

    app.delete("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deletePlot(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PLOT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete plot" });
        }
    });

    // ==================== PRODUCTS CATALOG ====================

    app.get("/api/farm/products", requireFarmer, async (req, res) => {
        try {
            const products = await farmStorage.getAllProducts();
            res.json(products);
        } catch (error) {
            console.error("[FARM_PRODUCTS_GET]", error);
            res.status(500).json({ error: "Failed to get products" });
        }
    });

    app.post("/api/farm/products", requireFarmer, async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient, imageUrl } = req.body;
            if (!name || !unit) return res.status(400).json({ error: "Product name and unit required" });

            const product = await farmStorage.createProduct({
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : null,
                category,
                activeIngredient,
                imageUrl: imageUrl || null,
            });
            res.status(201).json(product);
        } catch (error) {
            console.error("[FARM_PRODUCT_CREATE]", error);
            res.status(500).json({ error: "Failed to create product" });
        }
    });

    app.put("/api/farm/products/:id", requireFarmer, async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient, imageUrl } = req.body;
            const product = await farmStorage.updateProduct(req.params.id, {
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : undefined,
                category,
                activeIngredient,
                imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined,
            });
            res.json(product);
        } catch (error) {
            console.error("[FARM_PRODUCT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update product" });
        }
    });

    app.delete("/api/farm/products/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteProduct(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PRODUCT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete product" });
        }
    });

    // ==================== STOCK ====================

    app.get("/api/farm/stock", requireFarmer, async (req, res) => {
        try {
            const stock = await farmStorage.getStock((req.user as any).id);
            res.json(stock);
        } catch (error) {
            console.error("[FARM_STOCK_GET]", error);
            res.status(500).json({ error: "Failed to get stock" });
        }
    });

    app.get("/api/farm/stock/movements", requireFarmer, async (req, res) => {
        try {
            const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
            const movements = await farmStorage.getStockMovements((req.user as any).id, limit);
            res.json(movements);
        } catch (error) {
            console.error("[FARM_MOVEMENTS_GET]", error);
            res.status(500).json({ error: "Failed to get stock movements" });
        }
    });

    // ==================== INVOICES ====================

    app.get("/api/farm/invoices", requireFarmer, async (req, res) => {
        try {
            const invoices = await farmStorage.getInvoices((req.user as any).id);
            res.json(invoices);
        } catch (error) {
            console.error("[FARM_INVOICES_GET]", error);
            res.status(500).json({ error: "Failed to get invoices" });
        }
    });

    // Invoices grouped by supplier for dashboard cards
    app.get("/api/farm/invoices/summary/by-supplier", requireFarmer, async (req, res) => {
        try {
            const invoices = await farmStorage.getInvoices((req.user as any).id);
            const supplierMap: Record<string, any> = {};

            for (const inv of invoices) {
                const supplier = inv.supplier || "Fornecedor Desconhecido";
                if (!supplierMap[supplier]) {
                    supplierMap[supplier] = {
                        supplier,
                        totalAmount: 0,
                        invoiceCount: 0,
                        invoices: [],
                    };
                }
                const items = await farmStorage.getInvoiceItems(inv.id);
                supplierMap[supplier].totalAmount += parseFloat(inv.totalAmount || "0");
                supplierMap[supplier].invoiceCount += 1;
                supplierMap[supplier].invoices.push({
                    id: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    issueDate: inv.issueDate,
                    totalAmount: inv.totalAmount,
                    currency: inv.currency,
                    status: inv.status,
                    items: items.map(it => ({
                        productName: it.productName,
                        quantity: it.quantity,
                        unit: it.unit,
                        totalPrice: it.totalPrice,
                    })),
                });
            }

            res.json(Object.values(supplierMap));
        } catch (error) {
            console.error("[FARM_SUPPLIER_SUMMARY]", error);
            res.status(500).json({ error: "Failed to get supplier summary" });
        }
    });

    app.get("/api/farm/invoices/:id", requireFarmer, async (req, res) => {
        try {
            const invoice = await farmStorage.getInvoiceById(req.params.id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });
            const items = await farmStorage.getInvoiceItems(req.params.id);
            res.json({ ...invoice, items });
        } catch (error) {
            console.error("[FARM_INVOICE_GET]", error);
            res.status(500).json({ error: "Failed to get invoice" });
        }
    });

    // Upload and parse PDF invoice
    app.post("/api/farm/invoices/import", requireFarmer, upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "PDF file required" });
            }

            const parsed = await parseFarmInvoicePDF(req.file.buffer);

            // Create invoice record
            const seasonId = req.body?.seasonId || null;
            const invoice = await farmStorage.createInvoice({
                farmerId: (req.user as any).id,
                seasonId,
                invoiceNumber: parsed.invoiceNumber,
                supplier: parsed.supplier,
                issueDate: parsed.issueDate,
                currency: parsed.currency,
                totalAmount: String(parsed.totalAmount),
                status: "pending",
                rawPdfData: parsed.rawText.substring(0, 5000), // Save first 5k chars for debug
            });

            // Create invoice items (try to match with catalog products, auto-create if not found)
            const allProducts = await farmStorage.getAllProducts();
            const invoiceItems = [];

            for (const item of parsed.items) {
                // Try to match product by name (fuzzy)
                let matchedProduct = allProducts.find(p =>
                    p.name.toUpperCase().includes(item.productName.toUpperCase().substring(0, 10)) ||
                    item.productName.toUpperCase().includes(p.name.toUpperCase().substring(0, 10))
                );

                // Auto-create product if not found in catalog
                if (!matchedProduct) {
                    try {
                        matchedProduct = await farmStorage.createProduct({
                            name: item.productName,
                            unit: item.unit,
                            category: null,
                            dosePerHa: null,
                            activeIngredient: null,
                        });
                        allProducts.push(matchedProduct); // Add to list to avoid duplicates in same invoice
                        console.log(`[FARM_INVOICE_IMPORT] Auto-created product: ${item.productName} (${matchedProduct.id})`);
                    } catch (err) {
                        console.error(`[FARM_INVOICE_IMPORT] Failed to auto-create product: ${item.productName}`, err);
                    }
                }

                invoiceItems.push({
                    invoiceId: invoice.id,
                    productId: matchedProduct?.id || null,
                    productCode: item.productCode,
                    productName: item.productName,
                    unit: item.unit,
                    quantity: String(item.quantity),
                    unitPrice: String(item.unitPrice),
                    discount: String(item.discount),
                    totalPrice: String(item.totalPrice),
                    batch: item.batch || null,
                    expiryDate: item.expiryDate || null,
                });
            }

            if (invoiceItems.length > 0) {
                await farmStorage.createInvoiceItems(invoiceItems);
            }

            // Return parsed data for review
            const items = await farmStorage.getInvoiceItems(invoice.id);
            res.status(201).json({
                invoice,
                items,
                parsedItemCount: parsed.items.length,
                message: `Fatura ${parsed.invoiceNumber} importada com ${parsed.items.length} itens.`,
            });
        } catch (error) {
            console.error("[FARM_INVOICE_IMPORT]", error);
            res.status(500).json({ error: "Failed to import invoice" });
        }
    });

    // Confirm invoice → push items to stock
    app.post("/api/farm/invoices/:id/confirm", requireFarmer, async (req, res) => {
        try {
            const invoice = await farmStorage.getInvoiceById(req.params.id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });
            if (invoice.status === "confirmed") {
                return res.status(400).json({ error: "Invoice already confirmed" });
            }

            await farmStorage.confirmInvoice(req.params.id, (req.user as any).id);
            res.json({ message: "Fatura confirmada. Estoque atualizado." });
        } catch (error) {
            console.error("[FARM_INVOICE_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm invoice" });
        }
    });

    // Update invoice item (link to catalog product)
    app.patch("/api/farm/invoices/:invoiceId/items/:itemId", requireFarmer, async (req, res) => {
        try {
            const { productId } = req.body;
            // Simple update of the productId link
            const { db } = await import("./db");
            const { farmInvoiceItems } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const [updated] = await db.update(farmInvoiceItems)
                .set({ productId })
                .where(eq(farmInvoiceItems.id, req.params.itemId))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_INVOICE_ITEM_UPDATE]", error);
            res.status(500).json({ error: "Failed to update invoice item" });
        }
    });

    // Delete invoice
    app.delete("/api/farm/invoices/:id", requireFarmer, async (req, res) => {
        try {
            const invoice = await farmStorage.getInvoiceById(req.params.id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });

            await farmStorage.deleteInvoice(req.params.id);
            res.json({ message: "Fatura excluída com sucesso." });
        } catch (error) {
            console.error("[FARM_INVOICE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete invoice" });
        }
    });

    // ==================== APPLICATIONS ====================

    app.get("/api/farm/applications", requireFarmer, async (req, res) => {
        try {
            const plotId = req.query.plotId ? String(req.query.plotId) : undefined;
            const applications = await farmStorage.getApplications((req.user as any).id, plotId);
            res.json(applications);
        } catch (error) {
            console.error("[FARM_APPLICATIONS_GET]", error);
            res.status(500).json({ error: "Failed to get applications" });
        }
    });

    // ==================== PLOT COSTS ====================

    app.get("/api/farm/plot-costs", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const { db } = await import("./db");
            const { farmApplications, farmProductsCatalog, farmPlots, farmProperties, farmStock } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");

            // Get all applications with product and plot info
            const apps = await db.select({
                appId: farmApplications.id,
                productId: farmApplications.productId,
                plotId: farmApplications.plotId,
                propertyId: farmApplications.propertyId,
                quantity: farmApplications.quantity,
                appliedAt: farmApplications.appliedAt,
                productName: farmProductsCatalog.name,
                productUnit: farmProductsCatalog.unit,
                productCategory: farmProductsCatalog.category,
                productDosePerHa: farmProductsCatalog.dosePerHa,
                productImageUrl: farmProductsCatalog.imageUrl,
                plotName: farmPlots.name,
                plotAreaHa: farmPlots.areaHa,
                plotCrop: farmPlots.crop,
                propertyName: farmProperties.name,
            })
                .from(farmApplications)
                .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
                .innerJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
                .innerJoin(farmProperties, eq(farmApplications.propertyId, farmProperties.id))
                .where(eq(farmApplications.farmerId, farmerId))
                .orderBy(farmApplications.appliedAt);

            // Get stock with averageCost for each product
            const stockData = await db.select({
                productId: farmStock.productId,
                averageCost: farmStock.averageCost,
                currentQty: farmStock.quantity,
            })
                .from(farmStock)
                .where(eq(farmStock.farmerId, farmerId));

            const costMap: Record<string, number> = {};
            for (const s of stockData) {
                costMap[s.productId] = parseFloat(s.averageCost || "0");
            }

            // Build aggregated data
            const plotData: Record<string, {
                plotId: string;
                plotName: string;
                plotAreaHa: number;
                plotCrop: string | null;
                propertyId: string;
                propertyName: string;
                totalCost: number;
                totalQtyByProduct: Record<string, { productId: string; productName: string; productUnit: string; category: string | null; imageUrl: string | null; quantity: number; unitCost: number; totalCost: number; dosePerHa: number | null }>;
                applications: typeof apps;
            }> = {};

            for (const app of apps) {
                if (!plotData[app.plotId]) {
                    plotData[app.plotId] = {
                        plotId: app.plotId,
                        plotName: app.plotName,
                        plotAreaHa: parseFloat(app.plotAreaHa || "0"),
                        plotCrop: app.plotCrop,
                        propertyId: app.propertyId,
                        propertyName: app.propertyName,
                        totalCost: 0,
                        totalQtyByProduct: {},
                        applications: [],
                    };
                }

                const qty = parseFloat(app.quantity || "0");
                const unitCost = costMap[app.productId] || 0;
                const appCost = qty * unitCost;

                plotData[app.plotId].totalCost += appCost;
                plotData[app.plotId].applications.push(app);

                if (!plotData[app.plotId].totalQtyByProduct[app.productId]) {
                    plotData[app.plotId].totalQtyByProduct[app.productId] = {
                        productId: app.productId,
                        productName: app.productName,
                        productUnit: app.productUnit,
                        category: app.productCategory,
                        imageUrl: app.productImageUrl,
                        quantity: 0,
                        unitCost,
                        totalCost: 0,
                        dosePerHa: app.productDosePerHa ? parseFloat(app.productDosePerHa) : null,
                    };
                }
                plotData[app.plotId].totalQtyByProduct[app.productId].quantity += qty;
                plotData[app.plotId].totalQtyByProduct[app.productId].totalCost += appCost;
            }

            // Convert to array and compute per-hectare for each plot
            const result = Object.values(plotData).map(p => ({
                ...p,
                costPerHa: p.plotAreaHa > 0 ? p.totalCost / p.plotAreaHa : 0,
                products: Object.values(p.totalQtyByProduct),
                applications: undefined, // Don't send raw apps to reduce payload
            }));

            // Category totals
            const categoryTotals: Record<string, number> = {};
            for (const p of result) {
                for (const prod of p.products) {
                    const cat = prod.category || "outro";
                    categoryTotals[cat] = (categoryTotals[cat] || 0) + prod.totalCost;
                }
            }

            res.json({
                plots: result,
                categoryTotals,
                totalCost: result.reduce((s, p) => s + p.totalCost, 0),
                totalArea: result.reduce((s, p) => s + p.plotAreaHa, 0),
            });
        } catch (error) {
            console.error("[FARM_PLOT_COSTS]", error);
            res.status(500).json({ error: "Failed to get plot costs" });
        }
    });

    // ==================== EXPENSES ====================

    app.get("/api/farm/expenses", requireFarmer, async (req, res) => {
        try {
            const expenses = await farmStorage.getExpenses((req.user as any).id);
            res.json(expenses);
        } catch (error) {
            console.error("[FARM_EXPENSES_GET]", error);
            res.status(500).json({ error: "Failed to get expenses" });
        }
    });

    app.post("/api/farm/expenses", requireFarmer, async (req, res) => {
        try {
            const { plotId, propertyId, category, description, amount, expenseDate } = req.body;
            if (!category || !amount) return res.status(400).json({ error: "Category and amount required" });

            const expense = await farmStorage.createExpense({
                farmerId: (req.user as any).id,
                plotId: plotId || null,
                propertyId: propertyId || null,
                category,
                description,
                amount: String(amount),
                expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
            });
            res.status(201).json(expense);
        } catch (error) {
            console.error("[FARM_EXPENSE_CREATE]", error);
            res.status(500).json({ error: "Failed to create expense" });
        }
    });

    // ==================== PDV TERMINALS ====================

    app.get("/api/farm/pdv-terminals", requireFarmer, async (req, res) => {
        try {
            const terminals = await farmStorage.getPdvTerminals((req.user as any).id);
            // Don't return passwords
            const safe = terminals.map(({ password, ...t }) => t);
            res.json(safe);
        } catch (error) {
            console.error("[FARM_PDV_TERMINALS_GET]", error);
            res.status(500).json({ error: "Failed to get terminals" });
        }
    });

    app.post("/api/farm/pdv-terminals", requireFarmer, async (req, res) => {
        try {
            const { name, username, password, propertyId } = req.body;
            if (!name || !username || !password) {
                return res.status(400).json({ error: "Name, username and password required" });
            }

            const terminal = await farmStorage.createPdvTerminal({
                farmerId: (req.user as any).id,
                name,
                username,
                password: await hashPassword(password),
                propertyId: propertyId || null,
                isOnline: false,
                lastHeartbeat: null,
            });

            const { password: _, ...safe } = terminal;
            res.status(201).json(safe);
        } catch (error) {
            console.error("[FARM_PDV_TERMINAL_CREATE]", error);
            res.status(500).json({ error: "Failed to create terminal" });
        }
    });

    // ==================== PDV API (used by tablet) ====================

    app.post("/api/pdv/login", async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password required" });
            }

            const terminal = await farmStorage.getPdvTerminal(username);
            if (!terminal || !(await comparePasswords(password, terminal.password))) {
                return res.status(401).json({ error: "Credenciais inválidas" });
            }

            (req.session as any).pdvTerminalId = terminal.id;
            (req.session as any).pdvFarmerId = terminal.farmerId;
            (req.session as any).pdvPropertyId = terminal.propertyId;

            // Mark as online
            await farmStorage.updatePdvHeartbeat(terminal.id);

            // Get all data the PDV needs
            const products = await farmStorage.getAllProducts();
            const stock = await farmStorage.getStock(terminal.farmerId);
            const plots = await farmStorage.getPlotsByFarmer(terminal.farmerId);
            const properties = await farmStorage.getProperties(terminal.farmerId);

            res.json({
                terminal: { id: terminal.id, name: terminal.name, propertyId: terminal.propertyId },
                products,
                stock,
                plots,
                properties,
            });
        } catch (error) {
            console.error("[PDV_LOGIN]", error);
            res.status(500).json({ error: "Login failed" });
        }
    });

    // PDV withdraw: register application + update stock
    app.post("/api/pdv/withdraw", requirePdv, async (req, res) => {
        try {
            const { productId, quantity, plotId, propertyId, appliedBy, notes } = req.body;
            if (!productId || !quantity || !plotId) {
                return res.status(400).json({ error: "Product, quantity and plot required" });
            }

            const farmerId = (req.session as any).pdvFarmerId;
            const resolvedPropertyId = propertyId || (req.session as any).pdvPropertyId;

            // Check if plotId is actually a property (when user selects property without plots)
            let resolvedPlotId = plotId;
            const { db } = await import("./db");
            const { farmPlots } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const [existingPlot] = await db.select().from(farmPlots).where(eq(farmPlots.id, plotId));
            if (!existingPlot) {
                // plotId is probably a propertyId — auto-create a default plot
                const property = await farmStorage.getPropertyById(plotId);
                if (property) {
                    const newPlot = await farmStorage.createPlot({
                        propertyId: property.id,
                        name: property.name,
                        areaHa: property.totalAreaHa || "0",
                        crop: null,
                    });
                    resolvedPlotId = newPlot.id;
                    console.log(`[PDV_WITHDRAW] Auto-created plot "${newPlot.name}" for property "${property.name}"`);
                }
            }

            const application = await farmStorage.createApplication({
                farmerId,
                productId,
                plotId: resolvedPlotId,
                propertyId: resolvedPropertyId || plotId,
                quantity: String(quantity),
                appliedBy: appliedBy || "PDV",
                notes,
                appliedAt: new Date(),
                syncedFromOffline: false,
            });

            res.status(201).json(application);
        } catch (error) {
            console.error("[PDV_WITHDRAW]", error);
            res.status(500).json({ error: "Failed to register withdrawal" });
        }
    });

    // PDV sync: batch upload offline applications
    app.post("/api/pdv/sync", requirePdv, async (req, res) => {
        try {
            const { applications } = req.body;
            if (!Array.isArray(applications)) {
                return res.status(400).json({ error: "Applications array required" });
            }

            const farmerId = (req.session as any).pdvFarmerId;
            const results = [];

            for (const app of applications) {
                try {
                    const application = await farmStorage.createApplication({
                        farmerId,
                        productId: app.productId,
                        plotId: app.plotId,
                        propertyId: app.propertyId,
                        quantity: String(app.quantity),
                        appliedBy: app.appliedBy || "PDV (offline)",
                        notes: app.notes,
                        appliedAt: app.appliedAt ? new Date(app.appliedAt) : new Date(),
                        syncedFromOffline: true,
                    });
                    results.push({ success: true, id: application.id });
                } catch (err) {
                    results.push({ success: false, error: String(err) });
                }
            }

            res.json({ synced: results.filter(r => r.success).length, total: applications.length, results });
        } catch (error) {
            console.error("[PDV_SYNC]", error);
            res.status(500).json({ error: "Failed to sync" });
        }
    });

    // PDV heartbeat
    app.post("/api/pdv/heartbeat", requirePdv, async (req, res) => {
        try {
            await farmStorage.updatePdvHeartbeat((req.session as any).pdvTerminalId);
            res.json({ status: "ok" });
        } catch (error) {
            res.status(500).json({ error: "Heartbeat failed" });
        }
    });

    // PDV refresh data (get latest stock/products)
    app.get("/api/pdv/data", requirePdv, async (req, res) => {
        try {
            const farmerId = (req.session as any).pdvFarmerId;
            const products = await farmStorage.getAllProducts();
            const stock = await farmStorage.getStock(farmerId);
            const plots = await farmStorage.getPlotsByFarmer(farmerId);
            const properties = await farmStorage.getProperties(farmerId);
            res.json({ products, stock, plots, properties });
        } catch (error) {
            console.error("[PDV_DATA]", error);
            res.status(500).json({ error: "Failed to get data" });
        }
    });

    // PDV withdrawals history (agrupar aplicações por batch)
    app.get("/api/pdv/withdrawals", requirePdv, async (req, res) => {
        try {
            const farmerId = (req.session as any).pdvFarmerId;
            const applications = await farmStorage.getApplications(farmerId);
            
            // Agrupar aplicações por batch (aplicações criadas dentro de 5 minutos são do mesmo batch)
            const batches: Array<{
                batchId: string;
                appliedAt: Date;
                applications: typeof applications;
                propertyName?: string;
                notes?: string;
            }> = [];
            
            // Ordenar por data (mais recente primeiro)
            const sortedApps = [...applications].sort((a, b) => 
                new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
            );
            
            for (const app of sortedApps) {
                // Procurar batch existente (dentro de 5 minutos)
                const appTime = new Date(app.appliedAt).getTime();
                let foundBatch = false;
                
                for (const batch of batches) {
                    const batchTime = new Date(batch.appliedAt).getTime();
                    const timeDiff = Math.abs(appTime - batchTime) / 1000 / 60; // diferença em minutos
                    
                    if (timeDiff <= 5) {
                        // Mesmo batch
                        batch.applications.push(app);
                        foundBatch = true;
                        break;
                    }
                }
                
                if (!foundBatch) {
                    // Novo batch
                    batches.push({
                        batchId: app.id, // Usar ID da primeira aplicação como batchId
                        appliedAt: app.appliedAt,
                        applications: [app],
                        propertyName: app.propertyName,
                        notes: app.notes,
                    });
                }
            }
            
            // Ordenar batches por data (mais recente primeiro)
            batches.sort((a, b) => 
                new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
            );
            
            res.json(batches);
        } catch (error) {
            console.error("[PDV_WITHDRAWALS]", error);
            res.status(500).json({ error: "Failed to get withdrawals" });
        }
    });

    // ==================== Seasons (Safras) ====================
    app.get("/api/farm/seasons", requireFarmer, async (req, res) => {
        try {
            const seasons = await farmStorage.getSeasons((req.user as any).id);
            res.json(seasons);
        } catch (error) {
            console.error("[FARM_SEASONS]", error);
            res.status(500).json({ error: "Failed to get seasons" });
        }
    });

    app.post("/api/farm/seasons", requireFarmer, async (req, res) => {
        try {
            const season = await farmStorage.createSeason({
                farmerId: (req.user as any).id,
                name: req.body.name,
                startDate: req.body.startDate ? new Date(req.body.startDate) : null,
                endDate: req.body.endDate ? new Date(req.body.endDate) : null,
                isActive: req.body.isActive ?? true,
            });
            res.json(season);
        } catch (error) {
            console.error("[FARM_SEASONS]", error);
            res.status(500).json({ error: "Failed to create season" });
        }
    });

    app.patch("/api/farm/seasons/:id", requireFarmer, async (req, res) => {
        try {
            const data: any = {};
            if (req.body.name !== undefined) data.name = req.body.name;
            if (req.body.startDate !== undefined) data.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
            if (req.body.endDate !== undefined) data.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
            if (req.body.isActive !== undefined) data.isActive = req.body.isActive;
            const season = await farmStorage.updateSeason(req.params.id, data);
            res.json(season);
        } catch (error) {
            console.error("[FARM_SEASONS]", error);
            res.status(500).json({ error: "Failed to update season" });
        }
    });

    app.delete("/api/farm/seasons/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteSeason(req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error("[FARM_SEASONS]", error);
            res.status(500).json({ error: "Failed to delete season" });
        }
    });

    console.log("✅ Farm routes registered (/api/farm/*, /api/pdv/*)");
}
