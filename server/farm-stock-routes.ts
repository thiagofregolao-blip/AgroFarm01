import { Express, Request, Response } from "express";
import { requireFarmer, upload } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";
import { farmProductsCatalog, farmStockMovements, farmDeposits } from "@shared/schema";

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
            const { quantity, averageCost, reason, productName, productCategory, productUnit, depositId } = req.body;
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

            // Update property_id (deposit) if provided
            if (updatedStock && depositId !== undefined) {
                const depVal = (depositId && depositId !== "__none__") ? depositId : null;
                await db.execute(sql`UPDATE farm_stock SET property_id = ${depVal} WHERE id = ${req.params.id}`);
            }

            res.json(updatedStock);
        } catch (error) {
            console.error("[FARM_STOCK_UPDATE] ERROR:", (error as any)?.message || error);
            res.status(500).json({ error: `Failed to update stock: ${(error as any)?.message || 'unknown'}` });
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
            const { name, activeIngredient, category, unit, quantity, unitCost, depositId, lote, expiryDate, packageSize } = req.body;

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
            const depId = depositId || null;

            const updatedStock = await farmStorage.upsertStock(farmerId, productId, parsedQty, parsedCost, depId);

            // 4. Update lote, expiry_date, package_size on farm_stock
            const parsedExpiry = expiryDate ? new Date(expiryDate) : null;
            const parsedPkg = packageSize ? parseFloat(packageSize) : null;
            if (lote || parsedExpiry || parsedPkg) {
                await db.execute(sql`
                    UPDATE farm_stock SET
                        lote = COALESCE(${lote || null}, lote),
                        expiry_date = COALESCE(${parsedExpiry ? parsedExpiry.toISOString() : null}, expiry_date),
                        package_size = COALESCE(${parsedPkg ? String(parsedPkg) : null}, package_size)
                    WHERE farmer_id = ${farmerId} AND product_id = ${productId}
                `);
            }

            // 5. Register movement
            await db.insert(farmStockMovements).values({
                farmerId,
                productId,
                type: 'entry',
                quantity: String(parsedQty),
                unitCost: String(parsedCost),
                referenceType: 'manual_entry',
                lote: lote || null,
                expiryDate: parsedExpiry,
                packageSize: parsedPkg ? String(parsedPkg) : null,
                notes: `Entrada manual avulsa${depId ? ' (deposito: ' + depId + ')' : ''}`,
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

    // ─── Depositos CRUD ──────────────────────────────────────────────────────
    app.get("/api/farm/deposits", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const rows = await db.select().from(farmDeposits).where(eq(farmDeposits.farmerId, farmerId));
            res.json(rows);
        } catch (error) {
            console.error("[DEPOSITS_GET]", error);
            res.status(500).json({ error: "Failed to get deposits" });
        }
    });

    app.post("/api/farm/deposits", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const { name, depositType, location } = req.body;
            if (!name) return res.status(400).json({ error: "Nome e obrigatorio" });

            // Ensure table exists (idempotent)
            await db.execute(sql`
                CREATE TABLE IF NOT EXISTS farm_deposits (
                    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
                    farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    name text NOT NULL,
                    deposit_type text NOT NULL DEFAULT 'fazenda',
                    location text,
                    is_active boolean NOT NULL DEFAULT true,
                    created_at timestamp NOT NULL DEFAULT now()
                )
            `);

            const rows = await db.execute(sql`
                INSERT INTO farm_deposits (farmer_id, name, deposit_type, location)
                VALUES (${farmerId}, ${name}, ${depositType || "fazenda"}, ${location || null})
                RETURNING *
            `);
            const dep = ((rows as any).rows ?? rows)[0];
            res.status(201).json(dep);
        } catch (error) {
            console.error("[DEPOSITS_POST]", error);
            res.status(500).json({ error: "Failed to create deposit" });
        }
    });

    app.put("/api/farm/deposits/:id", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const { name, depositType, location, isActive } = req.body;
            const [updated] = await db.execute(sql`
                UPDATE farm_deposits SET
                    name = COALESCE(${name}, name),
                    deposit_type = COALESCE(${depositType}, deposit_type),
                    location = COALESCE(${location}, location),
                    is_active = COALESCE(${isActive}, is_active)
                WHERE id = ${req.params.id} AND farmer_id = ${farmerId}
                RETURNING *
            `);
            res.json(updated);
        } catch (error) {
            console.error("[DEPOSITS_PUT]", error);
            res.status(500).json({ error: "Failed to update deposit" });
        }
    });

    app.delete("/api/farm/deposits/:id", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            await db.delete(farmDeposits).where(
                and(eq(farmDeposits.id, req.params.id), eq(farmDeposits.farmerId, farmerId))
            );
            res.sendStatus(204);
        } catch (error) {
            console.error("[DEPOSITS_DELETE]", error);
            res.status(500).json({ error: "Failed to delete deposit" });
        }
    });

    // ─── Stock by deposit (for AR product selection) ─────────────────────────
    app.get("/api/farm/stock/by-deposit", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const depositType = req.query.depositType as string || null;
            let rows;
            if (depositType) {
                rows = await db.execute(sql`
                    SELECT s.*, p.name as product_name, p.category, p.unit, d.name as deposit_name, d.deposit_type
                    FROM farm_stock s
                    JOIN farm_products_catalog p ON p.id = s.product_id
                    LEFT JOIN farm_deposits d ON d.id = s.property_id
                    WHERE s.farmer_id = ${farmerId} AND CAST(s.quantity AS numeric) > 0
                      AND d.deposit_type = ${depositType}
                    ORDER BY p.name
                `);
            } else {
                rows = await db.execute(sql`
                    SELECT s.*, p.name as product_name, p.category, p.unit, d.name as deposit_name, d.deposit_type
                    FROM farm_stock s
                    JOIN farm_products_catalog p ON p.id = s.product_id
                    LEFT JOIN farm_deposits d ON d.id = s.property_id
                    WHERE s.farmer_id = ${farmerId} AND CAST(s.quantity AS numeric) > 0
                    ORDER BY p.name
                `);
            }
            res.json((rows as any).rows ?? rows);
        } catch (error) {
            console.error("[STOCK_BY_DEPOSIT]", error);
            res.status(500).json({ error: "Failed to get stock by deposit" });
        }
    });

    // ─── Import stock via Excel ──────────────────────────────────────────────
    app.post("/api/farm/stock/import-excel", requireFarmer, upload.single("file"), async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            const depositId = req.body.depositId || null;
            if (!req.file) return res.status(400).json({ error: "Arquivo e obrigatorio" });

            // Dynamic import xlsx
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            // Parse as array of arrays to find the real header row
            const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

            // Find header row: row containing product-like + quantity-like columns (PT or ES)
            let headerIdx = 0;
            for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
                const rowStr = (rawRows[i] || []).map(String).join("|").toLowerCase();
                const hasProduct = rowStr.includes("produto") || rowStr.includes("nombre") || rowStr.includes("nome");
                const hasQty = rowStr.includes("qtd") || rowStr.includes("quantidade") || rowStr.includes("estoque") || rowStr.includes("cantidad");
                if (hasProduct && hasQty) {
                    headerIdx = i;
                    break;
                }
            }
            const headers = (rawRows[headerIdx] || []).map((h: any) => String(h || "").trim());
            console.log(`[EXCEL_IMPORT] Found headers at row ${headerIdx}: ${headers.join(" | ")}`);

            // Build data rows as objects using detected headers
            const data: any[] = [];
            for (let i = headerIdx + 1; i < rawRows.length; i++) {
                const row = rawRows[i];
                if (!row || row.length === 0) continue;
                const obj: any = {};
                headers.forEach((h: string, idx: number) => {
                    if (h && row[idx] !== undefined && row[idx] !== null) obj[h] = row[idx];
                });
                if (Object.keys(obj).length > 1) data.push(obj); // skip rows with only 1 field (section headers)
            }
            console.log(`[EXCEL_IMPORT] ${data.length} data rows found after header row ${headerIdx}`);

            // Helper: clean numeric value (remove $, R$, spaces; handle comma as decimal)
            const parseNum = (val: any): number => {
                if (val === undefined || val === null) return 0;
                if (typeof val === "number") return val;
                const s = String(val).replace(/[R$\s]/g, "").trim();
                // If has both dot and comma: "1.234,56" → 1234.56
                if (s.includes(".") && s.includes(",")) return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
                // If only comma: "85,00" → 85.00
                if (s.includes(",") && !s.includes(".")) return parseFloat(s.replace(",", ".")) || 0;
                return parseFloat(s) || 0;
            };

            // Helper: normalize unit values
            const normalizeUnit = (u: string): string => {
                const map: Record<string, string> = { litro: "LT", litros: "LT", lt: "LT", l: "LT", kg: "KG", kilos: "KG", kilo: "KG", un: "UN", unidade: "UN", unidades: "UN" };
                return map[u.toLowerCase().trim()] || u.toUpperCase().trim() || "UN";
            };

            // Helper: parse date from various formats (dd/mm/yyyy, yyyy-mm-dd, Excel serial)
            const parseDate = (val: any): Date | null => {
                if (!val) return null;
                if (val instanceof Date) return val;
                if (typeof val === "number") {
                    // Excel serial date
                    const epoch = new Date(1899, 11, 30);
                    epoch.setDate(epoch.getDate() + val);
                    return epoch;
                }
                const s = String(val).trim();
                // dd/mm/yyyy
                const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
                if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
                // yyyy-mm-dd
                const ymd = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
                if (ymd) return new Date(parseInt(ymd[1]), parseInt(ymd[2]) - 1, parseInt(ymd[3]));
                const attempt = new Date(s);
                return isNaN(attempt.getTime()) ? null : attempt;
            };

            // Helper: detect package size from product name (e.g. "Cripton Supra x 5 Lt." → 5)
            const detectPackageSize = (name: string): number | null => {
                // Match patterns like "x 5 Lt", "x5Lt", "5 LT", "20LTS", "10KG"
                const match = name.match(/[x×]\s*(\d+(?:[.,]\d+)?)\s*(lt|lts|l|kg|ml)/i);
                if (match) return parseFloat(match[1].replace(",", "."));
                return null;
            };

            let imported = 0;
            for (const row of data) {
                // Match column names flexibly (exact match or partial/case-insensitive)
                const getCol = (row: any, ...keys: string[]) => {
                    for (const k of keys) {
                        if (row[k] !== undefined) return row[k];
                    }
                    for (const colName of Object.keys(row)) {
                        const lower = colName.toLowerCase().trim();
                        for (const k of keys) {
                            if (lower.includes(k.toLowerCase())) return row[colName];
                        }
                    }
                    return undefined;
                };

                // Product name (PT + ES)
                const name = String(getCol(row, "Produto", "produto", "Nome", "nome", "Name", "name", "Nombre Comercial", "Nombre", "nombre") || "").trim();
                // Quantity (PT + ES)
                const rawQty = parseNum(getCol(row, "Quantidade", "quantidade", "Qty", "qty", "Qtd", "qtd", "Qtd. Estoque", "Estoque", "Cantidad", "cantidad", "Cant"));
                // Total column — has the real total quantity (Cant × Embalagem already computed)
                const totalCol = parseNum(getCol(row, "Total", "total"));
                // Unit cost (PT + ES)
                const cost = parseNum(getCol(row, "Custo", "custo", "Cost", "cost", "Preco", "preco", "Preço", "Preço Unit", "Precio", "precio", "Unit. (USD)", "Preco Unit"));
                // Category (PT + ES) — "Clasificación de Agroquímicos"
                const cat = String(getCol(row, "Categoria", "categoria", "Category", "Clasificación", "clasificacion", "Clasificacion") || "Outros");
                // Unit (PT + ES)
                const rawUnit = String(getCol(row, "Unidade", "unidade", "Unit", "Unid", "Unid.", "Unidad", "unidad") || "UN");
                const unitVal = normalizeUnit(rawUnit);
                // Active Ingredient (PT + ES)
                const activeIngredient = String(getCol(row, "Princípio Ativo", "Principio Ativo", "principio_ativo", "Active Ingredient", "Principio Activo", "principio activo") || "");
                // Lote / Batch
                const lote = String(getCol(row, "Lote", "lote", "Batch", "batch") || "").trim() || null;
                // Expiry date / Vencimiento
                const expiryDate = parseDate(getCol(row, "Vencimiento", "vencimiento", "Validade", "validade", "Expiry", "expiry", "Vencimento", "vencimento"));
                // Package size from column (Embalage/Embalagem)
                const rawPackageSize = parseNum(getCol(row, "Embalage", "embalage", "Embalagem", "embalagem", "Embalaje", "embalaje"));

                if (!name || (rawQty <= 0 && totalCol <= 0)) continue;

                // Detect package size: from column or from product name pattern "x 5 Lt"
                const packageSizeFromName = detectPackageSize(name);
                const packageSize = rawPackageSize > 0 ? rawPackageSize : packageSizeFromName;

                // Use Total column if available (it already has the correct total quantity)
                // Otherwise fall back to rawQty (no multiplication — Total is the source of truth)
                let realQty: number;
                if (totalCol > 0) {
                    realQty = totalCol;
                    console.log(`[EXCEL_IMPORT] Using Total column: "${name}" total=${totalCol}`);
                } else {
                    realQty = rawQty;
                    console.log(`[EXCEL_IMPORT] No Total column, using raw qty: "${name}" qty=${rawQty}`);
                }

                // Find or create product
                const existing = await db.select().from(farmProductsCatalog)
                    .where(sql`LOWER(${farmProductsCatalog.name}) = LOWER(${name})`)
                    .limit(1);

                let productId: string;
                if (existing.length > 0) {
                    productId = existing[0].id;
                    // Update active_ingredient if provided and not yet set
                    if (activeIngredient && !existing[0].activeIngredient) {
                        await db.execute(sql`UPDATE farm_products_catalog SET active_ingredient = ${activeIngredient} WHERE id = ${productId}`);
                    }
                } else {
                    const [newProd] = await db.insert(farmProductsCatalog).values({
                        name: name.toUpperCase(),
                        activeIngredient: activeIngredient || null,
                        category: cat,
                        unit: unitVal,
                        status: "pending_review",
                        isDraft: true,
                    }).returning();
                    productId = newProd.id;
                }

                await farmStorage.upsertStock(farmerId, productId, realQty, cost, depositId);

                // Update lote, expiry_date, package_size on farm_stock
                if (lote || expiryDate || packageSize) {
                    await db.execute(sql`
                        UPDATE farm_stock SET
                            lote = COALESCE(${lote}, lote),
                            expiry_date = COALESCE(${expiryDate ? expiryDate.toISOString() : null}, expiry_date),
                            package_size = COALESCE(${packageSize ? String(packageSize) : null}, package_size)
                        WHERE farmer_id = ${farmerId} AND product_id = ${productId}
                    `);
                }

                await db.insert(farmStockMovements).values({
                    farmerId, productId, type: "entry", quantity: String(realQty),
                    unitCost: String(cost), referenceType: "excel_import",
                    lote: lote,
                    expiryDate: expiryDate,
                    packageSize: packageSize ? String(packageSize) : null,
                    notes: `Importacao via planilha Excel${totalCol > 0 ? ` (Total: ${totalCol})` : ''}`,
                });
                imported++;
            }

            res.json({ ok: true, imported, total: data.length });
        } catch (error: any) {
            console.error("[STOCK_IMPORT_EXCEL] ERROR:", error?.message || error);
            console.error("[STOCK_IMPORT_EXCEL] STACK:", error?.stack);
            res.status(500).json({ error: `Falha ao importar planilha: ${error?.message || 'Erro desconhecido'}` });
        }
    });

    // Update ONLY active_ingredient from spreadsheet — does NOT touch stock quantities
    router.post("/api/farm/stock/update-ingredients", upload.single("file"), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

            const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data: any[] = XLSX.utils.sheet_to_json(sheet);

            const getCol = (row: any, ...keys: string[]) => {
                for (const k of keys) {
                    if (row[k] !== undefined) return row[k];
                }
                for (const colName of Object.keys(row)) {
                    const lower = colName.toLowerCase().trim();
                    for (const k of keys) {
                        if (lower.includes(k.toLowerCase())) return row[colName];
                    }
                }
                return undefined;
            };

            let updated = 0;
            for (const row of data) {
                const name = String(getCol(row, "Produto", "produto", "Nome", "nome", "Name", "name", "Nombre Comercial", "Nombre", "nombre") || "").trim();
                const activeIngredient = String(getCol(row, "Princípio Ativo", "Principio Ativo", "principio_ativo", "Active Ingredient", "Principio Activo", "principio activo") || "").trim();

                if (!name || !activeIngredient) continue;

                const result = await db.execute(sql`
                    UPDATE farm_products_catalog
                    SET active_ingredient = ${activeIngredient}
                    WHERE LOWER(name) = LOWER(${name})
                      AND (active_ingredient IS NULL OR active_ingredient = '')
                `);
                const count = (result as any).rowCount ?? (result as any).count ?? 0;
                if (count > 0) updated++;
            }

            res.json({ ok: true, updated, total: data.length });
        } catch (error: any) {
            console.error("[UPDATE_INGREDIENTS] ERROR:", error?.message || error);
            res.status(500).json({ error: `Falha ao atualizar ingredientes: ${error?.message || 'Erro desconhecido'}` });
        }
    });
}
