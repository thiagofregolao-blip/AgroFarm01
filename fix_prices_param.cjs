const fs = require('fs');

const data = JSON.parse(fs.readFileSync('WhatsApp AgroFarm - AI Agent & Recebimentos (3).json', 'utf8'));

// Find the AI Agent node
const agent = data.nodes.find(n => n.name === 'AgroFarm AI Agent');
if (agent) {
    // Inject the new tool node configuration
    data.nodes.push({
      "parameters": {
        "toolDescription": "A ferramenta IDEAL E INSUPERÁVEL para consultar PREÇO, COMPRA OU FATURA DE UM PRODUTO ESPECÍFICO. Quando o usuário perguntar 'quanto paguei no glifosato?' use esta ferramenta e envie o nome do produto no parâmetro de busca.",
        "url": "https://agrofarm01-production.up.railway.app/api/farm/webhook/n8n/prices",
        "sendQuery": true,
        "parametersQuery": {
          "values": [
            {
              "name": "whatsapp_number",
              "valueProvider": "fieldValue",
              "value": "={{ $('Webhook Z-API').first().json.body.phone }}"
            },
            {
              "name": "search",
              "valueProvider": "fromAI",
              "description": "Nome exato do produto a ser pesquisado (ex: glifosato)"
            }
          ]
        },
        "sendHeaders": true,
        "parametersHeaders": {
          "values": [
            {
              "name": "User-Agent",
              "valueProvider": "fieldValue",
              "value": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
          ]
        }
      },
      "id": "e6e0dc69-727e-4b4e-8744-e09c57d29fcf",
      "name": "ConsultarPrecoProduto",
      "type": "@n8n/n8n-nodes-langchain.toolHttpRequest",
      "typeVersion": 1,
      "position": [
        752,
        2032
      ]
    });

    // Link the new tool to the AI Agent
    if (!data.connections['ConsultarPrecoProduto']) {
        data.connections['ConsultarPrecoProduto'] = {
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
}

fs.writeFileSync('WhatsApp AgroFarm - AI Agent & Recebimentos (3).json', JSON.stringify(data, null, 2));
console.log('JSON updated successfully with Dedicated Prices node');
