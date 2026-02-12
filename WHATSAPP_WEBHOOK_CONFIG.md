# 🔗 Configuração do Webhook Z-API - Passo a Passo

## 📍 PASSO 1: Descobrir URL do seu App no Railway

### Opção A: Via Settings do Railway

1. Acesse: https://railway.app/
2. Selecione seu projeto
3. Clique no serviço (service) do seu app
4. Vá na aba **"Settings"**
5. Procure por **"Domains"** ou **"Public Domain"**
6. Copie a URL (algo como: `seu-app.railway.app` ou `seu-app.up.railway.app`)

### Opção B: Via Deployments

1. No Railway, vá em **"Deployments"**
2. Clique no deployment mais recente
3. Procure por **"Public URL"** ou **"Domain"**
4. Copie a URL

### Opção C: Verificar nos Logs

1. No Railway, vá em **"Deployments"**
2. Clique em **"View Logs"**
3. Procure por mensagens como: `serving on port...` ou `listening on...`
4. A URL geralmente aparece nos logs

**Exemplo de URLs:**
- `agrofarm-production.up.railway.app`
- `agrofarm-12345.up.railway.app`
- `seu-app.railway.app`

---

## 🔧 PASSO 2: Configurar Webhook no Z-API

### Campo Principal: "Ao receber"

Este é o campo mais importante! É aqui que você configura para receber mensagens.

1. No campo **"Ao receber"** (com ícone «), cole:
   ```
   https://SUA-URL-DO-RAILWAY/api/whatsapp/webhook
   ```

   **Exemplo:**
   ```
   https://agrofarm-production.up.railway.app/api/whatsapp/webhook
   ```

### Campos Opcionais (pode deixar vazio por enquanto)

- **"Ao enviar"**: Deixe vazio (não é necessário agora)
- **"Ao desconectar"**: Deixe vazio
- **"Presença do chat"**: Deixe vazio
- **"Receber status da mensagem"**: Deixe vazio
- **"Ao conectar"**: Deixe vazio

### Toggles (pode deixar desabilitado)

- **"Notificar as enviadas por mim também"**: Deixe desabilitado (OFF)
- **"Rejeitar chamadas automático"**: Deixe desabilitado (OFF)
- **"Ler mensagens automático"**: Deixe desabilitado (OFF)
- **"Ler status automaticamente"**: Deixe desabilitado (OFF)
- **"Desabilitar enfileiramento quando whatsapp estiver desconectado"**: Deixe desabilitado (OFF)

### Salvar

1. Clique no botão verde **"Salvar"** no final da página
2. Aguarde a confirmação de sucesso

---

## ✅ PASSO 3: Verificar se Funcionou

### Teste 1: Verificar URL

Abra no navegador (substitua pela sua URL):
```
https://sua-url.railway.app/api/whatsapp/webhook
```

**O que deve acontecer:**
- Se retornar erro 404 ou 405: Normal (o endpoint só aceita POST)
- Se retornar erro 500: Verifique os logs do Railway
- Se retornar qualquer coisa: A URL está acessível ✅

### Teste 2: Verificar Logs do Railway

1. No Railway, vá em **"Deployments"**
2. Clique em **"View Logs"**
3. Procure por:
   ```
   ✅ WhatsApp routes registered (/api/whatsapp/*)
   ```

Se aparecer isso, o webhook está configurado corretamente!

### Teste 3: Enviar Mensagem de Teste

1. Envie uma mensagem do WhatsApp para o número conectado no Z-API
2. Verifique os logs do Railway
3. Você deve ver:
   ```
   [WhatsApp] Processando mensagem de: 5511999999999
   ```

---

## 🐛 Problemas Comuns

### Problema: URL não funciona

**Solução:**
1. Verifique se a URL está correta (sem espaços, sem caracteres especiais)
2. Verifique se o app está rodando no Railway
3. Teste a URL manualmente no navegador

### Problema: Webhook não recebe mensagens

**Solução:**
1. Verifique se salvou as configurações no Z-API
2. Verifique se a URL está correta
3. Verifique os logs do Railway para erros
4. Teste enviando uma mensagem e veja se aparece nos logs

### Problema: Erro 500 no webhook

**Solução:**
1. Verifique se todas as variáveis de ambiente estão configuradas
2. Verifique os logs do Railway para ver o erro específico
3. Verifique se a migration foi executada

---

## 📝 Checklist

Antes de prosseguir, verifique:

- [ ] URL do Railway descoberta
- [ ] Campo "Ao receber" preenchido com a URL correta
- [ ] Botão "Salvar" clicado
- [ ] Confirmação de sucesso recebida
- [ ] Logs do Railway mostram "WhatsApp routes registered"
- [ ] URL testada e acessível

---

**Próximo passo:** Cadastrar números dos clientes e testar! 🚀
