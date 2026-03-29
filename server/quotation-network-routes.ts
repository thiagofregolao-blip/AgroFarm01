/**
 * Quotation Network Routes — Anonymous price comparison across farmers
 * Shows ALL products with regional average prices
 * Includes purchase simulator
 */

import type { Express } from "express";
import { db } from "./db";
import { farmPriceHistory, farmStock, farmProductsCatalog } from "../shared/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { getEffectiveFarmerId, requireFarmer } from "./farm-middleware";

function normalizeProductName(name: string): string {
    return name
        .toUpperCase()
        .replace(/\d+\s*(LTS?|KG|ML|GR?|UN|SC)\b/gi, "")
        .replace(/\b\d+\s*(L|KG)\b/gi, "")
        .replace(/\b(20LTS|10LTS|5LTS|1LT|20L|10L|5L|1L)\b/gi, "")
        .replace(/[^A-Z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

export function registerQuotationNetworkRoutes(app: Express) {

    // GET /api/farm/quotation-network — ALL products with regional prices
    app.get("/api/farm/quotation-network", requireFarmer, async (req: any, res) => {
        const farmerId = await getEffectiveFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });
        console.log(`[QUOTATION] farmerId=${farmerId} user=${req.user?.id} role=${req.user?.role}`);

        try {
            // Lazy sync: ensure existing stock with averageCost is in farmPriceHistory
            try {
                const stockItems = await db.select({
                    productId: farmStock.productId,
                    productName: farmProductsCatalog.name,
                    averageCost: farmStock.averageCost,
                    activeIngredient: farmProductsCatalog.activeIngredient,
                }).from(farmStock)
                  .innerJoin(farmProductsCatalog, eq(farmProductsCatalog.id, farmStock.productId))
                  .where(and(
                      eq(farmStock.farmerId, farmerId),
                      sql`CAST(${farmStock.averageCost} AS numeric) > 0`
                  ));

                let synced = 0;
                for (const item of stockItems) {
                    const existing = await db.select({ id: farmPriceHistory.id })
                        .from(farmPriceHistory)
                        .where(and(
                            eq(farmPriceHistory.farmerId, farmerId),
                            eq(farmPriceHistory.productName, item.productName)
                        ))
                        .limit(1);

                    if (existing.length === 0) {
                        await db.insert(farmPriceHistory).values({
                            farmerId,
                            productName: item.productName,
                            unitPrice: item.averageCost,
                            quantity: "1",
                            purchaseDate: new Date(),
                            supplier: "Estoque Existente",
                            activeIngredient: item.activeIngredient,
                        });
                        synced++;
                    }
                }
                if (synced > 0) {
                    console.log(`[QUOTATION] Synced ${synced} products to price history for farmer ${farmerId}`);
                }
            } catch (syncErr) {
                console.error("[QUOTATION] Sync error (non-fatal):", syncErr);
            }

            const allPrices = await db.select({
                farmerId: farmPriceHistory.farmerId,
                productName: farmPriceHistory.productName,
                unitPrice: farmPriceHistory.unitPrice,
                supplier: farmPriceHistory.supplier,
                purchaseDate: farmPriceHistory.purchaseDate,
            }).from(farmPriceHistory).orderBy(desc(farmPriceHistory.purchaseDate));

            // Group by normalized product name
            const productGroups: Record<string, {
                displayName: string;
                prices: number[];
                farmerPrices: { farmerId: string; price: number; date: Date; supplier: string }[];
            }> = {};

            for (const p of allPrices) {
                const normalized = normalizeProductName(p.productName);
                if (!normalized) continue;
                const price = parseFloat(p.unitPrice || "0");
                if (price <= 0) continue;

                if (!productGroups[normalized]) {
                    productGroups[normalized] = { displayName: p.productName, prices: [], farmerPrices: [] };
                }
                productGroups[normalized].prices.push(price);
                productGroups[normalized].farmerPrices.push({
                    farmerId: p.farmerId,
                    price,
                    date: new Date(p.purchaseDate),
                    supplier: p.supplier || "Desconhecido",
                });
            }

            const comparisons: any[] = [];

            for (const [normalizedName, group] of Object.entries(productGroups)) {
                const prices = group.prices;
                const sorted = [...prices].sort((a, b) => a - b);
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)];
                const min = sorted[0];
                const max = sorted[sorted.length - 1];
                const uniqueFarmers = new Set(group.farmerPrices.map(fp => fp.farmerId));

                // Get THIS farmer's latest price (may not exist)
                const myPrices = group.farmerPrices
                    .filter(fp => fp.farmerId === farmerId)
                    .sort((a, b) => b.date.getTime() - a.date.getTime());

                const myPrice = myPrices.length > 0 ? myPrices[0].price : null;
                const diffFromAvg = myPrice ? ((myPrice - avg) / avg) * 100 : 0;
                const position = myPrice ? sorted.filter(p => p < myPrice).length + 1 : null;

                // Latest purchase info
                const latestPurchase = group.farmerPrices.sort((a, b) => b.date.getTime() - a.date.getTime())[0];

                comparisons.push({
                    productName: group.displayName,
                    normalizedName,
                    myPrice: myPrice ? Math.round(myPrice * 100) / 100 : null,
                    averagePrice: Math.round(avg * 100) / 100,
                    medianPrice: Math.round(median * 100) / 100,
                    minPrice: Math.round(min * 100) / 100,
                    maxPrice: Math.round(max * 100) / 100,
                    diffPercentage: Math.round(diffFromAvg * 10) / 10,
                    position,
                    totalFarmers: uniqueFarmers.size,
                    totalSamples: prices.length,
                    status: !myPrice ? "sem_dados" : diffFromAvg > 5 ? "above" : diffFromAvg < -5 ? "below" : "average",
                    lastSupplier: latestPurchase?.supplier || null,
                    lastDate: latestPurchase?.date || null,
                });
            }

            // Sort: products I bought first, then by total samples
            comparisons.sort((a, b) => {
                if (a.myPrice && !b.myPrice) return -1;
                if (!a.myPrice && b.myPrice) return 1;
                return b.totalSamples - a.totalSamples;
            });

            const myProducts = comparisons.filter(c => c.myPrice !== null);

            res.json({
                comparisons,
                summary: {
                    totalProducts: comparisons.length,
                    myProducts: myProducts.length,
                    aboveAverage: myProducts.filter(c => c.status === "above").length,
                    belowAverage: myProducts.filter(c => c.status === "below").length,
                    atAverage: myProducts.filter(c => c.status === "average").length,
                    totalFarmersInNetwork: new Set(allPrices.map((p: any) => p.farmerId)).size,
                },
            });
        } catch (error) {
            console.error("[QUOTATION-NETWORK] Error:", error);
            res.status(500).json({ error: "Failed to load quotation network" });
        }
    });

    // POST /api/farm/quotation-network/simulate — purchase simulator
    app.post("/api/farm/quotation-network/simulate", requireFarmer, async (req: any, res) => {
        const farmerId = await getEffectiveFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        const { productName, offeredPrice } = req.body;
        if (!productName || !offeredPrice) return res.status(400).json({ error: "productName e offeredPrice obrigatorios" });

        try {
            const allPrices = await db.select({
                farmerId: farmPriceHistory.farmerId,
                productName: farmPriceHistory.productName,
                unitPrice: farmPriceHistory.unitPrice,
                supplier: farmPriceHistory.supplier,
                purchaseDate: farmPriceHistory.purchaseDate,
            }).from(farmPriceHistory).orderBy(desc(farmPriceHistory.purchaseDate));

            const searchNorm = normalizeProductName(productName);
            const offered = parseFloat(offeredPrice);

            // Find matching products (fuzzy)
            const matches: { name: string; prices: number[]; suppliers: string[] }[] = [];

            const productGroups: Record<string, { name: string; prices: number[]; suppliers: string[] }> = {};
            for (const p of allPrices) {
                const norm = normalizeProductName(p.productName);
                const price = parseFloat(p.unitPrice || "0");
                if (price <= 0) continue;
                if (!productGroups[norm]) productGroups[norm] = { name: p.productName, prices: [], suppliers: [] };
                productGroups[norm].prices.push(price);
                if (p.supplier) productGroups[norm].suppliers.push(p.supplier);
            }

            // Find exact or partial matches
            for (const [norm, group] of Object.entries(productGroups)) {
                if (norm.includes(searchNorm) || searchNorm.includes(norm) ||
                    norm.split(" ").some(w => searchNorm.includes(w) && w.length > 3)) {
                    matches.push(group);
                }
            }

            if (matches.length === 0) {
                return res.json({
                    found: false,
                    message: `Nenhum registro encontrado para "${productName}". Seja o primeiro a registrar!`,
                    offeredPrice: offered,
                });
            }

            // Use best match (most samples)
            const best = matches.sort((a, b) => b.prices.length - a.prices.length)[0];
            const avg = best.prices.reduce((a, b) => a + b, 0) / best.prices.length;
            const min = Math.min(...best.prices);
            const max = Math.max(...best.prices);
            const diff = ((offered - avg) / avg) * 100;

            let verdict: string;
            let emoji: string;
            if (diff > 15) { verdict = "Muito acima da media regional. Negocie!"; emoji = "🔴"; }
            else if (diff > 5) { verdict = "Acima da media. Pode conseguir melhor."; emoji = "🟠"; }
            else if (diff > -5) { verdict = "Na media da regiao. Preco justo."; emoji = "🟡"; }
            else if (diff > -15) { verdict = "Abaixo da media. Bom preco!"; emoji = "🟢"; }
            else { verdict = "Muito abaixo da media. Excelente negocio!"; emoji = "💚"; }

            res.json({
                found: true,
                productName: best.name,
                offeredPrice: offered,
                averagePrice: Math.round(avg * 100) / 100,
                minPrice: Math.round(min * 100) / 100,
                maxPrice: Math.round(max * 100) / 100,
                diffPercentage: Math.round(diff * 10) / 10,
                totalSamples: best.prices.length,
                uniqueSuppliers: Array.from(new Set(best.suppliers)).length,
                verdict,
                emoji,
            });
        } catch (error) {
            console.error("[QUOTATION-SIMULATE] Error:", error);
            res.status(500).json({ error: "Failed to simulate" });
        }
    });

    // Debug endpoint
    app.get("/api/farm/quotation-network/debug", requireFarmer, async (req: any, res) => {
        const farmerId = await getEffectiveFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });
        try {
            const allPrices = await db.select({
                farmerId: farmPriceHistory.farmerId,
                productName: farmPriceHistory.productName,
                unitPrice: farmPriceHistory.unitPrice,
                purchaseDate: farmPriceHistory.purchaseDate,
            }).from(farmPriceHistory).orderBy(desc(farmPriceHistory.purchaseDate));
            const uniqueFarmers = new Set(allPrices.map((p: any) => p.farmerId));
            res.json({
                totalRecords: allPrices.length,
                uniqueFarmers: uniqueFarmers.size,
                farmerIds: Array.from(uniqueFarmers),
                myFarmerId: farmerId,
                myProducts: allPrices.filter((p: any) => p.farmerId === farmerId).length,
            });
        } catch (error) { res.status(500).json({ error: "Debug failed" }); }
    });
}
