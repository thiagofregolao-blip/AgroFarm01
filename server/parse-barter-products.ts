import * as XLSX from 'xlsx';
import { pdf as pdfParse } from 'pdf-parse';

interface ParsedBarterProduct {
  name: string;
  category: string;
  principioAtivo?: string;
  dosePerHa?: string;
  fabricante?: string;
  priceVermelha?: string;
  priceAmarela?: string;
  priceVerde?: string;
  unit: string;
}

// Normalize text by removing accents and diacritics
function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

// Map PDF categories to system categories
const categoryMap: Record<string, string> = {
  'TRATAMENTO DE SEMENTES': 'tratamento_sementes',
  'DESSECACAO': 'dessecacao',
  'EINSETICIDAS': 'inseticidas',
  'INSETICIDAS': 'inseticidas',
  'FUNGICIDAS': 'fungicidas',
  'HERBICIDAS': 'herbicidas',
  'SEMENTES': 'sementes',
  'FERTILIZANTES': 'fertilizantes',
  'ESPECIALIDADES': 'especialidades',
};

// Map active ingredients (P.A.) to categories
// Note: Order matters - dessecacao checked before herbicidas to prevent misclassification
const principioAtivoCategories: Record<string, string[]> = {
  'tratamento_sementes': [
    'azospirillum', 'bradirizobium', 'rizobio', 'tricoderma', 
    'bioestimulante', 'rizospirilum', 'rizoliq'
  ],
  'dessecacao': [
    'paraquate', 'diquate', 'glufosinato', 'carfentrazona'
  ],
  'inseticidas': [
    'fipronil', 'clorantraniliproli', 'imidacloprid', 'thiodicarb',
    'lambda-cialotrina', 'cipermetrina', 'deltametrina', 'abamectina',
    'clorpirifos', 'tiametoxam', 'clotianidina', 'bifentrina'
  ],
  'fungicidas': [
    'fludioxinil', 'metalaxil', 'ipconazole', 'penflufen', 'protioconazol',
    'azoxistrobina', 'tebuconazol', 'trifloxistrobina', 'carbendazim',
    'mancozeb', 'epoxiconazol', 'picoxistrobina', 'fluxapiroxade'
  ],
  'herbicidas': [
    '2,4d', '2,4-d', 'glifosato', 'clomazone', 'diclosulan', 'flumioxazin',
    'fomesafen', 's-metalacloro', 'cletodim', 'haloxifope', 'imazetapir',
    'atrazina', 'nicosulfuron', 'mesotriona'
  ],
  'fertilizantes': [
    'nitrogênio', 'nitrogenio', 'fosforo', 'fósforo', 'potássio', 'potassio',
    'npk', 'ureia', 'map', 'dap', 'kcl', 'sulfato'
  ]
};

function detectCategoryHeader(line: string): string | null {
  const normalized = normalizeText(line.trim());
  // Only match if the entire line equals a category (header detection)
  for (const [key, value] of Object.entries(categoryMap)) {
    if (normalized === key) {
      return value;
    }
  }
  return null;
}

