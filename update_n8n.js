const fs = require('fs');
const file = 'WhatsApp AgroFarm - AI Agent & Recebimentos (3).json';
let data = JSON.parse(fs.readFileSync(file, 'utf8'));

// Add nodes
data.nodes.push(
    {
      "parameters": {
        "name": "ConsultarManuaisAgronomicos",
        "description": "Sempre que o usuário perguntar sobre dosagem, carências, modos de aplicação ou pragas, leia os manuais oficias por aqui."
      },
      "id": "8b51d46b-8007-4e0d-b841-a1b7eabc7a1e",
      "name": "Vector Store Question Answer Tool",
      "type": "@n8n/n8n-nodes-langchain.toolVectorStoreQnA",
      "typeVersion": 1,
      "position": [752, 2032]
    },
    {
      "parameters": {},
      "id": "7bf3b092-23c2-40a7-bc59-7b752df2f80c",
      "name": "In-Memory Vector Store",
      "type": "@n8n/n8n-nodes-langchain.vectorStoreInMemory",
      "typeVersion": 1,
      "position": [752, 2232]
    },
    {
      "parameters": {
        "modelName": "models/text-embedding-004"
      },
      "id": "e8a93e50-2f10-410a-8bf8-d3f18e1d52d3",
      "name": "Embeddings Google Gemini",
      "type": "@n8n/n8n-nodes-langchain.embeddingsGoogleGemini",
      "typeVersion": 1,
      "position": [600, 2384],
      "credentials": {
        "googlePalmApi": {
          "id": "kZk7EVTfZ0vJ6Gfu",
          "name": "Google Gemini(PaLM) Api account"
        }
      }
    },
    {
      "parameters": {
        "options": {}
      },
      "id": "52f82ac2-6e27-4dd3-b1d5-22e3ebc0a0c6",
      "name": "Default Data Loader",
      "type": "@n8n/n8n-nodes-langchain.documentDefaultDataLoader",
      "typeVersion": 1,
      "position": [900, 2384]
    }
);

// Add connections
data.connections["Vector Store Question Answer Tool"] = {
  "ai_tool": [ [ { "node": "AgroFarm AI Agent", "type": "ai_tool", "index": 0 } ] ]
};
data.connections["In-Memory Vector Store"] = {
  "ai_vectorStore": [ [ { "node": "Vector Store Question Answer Tool", "type": "ai_vectorStore", "index": 0 } ] ]
};
data.connections["Embeddings Google Gemini"] = {
  "ai_embedding": [ [ { "node": "In-Memory Vector Store", "type": "ai_embedding", "index": 0 } ] ]
};
data.connections["Default Data Loader"] = {
  "ai_document": [ [ { "node": "In-Memory Vector Store", "type": "ai_document", "index": 0 } ] ]
};

fs.writeFileSync(file, JSON.stringify(data, null, 2));
console.log('JSON updated successfully');
