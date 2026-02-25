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
                if (param.name === 'whatsapp_number' && !param.value) {
                    param.valueProvider = "fieldValue";
                    param.value = "={{ $node[\"Webhook Z-API\"].json.body.phone }}";
                    changed = true;
                }
            });
        }
    }
});

if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log("Successfully injected whatsapp_number into AI Tools.");
} else {
    console.log("No changes needed or whatsapp_number already injected.");
}