function detectCategoryFromColumn(text: string): string | null {
  const normalized = normalizeText(text.trim());
  // Match category keywords anywhere in text (column detection)
  for (const [key, value] of Object.entries(categoryMap)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  return null;
}

export function detectCategoryFromPA(principioAtivo: string): string | null {
  if (!principioAtivo) return null;
  
  const paLower = principioAtivo.toLowerCase();
  
  for (const [category, keywords] of Object.entries(principioAtivoCategories)) {
    for (const keyword of keywords) {
      if (paLower.includes(keyword)) {
        return category;
      }
    }
  }
  
  return null;
}

function parseProductLine(line: string, currentCategory: string): ParsedBarterProduct | null {
  const tokens = line.trim().split(/\s+/);
  
  if (tokens.length < 7) return null;

  // Skip header rows
  const firstToken = tokens[0]?.toUpperCase();
  if (firstToken === 'MERCADERÍA' || firstToken === 'MERCADERIA' || firstToken === 'PRODUTO' || 
      firstToken === 'P.A.' || firstToken === 'DOSE' || firstToken === 'FABRICANTE' ||
      firstToken === 'VERMELHA' || firstToken === 'AMARELA' || firstToken === 'VERDE') {
    return null;
  }

  // Extract prices (last 3 tokens)
  const priceVerde = tokens[tokens.length - 1]?.replace(',', '.');
  const priceAmarela = tokens[tokens.length - 2]?.replace(',', '.');
  const priceVermelha = tokens[tokens.length - 3]?.replace(',', '.');

  // Validate at least one price is numeric (some products may have missing prices)
  const hasValidPrice = !isNaN(parseFloat(priceVerde)) || !isNaN(parseFloat(priceAmarela)) || !isNaN(parseFloat(priceVermelha));
  if (!hasValidPrice) return null;

  // Extract fabricante (4th from end)
  const fabricante = tokens[tokens.length - 4];

  // Find dose (token containing ml/, Lt/, Kg/, /Ha)
  let doseIndex = -1;
  for (let i = 0; i < tokens.length - 4; i++) {
    if (tokens[i].includes('ml/') || tokens[i].includes('Lt/') || tokens[i].includes('Kg/') || tokens[i].includes('/Ha')) {
      doseIndex = i;
      break;
    }
  }
  
  if (doseIndex === -1) return null;

  // Check if dose is part of a range (e.g., "1 - 2Lt/Ha")
  let doseStartIndex = doseIndex;
  if (doseIndex >= 2 && tokens[doseIndex - 1] === '-' && !isNaN(parseFloat(tokens[doseIndex - 2]))) {
    doseStartIndex = doseIndex - 2;
  }

  const dosePerHa = tokens.slice(doseStartIndex, doseIndex + 1).join(' ');

  // Find category in tokens before dose (look backwards from dose)
  let categoryFromColumn: string | null = null;
  let categoryStartIndex = -1;
  let categoryEndIndex = -1;
  
  // Try 3-word, 2-word, then 1-word category matches
  for (let windowSize = 3; windowSize >= 1; windowSize--) {
    for (let i = Math.max(0, doseStartIndex - windowSize); i < doseStartIndex; i++) {
      const tokenSequence = tokens.slice(i, i + windowSize).join(' ');
      const detectedCat = detectCategoryFromColumn(tokenSequence);
      if (detectedCat) {
        categoryFromColumn = detectedCat;
        categoryStartIndex = i;
        categoryEndIndex = i + windowSize - 1;
        break;
      }
    }
    if (categoryFromColumn) break;
  }

  // Find name boundary: volume indicator (L, LT, LTS, KG, ML)
  let nameEndIndex = -1;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i].toUpperCase();
    // Check if token IS a volume or ENDS with volume
    if (t === 'L' || t === 'LT' || t === 'LTS' || t === 'KG' || t === 'ML' || 
        t.endsWith('LT') || t.endsWith('LTS') || t.endsWith('KG') || t.endsWith('ML') ||
        t.endsWith('L') && t.length <= 3) {
      nameEndIndex = i;
      break;
    }
  }

  if (nameEndIndex === -1) return null;

  // Name = from start to volume indicator (inclusive)
  const name = tokens.slice(0, nameEndIndex + 1).join(' ');
  
  if (!name || name.length < 3) return null;

  // P.A. = from name end to category start (or dose start if no category)
  const paEndIndex = categoryStartIndex !== -1 ? categoryStartIndex - 1 : doseStartIndex - 1;
  const principioAtivo = tokens.slice(nameEndIndex + 1, paEndIndex + 1).join(' ');

  // Determine category: column > P.A. detection > currentCategory
  let category = currentCategory;
  
  if (categoryFromColumn) {
    category = categoryFromColumn;
  } else if (category === 'outros' || !category) {
    const detectedCategory = detectCategoryFromPA(principioAtivo);
    if (detectedCategory) {
      category = detectedCategory;
    }
  }

  // Detect unit
  let unit = 'lt';
  if (name.includes('LTS') || name.includes('LT')) unit = 'lt';
  else if (name.includes('KG') || name.includes('Kg')) unit = 'kg';
  else if (dosePerHa?.includes('Kg')) unit = 'kg';
  else if (dosePerHa?.includes('Lt')) unit = 'lt';

  return {
    name,
    category,
    principioAtivo: principioAtivo || undefined,
    dosePerHa,
    fabricante,
    priceVermelha: priceVermelha && !isNaN(parseFloat(priceVermelha)) ? priceVermelha : undefined,
    priceAmarela: priceAmarela && !isNaN(parseFloat(priceAmarela)) ? priceAmarela : undefined,
    priceVerde: priceVerde && !isNaN(parseFloat(priceVerde)) ? priceVerde : undefined,
    unit,
  };
}

