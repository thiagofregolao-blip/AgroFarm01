# AgroFarmDigital — Instruções para Claude Code

## Stack do Projeto

- **Backend**: Express.js + Drizzle ORM + PostgreSQL (Railway)
- **Frontend**: React + TanStack Query + Tailwind CSS + shadcn/ui
- **Auth**: Passport.js (sessão)
- **Email**: Mailgun (`mail.agrofarmdigital.com`)
- **Automações**: n8n webhooks

---

## GET-SHIT-DONE — Fluxo de Trabalho

### Princípio central
Evitar context rot — a degradação de qualidade que acontece conforme o contexto se enche. Para cada feature nova ou mudança significativa, seguir as fases:

```
[Analisar] → [Planejar] → [Executar] → [Verificar]
```

### Regras de execução
- **Leia antes de editar.** Nunca propor mudanças em código não lido.
- **Não over-engineer.** Apenas o mínimo necessário. Três linhas similares são melhores que uma abstração prematura.
- **Sem compatibilidade retroativa desnecessária.** Se algo não é usado, delete.
- **Sem error handling especulativo.** Só valide nas fronteiras do sistema (input do usuário, APIs externas).
- **Uma tarefa por vez.** Marcar como concluída antes de começar a próxima.
- **Ações destrutivas** (delete em produção, force push, reset --hard): confirmar com o usuário antes.
- **Commits**: nunca com `--no-verify`. Criar commits novos, nunca amend sem instrução explícita.

### Migrations de banco
Sempre usar `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` inline em `server/index.ts`.
Nunca usar Drizzle `.set()` com `as any` para campos novos — usar `db.execute(sql\`...\`)` com SQL raw.

### Isolamento por papel (RTV)
- `GET /api/company/clients` filtra por `assignedConsultantId` quando `role === 'rtv'`
- `GET /api/company/orders` filtra por `consultantId` quando `role === 'rtv'`
- Diretor, financeiro, faturista e admin_empresa veem tudo da empresa

---

## UI-UX-PRO-MAX — Padrões de Interface

### Prioridades (ordem obrigatória)

| Prioridade | Categoria | Impacto |
|---|---|---|
| 1 | Acessibilidade | CRÍTICO |
| 2 | Toque & Interação | CRÍTICO |
| 3 | Performance | ALTO |
| 4 | Layout & Responsivo | ALTO |
| 5 | Tipografia & Cor | MÉDIO |
| 6 | Animação | MÉDIO |
| 7 | Seleção de Estilo | MÉDIO |

### Acessibilidade (CRÍTICO)
- Contraste mínimo 4.5:1 para texto normal
- Focus rings visíveis em todos elementos interativos
- `aria-label` em botões só com ícone
- Ordem do Tab deve seguir a visual
- `<label>` com atributo `for` em todos os formulários

### Toque & Interação (CRÍTICO)
- Touch targets mínimo **44×44px**
- Botões desabilitados durante operações async (`isPending`)
- Mensagens de erro próximas ao problema, nunca só no console
- `cursor-pointer` em todos elementos clicáveis

### Layout & Responsivo (ALTO)
- Fonte mínima **16px** no corpo em mobile
- Sem scroll horizontal
- Escala de z-index definida: 10, 20, 30, 50

### Tipografia & Cor (MÉDIO)
- `line-height: 1.5–1.75` para texto corrido
- Máximo **65–75 caracteres** por linha
- Usar ícones SVG (lucide-react), nunca emojis como ícones

### Animação (MÉDIO)
- Micro-interações: **150–300ms**
- Usar `transform`/`opacity`, nunca `width`/`height` para animar
- Skeleton screens ou spinners em carregamento

### Estilo do Projeto
- **Identidade visual**: azul (`#1a56db`) como cor primária
- **Estilo**: minimalismo moderno com cards limpos, bordas suaves
- **Componentes**: shadcn/ui como base — não reinventar o que já existe
- **Consistência**: mesmo padrão visual em todas as telas da empresa

---

## Arquitetura Comercial

### Roles
- **Platform** (`users.role`): `rtv`, `administrador`, `consultor`
- **Company** (`company_users.role`): `rtv`, `director`, `faturista`, `financeiro`, `admin_empresa`

