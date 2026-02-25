const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json');
const rawData = fs.readFileSync(filePath, 'utf-8');
const workflow = JSON.parse(rawData);

let changed = false;

// 1. Rename node
const loaderNode = workflow.nodes.find(n => n.name === "JSON Data Loader");
if (loaderNode) {
    loaderNode.name = "Default Data Loader";
    loaderNode.type = "@n8n/n8n-nodes-langchain.documentDefaultDataLoader";
    loaderNode.parameters = { "options": {} };
    changed = true;
}

// 2. Fix connections
if (workflow.connections) {
    // A) HTTP Request to Default Data Loader
    if (workflow.connections["Ler Manuais (HTTP Request)"] && workflow.connections["Ler Manuais (HTTP Request)"].main) {
        workflow.connections["Ler Manuais (HTTP Request)"].main[0].forEach(conn => {
            if (conn.node === "JSON Data Loader") {
                conn.node = "Default Data Loader";
                changed = true;
            }
        });
    }

    // B) Text Splitter to Default Data Loader
    if (workflow.connections["Text Splitter"] && workflow.connections["Text Splitter"].ai_textSplitter) {
        workflow.connections["Text Splitter"].ai_textSplitter[0].forEach(conn => {
            if (conn.node === "JSON Data Loader") {
                conn.node = "Default Data Loader";
                changed = true;
            }
        });
    }

    // C) Default Data Loader to Vector Store
    if (workflow.connections["JSON Data Loader"]) {
        workflow.connections["Default Data Loader"] = workflow.connections["JSON Data Loader"];
        delete workflow.connections["JSON Data Loader"];
        changed = true;
    }
}

if (changed) {
    fs.writeFileSync(filePath, JSON.stringify(workflow, null, 2), 'utf-8');
    console.log("Fixed DataLoader Node Type and Connections.");
} else {
    console.log("No changes made, node might already be fixed.");
}
