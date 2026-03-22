import { Express } from "express";
import { requireFarmer } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmPropertyRoutes(app: Express) {

    // ==================== PROPERTIES ====================

    app.get("/api/farm/properties", requireFarmer, async (req, res) => {
        try {
            const properties = await farmStorage.getProperties((req.user as any).id);
            res.json(properties);
        } catch (error) {
            console.error("[FARM_PROPERTIES_GET]", error);
            res.status(500).json({ error: "Failed to get properties" });
        }
    });

    app.post("/api/farm/properties", requireFarmer, async (req, res) => {
        try {
            const { name, location, totalAreaHa } = req.body;
            if (!name) return res.status(400).json({ error: "Property name required" });

            const property = await farmStorage.createProperty({
                farmerId: (req.user as any).id,
                name,
                location,
                totalAreaHa: totalAreaHa ? String(totalAreaHa) : null,
            });
            res.status(201).json(property);
        } catch (error) {
            console.error("[FARM_PROPERTY_CREATE]", error);
            res.status(500).json({ error: "Failed to create property" });
        }
    });

    app.put("/api/farm/properties/:id", requireFarmer, async (req, res) => {
        try {
            const { name, location, totalAreaHa } = req.body;
            const property = await farmStorage.updateProperty(req.params.id, {
                name,
                location,
                totalAreaHa: totalAreaHa ? String(totalAreaHa) : undefined,
            });
            res.json(property);
        } catch (error) {
            console.error("[FARM_PROPERTY_UPDATE]", error);
            res.status(500).json({ error: "Failed to update property" });
        }
    });

    app.delete("/api/farm/properties/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteProperty(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PROPERTY_DELETE]", error);
            res.status(500).json({ error: "Failed to delete property" });
        }
    });

    // ==================== PLOTS ====================

    app.get("/api/farm/properties/:propertyId/plots", requireFarmer, async (req, res) => {
        try {
            const plots = await farmStorage.getPlots(req.params.propertyId);
            res.json(plots);
        } catch (error) {
            console.error("[FARM_PLOTS_GET]", error);
            res.status(500).json({ error: "Failed to get plots" });
        }
    });

    app.get("/api/farm/plots", requireFarmer, async (req, res) => {
        try {
            const plots = await farmStorage.getPlotsByFarmer((req.user as any).id);
            res.json(plots);
        } catch (error) {
            console.error("[FARM_ALL_PLOTS_GET]", error);
            res.status(500).json({ error: "Failed to get plots" });
        }
    });

    app.post("/api/farm/properties/:propertyId/plots", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop, coordinates } = req.body;
            if (!name || !areaHa) return res.status(400).json({ error: "Plot name and area required" });

            const plot = await farmStorage.createPlot({
                propertyId: req.params.propertyId,
                name,
                areaHa: String(areaHa),
                crop,
                coordinates: coordinates ? JSON.stringify(coordinates) : null,
            });
            res.status(201).json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_CREATE]", error);
            res.status(500).json({ error: "Failed to create plot" });
        }
    });

    app.put("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop, coordinates } = req.body;
            const plot = await farmStorage.updatePlot(req.params.id, {
                name,
                areaHa: areaHa ? String(areaHa) : undefined,
                crop,
                coordinates: coordinates !== undefined ? (coordinates ? JSON.stringify(coordinates) : null) : undefined,
            });
            res.json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update plot" });
        }
    });

    app.delete("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deletePlot(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PLOT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete plot" });
        }
    });

    // ==================== EQUIPMENT ====================

    app.get("/api/farm/equipment", requireFarmer, async (req, res) => {
        try {
            const equipment = await farmStorage.getEquipment((req.user as any).id);
            res.json(equipment);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_GET]", error);
            res.status(500).json({ error: "Failed to get equipment list" });
        }
    });

    app.post("/api/farm/equipment", requireFarmer, async (req, res) => {
        try {
            const { name, type, status, tankCapacityL } = req.body;
            if (!name || !type) return res.status(400).json({ error: "Name and type required" });

            const equip = await farmStorage.createEquipment({
                farmerId: (req.user as any).id,
                name,
                type,
                status: status || "Ativo",
                tankCapacityL: tankCapacityL ? String(tankCapacityL) : null,
            });
            res.status(201).json(equip);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_CREATE]", error);
            res.status(500).json({ error: "Failed to create equipment" });
        }
    });

    app.put("/api/farm/equipment/:id", requireFarmer, async (req, res) => {
        try {
            const { name, type, status, tankCapacityL } = req.body;
            const equip = await farmStorage.updateEquipment(req.params.id, {
                name,
                type,
                status,
                ...(tankCapacityL !== undefined && { tankCapacityL: tankCapacityL ? String(tankCapacityL) : null }),
            });
            res.json(equip);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update equipment" });
        }
    });

    app.delete("/api/farm/equipment/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteEquipment(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete equipment" });
        }
    });

}
