# 🚂 Configuração WhatsApp no Railway

## 📋 Variáveis de Ambiente no Railway

Como seu app está no Railway, você precisa adicionar as variáveis de ambiente diretamente no painel.

---

## 🔧 PASSO 1: Adicionar Variáveis no Railway

### 1.1. Acessar Configurações

1. Acesse: https://railway.app/
2. Selecione seu projeto
3. Clique no serviço (service) do seu app
4. Vá na aba **"Variables"** (Variáveis)

### 1.2. Adicionar Variáveis

Adicione as seguintes variáveis (uma por uma):

#### Variável 1: Z-API Instance ID
- **Nome:** `ZAPI_INSTANCE_ID`
- **Valor:** `3EE9E067CA2DB1B055091AD735EF201A`
- Clique em **"New Variable"** → Cole nome e valor → **"Add"**

#### Variável 2: Z-API Token
- **Nome:** `ZAPI_TOKEN`
- **Valor:** `04B2338260C41E1C2EDA1FF2`
- Clique em **"New Variable"** → Cole nome e valor → **"Add"**

#### Variável 3: Z-API Base URL (Opcional)
- **Nome:** `ZAPI_BASE_URL`
- **Valor:** `https://api.z-api.io`
- Clique em **"New Variable"** → Cole nome e valor → **"Add"**

#### Variável 4: Gemini API Key
- **Nome:** `GEMINI_API_KEY`
- **Valor:** `SUA_CHAVE_GEMINI_AQUI` (você precisa criar no passo 2)
- Clique em **"New Variable"** → Cole nome e valor → **"Add"**

### 1.3. Verificar

Após adicionar todas, você deve ter 4 variáveis:
- ✅ `ZAPI_INSTANCE_ID`
- ✅ `ZAPI_TOKEN`
- ✅ `ZAPI_BASE_URL` (opcional)
- ✅ `GEMINI_API_KEY`

**⚠️ IMPORTANTE:** Após adicionar as variáveis, o Railway vai fazer **redeploy automático** do seu app.

---

## 🔑 PASSO 2: Criar Chave do Gemini AI

Se você ainda não tem a chave do Gemini:

1. Acesse: https://makersuite.google.com/app/apikey
2. Faça login com sua conta Google
3. Clique em **"Create API Key"**
4. Copie a chave gerada (algo como: `AIzaSy...`)
5. Volte no Railway e atualize a variável `GEMINI_API_KEY` com essa chave

---

## 🗄️ PASSO 3: Executar Migration no Banco

A migration adiciona o campo `whatsapp_number` nas tabelas.

### Opção A: Via Railway Console (Recomendado)

1. No Railway, vá na aba **"Deployments"**
2. Clique no deployment mais recente
3. Vá em **"View Logs"** ou **"Console"**
4. Execute:

```bash
npm run db:migrate-planning
```

### Opção B: Via SQL Direto no Banco

Se tiver acesso ao banco PostgreSQL do Railway:

1. No Railway, vá no serviço do **PostgreSQL**
2. Clique em **"Connect"** ou **"Query"**
3. Execute este SQL:

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

### Opção C: Via Script de Migration Automático

A migration `migration_add_whatsapp_number.sql` será executada automaticamente no próximo deploy se você adicionou ela no `run-migration.ts`.

**Verificar se funcionou:**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('users', 'farm_farmers') 
AND column_name = 'whatsapp_number';
```

---

## 🔗 PASSO 4: Configurar Webhook no Z-API

### 4.1. Descobrir URL do seu app no Railway

1. No Railway, vá no serviço do seu app
2. Vá na aba **"Settings"**
3. Procure por **"Domains"** ou **"Public Domain"**
4. Copie a URL (algo como: `seu-app.railway.app`)

**URL do webhook será:** `https://seu-app.railway.app/api/whatsapp/webhook`

### 4.2. Configurar no Z-API

1. Acesse: https://www.z-api.io/
2. Vá na aba **"Webhooks e configurações gerais"**
3. Clique em **"Configurar agora"** (ou edite se já existir)
4. Configure:
   - **URL do Webhook:** `https://seu-app.railway.app/api/whatsapp/webhook`
   - **Método:** POST
   - **Eventos:** Marque "Mensagens recebidas"
5. Salve

**⚠️ IMPORTANTE:** 
- Certifique-se de que a URL está correta
- O app deve estar rodando no Railway
- Teste a URL antes de configurar (deve retornar 200 OK)

