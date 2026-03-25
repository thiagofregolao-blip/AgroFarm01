import { Express } from "express";
import { requireFarmer, parseLocalDate } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmSeasonRoutes(app: Express) {
    // ==================== Seasons (Safras) ====================
    app.get("/api/farm/seasons", requireFarmer, async (req, res) => {
        try {
            const seasons = await farmStorage.getSeasons(req.user!.id);
            res.json(seasons);
        } catch (error) {
            console.error("[FARM_SEASONS]", error);
            res.status(500).json({ error: "Failed to get seasons" });
        }
    });

    app.post("/api/farm/seasons", requireFarmer, async (req, res) => {
        try {
            const season = await farmStorage.createSeason({
                farmerId: req.user!.id,
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

    // GET /api/farm/seasons/:id/plots — todos os talhões do agricultor com % planejada para esta safra
    app.get("/api/farm/seasons/:id/plots", requireFarmer, async (req, res) => {
        try {
            const farmerId = req.user!.id;
            const seasonId = req.params.id;
            console.log(`[FARM_SEASONS_PLOTS] GET seasonId=${seasonId} farmerId=${farmerId}`);
            const seasons = await farmStorage.getSeasons(farmerId);
            if (!seasons.find((s: any) => s.id === seasonId)) {
                console.log(`[FARM_SEASONS_PLOTS] 403 — season not found for farmer`);
                return res.status(403).json({ error: "Forbidden" });
            }
            // Try with LEFT JOIN on farm_season_plots first; fallback without if table doesn't exist
            try {
                const result = await db.execute(sql`
                    SELECT
                        fp.id,
                        fp.name,
                        fp.area_ha AS "areaHa",
                        fp.crop,
                        fp.coordinates,
                        fp.property_id AS "propertyId",
                        fpr.name AS "propertyName",
                        COALESCE(fsp.area_percentage, 0) AS "areaPercentage"
                    FROM farm_plots fp
                    INNER JOIN farm_properties fpr ON fpr.id = fp.property_id
                    LEFT JOIN farm_season_plots fsp ON fsp.plot_id = fp.id AND fsp.season_id = ${seasonId}
                    WHERE fpr.farmer_id = ${farmerId}
                    ORDER BY fpr.name, fp.name
                `);
                const rows = Array.isArray(result) ? result : (result.rows || []);
                console.log(`[FARM_SEASONS_PLOTS] Returning ${rows.length} plots`);
                return res.json(rows);
            } catch (joinErr: any) {
                console.warn("[FARM_SEASONS_PLOTS] farm_season_plots join failed, falling back:", joinErr.message);
                const result = await db.execute(sql`
                    SELECT
                        fp.id,
                        fp.name,
                        fp.area_ha AS "areaHa",
                        fp.crop,
                        fp.coordinates,
                        fp.property_id AS "propertyId",
                        fpr.name AS "propertyName",
                        0 AS "areaPercentage"
                    FROM farm_plots fp
                    INNER JOIN farm_properties fpr ON fpr.id = fp.property_id
                    WHERE fpr.farmer_id = ${farmerId}
                    ORDER BY fpr.name, fp.name
                `);
                const rows = Array.isArray(result) ? result : (result.rows || []);
                return res.json(rows);
            }
        } catch (error) {
            console.error("[FARM_SEASONS_PLOTS GET]", error);
            res.status(500).json({ error: "Failed to get season plots" });
        }
    });

    // PUT /api/farm/seasons/:id/plots — salva % de cada talhão nesta safra
    app.put("/api/farm/seasons/:id/plots", requireFarmer, async (req, res) => {
        try {
            const farmerId = req.user!.id;
            const seasonId = req.params.id;
            const plots: Array<{ plotId: string; areaPercentage: number }> = req.body.plots || [];
            console.log(`[FARM_SEASONS_PLOTS PUT] seasonId=${seasonId} farmerId=${farmerId} plots=${plots.length}`);
            const seasons = await farmStorage.getSeasons(farmerId);
            if (!seasons.find((s: any) => s.id === seasonId)) {
                return res.status(403).json({ error: "Forbidden" });
            }
            // Ensure table exists
            await db.execute(sql`CREATE TABLE IF NOT EXISTS farm_season_plots (
                id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
                season_id varchar NOT NULL REFERENCES farm_seasons(id) ON DELETE CASCADE,
                plot_id varchar NOT NULL REFERENCES farm_plots(id) ON DELETE CASCADE,
                farmer_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                area_percentage numeric(5,2) NOT NULL DEFAULT 100,
                UNIQUE(season_id, plot_id)
            )`);
            await db.execute(sql`DELETE FROM farm_season_plots WHERE season_id = ${seasonId} AND farmer_id = ${farmerId}`);
            for (const p of plots) {
                if (p.areaPercentage > 0) {
                    await db.execute(sql`
                        INSERT INTO farm_season_plots (season_id, plot_id, farmer_id, area_percentage)
                        VALUES (${seasonId}, ${p.plotId}, ${farmerId}, ${p.areaPercentage})
                        ON CONFLICT (season_id, plot_id) DO UPDATE SET area_percentage = ${p.areaPercentage}
                    `);
                }
            }
            console.log(`[FARM_SEASONS_PLOTS PUT] Success`);
            res.json({ success: true });
        } catch (error) {
            console.error("[FARM_SEASONS_PLOTS PUT]", error);
            res.status(500).json({ error: "Failed to save season plots" });
        }
    });
}
