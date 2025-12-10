import { createRequire } from "module";

export interface ParsedInventoryItem {
  productCode: string;
  productName: string;
  packageType: string;
  quantity: number;
}

export interface ParsedPendingOrder {
  productCode: string;
  productName: string;
  packageType: string;
  quantityPending: number;
  clientName: string;
  consultorName?: string;
  orderCode?: string;
}

const require = createRequire(import.meta.url);
let pdfParser: any = null;

function getPdfParser() {
  if (!pdfParser) {
    pdfParser = require("pdf-parse");
  }
  return pdfParser;
}

export async function parseInventoryPDF(buffer: Buffer): Promise<ParsedInventoryItem[]> {
  const pdf = getPdfParser();
  const data = await pdf(buffer);
  const text = data.text;
  
  console.log('=== PDF TEXT EXTRACTED (first 500 chars) ===');
  console.log(text.substring(0, 500));
  console.log('=== END PDF TEXT ===');
  
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  const items: ParsedInventoryItem[] = [];
  
  console.log(`Total lines found: ${lines.length}`);
  console.log('First 10 lines:', lines.slice(0, 10));
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Match pattern: Cód.Int Embalaje Cant Costo Mercadería
    // Example: "0921273 BIDON 20 L 5 02,4 D AMINA TM - 2,4D AMINA 72% - 20LTS"
    // Pattern: 7-digit code + package type + quantity + cost + product name (rest)
    const match = line.match(/^(\d{7})\s+([A-Z\s\d]+?)\s+(\d+(?:[,\.]\d+)?)\s+\d+(?:[,\.]\d+)?\s*(.+)$/);
    
    if (match) {
      let productCode = match[1].trim();
      // Remove leading zero if present (0921273 -> 921273)
      if (productCode.startsWith('0')) {
        productCode = productCode.substring(1);
      }
      const packageType = match[2].trim();
      const quantityStr = match[3].replace(/\./g, '').replace(',', '.');
      const quantity = parseFloat(quantityStr);
      const productName = match[4].trim();
      
      if (!isNaN(quantity) && quantity >= 0) {
        items.push({
          productCode,
          productName,
          packageType,
          quantity
        });
        console.log(`Matched item: ${productCode} - ${productName} - ${packageType} - ${quantity}`);
      }
    }
  }
  
  console.log(`Total items parsed: ${items.length}`);
  return items;
}

export async function parseOrdersPDF(buffer: Buffer): Promise<ParsedPendingOrder[]> {
  const pdf = getPdfParser();
  const data = await pdf(buffer);
  const text = data.text;
  
  console.log('=== ORDERS PDF TEXT (first 500 chars) ===');
  console.log(text.substring(0, 500));
  console.log('=== END ORDERS PDF TEXT ===');
  
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  const orders: ParsedPendingOrder[] = [];
  
  console.log(`Orders PDF: Total lines found: ${lines.length}`);
  console.log('Orders PDF: First 30 lines:', lines.slice(0, 30));
  
  let currentClient = '';
  let currentConsultor = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Extract client name - format: "CLIENTE NOME CIDADE####"
    // Client appears before order code (pattern ending with numbers)
    if (line.match(/^[A-Z\s\.]+\d{5,}$/)) {
      // Remove trailing numbers and trim
      currentClient = line.replace(/\d+$/, '').trim();
      console.log(`Found client: ${currentClient}`);
    }
    
    // Extract consultor/vendedor name from filters
    if (line.includes('Comprador/Vendedor') && line.includes('-')) {
      const match = line.match(/Comprador\/Vendedor\s+\d+\s+-\s+([^:]+)/);
      if (match) {
        currentConsultor = match[1].trim();
        console.log(`Found consultor: ${currentConsultor}`);
      }
    }
    
    // Match product lines
    // Format: EMBALAJE(CÓDIGO) PRODUCTO valores... CANT_FALTA fecha
    // Example: BIDON 10 L(924094) FERTILEADER 954 - VITAL - 10LTS 288,50 3.462,00 0 0 12 31/01/202512
    const productMatch = line.match(/^([A-Z\s\d]+)\((\d{6,7})\)\s+(.+?)\s+([\d,\.]+)\s+([\d,\.]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+/);
    
    if (productMatch && currentClient) {
      const packageType = productMatch[1].trim();
      const productCode = productMatch[2].trim();
      const productName = productMatch[3].trim();
      const quantityPending = parseInt(productMatch[8]); // Cant. Falta is the 8th group
      
      if (!isNaN(quantityPending) && quantityPending > 0) {
        orders.push({
          productCode,
          productName,
          packageType,
          quantityPending,
          clientName: currentClient,
          consultorName: currentConsultor || undefined
        });
        console.log(`Matched order: ${productCode} - ${productName} - ${quantityPending} units for ${currentClient}`);
      }
    }
  }
  
  console.log(`Total orders parsed: ${orders.length}`);
  
  return orders;
}
