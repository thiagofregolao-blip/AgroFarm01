/**
 * Commercial Module Routes
 *
 * Handles companies, clients, products, price lists, warehouses,
 * stock, sales orders, sales invoices (reconciliation), pagarés and remissions.
 *
 * All routes require authentication.
 * Users must belong to a company (company_users) to access these endpoints.
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { hashPassword } from "./auth";
import { db } from "./db";
import {
    companies,
    companyUsers,
    companyClients,
    companyProducts,
    companyPriceLists,
    companyPriceListItems,
    companyWarehouses,
    companyStock,
    companyStockMovements,
    salesOrders,
    salesOrderItems,
    salesInvoices,
    salesInvoiceItems,
    salesOrderInvoiceLinks,
    companyRemissions,
    companyRemissionItems,
    companyPagares,
    users,
} from "../shared/schema";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get the companyId for the authenticated user
// ─────────────────────────────────────────────────────────────────────────────
async function getCompanyId(userId: string): Promise<string | null> {
    const [cu] = await db
        .select({ companyId: companyUsers.companyId })
        .from(companyUsers)
        .where(and(eq(companyUsers.userId, userId), eq(companyUsers.isActive, true)))
        .limit(1);
    return cu?.companyId ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: generate next order number  →  ORD-2026-0001
// ─────────────────────────────────────────────────────────────────────────────
async function nextOrderNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(salesOrders)
        .where(eq(salesOrders.companyId, companyId));
    const seq = String((count ?? 0) + 1).padStart(4, "0");
    return `ORD-${year}-${seq}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: auto-reconcile an invoice against open orders for same client
// ─────────────────────────────────────────────────────────────────────────────
async function autoReconcileInvoice(invoiceId: string, companyId: string) {
    const invoice = await db.query?.salesInvoices?.findFirst?.({ where: eq(salesInvoices.id, invoiceId) })
        ?? (await db.select().from(salesInvoices).where(eq(salesInvoices.id, invoiceId)).limit(1))[0];

    if (!invoice || !invoice.clientId) return { linked: 0 };

    const invItems = await db.select().from(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, invoiceId));
    if (invItems.length === 0) return { linked: 0 };

    // Find open / partially_invoiced orders for same client
    const openOrders = await db.select().from(salesOrders)
        .where(and(
            eq(salesOrders.companyId, companyId),
            eq(salesOrders.clientId, invoice.clientId),
            inArray(salesOrders.status, ["approved", "pending_billing", "partially_invoiced"])
        ));

    if (openOrders.length === 0) return { linked: 0 };

    const orderIds = openOrders.map(o => o.id);
    const openItems = await db.select().from(salesOrderItems)
        .where(and(
            inArray(salesOrderItems.orderId, orderIds),
            inArray(salesOrderItems.status, ["open", "partially_invoiced"])
        ));

    let linked = 0;

    for (const invItem of invItems) {
        if (invItem.isReconciled) continue;

        // Try to match by productCode then productName (case-insensitive)
        const matchedOrderItem = openItems.find(oi => {
            const sameCode = invItem.productCode && oi.productCode &&
                invItem.productCode.toLowerCase() === oi.productCode.toLowerCase();
            const sameName = oi.productName.toLowerCase().includes(invItem.productName.toLowerCase().substring(0, 8)) ||
                invItem.productName.toLowerCase().includes(oi.productName.toLowerCase().substring(0, 8));
            return sameCode || sameName;
        });

        if (!matchedOrderItem) continue;

        const remaining = parseFloat(matchedOrderItem.quantity as string) - parseFloat(matchedOrderItem.invoicedQuantity as string ?? "0");
        if (remaining <= 0) continue;

        const qtyToLink = Math.min(parseFloat(invItem.quantity as string), remaining);

        // Create reconciliation link
        await db.insert(salesOrderInvoiceLinks).values({
            orderId: matchedOrderItem.orderId,
            invoiceId,
            orderItemId: matchedOrderItem.id,
            invoiceItemId: invItem.id,
            quantityLinked: String(qtyToLink),
        });

        // Update invoice item as reconciled
        await db.update(salesInvoiceItems)
            .set({ isReconciled: true, orderItemId: matchedOrderItem.id })
            .where(eq(salesInvoiceItems.id, invItem.id));

        // Update order item invoicedQuantity
        const newInvoiced = parseFloat(matchedOrderItem.invoicedQuantity as string ?? "0") + qtyToLink;
        const newStatus = newInvoiced >= parseFloat(matchedOrderItem.quantity as string) ? "invoiced" : "partially_invoiced";
        await db.update(salesOrderItems)
            .set({ invoicedQuantity: String(newInvoiced), status: newStatus })
            .where(eq(salesOrderItems.id, matchedOrderItem.id));

        // Keep the in-memory item updated for further iterations
        (matchedOrderItem as any).invoicedQuantity = String(newInvoiced);
        (matchedOrderItem as any).status = newStatus;

        linked++;
    }

    // Update invoice reconciliation status
    const totalItems = invItems.length;
    const reconciledItems = await db.select().from(salesInvoiceItems)
        .where(and(eq(salesInvoiceItems.invoiceId, invoiceId), eq(salesInvoiceItems.isReconciled, true)));
    const reconciliationStatus = reconciledItems.length === 0 ? "unmatched"
        : reconciledItems.length < totalItems ? "partial" : "matched";

    await db.update(salesInvoices)
        .set({ reconciliationStatus })
        .where(eq(salesInvoices.id, invoiceId));

    // Update order statuses
    for (const order of openOrders) {
        const allItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, order.id));
        const allInvoiced = allItems.every(i => i.status === "invoiced");
        const anyInvoiced = allItems.some(i => i.status !== "open");
        if (allInvoiced) {
            await db.update(salesOrders).set({ status: "invoiced" }).where(eq(salesOrders.id, order.id));
        } else if (anyInvoiced) {
            await db.update(salesOrders).set({ status: "partially_invoiced" }).where(eq(salesOrders.id, order.id));
        }
    }

    return { linked };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: deduct stock when an invoice is confirmed
// ─────────────────────────────────────────────────────────────────────────────
async function deductStockFromInvoice(invoiceId: string, companyId: string, userId: string) {
    const items = await db.select().from(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, invoiceId));
    for (const item of items) {
        if (!item.warehouseId || !item.productId) continue;
        const qty = parseFloat(item.quantity as string);

        // Upsert stock (decrement)
        await db.execute(sql`
            INSERT INTO company_stock (warehouse_id, product_id, quantity, updated_at)
            VALUES (${item.warehouseId}, ${item.productId}, ${-qty}, now())
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET quantity = company_stock.quantity - ${qty}, updated_at = now()
        `);

        // Movement record
        await db.insert(companyStockMovements).values({
            companyId,
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: "out",
            quantity: String(qty),
            referenceType: "invoice",
            referenceId: invoiceId,
            createdBy: userId,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: reserve stock when an order is submitted
// ─────────────────────────────────────────────────────────────────────────────
async function reserveStockForOrder(orderId: string, companyId: string, userId: string) {
    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, orderId));
    for (const item of items) {
        if (!item.warehouseId || !item.productId) continue;
        const qty = parseFloat(item.quantity as string);

        await db.execute(sql`
            INSERT INTO company_stock (warehouse_id, product_id, quantity, reserved_quantity, updated_at)
            VALUES (${item.warehouseId}, ${item.productId}, 0, ${qty}, now())
            ON CONFLICT (warehouse_id, product_id)
            DO UPDATE SET reserved_quantity = company_stock.reserved_quantity + ${qty}, updated_at = now()
        `);

        await db.insert(companyStockMovements).values({
            companyId,
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: "reserve",
            quantity: String(qty),
            referenceType: "order",
            referenceId: orderId,
            createdBy: userId,
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: release stock reservation when order is rejected/cancelled
// ─────────────────────────────────────────────────────────────────────────────
async function releaseStockReservation(orderId: string, companyId: string, userId: string) {
    const items = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, orderId));
    for (const item of items) {
        if (!item.warehouseId || !item.productId) continue;
        const qty = parseFloat(item.quantity as string);

        await db.execute(sql`
            UPDATE company_stock
            SET reserved_quantity = GREATEST(0, reserved_quantity - ${qty}), updated_at = now()
            WHERE warehouse_id = ${item.warehouseId} AND product_id = ${item.productId}
        `);

        await db.insert(companyStockMovements).values({
            companyId,
            warehouseId: item.warehouseId,
            productId: item.productId,
            type: "reserve_release",
            quantity: String(qty),
            referenceType: "order",
            referenceId: orderId,
            createdBy: userId,
        });
    }
}

// =============================================================================
// REGISTER ROUTES
// =============================================================================
export function registerCommercialRoutes(app: Express) {

    // ──────────────────────────────────────────────────────────────────────────
    // COMPANY INFO
    // ──────────────────────────────────────────────────────────────────────────

    /** Update own profile (name, email, password) */
    app.put("/api/company/profile", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const currentUser = req.user as any;
            const { name, email, password } = req.body;

            const updates: any = {};
            if (name) updates.name = name;
            if (email !== undefined) updates.email = email;
            if (password) updates.password = await hashPassword(password);

            const [updated] = await db.update(users)
                .set(updates)
                .where(eq(users.id, currentUser.id))
                .returning({ id: users.id, name: users.name, email: users.email, username: users.username });

            res.json(updated);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Get current user's company + role */
    app.get("/api/company/me", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;

            const [cu] = await db
                .select()
                .from(companyUsers)
                .where(and(eq(companyUsers.userId, user.id), eq(companyUsers.isActive, true)))
                .limit(1);

            if (!cu) return res.status(404).json({ error: "Usuário não vinculado a nenhuma empresa" });

            const [company] = await db.select().from(companies).where(eq(companies.id, cu.companyId));
            res.json({ ...company, role: cu.role });
        } catch (e) {
            console.error("[Company] me error:", e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // Team members (RTVs) for this company
    app.get("/api/company/team", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const members = await db
                .select({
                    userId: companyUsers.userId,
                    role: companyUsers.role,
                    name: users.name,
                    username: users.username,
                })
                .from(companyUsers)
                .innerJoin(users, eq(companyUsers.userId, users.id))
                .where(and(eq(companyUsers.companyId, companyId), eq(companyUsers.isActive, true)))
                .orderBy(asc(users.name));

            res.json(members);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // CLIENTS
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/clients", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const clients = await db.select().from(companyClients)
                .where(eq(companyClients.companyId, companyId))
                .orderBy(asc(companyClients.name));
            res.json(clients);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/clients", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { name, ruc, cedula, clientType, address, city, department, phone, email, creditLimit, notes } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

            // Check for duplicate by name (case-insensitive)
            const [existing] = await db.select({ id: companyClients.id }).from(companyClients)
                .where(and(eq(companyClients.companyId, companyId), sql`lower(${companyClients.name}) = lower(${name})`));
            if (existing) return res.status(409).json({ error: "Já existe um cliente com este nome" });

            const [client] = await db.insert(companyClients).values({
                companyId,
                name,
                ruc: ruc || null,
                cedula: cedula || null,
                clientType: clientType || "person",
                address: address || null,
                city: city || null,
                department: department || null,
                phone: phone || null,
                email: email || null,
                creditLimit: creditLimit ? String(creditLimit) : "0",
                assignedConsultantId: user.id,
                notes: notes || null,
            }).returning();
            res.json(client);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/company/clients/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { id } = req.params;
            const { name, ruc, cedula, clientType, address, city, department, phone, email, creditLimit, notes, isActive } = req.body;

            const [client] = await db.update(companyClients)
                .set({
                    name, ruc, cedula, clientType, address, city, department,
                    phone, email,
                    creditLimit: creditLimit !== undefined ? String(creditLimit) : undefined,
                    notes,
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                    updatedAt: new Date(),
                } as any)
                .where(and(eq(companyClients.id, id), eq(companyClients.companyId, companyId)))
                .returning();

            if (!client) return res.status(404).json({ error: "Cliente não encontrado" });
            res.json(client);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.delete("/api/company/clients/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            await db.update(companyClients)
                .set({ isActive: false })
                .where(and(eq(companyClients.id, req.params.id), eq(companyClients.companyId, companyId)));
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Import clients from Excel using Gemini AI — handles any column names/format */
    app.post("/api/company/clients/import-excel", upload.single("file"), async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });
            if (!req.file) return res.status(400).json({ error: "Envie um arquivo Excel (.xlsx)" });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });

            // Convert Excel to CSV text for Gemini
            const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const csvText = XLSX.utils.sheet_to_csv(sheet);

            const prompt = `Você é um assistente especializado em importação de dados de clientes. Analise a planilha abaixo e extraia TODOS os clientes.

Para cada cliente extraia:
- nome: nome completo ou razão social (campo obrigatório)
- ruc: número do RUC ou documento fiscal (apenas números e hifens)
- cedula: número de cédula/CI se houver
- clientType: "company" se pessoa jurídica/empresa/S.A./Ltda/S.R.L./Cooperativa, senão "person"
- telefone: número de telefone
- email: endereço de email
- cidade: cidade
- departamento: departamento ou estado
- endereco: endereço completo
- limiteCredito: valor numérico do limite de crédito (apenas número, sem símbolo de moeda)
- observacoes: observações ou notas

Ignore linhas de título, subtítulo, totais, cabeçalhos repetidos e linhas vazias.

Retorne APENAS JSON válido, sem texto extra:
{
  "clientes": [
    {
      "nome": "Nome do Cliente",
      "ruc": "12345678-9",
      "cedula": null,
      "clientType": "company",
      "telefone": "+595 61 123456",
      "email": "email@exemplo.com",
      "cidade": "Ciudad del Este",
      "departamento": "Alto Paraná",
      "endereco": "Av. Principal 123",
      "limiteCredito": 15000,
      "observacoes": "Cliente VIP"
    }
  ]
}

Dados da planilha:
${csvText}`;

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                    }),
                }
            );

            if (!geminiRes.ok) return res.status(500).json({ error: "Erro ao chamar Gemini AI" });

            const geminiData = await geminiRes.json() as any;
            const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return res.status(422).json({ error: "IA não retornou JSON válido", raw: text.slice(0, 200) });

            const parsed = JSON.parse(jsonMatch[0]);
            const clientes: any[] = parsed.clientes ?? [];

            if (clientes.length === 0) {
                return res.json({ success: true, created: 0, skipped: 0, total: 0 });
            }

            const assignedConsultantId = req.body.assignedConsultantId || null;
            const importBatch = `import-${Date.now()}`;
            let created = 0;
            let skipped = 0;

            // Load existing client names (lowercased) for this company to prevent duplicates
            const existingClients = await db.select({ name: companyClients.name })
                .from(companyClients).where(eq(companyClients.companyId, companyId));
            const existingNames = new Set(existingClients.map((c: any) => c.name.toLowerCase()));

            for (const c of clientes) {
                if (!c.nome) { skipped++; continue; }
                const normalizedName = String(c.nome).trim().toLowerCase();
                if (existingNames.has(normalizedName)) { skipped++; continue; }
                try {
                    await db.insert(companyClients).values({
                        companyId,
                        name: String(c.nome).trim(),
                        ruc: c.ruc ? String(c.ruc).trim() : null,
                        cedula: c.cedula ? String(c.cedula).trim() : null,
                        clientType: c.clientType === "company" ? "company" : "person",
                        phone: c.telefone ? String(c.telefone).trim() : null,
                        email: c.email ? String(c.email).trim() : null,
                        city: c.cidade ? String(c.cidade).trim() : null,
                        department: c.departamento ? String(c.departamento).trim() : null,
                        address: c.endereco ? String(c.endereco).trim() : null,
                        creditLimit: c.limiteCredito ? String(parseFloat(String(c.limiteCredito).replace(/[^0-9.]/g, "")) || 0) : "0",
                        notes: c.observacoes ? String(c.observacoes).trim() : null,
                        assignedConsultantId,
                        importBatch,
                    } as any);
                    existingNames.add(normalizedName);
                    created++;
                } catch {
                    skipped++;
                }
            }

            res.json({ success: true, created, skipped, total: clientes.length });
        } catch (e: any) {
            console.error("[Clients Import]", e);
            res.status(500).json({ error: "Erro ao importar planilha" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // PRODUCTS
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/products", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const includeAll = req.query.all === "true";
            const products = await db.select().from(companyProducts)
                .where(includeAll
                    ? eq(companyProducts.companyId, companyId)
                    : and(eq(companyProducts.companyId, companyId), eq(companyProducts.isActive, true)))
                .orderBy(asc(companyProducts.name));
            res.json(products);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/products", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { code, name, unit, category, activeIngredient, dose, description } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

            const [product] = await db.insert(companyProducts).values({
                companyId, code: code || null, name, unit: unit || "UNI", category: category || null,
                activeIngredient: activeIngredient || null, dose: dose || null, description: description || null,
            }).returning();
            res.json(product);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/company/products/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { code, name, unit, category, isActive, activeIngredient, dose, description } = req.body;
            const [product] = await db.update(companyProducts)
                .set({ code, name, unit, category, isActive, activeIngredient, dose, description } as any)
                .where(and(eq(companyProducts.id, req.params.id), eq(companyProducts.companyId, companyId)))
                .returning();
            if (!product) return res.status(404).json({ error: "Produto não encontrado" });
            res.json(product);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.delete("/api/company/products/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const deleted = await db.delete(companyProducts)
                .where(and(eq(companyProducts.id, req.params.id), eq(companyProducts.companyId, companyId)))
                .returning();
            if (!deleted.length) return res.status(404).json({ error: "Produto não encontrado" });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // AI import from image/PDF
    app.post("/api/company/products/import-from-file", (req: Request, res: Response, next: any) => {
        upload.single("file")(req, res, (err: any) => {
            if (err) {
                if (err.code === "LIMIT_FILE_SIZE") {
                    return res.status(413).json({ error: "Arquivo muito grande. Máximo 50MB." });
                }
                return res.status(400).json({ error: err.message || "Erro ao processar arquivo" });
            }
            next();
        });
    }, async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            if (!req.file) return res.status(400).json({ error: "Nenhum arquivo enviado" });

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });

            const base64Data = req.file.buffer.toString("base64");
            const mimeType = req.file.mimetype;

            const prompt = `Você é um especialista em catálogos de produtos agrícolas. Analise a imagem/PDF e extraia TODOS os produtos que encontrar.

Para cada produto extraia:
- nome: nome comercial do produto
- principioAtivo: princípio ativo ou composição química (se houver)
- dose: dosagem recomendada (ex: "1,5 L/ha", "200 ml/100L")
- descricao: breve descrição do produto ou modo de uso
- categoria: classifique como exatamente um dos valores: "inseticida", "fungicida", "herbicida", "ts", "curasementes", "fertilizante", "adjuvante", "outro"
- unidade: unidade de medida principal ("LT", "KG", "SC", "UNI")

Retorne APENAS um JSON válido, sem texto extra:
{
  "produtos": [
    {
      "nome": "Nome do Produto",
      "principioAtivo": "Glyphosate 480 g/L",
      "dose": "2-4 L/ha",
      "descricao": "Herbicida sistêmico de amplo espectro",
      "categoria": "herbicida",
      "unidade": "LT"
    }
  ]
}

Se não encontrar produtos, retorne: {"produtos": []}`;

            const body = {
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: mimeType, data: base64Data } },
                    ],
                }],
                generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
            };

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
            );
            if (!geminiRes.ok) {
                const errText = await geminiRes.text();
                console.error("[AI Products] Gemini error:", errText);
                return res.status(500).json({ error: "Erro ao chamar Gemini AI" });
            }

            const geminiData = await geminiRes.json() as any;
            const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return res.status(422).json({ error: "IA não retornou JSON válido", raw: text });

            const parsed = JSON.parse(jsonMatch[0]);
            const produtos = parsed.produtos ?? [];

            res.json({ produtos });
        } catch (e: any) {
            console.error("[AI Products] Error:", e);
            res.status(500).json({ error: e.message || "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // PRICE LISTS
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/price-lists", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const lists = await db.select().from(companyPriceLists)
                .where(eq(companyPriceLists.companyId, companyId))
                .orderBy(desc(companyPriceLists.createdAt));
            res.json(lists);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/price-lists", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { name, description, validFrom, validUntil, isActive } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

            const [list] = await db.insert(companyPriceLists).values({
                companyId, name, description: description || null,
                isActive: isActive !== undefined ? Boolean(isActive) : true,
                validFrom: validFrom ? new Date(validFrom) : null,
                validUntil: validUntil ? new Date(validUntil) : null,
                createdBy: user.id,
            }).returning();
            res.json(list);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.get("/api/company/price-lists/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [list] = await db.select().from(companyPriceLists)
                .where(and(eq(companyPriceLists.id, req.params.id), eq(companyPriceLists.companyId, companyId)));
            if (!list) return res.status(404).json({ error: "Tabela não encontrada" });

            const items = await db.select().from(companyPriceListItems)
                .where(eq(companyPriceListItems.priceListId, list.id))
                .orderBy(asc(companyPriceListItems.productName));
            res.json({ ...list, items });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/company/price-lists/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { name, description, isActive, validFrom, validUntil } = req.body;
            const [list] = await db.update(companyPriceLists)
                .set({
                    name, description,
                    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
                    validFrom: validFrom ? new Date(validFrom) : undefined,
                    validUntil: validUntil ? new Date(validUntil) : undefined,
                    updatedAt: new Date(),
                } as any)
                .where(and(eq(companyPriceLists.id, req.params.id), eq(companyPriceLists.companyId, companyId)))
                .returning();
            if (!list) return res.status(404).json({ error: "Tabela não encontrada" });
            res.json(list);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/price-lists/:id/items", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [list] = await db.select().from(companyPriceLists)
                .where(and(eq(companyPriceLists.id, req.params.id), eq(companyPriceLists.companyId, companyId)));
            if (!list) return res.status(404).json({ error: "Tabela não encontrada" });

            const { productId, productCode, productName, unit, priceUsd, pricePyg } = req.body;
            if (!productName) return res.status(400).json({ error: "Nome do produto é obrigatório" });

            const [item] = await db.insert(companyPriceListItems).values({
                priceListId: list.id,
                productId: productId || null,
                productCode: productCode || null,
                productName,
                unit: unit || "UNI",
                priceUsd: priceUsd !== undefined ? String(priceUsd) : null,
                pricePyg: pricePyg !== undefined ? String(pricePyg) : null,
            }).returning();
            res.json(item);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/company/price-lists/:id/items/:itemId", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const { priceUsd, pricePyg, productName, unit, productCode } = req.body;
            const [item] = await db.update(companyPriceListItems)
                .set({
                    priceUsd: priceUsd !== undefined ? String(priceUsd) : undefined,
                    pricePyg: pricePyg !== undefined ? String(pricePyg) : undefined,
                    productName, unit, productCode, updatedAt: new Date()
                } as any)
                .where(eq(companyPriceListItems.id, req.params.itemId))
                .returning();
            res.json(item);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.delete("/api/company/price-lists/:id/items/:itemId", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            await db.delete(companyPriceListItems).where(eq(companyPriceListItems.id, req.params.itemId));
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // WAREHOUSES
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/warehouses", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const warehouses = await db.select().from(companyWarehouses)
                .where(and(eq(companyWarehouses.companyId, companyId), eq(companyWarehouses.isActive, true)))
                .orderBy(asc(companyWarehouses.name));
            res.json(warehouses);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/warehouses", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { name, address, city } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

            const [wh] = await db.insert(companyWarehouses).values({
                companyId, name, address: address || null, city: city || null,
            }).returning();
            res.json(wh);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // STOCK
    // ──────────────────────────────────────────────────────────────────────────

    /** Full stock across all warehouses */
    app.get("/api/company/stock", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const warehouses = await db.select().from(companyWarehouses)
                .where(eq(companyWarehouses.companyId, companyId));
            const warehouseIds = warehouses.map(w => w.id);
            if (warehouseIds.length === 0) return res.json([]);

            const stockRows = await db.select({
                stockId: companyStock.id,
                warehouseId: companyStock.warehouseId,
                warehouseName: companyWarehouses.name,
                productId: companyStock.productId,
                productName: companyProducts.name,
                productCode: companyProducts.code,
                productCategory: companyProducts.category,
                unit: companyProducts.unit,
                quantity: companyStock.quantity,
                reservedQuantity: companyStock.reservedQuantity,
                updatedAt: companyStock.updatedAt,
            })
                .from(companyStock)
                .innerJoin(companyWarehouses, eq(companyStock.warehouseId, companyWarehouses.id))
                .innerJoin(companyProducts, eq(companyStock.productId, companyProducts.id))
                .where(inArray(companyStock.warehouseId, warehouseIds))
                .orderBy(asc(companyProducts.category), asc(companyProducts.name), asc(companyWarehouses.name));

            res.json(stockRows);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Available stock aggregated by product (sum across all warehouses) */
    app.get("/api/company/stock/available-by-product", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const warehouses = await db.select().from(companyWarehouses)
                .where(eq(companyWarehouses.companyId, companyId));
            const warehouseIds = warehouses.map((w: any) => w.id);
            if (warehouseIds.length === 0) return res.json([]);

            const rows = await db.execute(sql`
                SELECT
                    cs.product_id AS "productId",
                    cp.name AS "productName",
                    cp.unit AS unit,
                    SUM(cs.quantity::numeric) AS "totalQty",
                    SUM(cs.reserved_quantity::numeric) AS "totalReserved",
                    SUM(cs.quantity::numeric - cs.reserved_quantity::numeric) AS available
                FROM company_stock cs
                JOIN company_products cp ON cp.id = cs.product_id
                WHERE cs.warehouse_id = ANY(${warehouseIds})
                GROUP BY cs.product_id, cp.name, cp.unit
                ORDER BY cp.name
            `);
            res.json(rows.rows);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Manual stock adjustment */
    app.post("/api/company/stock/adjust", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { warehouseId, productId, quantity, notes } = req.body;
            if (!warehouseId || !productId || quantity === undefined) {
                return res.status(400).json({ error: "warehouseId, productId e quantity são obrigatórios" });
            }

            await db.execute(sql`
                INSERT INTO company_stock (warehouse_id, product_id, quantity, updated_at)
                VALUES (${warehouseId}, ${productId}, ${quantity}, now())
                ON CONFLICT (warehouse_id, product_id)
                DO UPDATE SET quantity = company_stock.quantity + ${quantity}, updated_at = now()
            `);

            await db.insert(companyStockMovements).values({
                companyId,
                warehouseId,
                productId,
                type: "manual_adjust",
                quantity: String(quantity),
                notes: notes || null,
                createdBy: user.id,
            });

            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Import stock from Excel using Gemini AI — handles any layout/column names */
    app.post("/api/company/stock/import-excel", upload.single("file"), async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });
            if (!req.file) return res.status(400).json({ error: "Envie um arquivo Excel (.xlsx)" });

            const fixedWhId: string | null = (req.body?.warehouseId as string) || null;

            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });

            // Convert Excel to CSV text for Gemini
            const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const csvText = XLSX.utils.sheet_to_csv(sheet);

            const prompt = `Você é um assistente especializado em importação de estoque agrícola. Analise a planilha abaixo e extraia TODOS os produtos de estoque.

Para cada produto extraia:
- nome: nome do produto (campo obrigatório)
- quantidade: quantidade numérica em estoque (campo obrigatório, apenas número)
- unidade: unidade de medida (ex: Litro, Kg, Saco, Un)
- principioAtivo: princípio ativo ou ingrediente ativo se houver
- categoria: categoria do produto se houver (ex: FUNGICIDAS, HERBICIDAS, INSECTICIDAS)

Ignore linhas de título, subtítulo, totais, separadores de categoria (linhas que só têm o nome da categoria), linhas vazias e linhas sem quantidade.

Retorne APENAS JSON válido, sem texto extra:
{
  "produtos": [
    {
      "nome": "PICONAZOL 375 SC",
      "quantidade": 65,
      "unidade": "Litro",
      "principioAtivo": "Picoxystrobin 20% + Prothiconazole 17,5%",
      "categoria": "FUNGICIDAS"
    }
  ]
}

Dados da planilha:
${csvText}`;

            const geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
                    }),
                }
            );

            if (!geminiRes.ok) return res.status(500).json({ error: "Erro ao chamar Gemini AI" });

            const geminiData = await geminiRes.json() as any;
            const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return res.status(422).json({ error: "IA não retornou JSON válido", raw: text.slice(0, 200) });

            const parsed = JSON.parse(jsonMatch[0]);
            const produtos: any[] = parsed.produtos ?? [];

            if (produtos.length === 0) {
                return res.json({ success: true, imported: 0, skipped: 0, errors: [] });
            }

            // Load warehouses and existing products
            const warehouses = await db.select().from(companyWarehouses)
                .where(eq(companyWarehouses.companyId, companyId));

            if (fixedWhId && !warehouses.find((w: any) => w.id === fixedWhId)) {
                return res.status(400).json({ error: "Barracão selecionado não encontrado" });
            }

            const existingProducts = await db.select().from(companyProducts)
                .where(eq(companyProducts.companyId, companyId));

            let imported = 0;
            let skipped = 0;
            const errors: string[] = [];

            for (const p of produtos) {
                const prodName: string = String(p.nome || "").trim();
                const qty = parseFloat(String(p.quantidade ?? "0"));
                const unit: string = String(p.unidade || "Un").trim();

                if (!prodName || isNaN(qty)) { skipped++; continue; }

                // Determine warehouse
                let whId: string | null = fixedWhId;
                if (!whId) { skipped++; continue; } // no warehouse specified and no Deposito column

                // Find or create product
                let prod = existingProducts.find((ep: any) =>
                    ep.name.toLowerCase() === prodName.toLowerCase()
                );

                if (!prod) {
                    // Auto-create the product
                    try {
                        const [newProd] = await db.insert(companyProducts).values({
                            companyId,
                            name: prodName,
                            unit,
                            activeIngredient: p.principioAtivo || null,
                            category: p.categoria ? p.categoria.toLowerCase().replace(/[^a-z]/g, "_") : null,
                            isActive: true,
                        } as any).returning();
                        prod = newProd;
                        existingProducts.push(newProd); // avoid re-creating in same import
                    } catch {
                        errors.push(`Erro ao criar produto "${prodName}"`);
                        skipped++;
                        continue;
                    }
                }

                try {
                    await db.execute(sql`
                        INSERT INTO company_stock (warehouse_id, product_id, quantity, updated_at)
                        VALUES (${whId}, ${prod.id}, ${qty}, now())
                        ON CONFLICT (warehouse_id, product_id)
                        DO UPDATE SET quantity = ${qty}, updated_at = now()
                    `);
                    await db.insert(companyStockMovements).values({
                        companyId, warehouseId: whId, productId: prod.id,
                        type: "import", quantity: String(qty), notes: "Importação via planilha", createdBy: user.id,
                    });
                    imported++;
                } catch {
                    errors.push(`Erro ao importar estoque de "${prodName}"`);
                    skipped++;
                }
            }

            res.json({ success: true, imported, skipped, errors: errors.slice(0, 10) });
        } catch (e: any) {
            console.error("[Stock Import]", e);
            res.status(500).json({ error: "Erro ao importar planilha" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SALES ORDERS
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/orders", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const orders = await db.select({
                id: salesOrders.id,
                orderNumber: salesOrders.orderNumber,
                status: salesOrders.status,
                paymentType: salesOrders.paymentType,
                currency: salesOrders.currency,
                totalAmountUsd: salesOrders.totalAmountUsd,
                dueDate: salesOrders.dueDate,
                agriculturalYear: salesOrders.agriculturalYear,
                culture: salesOrders.culture,
                createdAt: salesOrders.createdAt,
                clientName: companyClients.name,
                clientId: salesOrders.clientId,
            })
                .from(salesOrders)
                .innerJoin(companyClients, eq(salesOrders.clientId, companyClients.id))
                .where(eq(salesOrders.companyId, companyId))
                .orderBy(desc(salesOrders.createdAt));

            res.json(orders);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.get("/api/company/orders/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [order] = await db.select().from(salesOrders)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

            const items = await db.select().from(salesOrderItems)
                .where(eq(salesOrderItems.orderId, order.id))
                .orderBy(asc(salesOrderItems.productName));

            const client = await db.select().from(companyClients).where(eq(companyClients.id, order.clientId)).limit(1);

            res.json({ ...order, items, client: client[0] ?? null });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/orders", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const {
                clientId, priceListId, paymentType, freightPayer,
                deliveryLocation, paymentLocation, dueDate,
                agriculturalYear, zafra, culture, observations, currency,
                items,
            } = req.body;

            if (!clientId) return res.status(400).json({ error: "clientId é obrigatório" });
            if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Itens são obrigatórios" });

            const orderNumber = await nextOrderNumber(companyId);

            const totalAmountUsd = items.reduce((acc: number, i: any) =>
                acc + (parseFloat(i.totalPriceUsd ?? 0) || 0), 0);

            const [order] = await db.insert(salesOrders).values({
                companyId,
                orderNumber,
                clientId,
                consultantId: user.id,
                priceListId: priceListId || null,
                paymentType: paymentType || "credito",
                freightPayer: freightPayer || "cliente",
                deliveryLocation: deliveryLocation || null,
                paymentLocation: paymentLocation || null,
                dueDate: dueDate ? new Date(dueDate) : null,
                agriculturalYear: agriculturalYear || null,
                zafra: zafra || null,
                culture: culture || null,
                status: "draft",
                observations: observations || null,
                totalAmountUsd: String(totalAmountUsd),
                currency: currency || "USD",
            }).returning();

            // Insert items
            await db.insert(salesOrderItems).values(
                items.map((i: any) => ({
                    orderId: order.id,
                    productId: i.productId || null,
                    productCode: i.productCode || null,
                    productName: i.productName,
                    quantity: String(i.quantity),
                    unit: i.unit || "UNI",
                    unitPriceUsd: i.unitPriceUsd !== undefined ? String(i.unitPriceUsd) : null,
                    totalPriceUsd: i.totalPriceUsd !== undefined ? String(i.totalPriceUsd) : null,
                    warehouseId: i.warehouseId || null,
                    notes: i.notes || null,
                }))
            );

            res.json({ ...order, items });
        } catch (e) {
            console.error("[Orders] create:", e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/company/orders/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [order] = await db.select().from(salesOrders)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
            if (!["draft"].includes(order.status)) {
                return res.status(400).json({ error: "Apenas pedidos em rascunho podem ser editados" });
            }

            const {
                clientId, priceListId, paymentType, freightPayer,
                deliveryLocation, paymentLocation, dueDate,
                agriculturalYear, zafra, culture, observations, currency, items,
            } = req.body;

            const totalAmountUsd = Array.isArray(items)
                ? items.reduce((acc: number, i: any) => acc + (parseFloat(i.totalPriceUsd ?? 0) || 0), 0)
                : parseFloat(order.totalAmountUsd as string ?? "0");

            await db.update(salesOrders)
                .set({
                    clientId, priceListId, paymentType, freightPayer,
                    deliveryLocation, paymentLocation,
                    dueDate: dueDate ? new Date(dueDate) : undefined,
                    agriculturalYear, zafra, culture, observations, currency,
                    totalAmountUsd: String(totalAmountUsd),
                    updatedAt: new Date(),
                } as any)
                .where(eq(salesOrders.id, order.id));

            if (Array.isArray(items)) {
                await db.delete(salesOrderItems).where(eq(salesOrderItems.orderId, order.id));
                await db.insert(salesOrderItems).values(
                    items.map((i: any) => ({
                        orderId: order.id,
                        productId: i.productId || null,
                        productCode: i.productCode || null,
                        productName: i.productName,
                        quantity: String(i.quantity),
                        unit: i.unit || "UNI",
                        unitPriceUsd: i.unitPriceUsd !== undefined ? String(i.unitPriceUsd) : null,
                        totalPriceUsd: i.totalPriceUsd !== undefined ? String(i.totalPriceUsd) : null,
                        warehouseId: i.warehouseId || null,
                        notes: i.notes || null,
                    }))
                );
            }

            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Submit order for director approval */
    app.post("/api/company/orders/:id/submit", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [order] = await db.select().from(salesOrders)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
            if (order.status !== "draft") return res.status(400).json({ error: "Pedido precisa estar em rascunho" });

            await db.update(salesOrders).set({ status: "pending_director", updatedAt: new Date() } as any)
                .where(eq(salesOrders.id, order.id));
            await reserveStockForOrder(order.id, companyId, user.id);
            res.json({ success: true, status: "pending_director" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Director approves order → goes directly to pending_billing */
    app.post("/api/company/orders/:id/approve", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [cu] = await db.select().from(companyUsers)
                .where(and(eq(companyUsers.userId, user.id), eq(companyUsers.companyId, companyId)));
            if (!["director", "admin_empresa"].includes(cu?.role ?? "")) {
                return res.status(403).json({ error: "Apenas o diretor pode aprovar pedidos" });
            }

            const [order] = await db.select().from(salesOrders)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
            if (order.status !== "pending_director") return res.status(400).json({ error: "Pedido não está aguardando aprovação" });

            await db.update(salesOrders)
                .set({ status: "pending_billing", approvedById: user.id, approvedAt: new Date(), updatedAt: new Date() } as any)
                .where(eq(salesOrders.id, order.id));
            res.json({ success: true, status: "pending_billing" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Director rejects order → cancelled */
    app.post("/api/company/orders/:id/reject", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [rejectedOrder] = await db.update(salesOrders)
                .set({ status: "cancelled", updatedAt: new Date() } as any)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)))
                .returning();
            if (rejectedOrder) await releaseStockReservation(rejectedOrder.id, companyId, user.id);
            res.json({ success: true, status: "cancelled" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Director sends to finance (special case: client has no credit) */
    app.post("/api/company/orders/:id/to-finance", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [order] = await db.select().from(salesOrders)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
            if (order.status !== "pending_director") return res.status(400).json({ error: "Pedido precisa estar aguardando diretor" });

            await db.update(salesOrders)
                .set({ status: "pending_finance", updatedAt: new Date() } as any)
                .where(eq(salesOrders.id, order.id));
            res.json({ success: true, status: "pending_finance" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Finance approves credit → goes to pending_billing */
    app.post("/api/company/orders/:id/finance-approve", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            await db.update(salesOrders)
                .set({ status: "pending_billing", updatedAt: new Date() } as any)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            res.json({ success: true, status: "pending_billing" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Finance blocks credit → cancelled */
    app.post("/api/company/orders/:id/finance-reject", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [finRejectedOrder] = await db.update(salesOrders)
                .set({ status: "cancelled", updatedAt: new Date() } as any)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)))
                .returning();
            if (finRejectedOrder) await releaseStockReservation(finRejectedOrder.id, companyId, user.id);
            res.json({ success: true, status: "cancelled" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Faturista marks order as manually billed */
    app.post("/api/company/orders/:id/mark-billed", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [order] = await db.select().from(salesOrders)
                .where(and(eq(salesOrders.id, req.params.id), eq(salesOrders.companyId, companyId)));
            if (!order) return res.status(404).json({ error: "Pedido não encontrado" });
            if (order.status !== "pending_billing") return res.status(400).json({ error: "Pedido precisa estar em Para Faturar" });

            await db.update(salesOrders)
                .set({ status: "invoiced", updatedAt: new Date() } as any)
                .where(eq(salesOrders.id, order.id));

            // Deduct real stock and release reservation
            const orderItems = await db.select().from(salesOrderItems).where(eq(salesOrderItems.orderId, order.id));
            for (const item of orderItems) {
                if (!item.warehouseId || !item.productId) continue;
                const qty = parseFloat(item.quantity as string);
                await db.execute(sql`
                    UPDATE company_stock
                    SET quantity = quantity - ${qty},
                        reserved_quantity = GREATEST(0, reserved_quantity - ${qty}),
                        updated_at = now()
                    WHERE warehouse_id = ${item.warehouseId} AND product_id = ${item.productId}
                `);
                await db.insert(companyStockMovements).values({
                    companyId,
                    warehouseId: item.warehouseId,
                    productId: item.productId,
                    type: "out",
                    quantity: String(qty),
                    referenceType: "order",
                    referenceId: order.id,
                    createdBy: user.id,
                });
            }

            res.json({ success: true, status: "invoiced" });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // SALES INVOICES (received from external billing system)
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/invoices", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const invoices = await db.select({
                id: salesInvoices.id,
                invoiceNumber: salesInvoices.invoiceNumber,
                issueDate: salesInvoices.issueDate,
                dueDate: salesInvoices.dueDate,
                totalAmountUsd: salesInvoices.totalAmountUsd,
                currency: salesInvoices.currency,
                status: salesInvoices.status,
                reconciliationStatus: salesInvoices.reconciliationStatus,
                source: salesInvoices.source,
                createdAt: salesInvoices.createdAt,
                clientName: companyClients.name,
                clientId: salesInvoices.clientId,
            })
                .from(salesInvoices)
                .leftJoin(companyClients, eq(salesInvoices.clientId, companyClients.id))
                .where(eq(salesInvoices.companyId, companyId))
                .orderBy(desc(salesInvoices.createdAt));

            res.json(invoices);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.get("/api/company/invoices/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [invoice] = await db.select().from(salesInvoices)
                .where(and(eq(salesInvoices.id, req.params.id), eq(salesInvoices.companyId, companyId)));
            if (!invoice) return res.status(404).json({ error: "Fatura não encontrada" });

            const items = await db.select().from(salesInvoiceItems)
                .where(eq(salesInvoiceItems.invoiceId, invoice.id));

            const links = await db.select().from(salesOrderInvoiceLinks)
                .where(eq(salesOrderInvoiceLinks.invoiceId, invoice.id));

            res.json({ ...invoice, items, links });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Manual invoice creation */
    app.post("/api/company/invoices", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { clientId, invoiceNumber, issueDate, dueDate, currency, totalAmountUsd, totalAmountPyg, items } = req.body;

            const [invoice] = await db.insert(salesInvoices).values({
                companyId,
                clientId: clientId || null,
                invoiceNumber: invoiceNumber || null,
                issueDate: issueDate ? new Date(issueDate) : null,
                dueDate: dueDate ? new Date(dueDate) : null,
                currency: currency || "USD",
                totalAmountUsd: totalAmountUsd ? String(totalAmountUsd) : null,
                totalAmountPyg: totalAmountPyg ? String(totalAmountPyg) : null,
                source: "manual",
                createdBy: user.id,
            }).returning();

            if (Array.isArray(items) && items.length > 0) {
                await db.insert(salesInvoiceItems).values(
                    items.map((i: any) => ({
                        invoiceId: invoice.id,
                        productId: i.productId || null,
                        productCode: i.productCode || null,
                        productName: i.productName,
                        quantity: String(i.quantity),
                        unit: i.unit || "UNI",
                        unitPriceUsd: i.unitPriceUsd !== undefined ? String(i.unitPriceUsd) : null,
                        totalPriceUsd: i.totalPriceUsd !== undefined ? String(i.totalPriceUsd) : null,
                        warehouseId: i.warehouseId || null,
                    }))
                );
            }

            // Auto-reconcile
            const { linked } = await autoReconcileInvoice(invoice.id, companyId);

            // Deduct stock
            await deductStockFromInvoice(invoice.id, companyId, user.id);

            res.json({ ...invoice, linkedOrders: linked });
        } catch (e) {
            console.error("[Invoices] create:", e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Upload PDF invoice (AI extraction) */
    app.post("/api/company/invoices/upload-pdf", upload.single("pdf"), async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });
            if (!req.file) return res.status(400).json({ error: "Envie um arquivo PDF" });

            const { extractInvoiceFromPdf } = await import("./services/invoice-email-service");
            const pdfBase64 = req.file.buffer.toString("base64");
            const extracted = await extractInvoiceFromPdf(pdfBase64);

            // Try to match client by invoice data
            let clientId: string | null = null;
            if (extracted.supplier) {
                const [matchedClient] = await db.select().from(companyClients)
                    .where(and(
                        eq(companyClients.companyId, companyId),
                        sql`lower(${companyClients.name}) like lower(${'%' + extracted.supplier.substring(0, 10) + '%'})`
                    )).limit(1);
                clientId = matchedClient?.id ?? null;
            }

            const [invoice] = await db.insert(salesInvoices).values({
                companyId,
                clientId,
                invoiceNumber: extracted.invoiceNumber || null,
                issueDate: extracted.issueDate ? new Date(extracted.issueDate) : null,
                currency: extracted.currency || "USD",
                totalAmountUsd: String(extracted.totalAmount),
                source: "email_import",
                pdfBase64,
                createdBy: user.id,
            }).returning();

            if (extracted.items.length > 0) {
                await db.insert(salesInvoiceItems).values(
                    extracted.items.map((i: any) => ({
                        invoiceId: invoice.id,
                        productCode: i.productCode || null,
                        productName: i.productName,
                        quantity: String(i.quantity),
                        unit: i.unit || "UNI",
                        unitPriceUsd: String(i.unitPrice),
                        totalPriceUsd: String(i.totalPrice),
                    }))
                );
            }

            const { linked } = await autoReconcileInvoice(invoice.id, companyId);
            await deductStockFromInvoice(invoice.id, companyId, user.id);

            res.json({ invoice, extracted, linkedOrders: linked });
        } catch (e) {
            console.error("[Invoices] upload-pdf:", e);
            res.status(500).json({ error: (e as Error).message });
        }
    });

    /** Manual reconcile: link invoice to a specific order */
    app.post("/api/company/invoices/:id/reconcile", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            // Try auto first
            const { linked } = await autoReconcileInvoice(req.params.id, companyId);
            res.json({ success: true, linked });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Download invoice PDF */
    app.get("/api/company/invoices/:id/pdf", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [invoice] = await db.select({ pdfBase64: salesInvoices.pdfBase64, invoiceNumber: salesInvoices.invoiceNumber })
                .from(salesInvoices)
                .where(and(eq(salesInvoices.id, req.params.id), eq(salesInvoices.companyId, companyId)));

            if (!invoice?.pdfBase64) return res.status(404).json({ error: "PDF não disponível" });

            const buf = Buffer.from(invoice.pdfBase64, "base64");
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", `attachment; filename="fatura-${invoice.invoiceNumber ?? req.params.id}.pdf"`);
            res.send(buf);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // PAGARÉS
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/pagares", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const pagares = await db.select({
                id: companyPagares.id,
                pagareNumber: companyPagares.pagareNumber,
                amountUsd: companyPagares.amountUsd,
                amountPyg: companyPagares.amountPyg,
                currency: companyPagares.currency,
                issueDate: companyPagares.issueDate,
                dueDate: companyPagares.dueDate,
                status: companyPagares.status,
                notes: companyPagares.notes,
                paidDate: companyPagares.paidDate,
                createdAt: companyPagares.createdAt,
                clientName: companyClients.name,
                clientId: companyPagares.clientId,
            })
                .from(companyPagares)
                .innerJoin(companyClients, eq(companyPagares.clientId, companyClients.id))
                .where(eq(companyPagares.companyId, companyId))
                .orderBy(asc(companyPagares.dueDate));

            res.json(pagares);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/pagares", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { clientId, invoiceId, orderId, pagareNumber, amountUsd, amountPyg, currency, issueDate, dueDate, notes } = req.body;
            if (!clientId || !dueDate) return res.status(400).json({ error: "clientId e dueDate são obrigatórios" });

            const [pagare] = await db.insert(companyPagares).values({
                companyId,
                clientId,
                invoiceId: invoiceId || null,
                orderId: orderId || null,
                pagareNumber: pagareNumber || null,
                amountUsd: amountUsd ? String(amountUsd) : null,
                amountPyg: amountPyg ? String(amountPyg) : null,
                currency: currency || "USD",
                issueDate: issueDate ? new Date(issueDate) : null,
                dueDate: new Date(dueDate),
                notes: notes || null,
                registeredBy: user.id,
            }).returning();
            res.json(pagare);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/company/pagares/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { status, paidDate, notes, amountUsd, amountPyg, dueDate } = req.body;
            const [pagare] = await db.update(companyPagares)
                .set({
                    status,
                    paidDate: paidDate ? new Date(paidDate) : undefined,
                    notes,
                    amountUsd: amountUsd !== undefined ? String(amountUsd) : undefined,
                    amountPyg: amountPyg !== undefined ? String(amountPyg) : undefined,
                    dueDate: dueDate ? new Date(dueDate) : undefined,
                    updatedAt: new Date(),
                } as any)
                .where(and(eq(companyPagares.id, req.params.id), eq(companyPagares.companyId, companyId)))
                .returning();
            if (!pagare) return res.status(404).json({ error: "Pagaré não encontrado" });
            res.json(pagare);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // REMISSIONS
    // ──────────────────────────────────────────────────────────────────────────

    app.get("/api/company/remissions", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const remissions = await db.select().from(companyRemissions)
                .where(eq(companyRemissions.companyId, companyId))
                .orderBy(desc(companyRemissions.createdAt));
            res.json(remissions);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.get("/api/company/remissions/:id", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [remission] = await db.select().from(companyRemissions)
                .where(and(eq(companyRemissions.id, req.params.id), eq(companyRemissions.companyId, companyId)));
            if (!remission) return res.status(404).json({ error: "Remissão não encontrada" });

            const items = await db.select({
                id: companyRemissionItems.id,
                quantity: companyRemissionItems.quantity,
                notes: companyRemissionItems.notes,
                productName: companyProducts.name,
                productCode: companyProducts.code,
                unit: companyProducts.unit,
            })
                .from(companyRemissionItems)
                .innerJoin(companyProducts, eq(companyRemissionItems.productId, companyProducts.id))
                .where(eq(companyRemissionItems.remissionId, remission.id));

            res.json({ ...remission, items });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/remissions", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const { fromWarehouseId, toWarehouseId, notes, items } = req.body;
            if (!fromWarehouseId || !toWarehouseId) return res.status(400).json({ error: "Depósito origem e destino são obrigatórios" });
            if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Itens são obrigatórios" });

            // Generate remission number
            const [{ count }] = await db
                .select({ count: sql<number>`count(*)::int` })
                .from(companyRemissions)
                .where(eq(companyRemissions.companyId, companyId));
            const remissionNumber = `REM-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

            const [remission] = await db.insert(companyRemissions).values({
                companyId, remissionNumber,
                fromWarehouseId, toWarehouseId,
                notes: notes || null,
                createdBy: user.id,
            }).returning();

            await db.insert(companyRemissionItems).values(
                items.map((i: any) => ({
                    remissionId: remission.id,
                    productId: i.productId,
                    quantity: String(i.quantity),
                    notes: i.notes || null,
                }))
            );

            res.json(remission);
        } catch (e) {
            console.error("[Remissions] create:", e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Complete remission: deduct from origin, add to destination */
    app.post("/api/company/remissions/:id/complete", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            const [remission] = await db.select().from(companyRemissions)
                .where(and(eq(companyRemissions.id, req.params.id), eq(companyRemissions.companyId, companyId)));
            if (!remission) return res.status(404).json({ error: "Remissão não encontrada" });
            if (remission.status === "completed") return res.status(400).json({ error: "Remissão já concluída" });

            const items = await db.select().from(companyRemissionItems)
                .where(eq(companyRemissionItems.remissionId, remission.id));

            for (const item of items) {
                const qty = parseFloat(item.quantity as string);

                // Deduct from origin
                await db.execute(sql`
                    INSERT INTO company_stock (warehouse_id, product_id, quantity, updated_at)
                    VALUES (${remission.fromWarehouseId}, ${item.productId}, ${-qty}, now())
                    ON CONFLICT (warehouse_id, product_id)
                    DO UPDATE SET quantity = company_stock.quantity - ${qty}, updated_at = now()
                `);
                await db.insert(companyStockMovements).values({
                    companyId, warehouseId: remission.fromWarehouseId, productId: item.productId,
                    type: "transfer_out", quantity: String(qty),
                    referenceType: "remission", referenceId: remission.id, createdBy: user.id,
                });

                // Add to destination
                await db.execute(sql`
                    INSERT INTO company_stock (warehouse_id, product_id, quantity, updated_at)
                    VALUES (${remission.toWarehouseId}, ${item.productId}, ${qty}, now())
                    ON CONFLICT (warehouse_id, product_id)
                    DO UPDATE SET quantity = company_stock.quantity + ${qty}, updated_at = now()
                `);
                await db.insert(companyStockMovements).values({
                    companyId, warehouseId: remission.toWarehouseId, productId: item.productId,
                    type: "transfer_in", quantity: String(qty),
                    referenceType: "remission", referenceId: remission.id, createdBy: user.id,
                });
            }

            await db.update(companyRemissions)
                .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() } as any)
                .where(eq(companyRemissions.id, remission.id));

            res.json({ success: true });
        } catch (e) {
            console.error("[Remissions] complete:", e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.post("/api/company/remissions/:id/cancel", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const companyId = await getCompanyId(user.id);
            if (!companyId) return res.status(403).json({ error: "Sem empresa vinculada" });

            await db.update(companyRemissions)
                .set({ status: "cancelled", updatedAt: new Date() } as any)
                .where(and(eq(companyRemissions.id, req.params.id), eq(companyRemissions.companyId, companyId)));
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    // ──────────────────────────────────────────────────────────────────────────
    // ADMIN: Company + User management (admin only)
    // ──────────────────────────────────────────────────────────────────────────

    /** Create a company (platform admin) */
    app.post("/api/admin/companies", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const { name, ruc, address, city, phone, email } = req.body;
            if (!name) return res.status(400).json({ error: "Nome é obrigatório" });

            const [company] = await db.insert(companies).values({ name, ruc, address, city, phone, email }).returning();
            res.json(company);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Corrige platform role de todos os usuários vinculados a empresas para 'rtv' */
    app.post("/api/admin/companies/fix-platform-roles", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const admin = req.user as any;
            if (admin.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            // Busca todos os userIds vinculados a alguma empresa
            const allCompanyUsers = await db.select({ userId: companyUsers.userId }).from(companyUsers);
            const userIds = Array.from(new Set(allCompanyUsers.map((cu: any) => cu.userId))) as string[];

            if (userIds.length === 0) return res.json({ updated: 0 });

            // Atualiza platform role para 'rtv' de todos que NÃO são administrador
            const result = await db.update(users)
                .set({ role: "rtv" })
                .where(and(
                    inArray(users.id, userIds),
                    sql`role NOT IN ('administrador', 'rtv')`
                ))
                .returning({ id: users.id, username: users.username, role: users.role });

            res.json({ updated: result.length, users: result });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.get("/api/admin/companies", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const all = await db.select().from(companies).orderBy(asc(companies.name));
            res.json(all);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Create a new platform user AND link to company in one step */
    app.post("/api/admin/companies/:companyId/users/create-and-link", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const admin = req.user as any;
            if (admin.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const { username, name, email, password, role } = req.body;
            if (!username || !name || !password) return res.status(400).json({ error: "username, nome e senha são obrigatórios" });

            // Check username conflict
            const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
            if (existing) return res.status(400).json({ error: "Nome de usuário já existe" });

            const hashedPwd = await hashPassword(password);
            const [newUser] = await db.insert(users).values({
                username: username.trim(),
                name,
                email: email || null,
                password: hashedPwd,
                role: "rtv", // sempre rtv na plataforma; cargo real fica em company_users
            }).returning();

            const [cu] = await db.insert(companyUsers).values({
                companyId: req.params.companyId,
                userId: newUser.id,
                role: role || "rtv", // cargo dentro da empresa (director, faturista, etc.)
            }).returning();

            res.json({ user: newUser, companyUser: cu });
        } catch (e) {
            console.error(e);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /** Link user to company */
    app.post("/api/admin/companies/:companyId/users", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const { userId, role } = req.body;
            if (!userId) return res.status(400).json({ error: "userId é obrigatório" });

            const [cu] = await db.insert(companyUsers).values({
                companyId: req.params.companyId,
                userId,
                role: role || "rtv",
            }).onConflictDoNothing().returning();
            res.json(cu);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.get("/api/admin/companies/:companyId/users", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const rows = await db
                .select({
                    userId: companyUsers.userId,
                    role: companyUsers.role,
                    createdAt: companyUsers.createdAt,
                    userName: users.username,
                    userEmail: users.email,
                })
                .from(companyUsers)
                .leftJoin(users, eq(companyUsers.userId, users.id))
                .where(eq(companyUsers.companyId, req.params.companyId));
            res.json(rows);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/admin/companies/:companyId/users/:userId", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const { role } = req.body;
            if (!role) return res.status(400).json({ error: "role é obrigatório" });

            await db.update(companyUsers)
                .set({ role })
                .where(and(
                    eq(companyUsers.companyId, req.params.companyId),
                    eq(companyUsers.userId, req.params.userId)
                ));
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.delete("/api/admin/companies/:companyId/users/:userId", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            await db.delete(companyUsers).where(and(
                eq(companyUsers.companyId, req.params.companyId),
                eq(companyUsers.userId, req.params.userId)
            ));
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    app.put("/api/admin/companies/:companyId", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            if (user.role !== "administrador") return res.status(403).json({ error: "Acesso negado" });

            const { name, ruc, address, city, phone, email, isActive } = req.body;
            const [updated] = await db.update(companies)
                .set({ name, ruc, address, city, phone, email, isActive })
                .where(eq(companies.id, req.params.companyId))
                .returning();
            res.json(updated);
        } catch (e) {
            res.status(500).json({ error: "Erro interno" });
        }
    });
}
