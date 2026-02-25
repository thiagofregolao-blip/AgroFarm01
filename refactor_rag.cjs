const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const workflow = JSON.parse(rawData);

// 1. Remove RAG nodes
const nodesToRemove = [
    "In-Memory Vector Store",
    "Embeddings Google Gemini",
    "ConsultarManuaisAgronomicos",
    "Ler Manuais (HTTP Request)",
    "JSON Data Loader",
    "Default Data Loader",
    "Text Splitter",
    "Ler Manuais (Read Files)"
];

workflow.nodes = workflow.nodes.filter(n => !nodesToRemove.includes(n.name));

// 2. Add the simpler HTTP Request Tool node
const httpRAGTool = {
    "parameters": {
        "toolDescription": "Sempre que o usuário perguntar sobre dosagem, carências, modos de aplicação ou pragas, envie a dúvida do usuário no parâmetro search para esta ferramenta e ela lerá os manuais oficias.",
        "url": "https://agrofarm01-production.up.railway.app/api/farm/webhook/n8n/manuals",
        "sendQuery": true,
        "parametersQuery": {
            "values": [
                {
                    "name": "search",
                    "valueProvider": "fieldValue",
                    "value": "={{ $fromAI(\"query\") }}"
                }
            ]
        },
        "sendHeaders": true,
        "parametersHeaders": {
            "values": [
                {
                    "name": "User-Agent",
                    "valueProvider": "fieldValue",
                    "value": "AgroFarm/1.0"
                }
            ]
        }
    },
    "id": "8b51d46b-8007-4e0d-b841-a1b7eabc7a1e", // Re-using ID to keep the connection to Agent
    "name": "ConsultarManuaisAgronomicos",
    "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
    "typeVersion": 1,
    "position": [
        752,
        2032
    ]
};

workflow.nodes.push(httpRAGTool);

// 3. Clean up connections: Remove connections originating from deleted nodes
if (workflow.connections) {
    nodesToRemove.forEach(nodeName => {
        if (workflow.connections[nodeName]) {
            delete workflow.connections[nodeName];
        }
    });

    // We don't need to rebuild the Agent -> ConsultarManuaisAgronomicos connection 
    // because it should still be in the Agent's output or ConsultarManuaisAgronomicos output.
    // Wait, tools connect their output to the Agent's Tool input.
    // In n8n, tools are connected FROM the Tool TO the Agent? No, From the tool TO the Agent's ai_tool input.
    // Let's ensure the tool is connected to the Agent.
    workflow.connections["ConsultarManuaisAgronomicos"] = {
        "ai_tool": [
            [
                {
                    "node": "AgroFarm AI Agent",
                    "type": "ai_tool",
                    "index": 0
                }
            ]
        ]
    };
}

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
console.log("Successfully refactored RAG to HTTP Request Tool.");
