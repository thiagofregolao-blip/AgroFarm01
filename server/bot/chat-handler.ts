import type { Request, Response } from "express";
import { getRecentErrors } from "../monitor/error-filter";
import { db } from "../db";
import { sql } from "drizzle-orm";

// Sessoes em memoria (usar Redis em producao)
const sessions = new Map<string, { mode: "user" | "agent"; history: Array<{ role: string; content: string }> }>();

// Roles que ativam modo agente automaticamente
const AGENT_ROLES = ["administrador", "admin_agricultor", "agricultor"];

// ─── Tools disponiveis no modo agente ────────────────────────────────────────
const AGENT_TOOLS = [
    {
        name: "consultar_banco",
        description: "Executa query SELECT no PostgreSQL do AgroFarm. Apenas leitura.",
        input_schema: { type: "object" as const, properties: { query: { type: "string", description: "Query SQL SELECT" } }, required: ["query"] },
    },
    {
        name: "listar_erros_recentes",
        description: "Lista erros monitorados nas ultimas horas.",
        input_schema: { type: "object" as const, properties: { horas: { type: "number" }, severity: { type: "string", enum: ["critical", "warning", "info", "all"] } }, required: [] },
    },
    {
        name: "resumo_sistema",
        description: "Retorna metricas do AgroFarm: estoque, faturas pendentes, aplicacoes, romaneios.",
        input_schema: { type: "object" as const, properties: {}, required: [] },
    },
];

// ─── Executa tools ───────────────────────────────────────────────────────────
async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
        case "consultar_banco": {
            const query = input.query as string;
            if (!/^\s*SELECT/i.test(query)) return "Erro: apenas queries SELECT sao permitidas.";
            try {
                const result = await db.execute(sql.raw(query));
                const rows = (result as any).rows ?? result;
                return JSON.stringify({ rows: Array.isArray(rows) ? rows.slice(0, 20) : [], total: Array.isArray(rows) ? rows.length : 0 });
            } catch (err: any) { return `Erro na query: ${err.message}`; }
        }
        case "listar_erros_recentes": {
            const horas = (input.horas as number) || 24;
            const severity = (input.severity as string) || "all";
            const errors = getRecentErrors(horas, severity);
            return JSON.stringify(errors.slice(0, 10).map(e => ({
                id: e.id, message: e.message.slice(0, 100), severity: e.severity,
                module: e.module, count: e.count, lastSeen: e.lastSeen,
            })));
        }
        case "resumo_sistema": {
            try {
                const [stockCount] = (await db.execute(sql`SELECT COUNT(*) as c FROM farm_stock WHERE CAST(quantity AS numeric) > 0`)).rows as any[];
                const [invoicesPending] = (await db.execute(sql`SELECT COUNT(*) as c FROM farm_invoices WHERE status = 'pending'`)).rows as any[];
                const [appsCount] = (await db.execute(sql`SELECT COUNT(*) as c FROM farm_applications`)).rows as any[];
                const errors = getRecentErrors(24, "all");
                return JSON.stringify({
                    estoque_itens: parseInt(stockCount?.c || 0),
                    faturas_pendentes: parseInt(invoicesPending?.c || 0),
                    aplicacoes_total: parseInt(appsCount?.c || 0),
                    erros_24h: errors.length,
                    erros_criticos: errors.filter(e => e.severity === "critical").length,
                });
            } catch (err: any) { return `Erro ao buscar metricas: ${err.message}`; }
        }
        default: return "Ferramenta nao encontrada.";
    }
}

// ─── System prompts ──────────────────────────────────────────────────────────
const AGENT_SYSTEM = `Voce e o assistente agente do AgroFarm Digital (agronegocio, Paraguai/Brasil).
Stack: Express/TypeScript, PostgreSQL, Drizzle ORM, Mailgun, n8n webhooks.
Modulos: estoque, faturas, romaneios, talhoes, aplicacoes, contas a pagar/receber, PDV diesel, safras.
Voce esta em modo AGENTE com ferramentas. Use-as quando necessario.
Seja tecnico, direto e objetivo. Responda em portugues.`;

