import XLSX from 'xlsx';

const workbook = XLSX.readFile('safra tiago.xls');
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(firstSheet);

console.log('=== ANÁLISE DE DUPLICATAS NA PLANILHA ===\n');

const orderCodesInFile = new Map();
let currentOrderCode = null;
let linesWithProduct = 0;
let linesWithOrderCode = 0;
let linesUsingPreviousOrderCode = 0;

for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Pular linhas que não são vendas
    if (!row.Mercadería) continue;

    linesWithProduct++;

    // Verificar se tem orderCode nesta linha
    if (row['Num. Pedido']) {
        currentOrderCode = row['Num. Pedido'].toString().trim();
        linesWithOrderCode++;

        if (!orderCodesInFile.has(currentOrderCode)) {
            orderCodesInFile.set(currentOrderCode, []);
        }
        orderCodesInFile.get(currentOrderCode).push(i + 1);
    } else if (currentOrderCode) {
        // Linha usa o orderCode anterior
        linesUsingPreviousOrderCode++;
        orderCodesInFile.get(currentOrderCode).push(i + 1);
    }
}

console.log(`Total de linhas com produtos: ${linesWithProduct}`);
console.log(`Linhas com Num. Pedido: ${linesWithOrderCode}`);
console.log(`Linhas usando orderCode anterior: ${linesUsingPreviousOrderCode}`);
console.log(`\nOrderCodes únicos na planilha: ${orderCodesInFile.size}`);

// Verificar se há duplicatas dentro da própria planilha
const duplicatesWithinFile = [];
for (const [orderCode, lineNumbers] of orderCodesInFile.entries()) {
    if (lineNumbers.length > 1) {
        duplicatesWithinFile.push({ orderCode, count: lineNumbers.length, lines: lineNumbers });
    }
}

if (duplicatesWithinFile.length > 0) {
    console.log(`\n⚠️  DUPLICATAS DENTRO DA PLANILHA: ${duplicatesWithinFile.length} orderCodes aparecem múltiplas vezes`);
    console.log('\nPrimeiros 10 duplicados:');
    duplicatesWithinFile.slice(0, 10).forEach(dup => {
        console.log(`  - ${dup.orderCode}: ${dup.count} vendas (linhas: ${dup.lines.slice(0, 5).join(', ')}${dup.lines.length > 5 ? '...' : ''})`);
    });

    // Calcular quantas vendas seriam importadas considerando duplicatas
    const totalUniqueSales = linesWithProduct;
    const duplicatedLines = duplicatesWithinFile.reduce((sum, dup) => sum + (dup.count - 1), 0);
    const expectedImports = totalUniqueSales - duplicatedLines;

    console.log(`\n📊 RESUMO:`);
    console.log(`  Total de vendas na planilha: ${totalUniqueSales}`);
    console.log(`  Linhas duplicadas: ${duplicatedLines}`);
    console.log(`  Vendas únicas esperadas: ${expectedImports}`);
} else {
    console.log('\n✅ Nenhuma duplicata encontrada dentro da planilha');
}