export async function parsePdfBarterProducts(buffer: Buffer): Promise<ParsedBarterProduct[]> {
  const data = await pdfParse(new Uint8Array(buffer));
  const lines = data.text.split('\n');
  
  const products: ParsedBarterProduct[] = [];
  let currentCategory = 'outros';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if this line is a category header (entire line = category)
    const detectedCategory = detectCategoryHeader(trimmed);
    if (detectedCategory) {
      currentCategory = detectedCategory;
      continue;
    }

    // Try to parse as product line
    const product = parseProductLine(trimmed, currentCategory);
    if (product) {
      products.push(product);
    }
  }

  return products;
}

export async function parseExcelBarterProducts(buffer: Buffer): Promise<ParsedBarterProduct[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const products: ParsedBarterProduct[] = [];
  let currentCategory = 'outros';
  let headerRow = -1;
  let hasCategoryColumn = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] || '').trim();
    
    // Check if this is a category header (entire cell = category)
    const detectedCategory = detectCategoryHeader(firstCell);
    if (detectedCategory) {
      currentCategory = detectedCategory;
      continue;
    }

    // Check if this is the header row
    if (firstCell.toLowerCase().includes('mercader') || firstCell.toLowerCase().includes('produto')) {
      headerRow = i;
      // Check if there's a category column (usually between P.A. and Dose)
      const headerCells = row.map((cell: any) => String(cell || '').trim().toUpperCase());
      hasCategoryColumn = headerCells.some((cell: string) => 
        cell === 'CATEGORIA' || cell === 'CATEGORY' || 
        cell === 'TRATAMENTO DE SEMENTES' || cell === 'DESSECAÇÃO' || 
        cell === 'INSETICIDAS' || cell === 'FUNGICIDAS' || 
        cell === 'HERBICIDAS' || cell === 'ESPECIALIDADES'
      );
      continue;
    }

    // Skip if we haven't found headers yet
    if (headerRow === -1) continue;

    // Parse product row - adjust indices based on whether category column exists
    let name, principioAtivo, categoryCell, dosePerHa, fabricante, priceVermelha, priceAmarela, priceVerde;
    
    if (hasCategoryColumn) {
      // Format: Name | P.A. | Category | Dose | Fabricante | Vermelha | Amarela | Verde
      name = String(row[0] || '').trim();
      principioAtivo = String(row[1] || '').trim();
      categoryCell = String(row[2] || '').trim();
      dosePerHa = String(row[3] || '').trim();
      fabricante = String(row[4] || '').trim();
      priceVermelha = String(row[5] || '').replace(',', '.');
      priceAmarela = String(row[6] || '').replace(',', '.');
      priceVerde = String(row[7] || '').replace(',', '.');
    } else {
      // Format: Name | P.A. | Dose | Fabricante | Vermelha | Amarela | Verde
      name = String(row[0] || '').trim();
      principioAtivo = String(row[1] || '').trim();
      dosePerHa = String(row[2] || '').trim();
      fabricante = String(row[3] || '').trim();
      priceVermelha = String(row[4] || '').replace(',', '.');
      priceAmarela = String(row[5] || '').replace(',', '.');
      priceVerde = String(row[6] || '').replace(',', '.');
    }

    if (!name || name.length < 3) continue;

    // Determine category: use category column > P.A. detection > fallback to currentCategory
    let category = currentCategory;
    
    if (hasCategoryColumn && categoryCell) {
      const detectedFromColumn = detectCategoryFromColumn(categoryCell);
      if (detectedFromColumn) {
        category = detectedFromColumn;
      }
    }
    
    if (category === 'outros' || !category) {
      const detectedCategory = detectCategoryFromPA(principioAtivo);
      if (detectedCategory) {
        category = detectedCategory;
      }
    }

    // Detect unit
    let unit = 'lt';
    if (name.includes('LTS') || name.includes('LT')) unit = 'lt';
    else if (name.includes('KG') || name.includes('Kg')) unit = 'kg';
    else if (dosePerHa?.includes('Kg')) unit = 'kg';
    else if (dosePerHa?.includes('Lt')) unit = 'lt';

    products.push({
      name,
      category,
      principioAtivo: principioAtivo || undefined,
      dosePerHa: dosePerHa || undefined,
      fabricante: fabricante || undefined,
      priceVermelha: priceVermelha || undefined,
      priceAmarela: priceAmarela || undefined,
      priceVerde: priceVerde || undefined,
      unit,
    });
  }

  return products;
}