const USER_SYSTEM = `Voce e o assistente do AgroFarm Digital para usuarios finais (agricultores).
Seu UNICO papel e ajudar com duvidas sobre COMO USAR o sistema:
- Como cadastrar propriedades e talhoes
- Como consultar estoque de insumos
- Como importar faturas
- Como registrar romaneios e safras
- Como usar o PDV (saida de produtos e diesel)
- Como ver custos por talhao
- Como usar o fluxo de caixa e contas a pagar

REGRAS OBRIGATORIAS:
- NUNCA fale sobre codigo, programacao, banco de dados, APIs, servidor, TypeScript, React, Express ou qualquer aspecto tecnico do sistema.
- NUNCA revele informacoes sobre a arquitetura, stack tecnologico ou como o sistema foi construido.
- NUNCA execute consultas no banco de dados ou acesse dados internos.
- Se perguntarem sobre codigo ou tecnologia, responda: "Sou o assistente de uso do AgroFarm. Para questoes tecnicas, entre em contato com o suporte tecnico."
- Se nao souber a resposta sobre o uso do sistema, diga: "Vou encaminhar sua duvida ao suporte tecnico."
- Seja amigavel, use linguagem simples e direta.
- Responda SEMPRE em portugues.
- Respostas curtas e objetivas (maximo 3 paragrafos).`;

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function botChatHandler(req: Request, res: Response) {
    const { message, sessionId } = req.body as { message: string; sessionId: string };
    if (!message || !sessionId) return res.status(400).json({ error: "message e sessionId obrigatorios" });

    // Auth — verifica role do usuario logado
    const userRole = (req as any).user?.role || "user";
    const userName = (req as any).user?.name || "Usuario";

    // Inicializa sessao
    if (!sessions.has(sessionId)) {
        const isAgent = AGENT_ROLES.includes(userRole);
        sessions.set(sessionId, { mode: isAgent ? "agent" : "user", history: [] });
    }
    const session = sessions.get(sessionId)!;

    // Comandos especiais
    if (message.trim() === "/agente" && AGENT_ROLES.includes(userRole)) {
        session.mode = "agent";
        return res.json({ reply: "🤖 Modo agente ativado. Tenho acesso ao banco e ferramentas. Como posso ajudar?", mode: "agent" });
    }
    if (message.trim() === "/usuario") {
        session.mode = "user";
        return res.json({ reply: "👤 Modo usuario. Posso ajudar com duvidas sobre o sistema.", mode: "user" });
    }

    session.history.push({ role: "user", content: message });

    // Verifica se tem API key
    if (!process.env.ANTHROPIC_API_KEY) {
        const fallback = session.mode === "agent"
            ? "⚠️ ANTHROPIC_API_KEY nao configurada. Configure no Railway para ativar o bot com IA."
            : "Ola! Sou o assistente do AgroFarm. No momento estou em modo offline. Para duvidas, entre em contato com o suporte.";
        session.history.push({ role: "assistant", content: fallback });
        return res.json({ reply: fallback, mode: session.mode });
    }

    try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const messages = session.history.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
        const systemPrompt = session.mode === "agent" ? AGENT_SYSTEM : USER_SYSTEM;

        let response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 800,
            system: systemPrompt,
            tools: session.mode === "agent" ? AGENT_TOOLS as any : [],
            messages,
        });

        // Agentic loop — executa tools
        let loops = 0;
        while (response.stop_reason === "tool_use" && loops < 5) {
            loops++;
            const toolBlocks = response.content.filter(b => b.type === "tool_use");
            const toolResults = await Promise.all(
                toolBlocks.map(async (block) => {
                    if (block.type !== "tool_use") return null as any;
                    const result = await executeTool(block.name, block.input as Record<string, unknown>);
                    return { type: "tool_result" as const, tool_use_id: block.id, content: result };
                })
            );

            // Formato correto: assistant content = array de blocks, user content = array de tool_results
            messages.push({ role: "assistant", content: response.content as any });
            messages.push({ role: "user", content: toolResults as any });

            response = await client.messages.create({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 800,
                system: systemPrompt,
                tools: AGENT_TOOLS as any,
                messages,
            });
        }

        const replyText = response.content.filter(b => b.type === "text").map(b => b.type === "text" ? b.text : "").join("");
        session.history.push({ role: "assistant", content: replyText });

        // Limita historico
        if (session.history.length > 20) session.history.splice(0, 2);

        res.json({ reply: replyText, mode: session.mode });
    } catch (err: any) {
        console.error("[bot] erro:", err);
        const errMsg = err?.error?.error?.message || err?.message || "Erro desconhecido";
        // Mensagem amigavel pro usuario
        let userMsg = "Desculpe, tive um problema tecnico. Tente novamente.";
        if (errMsg.includes("credit balance")) userMsg = "⚠️ Creditos da API esgotados. Recarregue em console.anthropic.com/settings/billing";
        else if (errMsg.includes("rate limit")) userMsg = "⏳ Muitas requisicoes. Aguarde alguns segundos e tente novamente.";
        else if (errMsg.includes("overloaded")) userMsg = "🔄 Servidor da IA sobrecarregado. Tente em 30 segundos.";
        session.history.push({ role: "assistant", content: userMsg });
        res.json({ reply: userMsg, mode: session.mode });
    }
}
