import fs from 'fs';

const filePath = '/Volumes/KINGSTON/Desktop/AgroFarmDigital/AgroFarmDigital/WhatsApp AgroFarm - AI Agent & Recebimentos (3).json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Update the system message for the Agent
const agentNode = data.nodes.find(n => n.name === 'AgroFarm AI Agent');
if (agentNode) {
    agentNode.parameters.options.systemMessage = `=Você é o assistente virtual da AgroFarm. Você ajuda o agricultor tirando dúvidas sobre o estoque dele, sobre as aplicações no campo, compras e despesas. Seja educado, use emojis agrícolas e responda sempre de forma curta no formato WhatsApp.

IMPORTANTE PARA USO DE TOOLS:
O número de WhatsApp do agricultor atual é: {{$json.body.phone}}.

SEMPRE passe esse \`whatsapp_number\` como uma STRING (texto entre aspas, ex: "0986123456") quando for chamar qualquer tool. NUNCA envie como numeral.

SEJA INTELIGENTE: Quando o usuário perguntar por uma data específica (ex: 23/12), envie a data no parâmetro \`date\` da Tool correta. Quando perguntar por um produto, envie o produto no parâmetro \`search\`.`;
}

// Update ConsultarFaturas Tool
const invoicesTool = data.nodes.find(n => n.name === 'Tool_ConsultarFaturas');
if (invoicesTool) {
    invoicesTool.parameters.toolDescription = "Esta ferramenta busca totais de despesas e faturas recentes. Se o usuário perguntar por uma data específica (ex: 'tem algo dia 23/12?'), envie a data no parâmetro 'date'. Se perguntar por fornecedor, envie no parâmetro 'supplier'.";

    const hasInvoicesDate = invoicesTool.parameters.parametersQuery?.values?.some(v => v.name === 'date');
    if (!hasInvoicesDate && invoicesTool.parameters.parametersQuery?.values) {
        invoicesTool.parameters.parametersQuery.values.push({
            name: "date",
            valueProvider: "fromAI",
            description: "A data solicitada pelo usuário (ex: '2025-12-23' ou '23/12'). Deixe vazio se não foi informada."
        });
    }

    const hasInvoicesSupplier = invoicesTool.parameters.parametersQuery?.values?.some(v => v.name === 'supplier');
    if (!hasInvoicesSupplier && invoicesTool.parameters.parametersQuery?.values) {
        invoicesTool.parameters.parametersQuery.values.push({
            name: "supplier",
            valueProvider: "fromAI",
            description: "O nome do fornecedor, se o usuário citou."
        });
    }
}

// Update ConsultarPrecoProduto Tool
const pricesTool = data.nodes.find(n => n.name === 'ConsultarPrecoProduto');
if (pricesTool) {
    pricesTool.parameters.toolDescription = "Ferramenta para consultar o PREÇO pago ou o HISTÓRICO DE COMPRAS de um produto específico (ex: glifosato, semente). O parâmetro 'search' é OBRIGATÓRIO com o nome do produto. Opcionalmente, envie 'date' se o usuário perguntou o preço em uma data.";

    const hasSearch = pricesTool.parameters.parametersQuery?.values?.some(v => v.name === 'search');
    if (!hasSearch && pricesTool.parameters.parametersQuery?.values) {
        pricesTool.parameters.parametersQuery.values.push({
            name: "search",
            valueProvider: "fromAI",
            description: "Nome exato do produto a ser pesquisado (ex: glifosato). MÁXIMA IMPORTÂNCIA!"
        });
    }

    // Some older iterations might have had 'search' mapped differently, let's update it if found
    const searchParam = pricesTool.parameters.parametersQuery?.values?.find(v => v.name === 'search');
    if (searchParam) {
        searchParam.valueProvider = "fromAI";
        searchParam.description = "Nome exato do produto a ser pesquisado (ex: glifosato). MÁXIMA IMPORTÂNCIA!";
        delete searchParam.value; // Remove hardcoded value if any
    }

    const hasDate = pricesTool.parameters.parametersQuery?.values?.some(v => v.name === 'date');
    if (!hasDate && pricesTool.parameters.parametersQuery?.values) {
        pricesTool.parameters.parametersQuery.values.push({
            name: "date",
            valueProvider: "fromAI",
            description: "A data da compra se informada (ex: '2025-12-23' ou '23/12')"
        });
    }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log("JSON original atualizado com sucesso.");
