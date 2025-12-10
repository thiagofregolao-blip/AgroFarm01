import { pdf } from 'pdf-parse';
import { readFileSync } from 'fs';

const buffer = readFileSync('./attached_assets/SOJA 25-26 (1)_1759865903948.pdf');
const data = await pdf(new Uint8Array(buffer));
const lines = data.text.split('\n');

function parseProductLine(line, currentCategory) {
  const tokens = line.trim().split(/\s+/);
  
  if (tokens.length < 7) return null;

  const firstToken = tokens[0]?.toUpperCase();
  if (firstToken === 'MERCADERÍA' || firstToken === 'MERCADERIA' || firstToken === 'PRODUTO' || 
      firstToken === 'P.A.' || firstToken === 'DOSE' || firstToken === 'FABRICANTE') {
    return null;
  }

  const priceVerde = tokens[tokens.length - 1]?.replace(',', '.');
  const priceAmarela = tokens[tokens.length - 2]?.replace(',', '.');
  const priceVermelha = tokens[tokens.length - 3]?.replace(',', '.');

  if (isNaN(parseFloat(priceVermelha)) || isNaN(parseFloat(priceAmarela)) || isNaN(parseFloat(priceVerde))) {
    return null;
  }

  const fabricante = tokens[tokens.length - 4];

  let doseIndex = tokens.findIndex(t => 
    t.includes('ml/') || t.includes('Lt/') || t.includes('Kg/') || t.includes('/Ha')
  );
  
  if (doseIndex === -1) return null;

  let doseStartIndex = doseIndex;
  if (doseIndex >= 2 && tokens[doseIndex - 1] === '-' && !isNaN(parseFloat(tokens[doseIndex - 2]))) {
    doseStartIndex = doseIndex - 2;
  }

  const dosePerHa = tokens.slice(doseStartIndex, doseIndex + 1).join(' ');

  const fabricanteIndex = tokens.length - 4;
  const principioAtivo = tokens.slice(doseIndex + 1, fabricanteIndex).join(' ');
  const name = tokens.slice(0, doseStartIndex).join(' ');
  
  if (!name || name.length < 3) return null;

  let unit = 'lt';
  if (name.includes('LTS') || name.includes('LT')) unit = 'lt';
  else if (name.includes('KG') || name.includes('Kg')) unit = 'kg';
  else if (dosePerHa?.includes('Kg')) unit = 'kg';
  else if (dosePerHa?.includes('Lt')) unit = 'lt';

  return {
    name,
    category: currentCategory,
    principioAtivo,
    dosePerHa,
    fabricante,
    priceVermelha,
    priceAmarela,
    priceVerde,
    unit,
  };
}

console.log('=== Testing problematic lines ===\n');

const testLines = [
  'MAXIN RFC - 1 L Fludioxinil 2,5% + Metalaxil 3,75% 1ml/Kg Syngenta 42,00 44,00 46,00',
  '2,4 D Amina - 20 LTS 2,4D Dimetilamina 72% 1 - 2Lt/Ha Ciagropa 2,85 2,95 3,05',
  'RIZOSPIRILUM - 2 L Azospirillum 1x10^9 2ml/Kg Rizobacter 30,00 33,50 37,00',
];

for (const line of testLines) {
  const product = parseProductLine(line, 'outros');
  if (product) {
    console.log('✓ Parsed successfully:');
    console.log('  Name:', product.name);
    console.log('  P.A.:', product.principioAtivo);
    console.log('  Dose:', product.dosePerHa);
    console.log('  Fabricante:', product.fabricante);
    console.log('  Prices:', product.priceVermelha, '/', product.priceAmarela, '/', product.priceVerde);
  } else {
    console.log('✗ Failed to parse:', line);
  }
  console.log('---\n');
}

// Test full parsing
const products = [];
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  
  const product = parseProductLine(trimmed, 'outros');
  if (product) {
    products.push(product);
  }
}

console.log('\nTotal products found:', products.length);
