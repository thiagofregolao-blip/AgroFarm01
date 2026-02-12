# 📱 Guia Passo a Passo: Implementação WhatsApp + Z-API

## ⚠️ IMPORTANTE: Sobre Acesso dos Clientes

**Resposta curta:** Sim, todos os seus clientes (agricultores) podem usar o WhatsApp para consultar seus próprios dados.

**Como funciona:**
- Cada agricultor cadastra seu número de WhatsApp no sistema
- Quando ele manda mensagem, o sistema identifica pelo número
- Ele só vê os dados dele (estoque, despesas, faturas, aplicações)
- Não consegue ver dados de outros agricultores

**Segurança:**
- Autenticação por número de telefone
- Cada consulta verifica se o número pertence ao usuário
- Dados isolados por `farmerId`

---

## 📋 PRÉ-REQUISITOS

Antes de começar, você precisa ter:

1. ✅ Conta Z-API criada (você já tem!)
2. ✅ Instância Z-API configurada e conectada
3. ✅ Chave de API do Google Gemini
4. ✅ Acesso ao banco de dados PostgreSQL
5. ✅ Código do projeto atualizado

---

## 🚀 PASSO 1: Obter Chave do Gemini AI

1. Acesse: https://makersuite.google.com/app/apikey
2. Faça login com sua conta Google
3. Clique em "Create API Key"
4. Copie a chave gerada (algo como: `AIzaSy...`)
5. **Guarde essa chave!** Você vai usar no próximo passo

---

## 🔧 PASSO 2: Configurar Variáveis de Ambiente

1. Abra o arquivo `.env` na raiz do projeto
2. Adicione as seguintes variáveis (use os dados da sua imagem):

```env
# Z-API Configuration (use os dados da sua instância)
ZAPI_INSTANCE_ID=3EE9E067CA2DB1B055091AD735EF201A
ZAPI_TOKEN=04B2338260C41E1C2EDA1FF2
ZAPI_BASE_URL=https://api.z-api.io

# Gemini AI Configuration (cole a chave que você copiou)
GEMINI_API_KEY=AIzaSy_SUA_CHAVE_AQUI
```

3. Salve o arquivo `.env`

**⚠️ ATENÇÃO:** 
- Não compartilhe essas chaves publicamente
- Não faça commit do `.env` no Git
- Mantenha essas informações seguras

---

## 🗄️ PASSO 3: Executar Migration do Banco de Dados

A migration adiciona o campo `whatsapp_number` nas tabelas `users` e `farm_farmers`.

### Opção A: Via Script (Recomendado)

```bash
cd /Volumes/KINGSTON/Desktop/AgroFarmDigital/AgroFarmDigital
npm run db:migrate-planning
```

### Opção B: Manualmente no Banco

Se preferir executar manualmente, rode este SQL:

```sql
-- Adicionar campo whatsapp_number na tabela users
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_users_whatsapp_number ON users(whatsapp_number) WHERE whatsapp_number IS NOT NULL;

-- Adicionar campo whatsapp_number na tabela farm_farmers
ALTER TABLE farm_farmers ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_farm_farmers_whatsapp_number ON farm_farmers(whatsapp_number) WHERE whatsapp_number IS NOT NULL;
```

**Verificar se funcionou:**
```sql
-- Verificar se as colunas foram criadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'farm_farmers') 
AND column_name = 'whatsapp_number';
```

---

## 🔗 PASSO 4: Configurar Webhook no Z-API

O webhook permite que o Z-API envie mensagens recebidas para o seu servidor.

### 4.1. Descobrir URL do seu servidor

**Se estiver em desenvolvimento local:**
- Use um túnel como ngrok: `ngrok http 3000`
- Ou use o Railway/Replit que já expõe uma URL pública

**Se estiver em produção:**
- Use a URL do seu servidor (ex: `https://seu-app.railway.app`)

**URL do webhook será:** `https://sua-url.com/api/whatsapp/webhook`

### 4.2. Configurar no Z-API

1. Acesse o painel Z-API: https://www.z-api.io/
2. Vá na aba **"Webhooks e configurações gerais"**
3. Clique em **"Configurar agora"** (ou edite se já existir)
4. Configure:
   - **URL do Webhook:** `https://sua-url.com/api/whatsapp/webhook`
   - **Método:** POST
   - **Eventos:** Marque "Mensagens recebidas"
5. Salve

**⚠️ IMPORTANTE:** 
- A URL deve ser pública (não pode ser localhost)
- O servidor deve estar rodando para receber os webhooks
- Teste a URL antes de configurar

---

## 👤 PASSO 5: Cadastrar Números de WhatsApp dos Clientes

Cada cliente precisa ter seu número cadastrado no banco de dados.

### Formato do Número

**Formato correto:** `5511999999999`
- Código do país (55 para Brasil)
- DDD (11)
- Número (999999999)
- **SEM** o sinal de +
- **SEM** espaços
- **SEM** caracteres especiais

**Exemplos:**
- ✅ Correto: `5511999999999`
- ❌ Errado: `+55 11 99999-9999`
- ❌ Errado: `(11) 99999-9999`

### 5.1. Cadastrar via SQL

