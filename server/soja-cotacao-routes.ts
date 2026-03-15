/**
 * Soybean Price (Cotacao Soja) Routes
 * Fetches CBOT soybean futures data and caches in DB
 * Conversion: 1 saca (60kg) = 60 / 27.2155 bushels = ~2.2046 bushels
 */

import type { Express } from "express";
import { db } from "./db";
import { soybeanPriceCache } from "../shared/schema";
import { sql, eq, and, gte, lte, desc } from "drizzle-orm";

const BUSHEL_TO_SACA_FACTOR = 60 / 27.2155; // ~2.2046

export function registerSojaCotacaoRoutes(app: Express) {
    const getFarmerId = (req: any) => {
        return req.session?.passport?.user?.toString() || req.user?.id?.toString();
    };

    // GET /api/farm/soja-cotacao?month=3&year=2026
    // Returns daily soybean prices for a given month across last 6 years
    app.get("/api/farm/soja-cotacao", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
            const year = parseInt(req.query.year as string) || new Date().getFullYear();
            const yearsBack = 5;

            const startYear = year - yearsBack;
            const years = [];
            for (let y = startYear; y <= year; y++) {
                years.push(y);
            }

            // Check cache: do we have data for all requested years/month?
            const allData: Record<number, { day: number; priceBushel: number; priceSaca: number }[]> = {};
            const yearsToFetch: number[] = [];

            for (const y of years) {
                const monthStartStr = `${y}-${String(month).padStart(2, "0")}-01`;
                const lastDay = new Date(y, month, 0).getDate();
                const monthEndStr = `${y}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")} 23:59:59`;

                const cached = await db.execute(sql`
                    SELECT trade_date, price_usd_bushel, price_usd_saca
                    FROM soybean_price_cache
                    WHERE trade_date >= ${monthStartStr}::timestamp AND trade_date <= ${monthEndStr}::timestamp
                    ORDER BY trade_date
                `) as any;

                const rows = (cached as any).rows || cached;
                if (rows.length > 0) {
                    allData[y] = rows.map((c: any) => ({
                        day: new Date(c.trade_date).getDate(),
                        priceBushel: parseFloat(c.price_usd_bushel),
                        priceSaca: parseFloat(c.price_usd_saca),
                    }));
                } else {
                    // Current year/month: always refetch if incomplete
                    yearsToFetch.push(y);
                }
            }

            // Fetch missing data from Yahoo Finance
            if (yearsToFetch.length > 0) {
                for (const y of yearsToFetch) {
                    const data = await fetchSoybeanPricesForMonth(y, month);
                    if (data.length > 0) {
                        // Cache in DB
                        for (const d of data) {
                            const dateStr = d.date.toISOString();
                            await db.execute(sql`
                                INSERT INTO soybean_price_cache (id, trade_date, price_usd_bushel, price_usd_saca, source, fetched_at)
                                VALUES (gen_random_uuid(), ${dateStr}::timestamp, ${d.priceBushel.toFixed(4)}, ${d.priceSaca.toFixed(4)}, 'yahoo_finance', now())
                                ON CONFLICT DO NOTHING
                            `);
                        }
                        allData[y] = data.map(d => ({
                            day: new Date(d.date).getDate(),
                            priceBushel: d.priceBushel,
                            priceSaca: d.priceSaca,
                        }));
                    } else {
                        allData[y] = [];
                    }
                }
            }

            // Build summary per year
            const summaries: Record<number, { avg: number; avgSaca: number; min: number; max: number; count: number }> = {};
            for (const y of years) {
                const prices = allData[y] || [];
                if (prices.length > 0) {
                    const bushels = prices.map(p => p.priceBushel);
                    summaries[y] = {
                        avg: bushels.reduce((a, b) => a + b, 0) / bushels.length,
                        avgSaca: prices.map(p => p.priceSaca).reduce((a, b) => a + b, 0) / prices.length,
                        min: Math.min(...bushels),
                        max: Math.max(...bushels),
                        count: prices.length,
                    };
                }
            }

            res.json({
                month,
                year,
                years,
                data: allData,
                summaries,
                bushelToSacaFactor: BUSHEL_TO_SACA_FACTOR,
            });
        } catch (error) {
            console.error("[SOJA-COTACAO] Error:", error);
            res.status(500).json({ error: "Failed to load soybean prices" });
        }
    });

    // POST /api/farm/soja-cotacao/refresh — force refresh for a given month/year
    app.post("/api/farm/soja-cotacao/refresh", async (req: any, res) => {
        const farmerId = getFarmerId(req);
        if (!farmerId) return res.status(401).json({ error: "Unauthorized" });

        try {
            const { month, year } = req.body;
            const m = parseInt(month) || new Date().getMonth() + 1;
            const y = parseInt(year) || new Date().getFullYear();

            // Delete cached data for this month/year
            const monthStartStr = `${y}-${String(m).padStart(2, "0")}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const monthEndStr = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")} 23:59:59`;
            await db.execute(sql`
                DELETE FROM soybean_price_cache
                WHERE trade_date >= ${monthStartStr}::timestamp AND trade_date <= ${monthEndStr}::timestamp
            `);

            // Refetch
            const data = await fetchSoybeanPricesForMonth(y, m);
            for (const d of data) {
                const dateStr = d.date.toISOString();
                await db.execute(sql`
                    INSERT INTO soybean_price_cache (id, trade_date, price_usd_bushel, price_usd_saca, source, fetched_at)
                    VALUES (gen_random_uuid(), ${dateStr}::timestamp, ${d.priceBushel.toFixed(4)}, ${d.priceSaca.toFixed(4)}, 'yahoo_finance', now())
                    ON CONFLICT DO NOTHING
                `);
            }

            res.json({ ok: true, count: data.length });
        } catch (error) {
            console.error("[SOJA-COTACAO] Refresh error:", error);
            res.status(500).json({ error: "Failed to refresh soybean prices" });
        }
    });
}

/**
 * Fetch soybean futures prices from Yahoo Finance for a specific month/year
 * Uses ZS=F (CBOT Soybean Futures) historical data via Yahoo Finance v8 API
 */
async function fetchSoybeanPricesForMonth(year: number, month: number): Promise<{
    date: Date;
    priceBushel: number;
    priceSaca: number;
}[]> {
    try {
        // Yahoo Finance uses Unix timestamps (seconds)
        const start = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
        const end = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/ZS%3DF?period1=${start}&period2=${end}&interval=1d`;

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
        });

        if (!response.ok) {
            console.error(`[SOJA-COTACAO] Yahoo Finance returned ${response.status}`);
            return [];
        }

        const json = await response.json() as any;
        const result = json?.chart?.result?.[0];
        if (!result) return [];

        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];

        const prices: { date: Date; priceBushel: number; priceSaca: number }[] = [];

        for (let i = 0; i < timestamps.length; i++) {
            const close = closes[i];
            if (close == null) continue;

            const date = new Date(timestamps[i] * 1000);
            const priceBushel = parseFloat(close.toFixed(4));
            const priceSaca = parseFloat((priceBushel * BUSHEL_TO_SACA_FACTOR).toFixed(4));

            prices.push({ date, priceBushel, priceSaca });
        }

        console.log(`[SOJA-COTACAO] Fetched ${prices.length} prices for ${month}/${year}`);
        return prices;
    } catch (error) {
        console.error(`[SOJA-COTACAO] Fetch error for ${month}/${year}:`, error);
        return [];
    }
}
