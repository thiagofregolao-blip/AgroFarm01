import { db, dbReady } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
    farmFarmers, farmProperties, farmPlots, farmProductsCatalog,
    farmStock, farmInvoices, farmInvoiceItems, farmStockMovements,
    farmApplications, farmExpenses, farmPdvTerminals,
    type InsertFarmFarmer, type FarmFarmer,
    type InsertFarmProperty, type FarmProperty,
    type InsertFarmPlot, type FarmPlot,
    type InsertFarmProductCatalog, type FarmProductCatalog,
    type InsertFarmStock, type FarmStock,
    type InsertFarmInvoice, type FarmInvoice,
    type InsertFarmInvoiceItem, type FarmInvoiceItem,
    type InsertFarmStockMovement, type FarmStockMovement,
    type InsertFarmApplication, type FarmApplication,
    type InsertFarmExpense, type FarmExpense,
    type InsertFarmPdvTerminal, type FarmPdvTerminal,
} from "../shared/schema";

// ============================================================================
// FARM STORAGE — Camada de persistência do sistema de fazenda
// ============================================================================

export class FarmStorage {
    // ==================== Farmers ====================
    async getFarmerById(id: string): Promise<FarmFarmer | undefined> {
        await dbReady;
        const [farmer] = await db.select().from(farmFarmers).where(eq(farmFarmers.id, id));
        return farmer;
    }

    async getFarmerByUsername(username: string): Promise<FarmFarmer | undefined> {
        await dbReady;
        const [farmer] = await db.select().from(farmFarmers).where(eq(farmFarmers.username, username));
        return farmer;
    }

    async createFarmer(data: InsertFarmFarmer): Promise<FarmFarmer> {
        await dbReady;
        const [farmer] = await db.insert(farmFarmers).values(data).returning();
        return farmer;
    }

    async updateFarmer(id: string, data: Partial<InsertFarmFarmer>): Promise<FarmFarmer> {
        await dbReady;
        const [farmer] = await db.update(farmFarmers).set(data).where(eq(farmFarmers.id, id)).returning();
        return farmer;
    }

    async getAllFarmers(): Promise<FarmFarmer[]> {
        await dbReady;
        return db.select().from(farmFarmers).orderBy(farmFarmers.name);
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
        await db.delete(farmProductsCatalog).where(eq(farmProductsCatalog.id, id));
    }

    // ==================== Stock ====================
    async getStock(farmerId: string): Promise<(FarmStock & { productName: string; productUnit: string; productCategory: string | null })[]> {
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
        }).from(farmStock)
            .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
            .where(eq(farmStock.farmerId, farmerId))
            .orderBy(farmProductsCatalog.name);
        return result;
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

    async getInvoiceItems(invoiceId: string): Promise<FarmInvoiceItem[]> {
        await dbReady;
        return db.select().from(farmInvoiceItems).where(eq(farmInvoiceItems.invoiceId, invoiceId));
    }

    async createInvoiceItems(items: InsertFarmInvoiceItem[]): Promise<FarmInvoiceItem[]> {
        await dbReady;
        return db.insert(farmInvoiceItems).values(items).returning();
    }

    // Confirm invoice: create stock entries + movements
    async confirmInvoice(invoiceId: string, farmerId: string): Promise<void> {
        await dbReady;
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

        // 3. Record stock movement
        await db.insert(farmStockMovements).values({
            farmerId: data.farmerId,
            productId: data.productId,
            type: "exit",
            quantity: String(-qty),
            referenceType: "pdv",
            referenceId: app.id,
            notes: `Aplicação talhão: ${data.plotId}`,
        });

        return app;
    }

    async getApplications(farmerId: string, plotId?: string): Promise<(FarmApplication & { productName: string; plotName: string; propertyName: string })[]> {
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
}

export const farmStorage = new FarmStorage();
