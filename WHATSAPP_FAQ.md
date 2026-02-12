# ❓ FAQ: Dúvidas sobre WhatsApp + Z-API

## 🤔 Todos os meus clientes vão poder usar o WhatsApp?

### ✅ SIM! Mas com algumas considerações:

**Como funciona:**
1. Cada cliente (agricultor) precisa ter seu número de WhatsApp cadastrado no sistema
2. Quando ele manda mensagem, o sistema identifica pelo número
3. Ele só vê os dados dele (isolamento por `farmerId`)
4. Não consegue ver dados de outros clientes

**Exemplo prático:**
```
Cliente A (João) - Número: 5511999999999
  → Consulta: "qual meu estoque?"
  → Sistema retorna: Estoque do João (apenas)

Cliente B (Maria) - Número: 5511888888888
  → Consulta: "qual meu estoque?"
  → Sistema retorna: Estoque da Maria (apenas)
```

**Segurança:**
- ✅ Autenticação por número de telefone
- ✅ Cada consulta verifica se o número pertence ao usuário
- ✅ Dados isolados por `farmerId` no banco
- ✅ Não há acesso cruzado entre clientes

---

## 💰 Vai custar muito?

### Z-API:
- **Plano Ultimate:** R$ 99,99/mês
- **Mensagens ilimitadas** (sem cobrança por mensagem)
- **Teste grátis:** 2 dias (você já está usando!)

### Gemini AI:
- **Gratuito até:** 15 requisições/minuto
- **Pago:** A partir de $0.00025 por requisição (muito barato)
- Para uso normal, fica dentro do free tier

**Custo estimado mensal:**
- Z-API: R$ 99,99/mês (fixo)
- Gemini: ~R$ 0-10/mês (depende do volume)
- **Total:** ~R$ 100-110/mês

---

## 📱 Quantos clientes podem usar?

**Ilimitado!** 

O Z-API permite mensagens ilimitadas no plano Ultimate. Você pode ter:
- 10 clientes ou 1000 clientes
- Todos usando ao mesmo tempo
- Sem limite de mensagens

**Única limitação:** 
- Cada cliente precisa ter seu número cadastrado
- Cada cliente só vê seus próprios dados

---

## 🔒 É seguro?

### Sim, mas precisa de alguns cuidados:

**Já implementado:**
- ✅ Isolamento de dados por `farmerId`
- ✅ Validação de número de telefone
- ✅ Cada cliente só acessa seus próprios dados

**Recomendado adicionar:**
- ⚠️ Validação de assinatura do webhook (prevenir falsificação)
- ⚠️ Rate limiting (evitar spam)
- ⚠️ Logs de auditoria (registrar quem consultou o quê)

**Dados sensíveis:**
- Preços: Por enquanto, não está implementado consulta de preços
- Se quiser adicionar, precisa garantir que cada cliente só veja seus próprios preços

---

## 📊 O que os clientes podem consultar?

### Atualmente implementado:

1. **Estoque de produtos**
   - "qual meu estoque?"
   - "quais produtos tenho?"

2. **Despesas**
   - "quanto gastei este mês?"
   - "mostre minhas despesas"

3. **Faturas**
   - "mostre minhas faturas"
   - "quais faturas estão pendentes?"

4. **Aplicações**
   - "quais aplicações fiz?"
   - "mostre aplicações recentes"

5. **Propriedades e Talhões**
   - "quais são minhas propriedades?"
   - "mostre meus talhões"

### Não implementado ainda:

- ❌ Consulta de preços
- ❌ Criação de registros (aplicações, despesas)
- ❌ Relatórios complexos
- ❌ Gráficos e estatísticas

**Quer adicionar consulta de preços?** É possível, mas precisa garantir isolamento por cliente.

---

## 🚀 Como começar a usar?

1. **Siga o guia passo a passo:** `WHATSAPP_PASSO_A_PASSO.md`
2. **Configure as variáveis de ambiente** (use os dados da sua imagem)
3. **Execute a migration** do banco de dados
4. **Configure o webhook** no Z-API
5. **Cadastre pelo menos 1 cliente** para testar
6. **Teste enviando uma mensagem** do WhatsApp

---

## 🆘 Precisa de ajuda?

Consulte:
- `WHATSAPP_PASSO_A_PASSO.md` - Guia completo passo a passo
- `WHATSAPP_SETUP.md` - Documentação técnica
- Logs do servidor para debug
