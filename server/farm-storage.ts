import { db, dbReady } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
    users, farmProperties, farmPlots, farmEquipment, farmProductsCatalog,
    farmStock, farmInvoices, farmInvoiceItems, farmStockMovements,
    farmApplications, farmExpenses, farmPdvTerminals, farmSeasons,
    type InsertUser, type User,
    type InsertFarmProperty, type FarmProperty,
    type InsertFarmPlot, type FarmPlot,
    type InsertFarmEquipment, type FarmEquipment,
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
    async getStock(farmerId: string): Promise<(FarmStock & { productName: string; productUnit: string; productCategory: string | null; productImageUrl: string | null; productDosePerHa: string | null })[]> {
        await dbReady;
        const result = await db.select({
            id: farmStock.id,
            farmerId: farmStock.farmerId,
            productId: farmStock.productId,
            quantity: farmStock.quantity,
            averageCost: farmStock.averageCost,
            updatedAt: farmStock.updatedAt,
            productName: farmProductsCatalog.name,
            productUnit: farmProductsCatalog.unit,
            productCategory: farmProductsCatalog.category,
            productImageUrl: farmProductsCatalog.imageUrl,
            productDosePerHa: farmProductsCatalog.dosePerHa,
        }).from(farmStock)
            .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
            .where(eq(farmStock.farmerId, farmerId))
            .orderBy(farmProductsCatalog.name);
        return result;
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

    async upsertStock(farmerId: string, productId: string, quantityChange: number, unitCost: number): Promise<FarmStock> {
        await dbReady;

        // Check existing stock
        const [existing] = await db.select().from(farmStock)
            .where(and(eq(farmStock.farmerId, farmerId), eq(farmStock.productId, productId)));

        if (existing) {
            const oldQty = parseFloat(existing.quantity);
            const oldCost = parseFloat(existing.averageCost);
            const newQty = oldQty + quantityChange;

            // Weighted average cost (only update on entry)
            let newAvgCost = oldCost;
            if (quantityChange > 0 && unitCost > 0) {
                newAvgCost = ((oldQty * oldCost) + (quantityChange * unitCost)) / newQty;
            }

            const [updated] = await db.update(farmStock)
                .set({
                    quantity: String(newQty),
                    averageCost: String(newAvgCost),
                    updatedAt: new Date(),
                })
                .where(eq(farmStock.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db.insert(farmStock)
                .values({
                    farmerId,
                    productId,
                    quantity: String(quantityChange),
                    averageCost: String(unitCost),
                })
                .returning();
            return created;
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

    // Confirm invoice: create stock entries + movements (unless skipStockEntry is set)
    async confirmInvoice(invoiceId: string, farmerId: string): Promise<void> {
        await dbReady;

        // Check if this invoice should skip stock entry
        const invoice = await this.getInvoiceById(invoiceId);
        const skipStock = invoice?.skipStockEntry === true;

        if (!skipStock) {
            const items = await this.getInvoiceItems(invoiceId);

            for (const item of items) {
                if (!item.productId) continue;

                const qty = parseFloat(item.quantity);
                const cost = parseFloat(item.unitPrice);

                // Update stock
                await this.upsertStock(farmerId, item.productId, qty, cost);

                // Record movement
                await db.insert(farmStockMovements).values({
                    farmerId,
                    productId: item.productId,
                    type: "entry",
                    quantity: String(qty),
                    unitCost: String(cost),
                    referenceType: "invoice",
                    referenceId: invoiceId,
                    notes: `Fatura item: ${item.productName}`,
                });
            }
            console.log(`[FARM_INVOICE_CONFIRM] Invoice ${invoiceId} confirmed WITH stock entry.`);
        } else {
            console.log(`[FARM_INVOICE_CONFIRM] Invoice ${invoiceId} confirmed WITHOUT stock entry (skip_stock_entry=true).`);
        }

        await this.updateInvoiceStatus(invoiceId, "confirmed");
    }

    // ==================== Stock Movements ====================
    async getStockMovements(farmerId: string, limit = 50): Promise<(FarmStockMovement & { productName: string })[]> {
        await dbReady;
        const result = await db.select({
            id: farmStockMovements.id,
            farmerId: farmStockMovements.farmerId,
            productId: farmStockMovements.productId,
            type: farmStockMovements.type,
            quantity: farmStockMovements.quantity,
            unitCost: farmStockMovements.unitCost,
            referenceType: farmStockMovements.referenceType,
            referenceId: farmStockMovements.referenceId,
            notes: farmStockMovements.notes,
            createdAt: farmStockMovements.createdAt,
            productName: farmProductsCatalog.name,
        }).from(farmStockMovements)
            .innerJoin(farmProductsCatalog, eq(farmStockMovements.productId, farmProductsCatalog.id))
            .where(eq(farmStockMovements.farmerId, farmerId))
            .orderBy(desc(farmStockMovements.createdAt))
            .limit(limit);
        return result;
    }

    // ==================== Applications (PDV) ====================
    async createApplication(data: InsertFarmApplication): Promise<FarmApplication> {
        await dbReady;
        // 1. Create application record
        const [app] = await db.insert(farmApplications).values(data).returning();

        // 2. Subtract from stock
        const qty = parseFloat(data.quantity);
        await this.upsertStock(data.farmerId, data.productId, -qty, 0);

        // 3. Record stock movement (fetch plot or equipment name for notes)
        let noteStr = "";

        if (data.plotId) {
            const [plot] = await db.select().from(farmPlots).where(eq(farmPlots.id, data.plotId));
            noteStr = `Aplicação talhão: ${plot?.name || data.plotId}`;
        } else if (data.equipmentId) {
            const [equip] = await db.select().from(farmEquipment).where(eq(farmEquipment.id, data.equipmentId));
            noteStr = `Abastecimento: ${equip?.name || data.equipmentId}`;
        } else {
            noteStr = `Saída genérica`;
        }

        await db.insert(farmStockMovements).values({
            farmerId: data.farmerId,
            productId: data.productId,
            type: "exit",
            quantity: String(-qty),
            referenceType: "pdv",
            referenceId: app.id,
            notes: noteStr,
        });

        return app;
    }

    async getApplications(farmerId: string, plotId?: string): Promise<(FarmApplication & { productName: string; plotName: string | null; propertyName: string })[]> {
        await dbReady;
        let query = db.select({
            id: farmApplications.id,
            farmerId: farmApplications.farmerId,
            productId: farmApplications.productId,
            plotId: farmApplications.plotId,
            propertyId: farmApplications.propertyId,
            quantity: farmApplications.quantity,
            appliedAt: farmApplications.appliedAt,
            appliedBy: farmApplications.appliedBy,
            notes: farmApplications.notes,
            syncedFromOffline: farmApplications.syncedFromOffline,
            createdAt: farmApplications.createdAt,
            productName: farmProductsCatalog.name,
            plotName: farmPlots.name,
            propertyName: farmProperties.name,
        }).from(farmApplications)
            .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
            .innerJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
            .innerJoin(farmProperties, eq(farmApplications.propertyId, farmProperties.id))
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
