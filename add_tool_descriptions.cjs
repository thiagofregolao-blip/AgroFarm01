const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const workflow = JSON.parse(rawData);

let changed = false;

workflow.nodes.forEach(node => {
    if (node.type === "@n8n/n8n-nodes-langchain.toolHttpRequest") {
        if (!node.parameters.toolDescription) {
            if (node.name === "ConsultarEstoque") {
                node.parameters.toolDescription = "Usa esta ferramenta para verificar a quantidade de produtos disponíveis no estoque do usuário (fazenda) no momento.";
                changed = true;
            } else if (node.name === "ConsultarAplicacoes") {
                node.parameters.toolDescription = "Usa esta ferramenta para consultar o histórico recente de aplicações de produtos (defensivos agrícolas) na lavoura para o agricultor.";
                changed = true;
            }
        }
    }
});

if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log("Successfully added tool descriptions.");
} else {
    console.log("No changes needed.");
}
