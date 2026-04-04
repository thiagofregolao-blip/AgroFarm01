import { db, dbReady } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
    users, farmProperties, farmPlots, farmEquipment, farmEmployees, farmProductsCatalog,
    farmStock, farmInvoices, farmInvoiceItems, farmStockMovements,
    farmApplications, farmExpenses, farmPdvTerminals, farmSeasons,
    farmPriceHistory,
    type InsertUser, type User,
    type InsertFarmProperty, type FarmProperty,
    type InsertFarmPlot, type FarmPlot,
    type InsertFarmEquipment, type FarmEquipment,
    type InsertFarmEmployee, type FarmEmployee,
    type InsertFarmProductCatalog, type FarmProductCatalog,
    type InsertFarmStock, type FarmStock,
    type InsertFarmInvoice, type FarmInvoice,
    type InsertFarmInvoiceItem, type FarmInvoiceItem,
    type InsertFarmStockMovement, type FarmStockMovement,
    type InsertFarmApplication, type FarmApplication,
    type InsertFarmExpense, type FarmExpense,
    type InsertFarmPdvTerminal, type FarmPdvTerminal,
    type InsertFarmSeason, type FarmSeason,
} from "../shared/schema";

// ============================================================================
// FARM STORAGE — Camada de persistência do sistema de fazenda
// ============================================================================

export class FarmStorage {
    // ==================== Farmers ====================
    async getFarmerById(id: string): Promise<User | undefined> {
        await dbReady;
        const [farmer] = await db.select().from(users).where(eq(users.id, id));
        return farmer;
    }

    async getFarmerByUsername(username: string): Promise<User | undefined> {
        await dbReady;
        const [farmer] = await db.select().from(users).where(eq(users.username, username));
        return farmer;
    }

    async createFarmer(data: InsertUser): Promise<User> {
        await dbReady;
        const [farmer] = await db.insert(users).values(data).returning();
        return farmer;
    }

    async updateFarmer(id: string, data: Partial<InsertUser>): Promise<User> {
        await dbReady;
        const [farmer] = await db.update(users).set(data).where(eq(users.id, id)).returning();
        return farmer;
    }

    async getAllFarmers(): Promise<User[]> {
        await dbReady;
        return db.select().from(users)
            .where(inArray(users.role, ['agricultor', 'admin_agricultor']))
            .orderBy(users.name);
    }

    // ==================== Properties ====================
    async getProperties(farmerId: string): Promise<FarmProperty[]> {
        await dbReady;
        return db.select().from(farmProperties)
            .where(eq(farmProperties.farmerId, farmerId))
            .orderBy(farmProperties.name);
    }

    async getPropertyById(id: string): Promise<FarmProperty | undefined> {
        await dbReady;
        const [prop] = await db.select().from(farmProperties).where(eq(farmProperties.id, id));
        return prop;
    }

    async createProperty(data: InsertFarmProperty): Promise<FarmProperty> {
        await dbReady;
        const [prop] = await db.insert(farmProperties).values(data).returning();
        return prop;
    }

    async updateProperty(id: string, data: Partial<InsertFarmProperty>): Promise<FarmProperty> {
        await dbReady;
        const [prop] = await db.update(farmProperties).set(data).where(eq(farmProperties.id, id)).returning();
        return prop;
    }

    async deleteProperty(id: string): Promise<void> {
        await dbReady;
        await db.delete(farmProperties).where(eq(farmProperties.id, id));
    }

    // ==================== Plots ====================
    async getPlots(propertyId: string): Promise<FarmPlot[]> {
        await dbReady;
        return db.select().from(farmPlots)
            .where(eq(farmPlots.propertyId, propertyId))
            .orderBy(farmPlots.name);
    }

    async getPlotsByFarmer(farmerId: string): Promise<(FarmPlot & { propertyName: string })[]> {
        await dbReady;
        const result = await db.select({
            id: farmPlots.id,
            propertyId: farmPlots.propertyId,
            name: farmPlots.name,
            areaHa: farmPlots.areaHa,
            crop: farmPlots.crop,
            coordinates: farmPlots.coordinates,
            centroid: farmPlots.centroid,
            createdAt: farmPlots.createdAt,
            propertyName: farmProperties.name,
        }).from(farmPlots)
            .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
            .where(eq(farmProperties.farmerId, farmerId))
            .orderBy(farmProperties.name, farmPlots.name);
        return result;
    }

