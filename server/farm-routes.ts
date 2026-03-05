/**
 * Farm Stock Management System — API Routes
 * Endpoints: /api/farm/*
 */
import { Express, Request, Response, NextFunction } from "express";
import { farmStorage } from "./farm-storage";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { farmProductsCatalog, farmStockMovements, farmInvoiceItems } from "@shared/schema";
import { ZApiClient } from "./whatsapp/zapi-client";
import multer from "multer";
import { parseFarmInvoicePDF, parseFarmInvoiceImage } from "./parse-farm-invoice";

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

    // /api/farm/my-modules → returns enabled modules for current user
    app.get("/api/farm/my-modules", requireFarmer, async (req, res) => {
        try {
            const { userModules } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");

            const modules = await db
                .select()
                .from(userModules)
                .where(eq(userModules.userId, req.user!.id));

            res.json(modules);
        } catch (error) {
            console.error("Failed to fetch my modules:", error);
            res.status(500).json({ error: "Failed to fetch modules" });
        }
    });

    // /api/farm/me → returns current user info (no separate login needed)
    app.get("/api/farm/me", requireFarmer, async (req, res) => {
        try {
            const user = req.user as any;
            // Fetch location fields from DB (not in Drizzle schema)
            let locationData: any = {};
            try {
                const { pool } = await import("./db");
                const isNeon = (process.env.DATABASE_URL || "").includes("neon.tech");
                let rows: any[];
                if (isNeon) {
                    const result = await pool.query(
                        "SELECT farm_city, farm_latitude, farm_longitude, bulletin_enabled, invoice_email, accountant_email, language FROM users WHERE id = $1",
                        [user.id]
                    );
                    rows = result.rows || [];
                } else {
                    rows = await pool.unsafe(
                        "SELECT farm_city, farm_latitude, farm_longitude, bulletin_enabled, invoice_email, accountant_email, language FROM users WHERE id = $1",
                        [user.id]
                    );
                }
                if (rows.length > 0) locationData = rows[0];
            } catch (e) {
                console.error("[FARM_ME] Error fetching location:", e);
            }

            res.json({
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                whatsapp_number: user.whatsapp_number,
                whatsapp_extra_numbers: user.whatsapp_extra_numbers,
                farm_city: locationData.farm_city || "",
                farm_latitude: locationData.farm_latitude || "",
                farm_longitude: locationData.farm_longitude || "",
                bulletin_enabled: locationData.bulletin_enabled !== false,
                invoice_email: locationData.invoice_email || "",
                accountant_email: locationData.accountant_email || "",
                language: locationData.language || "pt-BR",
            });
        } catch (error) {
            console.error("[FARM_ME]", error);
            res.status(500).json({ error: "Failed to get user" });
        }
    });

    // Update user profile (name and whatsapp)
    app.put("/api/farm/me", requireFarmer, async (req, res) => {
        try {
            const { name, whatsapp_number, whatsapp_extra_numbers, farm_city, farm_latitude, farm_longitude, bulletin_enabled, invoice_email, accountant_email, language } = req.body;
            const userId = (req.user as any).id;

            // Dynamically import db to avoid circular dependency issues
            const { db } = await import("./db");
            const { users } = await import("../shared/schema");
            const { eq, sql } = await import("drizzle-orm");

            const formattedPhone = whatsapp_number ? ZApiClient.formatPhoneNumber(whatsapp_number) : null;
            console.log(`[PROFILE_UPDATE] Updating user ${userId} with phone: Raw='${whatsapp_number}' -> Formatted='${formattedPhone}'`);

            const [updatedUser] = await db.update(users)
                .set({
                    name,
                    whatsapp_number: formattedPhone,
                    whatsapp_extra_numbers: whatsapp_extra_numbers || null,
                })
                .where(eq(users.id, userId))
                .returning();

            // Update location fields via raw SQL (not in Drizzle schema yet)
            if (farm_city !== undefined || farm_latitude !== undefined || farm_longitude !== undefined || bulletin_enabled !== undefined || invoice_email !== undefined || accountant_email !== undefined) {
                const { pool } = await import("./db");
                const isNeon = (process.env.DATABASE_URL || "").includes("neon.tech");
                const queryStr = `UPDATE users SET 
                    farm_city = COALESCE($1, farm_city),
                    farm_latitude = COALESCE($2, farm_latitude),
                    farm_longitude = COALESCE($3, farm_longitude),
                    bulletin_enabled = COALESCE($4, bulletin_enabled),
                    invoice_email = $6,
                    accountant_email = $7,
                    language = COALESCE($8, language)
                WHERE id = $5`;
                const params = [farm_city || null, farm_latitude || null, farm_longitude || null, bulletin_enabled ?? true, userId, invoice_email || null, accountant_email || null, language || null];
                if (isNeon) {
                    await pool.query(queryStr, params);
                } else {
                    await pool.unsafe(queryStr, params);
                }
            }

            console.log(`[PROFILE_UPDATE] User updated in DB:`, updatedUser ? updatedUser.whatsapp_number : "failed");

            if (!updatedUser) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({
                id: updatedUser.id,
                name: updatedUser.name,
                username: updatedUser.username,
                role: updatedUser.role,
                whatsapp_number: updatedUser.whatsapp_number || undefined,
                whatsapp_extra_numbers: updatedUser.whatsapp_extra_numbers || undefined,
            });
        } catch (error) {
            console.error("[FARM_ME_UPDATE]", error);
            res.status(500).json({ error: "Failed to update profile" });
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

    // ==================== EQUIPMENT ====================

    app.get("/api/farm/equipment", requireFarmer, async (req, res) => {
        try {
            const equipment = await farmStorage.getEquipment((req.user as any).id);
            res.json(equipment);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_GET]", error);
            res.status(500).json({ error: "Failed to get equipment list" });
        }
    });

    app.post("/api/farm/equipment", requireFarmer, async (req, res) => {
        try {
            const { name, type, status } = req.body;
            if (!name || !type) return res.status(400).json({ error: "Name and type required" });

            const equip = await farmStorage.createEquipment({
                farmerId: (req.user as any).id,
                name,
                type,
                status: status || "Ativo",
            });
            res.status(201).json(equip);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_CREATE]", error);
            res.status(500).json({ error: "Failed to create equipment" });
        }
    });

    app.put("/api/farm/equipment/:id", requireFarmer, async (req, res) => {
        try {
            const { name, type, status } = req.body;
            const equip = await farmStorage.updateEquipment(req.params.id, {
                name,
                type,
                status,
            });
            res.json(equip);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update equipment" });
        }
    });

    app.delete("/api/farm/equipment/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteEquipment(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete equipment" });
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

    app.post("/api/farm/products", requireFarmer, upload.single("image"), async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient, imageUrl } = req.body;
            if (!name || !unit) return res.status(400).json({ error: "Product name and unit required" });

            let imageBase64 = null;
            if (req.file) {
                // Convert buffer to base64
                const base64String = req.file.buffer.toString('base64');
                const mimeType = req.file.mimetype;
                imageBase64 = `data:${mimeType};base64,${base64String}`;
            }

            const product = await farmStorage.createProduct({
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : null,
                category,
                activeIngredient,
                imageUrl: imageUrl || null,
                imageBase64: imageBase64,
            });
            res.status(201).json(product);
        } catch (error) {
            console.error("[FARM_PRODUCT_CREATE]", error);
            res.status(500).json({ error: "Failed to create product" });
        }
    });

    app.put("/api/farm/products/:id", requireFarmer, upload.single("image"), async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient, imageUrl } = req.body;

            let imageBase64 = undefined;
            if (req.file) {
                const base64String = req.file.buffer.toString('base64');
                const mimeType = req.file.mimetype;
                imageBase64 = `data:${mimeType};base64,${base64String}`;
            }

            const product = await farmStorage.updateProduct(req.params.id, {
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : undefined,
                category,
                activeIngredient,
                imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined, // Keep existing URL logic if needed
                imageBase64: imageBase64,
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

    app.put("/api/farm/stock/:id", requireFarmer, async (req, res) => {
        try {
            const { quantity, averageCost, reason, productName, productCategory, productUnit } = req.body;
            if (quantity === undefined || averageCost === undefined || !reason) {
                return res.status(400).json({ error: "Quantity, averageCost, and reason are required" });
            }

            const updatedStock = await farmStorage.updateStockManual(
                req.params.id,
                (req.user as any).id,
                { quantity: Number(quantity), averageCost: Number(averageCost), reason }
            );

            // Also update product catalog if name/category/unit provided
            if (updatedStock && (productName || productCategory || productUnit)) {
                const updateData: any = {};
                if (productName) updateData.name = productName;
                if (productCategory) updateData.category = productCategory;
                if (productUnit) updateData.unit = productUnit;

                await farmStorage.updateProduct(updatedStock.productId, updateData);
            }

            res.json(updatedStock);
        } catch (error) {
            console.error("[FARM_STOCK_UPDATE]", error);
            res.status(500).json({ error: "Failed to update stock" });
        }
    });

    app.post("/api/farm/stock/extract-photo", requireFarmer, upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "Nenhuma imagem enviada." });
            }

            const mimeType = req.file.mimetype;
            if (!mimeType.startsWith('image/')) {
                return res.status(400).json({ error: "Apenas imagens (JPG, PNG) são permitidas." });
            }

            const { parseProductPhoto } = await import("./whatsapp/gemini-client");
            const extractedData = await parseProductPhoto(req.file.buffer, mimeType);

            res.json(extractedData);
        } catch (error) {
            console.error("[FARM_STOCK_EXTRACT_PHOTO]", error);
            res.status(500).json({ error: "Falha ao analisar a foto da embalagem." });
        }
    });

    app.post("/api/farm/stock", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const { name, activeIngredient, category, unit, quantity, unitCost } = req.body;

            if (!name || isNaN(parseFloat(quantity)) || isNaN(parseFloat(unitCost))) {
                return res.status(400).json({ error: "Dados inválidos para entrada de estoque." });
            }

            let productId: string;

            // 1. Check if product already exists in global catalog by exact name (case insensitive)
            const existing = await db.select().from(farmProductsCatalog)
                .where(sql`LOWER(${farmProductsCatalog.name}) = LOWER(${name})`)
                .limit(1);

            if (existing.length > 0) {
                productId = existing[0].id;
            } else {
                // 2. Auto-create if it doesn't exist (flagged for review)
                const [newProduct] = await db.insert(farmProductsCatalog).values({
                    name: name.toUpperCase(),
                    activeIngredient: activeIngredient || null,
                    category: category || "Outros",
                    unit: unit || "LT",
                    dosePerHa: null,
                    status: 'pending_review',
                    isDraft: true
                }).returning();
                productId = newProduct.id;
            }

            // 3. Upsert into farmer's physical stock
            const parsedQty = parseFloat(quantity);
            const parsedCost = parseFloat(unitCost);

            const updatedStock = await farmStorage.upsertStock(farmerId, productId, parsedQty, parsedCost);

            // 4. Register movement
            await db.insert(farmStockMovements).values({
                farmerId,
                productId,
                type: 'entry',
                quantity: String(parsedQty),
                unitCost: String(parsedCost),
                referenceType: 'manual_entry',
                notes: 'Entrada manual avulsa',
                date: new Date()
            });

            res.status(201).json(updatedStock);
        } catch (error) {
            console.error("[FARM_STOCK_POST]", error);
            res.status(500).json({ error: "Failed to add manual stock entry" });
        }
    });


    app.delete("/api/farm/stock/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteStock(req.params.id, (req.user as any).id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_STOCK_DELETE]", error);
            res.status(500).json({ error: "Failed to delete from stock" });
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

            let parsed;
            const mimeType = req.file.mimetype;

            if (mimeType === "application/pdf") {
                parsed = await parseFarmInvoicePDF(req.file.buffer);
            } else if (mimeType.startsWith("image/")) {
                parsed = await parseFarmInvoiceImage(req.file.buffer, mimeType);
            } else {
                return res.status(400).json({ error: "Unsupported file type. Use PDF or Image (JPG, PNG)." });
            }


            // Verificação de duplicidade
            const farmerId = (req.user as any).id;
            const { farmInvoices } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, or, ilike } = await import("drizzle-orm");

            const existingInvoices = await db.select({
                id: farmInvoices.id,
                invoiceNumber: farmInvoices.invoiceNumber,
                supplier: farmInvoices.supplier,
                totalAmount: farmInvoices.totalAmount,
                status: farmInvoices.status,
            }).from(farmInvoices).where(eq(farmInvoices.farmerId, farmerId));

            const parsedAmount = parseFloat(String(parsed.totalAmount)) || 0;
            const duplicate = existingInvoices.find(inv => {
                const invAmount = parseFloat(inv.totalAmount as string) || 0;
                const sameNumber = parsed.invoiceNumber && inv.invoiceNumber &&
                    inv.invoiceNumber.replace(/\D/g, '') === parsed.invoiceNumber.replace(/\D/g, '');
                const sameSupplier = parsed.supplier && inv.supplier &&
                    inv.supplier.toLowerCase().includes(parsed.supplier.toLowerCase().substring(0, 10));
                const sameAmount = Math.abs(invAmount - parsedAmount) < 0.01;
                return (sameNumber && sameAmount) || (sameNumber && sameSupplier) || (sameSupplier && sameAmount);
            });

            if (duplicate) {
                const statusLabel = duplicate.status === "confirmed" ? "confirmada" : "pendente";
                return res.status(409).json({
                    error: "duplicate",
                    message: `⚠️ Fatura possivelmente duplicada! Já existe uma fatura ${statusLabel} com dados semelhantes:\n` +
                        `• Número: ${duplicate.invoiceNumber || 'N/A'}\n` +
                        `• Fornecedor: ${duplicate.supplier || 'N/A'}\n` +
                        `• Valor: $ ${(parseFloat(duplicate.totalAmount as string) || 0).toFixed(2)}`,
                    existingId: duplicate.id,
                });
            }

            // Create invoice record
            const seasonId = req.body?.seasonId || null;
            const skipStockEntry = req.body?.skipStockEntry === "true";
            const invoice = await farmStorage.createInvoice({
                farmerId,
                seasonId,
                invoiceNumber: parsed.invoiceNumber,
                supplier: parsed.supplier,
                issueDate: parsed.issueDate,
                currency: parsed.currency,
                totalAmount: String(parsed.totalAmount),
                status: "pending",
                skipStockEntry,
                rawPdfData: parsed.rawText.substring(0, 5000),
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
                            status: "pending_review",
                            isDraft: true
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

            // Check if this invoice should skip stock entry
            const updatedInvoice = await farmStorage.getInvoiceById(req.params.id);
            const skipped = updatedInvoice?.skipStockEntry;
            res.json({
                message: skipped
                    ? "Fatura confirmada. Estoque NÃO atualizado (apenas financeiro)."
                    : "Fatura confirmada. Estoque atualizado."
            });
        } catch (error) {
            console.error("[FARM_INVOICE_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm invoice" });
        }
    });

    // Update invoice header
    app.put("/api/farm/invoices/:id", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmInvoices } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { invoiceNumber, supplier, issueDate, totalAmount, currency } = req.body;
            const updateData: any = {};
            if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
            if (supplier !== undefined) updateData.supplier = supplier;
            if (issueDate !== undefined) updateData.issueDate = issueDate ? new Date(issueDate) : null;
            if (totalAmount !== undefined) updateData.totalAmount = String(totalAmount);
            if (currency !== undefined) updateData.currency = currency;

            const [updated] = await db.update(farmInvoices)
                .set(updateData)
                .where(eq(farmInvoices.id, req.params.id))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_INVOICE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update invoice" });
        }
    });

    // Update invoice item (link to catalog product + edit fields)
    app.patch("/api/farm/invoices/:invoiceId/items/:itemId", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmInvoiceItems } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { productId, productName, productCode, unit, quantity, unitPrice, discount, totalPrice, batch, expiryDate } = req.body;
            const updateData: any = {};
            if (productId !== undefined) updateData.productId = productId;
            if (productName !== undefined) updateData.productName = productName;
            if (productCode !== undefined) updateData.productCode = productCode;
            if (unit !== undefined) updateData.unit = unit;
            if (quantity !== undefined) updateData.quantity = String(quantity);
            if (unitPrice !== undefined) updateData.unitPrice = String(unitPrice);
            if (discount !== undefined) updateData.discount = String(discount);
            if (totalPrice !== undefined) updateData.totalPrice = String(totalPrice);
            if (batch !== undefined) updateData.batch = batch;
            if (expiryDate !== undefined) updateData.expiryDate = expiryDate;

            const [updated] = await db.update(farmInvoiceItems)
                .set(updateData)
                .where(eq(farmInvoiceItems.id, req.params.itemId))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_INVOICE_ITEM_UPDATE]", error);
            res.status(500).json({ error: "Failed to update invoice item" });
        }
    });

    // Update expense header
    app.put("/api/farm/expenses/:id", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmExpenses } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { supplier, category, amount, description, expenseDate, equipmentId } = req.body;
            const updateData: any = {};
            if (supplier !== undefined) updateData.supplier = supplier;
            if (category !== undefined) updateData.category = category;
            if (amount !== undefined) updateData.amount = String(amount);
            if (description !== undefined) updateData.description = description;
            if (expenseDate !== undefined) updateData.expenseDate = expenseDate ? new Date(expenseDate) : null;
            if (equipmentId !== undefined) updateData.equipmentId = equipmentId || null;

            const [updated] = await db.update(farmExpenses)
                .set(updateData)
                .where(eq(farmExpenses.id, req.params.id))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_EXPENSE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update expense" });
        }
    });

    // Update expense item
    app.patch("/api/farm/expenses/:expenseId/items/:itemId", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmExpenseItems } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { itemName, quantity, unit, unitPrice, totalPrice } = req.body;
            const updateData: any = {};
            if (itemName !== undefined) updateData.itemName = itemName;
            if (quantity !== undefined) updateData.quantity = String(quantity);
            if (unit !== undefined) updateData.unit = unit;
            if (unitPrice !== undefined) updateData.unitPrice = String(unitPrice);
            if (totalPrice !== undefined) updateData.totalPrice = String(totalPrice);

            const [updated] = await db.update(farmExpenseItems)
                .set(updateData)
                .where(eq(farmExpenseItems.id, req.params.itemId))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_EXPENSE_ITEM_UPDATE]", error);
            res.status(500).json({ error: "Failed to update expense item" });
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

    // Middleware specific for Admin Manuals
    function requireAdminManuals(req: Request, res: Response, next: NextFunction) {
        if (!req.isAuthenticated || !req.isAuthenticated()) {
            return res.status(401).json({ error: "Autenticação necessária" });
        }
        const role = (req.user as any)?.role;
        if (role !== 'administrador' && role !== 'admin_agricultor') {
            return res.status(403).json({ error: "Acesso restrito a administradores" });
        }
        next();
    }

    // --- Admin Manuals API (RAG) ---
    app.post("/api/admin/manuals", requireAdminManuals, upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "PDF file required" });
            }
            const { title, segment } = req.body;
            if (!title || !segment) {
                return res.status(400).json({ error: "Title and Segment required" });
            }

            const { extractManualText } = await import("./whatsapp/gemini-client");
            if (req.file.mimetype !== "application/pdf") {
                return res.status(400).json({ error: "Only PDF files are supported" });
            }

            const extractedText = await extractManualText(req.file.buffer, req.file.mimetype);
            if (!extractedText.trim()) {
                return res.status(400).json({ error: "Could not extract text from the PDF" });
            }

            const { farmManuals } = await import("../shared/schema");
            const { db } = await import("./db");

            const [newManual] = await db.insert(farmManuals).values({
                title,
                segment,
                contentText: extractedText
            }).returning();

            res.status(201).json({
                message: "Manual uploaded and parsed successfully",
                manual: newManual
            });
        } catch (error) {
            console.error("[ADMIN_MANUALS_POST]", error);
            res.status(500).json({ error: "Failed to process and upload manual" });
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
            const sanitized = (expenses as any[]).map(({ imageBase64, ...rest }) => ({
                ...rest,
                hasImage: !!imageBase64,
            }));
            res.json(sanitized);
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

    app.post("/api/farm/expenses/:id/confirm", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const { accountId, paymentMethod, paymentStatus, paymentType, dueDate, installments } = req.body || {};

            const [expense] = await db.select().from(farmExpenses).where(
                and(eq(farmExpenses.id, req.params.id), eq(farmExpenses.farmerId, farmerId))
            ).limit(1);

            if (!expense) return res.status(404).json({ error: "Expense not found" });

            const amount = parseFloat(expense.amount as string) || 0;
            const isPago = paymentStatus === "pago" || (!paymentStatus && accountId);

            const updateData: any = {
                status: "confirmed",
                paymentStatus: paymentStatus || (accountId ? "pago" : "pendente"),
                paymentType: paymentType || "a_vista",
            };
            if (dueDate) updateData.dueDate = new Date(dueDate);
            if (installments) updateData.installments = parseInt(installments);
            if (isPago) {
                updateData.paidAmount = String(amount);
                updateData.installmentsPaid = updateData.installments || 1;
            }

            await db.update(farmExpenses).set(updateData).where(eq(farmExpenses.id, expense.id));

            if (accountId && isPago) {
                await db.insert(farmCashTransactions).values({
                    farmerId, accountId, type: "saida",
                    amount: String(amount), currency: "USD", category: expense.category,
                    description: expense.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa aprovada",
                    paymentMethod: paymentMethod || "efetivo",
                    expenseId: expense.id, referenceType: "aprovacao_despesa",
                });
                await db.update(farmCashAccounts)
                    .set({ currentBalance: sqlFn`current_balance - ${amount}` })
                    .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));
            }

            res.json({ success: true });
        } catch (error) {
            console.error("[FARM_EXPENSE_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm expense" });
        }
    });

    app.post("/api/farm/expenses/:id/pay", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const { accountId, paymentMethod, amount: payAmount } = req.body;
            if (!accountId) return res.status(400).json({ error: "accountId obrigatório" });

            const [expense] = await db.select().from(farmExpenses).where(
                and(eq(farmExpenses.id, req.params.id), eq(farmExpenses.farmerId, farmerId))
            ).limit(1);
            if (!expense) return res.status(404).json({ error: "Expense not found" });

            const totalAmount = parseFloat(expense.amount as string) || 0;
            const previouslyPaid = parseFloat(expense.paidAmount as string) || 0;
            const thisPayment = payAmount ? parseFloat(payAmount) : totalAmount - previouslyPaid;
            const newPaid = previouslyPaid + thisPayment;
            const newInstPaid = (expense.installmentsPaid || 0) + 1;
            const fullyPaid = newPaid >= totalAmount;

            await db.update(farmExpenses).set({
                paidAmount: String(newPaid),
                installmentsPaid: newInstPaid,
                paymentStatus: fullyPaid ? "pago" : "parcial",
            }).where(eq(farmExpenses.id, expense.id));

            await db.insert(farmCashTransactions).values({
                farmerId, accountId, type: "saida",
                amount: String(thisPayment), currency: "USD", category: expense.category,
                description: `Pagamento ${newInstPaid}/${expense.installments || 1} - ${expense.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa"}`,
                paymentMethod: paymentMethod || "efetivo",
                expenseId: expense.id, referenceType: "aprovacao_despesa",
            });
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance - ${thisPayment}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            res.json({ success: true, fullyPaid, paidAmount: newPaid, remaining: totalAmount - newPaid });
        } catch (error) {
            console.error("[FARM_EXPENSE_PAY]", error);
            res.status(500).json({ error: "Failed to pay expense" });
        }
    });

    app.delete("/api/farm/expenses/:id", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            await db.delete(farmExpenses).where(
                and(
                    eq(farmExpenses.id, req.params.id),
                    eq(farmExpenses.farmerId, (req.user as any).id)
                )
            );

            res.status(204).send();
        } catch (error) {
            console.error("[FARM_EXPENSE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete expense" });
        }
    });

    app.get("/api/farm/expenses/:id", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses, farmExpenseItems } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            const [expense] = await db.select().from(farmExpenses).where(
                and(
                    eq(farmExpenses.id, req.params.id),
                    eq(farmExpenses.farmerId, (req.user as any).id)
                )
            ).limit(1);

            if (!expense) {
                return res.status(404).json({ error: "Expense not found" });
            }

            const items = await db.select().from(farmExpenseItems).where(
                eq(farmExpenseItems.expenseId, expense.id)
            );

            res.json({
                ...expense,
                imageBase64: expense.imageBase64 ? `data:image/jpeg;base64,${expense.imageBase64.substring(0, 50)}...` : null,
                hasImage: !!expense.imageBase64,
                items,
            });
        } catch (error) {
            console.error("[FARM_EXPENSE_DETAIL]", error);
            res.status(500).json({ error: "Failed to get expense detail" });
        }
    });

    app.get("/api/farm/expenses/:id/image", requireFarmer, async (req, res) => {
        try {
            const { farmExpenses } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");

            const [expense] = await db.select({ imageBase64: farmExpenses.imageBase64 }).from(farmExpenses).where(
                and(
                    eq(farmExpenses.id, req.params.id),
                    eq(farmExpenses.farmerId, (req.user as any).id)
                )
            ).limit(1);

            if (!expense?.imageBase64) {
                return res.status(404).json({ error: "Image not found" });
            }

            const buffer = Buffer.from(expense.imageBase64, "base64");
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Content-Length", buffer.length);
            res.send(buffer);
        } catch (error) {
            console.error("[FARM_EXPENSE_IMAGE]", error);
            res.status(500).json({ error: "Failed to get expense image" });
        }
    });

    // ==================== CATEGORIAS PERSONALIZADAS ====================

    app.get("/api/farm/expense-categories", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;
            const categories = await db.select().from(farmExpenseCategories).where(eq(farmExpenseCategories.farmerId, farmerId));
            res.json(categories);
        } catch (error) {
            res.status(500).json({ error: "Failed to load categories" });
        }
    });

    app.post("/api/farm/expense-categories", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { name, type } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });
            const [cat] = await db.insert(farmExpenseCategories).values({
                farmerId, name, type: type || "saida",
            }).returning();
            res.json(cat);
        } catch (error) {
            res.status(500).json({ error: "Failed to create category" });
        }
    });

    app.delete("/api/farm/expense-categories/:id", requireFarmer, async (req, res) => {
        try {
            const { farmExpenseCategories } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            const farmerId = (req.user as any).id;
            await db.delete(farmExpenseCategories).where(
                and(eq(farmExpenseCategories.id, req.params.id), eq(farmExpenseCategories.farmerId, farmerId))
            );
            res.json({ ok: true });
        } catch (error) {
            res.status(500).json({ error: "Failed to delete category" });
        }
    });

    // ==================== FLUXO DE CAIXA ====================

    app.get("/api/farm/cash-accounts", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");
            const accounts = await db.select().from(farmCashAccounts).where(eq(farmCashAccounts.farmerId, (req.user as any).id));
            res.json(accounts);
        } catch (error) {
            console.error("[CASH_ACCOUNTS_GET]", error);
            res.status(500).json({ error: "Failed to get cash accounts" });
        }
    });

    app.post("/api/farm/cash-accounts", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { name, bankName, accountType, currency, initialBalance } = req.body;
            if (!name || !accountType) return res.status(400).json({ error: "name and accountType required" });

            const balance = parseFloat(initialBalance) || 0;
            const [account] = await db.insert(farmCashAccounts).values({
                farmerId: (req.user as any).id,
                name,
                bankName: bankName || null,
                accountType,
                currency: currency || "USD",
                initialBalance: String(balance),
                currentBalance: String(balance),
            }).returning();
            res.status(201).json(account);
        } catch (error) {
            console.error("[CASH_ACCOUNT_CREATE]", error);
            res.status(500).json({ error: "Failed to create cash account" });
        }
    });

    app.put("/api/farm/cash-accounts/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            const { name, bankName, accountType, currency, isActive } = req.body;

            const updates: any = {};
            if (name !== undefined) updates.name = name;
            if (bankName !== undefined) updates.bankName = bankName;
            if (accountType !== undefined) updates.accountType = accountType;
            if (currency !== undefined) updates.currency = currency;
            if (isActive !== undefined) updates.isActive = isActive;

            const [updated] = await db.update(farmCashAccounts).set(updates).where(
                and(eq(farmCashAccounts.id, req.params.id), eq(farmCashAccounts.farmerId, (req.user as any).id))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[CASH_ACCOUNT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update cash account" });
        }
    });

    app.delete("/api/farm/cash-accounts/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and } = await import("drizzle-orm");
            await db.delete(farmCashAccounts).where(
                and(eq(farmCashAccounts.id, req.params.id), eq(farmCashAccounts.farmerId, (req.user as any).id))
            );
            res.status(204).send();
        } catch (error) {
            console.error("[CASH_ACCOUNT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete cash account" });
        }
    });

    app.get("/api/farm/cash-transactions", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, gte, lte, desc } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const conditions: any[] = [eq(farmCashTransactions.farmerId, farmerId)];

            if (req.query.accountId) {
                conditions.push(eq(farmCashTransactions.accountId, req.query.accountId as string));
            }
            if (req.query.type) {
                conditions.push(eq(farmCashTransactions.type, req.query.type as string));
            }
            if (req.query.category) {
                conditions.push(eq(farmCashTransactions.category, req.query.category as string));
            }
            if (req.query.startDate) {
                conditions.push(gte(farmCashTransactions.transactionDate, new Date(req.query.startDate as string)));
            }
            if (req.query.endDate) {
                conditions.push(lte(farmCashTransactions.transactionDate, new Date(req.query.endDate as string)));
            }

            const transactions = await db.select().from(farmCashTransactions)
                .where(and(...conditions))
                .orderBy(desc(farmCashTransactions.transactionDate))
                .limit(500);
            res.json(transactions);
        } catch (error) {
            console.error("[CASH_TRANSACTIONS_GET]", error);
            res.status(500).json({ error: "Failed to get transactions" });
        }
    });

    app.post("/api/farm/cash-transactions", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const { accountId, type, amount, currency, category, description, paymentMethod, transactionDate, referenceType, expenseId, invoiceId } = req.body;
            if (!accountId || !type || !amount || !category) {
                return res.status(400).json({ error: "accountId, type, amount, category required" });
            }

            const farmerId = (req.user as any).id;
            const parsedAmount = parseFloat(amount);
            if (isNaN(parsedAmount) || parsedAmount <= 0) {
                return res.status(400).json({ error: "Invalid amount" });
            }

            const [tx] = await db.insert(farmCashTransactions).values({
                farmerId,
                accountId,
                type,
                amount: String(parsedAmount),
                currency: currency || "USD",
                category,
                description: description || null,
                paymentMethod: paymentMethod || "efetivo",
                referenceType: referenceType || "manual",
                expenseId: expenseId || null,
                invoiceId: invoiceId || null,
                transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
            }).returning();

            const balanceChange = type === "entrada" ? parsedAmount : -parsedAmount;
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance + ${balanceChange}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            res.status(201).json(tx);
        } catch (error) {
            console.error("[CASH_TRANSACTION_CREATE]", error);
            res.status(500).json({ error: "Failed to create transaction" });
        }
    });

    app.get("/api/farm/cash-summary", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, gte, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;

            const accounts = await db.select().from(farmCashAccounts).where(eq(farmCashAccounts.farmerId, farmerId));

            const firstOfMonth = new Date();
            firstOfMonth.setDate(1);
            firstOfMonth.setHours(0, 0, 0, 0);

            const monthTransactions = await db.select().from(farmCashTransactions).where(
                and(eq(farmCashTransactions.farmerId, farmerId), gte(farmCashTransactions.transactionDate, firstOfMonth))
            );

            let totalEntradas = 0;
            let totalSaidas = 0;
            for (const t of monthTransactions) {
                const val = parseFloat(t.amount as string) || 0;
                if (t.type === "entrada") totalEntradas += val;
                else totalSaidas += val;
            }

            const sixMonthsAgo = new Date();
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
            sixMonthsAgo.setDate(1);
            sixMonthsAgo.setHours(0, 0, 0, 0);

            const allRecent = await db.select().from(farmCashTransactions).where(
                and(eq(farmCashTransactions.farmerId, farmerId), gte(farmCashTransactions.transactionDate, sixMonthsAgo))
            );

            const monthlyData: Record<string, { entradas: number; saidas: number }> = {};
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                monthlyData[key] = { entradas: 0, saidas: 0 };
            }
            for (const t of allRecent) {
                const d = new Date(t.transactionDate as any);
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                if (monthlyData[key]) {
                    const val = parseFloat(t.amount as string) || 0;
                    if (t.type === "entrada") monthlyData[key].entradas += val;
                    else monthlyData[key].saidas += val;
                }
            }

            const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
            const chartData = Object.entries(monthlyData).map(([key, v]) => ({
                month: monthNames[parseInt(key.split("-")[1]) - 1],
                entradas: Math.round(v.entradas * 100) / 100,
                saidas: Math.round(v.saidas * 100) / 100,
            }));

            const byCategoryRaw: Record<string, number> = {};
            for (const t of monthTransactions) {
                if (t.type === "saida") {
                    const val = parseFloat(t.amount as string) || 0;
                    byCategoryRaw[t.category] = (byCategoryRaw[t.category] || 0) + val;
                }
            }
            const byCategory = Object.entries(byCategoryRaw).map(([cat, val]) => ({ category: cat, value: Math.round(val * 100) / 100 }))
                .sort((a, b) => b.value - a.value);

            const { farmExpenses } = await import("../shared/schema");
            const { or } = await import("drizzle-orm");
            const unpaidExpenses = await db.select().from(farmExpenses).where(
                and(
                    eq(farmExpenses.farmerId, farmerId),
                    eq(farmExpenses.status, "confirmed"),
                    or(eq(farmExpenses.paymentStatus, "pendente"), eq(farmExpenses.paymentStatus, "parcial"))
                )
            );
            const contasAPagar = unpaidExpenses.map(e => ({
                id: e.id,
                description: e.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim(),
                supplier: e.supplier,
                category: e.category,
                amount: parseFloat(e.amount as string) || 0,
                paidAmount: parseFloat(e.paidAmount as string) || 0,
                remaining: (parseFloat(e.amount as string) || 0) - (parseFloat(e.paidAmount as string) || 0),
                dueDate: e.dueDate,
                paymentType: e.paymentType,
                installments: e.installments,
                installmentsPaid: e.installmentsPaid,
            }));

            res.json({
                accounts,
                monthSummary: {
                    totalEntradas,
                    totalSaidas,
                    saldoLiquido: totalEntradas - totalSaidas,
                    transactionCount: monthTransactions.length,
                },
                chartData,
                byCategory,
                contasAPagar,
            });
        } catch (error) {
            console.error("[CASH_SUMMARY]", error);
            res.status(500).json({ error: "Failed to get summary" });
        }
    });

    app.delete("/api/farm/cash-transactions/:id", requireFarmer, async (req, res) => {
        try {
            const { farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");

            const farmerId = (req.user as any).id;
            const [tx] = await db.select().from(farmCashTransactions).where(
                and(eq(farmCashTransactions.id, req.params.id), eq(farmCashTransactions.farmerId, farmerId))
            ).limit(1);

            if (!tx) return res.status(404).json({ error: "Transaction not found" });

            const reversal = tx.type === "entrada" ? -parseFloat(tx.amount as string) : parseFloat(tx.amount as string);
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance + ${reversal}` })
                .where(and(eq(farmCashAccounts.id, tx.accountId), eq(farmCashAccounts.farmerId, farmerId)));

            await db.delete(farmCashTransactions).where(eq(farmCashTransactions.id, req.params.id));
            res.status(204).send();
        } catch (error) {
            console.error("[CASH_TRANSACTION_DELETE]", error);
            res.status(500).json({ error: "Failed to delete transaction" });
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
            const { name, username, password, propertyId, type } = req.body;
            if (!name || !username || !password) {
                return res.status(400).json({ error: "Name, username and password required" });
            }

            const terminal = await farmStorage.createPdvTerminal({
                farmerId: (req.user as any).id,
                name,
                username,
                password: await hashPassword(password),
                propertyId: propertyId || null,
                type: type || "estoque",
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

    app.put("/api/farm/pdv-terminals/:id", requireFarmer, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, username, password, propertyId, type } = req.body;
            const farmerId = (req.user as any).id;

            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            // Ensure terminal belongs to this farmer
            const [existing] = await db.select().from(farmPdvTerminals).where(and(eq(farmPdvTerminals.id, id), eq(farmPdvTerminals.farmerId, farmerId)));
            if (!existing) return res.status(404).json({ error: "Terminal not found" });

            const updateData: any = {};
            if (name) updateData.name = name;
            if (username) updateData.username = username;
            if (password) updateData.password = await hashPassword(password);
            if (propertyId !== undefined) updateData.propertyId = propertyId || null;
            if (type) updateData.type = type;

            const [updated] = await db.update(farmPdvTerminals).set(updateData).where(eq(farmPdvTerminals.id, id)).returning();
            const { password: _, ...safe } = updated;
            res.json(safe);
        } catch (error) {
            console.error("[FARM_PDV_TERMINAL_UPDATE]", error);
            res.status(500).json({ error: "Failed to update terminal" });
        }
    });

    app.delete("/api/farm/pdv-terminals/:id", requireFarmer, async (req, res) => {
        try {
            const { id } = req.params;
            const farmerId = (req.user as any).id;

            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            // Ensure terminal belongs to this farmer
            const [existing] = await db.select().from(farmPdvTerminals).where(and(eq(farmPdvTerminals.id, id), eq(farmPdvTerminals.farmerId, farmerId)));
            if (!existing) return res.status(404).json({ error: "Terminal not found" });

            await db.delete(farmPdvTerminals).where(eq(farmPdvTerminals.id, id));
            res.json({ success: true });
        } catch (error) {
            console.error("[FARM_PDV_TERMINAL_DELETE]", error);
            res.status(500).json({ error: "Failed to delete terminal" });
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

            // Get all data the PDV needs — products are derived from farmer's stock only
            const stock = await farmStorage.getStock(terminal.farmerId);
            const products = stock.map(s => ({
                id: s.productId,
                name: s.productName,
                category: s.productCategory,
                unit: s.productUnit,
                imageUrl: s.productImageUrl || null,
                dosePerHa: s.productDosePerHa || null,
            }));
            const plots = await farmStorage.getPlotsByFarmer(terminal.farmerId);
            const properties = await farmStorage.getProperties(terminal.farmerId);
            const equipment = await farmStorage.getEquipment(terminal.farmerId);

            // Create a persistent token to store in localStorage for reliable reconnects (especially iOS offline)
            const crypto = await import("crypto");
            const tokenSeed = `${terminal.id}:${terminal.farmerId}:${terminal.propertyId}:${process.env.SESSION_SECRET || 'secret'}`;
            const token = crypto.createHash('sha256').update(tokenSeed).digest('hex');

            // Atrela o token à sessão tbm ou banco, pra validar no `/api/pdv/data`
            (req.session as any).pdvToken = token;

            res.json({
                terminal: { id: terminal.id, name: terminal.name, propertyId: terminal.propertyId, type: terminal.type },
                token,
                products,
                stock,
                plots,
                properties,
                equipment,
            });
        } catch (error) {
            console.error("[PDV_LOGIN]", error);
            res.status(500).json({ error: "Login failed" });
        }
    });

    app.post("/api/pdv/auto-login", async (req, res) => {
        try {
            const { token, terminalId } = req.body;
            if (!token || !terminalId) {
                return res.status(400).json({ error: "Token and terminalId required" });
            }

            const { db } = await import("./db");
            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const [terminal] = await db.select().from(farmPdvTerminals).where(eq(farmPdvTerminals.id, terminalId));
            if (!terminal) {
                return res.status(401).json({ error: "Terminal not found" });
            }

            const crypto = await import("crypto");
            const expectedTokenSeed = `${terminal.id}:${terminal.farmerId}:${terminal.propertyId}:${process.env.SESSION_SECRET || 'secret'}`;
            const expectedToken = crypto.createHash('sha256').update(expectedTokenSeed).digest('hex');

            if (token !== expectedToken) {
                return res.status(401).json({ error: "Invalid token" });
            }

            (req.session as any).pdvTerminalId = terminal.id;
            (req.session as any).pdvFarmerId = terminal.farmerId;
            (req.session as any).pdvPropertyId = terminal.propertyId;
            (req.session as any).pdvToken = token;

            await farmStorage.updatePdvHeartbeat(terminal.id);

            const stock = await farmStorage.getStock(terminal.farmerId);
            const products = stock.map(s => ({
                id: s.productId,
                name: s.productName,
                category: s.productCategory,
                unit: s.productUnit,
                imageUrl: s.productImageUrl || null,
                dosePerHa: s.productDosePerHa || null,
            }));
            const plots = await farmStorage.getPlotsByFarmer(terminal.farmerId);
            const properties = await farmStorage.getProperties(terminal.farmerId);
            const equipment = await farmStorage.getEquipment(terminal.farmerId);

            res.json({
                terminal: { id: terminal.id, name: terminal.name, propertyId: terminal.propertyId, type: terminal.type },
                token,
                products,
                stock,
                plots,
                properties,
                equipment,
            });
        } catch (error) {
            console.error("[PDV_AUTO_LOGIN]", error);
            res.status(500).json({ error: "Auto-login failed" });
        }
    });

    // PDV withdraw: register application + update stock
    app.post("/api/pdv/withdraw", requirePdv, async (req, res) => {
        try {
            const { productId, quantity, plotId, propertyId, appliedBy, notes, equipmentId, horimeter, odometer, dosePerHa } = req.body;
            if (!productId || !quantity || (!plotId && !equipmentId)) {
                return res.status(400).json({ error: "Product, quantity, and objective (plot or equipment) required" });
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
                plotId: resolvedPlotId || null,
                propertyId: resolvedPropertyId || plotId || null,
                equipmentId: equipmentId || null,
                horimeter: horimeter ? parseInt(horimeter, 10) : null,
                odometer: odometer ? parseInt(odometer, 10) : null,
                quantity: String(quantity),
                dosePerHa: dosePerHa ? String(dosePerHa) : null,
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
                        plotId: app.plotId || null,
                        propertyId: app.propertyId || null,
                        equipmentId: app.equipmentId || null,
                        horimeter: app.horimeter ? parseInt(app.horimeter, 10) : null,
                        odometer: app.odometer ? parseInt(app.odometer, 10) : null,
                        quantity: String(app.quantity),
                        dosePerHa: app.dosePerHa ? String(app.dosePerHa) : null,
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
            const terminalId = (req.session as any).pdvTerminalId;
            const stock = await farmStorage.getStock(farmerId);

            // Fetch the current terminal to know its type (e.g. diesel)
            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");
            const [terminal] = await db.select().from(farmPdvTerminals).where(eq(farmPdvTerminals.id, terminalId));

            // Map the user's localized stock to a 'products' array that the frontend expects
            // This prevents the global catalog from leaking into the user's PDV
            const products = stock.map(s => ({
                id: s.productId,
                name: s.productName,
                category: s.productCategory,
                unit: s.productUnit,
                imageUrl: s.productImageUrl || null,
                dosePerHa: s.productDosePerHa || null,
            }));

            const plots = await farmStorage.getPlotsByFarmer(farmerId);
            const properties = await farmStorage.getProperties(farmerId);
            const equipment = await farmStorage.getEquipment(farmerId);

            res.json({ products, stock, plots, properties, equipment, terminal });
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
                propertyName?: string | null;
                notes?: string | null;
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

    // ==================== n8n / WhatsApp Webhooks ====================

    app.post("/api/farm/webhook/n8n/check-pending-equipment", async (req, res) => {
        try {
            const { whatsapp_number, message } = req.body;
            if (!whatsapp_number || !message) {
                return res.json({ handled: false });
            }

            const { users, farmWhatsappPendingContext, farmExpenses, farmEquipment, farmCashAccounts, farmCashTransactions } = await import("../shared/schema");
            const { eq, or, sql: sqlFn, and, ilike, gt, desc } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number);
            const farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sqlFn`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0) return res.json({ handled: false });

            const farmer = farmers[0];
            const now = new Date();

            const [ctx] = await db.select().from(farmWhatsappPendingContext).where(
                and(
                    eq(farmWhatsappPendingContext.farmerId, farmer.id),
                    eq(farmWhatsappPendingContext.phone, formattedPhone),
                    gt(farmWhatsappPendingContext.expiresAt, now)
                )
            ).orderBy(desc(farmWhatsappPendingContext.createdAt)).limit(1);

            if (!ctx) return res.json({ handled: false });

            const search = message.trim();
            const data = (ctx.data as any) || {};

            if (ctx.step === "awaiting_equipment") {
                const allEquipment = await db.select().from(farmEquipment).where(eq(farmEquipment.farmerId, farmer.id));
                const skipOption = allEquipment.length + 1;
                const idx = parseInt(search) - 1;

                let equip: any = null;
                if (!isNaN(idx) && idx >= 0 && idx < allEquipment.length) {
                    equip = allEquipment[idx];
                } else if (parseInt(search) === skipOption) {
                    equip = null;
                } else {
                    equip = allEquipment.find(e => e.name.toLowerCase().includes(search.toLowerCase()));
                    if (!equip) {
                        const equipList = allEquipment.map((e, i) => `${i + 1}️⃣ ${e.name}`).join("\n");
                        return res.json({ handled: true, reply: `Não entendi. Responda com o número:\n${equipList}\n${skipOption}️⃣ Nenhuma` });
                    }
                }

                if (equip && ctx.expenseId) {
                    const [exp] = await db.select().from(farmExpenses).where(eq(farmExpenses.id, ctx.expenseId)).limit(1);
                    await db.update(farmExpenses).set({
                        equipmentId: equip.id,
                        description: `${exp?.description || ""} (Equipamento: ${equip.name})`,
                    }).where(eq(farmExpenses.id, ctx.expenseId));
                }

                const accounts = await db.select().from(farmCashAccounts).where(
                    and(eq(farmCashAccounts.farmerId, farmer.id), eq(farmCashAccounts.isActive, true))
                );
                const equipMsg = equip ? `🚜 Máquina: *${equip.name}* ✅` : `🚜 Sem vínculo de máquina ✅`;

                let pmIdx = 1;
                const pmLines: string[] = [];
                for (const a of accounts) { pmLines.push(`${pmIdx}️⃣ ${a.name} (${a.currency})`); pmIdx++; }
                pmLines.push(`${pmIdx}️⃣ Efetivo (bolso)`);
                pmIdx++;
                pmLines.push(`${pmIdx}️⃣ Financiado (safra)`);

                await db.update(farmWhatsappPendingContext).set({
                    step: "awaiting_payment_method",
                    data: { ...data, equipmentId: equip?.id || null, equipmentName: equip?.name || null },
                }).where(eq(farmWhatsappPendingContext.id, ctx.id));
                return res.json({ handled: true, reply: `${equipMsg}\n\nQual a forma de pagamento?\n${pmLines.join("\n")}` });
            }

            if (ctx.step === "awaiting_payment_method") {
                const accounts = await db.select().from(farmCashAccounts).where(
                    and(eq(farmCashAccounts.farmerId, farmer.id), eq(farmCashAccounts.isActive, true))
                );
                const efIndex = accounts.length + 1;
                const finIndex = accounts.length + 2;
                const idx = parseInt(search);

                if (idx === finIndex || search.toLowerCase().includes("financ") || search.toLowerCase().includes("safra")) {
                    const { farmSeasons } = await import("../shared/schema");
                    const seasons = await db.select().from(farmSeasons).where(
                        and(eq(farmSeasons.farmerId, farmer.id), eq(farmSeasons.isActive, true))
                    );
                    if (seasons.length > 0) {
                        await db.update(farmWhatsappPendingContext).set({
                            step: "awaiting_season",
                            data: { ...data, paymentType: "financiado" },
                        }).where(eq(farmWhatsappPendingContext.id, ctx.id));
                        const seasonList = seasons.map((s, i) => {
                            const endStr = s.endDate ? new Date(s.endDate).toLocaleDateString("pt-BR") : "sem data";
                            return `${i + 1}️⃣ ${s.name} (vence: ${endStr})`;
                        }).join("\n");
                        return res.json({ handled: true, reply: `Financiado ✅\n\nEm qual safra será pago?\n${seasonList}` });
                    }
                    if (ctx.expenseId) {
                        await db.update(farmExpenses).set({ paymentType: "financiado", paymentStatus: "pendente" }).where(eq(farmExpenses.id, ctx.expenseId));
                    }
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const amtF = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
                    const sumF = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtF}*`];
                    if (data.supplierName) sumF.push(`🏪 Fornecedor: *${data.supplierName}*`);
                    if (data.equipmentName) sumF.push(`🚜 Máquina: *${data.equipmentName}*`);
                    sumF.push(`💳 Pagamento: *Financiado*`);
                    sumF.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                    return res.json({ handled: true, reply: sumF.join("\n") });
                }

                if (idx === efIndex || search.toLowerCase().includes("efetivo") || search.toLowerCase().includes("bolso") || search.toLowerCase().includes("dinheiro")) {
                    if (ctx.expenseId) {
                        await db.update(farmExpenses).set({ paymentType: "a_vista", paymentStatus: "pago" }).where(eq(farmExpenses.id, ctx.expenseId));
                    }
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const amtE = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
                    const sumE = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtE}*`];
                    if (data.supplierName) sumE.push(`🏪 Fornecedor: *${data.supplierName}*`);
                    if (data.equipmentName) sumE.push(`🚜 Máquina: *${data.equipmentName}*`);
                    sumE.push(`💳 Pagamento: *Efetivo (bolso)* 💵`);
                    sumE.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                    return res.json({ handled: true, reply: sumE.join("\n") });
                }

                const acctIdx = idx - 1;
                let matched: any = null;
                if (!isNaN(acctIdx) && acctIdx >= 0 && acctIdx < accounts.length) {
                    matched = accounts[acctIdx];
                } else {
                    matched = accounts.find(a => a.name.toLowerCase().includes(search.toLowerCase()));
                }

                if (!matched) {
                    let ri = 1;
                    const rLines: string[] = [];
                    for (const a of accounts) { rLines.push(`${ri}️⃣ ${a.name} (${a.currency})`); ri++; }
                    rLines.push(`${ri}️⃣ Efetivo (bolso)`); ri++;
                    rLines.push(`${ri}️⃣ Financiado (safra)`);
                    return res.json({ handled: true, reply: `Não entendi. Responda com o número:\n${rLines.join("\n")}` });
                }

                let expAmount = 0;
                let expCategory = data.category || "";
                if (ctx.expenseId) {
                    const [exp] = await db.select().from(farmExpenses).where(eq(farmExpenses.id, ctx.expenseId)).limit(1);
                    if (exp) {
                        expAmount = parseFloat(exp.amount as string) || 0;
                        expCategory = exp.category;
                        await db.update(farmExpenses).set({ paymentType: "a_vista", paymentStatus: "pago", paidAmount: String(expAmount) }).where(eq(farmExpenses.id, ctx.expenseId));
                        await db.insert(farmCashTransactions).values({
                            farmerId: farmer.id, accountId: matched.id, type: "saida",
                            amount: String(expAmount), currency: matched.currency, category: expCategory,
                            description: exp.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa WhatsApp",
                            paymentMethod: "transferencia", expenseId: exp.id, referenceType: "whatsapp",
                        });
                        await db.update(farmCashAccounts)
                            .set({ currentBalance: sqlFn`current_balance - ${expAmount}` })
                            .where(eq(farmCashAccounts.id, matched.id));
                    }
                }
                await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                const amtA = data.amount ? parseFloat(data.amount).toFixed(2) : (expAmount || 0).toFixed(2);
                const sumA = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtA}*`];
                if (data.supplierName) sumA.push(`🏪 Fornecedor: *${data.supplierName}*`);
                if (expCategory) sumA.push(`📋 Categoria: *${expCategory}*`);
                if (data.equipmentName) sumA.push(`🚜 Máquina: *${data.equipmentName}*`);
                sumA.push(`🏦 Conta: *${matched.name}*`);
                sumA.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                return res.json({ handled: true, reply: sumA.join("\n") });
            }

            if (ctx.step === "awaiting_season") {
                const { farmSeasons } = await import("../shared/schema");
                const seasons = await db.select().from(farmSeasons).where(
                    and(eq(farmSeasons.farmerId, farmer.id), eq(farmSeasons.isActive, true))
                );
                const sIdx = parseInt(search) - 1;
                let season: any = null;
                if (!isNaN(sIdx) && sIdx >= 0 && sIdx < seasons.length) {
                    season = seasons[sIdx];
                } else {
                    season = seasons.find(s => s.name.toLowerCase().includes(search.toLowerCase()));
                }
                if (!season) {
                    const sList = seasons.map((s, i) => {
                        const endStr = s.endDate ? new Date(s.endDate).toLocaleDateString("pt-BR") : "sem data";
                        return `${i + 1}️⃣ ${s.name} (vence: ${endStr})`;
                    }).join("\n");
                    return res.json({ handled: true, reply: `Não entendi. Responda com o número:\n${sList}` });
                }

                if (ctx.expenseId) {
                    await db.update(farmExpenses).set({
                        paymentType: "financiado",
                        paymentStatus: "pendente",
                        dueDate: season.endDate || null,
                    }).where(eq(farmExpenses.id, ctx.expenseId));
                }
                await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                const dueStr = season.endDate ? new Date(season.endDate).toLocaleDateString("pt-BR") : "sem data";
                const amtS = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
                const sumS = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtS}*`];
                if (data.supplierName) sumS.push(`🏪 Fornecedor: *${data.supplierName}*`);
                if (data.category) sumS.push(`📋 Categoria: *${data.category}*`);
                if (data.equipmentName) sumS.push(`🚜 Máquina: *${data.equipmentName}*`);
                sumS.push(`💳 Pagamento: *Financiado*`);
                sumS.push(`📅 Safra: *${season.name}* (vence: ${dueStr})`);
                sumS.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                return res.json({ handled: true, reply: sumS.join("\n") });
            }

            return res.json({ handled: false });
        } catch (error) {
            console.error("[CHECK_PENDING_CONTEXT]", error);
            return res.json({ handled: false });
        }
    });

    app.post("/api/farm/webhook/n8n/receipt", async (req, res) => {
        try {
            const { whatsapp_number, imageUrl, caption } = req.body;
            if (!whatsapp_number) {
                return res.status(400).json({ error: "whatsapp_number is required" });
            }
            if (!imageUrl) {
                return res.status(400).json({ error: "imageUrl is required" });
            }

            console.log(`[WEBHOOK_N8N_RECEIPT] phone=${whatsapp_number}, caption="${caption || ''}", imageUrl=${imageUrl?.substring(0, 60)}...`);

            // Find farmer by phone number
            const { users, farmExpenses, farmInvoices, farmInvoiceItems, farmEquipment } = await import("../shared/schema");
            const { eq, or, sql, and, ilike, gt } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number);

            // Search by main number or extra numbers
            const farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0) {
                return res.status(404).json({ error: "Farmer not found for this phone number" });
            }

            const farmer = farmers[0];

            // Download image from Z-API URL
            console.log(`[WEBHOOK_N8N_RECEIPT] Downloading image from: ${imageUrl}`);
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to download image from Z-API: ${imageResponse.statusText}`);
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

            if (!mimeType.startsWith('image/') && !mimeType.includes('pdf')) {
                return res.status(400).json({ error: "Downloaded file is not an image or PDF" });
            }

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

            const base64Image = buffer.toString("base64");

            const prompt = `Você é um assistente do AgroFarm que classifica comprovantes agrícolas.

REGRA DE CLASSIFICAÇÃO (MUITO IMPORTANTE - siga à risca):

**expense** (Despesa de Frota/Manutenção) — use quando os itens são:
- Peças de máquinas/veículos (porcas, parafusos, rolamentos, correias, filtros, ponta de eixo, etc.)
- Óleo de motor, lubrificantes, graxas
- Diesel, combustível, gasolina
- Serviços mecânicos, mão de obra, frete, transporte
- Pneus, baterias, peças automotivas
- Qualquer coisa relacionada a manutenção de tratores, colheitadeiras, caminhões, veículos

**invoice** (Fatura de Insumos Agrícolas) — use APENAS quando os itens são:
- Defensivos agrícolas (herbicidas, fungicidas, inseticidas, acaricidas): Glifosato, Atrazina, Flumitop, etc.
- Sementes (soja, milho, trigo, etc.)
- Fertilizantes e adubos (NPK, ureia, MAP, KCl, etc.)
- Adjuvantes, espalhantes, reguladores de crescimento
- Produtos fitossanitários em geral

**unknown** — quando não for possível determinar.

Se for 'invoice', extraia TAMBÉM o fornecedor, o número da nota (se houver) e TODOS os produtos com quantidades, unidades e valores.

Retorne APENAS UM JSON VÁLIDO no formato exato:
{
  "type": "expense" | "invoice" | "unknown",
  "totalAmount": 150.50,
  "description": "Breve resumo geral (ex: Compra de peças para trator)",
  "category": "diesel" | "pecas" | "frete" | "mao_de_obra" | "outro",
  "invoiceNumber": "123456",
  "supplier": "Nome da Empresa Fornecedora",
  "items": [
    {
      "productName": "Nome do Produto Exato da Nota",
      "quantity": 10.5,
      "unit": "LT",
      "unitPrice": 15.00,
      "totalPrice": 157.50
    }
  ]
}`;

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [
                                    { text: prompt },
                                    { inline_data: { mime_type: mimeType, data: base64Image } }
                                ]
                            }
                        ],
                        generationConfig: { temperature: 0.1 }
                    })
                }
            );

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

            let parsed;
            try {
                parsed = JSON.parse(cleanJson);
            } catch (e) {
                return res.status(400).json({ error: "Failed to parse image content" });
            }

            const amount = parseFloat(parsed.totalAmount) || 0;

            // Try to match equipment from caption (for vehicle/fleet receipts)
            let matchedEquipmentId: string | null = null;
            const normalizedCaption = (caption || "").trim();
            if (parsed.type === "expense" && normalizedCaption) {
                const equipmentMatch = await db.select().from(farmEquipment).where(
                    and(
                        eq(farmEquipment.farmerId, farmer.id),
                        ilike(farmEquipment.name, `%${normalizedCaption}%`)
                    )
                ).limit(1);
                if (equipmentMatch.length > 0) {
                    matchedEquipmentId = equipmentMatch[0].id;
                }
            }

            if (parsed.type === "expense") {
                const { farmExpenseItems } = await import("../shared/schema");
                const supplierName = parsed.supplier || "";

                const recentExpenses = await db.select({
                    id: farmExpenses.id, supplier: farmExpenses.supplier,
                    amount: farmExpenses.amount, expenseDate: farmExpenses.expenseDate,
                }).from(farmExpenses).where(eq(farmExpenses.farmerId, farmer.id));

                const expDuplicate = recentExpenses.find(e => {
                    const eAmt = parseFloat(e.amount as string) || 0;
                    const sameAmt = Math.abs(eAmt - amount) < 0.01;
                    const sameSup = supplierName && e.supplier &&
                        e.supplier.toLowerCase().includes(supplierName.toLowerCase().substring(0, 8));
                    const recentDate = e.expenseDate && (Date.now() - new Date(e.expenseDate).getTime()) < 24 * 60 * 60 * 1000;
                    return sameAmt && sameSup && recentDate;
                });

                if (expDuplicate) {
                    return res.json({
                        message: `⚠️ *Recibo possivelmente duplicado!*\n\nJá existe uma despesa recente com dados semelhantes:\n• Fornecedor: ${expDuplicate.supplier || 'N/A'}\n• Valor: $ ${(parseFloat(expDuplicate.amount as string) || 0).toFixed(2)}\n\nEsse recibo *não foi cadastrado* para evitar duplicidade. Verifique no painel.`
                    });
                }
                const descParts = [`[Via WhatsApp]`];
                if (supplierName) descParts.push(`[${supplierName}]`);
                descParts.push(parsed.description || "Despesa");

                const [newExpense] = await db.insert(farmExpenses).values({
                    farmerId: farmer.id,
                    equipmentId: matchedEquipmentId,
                    supplier: supplierName || null,
                    amount: String(amount),
                    description: descParts.join(" "),
                    category: parsed.category || 'outro',
                    imageBase64: base64Image,
                    status: 'pending',
                }).returning();

                let itemsCount = 0;
                if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    for (const item of parsed.items) {
                        const q = parseFloat(item.quantity) || 1;
                        const uPrice = parseFloat(item.unitPrice) || 0;
                        const tPrice = parseFloat(item.totalPrice) || (q * uPrice);
                        await db.insert(farmExpenseItems).values({
                            expenseId: newExpense.id,
                            itemName: item.productName || "Item",
                            quantity: String(q),
                            unit: item.unit || "UN",
                            unitPrice: String(uPrice),
                            totalPrice: String(tPrice),
                        });
                        itemsCount++;
                    }
                }

                const itemsMsg = itemsCount > 0 ? ` com ${itemsCount} itens` : '';
                const { farmWhatsappPendingContext, farmCashAccounts } = await import("../shared/schema");
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

                const accounts = await db.select().from(farmCashAccounts).where(
                    and(eq(farmCashAccounts.farmerId, farmer.id), eq(farmCashAccounts.isActive, true))
                );
                const allEquipment = await db.select().from(farmEquipment).where(
                    eq(farmEquipment.farmerId, farmer.id)
                );

                const header = `✅ Recibo de *$ ${amount.toFixed(2)}*${supplierName ? ` da *${supplierName}*` : ''} (${parsed.category})${itemsMsg} recebido!`;

                const buildPaymentQuestion = (accts: any[]) => {
                    let idx = 1;
                    const lines: string[] = [];
                    for (const a of accts) { lines.push(`${idx}️⃣ ${a.name} (${a.currency})`); idx++; }
                    lines.push(`${idx}️⃣ Efetivo (bolso)`);
                    idx++;
                    lines.push(`${idx}️⃣ Financiado (safra)`);
                    return { text: lines.join("\n"), efIndex: idx - 1, finIndex: idx };
                };

                if (matchedEquipmentId) {
                    const matchedEquip = allEquipment.find(e => e.id === matchedEquipmentId);
                    const pq = buildPaymentQuestion(accounts);
                    await db.insert(farmWhatsappPendingContext).values({
                        farmerId: farmer.id, phone: formattedPhone, step: "awaiting_payment_method",
                        expenseId: newExpense.id,
                        data: { equipmentId: matchedEquipmentId, equipmentName: matchedEquip?.name, supplierName, amount, category: parsed.category },
                        expiresAt,
                    });
                    return res.json({
                        message: `${header}\n🚜 Máquina: *${matchedEquip?.name}*\n\nQual a forma de pagamento?\n${pq.text}`
                    });
                }

                if (allEquipment.length > 0) {
                    await db.insert(farmWhatsappPendingContext).values({
                        farmerId: farmer.id, phone: formattedPhone, step: "awaiting_equipment",
                        expenseId: newExpense.id,
                        data: { supplierName, amount, category: parsed.category },
                        expiresAt,
                    });
                    const equipList = allEquipment.map((e, i) => `${i + 1}️⃣ ${e.name}`).join("\n");
                    return res.json({
                        message: `${header}\n\nDe qual máquina/veículo é essa despesa?\n${equipList}\n${allEquipment.length + 1}️⃣ Nenhuma (não vincular)`
                    });
                }

                const pq = buildPaymentQuestion(accounts);
                await db.insert(farmWhatsappPendingContext).values({
                    farmerId: farmer.id, phone: formattedPhone, step: "awaiting_payment_method",
                    expenseId: newExpense.id,
                    data: { supplierName, amount, category: parsed.category },
                    expiresAt,
                });
                return res.json({
                    message: `${header}\n\nQual a forma de pagamento?\n${pq.text}`
                });
            }
            else if (parsed.type === "invoice") {
                const existingInvs = await db.select({
                    id: farmInvoices.id, invoiceNumber: farmInvoices.invoiceNumber,
                    supplier: farmInvoices.supplier, totalAmount: farmInvoices.totalAmount,
                }).from(farmInvoices).where(eq(farmInvoices.farmerId, farmer.id));

                const invDuplicate = existingInvs.find(inv => {
                    const invAmt = parseFloat(inv.totalAmount as string) || 0;
                    const sameNum = parsed.invoiceNumber && inv.invoiceNumber &&
                        inv.invoiceNumber.replace(/\D/g, '') === String(parsed.invoiceNumber).replace(/\D/g, '');
                    const sameSup = parsed.supplier && inv.supplier &&
                        inv.supplier.toLowerCase().includes(String(parsed.supplier).toLowerCase().substring(0, 10));
                    const sameAmt = Math.abs(invAmt - amount) < 0.01;
                    return (sameNum && sameAmt) || (sameNum && sameSup) || (sameSup && sameAmt);
                });

                if (invDuplicate) {
                    return res.json({
                        message: `⚠️ *Fatura possivelmente duplicada!*\n\nJá existe uma fatura no sistema com dados semelhantes:\n• Nº: ${invDuplicate.invoiceNumber || 'N/A'}\n• Fornecedor: ${invDuplicate.supplier || 'N/A'}\n• Valor: $ ${(parseFloat(invDuplicate.totalAmount as string) || 0).toFixed(2)}\n\nEssa fatura *não foi cadastrada* para evitar duplicidade. Verifique no painel.`
                    });
                }

                const [newInvoice] = await db.insert(farmInvoices).values({
                    farmerId: farmer.id,
                    totalAmount: String(amount),
                    notes: `[Via WhatsApp] ${parsed.description}`,
                    status: 'pending',
                    supplier: parsed.supplier || "Via WhatsApp",
                    invoiceNumber: parsed.invoiceNumber || `WPP-${Date.now().toString().slice(-6)}`
                }).returning();

                const allProducts = await farmStorage.getAllProducts();
                let itemsCount = 0;

                if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    for (const item of parsed.items) {
                        const q = parseFloat(item.quantity) || 1;
                        const uPrice = parseFloat(item.unitPrice) || 0;
                        const tPrice = parseFloat(item.totalPrice) || (q * uPrice);

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
                                    unit: item.unit || "UN",
                                    category: null,
                                    dosePerHa: null,
                                    activeIngredient: null,
                                    status: "pending_review",
                                    isDraft: true
                                });
                                allProducts.push(matchedProduct); // Add to list to avoid duplicates in same invoice
                            } catch (err) {
                                console.error(`[FARM_WEBHOOK_RECEIPT] Failed to auto-create product: ${item.productName}`, err);
                            }
                        }

                        await db.insert(farmInvoiceItems).values({
                            invoiceId: newInvoice.id,
                            productId: matchedProduct?.id || null,
                            productName: item.productName || "Produto Desconhecido",
                            quantity: String(q),
                            unit: item.unit || "UN",
                            unitPrice: String(uPrice),
                            totalPrice: String(tPrice)
                        });
                        itemsCount++;
                    }
                }

                return res.json({ message: `✅ Fatura de R$ ${amount.toFixed(2)} recebida da ${parsed.supplier || 'empresa'} com ${itemsCount} itens! Eles já estão aguardando sua revisão no painel AgroFarm.` });
            }
            else {
                return res.json({ message: `🤔 Hum, não consegui entender essa imagem. Parece um comprovante? Se sim, tente tirar uma foto mais nítida dos valores.` });
            }

        } catch (error) {
            console.error("[WEBHOOK_N8N_RECEIPT]", error);
            res.status(500).json({ error: "Internal server error during receipt processing" });
        }
    });

    app.get("/api/farm/webhook/n8n/stock", async (req, res) => {
        try {
            const { whatsapp_number } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
            // Extract last 9 digits for fallback matching
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            // Fallback: try matching by last 9 digits (handles country code variations)
            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            const stock = await farmStorage.getStock(farmers[0].id);
            res.json(stock.map(s => ({
                produto: s.productName,
                quantidade: parseFloat(s.quantity).toFixed(2),
                unidade: s.productUnit,
                categoria: s.productCategory
            })));
        } catch (error) {
            console.error("[WEBHOOK_N8N_STOCK]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/applications", async (req, res) => {
        try {
            const { whatsapp_number, limit = 5 } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            const applications = await farmStorage.getApplications(farmers[0].id);
            const recent = applications.slice(0, Number(limit)).map(a => ({
                data: new Date(a.appliedAt).toLocaleDateString("pt-BR"),
                produto: a.productName,
                quantidade: parseFloat(a.quantity).toFixed(2),
                propriedade: a.propertyName
            }));

            res.json(recent);
        } catch (error) {
            console.error("[WEBHOOK_N8N_APPS]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/prices", async (req, res) => {
        try {
            const { whatsapp_number, search } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users, farmPriceHistory } = await import("../shared/schema");
            const { eq, or, sql, desc, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }
            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            // Build conditions
            const conditions: any[] = [eq(farmPriceHistory.farmerId, farmers[0].id)];

            // If search is provided, filter by product name
            if (search && String(search).trim() !== "") {
                const term = String(search).trim();
                conditions.push(sql`${farmPriceHistory.productName} ILIKE ${'%' + term + '%'}`);
            }

            const items = await db.select({
                date: farmPriceHistory.purchaseDate,
                supplier: farmPriceHistory.supplier,
                productName: farmPriceHistory.productName,
                quantity: farmPriceHistory.quantity,
                unitPrice: farmPriceHistory.unitPrice,
                activeIngredient: farmPriceHistory.activeIngredient
            })
                .from(farmPriceHistory)
                .where(and(...conditions))
                .orderBy(desc(farmPriceHistory.purchaseDate))
                .limit(50);

            res.json(items.map((i: any) => ({
                dataCompra: i.date ? new Date(i.date).toLocaleDateString("pt-BR") : "N/A",
                fornecedor: i.supplier,
                produto: i.productName,
                quantidade: parseFloat(i.quantity || "0").toFixed(2),
                precoUnitario: parseFloat(i.unitPrice || "0").toFixed(2),
                principioAtivo: i.activeIngredient || ""
            })));
        } catch (error) {
            console.error("[WEBHOOK_N8N_PRICES]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Audio Transcription for n8n =====
    app.post("/api/farm/webhook/n8n/transcribe-audio", async (req, res) => {
        try {
            const { audioUrl } = req.body;
            if (!audioUrl) return res.status(400).json({ error: "audioUrl is required" });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

            console.log(`[TRANSCRIBE] Downloading audio: ${audioUrl}`);

            // Download audio
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) return res.status(400).json({ error: "Failed to download audio" });

            const contentType = audioResponse.headers.get("content-type") || "audio/ogg";
            const arrayBuffer = await audioResponse.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString("base64");

            console.log(`[TRANSCRIBE] Audio downloaded (${Math.round(arrayBuffer.byteLength / 1024)}KB, ${contentType}). Sending to Gemini...`);

            // Send to Gemini for transcription
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "Transcreva este áudio fielmente em português. Retorne APENAS o texto falado, sem comentários." },
                                { inline_data: { mime_type: contentType, data: base64Audio } }
                            ]
                        }]
                    })
                }
            );

            const data = await geminiResponse.json();
            if (!geminiResponse.ok) {
                console.error("[TRANSCRIBE] Gemini error:", data);
                return res.status(500).json({ error: "Transcription failed" });
            }

            const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            console.log(`[TRANSCRIBE] Result: "${transcription}"`);

            res.json({ transcription });
        } catch (error) {
            console.error("[TRANSCRIBE]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Weather Forecast for n8n =====
    app.get("/api/farm/webhook/n8n/weather", async (req, res) => {
        try {
            const { whatsapp_number } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            const farmer = farmers[0] as any;
            const lat = farmer.farm_latitude || farmer.farmLatitude || -25.2637;
            const lon = farmer.farm_longitude || farmer.farmLongitude || -57.5759;
            const city = farmer.farm_city || farmer.farmCity || "Região";

            const { getWeatherForecast, formatWeatherMessage } = await import("./services/weather-service");
            const forecasts = await getWeatherForecast(lat, lon, 3);

            res.json({
                previsao: formatWeatherMessage(forecasts, city),
                dados: forecasts
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_WEATHER]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Commodity Prices for n8n =====
    app.get("/api/farm/webhook/n8n/commodity", async (_req, res) => {
        try {
            const { getCommodityData, formatCommodityMessage } = await import("./services/commodity-service");
            const data = await getCommodityData();

            res.json({
                cotacao: formatCommodityMessage(data),
                dados: data
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_COMMODITY]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/invoices", async (req, res) => {
        try {
            const { whatsapp_number, limit = 20, date, supplier } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users, farmExpenses, farmInvoices } = await import("../shared/schema");
            const { eq, or, sql, desc, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            // Base conditions
            const expenseConditions: any[] = [eq(farmExpenses.farmerId, farmers[0].id)];
            const invoiceConditions: any[] = [eq(farmInvoices.farmerId, farmers[0].id)];

            if (date) {
                // Use issueDate (actual invoice date) for invoices, createdAt for expenses
                const dateStr = String(date);
                expenseConditions.push(sql`(to_char(${farmExpenses.createdAt}, 'DD/MM/YYYY') LIKE ${'%' + dateStr + '%'} OR to_char(${farmExpenses.createdAt}, 'YYYY-MM-DD') LIKE ${'%' + dateStr + '%'})`);
                // For invoices, search BOTH issueDate AND createdAt to maximize matches
                invoiceConditions.push(sql`(to_char(COALESCE(${farmInvoices.issueDate}, ${farmInvoices.createdAt}), 'DD/MM/YYYY') LIKE ${'%' + dateStr + '%'} OR to_char(COALESCE(${farmInvoices.issueDate}, ${farmInvoices.createdAt}), 'YYYY-MM-DD') LIKE ${'%' + dateStr + '%'})`);
            }

            if (supplier) {
                const supplierStr = String(supplier);
                invoiceConditions.push(sql`${farmInvoices.supplier} ILIKE ${'%' + supplierStr + '%'}`);
            }

            const expenses = await db.select().from(farmExpenses)
                .where(and(...expenseConditions))
                .orderBy(desc(farmExpenses.createdAt))
                .limit(Number(limit));

            const invoices = await db.select().from(farmInvoices)
                .where(and(...invoiceConditions))
                .orderBy(desc(farmInvoices.createdAt))
                .limit(Number(limit));

            res.json({
                despesas: expenses.map((e: any) => ({
                    descricao: e.description,
                    valor: parseFloat(e.amount).toFixed(2),
                    categoria: e.category,
                    data: new Date(e.createdAt).toLocaleDateString("pt-BR"),
                    status: e.status
                })),
                faturas: invoices.map((i: any) => ({
                    fornecedor: i.supplier,
                    valorTotal: parseFloat(i.totalAmount || "0").toFixed(2),
                    data: i.issueDate ? new Date(i.issueDate).toLocaleDateString("pt-BR") : new Date(i.createdAt).toLocaleDateString("pt-BR"),
                    status: i.status
                }))
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_INVOICES]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/manuals", async (req, res) => {
        try {
            const { search } = req.query;
            const { farmManuals } = await import("../shared/schema");
            const { db } = await import("./db");

            const manuals = await db.select().from(farmManuals);

            if (search) {
                const { answerFromManuals } = await import("./whatsapp/gemini-client");

                let context = manuals.map((m: any) => `\n### MANUAL: ${m.title} (Segmento: ${m.segment})\n${m.contentText}`).join("\n");

                if (context.length > 500000) context = context.substring(0, 500000) + "...";

                const answer = await answerFromManuals(search as string, context);

                return res.json({ resposta: answer });
            }

            res.json({ manuals });
        } catch (error) {
            console.error("[WEBHOOK_N8N_MANUALS]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ============================================================================
    // ROMANEIOS (Boletas de Pesaje)
    // ============================================================================

    app.get("/api/farm/romaneios", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmPlots, farmProperties, farmSeasons } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const romaneios = await db.select({
                romaneio: farmRomaneios,
                plotName: farmPlots.name,
                plotArea: farmPlots.areaHa,
                propertyName: farmProperties.name,
                seasonName: farmSeasons.name,
            })
                .from(farmRomaneios)
                .leftJoin(farmPlots, eq(farmRomaneios.plotId, farmPlots.id))
                .leftJoin(farmProperties, eq(farmRomaneios.propertyId, farmProperties.id))
                .leftJoin(farmSeasons, eq(farmRomaneios.seasonId, farmSeasons.id))
                .where(eq(farmRomaneios.farmerId, farmerId))
                .orderBy(desc(farmRomaneios.deliveryDate));

            res.json(romaneios.map((r: any) => ({
                ...r.romaneio,
                plotName: r.plotName,
                plotArea: r.plotArea,
                propertyName: r.propertyName,
                seasonName: r.seasonName,
            })));
        } catch (error) {
            console.error("[ROMANEIOS_GET]", error);
            res.status(500).json({ error: "Failed to get romaneios" });
        }
    });

    app.post("/api/farm/romaneios", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmAccountsReceivable } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [romaneio] = await db.insert(farmRomaneios).values({
                ...req.body,
                farmerId,
            }).returning();

            // Auto-generate Conta a Receber if price is provided
            if (romaneio.totalValue && parseFloat(romaneio.totalValue) > 0) {
                const dueDate = new Date(romaneio.deliveryDate);
                dueDate.setDate(dueDate.getDate() + 30); // 30 days to receive
                await db.insert(farmAccountsReceivable).values({
                    farmerId,
                    romaneioId: romaneio.id,
                    buyer: romaneio.buyer,
                    description: `${romaneio.crop} - Ticket ${romaneio.ticketNumber || 'S/N'} - ${(parseFloat(romaneio.finalWeight) / 1000).toFixed(2)} ton`,
                    totalAmount: romaneio.totalValue,
                    currency: romaneio.currency,
                    dueDate: dueDate.toISOString(),
                    status: "pendente",
                });
            }

            res.json(romaneio);
        } catch (error) {
            console.error("[ROMANEIO_CREATE]", error);
            res.status(500).json({ error: "Failed to create romaneio" });
        }
    });

    // ===== ROMANEIO AI IMPORT (Photo/PDF) =====
    app.post("/api/farm/romaneios/import", requireFarmer, upload.single("file"), async (req, res) => {
        try {
            const { farmRomaneios } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const file = req.file;

            if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

            console.log(`[ROMANEIO_IMPORT] Parsing ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)}KB)`);

            const { parseRomaneioImage } = await import("./parse-farm-invoice");
            const parsed = await parseRomaneioImage(file.buffer, file.mimetype);

            console.log(`[ROMANEIO_IMPORT] Parsed: ticket=${parsed.ticketNumber}, buyer=${parsed.buyer}, crop=${parsed.crop}, gross=${parsed.grossWeight}kg`);

            // Return parsed data for frontend preview (don't save yet)
            res.json({
                message: "Romaneio extraído com sucesso!",
                parsed,
            });
        } catch (error) {
            console.error("[ROMANEIO_IMPORT]", error);
            res.status(500).json({ error: "Falha ao processar romaneio. Tente novamente." });
        }
    });

    // ===== CONFIRM WhatsApp Romaneio =====
    app.post("/api/farm/romaneios/:id/confirm", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // Update romaneio fields + set status to confirmed
            const updateData: any = { status: "confirmed", ...req.body };
            delete updateData.id; // safety

            const [romaneio] = await db.update(farmRomaneios)
                .set(updateData)
                .where(and(eq(farmRomaneios.id, req.params.id), eq(farmRomaneios.farmerId, farmerId)))
                .returning();

            if (!romaneio) return res.status(404).json({ error: "Romaneio not found" });

            // Auto-generate Conta a Receber if price is provided
            if (romaneio.totalValue && parseFloat(romaneio.totalValue) > 0) {
                const dueDate = new Date(romaneio.deliveryDate);
                dueDate.setDate(dueDate.getDate() + 30);
                await db.insert(farmAccountsReceivable).values({
                    farmerId,
                    romaneioId: romaneio.id,
                    buyer: romaneio.buyer,
                    description: `${romaneio.crop} - Ticket ${romaneio.ticketNumber || 'S/N'} - ${(parseFloat(romaneio.finalWeight) / 1000).toFixed(2)} ton`,
                    totalAmount: romaneio.totalValue,
                    currency: romaneio.currency,
                    dueDate: dueDate.toISOString(),
                    status: "pendente",
                });
            }

            res.json({ success: true, romaneio });
        } catch (error) {
            console.error("[ROMANEIO_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm romaneio" });
        }
    });

    app.put("/api/farm/romaneios/:id", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmRomaneios).set(req.body).where(
                and(eq(farmRomaneios.id, req.params.id), eq(farmRomaneios.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[ROMANEIO_UPDATE]", error);
            res.status(500).json({ error: "Failed to update romaneio" });
        }
    });

    app.delete("/api/farm/romaneios/:id", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmRomaneios).where(
                and(eq(farmRomaneios.id, req.params.id), eq(farmRomaneios.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[ROMANEIO_DELETE]", error);
            res.status(500).json({ error: "Failed to delete romaneio" });
        }
    });

    // ===== N8N/WhatsApp Webhook: Romaneio Photo Import =====
    app.post("/api/farm/webhook/n8n/romaneio", async (req, res) => {
        try {
            const { whatsapp_number, imageUrl, caption } = req.body;
            if (!whatsapp_number || !imageUrl) {
                return res.status(400).json({ error: "whatsapp_number and imageUrl are required" });
            }

            const { users, farmRomaneios, farmPlots } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            // Find farmer by phone
            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number);
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) {
                return res.status(404).json({ error: "Farmer not found" });
            }

            const farmerId = farmers[0].id;

            console.log(`[WEBHOOK_N8N_ROMANEIO] phone=${whatsapp_number}, imageUrl=${imageUrl?.substring(0, 60)}...`);

            // Download image
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                return res.status(400).json({ error: "Failed to download romaneio image" });
            }

            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Parse with AI
            const { parseRomaneioImage } = await import("./parse-farm-invoice");
            const parsed = await parseRomaneioImage(buffer, contentType);

            console.log(`[WEBHOOK_N8N_ROMANEIO] Parsed: ticket=${parsed.ticketNumber}, buyer=${parsed.buyer}, gross=${parsed.grossWeight}kg`);

            // Get farmer's plots for context
            const plots = await db.select({ id: farmPlots.id, name: farmPlots.name })
                .from(farmPlots)
                .where(sql`${farmPlots.propertyId} IN (
                    SELECT id FROM farm_properties WHERE farmer_id = ${farmerId}
                )`);

            // Create pending romaneio
            const [romaneio] = await db.insert(farmRomaneios).values({
                farmerId,
                buyer: parsed.buyer,
                crop: parsed.crop,
                deliveryDate: parsed.deliveryDate || new Date(),
                grossWeight: String(parsed.grossWeight),
                tare: String(parsed.tare),
                netWeight: String(parsed.netWeight),
                finalWeight: String(parsed.finalWeight),
                moisture: parsed.moisture != null ? String(parsed.moisture) : null,
                impurities: parsed.impurities != null ? String(parsed.impurities) : null,
                moistureDiscount: String(parsed.moistureDiscount),
                impurityDiscount: String(parsed.impurityDiscount),
                pricePerTon: parsed.pricePerTon != null ? String(parsed.pricePerTon) : null,
                totalValue: parsed.totalValue != null ? String(parsed.totalValue) : null,
                currency: parsed.currency,
                truckPlate: parsed.truckPlate,
                ticketNumber: parsed.ticketNumber,
                driver: parsed.driver,
                documentNumber: parsed.documentNumber,
                discounts: parsed.discounts,
                source: "whatsapp",
                status: "pending",
                notes: caption || parsed.notes || "",
            }).returning();

            // Format response message for WhatsApp
            const plotList = plots.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
            const summary = [
                `✅ *Romaneio #${parsed.ticketNumber || 'S/N'} recebido!*`,
                ``,
                `🏢 Comprador: *${parsed.buyer}*`,
                `🌾 Cultura: *${parsed.crop}*`,
                `📅 Data: ${parsed.deliveryDate ? new Date(parsed.deliveryDate).toLocaleDateString("pt-BR") : "Hoje"}`,
                ``,
                `⚖️ Peso Bruto: ${parsed.grossWeight.toLocaleString()} kg`,
                `📦 Tara: ${parsed.tare.toLocaleString()} kg`,
                `📊 Peso Neto: ${parsed.netWeight.toLocaleString()} kg`,
                parsed.moisture != null ? `💧 Umidade: ${parsed.moisture}%` : null,
                parsed.impurities != null ? `🔬 Impureza: ${parsed.impurities}%` : null,
                `✨ Peso Líquido: *${parsed.finalWeight.toLocaleString()} kg* (${(parsed.finalWeight / 1000).toFixed(2)} ton)`,
                parsed.truckPlate ? `🚛 Placa: ${parsed.truckPlate}` : null,
                ``,
                plots.length > 0 ? `📍 *De qual talhão é esse romaneio?*\n${plotList}` : `⚠️ Nenhum talhão cadastrado. Confirme pelo sistema.`,
            ].filter(Boolean).join("\n");

            res.json({
                message: summary,
                romaneioId: romaneio.id,
                plots: plots.map(p => ({ id: p.id, name: p.name })),
                parsed,
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_ROMANEIO]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Get productivity per plot (aggregated romaneios)
    app.get("/api/farm/romaneios/productivity", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmPlots } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmRomaneios.farmerId, farmerId)];
            if (req.query.seasonId) {
                conditions.push(eq(farmRomaneios.seasonId, req.query.seasonId as string));
            }

            const productivity = await db.select({
                plotId: farmRomaneios.plotId,
                plotName: farmPlots.name,
                plotArea: farmPlots.areaHa,
                crop: farmRomaneios.crop,
                totalFinalWeight: sql<string>`SUM(CAST(${farmRomaneios.finalWeight} AS NUMERIC))`,
                totalValue: sql<string>`SUM(CAST(${farmRomaneios.totalValue} AS NUMERIC))`,
                deliveryCount: sql<string>`COUNT(*)`,
            })
                .from(farmRomaneios)
                .leftJoin(farmPlots, eq(farmRomaneios.plotId, farmPlots.id))
                .where(and(...conditions))
                .groupBy(farmRomaneios.plotId, farmPlots.name, farmPlots.areaHa, farmRomaneios.crop);

            res.json(productivity.map((p: any) => ({
                ...p,
                kgPerHa: p.plotArea && parseFloat(p.plotArea) > 0
                    ? (parseFloat(p.totalFinalWeight) / parseFloat(p.plotArea)).toFixed(0)
                    : null,
                tonPerHa: p.plotArea && parseFloat(p.plotArea) > 0
                    ? (parseFloat(p.totalFinalWeight) / parseFloat(p.plotArea) / 1000).toFixed(2)
                    : null,
            })));
        } catch (error) {
            console.error("[ROMANEIO_PRODUCTIVITY]", error);
            res.status(500).json({ error: "Failed to get productivity" });
        }
    });

    // ============================================================================
    // CONTAS A PAGAR
    // ============================================================================

    app.get("/api/farm/accounts-payable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmAccountsPayable.farmerId, farmerId)];
            if (req.query.status) conditions.push(eq(farmAccountsPayable.status, req.query.status as string));

            const accounts = await db.select().from(farmAccountsPayable)
                .where(and(...conditions))
                .orderBy(desc(farmAccountsPayable.dueDate));
            res.json(accounts);
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_GET]", error);
            res.status(500).json({ error: "Failed to get accounts payable" });
        }
    });

    app.post("/api/farm/accounts-payable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [ap] = await db.insert(farmAccountsPayable).values({
                ...req.body,
                farmerId,
            }).returning();
            res.json(ap);
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_CREATE]", error);
            res.status(500).json({ error: "Failed to create account payable" });
        }
    });

    app.put("/api/farm/accounts-payable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmAccountsPayable).set(req.body).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update account payable" });
        }
    });

    // Pay action — creates cash flow transaction
    app.post("/api/farm/accounts-payable/:id/pay", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { accountId, amount, paymentMethod } = req.body;

            // Get the account payable
            const [ap] = await db.select().from(farmAccountsPayable).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            );
            if (!ap) return res.status(404).json({ error: "Not found" });

            const payAmount = parseFloat(amount || ap.totalAmount);
            const previousPaid = parseFloat(ap.paidAmount || "0");
            const newPaidTotal = previousPaid + payAmount;
            const totalDue = parseFloat(ap.totalAmount);

            // Create cash flow transaction (SAÍDA)
            const [tx] = await db.insert(farmCashTransactions).values({
                farmerId,
                accountId,
                type: "saida",
                amount: String(payAmount),
                currency: ap.currency,
                category: "pagamento_titulo",
                description: `Pgto: ${ap.supplier} - ${ap.description || ''}`.trim(),
                paymentMethod: paymentMethod || "transferencia",
                referenceType: "pagamento_conta",
            }).returning();

            // Update account balance
            const { sql: sqlFn } = await import("drizzle-orm");
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance - ${payAmount}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            // Update account payable status
            const newStatus = newPaidTotal >= totalDue ? "pago" : "parcial";
            await db.update(farmAccountsPayable).set({
                paidAmount: String(newPaidTotal),
                paidDate: new Date().toISOString(),
                status: newStatus,
                cashTransactionId: tx.id,
            }).where(eq(farmAccountsPayable.id, req.params.id));

            res.json({ success: true, status: newStatus, transaction: tx });
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_PAY]", error);
            res.status(500).json({ error: "Failed to pay account" });
        }
    });

    app.delete("/api/farm/accounts-payable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsPayable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmAccountsPayable).where(
                and(eq(farmAccountsPayable.id, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[ACCOUNTS_PAYABLE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete account payable" });
        }
    });

    // ============================================================================
    // CONTAS A RECEBER
    // ============================================================================

    app.get("/api/farm/accounts-receivable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmAccountsReceivable.farmerId, farmerId)];
            if (req.query.status) conditions.push(eq(farmAccountsReceivable.status, req.query.status as string));

            const accounts = await db.select().from(farmAccountsReceivable)
                .where(and(...conditions))
                .orderBy(desc(farmAccountsReceivable.dueDate));
            res.json(accounts);
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_GET]", error);
            res.status(500).json({ error: "Failed to get accounts receivable" });
        }
    });

    app.post("/api/farm/accounts-receivable", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [ar] = await db.insert(farmAccountsReceivable).values({
                ...req.body,
                farmerId,
            }).returning();
            res.json(ar);
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_CREATE]", error);
            res.status(500).json({ error: "Failed to create account receivable" });
        }
    });

    // Receive action — creates cash flow transaction (ENTRADA)
    app.post("/api/farm/accounts-receivable/:id/receive", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable, farmCashTransactions, farmCashAccounts } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { accountId, amount, paymentMethod } = req.body;

            const [ar] = await db.select().from(farmAccountsReceivable).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            );
            if (!ar) return res.status(404).json({ error: "Not found" });

            const receiveAmount = parseFloat(amount || ar.totalAmount);
            const previousReceived = parseFloat(ar.receivedAmount || "0");
            const newReceivedTotal = previousReceived + receiveAmount;
            const totalExpected = parseFloat(ar.totalAmount);

            // Create cash flow transaction (ENTRADA)
            const [tx] = await db.insert(farmCashTransactions).values({
                farmerId,
                accountId,
                type: "entrada",
                amount: String(receiveAmount),
                currency: ar.currency,
                category: "recebimento_venda",
                description: `Receb: ${ar.buyer} - ${ar.description || ''}`.trim(),
                paymentMethod: paymentMethod || "transferencia",
                referenceType: "recebimento_conta",
            }).returning();

            // Update account balance
            const { sql: sqlFn } = await import("drizzle-orm");
            await db.update(farmCashAccounts)
                .set({ currentBalance: sqlFn`current_balance + ${receiveAmount}` })
                .where(and(eq(farmCashAccounts.id, accountId), eq(farmCashAccounts.farmerId, farmerId)));

            // Update account receivable status
            const newStatus = newReceivedTotal >= totalExpected ? "recebido" : "parcial";
            await db.update(farmAccountsReceivable).set({
                receivedAmount: String(newReceivedTotal),
                receivedDate: new Date().toISOString(),
                status: newStatus,
                cashTransactionId: tx.id,
            }).where(eq(farmAccountsReceivable.id, req.params.id));

            res.json({ success: true, status: newStatus, transaction: tx });
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_RECEIVE]", error);
            res.status(500).json({ error: "Failed to receive payment" });
        }
    });

    app.delete("/api/farm/accounts-receivable/:id", requireFarmer, async (req, res) => {
        try {
            const { farmAccountsReceivable } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmAccountsReceivable).where(
                and(eq(farmAccountsReceivable.id, req.params.id), eq(farmAccountsReceivable.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[ACCOUNTS_RECEIVABLE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete account receivable" });
        }
    });

    // ============================================================================
    // DRE — Estado de Resultados por Safra (read-only aggregation)
    // ============================================================================

    app.get("/api/farm/dre", requireFarmer, async (req, res) => {
        try {
            const {
                farmAccountsReceivable, farmAccountsPayable,
                farmExpenses, farmApplications, farmStock,
                farmCashTransactions
            } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // RECEITAS: Contas a Receber (recebido)
            const [receivableSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmAccountsReceivable.receivedAmount} AS NUMERIC)), 0)`,
            }).from(farmAccountsReceivable).where(eq(farmAccountsReceivable.farmerId, farmerId));

            // CUSTOS DE PRODUÇÃO: applications × avg cost
            const [appCostSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmApplications.quantity} AS NUMERIC) * CAST(${farmStock.averageCost} AS NUMERIC)), 0)`,
            }).from(farmApplications)
                .leftJoin(farmStock, and(
                    eq(farmApplications.productId, farmStock.productId),
                    eq(farmApplications.farmerId, farmStock.farmerId),
                ))
                .where(eq(farmApplications.farmerId, farmerId));

            // DESPESAS com talhão (custo de produção)
            const [plotExpenseSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS NUMERIC)), 0)`,
            }).from(farmExpenses).where(
                and(eq(farmExpenses.farmerId, farmerId), sql`${farmExpenses.plotId} IS NOT NULL`)
            );

            // DESPESAS sem talhão (operacionais)
            const [opExpenseSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS NUMERIC)), 0)`,
            }).from(farmExpenses).where(
                and(eq(farmExpenses.farmerId, farmerId), sql`${farmExpenses.plotId} IS NULL`)
            );

            // CONTAS A PAGAR pagas (financeiro)
            const [payableSum] = await db.select({
                total: sql<string>`COALESCE(SUM(CAST(${farmAccountsPayable.paidAmount} AS NUMERIC)), 0)`,
            }).from(farmAccountsPayable).where(eq(farmAccountsPayable.farmerId, farmerId));

            const receitas = parseFloat(receivableSum.total);
            const custoProducao = parseFloat(appCostSum.total) + parseFloat(plotExpenseSum.total);
            const lucroBruto = receitas - custoProducao;
            const despesasOp = parseFloat(opExpenseSum.total);
            const resultadoOp = lucroBruto - despesasOp;
            const resultadoLiquido = resultadoOp; // Can add financial items later

            res.json({
                receitas,
                custoProducao,
                lucroBruto,
                despesasOperacionais: despesasOp,
                resultadoOperacional: resultadoOp,
                resultadoLiquido,
                detail: {
                    receitasRecebidas: parseFloat(receivableSum.total),
                    custoInsumos: parseFloat(appCostSum.total),
                    despesasTalhao: parseFloat(plotExpenseSum.total),
                    despesasGerais: despesasOp,
                    totalPago: parseFloat(payableSum.total),
                },
            });
        } catch (error) {
            console.error("[DRE_GET]", error);
            res.status(500).json({ error: "Failed to generate DRE" });
        }
    });

    // ============================================================================
    // ORÇAMENTO POR SAFRA
    // ============================================================================

    app.get("/api/farm/budgets", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets, farmExpenses } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const budgets = await db.select().from(farmBudgets)
                .where(eq(farmBudgets.farmerId, farmerId));

            // Get actual expenses by category for comparison
            const actualExpenses = await db.select({
                category: farmExpenses.category,
                actualAmount: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS NUMERIC)), 0)`,
            }).from(farmExpenses)
                .where(eq(farmExpenses.farmerId, farmerId))
                .groupBy(farmExpenses.category);

            const actualMap = new Map(actualExpenses.map((e: any) => [e.category, parseFloat(e.actualAmount)]));

            res.json(budgets.map((b: any) => ({
                ...b,
                actualAmount: actualMap.get(b.category) || 0,
                percentUsed: parseFloat(String(b.plannedAmount)) > 0
                    ? (((actualMap.get(b.category) || 0) / parseFloat(String(b.plannedAmount))) * 100).toFixed(1)
                    : "0",
            })));
        } catch (error) {
            console.error("[BUDGETS_GET]", error);
            res.status(500).json({ error: "Failed to get budgets" });
        }
    });

    app.post("/api/farm/budgets", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [budget] = await db.insert(farmBudgets).values({
                ...req.body,
                farmerId,
            }).returning();
            res.json(budget);
        } catch (error) {
            console.error("[BUDGET_CREATE]", error);
            res.status(500).json({ error: "Failed to create budget" });
        }
    });

    app.put("/api/farm/budgets/:id", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmBudgets).set(req.body).where(
                and(eq(farmBudgets.id, req.params.id), eq(farmBudgets.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[BUDGET_UPDATE]", error);
            res.status(500).json({ error: "Failed to update budget" });
        }
    });

    app.delete("/api/farm/budgets/:id", requireFarmer, async (req, res) => {
        try {
            const { farmBudgets } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmBudgets).where(
                and(eq(farmBudgets.id, req.params.id), eq(farmBudgets.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[BUDGET_DELETE]", error);
            res.status(500).json({ error: "Failed to delete budget" });
        }
    });

    // ============================================================================
    // CONCILIAÇÃO BANCÁRIA
    // ============================================================================

    app.get("/api/farm/bank-statements", requireFarmer, async (req, res) => {
        try {
            const { farmBankStatements } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmBankStatements.farmerId, farmerId)];
            if (req.query.accountId) conditions.push(eq(farmBankStatements.accountId, req.query.accountId as string));
            if (req.query.status) conditions.push(eq(farmBankStatements.status, req.query.status as string));

            const statements = await db.select().from(farmBankStatements)
                .where(and(...conditions))
                .orderBy(desc(farmBankStatements.transactionDate));
            res.json(statements);
        } catch (error) {
            console.error("[BANK_STATEMENTS_GET]", error);
            res.status(500).json({ error: "Failed to get bank statements" });
        }
    });

    app.post("/api/farm/bank-statements", requireFarmer, async (req, res) => {
        try {
            const { farmBankStatements } = await import("../shared/schema");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // Support batch import (array of statements)
            const items = Array.isArray(req.body) ? req.body : [req.body];
            const importBatch = `import-${Date.now()}`;

            const inserted = [];
            for (const item of items) {
                const [stmt] = await db.insert(farmBankStatements).values({
                    ...item,
                    farmerId,
                    importBatch,
                }).returning();
                inserted.push(stmt);
            }
            res.json(inserted);
        } catch (error) {
            console.error("[BANK_STATEMENT_CREATE]", error);
            res.status(500).json({ error: "Failed to import bank statements" });
        }
    });

    // Match bank statement to cash flow transaction
    app.post("/api/farm/bank-statements/:id/match", requireFarmer, async (req, res) => {
        try {
            const { farmBankStatements } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const { transactionId } = req.body;

            const [updated] = await db.update(farmBankStatements).set({
                matchedTransactionId: transactionId,
                status: "matched",
            }).where(
                and(eq(farmBankStatements.id, req.params.id), eq(farmBankStatements.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[BANK_STATEMENT_MATCH]", error);
            res.status(500).json({ error: "Failed to match statement" });
        }
    });

    console.log("✅ Farm routes registered (/api/farm/*, /api/pdv/*)");
}
