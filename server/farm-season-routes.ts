import { Express } from "express";
import { requireFarmer, parseLocalDate } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmSeasonRoutes(app: Express) {
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
                crop: req.body.crop || null,
                startDate: parseLocalDate(req.body.startDate),
                endDate: parseLocalDate(req.body.endDate),
                paymentStartDate: parseLocalDate(req.body.paymentStartDate),
                paymentEndDate: parseLocalDate(req.body.paymentEndDate),
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
            if (req.body.crop !== undefined) data.crop = req.body.crop || null;
            if (req.body.startDate !== undefined) data.startDate = parseLocalDate(req.body.startDate);
            if (req.body.endDate !== undefined) data.endDate = parseLocalDate(req.body.endDate);
            if (req.body.paymentStartDate !== undefined) data.paymentStartDate = parseLocalDate(req.body.paymentStartDate);
            if (req.body.paymentEndDate !== undefined) data.paymentEndDate = parseLocalDate(req.body.paymentEndDate);
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
}
