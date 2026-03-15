import { Express, Request, Response } from "express";
import { requireFarmer, upload } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { farmProductsCatalog, farmStockMovements } from "@shared/schema";

export function registerFarmStockRoutes(app: Express) {

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

    app.post("/api/farm/stock/transfer", requireFarmer, async (req: Request, res: Response) => {
        try {
            const { productId, fromWarehouseId: rawFrom, toWarehouseId: rawTo, quantity, notes } = req.body;
            const farmerId = (req.user as any).id;
            const qty = parseFloat(quantity);
            if (!productId || !qty || qty <= 0) {
                return res.status(400).json({ error: "productId and positive quantity are required" });
            }

            // Normalize "none" to null (frontend sends "none" for "Sem deposito")
            const fromWarehouseId = (rawFrom && rawFrom !== 'none') ? rawFrom : null;
            const toWarehouseId = (rawTo && rawTo !== 'none') ? rawTo : null;

            // Validate source stock has enough quantity
            const fromPropId = fromWarehouseId || null;
            const fromCoalesced = fromPropId || '__none__';
            const sourceRows = await db.execute(sql`
                SELECT * FROM farm_stock
                WHERE farmer_id = ${farmerId} AND product_id = ${productId}
                  AND COALESCE(property_id, '__none__') = ${fromCoalesced}
                LIMIT 1
            `);
            const sourceStock = ((sourceRows as any).rows ?? sourceRows)[0];
            if (!sourceStock || parseFloat(sourceStock.quantity) < qty) {
                const available = sourceStock ? parseFloat(sourceStock.quantity).toFixed(2) : '0';
                return res.status(400).json({ error: `Estoque insuficiente no deposito origem. Disponivel: ${available}` });
            }

            // 1. Decrease stock in source deposit
            await farmStorage.upsertStock(farmerId, productId, -qty, 0, fromPropId);

            // 2. Increase stock in destination deposit (use source avg cost)
            const avgCost = parseFloat(sourceStock.average_cost) || 0;
            await farmStorage.upsertStock(farmerId, productId, qty, avgCost, toWarehouseId || null);

            // 3. Create saida movement from source (history -- kept as-is)
            await db.execute(sql`
                INSERT INTO farm_stock_movements (farmer_id, product_id, type, quantity, unit_cost, reference_type, warehouse_id, notes)
                VALUES (${farmerId}, ${productId}, 'saida', ${qty}, 0, 'transfer', ${fromWarehouseId ?? null},
                    ${'Transferencia para deposito ' + (toWarehouseId || 'outro') + '. ' + (notes || '')})
            `);

            // 4. Create entrada movement to destination (history -- kept as-is)
            await db.execute(sql`
                INSERT INTO farm_stock_movements (farmer_id, product_id, type, quantity, unit_cost, reference_type, warehouse_id, notes)
                VALUES (${farmerId}, ${productId}, 'entrada', ${qty}, 0, 'transfer', ${toWarehouseId ?? null},
                    ${'Transferencia de deposito ' + (fromWarehouseId || 'outro') + '. ' + (notes || '')})
            `);

            res.json({ ok: true, message: "Transferencia realizada com sucesso" });
        } catch (e: any) {
            console.error("[STOCK_TRANSFER]", e);
            res.status(500).json({ error: e.message });
        }
    });
}