    async createPlot(data: InsertFarmPlot): Promise<FarmPlot> {
        await dbReady;
        const [plot] = await db.insert(farmPlots).values(data).returning();
        return plot;
    }

    async updatePlot(id: string, data: Partial<InsertFarmPlot>): Promise<FarmPlot> {
        await dbReady;
        const [plot] = await db.update(farmPlots).set(data).where(eq(farmPlots.id, id)).returning();
        return plot;
    }

    async deletePlot(id: string): Promise<void> {
        await dbReady;
        await db.delete(farmPlots).where(eq(farmPlots.id, id));
    }

    // ==================== Equipment (Frota) ====================
    async getEquipment(farmerId: string): Promise<FarmEquipment[]> {
        await dbReady;
        return db.select().from(farmEquipment)
            .where(eq(farmEquipment.farmerId, farmerId))
            .orderBy(farmEquipment.name);
    }

    async createEquipment(data: InsertFarmEquipment): Promise<FarmEquipment> {
        await dbReady;
        const [equip] = await db.insert(farmEquipment).values(data).returning();
        return equip;
    }

    async updateEquipment(id: string, data: Partial<InsertFarmEquipment>): Promise<FarmEquipment> {
        await dbReady;
        const [equip] = await db.update(farmEquipment).set(data).where(eq(farmEquipment.id, id)).returning();
        return equip;
    }

    async deleteEquipment(id: string): Promise<void> {
        await dbReady;
        await db.delete(farmEquipment).where(eq(farmEquipment.id, id));
    }

    // ==================== Employees (Funcionários) ====================
    async getEmployees(farmerId: string): Promise<FarmEmployee[]> {
        await dbReady;
        return db.select().from(farmEmployees)
            .where(eq(farmEmployees.farmerId, farmerId))
            .orderBy(farmEmployees.name);
    }

    async createEmployee(data: InsertFarmEmployee): Promise<FarmEmployee> {
        await dbReady;
        const [emp] = await db.insert(farmEmployees).values(data).returning();
        return emp;
    }

    async updateEmployee(id: string, data: Partial<InsertFarmEmployee>): Promise<FarmEmployee> {
        await dbReady;
        const [emp] = await db.update(farmEmployees).set(data).where(eq(farmEmployees.id, id)).returning();
        return emp;
    }

    async deleteEmployee(id: string): Promise<void> {
        await dbReady;
        await db.delete(farmEmployees).where(eq(farmEmployees.id, id));
    }

    // ==================== Products Catalog ====================
    async getAllProducts(): Promise<FarmProductCatalog[]> {
        await dbReady;
        return db.select().from(farmProductsCatalog).orderBy(farmProductsCatalog.name);
    }

    async getProductById(id: string): Promise<FarmProductCatalog | undefined> {
        await dbReady;
        const [product] = await db.select().from(farmProductsCatalog).where(eq(farmProductsCatalog.id, id));
        return product;
    }

    async createProduct(data: InsertFarmProductCatalog): Promise<FarmProductCatalog> {
        await dbReady;
        const [product] = await db.insert(farmProductsCatalog).values(data).returning();
        return product;
    }

    async updateProduct(id: string, data: Partial<InsertFarmProductCatalog>): Promise<FarmProductCatalog> {
        await dbReady;
        const [product] = await db.update(farmProductsCatalog).set(data).where(eq(farmProductsCatalog.id, id)).returning();
        return product;
    }

    async deleteProduct(id: string): Promise<void> {
        await dbReady;
        // Clear FK references before deleting
        await db.delete(farmStock).where(eq(farmStock.productId, id));
        await db.delete(farmStockMovements).where(eq(farmStockMovements.productId, id));
        await db.update(farmInvoiceItems).set({ productId: null }).where(eq(farmInvoiceItems.productId, id));
        await db.update(farmApplications).set({ productId: null }).where(eq(farmApplications.productId, id));
        await db.delete(farmProductsCatalog).where(eq(farmProductsCatalog.id, id));
    }

