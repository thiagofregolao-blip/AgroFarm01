import XLSX from 'xlsx';

const workbook = XLSX.readFile('safra tiago.xls');
const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(firstSheet);

console.log('=== ANÁLISE DA PLANILHA ===');
console.log(`Total de linhas: ${rows.length}`);

let currentClientName = null;
let currentOrderCode = null;
let clientCount = 0;
let productsCount = 0;
let salesWithProduct = 0;
let salesWithoutData = 0;
let salesWithoutFechaVenc = 0;

const clientsFound = new Set();

for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Detectar linha com nome do cliente
    if (row.__EMPTY_1 && typeof row.__EMPTY_1 === 'string' && row.__EMPTY_1.includes('Entidad :')) {
        currentClientName = row.__EMPTY_1.replace('Entidad :', '').trim();
        currentOrderCode = null;
        clientsFound.add(currentClientName);
        clientCount++;
        continue;
    }

    // Verificar se tem produto (linha de venda)
    if (row.Mercadería) {
        productsCount++;

        if (!currentClientName) {
            salesWithoutData++;
            console.log(`Linha ${i + 1}: Produto "${row.Mercadería}" SEM cliente definido anteriormente`);
            continue;
        }

        // Verificar se tem data de vencimento
        const fechaVenc = row['Fecha Venc.'] || row['Fecha Venc'] || row[' Fecha Venc.'] || row['Fecha Venc. '];

        if (!fechaVenc) {
            salesWithoutFechaVenc++;
            console.log(`Linha ${i + 1}: Produto "${row.Mercadería}" para cliente "${currentClientName}" SEM data de vencimento`);
            console.log(`  Colunas disponíveis:`, Object.keys(row));
            continue;
        }

        salesWithProduct++;

        // Atualizar orderCode se presente
        if (row['Num. Pedido']) {
            currentOrderCode = row['Num. Pedido'].toString().trim();
        }
    }
}

console.log('\n=== RESUMO ===');
console.log(`Clientes únicos encontrados: ${clientsFound.size}`);
console.log(`Linhas "Entidad:" detectadas: ${clientCount}`);
console.log(`Linhas com produtos (Mercadería): ${productsCount}`);
console.log(`  - Com cliente e data válidos: ${salesWithProduct}`);
console.log(`  - SEM cliente definido: ${salesWithoutData}`);
console.log(`  - SEM data de vencimento: ${salesWithoutFechaVenc}`);

console.log('\n=== CLIENTES ENCONTRADOS ===');
Array.from(clientsFound).forEach((client, idx) => {
    console.log(`${idx + 1}. ${client}`);
});

// Analisar primeira linha de cada tipo
console.log('\n=== EXEMPLO DE LINHAS ===');
console.log('Primeira linha de cliente:');
const firstClientLine = rows.find(r => r.__EMPTY_1 && typeof r.__EMPTY_1 === 'string' && r.__EMPTY_1.includes('Entidad :'));
console.log(JSON.stringify(firstClientLine, null, 2));

console.log('\nPrimeira linha de produto:');
const firstProductLine = rows.find(r => r.Mercadería);
console.log(JSON.stringify(firstProductLine, null, 2));