### Fluxo de pedidos
```
draft → pending_director → pending_billing → billed
                       ↘ pending_finance ↗
                       ↘ cancelled
```

### Reserva de estoque
- `reserved_quantity` em `company_stock`
- `reserveStockForOrder()` ao submeter
- `releaseStockReservation()` ao cancelar/rejeitar
- `deductStockFromInvoice()` ao faturar (também libera reserva)

### Email ao faturista
- Diretor cadastra email do faturista em **Meu Perfil**
- Ao aprovar pedido: gera PDF via **pdfkit** e envia via **Mailgun**
- Se email não cadastrado: bloqueia aprovação com mensagem clara
- Campos salvos em `company_users`: `faturista_email`, `email_body_template`

---

## Conexões Externas
- **n8n**: webhooks em `/api/farm/webhook/n8n/` para automações de estoque e notificações
  - Autenticação: aceita `x-webhook-secret` como header HTTP **ou** query param (`?x-webhook-secret=xxx`)
- **Mailgun**: domínio `mail.agrofarmdigital.com`, variável `MAILGUN_API_KEY`
- **Railway**: deploy automático via push para `main`
- **Obsidian/MCP**: dados sobre rede Mikrotik e Solar

---

## Módulos da Fazenda

### Funcionários (farm_employees)
- **Tabela**: `farm_employees` (id, farmer_id, name, role, phone, photo_base64, signature_base64, face_embedding)
- **Tela**: `client/src/pages/fazenda/employees.tsx`
- **CRUD** via `GET/POST/PUT/DELETE /api/pdv/employees`
- Integrado ao módulo diesel: nome e foto registrados no abastecimento

### Reconhecimento Facial (PDV/Diesel)
- **Lib**: `face-api.js` com modelo FaceNet — 128-dim embeddings, threshold euclidiano 0.6
- Roda inteiramente **no browser** — sem chamada a API externa
- Modelos em `client/public/models/` (tiny_face_detector + face_landmark_68_tiny + face_recognition)
- **Helper**: `client/src/lib/face-recognition.ts`
- **Endpoint**: `GET /api/pdv/employee-embeddings` — retorna embeddings de todos os funcionários
- Cache no `localStorage` para uso **offline** na bomba diesel
- Campos adicionados: `farm_employees.face_embedding`, `farm_applications.employee_name`, `farm_applications.photo_base64`
- Se reconhecido: usa assinatura pré-cadastrada automaticamente (sem canvas manual)

### Comprovante de Abastecimento Diesel
- Modal com canvas de assinatura digital (suporte a caneta stylus)
- Exibe: data, veículo, quantidade, km/horímetro, observações, nome do funcionário
- **Endpoint**: `GET /api/pdv/receipt/:id` — retorna dados completos + assinatura

### Parser Unificado de Faturas (Gemini Vision)
- **Arquivo**: `server/gemini-invoice-parser.ts`
- **Função**: `parseWithGemini(fileBuffer, mimeType)` → dados estruturados da fatura
- Usado por: upload manual (`/api/farm/invoices`) **e** webhook WhatsApp n8n
- Extrai: número, data, fornecedor, RUC, telefone, email, endereço, itens, totais, vencimento
- Ao criar fornecedor: auto-preenche todos os campos disponíveis no recibo

### Bot WhatsApp — Consultas por Categoria
- **Regra de categoria é PRIORIDADE 1** no prompt Gemini — antes da regra de recomendação agronômica
- "quais fungicidas tenho?" → `type:"query"`, `entity:"stock"`, `filters:{category:"fungicida"}`
- **Fallback hardcoded**: detecta fungicida/herbicida/inseticida/fertilizante/semente/adjuvante mesmo sem Gemini
- Preços: exibe `averageCost` quando não há fatura (label "Custo Médio cadastrado")
- **Extração de PDFs**: usa `pdf-parse` localmente — sem limite de tokens (Gemini truncava PDFs grandes)
- `requireAdminManuals`: aceita `role === 'admin_agricultor'` **e** `'administrador'`
- Arquivo do cliente: `server/whatsapp/gemini-client.ts`

### Menu Fazenda — Estrutura atualizada
- **"Cadastros"** (submenu novo no menu financeiro): contém **"Empresas e Pessoas"** (antigo Fornecedores)
- Arquivo: `client/src/components/fazenda/layout.tsx`