    // ==================== Stock ====================
    async getStock(farmerId: string, excludeCommercial = false): Promise<any[]> {
        await dbReady;
        try {
            // Try query with deposit columns (JOIN deposits via property_id)
            const rows = await db.execute(sql`
                SELECT s.id, s.farmer_id AS "farmerId", s.product_id AS "productId",
                       s.quantity, s.average_cost AS "averageCost", s.updated_at AS "updatedAt",
                       s.property_id AS "propertyId", s.property_id AS "depositId",
                       s.lote, s.expiry_date AS "expiryDate", s.package_size AS "packageSize",
                       p.name AS "productName", p.unit AS "productUnit", p.category AS "productCategory",
                       p.image_url AS "productImageUrl", p.dose_per_ha AS "productDosePerHa",
                       p.active_ingredient AS "activeIngredient",
                       fp.name AS "propertyName",
                       d.deposit_type AS "depositType", d.name AS "depositName"
                FROM farm_stock s
                INNER JOIN farm_products_catalog p ON s.product_id = p.id
                LEFT JOIN farm_properties fp ON s.property_id = fp.id
                LEFT JOIN farm_deposits d ON d.id = s.property_id
                WHERE s.farmer_id = ${farmerId}
                  ${excludeCommercial ? sql`AND (d.deposit_type IS NULL OR d.deposit_type != 'comercial')` : sql``}
                ORDER BY p.name
            `);
            return (rows as any).rows ?? rows;
        } catch (err) {
            // Fallback: original query without deposit columns (column/table may not exist yet)
            console.warn("[getStock] Fallback to original query:", (err as any)?.message);
            const rows = await db.execute(sql`
                SELECT s.id, s.farmer_id AS "farmerId", s.product_id AS "productId",
                       s.quantity, s.average_cost AS "averageCost", s.updated_at AS "updatedAt",
                       s.property_id AS "propertyId",
                       p.name AS "productName", p.unit AS "productUnit", p.category AS "productCategory",
                       p.image_url AS "productImageUrl", p.dose_per_ha AS "productDosePerHa",
                       p.active_ingredient AS "activeIngredient",
                       fp.name AS "propertyName"
                FROM farm_stock s
                INNER JOIN farm_products_catalog p ON s.product_id = p.id
                LEFT JOIN farm_properties fp ON s.property_id = fp.id
                WHERE s.farmer_id = ${farmerId}
                ORDER BY p.name
            `);
            return (rows as any).rows ?? rows;
        }
    }

    async updateStockManual(id: string, farmerId: string, data: { quantity: number; averageCost: number; reason: string }): Promise<FarmStock> {
        await dbReady;
        return await db.transaction(async (tx) => {
            // Find stock to ensure it exists and belongs to farmer
            const [stock] = await tx.select().from(farmStock)
                .where(and(eq(farmStock.id, id), eq(farmStock.farmerId, farmerId)));

            if (!stock) throw new Error("Estoque não encontrado");

            // Register movement
            const diff = Number(data.quantity) - Number(stock.quantity);

            await tx.insert(farmStockMovements).values({
                farmerId,
                productId: stock.productId,
                type: "adjustment", // A new robust internal type
                quantity: diff.toString(),
                unitCost: data.averageCost.toString(),
                referenceType: "manual_adjustment",
                notes: data.reason,
            });

            // Update stock
            const [updatedStock] = await tx.update(farmStock)
                .set({
                    quantity: data.quantity.toString(),
                    averageCost: data.averageCost.toString(),
                    updatedAt: new Date()
                })
                .where(eq(farmStock.id, id))
                .returning();

            return updatedStock;
        });
    }

