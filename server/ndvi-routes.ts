/**
 * NDVI Routes — Satellite monitoring API endpoints
 */

import type { Express } from "express";
import { db } from "./db";
import { farmPlots, farmProperties } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { registerPolygon, getNdviHistory, getNdviImages } from "./services/ndvi-service";

export function registerNdviRoutes(app: Express) {
    const getFarmerId = (req: any) => {
        return req.session?.passport?.user?.toString() || req.user?.id?.toString();
    };

    // GET /api/farm/ndvi/plots — list plots with NDVI status
    app.get("/api/farm/ndvi/plots", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const plots = await db.select({
                id: farmPlots.id,
                name: farmPlots.name,
                areaHa: farmPlots.areaHa,
                crop: farmPlots.crop,
                coordinates: farmPlots.coordinates,
                propertyName: farmProperties.name,
                ndviPolygonId: sql<string>`${farmPlots.id}`.as("ndvi_check"), // placeholder
            })
                .from(farmPlots)
                .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
                .where(eq(farmProperties.farmerId, farmerId));

            // Check which plots have coordinates (needed for NDVI)
            const result = plots.map((p: any) => ({
                ...p,
                hasCoordinates: !!p.coordinates && p.coordinates.length > 10,
                coordinates: p.coordinates ? JSON.parse(p.coordinates) : null,
            }));

            res.json(result);
        } catch (error) {
            console.error("[NDVI] Error fetching plots:", error);
            res.status(500).json({ error: "Failed" });
        }
    });

    // POST /api/farm/ndvi/:plotId/register — register plot polygon in Agromonitoring
    app.post("/api/farm/ndvi/:plotId/register", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { plotId } = req.params;

            // Get plot coordinates
            const plot = await db.select({
                id: farmPlots.id,
                name: farmPlots.name,
                coordinates: farmPlots.coordinates,
            })
                .from(farmPlots)
                .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
                .where(eq(farmPlots.id, plotId))
                .limit(1);

            if (plot.length === 0) return res.status(404).json({ error: "Plot not found" });

            const coords = plot[0].coordinates ? JSON.parse(plot[0].coordinates) : null;
            if (!coords || coords.length < 3) {
                return res.status(400).json({ error: "Plot needs at least 3 coordinate points for NDVI monitoring" });
            }

            // Register polygon in the API
            const polygonId = await registerPolygon(plot[0].name, coords);
            if (!polygonId) {
                return res.status(500).json({ error: "Failed to register polygon in satellite API" });
            }

            res.json({ polygonId, plotId, message: "Polygon registered for NDVI monitoring" });
        } catch (error) {
            console.error("[NDVI] Error registering:", error);
            res.status(500).json({ error: "Failed" });
        }
    });

    // GET /api/farm/ndvi/:polygonId/history — NDVI history data
    app.get("/api/farm/ndvi/:polygonId/history", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { polygonId } = req.params;
            const { startDate, endDate } = req.query;

            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;

            const data = await getNdviHistory(polygonId, start, end);

            // Format for frontend chart
            const formatted = data.map(d => ({
                date: new Date(d.dt * 1000).toISOString(),
                dateFormatted: new Date(d.dt * 1000).toLocaleDateString("pt-BR"),
                mean: Math.round(d.data.mean * 1000) / 1000,
                min: Math.round(d.data.min * 1000) / 1000,
                max: Math.round(d.data.max * 1000) / 1000,
                median: Math.round(d.data.median * 1000) / 1000,
                source: d.source,
                cloudCover: d.dc,
                healthLabel: getNdviLabel(d.data.mean),
                healthColor: getNdviColor(d.data.mean),
            }));

            res.json(formatted);
        } catch (error) {
            console.error("[NDVI] Error getting history:", error);
            res.status(500).json({ error: "Failed" });
        }
    });

    // GET /api/farm/ndvi/:polygonId/images — satellite images
    app.get("/api/farm/ndvi/:polygonId/images", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { polygonId } = req.params;
            const images = await getNdviImages(polygonId);

            const formatted = images.map(img => ({
                date: new Date(img.dt * 1000).toISOString(),
                dateFormatted: new Date(img.dt * 1000).toLocaleDateString("pt-BR"),
                ndviUrl: img.image?.ndvi || null,
                truecolorUrl: img.image?.truecolor || null,
                falsecolorUrl: img.image?.falsecolor || null,
                cloudCover: img.dc,
                source: img.type,
            }));

            res.json(formatted);
        } catch (error) {
            console.error("[NDVI] Error getting images:", error);
            res.status(500).json({ error: "Failed" });
        }
    });
}

// Helper: NDVI value to health label
function getNdviLabel(value: number): string {
    if (value >= 0.7) return "Excelente";
    if (value >= 0.5) return "Saudável";
    if (value >= 0.3) return "Moderado";
    if (value >= 0.15) return "Estresse";
    return "Crítico";
}

// Helper: NDVI value to color
function getNdviColor(value: number): string {
    if (value >= 0.7) return "#15803D"; // dark green
    if (value >= 0.5) return "#22C55E"; // green
    if (value >= 0.3) return "#EAB308"; // yellow
    if (value >= 0.15) return "#F97316"; // orange
    return "#DC2626"; // red
}
