/**
 * Farm Invoice & Admin Manuals Routes
 * Extracted from farm-routes.ts
 */
import { Express, Request, Response, NextFunction } from "express";
import { requireFarmer, requireAdminManuals, upload, parseLocalDate } from "./farm-middleware";
import { farmStorage } from "./farm-storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { farmProductsCatalog, farmStockMovements, farmInvoiceItems } from "@shared/schema";
import { parseFarmInvoicePDF, parseFarmInvoiceImage } from "./parse-farm-invoice";

export function registerFarmInvoiceRoutes(app: Express) {

    // ==================== INVOICES ====================

    app.get("/api/farm/invoices", requireFarmer, async (req, res) => {
        try {
            const invoices = await farmStorage.getInvoices((req.user as any).id);
            // Strip pdfBase64 from list response (can be megabytes), add hasFile flag
            const light = invoices.map((inv: any) => {
                const { pdfBase64, rawPdfData, ...rest } = inv;
                return { ...rest, hasFile: !!pdfBase64 };
            });
            res.json(light);
        } catch (error) {
            console.error("[FARM_INVOICES_GET]", error);
            res.status(500).json({ error: "Failed to get invoices" });
        }
    });

    // Invoices grouped by supplier for dashboard cards
    app.get("/api/farm/invoices/summary/by-supplier", requireFarmer, async (req, res) => {
        try {
            const invoices = await farmStorage.getInvoices((req.user as any).id);
            const supplierMap: Record<string, any> = {};

            for (const inv of invoices) {
                const supplier = inv.supplier || "Fornecedor Desconhecido";
                if (!supplierMap[supplier]) {
                    supplierMap[supplier] = {
                        supplier,
                        totalAmount: 0,
                        invoiceCount: 0,
                        invoices: [],
                    };
                }
                const items = await farmStorage.getInvoiceItems(inv.id);
                supplierMap[supplier].totalAmount += parseFloat(inv.totalAmount || "0");
                supplierMap[supplier].invoiceCount += 1;
                supplierMap[supplier].invoices.push({
                    id: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    issueDate: inv.issueDate,
                    totalAmount: inv.totalAmount,
                    currency: inv.currency,
                    status: inv.status,
                    items: items.map(it => ({
                        productName: it.productName,
                        quantity: it.quantity,
                        unit: it.unit,
                        totalPrice: it.totalPrice,
                    })),
                });
            }

            res.json(Object.values(supplierMap));
        } catch (error) {
            console.error("[FARM_SUPPLIER_SUMMARY]", error);
            res.status(500).json({ error: "Failed to get supplier summary" });
        }
    });

    app.get("/api/farm/invoices/:id", requireFarmer, async (req, res) => {
        try {
            const invoice = await farmStorage.getInvoiceById(req.params.id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });
            const items = await farmStorage.getInvoiceItems(req.params.id);
            const { pdfBase64, rawPdfData, ...rest } = invoice as any;
            res.json({ ...rest, hasFile: !!pdfBase64, items });
        } catch (error) {
            console.error("[FARM_INVOICE_GET]", error);
            res.status(500).json({ error: "Failed to get invoice" });
        }
    });

    // Download the stored invoice file (PDF or image)
    app.get("/api/farm/invoices/:id/file", requireFarmer, async (req, res) => {
        try {
            const invoice = await farmStorage.getInvoiceById(req.params.id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });
            if (!(invoice as any).pdfBase64) return res.status(404).json({ error: "No file stored for this invoice" });

            const mimeType = (invoice as any).fileMimeType || "application/pdf";
            const buffer = Buffer.from((invoice as any).pdfBase64, "base64");
            const ext = mimeType.includes("pdf") ? "pdf" : mimeType.includes("png") ? "png" : "jpg";
            const filename = `fatura-${invoice.invoiceNumber || invoice.id}.${ext}`;

            res.setHeader("Content-Type", mimeType);
            res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
            res.send(buffer);
        } catch (error) {
            console.error("[FARM_INVOICE_FILE]", error);
            res.status(500).json({ error: "Failed to get invoice file" });
        }
    });

    // Upload and parse PDF invoice
    app.post("/api/farm/invoices/import", requireFarmer, upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "PDF file required" });
            }

            let parsed;
            const mimeType = req.file.mimetype;

            if (mimeType === "application/pdf") {
                parsed = await parseFarmInvoicePDF(req.file.buffer);
            } else if (mimeType.startsWith("image/")) {
                parsed = await parseFarmInvoiceImage(req.file.buffer, mimeType);
            } else {
                return res.status(400).json({ error: "Unsupported file type. Use PDF or Image (JPG, PNG)." });
            }


            // Verificacao de duplicidade
            const farmerId = (req.user as any).id;
            const { farmInvoices } = await import("../shared/schema");
            const { db } = await import("./db");
            const { eq, and, or, ilike } = await import("drizzle-orm");

            const existingInvoices = await db.select({
                id: farmInvoices.id,
                invoiceNumber: farmInvoices.invoiceNumber,
                supplier: farmInvoices.supplier,
                totalAmount: farmInvoices.totalAmount,
                status: farmInvoices.status,
            }).from(farmInvoices).where(eq(farmInvoices.farmerId, farmerId));

            const parsedAmount = parseFloat(String(parsed.totalAmount)) || 0;
            const duplicate = existingInvoices.find(inv => {
                const invAmount = parseFloat(inv.totalAmount as string) || 0;
                const sameNumber = parsed.invoiceNumber && inv.invoiceNumber &&
                    inv.invoiceNumber.replace(/\D/g, '') === parsed.invoiceNumber.replace(/\D/g, '');
                const sameSupplier = parsed.supplier && inv.supplier &&
                    inv.supplier.toLowerCase().includes(parsed.supplier.toLowerCase().substring(0, 10));
                const sameAmount = Math.abs(invAmount - parsedAmount) < 0.01;
                return (sameNumber && sameAmount) || (sameNumber && sameSupplier) || (sameSupplier && sameAmount);
            });

            if (duplicate) {
                const statusLabel = duplicate.status === "confirmed" ? "confirmada" : "pendente";
                return res.status(409).json({
                    error: "duplicate",
                    message: `⚠️ Fatura possivelmente duplicada! Já existe uma fatura ${statusLabel} com dados semelhantes:\n` +
                        `• Número: ${duplicate.invoiceNumber || 'N/A'}\n` +
                        `• Fornecedor: ${duplicate.supplier || 'N/A'}\n` +
                        `• Valor: $ ${(parseFloat(duplicate.totalAmount as string) || 0).toFixed(2)}`,
                    existingId: duplicate.id,
                });
            }

            // Determine dueDate: from parser, or fallback to issueDate + 30 days
            let invoiceDueDate: Date | null = parsed.dueDate;
            if (!invoiceDueDate && parsed.issueDate) {
                invoiceDueDate = new Date(parsed.issueDate);
                invoiceDueDate.setDate(invoiceDueDate.getDate() + 30);
            }

            // Auto-link to season: find which season's payment period contains the invoice due date
            let seasonId = req.body?.seasonId || null;
            if (!seasonId && invoiceDueDate) {
                try {
                    const seasons = await farmStorage.getSeasons(farmerId);
                    const matchedSeason = seasons.find((s: any) => {
                        if (!s.paymentStartDate || !s.paymentEndDate) return false;
                        const start = new Date(s.paymentStartDate);
                        const end = new Date(s.paymentEndDate);
                        return invoiceDueDate! >= start && invoiceDueDate! <= end;
                    });
                    if (matchedSeason) {
                        seasonId = matchedSeason.id;
                        console.log(`[INVOICE→SEASON] Auto-linked invoice to season "${matchedSeason.name}" (dueDate: ${invoiceDueDate.toISOString().slice(0, 10)})`);
                    }
                } catch (err) {
                    console.error("[INVOICE→SEASON] Error auto-linking:", err);
                }
            }

            // Create invoice record — store full file as base64
            const skipStockEntry = req.body?.skipStockEntry === "true";
            const fileBase64 = req.file.buffer.toString("base64");
            const invoice = await farmStorage.createInvoice({
                farmerId,
                seasonId,
                invoiceNumber: parsed.invoiceNumber,
                supplier: parsed.supplier,
                issueDate: parsed.issueDate,
                dueDate: invoiceDueDate,
                currency: parsed.currency,
                totalAmount: String(parsed.totalAmount),
                status: "pending",
                skipStockEntry,
                rawPdfData: parsed.rawText.substring(0, 5000),
                source: "manual",
                pdfBase64: fileBase64,
                fileMimeType: mimeType,
            });

            // Create invoice items (try to match with catalog products, auto-create if not found)
            const allProducts = await farmStorage.getAllProducts();
            const invoiceItems = [];

            for (const item of parsed.items) {
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
                            unit: item.unit,
                            category: null,
                            dosePerHa: null,
                            activeIngredient: null,
                            status: "pending_review",
                            isDraft: true
                        });
                        allProducts.push(matchedProduct); // Add to list to avoid duplicates in same invoice
                        console.log(`[FARM_INVOICE_IMPORT] Auto-created product: ${item.productName} (${matchedProduct.id})`);
                    } catch (err) {
                        console.error(`[FARM_INVOICE_IMPORT] Failed to auto-create product: ${item.productName}`, err);
                    }
                }

                invoiceItems.push({
                    invoiceId: invoice.id,
                    productId: matchedProduct?.id || null,
                    productCode: item.productCode,
                    productName: item.productName,
                    unit: item.unit,
                    quantity: String(item.quantity),
                    unitPrice: String(item.unitPrice),
                    discount: String(item.discount),
                    totalPrice: String(item.totalPrice),
                    batch: item.batch || null,
                    expiryDate: item.expiryDate || null,
                });
            }

            if (invoiceItems.length > 0) {
                await farmStorage.createInvoiceItems(invoiceItems);
            }

            // Return parsed data for review
            const items = await farmStorage.getInvoiceItems(invoice.id);
            res.status(201).json({
                invoice,
                items,
                parsedItemCount: parsed.items.length,
                message: `Fatura ${parsed.invoiceNumber} importada com ${parsed.items.length} itens.`,
            });
        } catch (error) {
            console.error("[FARM_INVOICE_IMPORT]", error);
            res.status(500).json({ error: "Failed to import invoice" });
        }
    });

    // Confirm invoice → push items to stock + create accounts payable entry
    app.post("/api/farm/invoices/:id/confirm", requireFarmer, async (req, res) => {
        try {
            const invoice = await farmStorage.getInvoiceById(req.params.id);
            if (!invoice) return res.status(404).json({ error: "Invoice not found" });
            if (invoice.status === "confirmed") {
                return res.status(400).json({ error: "Invoice already confirmed" });
            }

            const farmerId = (req.user as any).id;

            // Update seasonId if provided during confirmation
            if (req.body.seasonId) {
                await db.execute(sql`UPDATE farm_invoices SET season_id = ${req.body.seasonId} WHERE id = ${req.params.id}`);
            }

            await farmStorage.confirmInvoice(req.params.id, farmerId);

            // Auto-create accounts payable entry linked to this invoice
            try {
                const { farmAccountsPayable } = await import("../shared/schema");
                const { eq, and } = await import("drizzle-orm");
                const { db } = await import("./db");

                // Check if an AP entry already exists for this invoice
                const existing = await db.select().from(farmAccountsPayable).where(
                    and(eq(farmAccountsPayable.invoiceId, req.params.id), eq(farmAccountsPayable.farmerId, farmerId))
                );

                if (existing.length === 0 && invoice.totalAmount) {
                    const issueDate = invoice.issueDate ? new Date(invoice.issueDate) : new Date();
                    // Use invoice's actual dueDate if available, otherwise fallback to issueDate + 30
                    let dueDate: Date;
                    if (invoice.dueDate) {
                        dueDate = new Date(invoice.dueDate);
                    } else {
                        dueDate = new Date(issueDate);
                        dueDate.setDate(dueDate.getDate() + 30);
                    }

                    await db.insert(farmAccountsPayable).values({
                        farmerId,
                        invoiceId: req.params.id,
                        supplier: invoice.supplier || "Fornecedor",
                        description: `Fatura #${invoice.invoiceNumber || req.params.id.slice(0, 8)}`,
                        totalAmount: String(invoice.totalAmount),
                        currency: invoice.currency || "USD",
                        dueDate,
                        status: "aberto",
                    });
                    console.log(`[ACCOUNTS_PAYABLE] Auto-created AP entry for invoice ${req.params.id}`);
                }
            } catch (apErr) {
                console.error("[ACCOUNTS_PAYABLE_AUTO_CREATE]", apErr);
                // Don't fail the confirm if AP creation fails
            }

            // Check if this invoice should skip stock entry
            const updatedInvoice = await farmStorage.getInvoiceById(req.params.id);
            const skipped = updatedInvoice?.skipStockEntry;
            res.json({
                message: skipped
                    ? "Fatura confirmada. Estoque NÃO atualizado (apenas financeiro)."
                    : "Fatura confirmada. Estoque atualizado."
            });
        } catch (error) {
            console.error("[FARM_INVOICE_CONFIRM]", error);
            res.status(500).json({ error: "Failed to confirm invoice" });
        }
    });

    // Update invoice header
    app.put("/api/farm/invoices/:id", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmInvoices } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { invoiceNumber, supplier, issueDate, totalAmount, currency } = req.body;
            const updateData: any = {};
            if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
            if (supplier !== undefined) updateData.supplier = supplier;
            if (issueDate !== undefined) updateData.issueDate = issueDate ? new Date(issueDate) : null;
            if (totalAmount !== undefined) updateData.totalAmount = String(totalAmount);
            if (currency !== undefined) updateData.currency = currency;

            const [updated] = await db.update(farmInvoices)
                .set(updateData)
                .where(eq(farmInvoices.id, req.params.id))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_INVOICE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update invoice" });
        }
    });

    // Update invoice item (link to catalog product + edit fields)
    app.patch("/api/farm/invoices/:invoiceId/items/:itemId", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmInvoiceItems } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { productId, productName, productCode, unit, quantity, unitPrice, discount, totalPrice, batch, expiryDate } = req.body;
            const updateData: any = {};
            if (productId !== undefined) updateData.productId = productId;
            if (productName !== undefined) updateData.productName = productName;
            if (productCode !== undefined) updateData.productCode = productCode;
            if (unit !== undefined) updateData.unit = unit;
            if (quantity !== undefined) updateData.quantity = String(quantity);
            if (unitPrice !== undefined) updateData.unitPrice = String(unitPrice);
            if (discount !== undefined) updateData.discount = String(discount);
            if (totalPrice !== undefined) updateData.totalPrice = String(totalPrice);
            if (batch !== undefined) updateData.batch = batch;
            if (expiryDate !== undefined) updateData.expiryDate = expiryDate;

            const [updated] = await db.update(farmInvoiceItems)
                .set(updateData)
                .where(eq(farmInvoiceItems.id, req.params.itemId))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_INVOICE_ITEM_UPDATE]", error);
            res.status(500).json({ error: "Failed to update invoice item" });
        }
    });

    // Update expense header
    app.put("/api/farm/expenses/:id", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmExpenses } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { supplier, category, amount, description, expenseDate, equipmentId } = req.body;
            const updateData: any = {};
            if (supplier !== undefined) updateData.supplier = supplier;
            if (category !== undefined) updateData.category = category;
            if (amount !== undefined) updateData.amount = String(amount);
            if (description !== undefined) updateData.description = description;
            if (expenseDate !== undefined) updateData.expenseDate = parseLocalDate(expenseDate);
            if (equipmentId !== undefined) updateData.equipmentId = equipmentId || null;

            const [updated] = await db.update(farmExpenses)
                .set(updateData)
                .where(eq(farmExpenses.id, req.params.id))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_EXPENSE_UPDATE]", error);
            res.status(500).json({ error: "Failed to update expense" });
        }
    });

    // Update expense item
    app.patch("/api/farm/expenses/:expenseId/items/:itemId", requireFarmer, async (req, res) => {
        try {
            const { db } = await import("./db");
            const { farmExpenseItems } = await import("../shared/schema");
            const { eq } = await import("drizzle-orm");

            const { itemName, quantity, unit, unitPrice, totalPrice } = req.body;
            const updateData: any = {};
            if (itemName !== undefined) updateData.itemName = itemName;
            if (quantity !== undefined) updateData.quantity = String(quantity);
            if (unit !== undefined) updateData.unit = unit;
            if (unitPrice !== undefined) updateData.unitPrice = String(unitPrice);
            if (totalPrice !== undefined) updateData.totalPrice = String(totalPrice);

            const [updated] = await db.update(farmExpenseItems)
                .set(updateData)
                .where(eq(farmExpenseItems.id, req.params.itemId))
                .returning();
            res.json(updated);
        } catch (error) {
            console.error("[FARM_EXPENSE_ITEM_UPDATE]", error);
            res.status(500).json({ error: "Failed to update expense item" });
        }
    });

    // Delete invoice
    app.delete("/api/farm/invoices/:id", requireFarmer, async (req, res) => {
        try {
            const farmerId = (req.user as any).id;
            // Delete related records first to avoid FK constraint errors
            await db.execute(sql`DELETE FROM farm_invoice_items WHERE invoice_id = ${req.params.id}`);
            await db.execute(sql`UPDATE farm_accounts_payable SET invoice_id = NULL WHERE invoice_id = ${req.params.id} AND farmer_id = ${farmerId}`);
            await db.execute(sql`UPDATE farm_remissions SET reconciled_invoice_id = NULL WHERE reconciled_invoice_id = ${req.params.id} AND farmer_id = ${farmerId}`);
            await db.execute(sql`DELETE FROM farm_invoices WHERE id = ${req.params.id} AND farmer_id = ${farmerId}`);
            res.json({ message: "Fatura excluida com sucesso." });
        } catch (error) {
            console.error("[FARM_INVOICE_DELETE]", error);
            res.status(500).json({ error: "Failed to delete invoice" });
        }
    });

    // --- Admin Manuals API (RAG) ---
    app.post("/api/admin/manuals", requireAdminManuals, upload.single("file"), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: "PDF file required" });
            }
            const { title, segment } = req.body;
            if (!title || !segment) {
                return res.status(400).json({ error: "Title and Segment required" });
            }

            const { extractManualText } = await import("./whatsapp/gemini-client");
            if (req.file.mimetype !== "application/pdf") {
                return res.status(400).json({ error: "Only PDF files are supported" });
            }

            const extractedText = await extractManualText(req.file.buffer, req.file.mimetype);
            if (!extractedText.trim()) {
                return res.status(400).json({ error: "Could not extract text from the PDF" });
            }

            const { farmManuals } = await import("../shared/schema");
            const { db } = await import("./db");

            const [newManual] = await db.insert(farmManuals).values({
                title,
                segment,
                contentText: extractedText
            }).returning();

            res.status(201).json({
                message: "Manual uploaded and parsed successfully",
                manual: newManual
            });
        } catch (error) {
            console.error("[ADMIN_MANUALS_POST]", error);
            res.status(500).json({ error: "Failed to process and upload manual" });
        }
    });
}
