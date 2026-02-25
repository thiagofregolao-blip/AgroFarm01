const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const workflow = JSON.parse(rawData);

// Nodes configuration
const httpRequestNode = {
    "parameters": {
        "url": "https://agrofarm01-production.up.railway.app/api/farm/webhook/n8n/manuals",
        "sendHeaders": true,
        "headerParameters": {
            "parameters": [
                {
                    "name": "Accept",
                    "value": "application/json"
                }
            ]
        },
        "options": {}
    },
    "id": "a2e5b7c8-9d4f-4b1a-8c2d-3f6e9a1b0c4f", // Re-using ID of 'Ler Manuais' node, or wait, 'Ler Manuais' might be different. 
    "name": "Ler Manuais (HTTP Request)",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [900, 2200]
};

const jsonDataLoaderNode = {
    "parameters": {
        "options": {
            "metadata": {
                "metadataValues": [
                    {
                        "name": "segment",
                        "value": "={{ $json.segment }}"
                    },
                    {
                        "name": "title",
                        "value": "={{ $json.title }}"
                    }
                ]
            }
        }
    },
    "id": "52f82ac2-6e27-4dd3-b1d5-22e3ebc0a0c6", // Re-using ID of 'Default Data Loader'
    "name": "JSON Data Loader",
    "type": "@n8n/n8n-nodes-langchain.documentJsonDataLoader",
    "typeVersion": 1,
    "position": [900, 2384]
};

const textSplitterNode = {
    "parameters": {
        "options": {}
    },
    "id": "d74c0e64-219c-4f73-9a5c-1122a61f22b8",
    "name": "Text Splitter",
    "type": "@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterTextSplitter",
    "typeVersion": 1,
    "position": [1050, 2550]
};

// 1. Remove old 'Ler Manuais' and 'Default Data Loader'
const filteredNodes = workflow.nodes.filter(
    n => n.name !== "Ler Manuais (Read Files)" && n.name !== "Default Data Loader"
);

// Get the actual UUIDs if they exist, to preserve links
const oldLerNode = workflow.nodes.find(n => n.name === "Ler Manuais (Read Files)");
if (oldLerNode) httpRequestNode.id = oldLerNode.id;

const oldLoaderNode = workflow.nodes.find(n => n.name === "Default Data Loader");
if (oldLoaderNode) jsonDataLoaderNode.id = oldLoaderNode.id;

// 2. Add new nodes
filteredNodes.push(httpRequestNode, jsonDataLoaderNode, textSplitterNode);
workflow.nodes = filteredNodes;

// 3. Fix connections
// Old: Ler -> Loader. Loader -> Store.  (Actually, Loader -> Store might just exist via internal type).
// Let's check existing connections.
if (workflow.connections) {
    // Delete any old connections involving 'Ler Manuais (Read Files)' or 'Default Data Loader'
    if (workflow.connections["Ler Manuais (Read Files)"]) {
        delete workflow.connections["Ler Manuais (Read Files)"];
    }
    if (workflow.connections["Default Data Loader"]) {
        delete workflow.connections["Default Data Loader"];
    }

    // Add new connections:
    // HTTP Request -> JSON Data Loader (main output to main input)
    workflow.connections["Ler Manuais (HTTP Request)"] = {
        "main": [
            [
                {
                    "node": "JSON Data Loader",
                    "type": "main",
                    "index": 0
                }
            ]
        ]
    };

    // Text Splitter -> JSON Data Loader (textSplitter output to ai_textSplitter input)
    workflow.connections["Text Splitter"] = {
        "ai_textSplitter": [
            [
                {
                    "node": "JSON Data Loader",
                    "type": "ai_textSplitter",
                    "index": 0
                }
            ]
        ]
    };

    // JSON Data Loader -> Vector Store (ai_document output to ai_document input)
    workflow.connections["JSON Data Loader"] = {
        "ai_document": [
            [
                {
                    "node": "In-Memory Vector Store", // Connected to the memory store
                    "type": "ai_document",
                    "index": 0
                }
            ]
        ]
    };
}

fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
console.log("Successfully modified n8n JSON workflow.");