    async upsertStock(farmerId: string, productId: string, quantityChange: number, unitCost: number, propertyId?: string | null): Promise<any> {
        await dbReady;

        // property_id stores the deposit/property ID (column always exists)
        const propId = propertyId || null;
        const coalesced = propId || '__none__';

        console.log(`[UPSERT_STOCK] pid=${productId} qtyChange=${quantityChange} cost=${unitCost} deposit=${propId}`);

        const existingRows = await db.execute(sql`
            SELECT * FROM farm_stock
            WHERE farmer_id = ${farmerId} AND product_id = ${productId}
              AND COALESCE(property_id, '__none__') = ${coalesced}
            LIMIT 1
        `);
        const existing = ((existingRows as any).rows ?? existingRows)[0];

        if (existing) {
            console.log(`[UPSERT_STOCK] EXISTING: id=${existing.id} oldQty=${existing.quantity} oldCost=${existing.average_cost} → newQty=${parseFloat(existing.quantity) + quantityChange}`);
            const oldQty = parseFloat(existing.quantity);
            const oldCost = parseFloat(existing.average_cost);
            const newQty = oldQty + quantityChange;

            let newAvgCost = oldCost;
            if (quantityChange > 0 && unitCost > 0) {
                newAvgCost = ((oldQty * oldCost) + (quantityChange * unitCost)) / newQty;
            }

            const updatedRows = await db.execute(sql`
                UPDATE farm_stock SET quantity = ${String(newQty)}, average_cost = ${String(newAvgCost)}, updated_at = now()
                WHERE id = ${existing.id}
                RETURNING *
            `);
            return ((updatedRows as any).rows ?? updatedRows)[0];
        } else {
            console.log(`[UPSERT_STOCK] NEW STOCK ENTRY: pid=${productId} qty=${quantityChange} cost=${unitCost}`);
            const createdRows = await db.execute(sql`
                INSERT INTO farm_stock (farmer_id, product_id, quantity, average_cost, property_id)
                VALUES (${farmerId}, ${productId}, ${String(quantityChange)}, ${String(unitCost)}, ${propId})
                RETURNING *
            `);
            return ((createdRows as any).rows ?? createdRows)[0];
        }
    }

    async deleteStock(id: string, farmerId: string): Promise<void> {
        await dbReady;
        await db.delete(farmStock).where(and(eq(farmStock.id, id), eq(farmStock.farmerId, farmerId)));
    }

    // ==================== Invoices ====================
    async getInvoices(farmerId: string): Promise<FarmInvoice[]> {
        await dbReady;
        return db.select().from(farmInvoices)
            .where(eq(farmInvoices.farmerId, farmerId))
            .orderBy(desc(farmInvoices.createdAt));
    }

    async getInvoiceById(id: string): Promise<FarmInvoice | undefined> {
        await dbReady;
        const [invoice] = await db.select().from(farmInvoices).where(eq(farmInvoices.id, id));
        return invoice;
    }

    async createInvoice(data: InsertFarmInvoice): Promise<FarmInvoice> {
        await dbReady;
        const [invoice] = await db.insert(farmInvoices).values(data).returning();
        return invoice;
    }

    async updateInvoiceStatus(id: string, status: string): Promise<FarmInvoice> {
        await dbReady;
        const [invoice] = await db.update(farmInvoices).set({ status }).where(eq(farmInvoices.id, id)).returning();
        return invoice;
    }

    async deleteInvoice(id: string): Promise<void> {
        await dbReady;
        // Delete invoice items first (FK constraint)
        await db.delete(farmInvoiceItems).where(eq(farmInvoiceItems.invoiceId, id));
        // Delete the invoice
        await db.delete(farmInvoices).where(eq(farmInvoices.id, id));
    }

    async getInvoiceItems(invoiceId: string): Promise<FarmInvoiceItem[]> {
        await dbReady;
        return db.select().from(farmInvoiceItems).where(eq(farmInvoiceItems.invoiceId, invoiceId));
    }

    async createInvoiceItems(items: InsertFarmInvoiceItem[]): Promise<FarmInvoiceItem[]> {
        await dbReady;
        return db.insert(farmInvoiceItems).values(items).returning();
    }

