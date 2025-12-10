import { createRequire } from "module";

interface ParsedProduct {
  productCode: string;
  productName: string;
  packageType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  purchaseDate: Date;
  orderCode: string;
}

export function detectCategoryFromProductName(productName: string): string | null {
  const name = productName.toUpperCase();
  
  const categoryKeywords: Record<string, string[]> = {
    'cat-fertilizantes': ['FERT', 'FERTILIZANTE', 'UREIA', 'NPK', 'SULFATO', 'MAP', 'DAP', 'NITRATO', 'FOSFATO'],
    'cat-agroquimicos': ['HERBICIDA', 'FUNGICIDA', 'INSETICIDA', 'AGROQUIMICO', 'GLIFOSATO', 'ATRAZINA', 'PARAQUAT', 'CLORANTRANILIPROLE', 'IPCONAZOLE', 'METALAXIL', 'DERMACOR', 'RANCONA', 'NEMATICIDA', 'GLUFOSINATO', 'TODYM', 'CLOMAZONE', 'FIPRONIL', 'METOXIFENOZIDA', 'MANCOZEB', 'DIFENO', 'TEBUCO', 'PROTHIO', 'TRIFLOX', 'FLUMIOXAZIM'],
    'cat-sementes': ['SEMENTE', 'SEED', 'SEMILLA', 'HIBRIDO', 'CULTIVAR', 'VARIEDADE']
  };
  
  for (const [categoryId, keywords] of Object.entries(categoryKeywords)) {
    for (const keyword of keywords) {
      if (name.includes(keyword)) {
        return categoryId;
      }
    }
  }
  
  return null;
}

interface ParsedPurchaseHistory {
  clientName: string;
  seasonName: string;
  totalAmount: number;
  items: ParsedProduct[];
}

const require = createRequire(import.meta.url);
let pdfParser: any = null;

function getPdfParser() {
  if (!pdfParser) {
    pdfParser = require("pdf-parse");
  }
  return pdfParser;
}

export async function parseCVALEPDF(buffer: Buffer): Promise<ParsedPurchaseHistory> {
  const pdf = getPdfParser();
  const data = await pdf(buffer);
  const text = data.text;
  
  const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
  
  let clientName = '';
  let seasonName = '';
  const items: ParsedProduct[] = [];
  let totalAmount = 0;
  
  let currentOrderCode = '';
  let currentEmissionDate: Date | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (!clientName && line.includes('Entidad') && line.includes('-')) {
      const match = line.match(/Entidad\s*:?\s*(\d+)\s*-\s*([^:]+)/);
      if (match) {
        clientName = match[2].trim();
      }
    }
    
    if (!seasonName && line.includes('Plan de Financiación') && line.includes('ZAFRA')) {
      const match = line.match(/Plan de Financiación\s*:?\s*(\d+)\s*-\s*(ZAFRA[^-]+)-\s*([^:]+)/);
      if (match) {
        seasonName = `${match[2].trim()} ${match[3].trim()}`;
      }
    }
    
    const orderMatch = line.match(/^(\d{6})\s+.*?(\d{2}\/\d{2}\/\d{2})\s+(\d{2}\/\d{2}\/\d{2})/);
    if (orderMatch) {
      currentOrderCode = orderMatch[1];
      const emissionDateStr = orderMatch[2];
      const parts = emissionDateStr.split('/');
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      let year = parseInt(parts[2]);
      year = year < 50 ? 2000 + year : 1900 + year;
      currentEmissionDate = new Date(year, month, day);
    }
    
    const productMatch = line.match(/^([A-Z\s\d]+)\((\d+)\)\s+(.+?)\s+(\d+[\d,\.]*)\s+(\d+[\d,\.]+)\s+(\d+[\d,\.]*)\s+/);
    if (productMatch && currentEmissionDate && currentOrderCode) {
      const packageType = productMatch[1].trim();
      const productCode = productMatch[2];
      const productName = productMatch[3].trim();
      const unitPrice = parseFloat(productMatch[4].replace(/\./g, '').replace(',', '.'));
      const totalPrice = parseFloat(productMatch[5].replace(/\./g, '').replace(',', '.'));
      const quantity = parseFloat(productMatch[6].replace(/\./g, '').replace(',', '.'));
      
      items.push({
        productCode,
        productName,
        packageType,
        quantity,
        unitPrice,
        totalPrice,
        purchaseDate: currentEmissionDate,
        orderCode: currentOrderCode
      });
    }
    
    if (line.includes('TOTAL ÍTENS FACTURADOS') || line.includes('TOTAL ÍTEMS FACTURADOS')) {
      const match = line.match(/=\s+([\d,.]+)/);
      if (match) {
        totalAmount = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      }
    }
  }
  
  return {
    clientName,
    seasonName,
    totalAmount,
    items
  };
}
