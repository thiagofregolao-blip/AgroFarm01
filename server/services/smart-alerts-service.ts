/**
 * Smart Alerts Service — Intelligent business alerts via WhatsApp
 * Detects: low stock, upcoming invoice due dates, and price changes
 */

import { db } from "../db";
import { farmStock, farmProductsCatalog, farmInvoices, farmPriceHistory } from "../../shared/schema";
import { eq, and, lte, gte, sql, desc } from "drizzle-orm";

// ===========================
// 1. LOW STOCK ALERTS
// ===========================
export async function checkLowStock(farmerId: string): Promise<string[]> {
    const alerts: string[] = [];

    try {
        const stockItems = await db.select({
            productName: farmProductsCatalog.name,
            quantity: farmStock.quantity,
            unit: farmProductsCatalog.unit,
        })
            .from(farmStock)
            .innerJoin(farmProductsCatalog, eq(farmStock.productId, farmProductsCatalog.id))
            .where(eq(farmStock.farmerId, farmerId));

        for (const item of stockItems) {
            const qty = parseFloat(item.quantity || "0");
            // Alert if quantity is 0 or very low (< 1 unit)
            if (qty <= 0) {
                alerts.push(`🔴 *${item.productName}* — Estoque ZERADO!`);
            } else if (qty < 1) {
                alerts.push(`🟡 *${item.productName}* — Apenas ${qty} ${item.unit || "un"} restantes`);
            }
        }
    } catch (e) {
        console.error("[SMART-ALERTS] Error checking low stock:", e);
    }

    return alerts;
}

// ===========================
// 2. UPCOMING INVOICE ALERTS
// ===========================
export async function checkUpcomingInvoices(farmerId: string): Promise<string[]> {
    const alerts: string[] = [];

    try {
        const now = new Date();
        const in5days = new Date();
        in5days.setDate(in5days.getDate() + 5);

        // Find pending invoices with issue date in the next 5 days or past due
        const invoices = await db.select({
            invoiceNumber: farmInvoices.invoiceNumber,
            supplier: farmInvoices.supplier,
            totalAmount: farmInvoices.totalAmount,
            currency: farmInvoices.currency,
            issueDate: farmInvoices.issueDate,
            status: farmInvoices.status,
        })
            .from(farmInvoices)
            .where(
                and(
                    eq(farmInvoices.farmerId, farmerId),
                    eq(farmInvoices.status, "pending")
                )
            );

        for (const inv of invoices) {
            if (!inv.issueDate) continue;

            const issueDate = new Date(inv.issueDate);
            const diffTime = issueDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const amount = inv.totalAmount
                ? `${inv.currency || "USD"} ${parseFloat(inv.totalAmount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                : "";

            const supplierName = inv.supplier || "Fornecedor";
            const nf = inv.invoiceNumber || "s/n";

            if (diffDays < 0) {
                alerts.push(`🔴 Fatura *${nf}* (${supplierName}) — ${amount} — *VENCIDA* há ${Math.abs(diffDays)} dias`);
            } else if (diffDays <= 5) {
                alerts.push(`🟡 Fatura *${nf}* (${supplierName}) — ${amount} — vence em *${diffDays} dias*`);
            }
        }
    } catch (e) {
        console.error("[SMART-ALERTS] Error checking invoices:", e);
    }

    return alerts;
}

// ===========================
// 3. PRICE CHANGE ALERTS
// ===========================
export async function checkPriceChanges(farmerId: string): Promise<string[]> {
    const alerts: string[] = [];

    try {
        // Get price history, ordered by date desc, grouped by product
        const history = await db.select({
            productName: farmPriceHistory.productName,
            supplier: farmPriceHistory.supplier,
            unitPrice: farmPriceHistory.unitPrice,
            date: farmPriceHistory.purchaseDate,
        })
            .from(farmPriceHistory)
            .where(eq(farmPriceHistory.farmerId, farmerId))
            .orderBy(desc(farmPriceHistory.purchaseDate));

        // Group by product name and compare latest 2 prices
        const productPrices: Record<string, { price: number; date: Date; supplier: string }[]> = {};

        for (const h of history) {
            const name = h.productName;
            if (!productPrices[name]) productPrices[name] = [];
            if (productPrices[name].length < 2) {
                productPrices[name].push({
                    price: parseFloat(h.unitPrice || "0"),
                    date: new Date(h.date || Date.now()),
                    supplier: h.supplier || "",
                });
            }
        }

        for (const [name, prices] of Object.entries(productPrices)) {
            if (prices.length < 2) continue;

            const latest = prices[0];
            const previous = prices[1];
            if (previous.price === 0) continue;

            const change = ((latest.price - previous.price) / previous.price) * 100;

            if (Math.abs(change) >= 10) { // Only alert on 10%+ changes
                const direction = change > 0 ? "📈 subiu" : "📉 caiu";
                alerts.push(
                    `${direction} *${name}* — ${Math.abs(change).toFixed(1)}% (${previous.price.toFixed(2)} → ${latest.price.toFixed(2)})`
                );
            }
        }
    } catch (e) {
        console.error("[SMART-ALERTS] Error checking prices:", e);
    }

    return alerts;
}

// ===========================
// BUILD SMART ALERTS MESSAGE
// ===========================
export async function buildSmartAlertsMessage(farmerId: string): Promise<string | null> {
    const [stockAlerts, invoiceAlerts, priceAlerts] = await Promise.all([
        checkLowStock(farmerId),
        checkUpcomingInvoices(farmerId),
        checkPriceChanges(farmerId),
    ]);

    const totalAlerts = stockAlerts.length + invoiceAlerts.length + priceAlerts.length;
    if (totalAlerts === 0) return null;

    let msg = `\n🔔 *Alertas Inteligentes* (${totalAlerts})\n`;

    if (stockAlerts.length > 0) {
        msg += `\n📦 *Estoque:*\n`;
        msg += stockAlerts.map(a => `  ${a}`).join("\n") + "\n";
    }

    if (invoiceAlerts.length > 0) {
        msg += `\n💳 *Faturas:*\n`;
        msg += invoiceAlerts.map(a => `  ${a}`).join("\n") + "\n";
    }

    if (priceAlerts.length > 0) {
        msg += `\n💰 *Variações de Preço:*\n`;
        msg += priceAlerts.map(a => `  ${a}`).join("\n") + "\n";
    }

    return msg;
}
