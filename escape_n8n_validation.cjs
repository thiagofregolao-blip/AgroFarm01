const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const workflow = JSON.parse(rawData);

let changed = false;

workflow.nodes.forEach(node => {
    // 1. Force Agent to explicitly pass down whatsapp_number from the webhook.
    // The AgroFarm AI Agent's "sysPrompt" or input could include it, but
    // since we're using n8n AI Tools (HTTP Request), we can just replace the variable.
    // BUT WAIT: The easiest and 100% bug-free way to escape validation in n8n for
    // cross-node references when the nodes aren't visually wired is to use $evaluateExpression.
    // OR we can just use {{ $('Webhook Z-API').first().json.body?.phone }}
    // The `$()` syntax doesn't trigger visual link validation warnings in older n8n 
    // versions as aggressively as `$node[]` does. Let's use `$('Webhook Z-API').item.json.body.phone`
    // Actually, n8n officially recommends `$json.body.phone` if the item passes through, or 
    // `$evaluateExpression('{{$node["Webhook Z-API"].json.body.phone}}')` to bypass UI validation entirely!

    // Let's use $evaluateExpression or simply $fromAI('whatsapp_number') and add it to the agent prompt?
    // Actually, the easiest is to just use n8n's property path parser: 
    // `={{ $('Webhook Z-API').first().json.body.phone }}`

    if (node.type === "@n8n/n8n-nodes-langchain.toolHttpRequest") {
        if (node.parameters && node.parameters.parametersQuery && node.parameters.parametersQuery.values) {
            node.parameters.parametersQuery.values.forEach(param => {
                if (param.name === 'whatsapp_number') {
                    // Update to the standard n8n >= 1.0 item reference which doesn't require visual wires
                    param.valueProvider = "fieldValue";
                    param.value = "={{ $('Webhook Z-API').first().json.body.phone }}";
                    changed = true;
                }
            });
        }
    }
});

if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log("Successfully fixed Webhook UI connection error.");
} else {
    console.log("No changes needed.");
}
