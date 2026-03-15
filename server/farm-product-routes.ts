import { Express } from "express";
import { requireFarmer, upload } from "./farm-middleware";
import { farmStorage } from "./farm-storage";

export function registerFarmProductRoutes(app: Express) {

    // ==================== PRODUCTS CATALOG ====================

    app.get("/api/farm/products", requireFarmer, async (req, res) => {
        try {
            const products = await farmStorage.getAllProducts();
            res.json(products);
        } catch (error) {
            console.error("[FARM_PRODUCTS_GET]", error);
            res.status(500).json({ error: "Failed to get products" });
        }
    });

    app.post("/api/farm/products", requireFarmer, upload.single("image"), async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient, imageUrl } = req.body;
            if (!name || !unit) return res.status(400).json({ error: "Product name and unit required" });

            let imageBase64 = null;
            if (req.file) {
                // Convert buffer to base64
                const base64String = req.file.buffer.toString('base64');
                const mimeType = req.file.mimetype;
                imageBase64 = `data:${mimeType};base64,${base64String}`;
            }

            const product = await farmStorage.createProduct({
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : null,
                category,
                activeIngredient,
                imageUrl: imageUrl || null,
                imageBase64: imageBase64,
            });
            res.status(201).json(product);
        } catch (error) {
            console.error("[FARM_PRODUCT_CREATE]", error);
            res.status(500).json({ error: "Failed to create product" });
        }
    });

    app.put("/api/farm/products/:id", requireFarmer, upload.single("image"), async (req, res) => {
        try {
            const { name, unit, dosePerHa, category, activeIngredient, imageUrl } = req.body;

            let imageBase64 = undefined;
            if (req.file) {
                const base64String = req.file.buffer.toString('base64');
                const mimeType = req.file.mimetype;
                imageBase64 = `data:${mimeType};base64,${base64String}`;
            }

            const product = await farmStorage.updateProduct(req.params.id, {
                name,
                unit,
                dosePerHa: dosePerHa ? String(dosePerHa) : undefined,
                category,
                activeIngredient,
                imageUrl: imageUrl !== undefined ? (imageUrl || null) : undefined, // Keep existing URL logic if needed
                imageBase64: imageBase64,
            });
            res.json(product);
        } catch (error) {
            console.error("[FARM_PRODUCT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update product" });
        }
    });

    app.delete("/api/farm/products/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteProduct(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PRODUCT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete product" });
        }
    });
}
