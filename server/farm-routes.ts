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
            const { name, areaHa, crop } = req.body;
            if (!name || !areaHa) return res.status(400).json({ error: "Plot name and area required" });

            const plot = await farmStorage.createPlot({
                propertyId: req.params.propertyId,
                name,
                areaHa: String(areaHa),
                crop,
            });
            res.status(201).json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_CREATE]", error);
            res.status(500).json({ error: "Failed to create plot" });
        }
    });

    app.put("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop } = req.body;
            const plot = await farmStorage.updatePlot(req.params.id, {
                name,
                areaHa: areaHa ? String(areaHa) : undefined,
                crop,
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
            const { name, unit, dosePerHa, category, activeIngredient } = req.body;
            if (!name || !unit) return res.status(400).json({ error: "Product name and unit required" });

            const product = await farmStorage.createProduct({
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : null,
                category,
                activeIngredient,
            });
            res.status(201).json(product);
        } catch (error) {
            console.error("[FARM_PRODUCT_CREATE]", error);
            res.status(500).json({ error: "Failed to create product" });
        }
    });

    app.put("/api/farm/products/:id", requireFarmer, async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient } = req.body;
            const product = await farmStorage.updateProduct(req.params.id, {
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : undefined,
                category,
                activeIngredient,
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
            const invoice = await farmStorage.createInvoice({
                farmerId: (req.user as any).id,
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

    console.log("✅ Farm routes registered (/api/farm/*, /api/pdv/*)");
}
