const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const workflow = JSON.parse(rawData);

let changed = false;

workflow.nodes.forEach(node => {
    if (node.type === "@n8n/n8n-nodes-langchain.toolHttpRequest") {
        if (node.parameters && node.parameters.parametersQuery && node.parameters.parametersQuery.values) {
            node.parameters.parametersQuery.values.forEach(param => {
                if (param.name === 'search') {
                    param.valueProvider = "fromAI";
                    param.description = node.name === 'ConsultarManuaisAgronomicos'
                        ? "Envie a dúvida agronômica do usuário (ex: dosagem do produto, o que é, etc)"
                        : "Nome exato do produto a ser pesquisado (ex: glifosato)";
                    delete param.value;
                    changed = true;
                }
            });
        }
    }
});

if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log("Successfully fixed fromAI parameters formatting.");
} else {
    console.log("No changes needed.");
}
