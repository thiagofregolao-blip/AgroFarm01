# Configuração WhatsApp + Z-API + Gemini AI

## Visão Geral

Este sistema permite que agricultores consultem informações do sistema via WhatsApp usando inteligência artificial (Gemini) para interpretar perguntas em linguagem natural.

## Arquitetura

```
WhatsApp → Z-API → /api/whatsapp/webhook → WhatsAppService → Gemini AI → MessageHandler → PostgreSQL → Resposta
```

## Pré-requisitos

1. **Conta Z-API**: https://www.z-api.io/
   - Criar conta e obter `instanceId` e `token`
   - Configurar webhook para: `https://seu-dominio.com/api/whatsapp/webhook`

2. **API Key do Gemini AI**: https://makersuite.google.com/app/apikey
   - Criar chave de API do Google Gemini

3. **Número de WhatsApp**: Pode usar número pessoal ou comercial

## Configuração

### 1. Variáveis de Ambiente

Adicione ao arquivo `.env`:

```env
# Z-API Configuration
ZAPI_INSTANCE_ID=seu_instance_id_aqui
ZAPI_TOKEN=seu_token_aqui
ZAPI_BASE_URL=https://api.z-api.io  # Opcional, padrão já é este

# Gemini AI Configuration
GEMINI_API_KEY=sua_chave_gemini_aqui
```

### 2. Executar Migration

Execute a migration para adicionar campo `whatsapp_number`:

```bash
npm run db:migrate-planning
```

Ou execute manualmente:

```bash
tsx scripts/run-migration.ts
```

### 3. Configurar Webhook no Z-API

1. Acesse o painel Z-API
2. Vá em "Webhooks"
3. Configure a URL: `https://seu-dominio.com/api/whatsapp/webhook`
4. Método: POST
5. Salve

### 4. Cadastrar Número de WhatsApp dos Usuários

No banco de dados, atualize os usuários com seus números:

```sql
-- Para usuários do sistema principal
UPDATE users SET whatsapp_number = '5511999999999' WHERE id = 'user_id';

-- Para agricultores (farm_farmers)
UPDATE farm_farmers SET whatsapp_number = '5511999999999' WHERE id = 'farmer_id';
```

**Formato do número**: `5511999999999` (código do país + DDD + número, sem +, sem espaços, sem caracteres especiais)

## Endpoints Disponíveis

### POST `/api/whatsapp/webhook`
Webhook para receber mensagens do Z-API (configurado automaticamente)

### GET `/api/whatsapp/status`
Verifica status da conexão Z-API

### POST `/api/whatsapp/send` (desenvolvimento)
Envia mensagem de teste

```json
{
  "phone": "5511999999999",
  "message": "Mensagem de teste"
}
```

## Funcionalidades

### Consultas Disponíveis

Os usuários podem perguntar sobre:

- **Estoque**: "qual meu estoque?", "quais produtos tenho?"
- **Despesas**: "quanto gastei este mês?", "mostre minhas despesas"
- **Faturas**: "mostre minhas faturas", "quais faturas estão pendentes?"
- **Aplicações**: "quais aplicações fiz?", "mostre aplicações recentes"
- **Propriedades**: "quais são minhas propriedades?"
- **Talhões**: "mostre meus talhões"

### Exemplos de Perguntas

- "Qual meu estoque de produtos?"
- "Quanto gastei este mês?"
- "Mostre minhas faturas pendentes"
- "Quais aplicações fiz na última semana?"
- "Quantos talhões tenho?"

## Estrutura de Arquivos

```
server/whatsapp/
├── zapi-client.ts        # Cliente Z-API para envio/recebimento
├── gemini-client.ts      # Cliente Gemini AI para interpretação
├── message-handler.ts    # Handler para executar queries SQL
├── whatsapp-service.ts   # Serviço principal que orquestra tudo
└── webhook.ts           # Rotas Express para webhooks
```

## Troubleshooting

### Mensagem não chega
1. Verifique se o webhook está configurado corretamente no Z-API
2. Verifique logs do servidor: `[WhatsApp]` ou `[Z-API]`
3. Teste o endpoint `/api/whatsapp/status`

### Usuário não encontrado
1. Verifique se o número está cadastrado no banco (formato correto)
2. Verifique se o número está no formato: `5511999999999` (sem +, sem espaços)

### Gemini não entende pergunta
1. Verifique se `GEMINI_API_KEY` está configurada
2. Verifique logs: `[Gemini]`
3. Perguntas muito complexas podem ter confiança baixa (< 0.5)

### Erro ao enviar mensagem
1. Verifique se Z-API está conectada (`/api/whatsapp/status`)
2. Verifique se `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN` estão corretos
3. Verifique se o número está no formato correto

## Segurança

- Webhooks devem validar origem (implementar validação de assinatura se necessário)
- Rate limiting recomendado para evitar spam
- Validar permissões do usuário antes de retornar dados sensíveis
- Sanitizar inputs antes de enviar ao Gemini

## Próximos Passos

- [ ] Adicionar interface para cadastrar número de WhatsApp
- [ ] Implementar validação de assinatura do webhook
- [ ] Adicionar rate limiting
- [ ] Melhorar prompts do Gemini para maior precisão
- [ ] Adicionar mais tipos de consultas (relatórios, gráficos, etc.)
- [ ] Suporte a comandos de ação (criar, atualizar, deletar)
