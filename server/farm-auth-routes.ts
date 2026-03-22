import type { Express } from "express";
import { requireFarmer } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { ZApiClient } from "./whatsapp/zapi-client";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmAuthRoutes(app: Express) {

    // /api/farm/my-modules → returns enabled modules for current user
    app.get("/api/farm/my-modules", requireFarmer, async (req, res) => {
        try {
            const { userModules } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");

            const modules = await db
                .select()
                .from(userModules)
                .where(eq(userModules.userId, req.user!.id));

            res.json(modules);
        } catch (error) {
            console.error("Failed to fetch my modules:", error);
            res.status(500).json({ error: "Failed to fetch modules" });
        }
    });

    // /api/farm/global-silos → returns active global silos for farmers to select
    app.get("/api/farm/global-silos", requireFarmer, async (req, res) => {
        try {
            const { globalSilos } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq } = await import("drizzle-orm");

            const silos = await db
                .select()
                .from(globalSilos)
                .where(eq(globalSilos.active, true))
                .orderBy(globalSilos.companyName);

            res.json(silos);
        } catch (error) {
            console.error("Failed to fetch global silos for farmer:", error);
            res.status(500).json({ error: "Failed to fetch silos" });
        }
    });

    // /api/farm/silos/viability → Calculates distance and avg discounts for Silos
    app.get("/api/farm/silos/viability", requireFarmer, async (req, res) => {
        try {
            const { globalSilos, farmPlots, farmRomaneios } = await import("../shared/schema");
            const { eq, and, isNotNull } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = req.user!.id;

            // 1. Get all active global silos
            const silos = await db.select().from(globalSilos).where(eq(globalSilos.active, true));

            // 2. Get the farmer's most central/first plot to determine their base location
            const plots = await db.select().from(farmPlots)
                .innerJoin(await import("../shared/schema").then(sch => sch.farmProperties), eq(farmPlots.propertyId, (await import("../shared/schema")).farmProperties.id))
                .where(eq((await import("../shared/schema")).farmProperties.farmerId, farmerId));

            let referenceLat = 0;
            let referenceLng = 0;
            let hasLocation = false;

            for (const { farm_plots: plot } of plots) {
                if (plot.coordinates) {
                    try {
                        const coords = JSON.parse(plot.coordinates);
                        if (coords && coords.length > 0) {
                            referenceLat = coords[0].lat;
                            referenceLng = coords[0].lng;
                            hasLocation = true;
                            break; // use the first valid plot location
                        }
                    } catch (e) { }
                }
            }

            // Haversine distance formula
            const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371; // km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                return R * c;
            };

            // 3. Get all confirmed romaneios for this farmer to calculate historical discounts
            const romaneios = await db.select().from(farmRomaneios)
                .where(and(eq(farmRomaneios.farmerId, farmerId), eq(farmRomaneios.status, "confirmed"), isNotNull(farmRomaneios.globalSiloId)));

            const viabilityData = silos.map(silo => {
                // Distance
                let distanceKm = null;
                if (hasLocation && silo.latitude && silo.longitude) {
                    const sLat = parseFloat(silo.latitude);
                    const sLng = parseFloat(silo.longitude);
                    if (!isNaN(sLat) && !isNaN(sLng)) {
                        distanceKm = getDistanceKm(referenceLat, referenceLng, sLat, sLng);
                    }
                }

                // Historical Discounts
                const siloRomaneios = romaneios.filter(r => r.globalSiloId === silo.id);
                let totalMoistureDisc = 0;
                let totalImpurityDisc = 0;
                let countMoisture = 0;
                let countImpurity = 0;

                siloRomaneios.forEach(r => {
                    if (r.moistureDiscount) {
                        totalMoistureDisc += parseFloat(r.moistureDiscount);
                        countMoisture++;
                    }
                    if (r.impurityDiscount) {
                        totalImpurityDisc += parseFloat(r.impurityDiscount);
                        countImpurity++;
                    }
                });

                return {
                    id: silo.id,
                    companyName: silo.companyName,
                    branchName: silo.branchName,
                    distanceKm: distanceKm ? Math.round(distanceKm * 10) / 10 : null,
                    historicalAvgMoistureDiscountKg: countMoisture ? Math.round(totalMoistureDisc / countMoisture) : null,
                    historicalAvgImpurityDiscountKg: countImpurity ? Math.round(totalImpurityDisc / countImpurity) : null,
                    romaneiosCount: siloRomaneios.length,
                    score: 0 // Will be calculated dynamically on the frontend based on freight cost, etc.
                };
            });

            // Sort by distance if available
            viabilityData.sort((a, b) => {
                if (a.distanceKm === null && b.distanceKm === null) return 0;
                if (a.distanceKm === null) return 1;
                if (b.distanceKm === null) return -1;
                return a.distanceKm - b.distanceKm;
            });

            res.json({
                hasLocation,
                silos: viabilityData
            });
        } catch (error) {
            console.error("Failed to fetch silo viability:", error);
            res.status(500).json({ error: "Failed to calculate silo viability" });
        }
    });

    // /api/farm/me → returns current user info (no separate login needed)
    app.get("/api/farm/me", requireFarmer, async (req, res) => {
        try {
            const user = req.user!;
            // Fetch location fields from DB (not in Drizzle schema)
            let locationData: any = {};
            try {
                const { pool } = await import("./db");
                const isNeon = (process.env.DATABASE_URL || "").includes("neon.tech");
                let rows: any[];
                if (isNeon) {
                    const result = await pool.query(
                        "SELECT farm_city, farm_latitude, farm_longitude, bulletin_enabled, invoice_email, accountant_email, language FROM users WHERE id = $1",
                        [user.id]
                    );
                    rows = result.rows || [];
                } else {
                    rows = await pool.unsafe(
                        "SELECT farm_city, farm_latitude, farm_longitude, bulletin_enabled, invoice_email, accountant_email, language FROM users WHERE id = $1",
                        [user.id]
                    );
                }
                if (rows.length > 0) locationData = rows[0];
            } catch (e) {
                console.error("[FARM_ME] Error fetching location:", e);
            }

            res.json({
                id: user.id,
                name: user.name,
                username: user.username,
                role: user.role,
                whatsapp_number: user.whatsapp_number,
                whatsapp_extra_numbers: user.whatsapp_extra_numbers,
                farm_city: locationData.farm_city || "",
                farm_latitude: locationData.farm_latitude || "",
                farm_longitude: locationData.farm_longitude || "",
                bulletin_enabled: locationData.bulletin_enabled !== false,
                invoice_email: locationData.invoice_email || "",
                accountant_email: locationData.accountant_email || "",
                language: locationData.language || "pt-BR",
            });
        } catch (error) {
            console.error("[FARM_ME]", error);
            res.status(500).json({ error: "Failed to get user" });
        }
    });

    // Update user profile (name and whatsapp)
    app.put("/api/farm/me", requireFarmer, async (req, res) => {
        try {
            const { name, whatsapp_number, whatsapp_extra_numbers, farm_city, farm_latitude, farm_longitude, bulletin_enabled, invoice_email, accountant_email, language } = req.body;
            const userId = req.user!.id;

            // Dynamically import db to avoid circular dependency issues
            const { db } = await import("./db");
            const { users } = await import("../shared/schema");
            const { eq, sql } = await import("drizzle-orm");

            const formattedPhone = whatsapp_number ? ZApiClient.formatPhoneNumber(whatsapp_number) : null;
            console.log(`[PROFILE_UPDATE] Updating user ${userId} with phone: Raw='${whatsapp_number}' -> Formatted='${formattedPhone}'`);

            const [updatedUser] = await db.update(users)
                .set({
                    name,
                    whatsapp_number: formattedPhone,
                    whatsapp_extra_numbers: whatsapp_extra_numbers || null,
                })
                .where(eq(users.id, userId))
                .returning();

            // Update location fields via raw SQL (not in Drizzle schema yet)
            if (farm_city !== undefined || farm_latitude !== undefined || farm_longitude !== undefined || bulletin_enabled !== undefined || invoice_email !== undefined || accountant_email !== undefined) {
                const { pool } = await import("./db");
                const isNeon = (process.env.DATABASE_URL || "").includes("neon.tech");
                const queryStr = `UPDATE users SET
                    farm_city = COALESCE($1, farm_city),
                    farm_latitude = COALESCE($2, farm_latitude),
                    farm_longitude = COALESCE($3, farm_longitude),
                    bulletin_enabled = COALESCE($4, bulletin_enabled),
                    invoice_email = $6,
                    accountant_email = $7,
                    language = COALESCE($8, language)
                WHERE id = $5`;
                const params = [farm_city || null, farm_latitude || null, farm_longitude || null, bulletin_enabled ?? true, userId, invoice_email || null, accountant_email || null, language || null];
                if (isNeon) {
                    await pool.query(queryStr, params);
                } else {
                    await pool.unsafe(queryStr, params);
                }
            }

            console.log(`[PROFILE_UPDATE] User updated in DB:`, updatedUser ? updatedUser.whatsapp_number : "failed");

            if (!updatedUser) {
                return res.status(404).json({ error: "User not found" });
            }

            res.json({
                id: updatedUser.id,
                name: updatedUser.name,
                username: updatedUser.username,
                role: updatedUser.role,
                whatsapp_number: updatedUser.whatsapp_number || undefined,
                whatsapp_extra_numbers: updatedUser.whatsapp_extra_numbers || undefined,
            });
        } catch (error) {
            console.error("[FARM_ME_UPDATE]", error);
            res.status(500).json({ error: "Failed to update profile" });
        }
    });

}