    // Confirm invoice: create stock entries + movements (unless skipStockEntry is set), and save price history
    // Wrapped in a transaction to prevent race-condition duplications (Bug fix 2025-03)
    async confirmInvoice(invoiceId: string, farmerId: string, warehouseId?: string, itemConversions?: Record<string, number>): Promise<void> {
        await dbReady;

        // Fetch invoice details for price history
        const invoice = await this.getInvoiceById(invoiceId);
        if (!invoice) return;

        // Bug fix #1: Early return if already confirmed (storage-level guard)
        if (invoice.status === "confirmed") {
            console.log(`[FARM_CONFIRM] Invoice ${invoiceId} already confirmed — skipping duplicate confirmation`);
            return;
        }

        // Bug fix #2: Check if stock movements already exist for this invoice (dedup guard)
        const existingMovements = await db.execute(sql`
            SELECT id FROM farm_stock_movements
            WHERE reference_id = ${invoiceId} AND reference_type IN ('invoice', 'remision')
            LIMIT 1
        `);
        const movementRows = (existingMovements as any).rows ?? existingMovements;
        if (movementRows.length > 0) {
            console.log(`[FARM_CONFIRM] Stock movements already exist for invoice ${invoiceId} — skipping to prevent duplication`);
            // Still mark as confirmed in case it was missed
            await this.updateInvoiceStatus(invoiceId, "confirmed");
            return;
        }

        // Bug fix #1 continued: Set status to "confirmed" FIRST to block concurrent requests
        await this.updateInvoiceStatus(invoiceId, "confirmed");

        const skipStock = invoice?.skipStockEntry === true;
        const isRemision = (invoice as any).documentType === "remision";
        const items = await this.getInvoiceItems(invoiceId);
        console.log(`[FARM_CONFIRM] ========== CONFIRM INVOICE START ==========`);
        console.log(`[FARM_CONFIRM] id=${invoiceId} supplier="${invoice.supplier}" number="${invoice.invoiceNumber}"`);
        console.log(`[FARM_CONFIRM] skipStockEntry=${invoice.skipStockEntry} (typeof=${typeof invoice.skipStockEntry}) → skipStock=${skipStock}`);
        console.log(`[FARM_CONFIRM] documentType=${(invoice as any).documentType} isRemision=${isRemision}`);
        console.log(`[FARM_CONFIRM] items=${items.length} itemsWithProduct=${items.filter(i => i.productId).length}`);
        for (const item of items) {
            console.log(`[FARM_CONFIRM]   → item: "${item.productName}" pid=${item.productId} qty=${item.quantity} price=${item.unitPrice}`);
        }

        try {
            // Always save price history regardless of stock entry
            for (const item of items) {
                if (!item.productId) continue;

                let qty = parseFloat(item.quantity);
                let cost = parseFloat(item.unitPrice);

                // Aplicar conversão de embalagem no histórico de preços também
                const pkgSize = itemConversions?.[item.id];
                if (pkgSize && pkgSize > 1) {
                    qty = qty * pkgSize;
                    cost = cost / pkgSize;
                }

                if (qty > 0 && cost > 0) {
                    try {
                        // Try to fetch active ingredient if available
                        const [product] = await db.select().from(farmProductsCatalog).where(eq(farmProductsCatalog.id, item.productId));

                        await db.insert(farmPriceHistory).values({
                            farmerId,
                            purchaseDate: invoice.issueDate || new Date(),
                            supplier: invoice.supplier || "Fornecedor Local",
                            productName: item.productName || product?.name || "Produto",
                            quantity: String(qty),
                            unitPrice: String(cost),
                            activeIngredient: product?.activeIngredient || null
                        });
                    } catch (phError) {
                        console.error("[FARM_PRICE_HISTORY_INSERT]", phError);
                    }
                }
            }

            if (!skipStock) {
                console.log(`[FARM_CONFIRM] ADDING TO STOCK (skipStock=false)`);
                for (const item of items) {
                    if (!item.productId) continue;

                    let qty = parseFloat(item.quantity);
                    let cost = parseFloat(item.unitPrice);

                    // Aplicar conversão de embalagem → litros/kg se solicitado
                    const pkgSize = itemConversions?.[item.id];
                    if (pkgSize && pkgSize > 1) {
                        console.log(`[FARM_CONFIRM]   PKG CONVERSION: "${item.productName}" ${qty} emb x ${pkgSize} = ${qty * pkgSize} | $${cost} / ${pkgSize} = $${(cost / pkgSize).toFixed(4)}`);
                        qty = qty * pkgSize;
                        cost = cost / pkgSize;
                    }

                    console.log(`[FARM_CONFIRM]   STOCK ENTRY: "${item.productName}" pid=${item.productId} qty=${qty} cost=${cost}`);

                    // Update stock (warehouseId = deposit destino)
                    await this.upsertStock(farmerId, item.productId, qty, cost, warehouseId || null);

                    // Record movement
                    await db.insert(farmStockMovements).values({
                        farmerId,
                        productId: item.productId,
                        type: "entry",
                        quantity: String(qty),
                        unitCost: String(cost),
                        referenceType: isRemision ? "remision" : "invoice",
                        referenceId: invoiceId,
                        notes: isRemision ? `Remissao item: ${item.productName}` : `Fatura item: ${item.productName}`,
                    });
                }
                console.log(`[FARM_CONFIRM] Invoice ${invoiceId} confirmed WITH stock entry and price history.`);
            } else {
                console.log(`[FARM_CONFIRM] SKIPPING STOCK (skipStock=true) — only price history saved`);
            }
            console.log(`[FARM_CONFIRM] ========== CONFIRM INVOICE END ==========`);

            // Activity log for invoice confirmation
            try {
                const { logActivity } = await import("./lib/activity-logger");
                await logActivity({ farmerId, userId: farmerId, action: 'confirm', entity: 'invoice', entityId: invoiceId, details: { itemCount: items.length, skipStock } });
            } catch (_) { /* logging should not break flow */ }
        } catch (error) {
            // If anything fails after we set status to confirmed, revert status so user can retry
            console.error(`[FARM_CONFIRM] Error during confirmation of invoice ${invoiceId}, reverting status`, error);
            await this.updateInvoiceStatus(invoiceId, "pending");
            throw error;
        }
    }