```sql
-- Para um agricultor específico (farm_farmers)
UPDATE farm_farmers 
SET whatsapp_number = '5511999999999' 
WHERE id = 'id_do_agricultor';

-- Para um usuário do sistema (users)
UPDATE users 
SET whatsapp_number = '5511999999999' 
WHERE id = 'id_do_usuario';
```

### 5.2. Cadastrar via Interface (Futuro)

**TODO:** Criar interface no sistema para cadastrar números de WhatsApp.

Por enquanto, use SQL ou crie um endpoint temporário.

---

## 🧪 PASSO 6: Testar a Integração

### 6.1. Verificar se o servidor está rodando

```bash
# Iniciar servidor
npm run dev
```

Você deve ver no console:
```
✅ WhatsApp routes registered (/api/whatsapp/*)
```

Se aparecer:
```
⚠️  WhatsApp not configured (missing ZAPI_INSTANCE_ID, ZAPI_TOKEN, or GEMINI_API_KEY)
```

Verifique se as variáveis de ambiente estão corretas no `.env`.

### 6.2. Testar Status da Instância

Acesse no navegador ou via curl:

```bash
curl https://sua-url.com/api/whatsapp/status
```

Deve retornar:
```json
{
  "connected": true
}
```

### 6.3. Testar Envio de Mensagem

```bash
curl -X POST https://sua-url.com/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "5511999999999",
    "message": "Teste de mensagem"
  }'
```

### 6.4. Testar Recebimento (Webhook)

1. Envie uma mensagem do WhatsApp para o número conectado no Z-API
2. Verifique os logs do servidor
3. Você deve ver:
   ```
   [WhatsApp] Processando mensagem de: 5511999999999
   [Gemini] Interpretando pergunta: ...
   ```

---

## 📝 PASSO 7: Testar Consultas

Envie mensagens de teste do WhatsApp:

### Consultas de Estoque
- "qual meu estoque?"
- "quais produtos tenho?"
- "mostre meu estoque"

### Consultas de Despesas
- "quanto gastei este mês?"
- "mostre minhas despesas"
- "quais foram minhas despesas?"

### Consultas de Faturas
- "mostre minhas faturas"
- "quais faturas estão pendentes?"

### Consultas de Aplicações
- "quais aplicações fiz?"
- "mostre aplicações recentes"

---

## 🐛 TROUBLESHOOTING

### Problema: "Usuário não encontrado"

**Causa:** Número não está cadastrado no banco ou formato incorreto.

**Solução:**
1. Verifique se o número está cadastrado:
   ```sql
   SELECT id, name, whatsapp_number FROM farm_farmers WHERE whatsapp_number = '5511999999999';
   ```
2. Verifique o formato do número (deve ser `5511999999999`)
3. Certifique-se de que o número no WhatsApp é o mesmo cadastrado

### Problema: "Não entendi sua pergunta"

**Causa:** Gemini não conseguiu interpretar a pergunta.

**Solução:**
1. Verifique se `GEMINI_API_KEY` está configurada
2. Tente perguntas mais simples
3. Use palavras-chave: "estoque", "despesas", "faturas"

### Problema: Webhook não recebe mensagens

**Causa:** URL do webhook incorreta ou servidor não acessível.

**Solução:**
1. Verifique se a URL está correta no Z-API
2. Teste a URL manualmente (deve retornar 200 OK)
3. Verifique se o servidor está rodando
4. Verifique logs do servidor

### Problema: Erro ao enviar mensagem

**Causa:** Z-API não conectada ou credenciais incorretas.

**Solução:**
1. Verifique status: `/api/whatsapp/status`
2. Verifique se `ZAPI_INSTANCE_ID` e `ZAPI_TOKEN` estão corretos
3. Verifique se a instância está "Conectada" no painel Z-API

---

## 📊 PRÓXIMOS PASSOS (Opcional)

Depois que estiver funcionando, você pode:

1. **Criar interface para cadastrar números**
   - Adicionar campo no cadastro de agricultores
   - Permitir edição do número

2. **Melhorar respostas do Gemini**
   - Ajustar prompts para maior precisão
   - Adicionar mais tipos de consultas

3. **Adicionar comandos de ação**
   - Criar aplicação via WhatsApp
   - Registrar despesa via WhatsApp

4. **Adicionar segurança**
   - Validação de assinatura do webhook
   - Rate limiting
   - Logs de auditoria

---

## ✅ CHECKLIST FINAL

Antes de considerar implementado, verifique:

- [ ] Variáveis de ambiente configuradas (`.env`)
- [ ] Migration executada (campo `whatsapp_number` criado)
- [ ] Webhook configurado no Z-API
- [ ] Pelo menos 1 cliente com número cadastrado
- [ ] Servidor rodando e recebendo webhooks
- [ ] Teste de envio funcionando
- [ ] Teste de recebimento funcionando
- [ ] Consultas básicas funcionando

---

## 🆘 PRECISA DE AJUDA?

Se encontrar problemas:

1. Verifique os logs do servidor
2. Verifique o status da instância Z-API
3. Teste cada componente separadamente
4. Consulte a documentação: `WHATSAPP_SETUP.md`

---

**Boa sorte com a implementação! 🚀**
