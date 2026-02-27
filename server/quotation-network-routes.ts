/**
 * Quotation Network Routes — Anonymous price comparison across farmers
 */

import type { Express } from "express";
import { db } from "./db";
import { farmPriceHistory } from "../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export function registerQuotationNetworkRoutes(app: Express) {
    const getFarmerId = (req: any) => {
        return req.session?.passport?.user?.toString() || req.user?.id?.toString();
    };

    // GET /api/farm/quotation-network — anonymous price comparisons
    app.get("/api/farm/quotation-network", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            // Get all price history for ALL farmers (for anonymous comparison)
            const allPrices = await db.select({
                farmerId: farmPriceHistory.farmerId,
                productName: farmPriceHistory.productName,
                unitPrice: farmPriceHistory.unitPrice,
                purchaseDate: farmPriceHistory.purchaseDate,
            })
                .from(farmPriceHistory)
                .orderBy(desc(farmPriceHistory.purchaseDate));

            // Group by product name
            const productGroups: Record<string, {
                prices: number[];
                farmerPrices: { farmerId: string; price: number; date: Date }[];
            }> = {};

            for (const p of allPrices) {
                const name = p.productName;
                if (!productGroups[name]) {
                    productGroups[name] = { prices: [], farmerPrices: [] };
                }
                const price = parseFloat(p.unitPrice || "0");
                if (price > 0) {
                    productGroups[name].prices.push(price);
                    productGroups[name].farmerPrices.push({
                        farmerId: p.farmerId,
                        price,
                        date: new Date(p.purchaseDate),
                    });
                }
            }

            // Build comparison data for each product
            const comparisons: any[] = [];

            for (const [productName, group] of Object.entries(productGroups)) {
                // Need at least 3 unique farmers for privacy
                const uniqueFarmers = new Set(group.farmerPrices.map(fp => fp.farmerId));
                if (uniqueFarmers.size < 3) continue;

                const prices = group.prices;
                const sorted = [...prices].sort((a, b) => a - b);
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)];
                const min = sorted[0];
                const max = sorted[sorted.length - 1];

                // Get this farmer's latest price for this product
                const myPrices = group.farmerPrices
                    .filter(fp => fp.farmerId === farmerId)
                    .sort((a, b) => b.date.getTime() - a.date.getTime());

                if (myPrices.length === 0) continue; // Farmer hasn't bought this product

                const myPrice = myPrices[0].price;
                const diffFromAvg = ((myPrice - avg) / avg) * 100;

                // Position ranking (1 = cheapest)
                const position = sorted.filter(p => p < myPrice).length + 1;

                comparisons.push({
                    productName,
                    myPrice: Math.round(myPrice * 100) / 100,
                    averagePrice: Math.round(avg * 100) / 100,
                    medianPrice: Math.round(median * 100) / 100,
                    minPrice: Math.round(min * 100) / 100,
                    maxPrice: Math.round(max * 100) / 100,
                    diffPercentage: Math.round(diffFromAvg * 10) / 10,
                    position,
                    totalFarmers: uniqueFarmers.size,
                    totalSamples: prices.length,
                    status: diffFromAvg > 5 ? "above" : diffFromAvg < -5 ? "below" : "average",
                });
            }

            // Sort by diff percentage (most above average first)
            comparisons.sort((a, b) => b.diffPercentage - a.diffPercentage);

            res.json({
                comparisons,
                summary: {
                    totalProducts: comparisons.length,
                    aboveAverage: comparisons.filter(c => c.status === "above").length,
                    belowAverage: comparisons.filter(c => c.status === "below").length,
                    atAverage: comparisons.filter(c => c.status === "average").length,
                },
            });
        } catch (error) {
            console.error("[QUOTATION-NETWORK] Error:", error);
            res.status(500).json({ error: "Failed to load quotation network" });
        }
    });
}