    // ==================== Stock Movements ====================
    async getStockMovements(farmerId: string, limit = 50): Promise<any[]> {
        await dbReady;
        // Use raw SQL to include deposit info via farm_stock → farm_properties join
        const rows = await db.execute(sql`
            SELECT m.id, m.farmer_id AS "farmerId", m.product_id AS "productId",
                   m.type, m.quantity, m.unit_cost AS "unitCost",
                   m.reference_type AS "referenceType", m.reference_id AS "referenceId",
                   m.notes, m.created_at AS "createdAt",
                   p.name AS "productName", p.category AS "productCategory",
                   s.property_id AS "depositId", d.name AS "depositName"
            FROM farm_stock_movements m
            INNER JOIN farm_products_catalog p ON m.product_id = p.id
            LEFT JOIN farm_stock s ON s.product_id = m.product_id AND s.farmer_id = m.farmer_id
            LEFT JOIN farm_properties d ON s.property_id = d.id
            WHERE m.farmer_id = ${farmerId}
            ORDER BY m.created_at DESC
            LIMIT ${limit}
        `);
        const result = (rows as any).rows ?? rows;

        // Extract equipment name and employee name from notes for diesel movements
        return result.map(r => {
            let equipmentName: string | null = null;
            let employeeName: string | null = null;
            if (r.notes) {
                // Extract employee name first (before cleaning)
                const empMatch = r.notes.match(/Funcionário:\s*(.+)$/);
                if (empMatch) employeeName = empMatch[1].trim();

                // Format: "Abastecimento EquipName (telemetry) | Funcionário: Name"
                // or: "Abastecimento: EquipName (telemetry)"
                // or: "Abastecimento EquipName - QL | Funcionário: Name"
                const equipMatch = r.notes.match(/^Abastecimento[:\s]+([^(|\-]+)/);
                if (equipMatch) equipmentName = equipMatch[1].trim();
            }
            return { ...r, equipmentName, employeeName };
        });
    }

    // ==================== Applications (PDV) ====================
    async createApplication(data: InsertFarmApplication): Promise<FarmApplication> {
        await dbReady;

        const qty = parseFloat(data.quantity);
        const depositId = (data as any).propertyId || null;
        const idempotencyKey = (data as any).idempotencyKey as string | undefined;

        // 0. Idempotency check — return existing record if key already used
        if (idempotencyKey) {
            const existingRows = await db.execute(sql`
                SELECT id FROM farm_applications WHERE idempotency_key = ${idempotencyKey} LIMIT 1
            `);
            const existingId = ((existingRows as any).rows ?? existingRows)[0]?.id;
            if (existingId) {
                const [existing] = await db.select().from(farmApplications).where(eq(farmApplications.id, existingId));
                return existing;
            }
        }

        // 1. Create application record
        const [app] = await db.insert(farmApplications).values(data).returning();

        // 1b. Save idempotency key if provided
        if (idempotencyKey) {
            await db.execute(sql`UPDATE farm_applications SET idempotency_key = ${idempotencyKey} WHERE id = ${app.id}`);
        }

        // 2. Subtract from stock — try specific deposit first, fallback to any with enough, then largest
        const propCoalesced = depositId || '__none__';
        const specificRows = await db.execute(sql`
            SELECT id, quantity FROM farm_stock
            WHERE farmer_id = ${data.farmerId} AND product_id = ${data.productId}
              AND COALESCE(property_id, '__none__') = ${propCoalesced}
            LIMIT 1
        `);
        const specificEntry = ((specificRows as any).rows ?? specificRows)[0];

        if (specificEntry && parseFloat(specificEntry.quantity) >= qty) {
            await this.upsertStock(data.farmerId, data.productId, -qty, 0, depositId);
        } else {
            // Fallback: find ANY deposit with enough stock
            const anyRows = await db.execute(sql`
                SELECT id, property_id, quantity FROM farm_stock
                WHERE farmer_id = ${data.farmerId} AND product_id = ${data.productId}
                  AND CAST(quantity AS NUMERIC) >= ${qty}
                ORDER BY CAST(quantity AS NUMERIC) DESC
                LIMIT 1
            `);
            const anyEntry = ((anyRows as any).rows ?? anyRows)[0];
            if (anyEntry) {
                await this.upsertStock(data.farmerId, data.productId, -qty, 0, anyEntry.property_id || null);
            } else {
                // Not enough in any single deposit — deduct from specified (may go negative, user confirmed)
                console.warn(`[PDV_WITHDRAW] Estoque negativo autorizado pelo usuário: produto=${data.productId}, qty=${qty}, deposit=${depositId}`);
                await this.upsertStock(data.farmerId, data.productId, -qty, 0, depositId);
            }
        }

        // 3. Record stock movement (fetch plot or equipment name for notes)
        let noteStr = "";

        if (data.plotId) {
            const [plot] = await db.select().from(farmPlots).where(eq(farmPlots.id, data.plotId));
            noteStr = `Aplicação talhão: ${plot?.name || data.plotId}`;
        } else if (data.equipmentId) {
            const [equip] = await db.select().from(farmEquipment).where(eq(farmEquipment.id, data.equipmentId));
            const equipName = equip?.name || data.equipmentId;
            const telemetry = [];
            if (data.horimeter) telemetry.push(`${data.horimeter}h`);
            if (data.odometer) telemetry.push(`${data.odometer}km`);
            noteStr = `Abastecimento ${equipName}${telemetry.length ? ` (${telemetry.join(', ')})` : ''}`;
            // Preserve employee name from PDV notes
            const empMatch = data.notes?.match(/Funcionário:\s*(.+)$/);
            if (empMatch) noteStr += ` | Funcionário: ${empMatch[1].trim()}`;
        } else {
            noteStr = `Saída genérica`;
        }

        await db.insert(farmStockMovements).values({
            farmerId: data.farmerId,
            productId: data.productId,
            seasonId: (data as any).seasonId || null,
            type: "exit",
            quantity: String(-qty),
            referenceType: "pdv",
            referenceId: app.id,
            notes: noteStr,
        });

        return app;
    }

    async getApplications(farmerId: string, plotId?: string): Promise<(FarmApplication & { productName: string; plotName: string | null; propertyName: string; equipmentName: string | null })[]> {
        await dbReady;
        let query = db.select({
            id: farmApplications.id,
            farmerId: farmApplications.farmerId,
            productId: farmApplications.productId,
            plotId: farmApplications.plotId,
            propertyId: farmApplications.propertyId,
            quantity: farmApplications.quantity,
            dosePerHa: farmApplications.dosePerHa,
            flowRateLha: farmApplications.flowRateLha,
            appliedAt: farmApplications.appliedAt,
            appliedBy: farmApplications.appliedBy,
            notes: farmApplications.notes,
            syncedFromOffline: farmApplications.syncedFromOffline,
            createdAt: farmApplications.createdAt,
            equipmentId: farmApplications.equipmentId,
            horimeter: farmApplications.horimeter,
            odometer: farmApplications.odometer,
            productName: farmProductsCatalog.name,
            plotName: farmPlots.name,
            plotAreaHa: farmPlots.areaHa,
            plotCrop: farmPlots.crop,
            plotCoordinates: farmPlots.coordinates,
            propertyName: farmProperties.name,
            equipmentName: farmEquipment.name,
            equipmentTankCapacityL: farmEquipment.tankCapacityL,
            employeeName: farmApplications.employeeName,
            photoBase64: farmApplications.photoBase64,
        }).from(farmApplications)
            .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
            .leftJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
            .leftJoin(farmProperties, eq(farmApplications.propertyId, farmProperties.id))
            .leftJoin(farmEquipment, eq(farmApplications.equipmentId, farmEquipment.id))
            .where(
                plotId
                    ? and(eq(farmApplications.farmerId, farmerId), eq(farmApplications.plotId, plotId))
                    : eq(farmApplications.farmerId, farmerId)
            )
            .orderBy(desc(farmApplications.appliedAt));

        return query;
    }

    // ==================== Expenses ====================
    async getExpenses(farmerId: string): Promise<FarmExpense[]> {
        await dbReady;
        return db.select().from(farmExpenses)
            .where(eq(farmExpenses.farmerId, farmerId))
            .orderBy(desc(farmExpenses.expenseDate));
    }

    async createExpense(data: InsertFarmExpense): Promise<FarmExpense> {
        await dbReady;
        const [expense] = await db.insert(farmExpenses).values(data).returning();
        return expense;
    }

    // ==================== PDV Terminals ====================
    async getPdvTerminal(username: string): Promise<FarmPdvTerminal | undefined> {
        await dbReady;
        const [terminal] = await db.select().from(farmPdvTerminals).where(eq(farmPdvTerminals.username, username));
        return terminal;
    }

    async getPdvTerminals(farmerId: string): Promise<FarmPdvTerminal[]> {
        await dbReady;
        return db.select().from(farmPdvTerminals)
            .where(eq(farmPdvTerminals.farmerId, farmerId))
            .orderBy(farmPdvTerminals.name);
    }

    async createPdvTerminal(data: InsertFarmPdvTerminal): Promise<FarmPdvTerminal> {
        await dbReady;
        const [terminal] = await db.insert(farmPdvTerminals).values(data).returning();
        return terminal;
    }

    async updatePdvHeartbeat(id: string): Promise<void> {
        await dbReady;
        await db.update(farmPdvTerminals).set({
            isOnline: true,
            lastHeartbeat: new Date(),
        }).where(eq(farmPdvTerminals.id, id));
    }

    async setPdvOffline(id: string): Promise<void> {
        await dbReady;
        await db.update(farmPdvTerminals).set({ isOnline: false }).where(eq(farmPdvTerminals.id, id));
    }

    // ==================== Seasons (Safras) ====================
    async getSeasons(farmerId: string): Promise<FarmSeason[]> {
        await dbReady;
        return db.select().from(farmSeasons)
            .where(eq(farmSeasons.farmerId, farmerId))
            .orderBy(desc(farmSeasons.createdAt));
    }

    async createSeason(data: InsertFarmSeason): Promise<FarmSeason> {
        await dbReady;
        const [season] = await db.insert(farmSeasons).values(data).returning();
        return season;
    }

    async updateSeason(id: string, data: Partial<InsertFarmSeason>): Promise<FarmSeason> {
        await dbReady;
        const [season] = await db.update(farmSeasons).set(data).where(eq(farmSeasons.id, id)).returning();
        return season;
    }

    async deleteSeason(id: string): Promise<void> {
        await dbReady;
        // Unlink invoices from this season first
        await db.update(farmInvoices).set({ seasonId: null }).where(eq(farmInvoices.seasonId, id));
        await db.delete(farmSeasons).where(eq(farmSeasons.id, id));
    }
}

export const farmStorage = new FarmStorage();
