/**
 * Invoice Email Routes
 * 
 * Handles Mailgun webhook for incoming invoices,
 * invoice approval/rejection, and email configuration.
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { db } from "./db";
import { farmInvoices, farmInvoiceItems, users } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import {
    extractInvoiceFromPdf,
    findFarmerByInvoiceEmail,
    createDraftInvoice,
} from "./services/invoice-email-service";

// Multer for parsing multipart/form-data (Mailgun webhooks)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export function registerInvoiceEmailRoutes(app: Express) {

    /**
     * Mailgun Inbound Webhook
     * 
     * Mailgun sends a POST with multipart/form-data containing:
     * - recipient: the email address that received the message
     * - sender: who sent the email
     * - subject: email subject
     * - body-plain: plain text body
     * - Message-Id: unique email ID
     * - attachment-count: number of attachments
     * - attachment-1, attachment-2, etc.: the actual files
     */
    app.post("/api/webhooks/mailgun/invoice", upload.any(), async (req: Request, res: Response) => {
        try {
            console.log("[Invoice Webhook] Received Mailgun webhook");

            const recipient = req.body.recipient || req.body.To || "";
            const sender = req.body.sender || req.body.From || "";
            const subject = req.body.subject || req.body.Subject || "";
            const messageId = req.body["Message-Id"] || req.body["message-id"] || `mailgun-${Date.now()}`;

            console.log(`[Invoice Webhook] From: ${sender}, To: ${recipient}, Subject: ${subject}`);

            // Find farmer by the recipient email
            const farmer = await findFarmerByInvoiceEmail(recipient);
            if (!farmer) {
                console.log(`[Invoice Webhook] No farmer found for email: ${recipient}`);
                // Still return 200 to Mailgun so it doesn't retry
                return res.status(200).json({ status: "ignored", reason: "no_farmer_found" });
            }

            console.log(`[Invoice Webhook] Farmer found: ${farmer.name} (${farmer.id})`);

            // Find PDF attachments
            const files = (req.files as Express.Multer.File[]) || [];
            const pdfFiles = files.filter(f =>
                f.mimetype === "application/pdf" ||
                f.originalname?.toLowerCase().endsWith(".pdf")
            );

            if (pdfFiles.length === 0) {
                console.log("[Invoice Webhook] No PDF attachments found");
                return res.status(200).json({ status: "ignored", reason: "no_pdf" });
            }

            const results = [];

            // Process each PDF attachment
            for (const pdf of pdfFiles) {
                try {
                    console.log(`[Invoice Webhook] Processing PDF: ${pdf.originalname} (${pdf.size} bytes)`);

                    // Convert to base64 for Gemini
                    const pdfBase64 = pdf.buffer.toString("base64");

                    // Extract invoice data using Gemini AI
                    const extracted = await extractInvoiceFromPdf(pdfBase64);

                    console.log(`[Invoice Webhook] Extracted: ${extracted.supplier}, ${extracted.items.length} items, ${extracted.currency} ${extracted.totalAmount}`);

                    // Create draft invoice
                    const result = await createDraftInvoice(
                        farmer.id,
                        extracted,
                        `${messageId}-${pdf.originalname}`,
                        sender,
                        `Subject: ${subject}\nFrom: ${sender}\nFile: ${pdf.originalname}`
                    );

                    if (result) {
                        results.push(result);

                        // Send WhatsApp notification
                        console.log(`[Invoice Webhook] Attempting WhatsApp notification...`);
                        console.log(`[Invoice Webhook] Farmer WhatsApp: ${farmer.whatsapp_number || 'NOT SET'}`);
                        console.log(`[Invoice Webhook] ZAPI_INSTANCE_ID: ${process.env.ZAPI_INSTANCE_ID ? 'SET' : 'NOT SET'}`);
                        console.log(`[Invoice Webhook] ZAPI_TOKEN: ${process.env.ZAPI_TOKEN ? 'SET' : 'NOT SET'}`);
                        try {
                            if (farmer.whatsapp_number && process.env.ZAPI_INSTANCE_ID) {
                                const zapiUrl = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`;
                                const currencySymbol = extracted.currency === "PYG" ? "₲" : extracted.currency === "BRL" ? "R$" : "$";
                                const formattedTotal = extracted.totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
                                const farmerName = farmer.name || "Produtor";

                                const message = `👋 *${farmerName}*, tudo bem?\n\n` +
                                    `Recebemos uma fatura em seu nome do fornecedor *${extracted.supplier}* no valor de *${currencySymbol} ${formattedTotal}* com ${extracted.items.length} produtos.\n\n` +
                                    `${result.matchedCount > 0 ? `✅ ${result.matchedCount} produto${result.matchedCount > 1 ? "s" : ""} já ${result.matchedCount > 1 ? "foram identificados" : "foi identificado"} no seu catálogo.\n\n` : ""}` +
                                    `Acesse o sistema para *revisar os dados* e aprovar a entrada no estoque.\n\n` +
                                    `🌱 _AgroFarm Digital — Gestão inteligente para o campo._`;

                                const zapiResponse = await fetch(zapiUrl, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Client-Token": process.env.ZAPI_CLIENT_TOKEN || "" },
                                    body: JSON.stringify({ phone: farmer.whatsapp_number, message }),
                                });
                                const zapiResult = await zapiResponse.json();
                                console.log(`[Invoice Webhook] WhatsApp notification sent to ${farmer.whatsapp_number}, response:`, JSON.stringify(zapiResult));
                            } else {
                                console.log(`[Invoice Webhook] WhatsApp notification SKIPPED - missing phone or ZAPI config`);
                            }
                        } catch (whatsAppError) {
                            console.error("[Invoice Webhook] WhatsApp notification failed:", whatsAppError);
                        }
                    }
                } catch (pdfError) {
                    console.error(`[Invoice Webhook] Error processing PDF ${pdf.originalname}:`, pdfError);
                    results.push({ error: `Failed to process ${pdf.originalname}: ${(pdfError as Error).message}` });
                }
            }

            res.status(200).json({ status: "processed", results });

        } catch (error) {
            console.error("[Invoice Webhook] Fatal error:", error);
            // Always return 200 to Mailgun to prevent retries
            res.status(200).json({ status: "error", message: (error as Error).message });
        }
    });

    /**
     * List imported invoices pending approval
     */
    app.get("/api/farm/invoices/imported", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;

            const imported = await db
                .select()
                .from(farmInvoices)
                .where(and(
                    eq(farmInvoices.farmerId, user.id),
                    eq(farmInvoices.source, "email_import")
                ))
                .orderBy(desc(farmInvoices.createdAt));

            // Get items for each invoice
            const results = await Promise.all(imported.map(async (inv: any) => {
                const items = await db
                    .select()
                    .from(farmInvoiceItems)
                    .where(eq(farmInvoiceItems.invoiceId, inv.id));

                return { ...inv, items };
            }));

            res.json(results);
        } catch (error) {
            console.error("[Invoice Email] Error listing imported:", error);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /**
     * Update invoice email in user profile
     */
    app.put("/api/farm/profile/invoice-email", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const { invoiceEmail } = req.body;

            await db.update(users)
                .set({ invoiceEmail: invoiceEmail?.toLowerCase() || null } as any)
                .where(eq(users.id, user.id));

            res.json({ success: true, invoiceEmail });
        } catch (error) {
            console.error("[Invoice Email] Error updating email:", error);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /**
     * Get current invoice email config
     */
    app.get("/api/farm/profile/invoice-email", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;

            const [farmer] = await db.select({ invoiceEmail: users.invoiceEmail } as any)
                .from(users)
                .where(eq(users.id, user.id));

            res.json({ invoiceEmail: (farmer as any)?.invoiceEmail || null });
        } catch (error) {
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /**
     * Approve imported invoice (same as confirming regular invoice)
     */
    app.post("/api/farm/invoices/:id/approve-import", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const { id } = req.params;

            // Verify invoice belongs to user and is pending
            const [invoice] = await db.select().from(farmInvoices)
                .where(and(
                    eq(farmInvoices.id, id),
                    eq(farmInvoices.farmerId, user.id),
                    eq(farmInvoices.status, "pending")
                ));

            if (!invoice) {
                return res.status(404).json({ error: "Fatura não encontrada ou já processada" });
            }

            // Update status to confirmed
            await db.update(farmInvoices)
                .set({ status: "confirmed" })
                .where(eq(farmInvoices.id, id));

            res.json({ success: true, message: "Fatura aprovada com sucesso" });
        } catch (error) {
            console.error("[Invoice Email] Error approving:", error);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /**
     * Reject imported invoice
     */
    app.post("/api/farm/invoices/:id/reject-import", async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;
            const { id } = req.params;

            // Verify invoice belongs to user
            const [invoice] = await db.select().from(farmInvoices)
                .where(and(
                    eq(farmInvoices.id, id),
                    eq(farmInvoices.farmerId, user.id)
                ));

            if (!invoice) {
                return res.status(404).json({ error: "Fatura não encontrada" });
            }

            // Update status to cancelled
            await db.update(farmInvoices)
                .set({ status: "cancelled" })
                .where(eq(farmInvoices.id, id));

            res.json({ success: true, message: "Fatura rejeitada" });
        } catch (error) {
            console.error("[Invoice Email] Error rejecting:", error);
            res.status(500).json({ error: "Erro interno" });
        }
    });

    /**
     * Manual test endpoint: upload a PDF to simulate email import
     * (useful for testing without Mailgun setup)
     */
    app.post("/api/farm/invoices/test-import", upload.single("pdf"), async (req: Request, res: Response) => {
        try {
            if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
            const user = req.user as any;

            const file = req.file;
            if (!file) return res.status(400).json({ error: "Envie um arquivo PDF" });

            console.log(`[Invoice Test] Processing test import for farmer ${user.id}`);

            const pdfBase64 = file.buffer.toString("base64");
            const extracted = await extractInvoiceFromPdf(pdfBase64);

            const result = await createDraftInvoice(
                user.id,
                extracted,
                `test-${Date.now()}`,
                "test@manual-upload.com",
                "Upload manual de teste"
            );

            res.json({ success: true, extracted, result });
        } catch (error) {
            console.error("[Invoice Test] Error:", error);
            res.status(500).json({ error: (error as Error).message });
        }
    });
}
