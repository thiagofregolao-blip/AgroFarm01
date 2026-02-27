/**
 * Report Routes — Generic endpoint for farm reports
 * GET /api/farm/reports/:type
 */
import { Express, Request, Response, NextFunction } from "express";
import { db, dbReady } from "./db";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import {
    farmStock, farmProductsCatalog, farmStockMovements,
    farmExpenses, farmInvoices, farmInvoiceItems,
    farmApplications, farmPlots, farmProperties,
    farmEquipment, farmPriceHistory, farmSeasons,
} from "../shared/schema";

// Middleware: require authenticated farmer
function requireFarmer(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Auth required" });
    }
    const role = (req.user as any)?.role;
    if (role !== "agricultor" && role !== "administrador") {
        return res.status(403).json({ error: "Acesso restrito" });
    }
    next();
}

export function registerReportRoutes(app: Express) {

    app.get("/api/farm/reports/:type", requireFarmer, async (req, res) => {
        await dbReady;
        const farmerId = (req.user as any).id;
        const type = req.params.type;
        const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
        const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

        try {
            switch (type) {
                case "stock": {
                    const data = await db.select({
                        id: farmStock.id,
                        productName: farmProductsCatalog.name,
                        category: farmProductsCatalog.category,
                        unit: farmProductsCatalog.unit,
                        quantity: farmStock.quantity,
                        averageCost: farmStock.averageCost,
                    }).from(farmStock)
                        .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
                        .where(eq(farmStock.farmerId, farmerId))
                        .orderBy(farmProductsCatalog.name);
                    return res.json(data);
                }

                case "movements": {
                    const conditions = [eq(farmStockMovements.farmerId, farmerId)];
                    if (startDate) conditions.push(gte(farmStockMovements.createdAt, startDate));
                    if (endDate) conditions.push(lte(farmStockMovements.createdAt, endDate));

                    const data = await db.select({
                        id: farmStockMovements.id,
                        productName: farmProductsCatalog.name,
                        type: farmStockMovements.type,
                        quantity: farmStockMovements.quantity,
                        unitCost: farmStockMovements.unitCost,
                        referenceType: farmStockMovements.referenceType,
                        notes: farmStockMovements.notes,
                        createdAt: farmStockMovements.createdAt,
                    }).from(farmStockMovements)
                        .innerJoin(farmProductsCatalog, eq(farmStockMovements.productId, farmProductsCatalog.id))
                        .where(and(...conditions))
                        .orderBy(desc(farmStockMovements.createdAt))
                        .limit(500);
                    return res.json(data);
                }

                case "expenses": {
                    const conditions = [eq(farmExpenses.farmerId, farmerId)];
                    if (startDate) conditions.push(gte(farmExpenses.expenseDate, startDate));
                    if (endDate) conditions.push(lte(farmExpenses.expenseDate, endDate));

                    const data = await db.select().from(farmExpenses)
                        .where(and(...conditions))
                        .orderBy(desc(farmExpenses.expenseDate))
                        .limit(500);
                    return res.json(data);
                }

                case "invoices": {
                    const conditions = [eq(farmInvoices.farmerId, farmerId)];
                    if (startDate) conditions.push(gte(farmInvoices.createdAt, startDate));
                    if (endDate) conditions.push(lte(farmInvoices.createdAt, endDate));

                    const invoices = await db.select().from(farmInvoices)
                        .where(and(...conditions))
                        .orderBy(desc(farmInvoices.createdAt))
                        .limit(200);

                    // Get item counts per invoice
                    const result = [];
                    for (const inv of invoices) {
                        const items = await db.select().from(farmInvoiceItems)
                            .where(eq(farmInvoiceItems.invoiceId, inv.id));
                        result.push({ ...inv, itemCount: items.length });
                    }
                    return res.json(result);
                }

                case "cost-per-ha": {
                    // Get all properties + plots + application costs
                    const properties = await db.select().from(farmProperties)
                        .where(eq(farmProperties.farmerId, farmerId));

                    const result = [];
                    for (const prop of properties) {
                        const plots = await db.select().from(farmPlots)
                            .where(eq(farmPlots.propertyId, prop.id));

                        for (const plot of plots) {
                            const conditions = [
                                eq(farmApplications.farmerId, farmerId),
                                eq(farmApplications.plotId, plot.id),
                            ];
                            if (startDate) conditions.push(gte(farmApplications.appliedAt, startDate));
                            if (endDate) conditions.push(lte(farmApplications.appliedAt, endDate));

                            const apps = await db.select({
                                quantity: farmApplications.quantity,
                                productName: farmProductsCatalog.name,
                                averageCost: farmStock.averageCost,
                            }).from(farmApplications)
                                .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
                                .leftJoin(farmStock, and(
                                    eq(farmStock.productId, farmApplications.productId),
                                    eq(farmStock.farmerId, farmerId)
                                ))
                                .where(and(...conditions));

                            let totalCost = 0;
                            apps.forEach((a: any) => {
                                totalCost += parseFloat(a.quantity) * parseFloat(a.averageCost || "0");
                            });
                            const areaHa = parseFloat(plot.areaHa) || 1;

                            result.push({
                                propertyName: prop.name,
                                plotName: plot.name,
                                areaHa: plot.areaHa,
                                crop: plot.crop,
                                totalCost: totalCost.toFixed(2),
                                costPerHa: (totalCost / areaHa).toFixed(2),
                                applicationCount: apps.length,
                            });
                        }
                    }
                    return res.json(result);
                }

                case "price-history": {
                    const conditions = [eq(farmPriceHistory.farmerId, farmerId)];
                    if (startDate) conditions.push(gte(farmPriceHistory.purchaseDate, startDate));
                    if (endDate) conditions.push(lte(farmPriceHistory.purchaseDate, endDate));

                    const data = await db.select().from(farmPriceHistory)
                        .where(and(...conditions))
                        .orderBy(desc(farmPriceHistory.purchaseDate))
                        .limit(500);
                    return res.json(data);
                }

                case "applications": {
                    const conditions = [eq(farmApplications.farmerId, farmerId)];
                    if (startDate) conditions.push(gte(farmApplications.appliedAt, startDate));
                    if (endDate) conditions.push(lte(farmApplications.appliedAt, endDate));

                    const data = await db.select({
                        id: farmApplications.id,
                        productName: farmProductsCatalog.name,
                        plotName: farmPlots.name,
                        propertyName: farmProperties.name,
                        equipmentName: farmEquipment.name,
                        quantity: farmApplications.quantity,
                        appliedAt: farmApplications.appliedAt,
                        appliedBy: farmApplications.appliedBy,
                        notes: farmApplications.notes,
                        horimeter: farmApplications.horimeter,
                        odometer: farmApplications.odometer,
                    }).from(farmApplications)
                        .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
                        .leftJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
                        .leftJoin(farmProperties, eq(farmApplications.propertyId, farmProperties.id))
                        .leftJoin(farmEquipment, eq(farmApplications.equipmentId, farmEquipment.id))
                        .where(and(...conditions))
                        .orderBy(desc(farmApplications.appliedAt))
                        .limit(500);
                    return res.json(data);
                }

                case "fleet": {
                    // Get fuel/diesel applications (applications linked to equipment)
                    const conditions = [eq(farmApplications.farmerId, farmerId)];
                    if (startDate) conditions.push(gte(farmApplications.appliedAt, startDate));
                    if (endDate) conditions.push(lte(farmApplications.appliedAt, endDate));

                    const data = await db.select({
                        id: farmApplications.id,
                        equipmentName: farmEquipment.name,
                        equipmentType: farmEquipment.type,
                        productName: farmProductsCatalog.name,
                        quantity: farmApplications.quantity,
                        appliedAt: farmApplications.appliedAt,
                        appliedBy: farmApplications.appliedBy,
                        horimeter: farmApplications.horimeter,
                        odometer: farmApplications.odometer,
                        notes: farmApplications.notes,
                    }).from(farmApplications)
                        .innerJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
                        .innerJoin(farmEquipment, eq(farmApplications.equipmentId, farmEquipment.id))
                        .where(and(...conditions))
                        .orderBy(desc(farmApplications.appliedAt))
                        .limit(500);
                    return res.json(data);
                }

                case "season-summary": {
                    // Build consolidated season data
                    const seasons = await db.select().from(farmSeasons)
                        .where(eq(farmSeasons.farmerId, farmerId))
                        .orderBy(desc(farmSeasons.createdAt));

                    // Get totals
                    const stockData = await db.select({
                        totalValue: sql<string>`SUM(CAST(${farmStock.quantity} AS numeric) * CAST(${farmStock.averageCost} AS numeric))`,
                        itemCount: sql<number>`COUNT(*)`,
                    }).from(farmStock)
                        .where(eq(farmStock.farmerId, farmerId));

                    const expenseData = await db.select({
                        totalExpenses: sql<string>`COALESCE(SUM(CAST(${farmExpenses.amount} AS numeric)), 0)`,
                        expenseCount: sql<number>`COUNT(*)`,
                    }).from(farmExpenses)
                        .where(eq(farmExpenses.farmerId, farmerId));

                    const invoiceData = await db.select({
                        totalInvoices: sql<string>`COALESCE(SUM(CAST(${farmInvoices.totalAmount} AS numeric)), 0)`,
                        invoiceCount: sql<number>`COUNT(*)`,
                        confirmedCount: sql<number>`SUM(CASE WHEN ${farmInvoices.status} = 'confirmed' THEN 1 ELSE 0 END)`,
                    }).from(farmInvoices)
                        .where(eq(farmInvoices.farmerId, farmerId));

                    const plotData = await db.select({
                        totalArea: sql<string>`COALESCE(SUM(CAST(${farmPlots.areaHa} AS numeric)), 0)`,
                        plotCount: sql<number>`COUNT(*)`,
                    }).from(farmPlots)
                        .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
                        .where(eq(farmProperties.farmerId, farmerId));

                    const applicationData = await db.select({
                        appCount: sql<number>`COUNT(*)`,
                    }).from(farmApplications)
                        .where(eq(farmApplications.farmerId, farmerId));

                    return res.json({
                        seasons,
                        stockValue: parseFloat(stockData[0]?.totalValue || "0").toFixed(2),
                        stockItems: stockData[0]?.itemCount || 0,
                        totalExpenses: parseFloat(expenseData[0]?.totalExpenses || "0").toFixed(2),
                        expenseCount: expenseData[0]?.expenseCount || 0,
                        totalInvoices: parseFloat(invoiceData[0]?.totalInvoices || "0").toFixed(2),
                        invoiceCount: invoiceData[0]?.invoiceCount || 0,
                        confirmedInvoices: invoiceData[0]?.confirmedCount || 0,
                        totalArea: parseFloat(plotData[0]?.totalArea || "0").toFixed(2),
                        plotCount: plotData[0]?.plotCount || 0,
                        applicationCount: applicationData[0]?.appCount || 0,
                    });
                }

                default:
                    return res.status(400).json({ error: `Unknown report type: ${type}` });
            }
        } catch (error) {
            console.error(`[REPORT_${type?.toUpperCase()}]`, error);
            res.status(500).json({ error: "Failed to generate report" });
        }
    });
}
