/**
 * Field Notebook Routes — Automatic digital field diary from registered applications
 */

import type { Express } from "express";
import { db } from "./db";
import { farmApplications, farmProductsCatalog, farmPlots, farmProperties, farmSeasons, farmEquipment } from "../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export function registerFieldNotebookRoutes(app: Express) {
    const getFarmerId = (req: any) => {
        return req.session?.passport?.user?.toString() || req.user?.id?.toString();
    };

    // GET /api/farm/field-notebook — consolidated field notebook data
    app.get("/api/farm/field-notebook", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { seasonId } = req.query;

            // Get all applications for this farmer with related data
            const applications = await db.select({
                id: farmApplications.id,
                date: farmApplications.appliedAt,
                productName: farmProductsCatalog.name,
                productCategory: farmProductsCatalog.category,
                productUnit: farmProductsCatalog.unit,
                activeIngredient: farmProductsCatalog.activeIngredient,
                quantity: farmApplications.quantity,
                plotName: farmPlots.name,
                plotArea: farmPlots.areaHa,
                plotCrop: farmPlots.crop,
                propertyName: farmProperties.name,
                appliedBy: farmApplications.appliedBy,
                notes: farmApplications.notes,
                equipmentId: farmApplications.equipmentId,
            })
                .from(farmApplications)
                .leftJoin(farmProductsCatalog, eq(farmApplications.productId, farmProductsCatalog.id))
                .leftJoin(farmPlots, eq(farmApplications.plotId, farmPlots.id))
                .leftJoin(farmProperties, eq(farmApplications.propertyId, farmProperties.id))
                .where(eq(farmApplications.farmerId, farmerId))
                .orderBy(desc(farmApplications.appliedAt));

            // Filter by season dates if provided
            let filteredApps = applications;
            if (seasonId) {
                const season = await db.select().from(farmSeasons).where(eq(farmSeasons.id, seasonId as string));
                if (season.length > 0 && season[0].startDate && season[0].endDate) {
                    const start = new Date(season[0].startDate);
                    const end = new Date(season[0].endDate);
                    filteredApps = applications.filter((a: any) => {
                        if (!a.date) return false;
                        const d = new Date(a.date);
                        return d >= start && d <= end;
                    });
                }
            }

            // Build summary stats
            const uniqueProducts = new Set(filteredApps.map((a: any) => a.productName).filter(Boolean));
            const uniquePlots = new Set(filteredApps.map((a: any) => a.plotName).filter(Boolean));
            const dateRange = {
                from: filteredApps.length > 0 ? filteredApps[filteredApps.length - 1].date : null,
                to: filteredApps.length > 0 ? filteredApps[0].date : null,
            };

            // Get available seasons for the filter dropdown
            const seasons = await db.select().from(farmSeasons)
                .where(eq(farmSeasons.farmerId, farmerId))
                .orderBy(desc(farmSeasons.startDate));

            res.json({
                entries: filteredApps,
                summary: {
                    totalApplications: filteredApps.length,
                    uniqueProducts: uniqueProducts.size,
                    uniquePlots: uniquePlots.size,
                    dateRange,
                },
                seasons,
            });
        } catch (error) {
            console.error("[FIELD-NOTEBOOK] Error:", error);
            res.status(500).json({ error: "Failed to load field notebook" });
        }
    });
}
