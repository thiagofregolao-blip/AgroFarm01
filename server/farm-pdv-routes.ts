import { Express } from "express";
import { requireFarmer, requirePdv, hashPassword, comparePasswords } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

export function registerFarmPdvRoutes(app: Express) {
    // ==================== PDV TERMINALS ====================

    app.get("/api/farm/pdv-terminals", requireFarmer, async (req, res) => {
        try {
            const terminals = await farmStorage.getPdvTerminals(req.user!.id);
            // Don't return passwords
            const safe = terminals.map(({ password, ...t }) => t);
            res.json(safe);
        } catch (error) {
            console.error("[FARM_PDV_TERMINALS_GET]", error);
            res.status(500).json({ error: "Failed to get terminals" });
        }
    });

    app.post("/api/farm/pdv-terminals", requireFarmer, async (req, res) => {
        try {
            const { name, username, password, propertyId, type } = req.body;
            if (!name || !username || !password) {
                return res.status(400).json({ error: "Name, username and password required" });
            }

            const terminal = await farmStorage.createPdvTerminal({
                farmerId: req.user!.id,
                name,
                username,
                password: await hashPassword(password),
                propertyId: propertyId || null,
                type: type || "estoque",
                isOnline: false,
                lastHeartbeat: null,
            });

            const { password: _, ...safe } = terminal;
            res.status(201).json(safe);
        } catch (error) {
            console.error("[FARM_PDV_TERMINAL_CREATE]", error);
            res.status(500).json({ error: "Failed to create terminal" });
        }
    });

    app.put("/api/farm/pdv-terminals/:id", requireFarmer, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, username, password, propertyId, type } = req.body;
            const farmerId = req.user!.id;

            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            // Ensure terminal belongs to this farmer
            const [existing] = await db.select().from(farmPdvTerminals).where(and(eq(farmPdvTerminals.id, id), eq(farmPdvTerminals.farmerId, farmerId)));
            if (!existing) return res.status(404).json({ error: "Terminal not found" });

            const updateData: any = {};
            if (name) updateData.name = name;
            if (username) updateData.username = username;
            if (password) updateData.password = await hashPassword(password);
            if (propertyId !== undefined) updateData.propertyId = propertyId || null;
            if (type) updateData.type = type;

            const [updated] = await db.update(farmPdvTerminals).set(updateData).where(eq(farmPdvTerminals.id, id)).returning();
            const { password: _, ...safe } = updated;
            res.json(safe);
        } catch (error) {
            console.error("[FARM_PDV_TERMINAL_UPDATE]", error);
            res.status(500).json({ error: "Failed to update terminal" });
        }
    });

    app.delete("/api/farm/pdv-terminals/:id", requireFarmer, async (req, res) => {
        try {
            const { id } = req.params;
            const farmerId = req.user!.id;

            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq, and } = await import("drizzle-orm");
            const { db } = await import("./db");

            // Ensure terminal belongs to this farmer
            const [existing] = await db.select().from(farmPdvTerminals).where(and(eq(farmPdvTerminals.id, id), eq(farmPdvTerminals.farmerId, farmerId)));
            if (!existing) return res.status(404).json({ error: "Terminal not found" });

            await db.delete(farmPdvTerminals).where(eq(farmPdvTerminals.id, id));
            res.json({ success: true });
        } catch (error) {
            console.error("[FARM_PDV_TERMINAL_DELETE]", error);
            res.status(500).json({ error: "Failed to delete terminal" });
        }
    });

    // ==================== PDV API (used by tablet) ====================

    app.post("/api/pdv/login", async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Username and password required" });
            }

            const terminal = await farmStorage.getPdvTerminal(username);
            if (!terminal || !(await comparePasswords(password, terminal.password))) {
                return res.status(401).json({ error: "Credenciais inválidas" });
            }

            req.session.pdvTerminalId = terminal.id;
            req.session.pdvFarmerId = terminal.farmerId;
            req.session.pdvPropertyId = terminal.propertyId;

            // Mark as online
            await farmStorage.updatePdvHeartbeat(terminal.id);

            // Get all data the PDV needs — products are derived from farmer's stock only
            // Exclude commercial deposit stock (comercial) — PDV only shows farm stock
            const stock = await farmStorage.getStock(terminal.farmerId, true);
            const products = stock.map(s => ({
                id: s.productId,
                name: s.productName,
                category: s.productCategory,
                unit: s.productUnit,
                imageUrl: s.productImageUrl || null,
                dosePerHa: s.productDosePerHa || null,
            }));
            const plots = await farmStorage.getPlotsByFarmer(terminal.farmerId);
            const properties = await farmStorage.getProperties(terminal.farmerId);
            const equipment = await farmStorage.getEquipment(terminal.farmerId);

            // Create a persistent token to store in localStorage for reliable reconnects (especially iOS offline)
            const crypto = await import("crypto");
            const tokenSeed = `${terminal.id}:${terminal.farmerId}:${terminal.propertyId}:${process.env.PDV_TOKEN_SECRET || process.env.SESSION_SECRET}`;
            const token = crypto.createHash('sha256').update(tokenSeed).digest('hex');

            // Atrela o token à sessão tbm ou banco, pra validar no `/api/pdv/data`
            req.session.pdvToken = token;

            res.json({
                terminal: { id: terminal.id, name: terminal.name, propertyId: terminal.propertyId, type: terminal.type },
                token,
                products,
                stock,
                plots,
                properties,
                equipment,
            });
        } catch (error) {
            console.error("[PDV_LOGIN]", error);
            res.status(500).json({ error: "Login failed" });
        }
    });

    app.post("/api/pdv/auto-login", async (req, res) => {
        try {
            const { token, terminalId } = req.body;
            if (!token || !terminalId) {
                return res.status(400).json({ error: "Token and terminalId required" });
            }

            const { db } = await import("./db");
            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const [terminal] = await db.select().from(farmPdvTerminals).where(eq(farmPdvTerminals.id, terminalId));
            if (!terminal) {
                return res.status(401).json({ error: "Terminal not found" });
            }

            const crypto = await import("crypto");
            const expectedTokenSeed = `${terminal.id}:${terminal.farmerId}:${terminal.propertyId}:${process.env.PDV_TOKEN_SECRET || process.env.SESSION_SECRET}`;
            const expectedToken = crypto.createHash('sha256').update(expectedTokenSeed).digest('hex');

            if (token !== expectedToken) {
                return res.status(401).json({ error: "Invalid token" });
            }

            req.session.pdvTerminalId = terminal.id;
            req.session.pdvFarmerId = terminal.farmerId;
            req.session.pdvPropertyId = terminal.propertyId;
            req.session.pdvToken = token;

            await farmStorage.updatePdvHeartbeat(terminal.id);

            // Exclude commercial deposit stock — PDV only uses farm stock
            const stock = await farmStorage.getStock(terminal.farmerId, true);
            const products = stock.map(s => ({
                id: s.productId,
                name: s.productName,
                category: s.productCategory,
                unit: s.productUnit,
                imageUrl: s.productImageUrl || null,
                dosePerHa: s.productDosePerHa || null,
            }));
            const plots = await farmStorage.getPlotsByFarmer(terminal.farmerId);
            const properties = await farmStorage.getProperties(terminal.farmerId);
            const equipment = await farmStorage.getEquipment(terminal.farmerId);

            res.json({
                terminal: { id: terminal.id, name: terminal.name, propertyId: terminal.propertyId, type: terminal.type },
                token,
                products,
                stock,
                plots,
                properties,
                equipment,
            });
        } catch (error) {
            console.error("[PDV_AUTO_LOGIN]", error);
            res.status(500).json({ error: "Auto-login failed" });
        }
    });

    // PDV withdraw: register application + update stock
    app.post("/api/pdv/withdraw", requirePdv, async (req, res) => {
        try {
            const { productId, quantity, plotId, propertyId, appliedBy, notes, equipmentId, horimeter, odometer, dosePerHa, flowRateLha } = req.body;
            if (!productId || !quantity || (!plotId && !equipmentId)) {
                return res.status(400).json({ error: "Product, quantity, and objective (plot or equipment) required" });
            }

            const farmerId = req.session.pdvFarmerId;
            const resolvedPropertyId = propertyId || req.session.pdvPropertyId;

            // Check if plotId is actually a property (when user selects property without plots)
            let resolvedPlotId = plotId || null;

            if (plotId) {
                const { db } = await import("./db");
                const { farmPlots } = await import("../shared/schema");
                const { eq } = await import("drizzle-orm");

                const [existingPlot] = await db.select().from(farmPlots).where(eq(farmPlots.id, plotId));
                if (!existingPlot) {
                    // plotId is probably a propertyId — auto-create a default plot
                    const property = await farmStorage.getPropertyById(plotId);
                    if (property) {
                        const newPlot = await farmStorage.createPlot({
                            propertyId: property.id,
                            name: property.name,
                            areaHa: property.totalAreaHa || "0",
                            crop: null,
                        });
                        resolvedPlotId = newPlot.id;
                        console.log(`[PDV_WITHDRAW] Auto-created plot "${newPlot.name}" for property "${property.name}"`);
                    }
                }
            }

            const application = await farmStorage.createApplication({
                farmerId,
                productId,
                plotId: resolvedPlotId || null,
                propertyId: resolvedPropertyId || null,
                equipmentId: equipmentId || null,
                horimeter: horimeter ? parseInt(horimeter, 10) : null,
                odometer: odometer ? parseInt(odometer, 10) : null,
                quantity: String(quantity),
                dosePerHa: dosePerHa ? String(dosePerHa) : null,
                flowRateLha: flowRateLha ? String(flowRateLha) : null,
                appliedBy: appliedBy || "PDV",
                notes: notes || null,
                appliedAt: new Date(),
                syncedFromOffline: false,
            });

            res.status(201).json(application);
        } catch (error) {
            console.error("[PDV_WITHDRAW]", error);
            res.status(500).json({ error: "Failed to register withdrawal" });
        }
    });

    // PDV sync: batch upload offline applications
    app.post("/api/pdv/sync", requirePdv, async (req, res) => {
        try {
            const { applications } = req.body;
            if (!Array.isArray(applications)) {
                return res.status(400).json({ error: "Applications array required" });
            }

            const farmerId = req.session.pdvFarmerId;
            const results = [];

            for (const app of applications) {
                try {
                    const application = await farmStorage.createApplication({
                        farmerId,
                        productId: app.productId,
                        plotId: app.plotId || null,
                        propertyId: app.propertyId || null,
                        equipmentId: app.equipmentId || null,
                        horimeter: app.horimeter ? parseInt(app.horimeter, 10) : null,
                        odometer: app.odometer ? parseInt(app.odometer, 10) : null,
                        quantity: String(app.quantity),
                        dosePerHa: app.dosePerHa ? String(app.dosePerHa) : null,
                        flowRateLha: app.flowRateLha ? String(app.flowRateLha) : null,
                        appliedBy: app.appliedBy || "PDV (offline)",
                        notes: app.notes,
                        appliedAt: app.appliedAt ? new Date(app.appliedAt) : new Date(),
                        syncedFromOffline: true,
                    });
                    results.push({ success: true, id: application.id });
                } catch (err) {
                    results.push({ success: false, error: String(err) });
                }
            }

            res.json({ synced: results.filter(r => r.success).length, total: applications.length, results });
        } catch (error) {
            console.error("[PDV_SYNC]", error);
            res.status(500).json({ error: "Failed to sync" });
        }
    });

    // PDV heartbeat
    app.post("/api/pdv/heartbeat", requirePdv, async (req, res) => {
        try {
            await farmStorage.updatePdvHeartbeat(req.session.pdvTerminalId);
            res.json({ status: "ok" });
        } catch (error) {
            res.status(500).json({ error: "Heartbeat failed" });
        }
    });

    // PDV refresh data (get latest stock/products)
    app.get("/api/pdv/data", requirePdv, async (req, res) => {
        try {
            const farmerId = req.session.pdvFarmerId;
            const terminalId = req.session.pdvTerminalId;
            // Exclude commercial deposit stock — PDV only uses farm stock
            const stock = await farmStorage.getStock(farmerId, true);

            // Fetch the current terminal to know its type (e.g. diesel)
            const { farmPdvTerminals } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");
            const { db } = await import("./db");
            const [terminal] = await db.select().from(farmPdvTerminals).where(eq(farmPdvTerminals.id, terminalId));

            // Map the user's localized stock to a 'products' array that the frontend expects
            // This prevents the global catalog from leaking into the user's PDV
            const products = stock.map(s => ({
                id: s.productId,
                name: s.productName,
                category: s.productCategory,
                unit: s.productUnit,
                imageUrl: s.productImageUrl || null,
                dosePerHa: s.productDosePerHa || null,
            }));

            const plots = await farmStorage.getPlotsByFarmer(farmerId);
            const properties = await farmStorage.getProperties(farmerId);
            const equipment = await farmStorage.getEquipment(farmerId);

            // Fetch farmer's deposits (non-commercial only) for deposit selector in PDV
            let deposits: any[] = [];
            try {
                const { farmDeposits } = await import("../shared/schema");
                const { and, ne } = await import("drizzle-orm");
                deposits = await db.select().from(farmDeposits).where(
                    and(eq(farmDeposits.farmerId, farmerId), ne(farmDeposits.depositType, 'comercial'))
                );
            } catch (e) { /* table may not exist yet */ }

            res.json({ products, stock, plots, properties, equipment, terminal, deposits });
        } catch (error) {
            console.error("[PDV_DATA]", error);
            res.status(500).json({ error: "Failed to get data" });
        }
    });

    // PDV withdrawals history (agrupar aplicações por batch)
    app.get("/api/pdv/withdrawals", requirePdv, async (req, res) => {
        try {
            const farmerId = req.session.pdvFarmerId;
            const applications = await farmStorage.getApplications(farmerId);

            // Agrupar aplicações por batch (aplicações criadas dentro de 5 minutos são do mesmo batch)
            const batches: Array<{
                batchId: string;
                appliedAt: Date;
                applications: typeof applications;
                propertyName?: string | null;
                notes?: string | null;
            }> = [];

            // Ordenar por data (mais recente primeiro)
            const sortedApps = [...applications].sort((a, b) =>
                new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
            );

            for (const app of sortedApps) {
                // Procurar batch existente (dentro de 5 minutos)
                const appTime = new Date(app.appliedAt).getTime();
                let foundBatch = false;

                for (const batch of batches) {
                    const batchTime = new Date(batch.appliedAt).getTime();
                    const timeDiff = Math.abs(appTime - batchTime) / 1000 / 60; // diferença em minutos

                    if (timeDiff <= 5) {
                        // Mesmo batch
                        batch.applications.push(app);
                        foundBatch = true;
                        break;
                    }
                }

                if (!foundBatch) {
                    // Novo batch
                    batches.push({
                        batchId: app.id, // Usar ID da primeira aplicação como batchId
                        appliedAt: app.appliedAt,
                        applications: [app],
                        propertyName: app.propertyName,
                        notes: app.notes,
                    });
                }
            }

            // Ordenar batches por data (mais recente primeiro)
            batches.sort((a, b) =>
                new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
            );

            res.json(batches);
        } catch (error) {
            console.error("[PDV_WITHDRAWALS]", error);
            res.status(500).json({ error: "Failed to get withdrawals" });
        }
    });
}
