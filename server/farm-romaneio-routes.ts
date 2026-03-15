/**
 * Farm Romaneio Routes (Boletas de Pesaje)
 * Extracted from farm-routes.ts
 */
import { Express } from "express";
import { requireFarmer, upload } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { ZApiClient } from "./whatsapp/zapi-client";

export function registerFarmRomaneioRoutes(app: Express) {

    // ============================================================================
    // ROMANEIOS (Boletas de Pesaje)
    // ============================================================================

    app.get("/api/farm/romaneios", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmPlots, farmProperties, farmSeasons } = await import("../shared/schema");
            const { eq, and, desc } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const romaneios = await db.select({
                romaneio: farmRomaneios,
                plotName: farmPlots.name,
                plotArea: farmPlots.areaHa,
                propertyName: farmProperties.name,
                seasonName: farmSeasons.name,
            })
                .from(farmRomaneios)
                .leftJoin(farmPlots, eq(farmRomaneios.plotId, farmPlots.id))
                .leftJoin(farmProperties, eq(farmRomaneios.propertyId, farmProperties.id))
                .leftJoin(farmSeasons, eq(farmRomaneios.seasonId, farmSeasons.id))
                .where(eq(farmRomaneios.farmerId, farmerId))
                .orderBy(desc(farmRomaneios.deliveryDate));

            res.json(romaneios.map((r: any) => ({
                ...r.romaneio,
                plotName: r.plotName,
                plotArea: r.plotArea,
                propertyName: r.propertyName,
                seasonName: r.seasonName,
            })));
        } catch (error) {
            console.error("[ROMANEIOS_GET]", error);
            res.status(500).json({ error: "Failed to get romaneios" });
        }
    });

    app.post("/api/farm/romaneios", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmAccountsReceivable, farmGrainStock } = await import("../shared/schema");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const body = { ...req.body };
            if (body.deliveryDate && typeof body.deliveryDate === "string") {
                body.deliveryDate = new Date(body.deliveryDate);
            }

            const [romaneio] = await db.insert(farmRomaneios).values({
                ...body,
                farmerId,
            }).returning();

            // AUTO: Romaneio → Conta a Receber
            if (romaneio.totalValue && parseFloat(romaneio.totalValue) > 0) {
                const dueDate = new Date(romaneio.deliveryDate);
                dueDate.setDate(dueDate.getDate() + 30);
                await db.insert(farmAccountsReceivable).values({
                    farmerId,
                    romaneioId: romaneio.id,
                    buyer: romaneio.buyer,
                    description: `${romaneio.crop} - Ticket ${romaneio.ticketNumber || 'S/N'} - ${(parseFloat(romaneio.finalWeight) / 1000).toFixed(2)} ton`,
                    totalAmount: romaneio.totalValue,
                    currency: romaneio.currency,
                    dueDate: dueDate.toISOString(),
                    status: "pendente",
                });
            }

            // AUTO: Romaneio → Estoque de Graos (entrada)
            if (romaneio.crop && romaneio.finalWeight) {
                try {
                    const cropNorm = romaneio.crop.toLowerCase().trim();
                    const qty = parseFloat(romaneio.finalWeight);
                    const existing = await db.select().from(farmGrainStock).where(
                        and(eq(farmGrainStock.farmerId, farmerId), eq(farmGrainStock.crop, cropNorm), eq(farmGrainStock.seasonId, romaneio.seasonId || ''))
                    );
                    if (existing.length > 0) {
                        await db.update(farmGrainStock)
                            .set({ quantity: sqlFn`CAST(${farmGrainStock.quantity} AS NUMERIC) + ${qty}`, updatedAt: new Date() })
                            .where(eq(farmGrainStock.id, existing[0].id));
                    } else {
                        await db.insert(farmGrainStock).values({
                            farmerId, crop: cropNorm, seasonId: romaneio.seasonId || null,
                            quantity: String(qty),
                        });
                    }
                    console.log(`[ROMANEIO→GRAIN_STOCK] +${qty}kg ${cropNorm}`);
                } catch (gsErr) {
                    console.error("[ROMANEIO→GRAIN_STOCK_ERROR]", gsErr);
                }
            }

            res.json(romaneio);
        } catch (error) {
            console.error("[ROMANEIO_CREATE]", error);
            res.status(500).json({ error: "Failed to create romaneio" });
        }
    });

    // ===== ROMANEIO AI IMPORT (Photo/PDF) =====
    app.post("/api/farm/romaneios/import", requireFarmer, upload.single("file"), async (req, res) => {
        try {
            const { farmRomaneios, globalSilos } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;
            const file = req.file;

            if (!file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

            console.log(`[ROMANEIO_IMPORT] Parsing ${file.originalname} (${file.mimetype}, ${Math.round(file.size / 1024)}KB)`);

            const { parseRomaneioImage } = await import("./parse-farm-invoice");
            const parsed = await parseRomaneioImage(file.buffer, file.mimetype);

            console.log(`[ROMANEIO_IMPORT] Parsed: ticket=${parsed.ticketNumber}, buyer=${parsed.buyer}, crop=${parsed.crop}, gross=${parsed.grossWeight}kg`);

            // Check if there's a match for globalSiloId + normalize buyer name
            let matchedSiloId = null;
            if (parsed.buyer) {
                const normalizedBuyer = parsed.buyer.toLowerCase().replace(/[^a-z0-9]/g, '');
                const silos = await db.select().from(globalSilos).where(eq(globalSilos.active, true));

                for (const s of silos) {
                    const normSilo = s.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normalizedBuyer.includes(normSilo) || normSilo.includes(normalizedBuyer)) {
                        matchedSiloId = s.id;
                        parsed.buyer = s.companyName; // Use the registered name!
                        console.log(`[ROMANEIO_IMPORT] Fuzzy matched buyer → using registered name: ${s.companyName}`);
                        break;
                    }
                }

                // Also match against existing confirmed romaneio buyer names
                if (!matchedSiloId) {
                    const existingBuyers = await db.selectDistinct({ buyer: farmRomaneios.buyer })
                        .from(farmRomaneios)
                        .where(and(eq(farmRomaneios.farmerId, farmerId), eq(farmRomaneios.status, "confirmed")));
                    const normKey = (s: string) => s.toUpperCase().replace(/\b(SA|S\.?A\.?|SRL|S\.?R\.?L\.?|LTDA|CIA|CO|INC)\b/gi, '').replace(/[^A-Z0-9]/g, '').trim();
                    const aiKey = normKey(parsed.buyer);
                    for (const row of existingBuyers) {
                        if (normKey(row.buyer) === aiKey) {
                            console.log(`[ROMANEIO_IMPORT] Buyer '${parsed.buyer}' matched existing '${row.buyer}'`);
                            parsed.buyer = row.buyer;
                            break;
                        }
                    }
                }
            }
            parsed.globalSiloId = matchedSiloId;

            // Return parsed data for frontend preview (don't save yet)
            res.json({
                message: "Romaneio extraído com sucesso!",
                parsed,
            });
        } catch (error) {
            console.error("[ROMANEIO_IMPORT]", error);
            res.status(500).json({ error: "Falha ao processar romaneio. Tente novamente." });
        }
    });

    // ===== CONFIRM WhatsApp Romaneio =====
    app.post("/api/farm/romaneios/:id/confirm", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmAccountsReceivable, farmGrainStock } = await import("../shared/schema");
            const { eq, and, sql: sqlFn } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // Update romaneio fields + set status to confirmed
            const updateData: any = { status: "confirmed", ...req.body };
            delete updateData.id; // safety

            const [romaneio] = await db.update(farmRomaneios)
                .set(updateData)
                .where(and(eq(farmRomaneios.id, req.params.id), eq(farmRomaneios.farmerId, farmerId)))
                .returning();

            if (!romaneio) return res.status(404).json({ error: "Romaneio not found" });

            // AUTO: Romaneio → Conta a Receber
            if (romaneio.totalValue && parseFloat(romaneio.totalValue) > 0) {
                const dueDate = new Date(romaneio.deliveryDate);
                dueDate.setDate(dueDate.getDate() + 30);
                await db.insert(farmAccountsReceivable).values({
                    farmerId,
                    romaneioId: romaneio.id,
                    buyer: romaneio.buyer,
                    description: `${romaneio.crop} - Ticket ${romaneio.ticketNumber || 'S/N'} - ${(parseFloat(romaneio.finalWeight) / 1000).toFixed(2)} ton`,
                    totalAmount: romaneio.totalValue,
                    currency: romaneio.currency,
                    dueDate: dueDate.toISOString(),
                    status: "pendente",
                });
            }

            // AUTO: Romaneio → Estoque de Graos (entrada)
            if (romaneio.crop && romaneio.finalWeight) {
                try {
                    const cropNorm = romaneio.crop.toLowerCase().trim();
                    const qty = parseFloat(romaneio.finalWeight);
                    const existing = await db.select().from(farmGrainStock).where(
                        and(eq(farmGrainStock.farmerId, farmerId), eq(farmGrainStock.crop, cropNorm), eq(farmGrainStock.seasonId, romaneio.seasonId || ''))
                    );
                    if (existing.length > 0) {
                        await db.update(farmGrainStock)
                            .set({ quantity: sqlFn`CAST(${farmGrainStock.quantity} AS NUMERIC) + ${qty}`, updatedAt: new Date() })
                            .where(eq(farmGrainStock.id, existing[0].id));
                    } else {
                        await db.insert(farmGrainStock).values({
                            farmerId, crop: cropNorm, seasonId: romaneio.seasonId || null,
                            quantity: String(qty),
                        });
                    }
                    console.log(`[ROMANEIO_CONFIRM→GRAIN_STOCK] +${qty}kg ${cropNorm}`);
                } catch (gsErr) {
                    console.error("[ROMANEIO_CONFIRM→GRAIN_STOCK_ERROR]", gsErr);
                }
            }

            res.json({ success: true, romaneio });
        } catch (error) {
            console.error("[ROMANEIO_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm romaneio" });
        }
    });

    // ===== DATA-FIX: Normalize existing buyer names =====
    app.post("/api/farm/romaneios/normalize-buyers", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            // Normalization key: strip legal suffixes + punctuation
            const normKey = (s: string) => s.toUpperCase()
                .replace(/\b(SA|S\.?A\.?|SRL|S\.?R\.?L\.?|LTDA|CIA|CO|INC)\b/gi, '')
                .replace(/[^A-Z0-9]/g, '')
                .trim();

            // Get all romaneios for this farmer
            const all = await db.select({ id: farmRomaneios.id, buyer: farmRomaneios.buyer })
                .from(farmRomaneios)
                .where(eq(farmRomaneios.farmerId, farmerId));

            // Group by normalized key, track name frequencies
            const groups: Record<string, { names: Record<string, number>; ids: string[] }> = {};
            for (const r of all) {
                if (!r.buyer) continue;
                const key = normKey(r.buyer);
                if (!groups[key]) groups[key] = { names: {}, ids: [] };
                groups[key].names[r.buyer] = (groups[key].names[r.buyer] || 0) + 1;
                groups[key].ids.push(r.id);
            }

            // For each group, pick the most frequent name and update all others
            let updatedCount = 0;
            for (const key of Object.keys(groups)) {
                const g = groups[key];
                const nameEntries = Object.entries(g.names);
                if (nameEntries.length <= 1) continue; // No duplicates

                // Pick best name (most frequent)
                let bestName = nameEntries[0][0];
                let bestCount = nameEntries[0][1];
                for (const [name, count] of nameEntries) {
                    if (count > bestCount) { bestName = name; bestCount = count; }
                }

                // Update all romaneios in this group to use the best name
                for (const id of g.ids) {
                    const currentBuyer = all.find(r => r.id === id)?.buyer;
                    if (currentBuyer !== bestName) {
                        await db.update(farmRomaneios).set({ buyer: bestName }).where(eq(farmRomaneios.id, id));
                        updatedCount++;
                    }
                }

                console.log(`[NORMALIZE_BUYERS] Merged ${nameEntries.map(([n, c]) => `"${n}"(${c})`).join(', ')} → "${bestName}"`);
            }

            res.json({ success: true, message: `Normalized ${updatedCount} romaneios`, updatedCount });
        } catch (error) {
            console.error("[NORMALIZE_BUYERS]", error);
            res.status(500).json({ error: "Failed to normalize buyer names" });
        }
    });

    app.put("/api/farm/romaneios/:id", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const [updated] = await db.update(farmRomaneios).set(req.body).where(
                and(eq(farmRomaneios.id, req.params.id), eq(farmRomaneios.farmerId, farmerId))
            ).returning();
            res.json(updated);
        } catch (error) {
            console.error("[ROMANEIO_UPDATE]", error);
            res.status(500).json({ error: "Failed to update romaneio" });
        }
    });

    app.delete("/api/farm/romaneios/:id", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            await db.delete(farmRomaneios).where(
                and(eq(farmRomaneios.id, req.params.id), eq(farmRomaneios.farmerId, farmerId))
            );
            res.json({ success: true });
        } catch (error) {
            console.error("[ROMANEIO_DELETE]", error);
            res.status(500).json({ error: "Failed to delete romaneio" });
        }
    });

    // ===== N8N/WhatsApp Webhook: Romaneio Photo Import =====
    app.post("/api/farm/webhook/n8n/romaneio", async (req, res) => {
        try {
            const { whatsapp_number, imageUrl, caption } = req.body;
            if (!whatsapp_number || !imageUrl) {
                return res.status(400).json({ error: "whatsapp_number and imageUrl are required" });
            }

            const { users, farmRomaneios, farmPlots } = await import("../shared/schema");
            const { eq, and, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            // Find farmer by phone
            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number);
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) {
                return res.status(404).json({ error: "Farmer not found" });
            }

            const farmerId = farmers[0].id;

            console.log(`[WEBHOOK_N8N_ROMANEIO] phone=${whatsapp_number}, imageUrl=${imageUrl?.substring(0, 60)}...`);

            // Download image
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                return res.status(400).json({ error: "Failed to download romaneio image" });
            }

            const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Parse with AI
            const { parseRomaneioImage } = await import("./parse-farm-invoice");
            const parsed = await parseRomaneioImage(buffer, contentType);

            console.log(`[WEBHOOK_N8N_ROMANEIO] Parsed: ticket=${parsed.ticketNumber}, buyer=${parsed.buyer}, gross=${parsed.grossWeight}kg`);

            // Get farmer's plots for context
            const plots = await db.select({ id: farmPlots.id, name: farmPlots.name })
                .from(farmPlots)
                .where(sql`${farmPlots.propertyId} IN (
                    SELECT id FROM farm_properties WHERE farmer_id = ${farmerId}
                )`);

            // Normalize buyer name against existing confirmed romaneio buyers
            if (parsed.buyer) {
                // First try globalSilos match
                const { globalSilos } = await import("../shared/schema");
                const silos = await db.select().from(globalSilos).where(eq(globalSilos.active, true));
                let matched = false;
                const normalizedBuyer = parsed.buyer.toLowerCase().replace(/[^a-z0-9]/g, '');
                for (const s of silos) {
                    const normSilo = s.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (normalizedBuyer.includes(normSilo) || normSilo.includes(normalizedBuyer)) {
                        parsed.buyer = s.companyName;
                        matched = true;
                        console.log(`[WEBHOOK_N8N_ROMANEIO] Buyer matched to globalSilo: ${s.companyName}`);
                        break;
                    }
                }
                // Then try matching against existing confirmed romaneio buyer names
                if (!matched) {
                    const existingBuyers = await db.selectDistinct({ buyer: farmRomaneios.buyer })
                        .from(farmRomaneios)
                        .where(and(eq(farmRomaneios.farmerId, farmerId), eq(farmRomaneios.status, "confirmed")));
                    const normKey = (s: string) => s.toUpperCase().replace(/\b(SA|S\.?A\.?|SRL|S\.?R\.?L\.?|LTDA|CIA|CO|INC)\b/gi, '').replace(/[^A-Z0-9]/g, '').trim();
                    const aiKey = normKey(parsed.buyer);
                    for (const row of existingBuyers) {
                        if (normKey(row.buyer) === aiKey) {
                            console.log(`[WEBHOOK_N8N_ROMANEIO] Buyer '${parsed.buyer}' → matched existing '${row.buyer}'`);
                            parsed.buyer = row.buyer;
                            break;
                        }
                    }
                }
            }

            // Create pending romaneio
            const [romaneio] = await db.insert(farmRomaneios).values({
                farmerId,
                buyer: parsed.buyer,
                crop: parsed.crop,
                deliveryDate: parsed.deliveryDate || new Date(),
                grossWeight: String(parsed.grossWeight),
                tare: String(parsed.tare),
                netWeight: String(parsed.netWeight),
                finalWeight: String(parsed.finalWeight),
                moisture: parsed.moisture != null ? String(parsed.moisture) : null,
                impurities: parsed.impurities != null ? String(parsed.impurities) : null,
                moistureDiscount: String(parsed.moistureDiscount),
                impurityDiscount: String(parsed.impurityDiscount),
                pricePerTon: parsed.pricePerTon != null ? String(parsed.pricePerTon) : null,
                totalValue: parsed.totalValue != null ? String(parsed.totalValue) : null,
                currency: parsed.currency,
                truckPlate: parsed.truckPlate,
                ticketNumber: parsed.ticketNumber,
                driver: parsed.driver,
                documentNumber: parsed.documentNumber,
                discounts: parsed.discounts,
                source: "whatsapp",
                status: "pending",
                notes: caption || parsed.notes || "",
            }).returning();

            // Format response message for WhatsApp
            const plotList = plots.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
            const summary = [
                `✅ *Romaneio #${parsed.ticketNumber || 'S/N'} recebido!*`,
                ``,
                `🏢 Comprador: *${parsed.buyer}*`,
                `🌾 Cultura: *${parsed.crop}*`,
                `📅 Data: ${parsed.deliveryDate ? new Date(parsed.deliveryDate).toLocaleDateString("pt-BR") : "Hoje"}`,
                ``,
                `⚖️ Peso Bruto: ${parsed.grossWeight.toLocaleString()} kg`,
                `📦 Tara: ${parsed.tare.toLocaleString()} kg`,
                `📊 Peso Neto: ${parsed.netWeight.toLocaleString()} kg`,
                parsed.moisture != null ? `💧 Umidade: ${parsed.moisture}%` : null,
                parsed.impurities != null ? `🔬 Impureza: ${parsed.impurities}%` : null,
                `✨ Peso Líquido: *${parsed.finalWeight.toLocaleString()} kg* (${(parsed.finalWeight / 1000).toFixed(2)} ton)`,
                parsed.truckPlate ? `🚛 Placa: ${parsed.truckPlate}` : null,
                ``,
                plots.length > 0 ? `📍 *De qual talhão é esse romaneio?*\n${plotList}` : `⚠️ Nenhum talhão cadastrado. Confirme pelo sistema.`,
            ].filter(Boolean).join("\n");

            res.json({
                message: summary,
                romaneioId: romaneio.id,
                plots: plots.map(p => ({ id: p.id, name: p.name })),
                parsed,
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_ROMANEIO]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Get productivity per plot (aggregated romaneios)
    app.get("/api/farm/romaneios/productivity", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmPlots } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [eq(farmRomaneios.farmerId, farmerId)];
            if (req.query.seasonId) {
                conditions.push(eq(farmRomaneios.seasonId, req.query.seasonId as string));
            }

            const productivity = await db.select({
                plotId: farmRomaneios.plotId,
                plotName: farmPlots.name,
                plotArea: farmPlots.areaHa,
                crop: farmRomaneios.crop,
                totalFinalWeight: sql<string>`SUM(CAST(${farmRomaneios.finalWeight} AS NUMERIC))`,
                totalValue: sql<string>`SUM(CAST(${farmRomaneios.totalValue} AS NUMERIC))`,
                deliveryCount: sql<string>`COUNT(*)`,
            })
                .from(farmRomaneios)
                .leftJoin(farmPlots, eq(farmRomaneios.plotId, farmPlots.id))
                .where(and(...conditions))
                .groupBy(farmRomaneios.plotId, farmPlots.name, farmPlots.areaHa, farmRomaneios.crop);

            res.json(productivity.map((p: any) => ({
                ...p,
                kgPerHa: p.plotArea && parseFloat(p.plotArea) > 0
                    ? (parseFloat(p.totalFinalWeight) / parseFloat(p.plotArea)).toFixed(0)
                    : null,
                tonPerHa: p.plotArea && parseFloat(p.plotArea) > 0
                    ? (parseFloat(p.totalFinalWeight) / parseFloat(p.plotArea) / 1000).toFixed(2)
                    : null,
            })));
        } catch (error) {
            console.error("[ROMANEIO_PRODUCTIVITY]", error);
            res.status(500).json({ error: "Failed to get productivity" });
        }
    });

    // ===== SILO VISUALIZATION: Aggregate by buyer with crop breakdown + invoice cross-ref =====
    app.get("/api/farm/romaneios/silos", requireFarmer, async (req, res) => {
        try {
            const { farmRomaneios, farmInvoices } = await import("../shared/schema");
            const { eq, and, sql } = await import("drizzle-orm");
            const { db } = await import("./db");
            const farmerId = (req.user as any).id;

            const conditions: any[] = [
                eq(farmRomaneios.farmerId, farmerId),
                eq(farmRomaneios.status, "confirmed"),
            ];
            if (req.query.seasonId) {
                conditions.push(eq(farmRomaneios.seasonId, req.query.seasonId as string));
            }

            // Helper: normalize buyer name for grouping
            // Strips legal suffixes (SA, S.A., SRL, LTDA, etc.), removes all punctuation, uppercases
            // So "C.Vale", "C.VALE SA", "C.VALE S.A." → "CVALE" (same key!)
            const normalizeBuyerKey = (name: string) => name
                .toUpperCase()
                .replace(/\b(SA|S\.?A\.?|SRL|S\.?R\.?L\.?|LTDA|CIA|CO|INC)\b/gi, '')
                .replace(/[^A-Z0-9]/g, '')
                .trim();

            // 1. Aggregate romaneios by buyer + crop
            const romaneioAgg = await db.select({
                buyer: farmRomaneios.buyer,
                crop: farmRomaneios.crop,
                totalWeight: sql<string>`SUM(CAST(${farmRomaneios.finalWeight} AS NUMERIC))`,
                totalValue: sql<string>`SUM(CAST(${farmRomaneios.totalValue} AS NUMERIC))`,
                deliveryCount: sql<string>`COUNT(*)`,
                grossWeight: sql<string>`SUM(CAST(${farmRomaneios.grossWeight} AS NUMERIC))`,
            })
                .from(farmRomaneios)
                .where(and(...conditions))
                .groupBy(farmRomaneios.buyer, farmRomaneios.crop);

            // 2. Get total harvest across all buyers
            const totalHarvest = romaneioAgg.reduce((s: number, r: any) => s + parseFloat(r.totalWeight || "0"), 0);

            // 3. Aggregate invoices by supplier (for input spend cross-reference)
            const invoiceConditions: any[] = [eq(farmInvoices.farmerId, farmerId)];
            if (req.query.seasonId) {
                invoiceConditions.push(eq(farmInvoices.seasonId, req.query.seasonId as string));
            }

            const invoiceAgg = await db.select({
                supplier: farmInvoices.supplier,
                totalSpent: sql<string>`SUM(CAST(${farmInvoices.totalAmount} AS NUMERIC))`,
                invoiceCount: sql<string>`COUNT(*)`,
            })
                .from(farmInvoices)
                .where(and(...invoiceConditions))
                .groupBy(farmInvoices.supplier);

            // 4. Build silos: group by NORMALIZED buyer name (case-insensitive merge)
            const buyerMap: Record<string, any> = {};
            // Track original name frequencies to pick the best display name
            const buyerNameFreq: Record<string, Record<string, number>> = {};

            for (const row of romaneioAgg) {
                const key = normalizeBuyerKey(row.buyer);
                if (!buyerMap[key]) {
                    buyerMap[key] = {
                        buyer: row.buyer, // will be replaced by most-frequent original name later
                        crops: [],
                        totalWeight: 0,
                        totalGrossWeight: 0,
                        totalValue: 0,
                        deliveryCount: 0,
                        inputSpent: 0,
                        invoiceCount: 0,
                        percentOfHarvest: 0,
                    };
                    buyerNameFreq[key] = {};
                }

                // Track which original buyer name spelling appears most
                const count = parseInt(row.deliveryCount || "0");
                buyerNameFreq[key][row.buyer] = (buyerNameFreq[key][row.buyer] || 0) + count;

                const weight = parseFloat(row.totalWeight || "0");
                const gross = parseFloat(row.grossWeight || "0");
                const value = parseFloat(row.totalValue || "0");

                // Merge crops: check if same crop already exists in this normalized buyer
                const existingCrop = buyerMap[key].crops.find((c: any) => c.crop?.toUpperCase() === row.crop?.toUpperCase());
                if (existingCrop) {
                    existingCrop.weight += weight;
                    existingCrop.grossWeight += gross;
                    existingCrop.value += value;
                    existingCrop.deliveryCount += count;
                } else {
                    buyerMap[key].crops.push({
                        crop: row.crop,
                        weight,
                        grossWeight: gross,
                        value,
                        deliveryCount: count,
                    });
                }
                buyerMap[key].totalWeight += weight;
                buyerMap[key].totalGrossWeight += gross;
                buyerMap[key].totalValue += value;
                buyerMap[key].deliveryCount += count;
            }

            // Pick best display name for each normalized buyer (most frequent original spelling)
            for (const key of Object.keys(buyerMap)) {
                const freqs = buyerNameFreq[key];
                let bestName = buyerMap[key].buyer;
                let bestCount = 0;
                for (const [name, freq] of Object.entries(freqs)) {
                    if (freq > bestCount) {
                        bestCount = freq;
                        bestName = name;
                    }
                }
                buyerMap[key].buyer = bestName;
            }

            // 5. Match invoices to buyers (fuzzy match on supplier name)
            for (const inv of invoiceAgg) {
                const supplierLower = (inv.supplier || "").toLowerCase().trim();
                if (!supplierLower) continue;

                for (const buyer of Object.keys(buyerMap)) {
                    const buyerLower = buyer.toLowerCase().trim();
                    // Match if supplier contains buyer name or vice versa
                    if (supplierLower.includes(buyerLower) || buyerLower.includes(supplierLower) ||
                        supplierLower.replace(/\s*(sa|s\.a\.|ltda|srl|s\.r\.l\.)\s*/gi, "").trim() ===
                        buyerLower.replace(/\s*(sa|s\.a\.|ltda|srl|s\.r\.l\.)\s*/gi, "").trim()) {
                        buyerMap[buyer].inputSpent += parseFloat(inv.totalSpent || "0");
                        buyerMap[buyer].invoiceCount += parseInt(inv.invoiceCount || "0");
                    }
                }
            }

            // 6. Calculate percentages and sort
            const silos = Object.values(buyerMap).map((silo: any) => ({
                ...silo,
                percentOfHarvest: totalHarvest > 0 ? (silo.totalWeight / totalHarvest) * 100 : 0,
                balance: silo.totalValue - silo.inputSpent, // Grains value - Input cost
            }));

            silos.sort((a: any, b: any) => b.totalWeight - a.totalWeight);

            res.json({
                silos,
                totalHarvest,
                totalValue: silos.reduce((s: number, silo: any) => s + silo.totalValue, 0),
                totalInputSpent: silos.reduce((s: number, silo: any) => s + silo.inputSpent, 0),
            });
        } catch (error) {
            console.error("[ROMANEIO_SILOS]", error);
            res.status(500).json({ error: "Failed to get silo data" });
        }
    });

}
