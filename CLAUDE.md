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
- **Mailgun**: domínio `mail.agrofarmdigital.com`, variável `MAILGUN_API_KEY`
- **Railway**: deploy automático via push para `main`
- **Obsidian/MCP**: dados sobre rede Mikrotik e Solar
