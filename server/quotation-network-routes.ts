/**
 * Quotation Network Routes — Anonymous price comparison across farmers
 * Normaliza nomes de produtos para matching fuzzy
 * Minimo 2 agricultores (era 3) para gerar comparativos
 */

import type { Express } from "express";
import { db } from "./db";
import { farmPriceHistory } from "../shared/schema";
import { eq, desc, sql } from "drizzle-orm";

// Normaliza nome do produto para matching fuzzy
// "ROUNDUP ULTRA 20L" e "RoundUp Ultra 20 L" viram "ROUNDUP ULTRA"
function normalizeProductName(name: string): string {
    return name
        .toUpperCase()
        .replace(/\d+\s*(LTS?|KG|ML|GR?|UN|SC)\b/gi, "") // remove quantidade + unidade
        .replace(/\b\d+\s*(L|KG)\b/gi, "")
        .replace(/\b(20LTS|10LTS|5LTS|1LT|20L|10L|5L|1L)\b/gi, "")
        .replace(/[^A-Z0-9\s]/g, "") // remove pontuacao
        .replace(/\s+/g, " ")
        .trim();
}

const MIN_FARMERS = 2; // Minimo de agricultores para comparacao (era 3)

export function registerQuotationNetworkRoutes(app: Express) {
    const getFarmerId = (req: any) => {
        return req.session?.passport?.user?.toString() || req.user?.id?.toString();
    };

    // GET /api/farm/quotation-network/debug — diagnostico
    app.get("/api/farm/quotation-network/debug", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const allPrices = await db.select({
                farmerId: farmPriceHistory.farmerId,
                productName: farmPriceHistory.productName,
                unitPrice: farmPriceHistory.unitPrice,
                purchaseDate: farmPriceHistory.purchaseDate,
            }).from(farmPriceHistory).orderBy(desc(farmPriceHistory.purchaseDate));

            const uniqueFarmers = new Set(allPrices.map((p: any) => p.farmerId));
            const uniqueProducts = new Set(allPrices.map((p: any) => p.productName));
            const normalizedProducts = new Set(allPrices.map((p: any) => normalizeProductName(p.productName)));

            // Produtos com mais de 1 agricultor
            const productFarmerMap: Record<string, Set<string>> = {};
            for (const p of allPrices) {
                const norm = normalizeProductName(p.productName);
                if (!productFarmerMap[norm]) productFarmerMap[norm] = new Set();
                productFarmerMap[norm].add(p.farmerId);
            }
            const productsWithMultipleFarmers = Object.entries(productFarmerMap)
                .filter(([, farmers]) => farmers.size >= MIN_FARMERS)
                .map(([name, farmers]) => ({ product: name, farmerCount: farmers.size }));

            res.json({
                totalRecords: allPrices.length,
                uniqueFarmers: uniqueFarmers.size,
                farmerIds: Array.from(uniqueFarmers),
                uniqueProducts: uniqueProducts.size,
                normalizedUniqueProducts: normalizedProducts.size,
                productsWithMultipleFarmers,
                minFarmersRequired: MIN_FARMERS,
                myFarmerId: farmerId,
                myProducts: allPrices.filter((p: any) => p.farmerId === farmerId).length,
                sampleRecords: allPrices.slice(0, 10).map((p: any) => ({
                    farmer: p.farmerId.slice(0, 8) + "...",
                    product: p.productName,
                    normalized: normalizeProductName(p.productName),
                    price: p.unitPrice,
                    date: p.purchaseDate,
                })),
            });
        } catch (error) {
            console.error("[QUOTATION-DEBUG]", error);
            res.status(500).json({ error: "Debug failed" });
        }
    });

    // GET /api/farm/quotation-network — anonymous price comparisons
    app.get("/api/farm/quotation-network", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const allPrices = await db.select({
                farmerId: farmPriceHistory.farmerId,
                productName: farmPriceHistory.productName,
                unitPrice: farmPriceHistory.unitPrice,
                purchaseDate: farmPriceHistory.purchaseDate,
            }).from(farmPriceHistory).orderBy(desc(farmPriceHistory.purchaseDate));

            // Agrupa por nome NORMALIZADO do produto (matching fuzzy)
            const productGroups: Record<string, {
                displayName: string;
                prices: number[];
                farmerPrices: { farmerId: string; price: number; date: Date }[];
            }> = {};

            for (const p of allPrices) {
                const normalized = normalizeProductName(p.productName);
                if (!normalized) continue;

                if (!productGroups[normalized]) {
                    productGroups[normalized] = { displayName: p.productName, prices: [], farmerPrices: [] };
                }
                const price = parseFloat(p.unitPrice || "0");
                if (price > 0) {
                    productGroups[normalized].prices.push(price);
                    productGroups[normalized].farmerPrices.push({
                        farmerId: p.farmerId,
                        price,
                        date: new Date(p.purchaseDate),
                    });
                }
            }

            const comparisons: any[] = [];

            for (const [normalizedName, group] of Object.entries(productGroups)) {
                // Minimo de agricultores unicos para privacidade
                const uniqueFarmers = new Set(group.farmerPrices.map(fp => fp.farmerId));
                if (uniqueFarmers.size < MIN_FARMERS) continue;

                const prices = group.prices;
                const sorted = [...prices].sort((a, b) => a - b);
                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)];
                const min = sorted[0];
                const max = sorted[sorted.length - 1];

                const myPrices = group.farmerPrices
                    .filter(fp => fp.farmerId === farmerId)
                    .sort((a, b) => b.date.getTime() - a.date.getTime());

                if (myPrices.length === 0) continue;

                const myPrice = myPrices[0].price;
                const diffFromAvg = ((myPrice - avg) / avg) * 100;
                const position = sorted.filter(p => p < myPrice).length + 1;

                comparisons.push({
                    productName: group.displayName,
                    normalizedName,
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
