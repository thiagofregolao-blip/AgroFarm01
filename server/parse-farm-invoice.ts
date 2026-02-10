/**
 * Parser de Faturas de Fazenda (C.VALE e similares)
 * Extrai dados estruturados de PDFs de faturas eletrônicas
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
let pdfParser: any = null;

function getPdfParser() {
    if (!pdfParser) {
        pdfParser = require("pdf-parse");
    }
    return pdfParser;
}

export interface ParsedInvoiceItem {
    productCode: string;
    productName: string;
    unit: string; // LT, KG, UNI
    quantity: number;
    unitPrice: number;
    discount: number;
    totalPrice: number;
    batch?: string;
    expiryDate?: Date;
}

export interface ParsedInvoice {
    invoiceNumber: string;
    supplier: string;
    clientName: string;
    clientDocument: string;
    issueDate: Date | null;
    currency: string;
    subtotal: number;
    totalAmount: number;
    items: ParsedInvoiceItem[];
    rawText: string;
}

/**
 * Parse a C.VALE electronic invoice PDF
 * Format: KuDE de Factura Electrónica
 */
export async function parseFarmInvoicePDF(buffer: Buffer): Promise<ParsedInvoice> {
    const pdf = getPdfParser();
    const data = await pdf(buffer);
    const text: string = data.text;
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

    let invoiceNumber = '';
    let supplier = '';
    let clientName = '';
    let clientDocument = '';
    let issueDate: Date | null = null;
    let currency = 'USD';
    let subtotal = 0;
    let totalAmount = 0;
    const items: ParsedInvoiceItem[] = [];

    // Extract header info
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Invoice number: N°: 005-001-0005200
        if (!invoiceNumber) {
            const invoiceMatch = line.match(/N[°º]:\s*([\d\-]+)/);
            if (invoiceMatch) {
                invoiceNumber = invoiceMatch[1].trim();
            }
        }

        // Supplier name (usually first significant line or near "COMERCIO")
        if (!supplier && (line.includes('C.VALE') || line.includes('COMERCIO AL POR MAYOR'))) {
            // Try to get the company name from the line above or the line itself
            if (line.includes('C.VALE')) {
                supplier = 'C.VALE SA';
            } else {
                supplier = line.trim();
            }
        }

        // Client name: "Nombre o Razón Social:"
        if (!clientName) {
            const clientMatch = line.match(/Nombre\s*o\s*Raz[oó]n\s*Social:\s*(.+)/i);
            if (clientMatch) {
                clientName = clientMatch[1].trim();
            }
        }

        // Document: RUC/Documento de Identidad N°:
        if (!clientDocument) {
            const docMatch = line.match(/RUC\/Documento\s*de\s*Identidad\s*N[°º]:\s*(\S+)/i);
            if (docMatch) {
                clientDocument = docMatch[1].trim();
            }
        }

        // Issue date: "Fecha y hora:" 
        if (!issueDate) {
            const dateMatch = line.match(/Fecha\s*y\s*hora:\s*(\d{2}-\d{2}-\d{4})/i);
            if (dateMatch) {
                const parts = dateMatch[1].split('-');
                issueDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }

        // Currency
        if (line.includes('Moneda:')) {
            if (line.includes('US Dollar') || line.includes('USD')) {
                currency = 'USD';
            } else if (line.includes('Guarani') || line.includes('PYG')) {
                currency = 'PYG';
            }
        }

        // Sub Total
        const subTotalMatch = line.match(/Sub\s*Total:\s*([\d.,]+)/i);
        if (subTotalMatch) {
            subtotal = parseNumber(subTotalMatch[1]);
        }

        // Total a pagar
        const totalMatch = line.match(/Total\s*a\s*pagar.*?([\d.,]+)\s*$/i);
        if (totalMatch) {
            totalAmount = parseNumber(totalMatch[1]);
        }
    }

    // If no totalAmount found, use subtotal
    if (totalAmount === 0) totalAmount = subtotal;

    // Extract items from the product table
    // The format has lines like:
    // 924877 CONTACT 72 - 20LTS LT 5 110,00 550,00
    // We look for lines starting with a product code (digits) followed by description

    let inProductSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Detect start of product table
        if (line.includes('Descripci') && line.includes('Cantidad')) {
            inProductSection = true;
            continue;
        }

        // Detect end of product table
        if (inProductSection && (line.includes('Sub Total') || line.includes('Descuento global'))) {
            inProductSection = false;
            continue;
        }

        if (!inProductSection) continue;

        // Try to match a product line
        // Pattern: CODE DESCRIPTION UNIT QUANTITY UNIT_PRICE [DISCOUNT] TOTAL
        const productMatch = line.match(
            /^(\d{4,10})\s+(.+?)\s+(LT|KG|UNI|UN|L|SC)\s+(\d+[\d.,]*)\s+([\d.,]+)\s+([\d.,]*)\s*$/i
        );

        if (productMatch) {
            const productCode = productMatch[1];
            const productName = productMatch[2].trim();
            const unit = normalizeUnit(productMatch[3]);
            const quantity = parseNumber(productMatch[4]);
            const unitPrice = parseNumber(productMatch[5]);

            // Check for values in tax columns (Exentas, 5%, 10%)
            // The last number could be the total (in one of the tax columns)
            let totalPrice = 0;
            let discount = 0;

            // Look at the next few lines for Lote/Vencimento info
            let batch: string | undefined;
            let expiryDate: Date | undefined;

            // Check if there's a "Pedido SENAVE" line after
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                const nextLine = lines[j];

                // Batch/Lot info
                const batchMatch = nextLine.match(/Lote\s+Cantidad\s+Vencimiento/i);
                if (batchMatch) {
                    // The next line should have the actual values
                    const batchDataLine = lines[j + 1];
                    if (batchDataLine) {
                        const batchParts = batchDataLine.match(/(\S+)\s+\d+\s+(\d{2}\/\d{2}\/\d{4})/);
                        if (batchParts) {
                            batch = batchParts[1];
                            const dateParts = batchParts[2].split('/');
                            expiryDate = new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]));
                        }
                    }
                }
            }

            // Calculate total - look at value columns at end of line
            // In the C.VALE format, the total appears in one of the rightmost Exentas/5%/10% columns
            totalPrice = quantity * unitPrice;

            // Look for the actual total in the line - it's often the last significant number
            const allNumbers = line.match(/[\d.,]+/g);
            if (allNumbers && allNumbers.length >= 4) {
                const lastNum = parseNumber(allNumbers[allNumbers.length - 1]);
                // Validate: if the last number is close to qty * unitPrice, use it
                if (Math.abs(lastNum - totalPrice) < totalPrice * 0.5) {
                    totalPrice = lastNum;
                } else if (lastNum > 0) {
                    // Maybe it's the actual total
                    totalPrice = lastNum;
                }
            }

            items.push({
                productCode,
                productName,
                unit,
                quantity,
                unitPrice,
                discount,
                totalPrice,
                batch,
                expiryDate,
            });
        }
    }

    return {
        invoiceNumber,
        supplier,
        clientName,
        clientDocument,
        issueDate,
        currency,
        subtotal,
        totalAmount: totalAmount || subtotal,
        items,
        rawText: text,
    };
}

function parseNumber(str: string): number {
    if (!str) return 0;
    // Handle formats: 1.130,00 or 1,130.00 or 110,00
    const cleaned = str.replace(/\s/g, '');

    // If has both . and , determine which is decimal separator
    if (cleaned.includes('.') && cleaned.includes(',')) {
        const lastDot = cleaned.lastIndexOf('.');
        const lastComma = cleaned.lastIndexOf(',');
        if (lastComma > lastDot) {
            // European format: 1.130,00 → 1130.00
            return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
        } else {
            // US format: 1,130.00
            return parseFloat(cleaned.replace(/,/g, ''));
        }
    } else if (cleaned.includes(',')) {
        // Could be decimal comma: 110,00
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 4) {
            return parseFloat(cleaned.replace(',', '.'));
        }
        return parseFloat(cleaned.replace(/,/g, ''));
    }

    return parseFloat(cleaned) || 0;
}

function normalizeUnit(unit: string): string {
    const u = unit.toUpperCase().trim();
    if (u === 'L' || u === 'LT') return 'LT';
    if (u === 'UN' || u === 'UNI') return 'UNI';
    if (u === 'SC') return 'SC'; // Saco
    return u;
}
