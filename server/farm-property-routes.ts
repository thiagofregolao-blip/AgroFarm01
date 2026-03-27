import { Express } from "express";
import { requireFarmer, hashPassword, getEffectiveFarmerId } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";
import { users, farmEmployees, userModules } from "../shared/schema";

export function registerFarmPropertyRoutes(app: Express) {

    // ==================== PROPERTIES ====================

    app.get("/api/farm/properties", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const properties = await farmStorage.getProperties(farmerId);
            res.json(properties);
        } catch (error) {
            console.error("[FARM_PROPERTIES_GET]", error);
            res.status(500).json({ error: "Failed to get properties" });
        }
    });

    app.post("/api/farm/properties", requireFarmer, async (req, res) => {
        try {
            const { name, location, totalAreaHa } = req.body;
            if (!name) return res.status(400).json({ error: "Property name required" });
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const property = await farmStorage.createProperty({
                farmerId,
                name,
                location,
                totalAreaHa: totalAreaHa ? String(totalAreaHa) : null,
            });
            res.status(201).json(property);
        } catch (error) {
            console.error("[FARM_PROPERTY_CREATE]", error);
            res.status(500).json({ error: "Failed to create property" });
        }
    });

    app.put("/api/farm/properties/:id", requireFarmer, async (req, res) => {
        try {
            const { name, location, totalAreaHa } = req.body;
            const property = await farmStorage.updateProperty(req.params.id, {
                name,
                location,
                totalAreaHa: totalAreaHa ? String(totalAreaHa) : undefined,
            });
            res.json(property);
        } catch (error) {
            console.error("[FARM_PROPERTY_UPDATE]", error);
            res.status(500).json({ error: "Failed to update property" });
        }
    });

    app.delete("/api/farm/properties/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteProperty(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PROPERTY_DELETE]", error);
            res.status(500).json({ error: "Failed to delete property" });
        }
    });

    // ==================== PLOTS ====================

    app.get("/api/farm/properties/:propertyId/plots", requireFarmer, async (req, res) => {
        try {
            const plots = await farmStorage.getPlots(req.params.propertyId);
            res.json(plots);
        } catch (error) {
            console.error("[FARM_PLOTS_GET]", error);
            res.status(500).json({ error: "Failed to get plots" });
        }
    });

    app.get("/api/farm/plots", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const plots = await farmStorage.getPlotsByFarmer(farmerId);
            res.json(plots);
        } catch (error) {
            console.error("[FARM_ALL_PLOTS_GET]", error);
            res.status(500).json({ error: "Failed to get plots" });
        }
    });

    app.post("/api/farm/properties/:propertyId/plots", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop, coordinates } = req.body;
            if (!name || !areaHa) return res.status(400).json({ error: "Plot name and area required" });

            const plot = await farmStorage.createPlot({
                propertyId: req.params.propertyId,
                name,
                areaHa: String(areaHa),
                crop,
                coordinates: coordinates ? JSON.stringify(coordinates) : null,
            });
            res.status(201).json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_CREATE]", error);
            res.status(500).json({ error: "Failed to create plot" });
        }
    });

    app.put("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            const { name, areaHa, crop, coordinates } = req.body;
            const plot = await farmStorage.updatePlot(req.params.id, {
                name,
                areaHa: areaHa ? String(areaHa) : undefined,
                crop,
                coordinates: coordinates !== undefined ? (coordinates ? JSON.stringify(coordinates) : null) : undefined,
            });
            res.json(plot);
        } catch (error) {
            console.error("[FARM_PLOT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update plot" });
        }
    });

    app.delete("/api/farm/plots/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deletePlot(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_PLOT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete plot" });
        }
    });

    // ==================== EQUIPMENT ====================

    app.get("/api/farm/equipment", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const equipment = await farmStorage.getEquipment(farmerId);
            res.json(equipment);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_GET]", error);
            res.status(500).json({ error: "Failed to get equipment list" });
        }
    });

    app.post("/api/farm/equipment", requireFarmer, async (req, res) => {
        try {
            const { name, type, status, tankCapacityL } = req.body;
            if (!name || !type) return res.status(400).json({ error: "Name and type required" });
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const equip = await farmStorage.createEquipment({
                farmerId,
                name,
                type,
                status: status || "Ativo",
                tankCapacityL: tankCapacityL ? String(tankCapacityL) : null,
            });
            res.status(201).json(equip);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_CREATE]", error);
            res.status(500).json({ error: "Failed to create equipment" });
        }
    });

    app.put("/api/farm/equipment/:id", requireFarmer, async (req, res) => {
        try {
            const { name, type, status, tankCapacityL } = req.body;
            const equip = await farmStorage.updateEquipment(req.params.id, {
                name,
                type,
                status,
                ...(tankCapacityL !== undefined && { tankCapacityL: tankCapacityL ? String(tankCapacityL) : null }),
            });
            res.json(equip);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_UPDATE]", error);
            res.status(500).json({ error: "Failed to update equipment" });
        }
    });

    app.delete("/api/farm/equipment/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteEquipment(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_EQUIPMENT_DELETE]", error);
            res.status(500).json({ error: "Failed to delete equipment" });
        }
    });

    // ==================== EMPLOYEES (Funcionários) ====================

    app.get("/api/farm/employees", requireFarmer, async (req, res) => {
        try {
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });
            const employees = await farmStorage.getEmployees(farmerId);
            res.json(employees);
        } catch (error) {
            console.error("[FARM_EMPLOYEES_GET]", error);
            res.status(500).json({ error: "Failed to get employees" });
        }
    });

    app.post("/api/farm/employees", requireFarmer, async (req, res) => {
        try {
            const { name, role, phone, status, photoBase64, signatureBase64, faceEmbedding } = req.body;
            if (!name || !role) return res.status(400).json({ error: "Nome e cargo são obrigatórios" });
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const emp = await farmStorage.createEmployee({
                farmerId,
                name,
                role,
                phone: phone || null,
                status: status || "Ativo",
                photoBase64: photoBase64 || null,
                signatureBase64: signatureBase64 || null,
                faceEmbedding: faceEmbedding || null,
            });
            res.status(201).json(emp);
        } catch (error) {
            console.error("[FARM_EMPLOYEES_CREATE]", error);
            res.status(500).json({ error: "Failed to create employee" });
        }
    });

    app.put("/api/farm/employees/:id", requireFarmer, async (req, res) => {
        try {
            const { name, role, phone, status, photoBase64, signatureBase64, faceEmbedding } = req.body;
            const data: any = {};
            if (name !== undefined) data.name = name;
            if (role !== undefined) data.role = role;
            if (phone !== undefined) data.phone = phone;
            if (status !== undefined) data.status = status;
            if (photoBase64 !== undefined) data.photoBase64 = photoBase64;
            if (signatureBase64 !== undefined) data.signatureBase64 = signatureBase64;
            if (faceEmbedding !== undefined) data.faceEmbedding = faceEmbedding;

            console.log(`[FARM_EMPLOYEES_UPDATE] id=${req.params.id}, fields=${Object.keys(data).join(",")}, hasFaceEmbedding=${!!data.faceEmbedding}, embeddingLength=${data.faceEmbedding?.length || 0}`);
            const emp = await farmStorage.updateEmployee(req.params.id, data);
            console.log(`[FARM_EMPLOYEES_UPDATE] saved ok, emp.faceEmbedding=${!!emp.faceEmbedding}`);
            res.json(emp);
        } catch (error) {
            console.error("[FARM_EMPLOYEES_UPDATE]", error);
            res.status(500).json({ error: "Failed to update employee" });
        }
    });

    app.delete("/api/farm/employees/:id", requireFarmer, async (req, res) => {
        try {
            await farmStorage.deleteEmployee(req.params.id);
            res.sendStatus(204);
        } catch (error) {
            console.error("[FARM_EMPLOYEES_DELETE]", error);
            res.status(500).json({ error: "Failed to delete employee" });
        }
    });

    // ==================== EMPLOYEE ACCESS SYSTEM ====================

    // Enable system access for an employee (create user account)
    app.post("/api/farm/employees/:id/enable-access", requireFarmer, async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Username e senha são obrigatórios" });
            }
            if (password.length < 4) {
                return res.status(400).json({ error: "Senha deve ter pelo menos 4 caracteres" });
            }

            const employeeId = req.params.id;
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            // Verify employee belongs to this farmer
            const [emp] = await db.select().from(farmEmployees).where(and(eq(farmEmployees.id, employeeId), eq(farmEmployees.farmerId, farmerId)));
            if (!emp) return res.status(404).json({ error: "Funcionário não encontrado" });

            // Check if username already exists (allow if it's the employee's own user)
            const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
            if (existingUser && existingUser.id !== emp.userId) {
                return res.status(409).json({ error: "Nome de usuário já está em uso" });
            }

            const hashedPassword = await hashPassword(password);

            if (emp.userId) {
                // User already exists — re-enable and update credentials
                await db.update(users).set({
                    username,
                    password: hashedPassword,
                    isActive: true,
                }).where(eq(users.id, emp.userId));

                res.json({ message: "Acesso reativado com sucesso", userId: emp.userId });
            } else {
                // Create new user record
                const [newUser] = await db.insert(users).values({
                    username,
                    password: hashedPassword,
                    name: emp.name,
                    role: "funcionario_fazenda",
                    isActive: true,
                }).returning();

                // Link user to employee
                await db.execute(sql`UPDATE farm_employees SET user_id = ${newUser.id} WHERE id = ${employeeId}`);

                res.json({ message: "Acesso habilitado com sucesso", userId: newUser.id });
            }
        } catch (error) {
            console.error("[EMPLOYEE_ENABLE_ACCESS]", error);
            res.status(500).json({ error: "Falha ao habilitar acesso" });
        }
    });

    // Disable system access for an employee
    app.post("/api/farm/employees/:id/disable-access", requireFarmer, async (req, res) => {
        try {
            const employeeId = req.params.id;
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const [emp] = await db.select().from(farmEmployees).where(and(eq(farmEmployees.id, employeeId), eq(farmEmployees.farmerId, farmerId)));
            if (!emp) return res.status(404).json({ error: "Funcionário não encontrado" });
            if (!emp.userId) return res.status(400).json({ error: "Funcionário não possui acesso ao sistema" });

            await db.update(users).set({ isActive: false }).where(eq(users.id, emp.userId));

            res.json({ message: "Acesso desabilitado com sucesso" });
        } catch (error) {
            console.error("[EMPLOYEE_DISABLE_ACCESS]", error);
            res.status(500).json({ error: "Falha ao desabilitar acesso" });
        }
    });

    // Get modules for an employee
    app.get("/api/farm/employees/:id/modules", requireFarmer, async (req, res) => {
        try {
            const employeeId = req.params.id;
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const [emp] = await db.select().from(farmEmployees).where(and(eq(farmEmployees.id, employeeId), eq(farmEmployees.farmerId, farmerId)));
            if (!emp) return res.status(404).json({ error: "Funcionário não encontrado" });
            if (!emp.userId) return res.json([]);

            const modules = await db.select().from(userModules).where(eq(userModules.userId, emp.userId));
            res.json(modules);
        } catch (error) {
            console.error("[EMPLOYEE_GET_MODULES]", error);
            res.status(500).json({ error: "Falha ao buscar módulos" });
        }
    });

    // Upsert modules for an employee
    app.put("/api/farm/employees/:id/modules", requireFarmer, async (req, res) => {
        try {
            const employeeId = req.params.id;
            const farmerId = await getEffectiveFarmerId(req);
            if (!farmerId) return res.status(403).json({ error: "Farmer not found" });

            const { modules } = req.body; // [{ moduleKey, enabled, accessLevel }]
            if (!Array.isArray(modules)) return res.status(400).json({ error: "modules array required" });

            const [emp] = await db.select().from(farmEmployees).where(and(eq(farmEmployees.id, employeeId), eq(farmEmployees.farmerId, farmerId)));
            if (!emp) return res.status(404).json({ error: "Funcionário não encontrado" });
            if (!emp.userId) return res.status(400).json({ error: "Funcionário não possui acesso ao sistema" });

            // Upsert each module
            for (const mod of modules) {
                await db.execute(sql`
                    INSERT INTO user_modules (id, user_id, module_key, enabled, access_level, created_at, updated_at)
                    VALUES (gen_random_uuid(), ${emp.userId}, ${mod.moduleKey}, ${mod.enabled}, ${mod.accessLevel || 'view'}, now(), now())
                    ON CONFLICT (user_id, module_key) DO UPDATE SET
                        enabled = ${mod.enabled},
                        access_level = ${mod.accessLevel || 'view'},
                        updated_at = now()
                `);
            }

            const updatedModules = await db.select().from(userModules).where(eq(userModules.userId, emp.userId));
            res.json(updatedModules);
        } catch (error) {
            console.error("[EMPLOYEE_UPDATE_MODULES]", error);
            res.status(500).json({ error: "Falha ao atualizar módulos" });
        }
    });

    // Get access levels for the current user (for read-only mode)
    app.get("/api/farm/my-access-levels", requireFarmer, async (req, res) => {
        try {
            const userId = req.user!.id;
            const role = req.user!.role;

            // Farmers and admins have full edit access
            if (role !== 'funcionario_fazenda') {
                return res.json({});
            }

            const modules = await db.select().from(userModules).where(eq(userModules.userId, userId));
            const accessMap: Record<string, string> = {};
            for (const m of modules) {
                if (m.enabled) {
                    accessMap[m.moduleKey] = (m as any).accessLevel || 'view';
                }
            }
            res.json(accessMap);
        } catch (error) {
            console.error("[MY_ACCESS_LEVELS]", error);
            res.status(500).json({ error: "Falha ao buscar níveis de acesso" });
        }
    });

}