---

## ✅ PASSO 5: Verificar se Está Funcionando

### 5.1. Verificar Logs do Railway

1. No Railway, vá em **"Deployments"**
2. Clique no deployment mais recente
3. Vá em **"View Logs"**
4. Procure por:
   ```
   ✅ WhatsApp routes registered (/api/whatsapp/*)
   ```

Se aparecer:
```
⚠️  WhatsApp not configured (missing ZAPI_INSTANCE_ID, ZAPI_TOKEN, or GEMINI_API_KEY)
```

Verifique se todas as variáveis foram adicionadas corretamente.

### 5.2. Testar Status da Instância

Acesse no navegador:
```
https://seu-app.railway.app/api/whatsapp/status
```

Deve retornar:
```json
{
  "connected": true
}
```

### 5.3. Testar Webhook

1. Envie uma mensagem do WhatsApp para o número conectado no Z-API
2. Verifique os logs do Railway
3. Você deve ver:
   ```
   [WhatsApp] Processando mensagem de: 5511999999999
   [Gemini] Interpretando pergunta: ...
   ```

---

## 👤 PASSO 6: Cadastrar Números dos Clientes

Cada cliente precisa ter seu número cadastrado no banco.

### Formato do Número

**Formato correto:** `5511999999999`
- Código do país (55 para Brasil)
- DDD (11)
- Número (999999999)
- **SEM** o sinal de +
- **SEM** espaços
- **SEM** caracteres especiais

### Cadastrar via SQL

Acesse o banco PostgreSQL do Railway e execute:

```sql
-- Para um agricultor específico
UPDATE farm_farmers 
SET whatsapp_number = '5511999999999' 
WHERE id = 'id_do_agricultor';

-- Para um usuário do sistema
UPDATE users 
SET whatsapp_number = '5511999999999' 
WHERE id = 'id_do_usuario';
```

**Exemplo:**
```sql
-- Cadastrar número do cliente João (substitua pelo ID real)
UPDATE farm_farmers 
SET whatsapp_number = '5511999999999' 
WHERE name ILIKE '%João%';
```

---

## 🧪 PASSO 7: Testar com Cliente Real

1. Certifique-se de que o cliente tem o número cadastrado
2. Peça para ele enviar uma mensagem do WhatsApp
3. Teste perguntas como:
   - "qual meu estoque?"
   - "quanto gastei este mês?"
   - "mostre minhas faturas"

---

## 🐛 TROUBLESHOOTING

### Problema: "WhatsApp not configured" nos logs

**Causa:** Variáveis de ambiente não configuradas ou incorretas.

**Solução:**
1. Verifique se todas as 4 variáveis foram adicionadas no Railway
2. Verifique se os nomes estão exatamente como mostrado (case-sensitive)
3. Verifique se os valores estão corretos (sem espaços extras)
4. Faça um redeploy manual no Railway

### Problema: Webhook não recebe mensagens

**Causa:** URL incorreta ou app não acessível.

**Solução:**
1. Verifique se a URL do webhook está correta no Z-API
2. Teste a URL manualmente: `https://seu-app.railway.app/api/whatsapp/webhook`
3. Verifique se o app está rodando (veja logs)
4. Verifique se o Railway está com o serviço ativo

### Problema: "Usuário não encontrado"

**Causa:** Número não cadastrado ou formato incorreto.

**Solução:**
1. Verifique se o número está cadastrado no banco
2. Verifique o formato (deve ser `5511999999999`)
3. Verifique se o número no WhatsApp é o mesmo cadastrado

---

## 📊 CHECKLIST FINAL

Antes de considerar implementado:

- [ ] Variáveis de ambiente adicionadas no Railway (4 variáveis)
- [ ] Chave do Gemini criada e configurada
- [ ] Migration executada (campo `whatsapp_number` criado)
- [ ] Webhook configurado no Z-API
- [ ] URL do webhook testada e funcionando
- [ ] Pelo menos 1 cliente com número cadastrado
- [ ] Logs mostram "WhatsApp routes registered"
- [ ] Teste de envio funcionando
- [ ] Teste de recebimento funcionando

---

## 🆘 PRECISA DE AJUDA?

Se encontrar problemas:

1. Verifique os logs do Railway
2. Verifique o status da instância Z-API
3. Teste cada componente separadamente
4. Consulte: `WHATSAPP_PASSO_A_PASSO.md` para mais detalhes

---

**Boa sorte! 🚀**
