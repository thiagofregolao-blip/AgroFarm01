/**
 * NDVI Routes — Satellite monitoring API endpoints
 * Primary: Copernicus Data Space (Sentinel Hub Process API)
 * Fallback: AgroMonitoring API
 */

import type { Express } from "express";
import { db } from "./db";
import { farmPlots, farmProperties } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { registerPolygon, getNdviHistory, getNdviImages } from "./services/ndvi-service";
import {
    isCopernicusConfigured,
    coordinatesToBbox,
    coordinatesToGeoJson,
    searchAvailableDates,
    generateNdviImage,
    getNdviStatsBatch,
    type NdviLayerType,
} from "./services/copernicus-ndvi-service";

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
                ndviPolygonId: sql<string>`${farmPlots.id}`.as("ndvi_check"),
            })
                .from(farmPlots)
                .innerJoin(farmProperties, eq(farmPlots.propertyId, farmProperties.id))
                .where(eq(farmProperties.farmerId, farmerId));

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

    // POST /api/farm/ndvi/:plotId/register — register plot for monitoring
    app.post("/api/farm/ndvi/:plotId/register", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { plotId } = req.params;

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

            if (isCopernicusConfigured()) {
                res.json({ polygonId: plotId, plotId, source: "copernicus", message: "Ready for Copernicus NDVI" });
            } else {
                const polygonId = await registerPolygon(plot[0].name, coords);
                if (!polygonId) {
                    return res.status(500).json({ error: "Failed to register polygon in satellite API" });
                }
                res.json({ polygonId, plotId, source: "agromonitoring", message: "Polygon registered for NDVI monitoring" });
            }
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

            if (isCopernicusConfigured()) {
                const plot = await db.select({ coordinates: farmPlots.coordinates })
                    .from(farmPlots)
                    .where(eq(farmPlots.id, polygonId))
                    .limit(1);

                if (!plot.length || !plot[0].coordinates) {
                    return res.json([]);
                }

                const coords = JSON.parse(plot[0].coordinates);
                const geometry = coordinatesToGeoJson(coords);

                const end = endDate ? new Date(endDate as string) : new Date();
                const start = startDate ? new Date(startDate as string) : new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
                const fromStr = start.toISOString().split("T")[0] + "T00:00:00Z";
                const toStr = end.toISOString().split("T")[0] + "T23:59:59Z";

                // Single batch call for all NDVI stats in the date range
                const statsArray = await getNdviStatsBatch(geometry, fromStr, toStr);

                const formatted = statsArray.map(s => ({
                    date: s.date + "T12:00:00Z",
                    dateFormatted: s.date.split("-").reverse().join("/"),
                    mean: s.mean,
                    min: s.min,
                    max: s.max,
                    median: s.mean,
                    source: "Sentinel-2",
                    cloudCover: 0,
                    healthLabel: getNdviLabel(s.mean),
                    healthColor: getNdviColor(s.mean),
                }));

                return res.json(formatted.sort((a, b) => a.date.localeCompare(b.date)));
            }

            // Fallback: AgroMonitoring
            const start = startDate ? new Date(startDate as string) : undefined;
            const end = endDate ? new Date(endDate as string) : undefined;
            const data = await getNdviHistory(polygonId, start, end);

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

            if (isCopernicusConfigured()) {
                const plot = await db.select({ coordinates: farmPlots.coordinates })
                    .from(farmPlots)
                    .where(eq(farmPlots.id, polygonId))
                    .limit(1);

                if (!plot.length || !plot[0].coordinates) {
                    return res.json([]);
                }

                const coords = JSON.parse(plot[0].coordinates);
                const geometry = coordinatesToGeoJson(coords);
                const bbox = coordinatesToBbox(coords);

                const now = new Date();
                const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const fromStr = from.toISOString().split("T")[0] + "T00:00:00Z";
                const toStr = now.toISOString().split("T")[0] + "T23:59:59Z";

                const dates = await searchAvailableDates(bbox, fromStr, toStr);

                // Generate only NDVI contrast for the most recent dates (saves processing units)
                const recentDates = dates.slice(0, 10);

                const formatted = await Promise.all(
                    recentDates.map(async (d) => {
                        const ndviContrastUrl = await generateNdviImage(geometry, bbox, d.date, "ndvi_contrast");

                        return {
                            date: d.date + "T12:00:00Z",
                            dateFormatted: d.date.split("-").reverse().join("/"),
                            ndviUrl: ndviContrastUrl,
                            ndviContrastUrl,
                            truecolorUrl: null,
                            falsecolorUrl: null,
                            eviUrl: null,
                            cloudCover: d.cloudCover,
                            source: "Sentinel-2",
                        };
                    })
                );

                return res.json(formatted);
            }

            // Fallback: AgroMonitoring
            const images = await getNdviImages(polygonId);

            const addPalette = (url: string | undefined, id: number) => {
                if (!url) return null;
                const sep = url.includes('?') ? '&' : '?';
                return `${url}${sep}paletteid=${id}`;
            };

            const formatted = images.map(img => ({
                date: new Date(img.dt * 1000).toISOString(),
                dateFormatted: new Date(img.dt * 1000).toLocaleDateString("pt-BR"),
                ndviUrl: addPalette(img.image?.ndvi, 1),
                ndviContrastUrl: addPalette(img.image?.ndvi, 3),
                truecolorUrl: img.image?.truecolor || null,
                falsecolorUrl: img.image?.falsecolor || null,
                eviUrl: img.image?.evi || null,
                cloudCover: img.dc,
                source: img.type,
            }));

            res.json(formatted);
        } catch (error) {
            console.error("[NDVI] Error getting images:", error);
            res.status(500).json({ error: "Failed" });
        }
    });

    // GET /api/farm/ndvi/:plotId/image — generate a single NDVI image on demand
    app.get("/api/farm/ndvi/:plotId/image", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        if (!isCopernicusConfigured()) {
            return res.status(501).json({ error: "Copernicus not configured" });
        }

        try {
            const { plotId } = req.params;
            const { date, layer = "ndvi_contrast" } = req.query;

            const plot = await db.select({ coordinates: farmPlots.coordinates })
                .from(farmPlots)
                .where(eq(farmPlots.id, plotId))
                .limit(1);

            if (!plot.length || !plot[0].coordinates) {
                return res.status(404).json({ error: "Plot not found" });
            }

            const coords = JSON.parse(plot[0].coordinates);
            const geometry = coordinatesToGeoJson(coords);
            const bbox = coordinatesToBbox(coords);

            const targetDate = date as string || new Date().toISOString().split("T")[0];

            const imageUrl = await generateNdviImage(geometry, bbox, targetDate, layer as NdviLayerType);
            if (!imageUrl) {
                return res.status(404).json({ error: "No image available for this date" });
            }

            res.json({ imageUrl, date: targetDate, layer });
        } catch (error) {
            console.error("[NDVI] Error generating image:", error);
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
