/**
 * Field Notebook Routes — Automatic digital field diary from registered applications
 */

import type { Express } from "express";
import { db } from "./db";
import { farmApplications, farmProductsCatalog, farmPlots, farmProperties, farmSeasons, farmEquipment } from "../shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export function registerFieldNotebookRoutes(app: Express) {
    // GET /api/farm/field-notebook — consolidated field notebook data
    app.get("/api/farm/field-notebook", async (req: any, res) => {
        const { getEffectiveFarmerId } = await import("./farm-middleware");
        const farmerId = await getEffectiveFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { seasonId } = req.query;

            // Get all applications for this farmer with related data
            const applications = await db.select({
                id: farmApplications.id,
                date: farmApplications.appliedAt,
                productId: farmApplications.productId,
                productName: farmProductsCatalog.name,
                productCategory: farmProductsCatalog.category,
                productUnit: farmProductsCatalog.unit,
                activeIngredient: farmProductsCatalog.activeIngredient,
                quantity: farmApplications.quantity,
                dosePerHa: farmApplications.dosePerHa,
                plotId: farmApplications.plotId,
                plotName: farmPlots.name,
                plotArea: farmPlots.areaHa,
                plotCrop: farmPlots.crop,
                propertyId: farmApplications.propertyId,
                propertyName: farmProperties.name,
                equipmentId: farmApplications.equipmentId,
                appliedBy: farmApplications.appliedBy,
                notes: farmApplications.notes,
                seasonId: farmApplications.seasonId,
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

    // PUT /api/farm/field-notebook/:id — edit an application + adjust stock
    app.put("/api/farm/field-notebook/:id", async (req: any, res) => {
        const { getEffectiveFarmerId } = await import("./farm-middleware");
        const farmerId = await getEffectiveFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { farmStorage } = await import("./farm-storage");
            const appId = req.params.id;
            const { productId, quantity, plotId, propertyId, appliedBy, notes, dosePerHa, appliedAt } = req.body;

            if (!quantity || parseFloat(quantity) <= 0) {
                return res.status(400).json({ error: "Quantidade inválida" });
            }

            // Fetch original application
            const [original] = await db.select().from(farmApplications).where(
                and(eq(farmApplications.id, appId), eq(farmApplications.farmerId, farmerId))
            );
            if (!original) return res.status(404).json({ error: "Aplicação não encontrada" });

            const oldQty = parseFloat(original.quantity);
            const newQty = parseFloat(quantity);
            const oldProductId = original.productId;
            const newProductId = productId || original.productId;
            const oldPropertyId = original.propertyId;
            const newPropertyId = propertyId || original.propertyId;

            // ── Adjust stock (SQL direto — não toca no average_cost) ──
            const adjustStockQtyOnly = async (prodId: string, propId: string | null, delta: number) => {
                const coalesced = propId || "__none__";
                await db.execute(sql`
                    UPDATE farm_stock
                    SET quantity = CAST(quantity AS NUMERIC) + ${delta}, updated_at = now()
                    WHERE farmer_id = ${farmerId}
                      AND product_id = ${prodId}
                      AND COALESCE(property_id, '__none__') = ${coalesced}
                `);
            };

            const recordMovement = async (prodId: string, type: "entry" | "exit", absQty: number, notes: string) => {
                await db.execute(sql`
                    INSERT INTO farm_stock_movements
                        (farmer_id, product_id, type, quantity, reference_type, notes)
                    VALUES
                        (${farmerId}, ${prodId}, ${type}, ${String(type === "entry" ? absQty : -absQty)}, ${"correcao_caderno"}, ${notes})
                `);
            };

            if (oldProductId === newProductId) {
                const diff = newQty - oldQty; // positivo = usou mais, negativo = usou menos
                if (Math.abs(diff) > 0.0001) {
                    if (diff > 0) {
                        // usou mais → sai mais do estoque
                        await adjustStockQtyOnly(oldProductId, oldPropertyId, -diff);
                        await recordMovement(oldProductId, "exit", diff, "Consumo adicional — edição no Caderno de Campo");
                    } else {
                        // usou menos → devolve ao estoque
                        await adjustStockQtyOnly(oldProductId, oldPropertyId, -diff); // -diff é positivo
                        await recordMovement(oldProductId, "entry", -diff, "Devolução — edição no Caderno de Campo");
                    }
                }
            } else {
                // Produto trocado: devolve o antigo, desconta o novo
                await adjustStockQtyOnly(oldProductId, oldPropertyId, +oldQty);
                await recordMovement(oldProductId, "entry", oldQty, "Devolução — troca de produto no Caderno de Campo");
                await adjustStockQtyOnly(newProductId, newPropertyId, -newQty);
                await recordMovement(newProductId, "exit", newQty, "Consumo — troca de produto no Caderno de Campo");
            }

            // ── Update application record ──
            const updateData: any = {
                quantity: String(newQty),
                productId: newProductId,
                appliedBy: appliedBy ?? original.appliedBy,
                notes: notes ?? original.notes,
            };
            if (plotId !== undefined) updateData.plotId = plotId || null;
            if (propertyId !== undefined) updateData.propertyId = propertyId || null;
            if (dosePerHa !== undefined) updateData.dosePerHa = dosePerHa ? String(dosePerHa) : null;
            if (appliedAt) updateData.appliedAt = new Date(appliedAt);

            await db.update(farmApplications).set(updateData).where(
                and(eq(farmApplications.id, appId), eq(farmApplications.farmerId, farmerId))
            );

            console.log(`[FIELD-NOTEBOOK] EDIT id=${appId} oldProd=${oldProductId} newProd=${newProductId} oldQty=${oldQty} newQty=${newQty}`);
            res.json({ success: true });
        } catch (error) {
            console.error("[FIELD-NOTEBOOK_EDIT]", error);
            res.status(500).json({ error: "Falha ao editar aplicação" });
        }
    });

    // DELETE /api/farm/field-notebook/:id — delete an application + restore stock
    app.delete("/api/farm/field-notebook/:id", async (req: any, res) => {
        const { getEffectiveFarmerId } = await import("./farm-middleware");
        const farmerId = await getEffectiveFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { sql } = await import("drizzle-orm");
            const appId = req.params.id;

            // Fetch original application
            const [original] = await db.select().from(farmApplications).where(
                and(eq(farmApplications.id, appId), eq(farmApplications.farmerId, farmerId))
            );
            if (!original) return res.status(404).json({ error: "Aplicação não encontrada" });

            const qty = parseFloat(original.quantity);
            const propId = original.propertyId;
            const coalesced = propId || "__none__";

            // Devolver ao estoque SEM tocar no average_cost
            await db.execute(sql`
                UPDATE farm_stock
                SET quantity = CAST(quantity AS NUMERIC) + ${qty}, updated_at = now()
                WHERE farmer_id = ${farmerId}
                  AND product_id = ${original.productId}
                  AND COALESCE(property_id, '__none__') = ${coalesced}
            `);

            // Registrar entrada na movimentação com badge de correção
            await db.execute(sql`
                INSERT INTO farm_stock_movements
                    (farmer_id, product_id, type, quantity, reference_type, notes)
                VALUES
                    (${farmerId}, ${original.productId}, ${"entry"}, ${String(qty)}, ${"correcao_caderno"}, ${"Devolução — exclusão no Caderno de Campo"})
            `);

            // Delete the application record
            await db.delete(farmApplications).where(
                and(eq(farmApplications.id, appId), eq(farmApplications.farmerId, farmerId))
            );

            console.log(`[FIELD-NOTEBOOK] DELETE id=${appId} prod=${original.productId} qty=${qty} restored to stock`);
            res.json({ success: true });
        } catch (error) {
            console.error("[FIELD-NOTEBOOK_DELETE]", error);
            res.status(500).json({ error: "Falha ao excluir aplicação" });
        }
    });
}
