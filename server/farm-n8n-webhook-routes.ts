import { Express } from "express";
import { requireFarmer, upload, parseLocalDate } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { ZApiClient } from "./whatsapp/zapi-client";
import { findSimilarSuppliers, fillMissingSupplierFields } from "./lib/supplier-dedup";

// Middleware to validate n8n webhook shared secret
function requireWebhookSecret(req: any, res: any, next: any) {
    const secret = process.env.N8N_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("[N8N_WEBHOOK] N8N_WEBHOOK_SECRET not configured — webhooks disabled");
        return res.status(503).json({ error: "Webhooks not configured" });
    }
    const provided = req.headers['x-webhook-secret'] || req.query.secret || req.query['x-webhook-secret'];
    if (provided !== secret) {
        return res.status(401).json({ error: "Invalid webhook secret" });
    }
    next();
}

export function registerFarmN8nWebhookRoutes(app: Express) {
    // ==================== n8n / WhatsApp Webhooks ====================
    // All webhook routes require a shared secret via x-webhook-secret header or ?secret= query param

    app.post("/api/farm/webhook/n8n/check-pending-equipment", requireWebhookSecret, async (req, res) => {
        try {
            const { whatsapp_number, message } = req.body;
            if (!whatsapp_number || !message) {
                return res.json({ handled: false });
            }

            const { users, farmWhatsappPendingContext, farmExpenses, farmEquipment, farmCashAccounts, farmCashTransactions } = await import("../shared/schema");
            const { eq, or, sql: sqlFn, and, ilike, gt, desc } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number);
            const farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sqlFn`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0) return res.json({ handled: false });

            const farmer = farmers[0];
            const now = new Date();

            const [ctx] = await db.select().from(farmWhatsappPendingContext).where(
                and(
                    eq(farmWhatsappPendingContext.farmerId, farmer.id),
                    eq(farmWhatsappPendingContext.phone, formattedPhone),
                    gt(farmWhatsappPendingContext.expiresAt, now)
                )
            ).orderBy(desc(farmWhatsappPendingContext.createdAt)).limit(1);

            if (!ctx) return res.json({ handled: false });

            const search = message.trim();
            const data = (ctx.data as any) || {};

            if (ctx.step === "awaiting_equipment") {
                const allEquipment = await db.select().from(farmEquipment).where(eq(farmEquipment.farmerId, farmer.id));
                const skipOption = allEquipment.length + 1;
                const idx = parseInt(search) - 1;

                let equip: any = null;
                if (!isNaN(idx) && idx >= 0 && idx < allEquipment.length) {
                    equip = allEquipment[idx];
                } else if (parseInt(search) === skipOption) {
                    equip = null;
                } else {
                    equip = allEquipment.find(e => e.name.toLowerCase().includes(search.toLowerCase()));
                    if (!equip) {
                        const equipList = allEquipment.map((e, i) => `${i + 1}️⃣ ${e.name}`).join("\n");
                        return res.json({ handled: true, reply: `Não entendi. Responda com o número:\n${equipList}\n${skipOption}️⃣ Nenhuma` });
                    }
                }

                if (equip && ctx.expenseId) {
                    const [exp] = await db.select().from(farmExpenses).where(eq(farmExpenses.id, ctx.expenseId)).limit(1);
                    await db.update(farmExpenses).set({
                        equipmentId: equip.id,
                        description: `${exp?.description || ""} (Equipamento: ${equip.name})`,
                    }).where(eq(farmExpenses.id, ctx.expenseId));
                }

                const accounts = await db.select().from(farmCashAccounts).where(
                    and(eq(farmCashAccounts.farmerId, farmer.id), eq(farmCashAccounts.isActive, true))
                );
                const equipMsg = equip ? `🚜 Máquina: *${equip.name}* ✅` : `🚜 Sem vínculo de máquina ✅`;

                let pmIdx = 1;
                const pmLines: string[] = [];
                for (const a of accounts) { pmLines.push(`${pmIdx}️⃣ ${a.name} (${a.currency})`); pmIdx++; }
                pmLines.push(`${pmIdx}️⃣ Efetivo (bolso)`);
                pmIdx++;
                pmLines.push(`${pmIdx}️⃣ Financiado (safra)`);

                await db.update(farmWhatsappPendingContext).set({
                    step: "awaiting_payment_method",
                    data: { ...data, equipmentId: equip?.id || null, equipmentName: equip?.name || null },
                }).where(eq(farmWhatsappPendingContext.id, ctx.id));
                return res.json({ handled: true, reply: `${equipMsg}\n\nQual a forma de pagamento?\n${pmLines.join("\n")}` });
            }

            if (ctx.step === "awaiting_payment_method") {
                const accounts = await db.select().from(farmCashAccounts).where(
                    and(eq(farmCashAccounts.farmerId, farmer.id), eq(farmCashAccounts.isActive, true))
                );
                const efIndex = accounts.length + 1;
                const finIndex = accounts.length + 2;
                const idx = parseInt(search);

                if (idx === finIndex || search.toLowerCase().includes("financ") || search.toLowerCase().includes("safra")) {
                    const { farmSeasons } = await import("../shared/schema");
                    const seasons = await db.select().from(farmSeasons).where(
                        and(eq(farmSeasons.farmerId, farmer.id), eq(farmSeasons.isActive, true))
                    );
                    if (seasons.length > 0) {
                        await db.update(farmWhatsappPendingContext).set({
                            step: "awaiting_season",
                            data: { ...data, paymentType: "financiado" },
                        }).where(eq(farmWhatsappPendingContext.id, ctx.id));
                        const seasonList = seasons.map((s, i) => {
                            const endStr = s.endDate ? new Date(s.endDate).toLocaleDateString("pt-BR") : "sem data";
                            return `${i + 1}️⃣ ${s.name} (vence: ${endStr})`;
                        }).join("\n");
                        return res.json({ handled: true, reply: `Financiado ✅\n\nEm qual safra será pago?\n${seasonList}` });
                    }
                    if (ctx.expenseId) {
                        await db.update(farmExpenses).set({ paymentType: "financiado", paymentStatus: "pendente" }).where(eq(farmExpenses.id, ctx.expenseId));
                    }
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const amtF = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
                    const sumF = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtF}*`];
                    if (data.supplierName) sumF.push(`🏪 Fornecedor: *${data.supplierName}*`);
                    if (data.equipmentName) sumF.push(`🚜 Máquina: *${data.equipmentName}*`);
                    sumF.push(`💳 Pagamento: *Financiado*`);
                    sumF.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                    return res.json({ handled: true, reply: sumF.join("\n") });
                }

                if (idx === efIndex || search.toLowerCase().includes("efetivo") || search.toLowerCase().includes("bolso") || search.toLowerCase().includes("dinheiro")) {
                    if (ctx.expenseId) {
                        await db.update(farmExpenses).set({ paymentType: "a_vista", paymentStatus: "pago" }).where(eq(farmExpenses.id, ctx.expenseId));
                    }
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const amtE = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
                    const sumE = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtE}*`];
                    if (data.supplierName) sumE.push(`🏪 Fornecedor: *${data.supplierName}*`);
                    if (data.equipmentName) sumE.push(`🚜 Máquina: *${data.equipmentName}*`);
                    sumE.push(`💳 Pagamento: *Efetivo (bolso)* 💵`);
                    sumE.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                    return res.json({ handled: true, reply: sumE.join("\n") });
                }

                const acctIdx = idx - 1;
                let matched: any = null;
                if (!isNaN(acctIdx) && acctIdx >= 0 && acctIdx < accounts.length) {
                    matched = accounts[acctIdx];
                } else {
                    matched = accounts.find(a => a.name.toLowerCase().includes(search.toLowerCase()));
                }

                if (!matched) {
                    let ri = 1;
                    const rLines: string[] = [];
                    for (const a of accounts) { rLines.push(`${ri}️⃣ ${a.name} (${a.currency})`); ri++; }
                    rLines.push(`${ri}️⃣ Efetivo (bolso)`); ri++;
                    rLines.push(`${ri}️⃣ Financiado (safra)`);
                    return res.json({ handled: true, reply: `Não entendi. Responda com o número:\n${rLines.join("\n")}` });
                }

                let expAmount = 0;
                let expCategory = data.category || "";
                if (ctx.expenseId) {
                    const [exp] = await db.select().from(farmExpenses).where(eq(farmExpenses.id, ctx.expenseId)).limit(1);
                    if (exp) {
                        expAmount = parseFloat(exp.amount as string) || 0;
                        expCategory = exp.category;
                        await db.update(farmExpenses).set({ paymentType: "a_vista", paymentStatus: "pago", paidAmount: String(expAmount) }).where(eq(farmExpenses.id, ctx.expenseId));
                        await db.insert(farmCashTransactions).values({
                            farmerId: farmer.id, accountId: matched.id, type: "saida",
                            amount: String(expAmount), currency: matched.currency, category: expCategory,
                            description: exp.description?.replace(/\[Via WhatsApp\]\s*(\[[^\]]*\]\s*)?/, "").trim() || "Despesa WhatsApp",
                            paymentMethod: "transferencia", expenseId: exp.id, referenceType: "whatsapp",
                        });
                        await db.update(farmCashAccounts)
                            .set({ currentBalance: sqlFn`current_balance - ${expAmount}` })
                            .where(eq(farmCashAccounts.id, matched.id));
                    }
                }
                await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                const amtA = data.amount ? parseFloat(data.amount).toFixed(2) : (expAmount || 0).toFixed(2);
                const sumA = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtA}*`];
                if (data.supplierName) sumA.push(`🏪 Fornecedor: *${data.supplierName}*`);
                if (expCategory) sumA.push(`📋 Categoria: *${expCategory}*`);
                if (data.equipmentName) sumA.push(`🚜 Máquina: *${data.equipmentName}*`);
                sumA.push(`🏦 Conta: *${matched.name}*`);
                sumA.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                return res.json({ handled: true, reply: sumA.join("\n") });
            }

            if (ctx.step === "awaiting_season") {
                const { farmSeasons } = await import("../shared/schema");
                const seasons = await db.select().from(farmSeasons).where(
                    and(eq(farmSeasons.farmerId, farmer.id), eq(farmSeasons.isActive, true))
                );
                const sIdx = parseInt(search) - 1;
                let season: any = null;
                if (!isNaN(sIdx) && sIdx >= 0 && sIdx < seasons.length) {
                    season = seasons[sIdx];
                } else {
                    season = seasons.find(s => s.name.toLowerCase().includes(search.toLowerCase()));
                }
                if (!season) {
                    const sList = seasons.map((s, i) => {
                        const endStr = s.endDate ? new Date(s.endDate).toLocaleDateString("pt-BR") : "sem data";
                        return `${i + 1}️⃣ ${s.name} (vence: ${endStr})`;
                    }).join("\n");
                    return res.json({ handled: true, reply: `Não entendi. Responda com o número:\n${sList}` });
                }

                if (ctx.expenseId) {
                    await db.update(farmExpenses).set({
                        paymentType: "financiado",
                        paymentStatus: "pendente",
                        dueDate: season.endDate || null,
                    }).where(eq(farmExpenses.id, ctx.expenseId));
                }
                await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                const dueStr = season.endDate ? new Date(season.endDate).toLocaleDateString("pt-BR") : "sem data";
                const amtS = data.amount ? parseFloat(data.amount).toFixed(2) : "0.00";
                const sumS = [`✅ *Despesa registrada!*`, ``, `💰 Valor: *$ ${amtS}*`];
                if (data.supplierName) sumS.push(`🏪 Fornecedor: *${data.supplierName}*`);
                if (data.category) sumS.push(`📋 Categoria: *${data.category}*`);
                if (data.equipmentName) sumS.push(`🚜 Máquina: *${data.equipmentName}*`);
                sumS.push(`💳 Pagamento: *Financiado*`);
                sumS.push(`📅 Safra: *${season.name}* (vence: ${dueStr})`);
                sumS.push(`\nAguardando aprovação no painel da AgroFarm! 🌾`);
                return res.json({ handled: true, reply: sumS.join("\n") });
            }

            // ===== ROMANEIO: Awaiting plot selection =====
            if (ctx.step === "awaiting_romaneio_plot") {
                const { farmPlots, farmRomaneios, farmSeasons, farmAccountsReceivable, farmGrainStock } = await import("../shared/schema");
                const { and: andOp, desc: descOp } = await import("drizzle-orm");
                const plots = await db.select({ id: farmPlots.id, name: farmPlots.name })
                    .from(farmPlots)
                    .where(sql`${farmPlots.propertyId} IN (
                        SELECT id FROM farm_properties WHERE farmer_id = ${farmer.id}
                    )`);

                const pIdx = parseInt(search) - 1;
                let selectedPlot: any = null;
                if (!isNaN(pIdx) && pIdx >= 0 && pIdx < plots.length) {
                    selectedPlot = plots[pIdx];
                } else {
                    selectedPlot = plots.find(p => p.name.toLowerCase().includes(search.toLowerCase()));
                }

                if (!selectedPlot) {
                    const pList = plots.map((p, i) => `${i + 1}️⃣ ${p.name}`).join("\n");
                    return res.json({ handled: true, reply: `Não entendi. Responda com o número do talhão:\n${pList}` });
                }

                // Auto-select current active season
                let seasonId: string | null = null;
                try {
                    const seasons = await db.select({ id: farmSeasons.id })
                        .from(farmSeasons)
                        .where(andOp(eq(farmSeasons.farmerId, farmer.id), eq(farmSeasons.isActive, true)))
                        .orderBy(descOp(farmSeasons.createdAt))
                        .limit(1);
                    if (seasons.length > 0) seasonId = seasons[0].id;
                } catch (_) { /* seasons table may not exist */ }

                // Update romaneio with plot, season, and confirm
                if (data.romaneioId) {
                    const updateFields: any = {
                        plotId: selectedPlot.id,
                        status: "confirmed",
                    };
                    if (seasonId) updateFields.seasonId = seasonId;

                    const [confirmed] = await db.update(farmRomaneios).set(updateFields)
                        .where(eq(farmRomaneios.id, data.romaneioId))
                        .returning();

                    // AUTO: Create Conta a Receber (same logic as /confirm endpoint)
                    if (confirmed && confirmed.totalValue && parseFloat(confirmed.totalValue) > 0) {
                        try {
                            const dueDate = new Date(confirmed.deliveryDate);
                            dueDate.setDate(dueDate.getDate() + 30);
                            await db.insert(farmAccountsReceivable).values({
                                farmerId: farmer.id,
                                romaneioId: confirmed.id,
                                buyer: confirmed.buyer,
                                description: `${confirmed.crop} - Ticket ${confirmed.ticketNumber || 'S/N'} - ${(parseFloat(confirmed.finalWeight) / 1000).toFixed(2)} ton`,
                                totalAmount: confirmed.totalValue,
                                currency: confirmed.currency,
                                dueDate: dueDate.toISOString(),
                                status: "pendente",
                            });
                        } catch (arErr) { console.error("[WHATSAPP_CONFIRM→AR]", arErr); }
                    }

                    // AUTO: Grain stock entry (same logic as /confirm endpoint)
                    if (confirmed && confirmed.crop && confirmed.finalWeight) {
                        try {
                            const cropNorm = confirmed.crop.toLowerCase().trim();
                            const qty = parseFloat(confirmed.finalWeight);
                            const existing = await db.select().from(farmGrainStock).where(
                                andOp(eq(farmGrainStock.farmerId, farmer.id), eq(farmGrainStock.crop, cropNorm), eq(farmGrainStock.seasonId, seasonId || ''))
                            );
                            if (existing.length > 0) {
                                await db.update(farmGrainStock)
                                    .set({ quantity: sql`CAST(${farmGrainStock.quantity} AS NUMERIC) + ${qty}`, updatedAt: new Date() })
                                    .where(eq(farmGrainStock.id, existing[0].id));
                            } else {
                                await db.insert(farmGrainStock).values({
                                    farmerId: farmer.id, crop: cropNorm, seasonId: seasonId || null,
                                    quantity: String(qty),
                                });
                            }
                            console.log(`[WHATSAPP_CONFIRM→GRAIN_STOCK] +${qty}kg ${cropNorm}`);
                        } catch (gsErr) { console.error("[WHATSAPP_CONFIRM→GRAIN_STOCK]", gsErr); }
                    }
                }
                await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                return res.json({ handled: true, reply: `✅ Romaneio confirmado no talhão *${selectedPlot.name}*! 🌾\n\nJá está disponível no painel da AgroFarm.` });
            }

            // ===== UNKNOWN IMAGE: Awaiting user classification =====
            if (ctx.step === "awaiting_image_type") {
                const choice = parseInt(search);

                if (choice === 1) {
                    // Fatura de insumos — re-process as invoice
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const { farmExpenses } = await import("../shared/schema");
                    const amt = data.amount ? parseFloat(data.amount) : 0;
                    const desc = data.caption || "Fatura via WhatsApp (classificação manual)";

                    // Create as a generic pending invoice for review
                    const { farmInvoices } = await import("../shared/schema");
                    await db.insert(farmInvoices).values({
                        farmerId: farmer.id,
                        totalAmount: String(amt || 0),
                        notes: `[Via WhatsApp - Manual] ${desc}`,
                        status: 'pending',
                        supplier: "Via WhatsApp",
                        invoiceNumber: `WPP-${Date.now().toString().slice(-6)}`
                    });
                    return res.json({ handled: true, reply: `✅ Registrado como *fatura de insumos*! Revise os detalhes no painel da AgroFarm. 🌾` });
                }

                if (choice === 2) {
                    // Despesa — create expense
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const desc = data.caption || "Despesa via WhatsApp (classificação manual)";

                    await db.insert(farmExpenses).values({
                        farmerId: farmer.id,
                        amount: String(data.amount || 0),
                        description: `[Via WhatsApp - Manual] ${desc}`,
                        category: 'outro',
                        imageBase64: data.imageBase64 || null,
                        status: 'pending',
                    });
                    return res.json({ handled: true, reply: `✅ Registrado como *despesa*! Revise os detalhes no painel da AgroFarm. 🌾` });
                }

                if (choice === 3) {
                    // Romaneio — tell user to send via romaneio flow
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    return res.json({ handled: true, reply: `📦 Para romaneios, envie a foto novamente e eu vou tentar extrair os dados de pesagem automaticamente! 🌾` });
                }

                if (choice === 4) {
                    // Outro recibo — create generic expense
                    await db.delete(farmWhatsappPendingContext).where(eq(farmWhatsappPendingContext.id, ctx.id));
                    const desc = data.caption || "Recibo via WhatsApp";

                    await db.insert(farmExpenses).values({
                        farmerId: farmer.id,
                        amount: String(data.amount || 0),
                        description: `[Via WhatsApp - Recibo] ${desc}`,
                        category: 'outro',
                        imageBase64: data.imageBase64 || null,
                        status: 'pending',
                    });
                    return res.json({ handled: true, reply: `✅ Recibo registrado! Revise os detalhes no painel da AgroFarm. 🌾` });
                }

                return res.json({ handled: true, reply: `Responda com o número:\n1️⃣ Fatura de insumos\n2️⃣ Despesa (peças/serviços)\n3️⃣ Romaneio (grãos)\n4️⃣ Outro recibo` });
            }

            return res.json({ handled: false });
        } catch (error) {
            console.error("[CHECK_PENDING_CONTEXT]", error);
            return res.json({ handled: false });
        }
    });

    app.post("/api/farm/webhook/n8n/receipt", requireWebhookSecret, async (req, res) => {
        try {
            const { whatsapp_number, imageUrl, caption } = req.body;
            if (!whatsapp_number) {
                return res.status(400).json({ error: "whatsapp_number is required" });
            }
            if (!imageUrl) {
                return res.status(400).json({ error: "imageUrl is required" });
            }

            console.log(`[WEBHOOK_N8N_RECEIPT] phone=${whatsapp_number}, caption="${caption || ''}", imageUrl=${imageUrl?.substring(0, 60)}...`);

            // Find farmer by phone number
            const { users, farmExpenses, farmInvoices, farmInvoiceItems, farmEquipment } = await import("../shared/schema");
            const { eq, or, sql, and, ilike, gt } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number);

            // Search by main number or extra numbers
            const farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            if (farmers.length === 0) {
                return res.status(404).json({ error: "Farmer not found for this phone number" });
            }

            const farmer = farmers[0];

            // Download image from Z-API URL
            console.log(`[WEBHOOK_N8N_RECEIPT] Downloading image from: ${imageUrl}`);
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Failed to download image from Z-API: ${imageResponse.statusText}`);
            }

            const arrayBuffer = await imageResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

            if (!mimeType.startsWith('image/') && !mimeType.includes('pdf')) {
                return res.status(400).json({ error: "Downloaded file is not an image or PDF" });
            }

            const base64Image = buffer.toString("base64");

            // Use shared Gemini parser (single source of truth for extraction)
            const { parseWithGemini } = await import("./gemini-invoice-parser");
            let parsed;
            try {
                parsed = await parseWithGemini(base64Image, mimeType);
            } catch (e) {
                return res.status(400).json({ error: "Failed to parse image content" });
            }

            // Fallback detecção remissão: se Gemini disse "invoice" mas texto/dados indicam remissão
            if (parsed.type === "invoice") {
                const textUpper = (parsed.description || "").toUpperCase();
                const hasRemisionText = textUpper.includes("REMISION") || textUpper.includes("REMISSAO") || textUpper.includes("GUIA DE REMESSA");
                const allZeroPrice = parsed.items.length > 0 && parsed.items.every(item => !item.unitPrice || item.unitPrice === 0);
                const zeroTotal = !parsed.totalAmount || parsed.totalAmount === 0;
                if (hasRemisionText || (allZeroPrice && zeroTotal)) {
                    (parsed as any).type = "remision";
                    console.log(`[WHATSAPP_WEBHOOK] Fallback: reclassificado de invoice para remision (texto=${hasRemisionText}, preços_zero=${allZeroPrice && zeroTotal})`);
                }
            }

            const amount = parsed.totalAmount;

            // Try to match equipment from caption (for vehicle/fleet receipts)
            let matchedEquipmentId: string | null = null;
            const normalizedCaption = (caption || "").trim();
            if (parsed.type === "expense" && normalizedCaption) {
                const equipmentMatch = await db.select().from(farmEquipment).where(
                    and(
                        eq(farmEquipment.farmerId, farmer.id),
                        ilike(farmEquipment.name, `%${normalizedCaption}%`)
                    )
                ).limit(1);
                if (equipmentMatch.length > 0) {
                    matchedEquipmentId = equipmentMatch[0].id;
                }
            }

            if (parsed.type === "expense") {
                const { farmExpenseItems } = await import("../shared/schema");
                const supplierName = parsed.supplier || "";

                const recentExpenses = await db.select({
                    id: farmExpenses.id, supplier: farmExpenses.supplier,
                    amount: farmExpenses.amount, expenseDate: farmExpenses.expenseDate,
                }).from(farmExpenses).where(eq(farmExpenses.farmerId, farmer.id));

                const expDuplicate = recentExpenses.find(e => {
                    const eAmt = parseFloat(e.amount as string) || 0;
                    const sameAmt = Math.abs(eAmt - amount) < 0.01;
                    const sameSup = supplierName && e.supplier &&
                        e.supplier.toLowerCase().includes(supplierName.toLowerCase().substring(0, 8));
                    const recentDate = e.expenseDate && (Date.now() - new Date(e.expenseDate).getTime()) < 24 * 60 * 60 * 1000;
                    return sameAmt && sameSup && recentDate;
                });

                if (expDuplicate) {
                    return res.json({
                        message: `⚠️ *Recibo possivelmente duplicado!*\n\nJá existe uma despesa recente com dados semelhantes:\n• Fornecedor: ${expDuplicate.supplier || 'N/A'}\n• Valor: $ ${(parseFloat(expDuplicate.amount as string) || 0).toFixed(2)}\n\nEsse recibo *não foi cadastrado* para evitar duplicidade. Verifique no painel.`
                    });
                }
                const descParts = [`[Via WhatsApp]`];
                if (supplierName) descParts.push(`[${supplierName}]`);
                descParts.push(parsed.description || "Despesa");

                const [newExpense] = await db.insert(farmExpenses).values({
                    farmerId: farmer.id,
                    equipmentId: matchedEquipmentId,
                    supplier: supplierName || null,
                    amount: String(amount),
                    description: descParts.join(" "),
                    category: parsed.category || 'outro',
                    imageBase64: base64Image,
                    status: 'pending',
                }).returning();

                let itemsCount = 0;
                if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    for (const item of parsed.items) {
                        const q = parseFloat(item.quantity) || 1;
                        const uPrice = parseFloat(item.unitPrice) || 0;
                        const tPrice = parseFloat(item.totalPrice) || (q * uPrice);
                        await db.insert(farmExpenseItems).values({
                            expenseId: newExpense.id,
                            itemName: item.productName || "Item",
                            quantity: String(q),
                            unit: item.unit || "UN",
                            unitPrice: String(uPrice),
                            totalPrice: String(tPrice),
                        });
                        itemsCount++;
                    }
                }

                const itemsMsg = itemsCount > 0 ? ` com ${itemsCount} itens` : '';
                const { farmWhatsappPendingContext, farmCashAccounts } = await import("../shared/schema");
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

                const accounts = await db.select().from(farmCashAccounts).where(
                    and(eq(farmCashAccounts.farmerId, farmer.id), eq(farmCashAccounts.isActive, true))
                );
                const allEquipment = await db.select().from(farmEquipment).where(
                    eq(farmEquipment.farmerId, farmer.id)
                );

                const header = `✅ Recibo de *$ ${amount.toFixed(2)}*${supplierName ? ` da *${supplierName}*` : ''} (${parsed.category})${itemsMsg} recebido!`;

                const buildPaymentQuestion = (accts: any[]) => {
                    let idx = 1;
                    const lines: string[] = [];
                    for (const a of accts) { lines.push(`${idx}️⃣ ${a.name} (${a.currency})`); idx++; }
                    lines.push(`${idx}️⃣ Efetivo (bolso)`);
                    idx++;
                    lines.push(`${idx}️⃣ Financiado (safra)`);
                    return { text: lines.join("\n"), efIndex: idx - 1, finIndex: idx };
                };

                if (matchedEquipmentId) {
                    const matchedEquip = allEquipment.find(e => e.id === matchedEquipmentId);
                    const pq = buildPaymentQuestion(accounts);
                    await db.insert(farmWhatsappPendingContext).values({
                        farmerId: farmer.id, phone: formattedPhone, step: "awaiting_payment_method",
                        expenseId: newExpense.id,
                        data: { equipmentId: matchedEquipmentId, equipmentName: matchedEquip?.name, supplierName, amount, category: parsed.category },
                        expiresAt,
                    });
                    return res.json({
                        message: `${header}\n🚜 Máquina: *${matchedEquip?.name}*\n\nQual a forma de pagamento?\n${pq.text}`
                    });
                }

                if (allEquipment.length > 0) {
                    await db.insert(farmWhatsappPendingContext).values({
                        farmerId: farmer.id, phone: formattedPhone, step: "awaiting_equipment",
                        expenseId: newExpense.id,
                        data: { supplierName, amount, category: parsed.category },
                        expiresAt,
                    });
                    const equipList = allEquipment.map((e, i) => `${i + 1}️⃣ ${e.name}`).join("\n");
                    return res.json({
                        message: `${header}\n\nDe qual máquina/veículo é essa despesa?\n${equipList}\n${allEquipment.length + 1}️⃣ Nenhuma (não vincular)`
                    });
                }

                const pq = buildPaymentQuestion(accounts);
                await db.insert(farmWhatsappPendingContext).values({
                    farmerId: farmer.id, phone: formattedPhone, step: "awaiting_payment_method",
                    expenseId: newExpense.id,
                    data: { supplierName, amount, category: parsed.category },
                    expiresAt,
                });
                return res.json({
                    message: `${header}\n\nQual a forma de pagamento?\n${pq.text}`
                });
            }
            else if (parsed.type === "invoice") {
                const existingInvs = await db.select({
                    id: farmInvoices.id, invoiceNumber: farmInvoices.invoiceNumber,
                    supplier: farmInvoices.supplier, totalAmount: farmInvoices.totalAmount,
                    documentType: farmInvoices.documentType,
                }).from(farmInvoices).where(eq(farmInvoices.farmerId, farmer.id));

                // Duplicate check: requires matching invoice NUMBER + (same amount OR same supplier)
                // Never flag as duplicate based only on supplier+amount (different invoices can have same value)
                const invDuplicate = existingInvs.filter(inv => inv.documentType !== "remision").find(inv => {
                    const invAmt = parseFloat(inv.totalAmount as string) || 0;
                    const sameNum = parsed.invoiceNumber && inv.invoiceNumber &&
                        inv.invoiceNumber.replace(/\D/g, '') === String(parsed.invoiceNumber).replace(/\D/g, '');
                    if (!sameNum) return false; // Different invoice numbers = never duplicate
                    const sameSup = parsed.supplier && inv.supplier &&
                        inv.supplier.toLowerCase().includes(String(parsed.supplier).toLowerCase().substring(0, 10));
                    const sameAmt = Math.abs(invAmt - amount) < 0.01;
                    return sameAmt || sameSup;
                });

                if (invDuplicate) {
                    return res.json({
                        message: `⚠️ *Fatura possivelmente duplicada!*\n\nJá existe uma fatura no sistema com dados semelhantes:\n• Nº: ${invDuplicate.invoiceNumber || 'N/A'}\n• Fornecedor: ${invDuplicate.supplier || 'N/A'}\n• Valor: $ ${(parseFloat(invDuplicate.totalAmount as string) || 0).toFixed(2)}\n\nEssa fatura *não foi cadastrada* para evitar duplicidade. Verifique no painel.`
                    });
                }

                // Parse dates from Gemini response
                const detectedCurrency = parsed.currency || (amount > 10000 ? "PYG" : "USD");
                const safeDateParse = (d: string | null | undefined): Date | null => {
                    if (!d) return null;
                    const s = String(d);
                    return new Date(s.length === 10 ? s + "T12:00:00" : s);
                };
                const invoiceIssueDate = safeDateParse(parsed.issueDate);
                const invoiceDueDate = safeDateParse(parsed.dueDate);

                // Auto-link to season based on dueDate (or issueDate, or now)
                const dateForSeason = invoiceDueDate || invoiceIssueDate || new Date();
                let seasonId = null;
                let seasonName: string | null = null;
                try {
                    const seasons = await farmStorage.getSeasons(farmer.id);
                    const matchedSeason = seasons.find((s: any) => {
                        if (!s.paymentStartDate || !s.paymentEndDate) return false;
                        const start = new Date(s.paymentStartDate);
                        const end = new Date(s.paymentEndDate);
                        return dateForSeason >= start && dateForSeason <= end;
                    });
                    if (matchedSeason) {
                        seasonId = matchedSeason.id;
                        seasonName = matchedSeason.name;
                    }
                } catch (err) {
                    console.error("[WEBHOOK_INVOICE_SEASON]", err);
                }

                // Auto-register supplier if not exists — fuzzy dedup to prevent duplicates
                let supplierId = null;
                if (parsed.supplier) {
                    try {
                        const supplierRuc = parsed.supplierRuc || null;
                        const supplierPhone = parsed.supplierPhone || null;
                        const supplierEmail = parsed.supplierEmail || null;
                        const supplierAddress = parsed.supplierAddress || null;

                        const similar = await findSimilarSuppliers(db, sql, farmer.id, parsed.supplier, supplierRuc);

                        if (similar.length > 0 && similar[0].similarity >= 0.85) {
                            // High confidence match — link and fill any missing fields
                            supplierId = similar[0].id;
                            await fillMissingSupplierFields(db, sql, supplierId, { ruc: supplierRuc, phone: supplierPhone, email: supplierEmail, address: supplierAddress });
                            console.log(`[WEBHOOK_INVOICE_SUPPLIER] Linked supplier id=${supplierId} for "${parsed.supplier}" (similarity=${similar[0].similarity.toFixed(2)}, by=${similar[0].matchedBy})`);
                        } else {
                            // No good match — create new supplier
                            const newSup = await db.execute(sql`
                                INSERT INTO farm_suppliers (farmer_id, name, ruc, phone, email, address, person_type, entity_type)
                                VALUES (${farmer.id}, ${parsed.supplier}, ${supplierRuc}, ${supplierPhone}, ${supplierEmail}, ${supplierAddress}, 'provedor', 'juridica')
                                RETURNING id
                            `);
                            supplierId = ((newSup as any).rows ?? newSup)[0]?.id;
                            console.log(`[WEBHOOK_INVOICE_SUPPLIER] Created supplier id=${supplierId}: "${parsed.supplier}" RUC: ${supplierRuc}`);
                        }
                    } catch (err) {
                        console.error("[WEBHOOK_INVOICE_SUPPLIER]", err);
                    }
                }

                const [newInvoice] = await db.insert(farmInvoices).values({
                    farmerId: farmer.id,
                    totalAmount: String(amount),
                    currency: detectedCurrency,
                    issueDate: invoiceIssueDate || new Date(),
                    dueDate: invoiceDueDate || null,
                    notes: `[Via WhatsApp] ${parsed.description}`,
                    status: 'pending',
                    supplier: parsed.supplier || "Via WhatsApp",
                    invoiceNumber: parsed.invoiceNumber || `WPP-${Date.now().toString().slice(-6)}`,
                    seasonId,
                    supplierId,
                    source: "whatsapp",
                    pdfBase64: base64Image,
                    fileMimeType: mimeType,
                }).returning();

                const allProducts = await farmStorage.getAllProducts();
                let itemsCount = 0;

                if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
                    for (const item of parsed.items) {
                        const q = parseFloat(item.quantity) || 1;
                        const uPrice = parseFloat(item.unitPrice) || 0;
                        const tPrice = parseFloat(item.totalPrice) || (q * uPrice);

                        // Try to match product by name (fuzzy)
                        let matchedProduct = allProducts.find(p =>
                            p.name.toUpperCase().includes(item.productName.toUpperCase().substring(0, 10)) ||
                            item.productName.toUpperCase().includes(p.name.toUpperCase().substring(0, 10))
                        );

                        // Auto-create product if not found in catalog
                        if (!matchedProduct) {
                            try {
                                matchedProduct = await farmStorage.createProduct({
                                    name: item.productName,
                                    unit: item.unit || "UN",
                                    category: null,
                                    dosePerHa: null,
                                    activeIngredient: null,
                                    status: "pending_review",
                                    isDraft: true
                                });
                                allProducts.push(matchedProduct); // Add to list to avoid duplicates in same invoice
                            } catch (err) {
                                console.error(`[FARM_WEBHOOK_RECEIPT] Failed to auto-create product: ${item.productName}`, err);
                            }
                        }

                        await db.insert(farmInvoiceItems).values({
                            invoiceId: newInvoice.id,
                            productId: matchedProduct?.id || null,
                            productName: item.productName || "Produto Desconhecido",
                            quantity: String(q),
                            unit: item.unit || "UN",
                            unitPrice: String(uPrice),
                            totalPrice: String(tPrice)
                        });
                        itemsCount++;
                    }
                }

                // Build detailed WhatsApp response message
                const itemsList = (parsed.items || []).map((it: any, idx: number) =>
                    `  ${idx + 1}. ${it.productName} — ${it.quantity} ${it.unit || 'UN'} x $${(parseFloat(it.unitPrice) || 0).toFixed(2)} = $${(parseFloat(it.totalPrice) || 0).toFixed(2)}`
                ).join('\n');

                const issueDateStr = invoiceIssueDate ? invoiceIssueDate.toLocaleDateString('pt-BR') : '—';
                const dueDateStr = invoiceDueDate ? invoiceDueDate.toLocaleDateString('pt-BR') : '—';
                const currSymbol = detectedCurrency === 'PYG' ? 'Gs.' : '$';

                let msg = `✅ *Fatura recebida!*\n\n`;
                msg += `📋 *Nº:* ${newInvoice.invoiceNumber || 'S/N'}\n`;
                msg += `🏢 *Fornecedor:* ${parsed.supplier || 'Desconhecido'}\n`;
                msg += `📅 *Emissão:* ${issueDateStr}\n`;
                msg += `📆 *Vencimento:* ${dueDateStr}\n`;
                msg += `💰 *Total:* ${currSymbol} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
                msg += `💱 *Moeda:* ${detectedCurrency}\n`;
                if (seasonName) msg += `🌱 *Safra:* ${seasonName}\n`;
                if (itemsCount > 0) {
                    msg += `\n📦 *Itens (${itemsCount}):*\n${itemsList}\n`;
                }

                // Auto-detect matching remissions
                try {
                    const allFarmInvoices = await farmStorage.getInvoices(farmer.id);
                    const remissions = allFarmInvoices.filter((inv: any) =>
                        (inv.documentType || "factura") === "remision" &&
                        (inv.status === "confirmed" || inv.status === "pending") &&
                        !inv.linkedInvoiceId &&
                        inv.supplier && parsed.supplier &&
                        inv.supplier.toLowerCase().includes(parsed.supplier.toLowerCase().substring(0, 10))
                    );
                    if (remissions.length > 0) {
                        msg += `\n⚠️ *ATENCAO: ${remissions.length} remissao(oes) encontrada(s) deste fornecedor!*\n`;
                        msg += `_Acesse o painel para conciliar a fatura com a remissao._\n`;
                        console.log(`[WHATSAPP_AUTO_MATCH] Invoice ${newInvoice.id} matched ${remissions.length} remission(s)`);
                    }
                } catch (matchErr) {
                    console.error("[WHATSAPP_AUTO_MATCH]", matchErr);
                }

                msg += `\n_Aguardando sua revisão no painel AgroFarm._`;

                return res.json({ message: msg });
            }
            else if (parsed.type === "romaneio") {
                // ===== ROMANEIO (Grain Delivery Ticket) =====
                const rd = parsed.romaneioData || {};
                const { farmRomaneios, farmPlots, farmWhatsappPendingContext } = await import("../shared/schema");

                const grossW = parseFloat(rd.grossWeight) || 0;
                const tareW = parseFloat(rd.tare) || 0;
                const netW = rd.netWeight ? parseFloat(rd.netWeight) : (grossW - tareW);
                const moistureVal = rd.moisture != null ? parseFloat(rd.moisture) : null;
                const impurityVal = rd.impurities != null ? parseFloat(rd.impurities) : null;
                const moistureDisc = moistureVal != null && moistureVal > 14 ? netW * ((moistureVal - 14) / 100) : 0;
                const impurityDisc = impurityVal != null && impurityVal > 1 ? netW * ((impurityVal - 1) / 100) : 0;
                const finalW = rd.finalWeight ? parseFloat(rd.finalWeight) : Math.max(0, netW - moistureDisc - impurityDisc);

                // DEDUPLICATION: check if romaneio with same ticket_number already exists for this farmer
                const ticketNum = rd.ticketNumber || null;
                if (ticketNum) {
                    const { eq, and } = await import("drizzle-orm");
                    const existingRom = await db.select({ id: farmRomaneios.id, status: farmRomaneios.status })
                        .from(farmRomaneios)
                        .where(and(
                            eq(farmRomaneios.farmerId, farmer.id),
                            eq(farmRomaneios.ticketNumber, ticketNum)
                        ))
                        .limit(1);
                    if (existingRom.length > 0) {
                        console.log(`[ROMANEIO_DEDUP] Ticket #${ticketNum} already exists for farmer ${farmer.id}, skipping`);
                        return res.json({ message: `Romaneio #${ticketNum} ja foi registrado anteriormente. Verifique no painel da AgroFarm.` });
                    }
                }

                const [romaneio] = await db.insert(farmRomaneios).values({
                    farmerId: farmer.id,
                    buyer: rd.buyer || parsed.supplier || "Desconhecido",
                    crop: rd.crop || "Soja",
                    deliveryDate: rd.deliveryDate ? (parseLocalDate(rd.deliveryDate) || new Date()) : new Date(),
                    grossWeight: String(grossW),
                    tare: String(tareW),
                    netWeight: String(netW),
                    finalWeight: String(finalW),
                    moisture: moistureVal != null ? String(moistureVal) : null,
                    impurities: impurityVal != null ? String(impurityVal) : null,
                    moistureDiscount: String(moistureDisc),
                    impurityDiscount: String(impurityDisc),
                    pricePerTon: rd.pricePerTon != null ? String(rd.pricePerTon) : null,
                    totalValue: rd.totalValue != null ? String(rd.totalValue) : null,
                    currency: rd.currency || "USD",
                    truckPlate: rd.truckPlate || null,
                    ticketNumber: ticketNum,
                    driver: rd.driver || null,
                    discounts: rd.discounts || null,
                    source: "whatsapp",
                    status: "pending",
                    notes: caption || "",
                    pdfBase64: base64Image,
                    fileMimeType: mimeType,
                }).returning();

                // Get plots for the farmer
                const plots = await db.select({ id: farmPlots.id, name: farmPlots.name })
                    .from(farmPlots)
                    .where(sql`${farmPlots.propertyId} IN (
                        SELECT id FROM farm_properties WHERE farmer_id = ${farmer.id}
                    )`);

                if (plots.length > 0) {
                    // Save pending context to await plot selection
                    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
                    await db.insert(farmWhatsappPendingContext).values({
                        farmerId: farmer.id,
                        phone: formattedPhone,
                        step: "awaiting_romaneio_plot",
                        expenseId: null,
                        data: { romaneioId: romaneio.id },
                        expiresAt,
                    });
                }

                const plotList = plots.map((p, i) => `${i + 1}️⃣ ${p.name}`).join("\n");
                const deliveryDateStr = rd.deliveryDate
                    ? (parseLocalDate(rd.deliveryDate) || new Date()).toLocaleDateString("pt-BR")
                    : new Date().toLocaleDateString("pt-BR");

                const summary = [
                    `✅ *Romaneio #${rd.ticketNumber || 'S/N'} recebido!*`,
                    ``,
                    `🏢 Comprador: *${rd.buyer || parsed.supplier || 'N/A'}*`,
                    `🌾 Cultura: *${rd.crop || 'Soja'}*`,
                    `📅 Data: ${deliveryDateStr}`,
                    ``,
                    `⚖️ Peso Bruto: ${grossW.toLocaleString()} kg`,
                    `📦 Tara: ${tareW.toLocaleString()} kg`,
                    `📊 Peso Neto: ${netW.toLocaleString()} kg`,
                    ``,
                    moistureVal != null ? `💧 Umidade: ${moistureVal}%` : null,
                    impurityVal != null ? `🔬 Impureza: ${impurityVal}%` : null,
                    ``,
                    `✨ Peso Final: *${finalW.toLocaleString()} kg* (${(finalW / 1000).toFixed(2)} ton)`,
                    ``,
                    rd.truckPlate ? `🚛 Placa: ${rd.truckPlate}` : null,
                    rd.truckPlate ? `` : null,
                    plots.length > 0 ? `📍 *De qual talhão é esse romaneio?*\n${plotList}` : `Romaneio salvo! Confirme o talhão pelo painel. 🌾`,
                ].filter(l => l !== null).join("\n");

                return res.json({ message: summary });
            }
            else if (parsed.type === "remision") {
                // ===== REMISION — Nota de Remissao (salva como invoice com documentType remision) =====
                const safeDateParse = (d: string | null | undefined): Date | null => {
                    if (!d) return null;
                    const s = String(d);
                    return new Date(s.length === 10 ? s + "T12:00:00" : s);
                };
                const remIssueDate = safeDateParse(parsed.issueDate);

                // Auto-register supplier
                let remSupplierId = null;
                if (parsed.supplier) {
                    try {
                        const existingSup = await db.execute(sql`
                            SELECT id FROM farm_suppliers WHERE farmer_id = ${farmer.id} AND is_active = true
                            AND name ILIKE ${'%' + parsed.supplier.substring(0, 15) + '%'}
                            LIMIT 1
                        `);
                        const supRows = (existingSup as any).rows ?? existingSup;
                        if (supRows.length > 0) {
                            remSupplierId = supRows[0].id;
                        } else {
                            const newSup = await db.execute(sql`
                                INSERT INTO farm_suppliers (farmer_id, name, person_type, entity_type)
                                VALUES (${farmer.id}, ${parsed.supplier}, 'provedor', 'juridica')
                                RETURNING id
                            `);
                            remSupplierId = ((newSup as any).rows ?? newSup)[0]?.id;
                        }
                    } catch (err) {
                        console.error("[WEBHOOK_REMISION_SUPPLIER]", err);
                    }
                }

                // Save as invoice with documentType = remision
                const [newRemision] = await db.insert(farmInvoices).values({
                    farmerId: farmer.id,
                    totalAmount: "0",
                    currency: parsed.currency || "USD",
                    issueDate: remIssueDate || new Date(),
                    dueDate: null,
                    notes: `[Remissao via WhatsApp] ${parsed.description || ''}`,
                    status: 'pending',
                    supplier: parsed.supplier || "Via WhatsApp",
                    invoiceNumber: parsed.invoiceNumber || `REM-${Date.now().toString().slice(-6)}`,
                    supplierId: remSupplierId,
                    source: "whatsapp",
                    documentType: "remision",
                    skipStockEntry: false,
                    pdfBase64: base64Image,
                    fileMimeType: mimeType,
                }).returning();

                // Create items (sem precos)
                const allProducts = await farmStorage.getAllProducts();
                let itemsCount = 0;
                const remItems = parsed.items || [];

                for (const item of remItems) {
                    const q = parseFloat(item.quantity) || 1;

                    let matchedProduct = allProducts.find((p: any) =>
                        p.name.toUpperCase().includes(item.productName.toUpperCase().substring(0, 10)) ||
                        item.productName.toUpperCase().includes(p.name.toUpperCase().substring(0, 10))
                    );

                    if (!matchedProduct) {
                        try {
                            matchedProduct = await farmStorage.createProduct({
                                name: item.productName,
                                unit: item.unit || "UN",
                                category: null,
                                dosePerHa: null,
                                activeIngredient: null,
                                status: "pending_review",
                                isDraft: true
                            });
                            allProducts.push(matchedProduct);
                        } catch (err) {
                            console.error(`[WEBHOOK_REMISION] Failed to auto-create product: ${item.productName}`, err);
                        }
                    }

                    await db.insert(farmInvoiceItems).values({
                        invoiceId: newRemision.id,
                        productId: matchedProduct?.id || null,
                        productName: item.productName || "Produto Desconhecido",
                        quantity: String(q),
                        unit: item.unit || "UN",
                        unitPrice: "0",
                        totalPrice: "0"
                    });
                    itemsCount++;
                }

                // Build WhatsApp response
                const remItemsList = remItems.map((it: any, idx: number) =>
                    `  ${idx + 1}. ${it.productName} — ${it.quantity} ${it.unit || 'UN'}`
                ).join('\n');

                const remDateStr = remIssueDate ? remIssueDate.toLocaleDateString('pt-BR') : '—';

                let msg = `📦 *Remissao recebida!*\n\n`;
                msg += `📋 *N°:* ${newRemision.invoiceNumber || 'S/N'}\n`;
                msg += `🏢 *Empresa:* ${parsed.supplier || 'N/A'}\n`;
                msg += `📅 *Data:* ${remDateStr}\n`;
                if (itemsCount > 0) {
                    msg += `\n📦 *Produtos (${itemsCount}):*\n${remItemsList}\n`;
                }
                msg += `\n✅ Remissao salva no sistema! Aprove no painel para dar entrada no estoque.\n`;
                msg += `_Quando a fatura chegar, o sistema vai conciliar automaticamente._`;

                return res.json({ message: msg });
            }
            else {
                // ===== UNKNOWN — Ask user what type it is =====
                const { farmWhatsappPendingContext } = await import("../shared/schema");
                const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

                await db.insert(farmWhatsappPendingContext).values({
                    farmerId: farmer.id,
                    phone: formattedPhone,
                    step: "awaiting_image_type",
                    expenseId: null,
                    data: { imageBase64: base64Image, mimeType, caption: caption || "" },
                    expiresAt,
                });

                return res.json({
                    message: `🤔 Não consegui identificar automaticamente essa imagem.\n\nQue tipo de documento é?\n1️⃣ Fatura de insumos (defensivos, sementes, fertilizantes)\n2️⃣ Despesa (peças, serviços, diesel)\n3️⃣ Romaneio (ticket de grãos)\n4️⃣ Outro recibo/comprovante`
                });
            }

        } catch (error) {
            console.error("[WEBHOOK_N8N_RECEIPT]", error);
            res.status(500).json({ error: "Internal server error during receipt processing" });
        }
    });

    app.get("/api/farm/webhook/n8n/stock", async (req, res) => {
        try {
            const { whatsapp_number } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
            // Extract last 9 digits for fallback matching
            const last9 = formattedPhone.slice(-9);

            let farmers = await db.select().from(users).where(
                or(
                    eq(users.whatsapp_number, formattedPhone),
                    sql`${users.whatsapp_extra_numbers} LIKE ${'%' + formattedPhone + '%'}`
                )
            ).limit(1);

            // Fallback: try matching by last 9 digits (handles country code variations)
            if (farmers.length === 0 && last9.length === 9) {
                farmers = await db.select().from(users).where(
                    or(
                        sql`${users.whatsapp_number} LIKE ${'%' + last9}`,
                        sql`${users.whatsapp_extra_numbers} LIKE ${'%' + last9 + '%'}`
                    )
                ).limit(1);
            }

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            const stock = await farmStorage.getStock(farmers[0].id);
            res.json(stock.map(s => ({
                produto: s.productName,
                quantidade: parseFloat(s.quantity).toFixed(2),
                unidade: s.productUnit,
                categoria: s.productCategory
            })));
        } catch (error) {
            console.error("[WEBHOOK_N8N_STOCK]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/applications", async (req, res) => {
        try {
            const { whatsapp_number, limit = 5 } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
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

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            const applications = await farmStorage.getApplications(farmers[0].id);
            const recent = applications.slice(0, Number(limit)).map(a => ({
                data: new Date(a.appliedAt).toLocaleDateString("pt-BR"),
                produto: a.productName,
                quantidade: parseFloat(a.quantity).toFixed(2),
                propriedade: a.propertyName
            }));

            res.json(recent);
        } catch (error) {
            console.error("[WEBHOOK_N8N_APPS]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/prices", async (req, res) => {
        try {
            const { whatsapp_number, search } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users, farmPriceHistory } = await import("../shared/schema");
            const { eq, or, sql, desc, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
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
            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            // Build conditions
            const conditions: any[] = [eq(farmPriceHistory.farmerId, farmers[0].id)];

            // If search is provided, filter by product name
            if (search && String(search).trim() !== "") {
                const term = String(search).trim();
                conditions.push(sql`${farmPriceHistory.productName} ILIKE ${'%' + term + '%'}`);
            }

            const items = await db.select({
                date: farmPriceHistory.purchaseDate,
                supplier: farmPriceHistory.supplier,
                productName: farmPriceHistory.productName,
                quantity: farmPriceHistory.quantity,
                unitPrice: farmPriceHistory.unitPrice,
                activeIngredient: farmPriceHistory.activeIngredient
            })
                .from(farmPriceHistory)
                .where(and(...conditions))
                .orderBy(desc(farmPriceHistory.purchaseDate))
                .limit(50);

            // Also search in farm_stock for manually added products
            const stockItems = await db.execute(sql`
                SELECT fs.updated_at as date, 'Estoque Manual' as supplier,
                    fp.name as product_name, fs.quantity, fs.average_cost as unit_price,
                    fp.active_ingredient
                FROM farm_stock fs
                JOIN farm_products_catalog fp ON fp.id = fs.product_id
                WHERE fs.farmer_id = ${farmers[0].id}
                ${search && String(search).trim() !== "" ? sql`AND fp.name ILIKE ${'%' + String(search).trim() + '%'}` : sql``}
                ORDER BY fs.updated_at DESC LIMIT 20
            `);
            const stockRows = (stockItems as any).rows ?? stockItems;

            const priceResults = items.map((i: any) => ({
                dataCompra: i.date ? new Date(i.date).toLocaleDateString("pt-BR") : "N/A",
                fornecedor: i.supplier,
                produto: i.productName,
                quantidade: parseFloat(i.quantity || "0").toFixed(2),
                precoUnitario: parseFloat(i.unitPrice || "0").toFixed(2),
                principioAtivo: i.activeIngredient || ""
            }));

            // Merge stock items that are not already in price history
            for (const s of stockRows) {
                const alreadyExists = priceResults.some((p: any) =>
                    p.produto?.toLowerCase() === s.product_name?.toLowerCase()
                );
                if (!alreadyExists && parseFloat(s.unit_price || "0") > 0) {
                    priceResults.push({
                        dataCompra: s.date ? new Date(s.date).toLocaleDateString("pt-BR") : "N/A",
                        fornecedor: s.supplier || "Estoque Manual",
                        produto: s.product_name,
                        quantidade: parseFloat(s.quantity || "0").toFixed(2),
                        precoUnitario: parseFloat(s.unit_price || "0").toFixed(2),
                        principioAtivo: s.active_ingredient || ""
                    });
                }
            }

            res.json(priceResults);
        } catch (error) {
            console.error("[WEBHOOK_N8N_PRICES]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Audio Transcription for n8n =====
    app.post("/api/farm/webhook/n8n/transcribe-audio", requireWebhookSecret, async (req, res) => {
        try {
            const { audioUrl } = req.body;
            if (!audioUrl) return res.status(400).json({ error: "audioUrl is required" });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

            console.log(`[TRANSCRIBE] Downloading audio: ${audioUrl}`);

            // Download audio
            const audioResponse = await fetch(audioUrl);
            if (!audioResponse.ok) return res.status(400).json({ error: "Failed to download audio" });

            const contentType = audioResponse.headers.get("content-type") || "audio/ogg";
            const arrayBuffer = await audioResponse.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString("base64");

            console.log(`[TRANSCRIBE] Audio downloaded (${Math.round(arrayBuffer.byteLength / 1024)}KB, ${contentType}). Sending to Gemini...`);

            // Send to Gemini for transcription
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: "Transcreva este áudio fielmente em português. Retorne APENAS o texto falado, sem comentários." },
                                { inline_data: { mime_type: contentType, data: base64Audio } }
                            ]
                        }]
                    })
                }
            );

            const data = await geminiResponse.json();
            if (!geminiResponse.ok) {
                console.error("[TRANSCRIBE] Gemini error:", data);
                return res.status(500).json({ error: "Transcription failed" });
            }

            const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
            console.log(`[TRANSCRIBE] Result: "${transcription}"`);

            res.json({ transcription });
        } catch (error) {
            console.error("[TRANSCRIBE]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Text-to-Speech via Gemini for n8n =====
    app.post("/api/farm/webhook/n8n/tts", requireWebhookSecret, async (req, res) => {
        try {
            const { text } = req.body;
            if (!text) return res.status(400).json({ error: "text is required" });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not configured" });

            console.log(`[TTS] Generating audio for: "${text.substring(0, 80)}..."`);

            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text }]
                        }],
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: "Orus"
                                    }
                                }
                            }
                        }
                    })
                }
            );

            const data = await geminiResponse.json();
            if (!geminiResponse.ok) {
                console.error("[TTS] Gemini error:", data);
                return res.status(500).json({ error: "TTS generation failed" });
            }

            const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            const srcMime = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "";

            if (!audioData) {
                console.error("[TTS] No audio data in response");
                return res.status(500).json({ error: "No audio generated" });
            }

            // Gemini TTS returns PCM (audio/L16). Z-API needs WAV with proper header.
            const pcmBuffer = Buffer.from(audioData, "base64");
            const sampleRate = 24000; // Gemini TTS default
            const numChannels = 1;
            const bitsPerSample = 16;
            const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
            const blockAlign = numChannels * (bitsPerSample / 8);

            // Build WAV header (44 bytes)
            const wavHeader = Buffer.alloc(44);
            wavHeader.write("RIFF", 0);
            wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
            wavHeader.write("WAVE", 8);
            wavHeader.write("fmt ", 12);
            wavHeader.writeUInt32LE(16, 16); // subchunk1 size
            wavHeader.writeUInt16LE(1, 20);  // PCM format
            wavHeader.writeUInt16LE(numChannels, 22);
            wavHeader.writeUInt32LE(sampleRate, 24);
            wavHeader.writeUInt32LE(byteRate, 28);
            wavHeader.writeUInt16LE(blockAlign, 32);
            wavHeader.writeUInt16LE(bitsPerSample, 34);
            wavHeader.write("data", 36);
            wavHeader.writeUInt32LE(pcmBuffer.length, 40);

            const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
            const wavBase64 = wavBuffer.toString("base64");

            console.log(`[TTS] Audio generated (${Math.round(wavBuffer.length / 1024)}KB WAV from ${srcMime})`);
            res.json({ audio: `data:audio/wav;base64,${wavBase64}`, mimeType: "audio/wav" });
        } catch (error) {
            console.error("[TTS]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Weather Forecast for n8n =====
    app.get("/api/farm/webhook/n8n/weather", async (req, res) => {
        try {
            const { whatsapp_number } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users } = await import("../shared/schema");
            const { eq, or, sql } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
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

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            const farmer = farmers[0] as any;
            const lat = farmer.farm_latitude || farmer.farmLatitude || -25.2637;
            const lon = farmer.farm_longitude || farmer.farmLongitude || -57.5759;
            const city = farmer.farm_city || farmer.farmCity || "Região";

            const { getWeatherForecast, formatWeatherMessage } = await import("./services/weather-service");
            const forecasts = await getWeatherForecast(lat, lon, 3);

            res.json({
                previsao: formatWeatherMessage(forecasts, city),
                dados: forecasts
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_WEATHER]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // ===== Commodity Prices for n8n =====
    app.get("/api/farm/webhook/n8n/commodity", async (_req, res) => {
        try {
            const { getCommodityData, formatCommodityMessage } = await import("./services/commodity-service");
            const data = await getCommodityData();

            res.json({
                cotacao: formatCommodityMessage(data),
                dados: data
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_COMMODITY]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/invoices", async (req, res) => {
        try {
            const { whatsapp_number, limit = 20, date, supplier } = req.query;
            if (!whatsapp_number) return res.status(400).json({ error: "whatsapp_number is required" });

            const { users, farmExpenses, farmInvoices } = await import("../shared/schema");
            const { eq, or, sql, desc, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            const formattedPhone = ZApiClient.formatPhoneNumber(whatsapp_number as string);
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

            if (farmers.length === 0) return res.status(404).json({ error: "Farmer not found" });

            // Base conditions
            const expenseConditions: any[] = [eq(farmExpenses.farmerId, farmers[0].id)];
            const invoiceConditions: any[] = [eq(farmInvoices.farmerId, farmers[0].id)];

            if (date) {
                // Use issueDate (actual invoice date) for invoices, createdAt for expenses
                const dateStr = String(date);
                expenseConditions.push(sql`(to_char(${farmExpenses.createdAt}, 'DD/MM/YYYY') LIKE ${'%' + dateStr + '%'} OR to_char(${farmExpenses.createdAt}, 'YYYY-MM-DD') LIKE ${'%' + dateStr + '%'})`);
                // For invoices, search BOTH issueDate AND createdAt to maximize matches
                invoiceConditions.push(sql`(to_char(COALESCE(${farmInvoices.issueDate}, ${farmInvoices.createdAt}), 'DD/MM/YYYY') LIKE ${'%' + dateStr + '%'} OR to_char(COALESCE(${farmInvoices.issueDate}, ${farmInvoices.createdAt}), 'YYYY-MM-DD') LIKE ${'%' + dateStr + '%'})`);
            }

            if (supplier) {
                const supplierStr = String(supplier);
                invoiceConditions.push(sql`${farmInvoices.supplier} ILIKE ${'%' + supplierStr + '%'}`);
            }

            const expenses = await db.select().from(farmExpenses)
                .where(and(...expenseConditions))
                .orderBy(desc(farmExpenses.createdAt))
                .limit(Number(limit));

            const invoices = await db.select().from(farmInvoices)
                .where(and(...invoiceConditions))
                .orderBy(desc(farmInvoices.createdAt))
                .limit(Number(limit));

            res.json({
                despesas: expenses.map((e: any) => ({
                    descricao: e.description,
                    valor: parseFloat(e.amount).toFixed(2),
                    categoria: e.category,
                    data: new Date(e.createdAt).toLocaleDateString("pt-BR"),
                    status: e.status
                })),
                faturas: invoices.map((i: any) => ({
                    fornecedor: i.supplier,
                    valorTotal: parseFloat(i.totalAmount || "0").toFixed(2),
                    data: i.issueDate ? new Date(i.issueDate).toLocaleDateString("pt-BR") : new Date(i.createdAt).toLocaleDateString("pt-BR"),
                    status: i.status
                }))
            });
        } catch (error) {
            console.error("[WEBHOOK_N8N_INVOICES]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    app.get("/api/farm/webhook/n8n/manuals", async (req, res) => {
        try {
            const { search } = req.query;
            const { farmManuals } = await import("../shared/schema");
            const { db } = await import("./db");

            const manuals = await db.select().from(farmManuals);

            if (search) {
                const { answerFromManuals } = await import("./whatsapp/gemini-client");

                let context = manuals.map((m: any) => `\n### MANUAL: ${m.title} (Segmento: ${m.segment})\n${m.contentText}`).join("\n");

                if (context.length > 500000) context = context.substring(0, 500000) + "...";

                const answer = await answerFromManuals(search as string, context);

                return res.json({ resposta: answer });
            }

            res.json({ manuals });
        } catch (error) {
            console.error("[WEBHOOK_N8N_MANUALS]", error);
            res.status(500).json({ error: "Internal server error" });
        }
    });
}
