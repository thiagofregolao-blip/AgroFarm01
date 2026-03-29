import type { AnalysisResult } from "./batch-analyzer";
import type { CapturedError } from "./error-filter";

const PRIORIDADE_EMOJI: Record<string, string> = { imediata: "🔴", alta: "🟠", media: "🟡", baixa: "🟢" };

// Lazy load Notion client
async function getNotion() {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_ERRORS_DB_ID) {
        console.log(`[monitor] [notion] SKIP — NOTION_TOKEN=${!!process.env.NOTION_TOKEN} NOTION_ERRORS_DB_ID=${!!process.env.NOTION_ERRORS_DB_ID}`);
        return null;
    }
    try {
        const { Client } = await import("@notionhq/client");
        return new Client({ auth: process.env.NOTION_TOKEN });
    } catch (err) {
        console.error("[monitor] [notion] Erro ao carregar client:", err);
        return null;
    }
}

export async function createErrorTask(analysis: AnalysisResult, error: CapturedError): Promise<string | null> {
    console.log(`[monitor] [notion] Tentando criar task para erro: ${error.message.slice(0, 60)}`);
    const notion = await getNotion();
    if (!notion) return null;

    try {
        const emoji = PRIORIDADE_EMOJI[analysis.prioridade] ?? "⚪";
        const title = `${emoji} [${error.severity.toUpperCase()}] ${error.message.slice(0, 80)}`;

        // Propriedades usando nomes em PORTUGUES (conforme schema do banco Notion)
        const properties: Record<string, any> = {
            // Campo titulo: "Nome" (nao "Name")
            "Nome": { title: [{ text: { content: title } }] },
            "Status": { select: { name: analysis.corrigivel ? "Bot corrigiu" : "Aguardando revisao" } },
            "Prioridade": { select: { name: analysis.prioridade || "media" } },
            "Severidade": { select: { name: error.severity || "warning" } },
            "Modulo": { rich_text: [{ text: { content: analysis.modulo || "unknown" } }] },
            "Causa Raiz": { rich_text: [{ text: { content: (analysis.causa || "Analise pendente").slice(0, 2000) } }] },
            "Fix Sugerido": { rich_text: [{ text: { content: (analysis.correcao || "Revisao manual necessaria").slice(0, 2000) } }] },
            "Ocorrencias": { number: error.count || 1 },
        };

        const body = [
            `📍 Modulo: ${analysis.modulo}`,
            `🔁 Ocorrencias: ${error.count}x`,
            `⏱ Primeira vez: ${error.firstSeen.toLocaleString("pt-BR")}`,
            ``, `🧠 Causa raiz:`, analysis.causa,
            ``, `👤 Impacto:`, analysis.impacto,
            ``, `🔧 Correcao ${analysis.corrigivel ? "(bot pode aplicar)" : "(manual)"}:`, analysis.correcao,
        ].join("\n");

        console.log(`[monitor] [notion] Criando page no DB ${process.env.NOTION_ERRORS_DB_ID}...`);

        const page = await notion.pages.create({
            parent: { database_id: process.env.NOTION_ERRORS_DB_ID! },
            properties,
            children: [
                {
                    object: "block", type: "callout",
                    callout: {
                        rich_text: [{ text: { content: body.slice(0, 2000) } }],
                        icon: { emoji: "🤖" as any },
                        color: error.severity === "critical" ? "red_background" : "yellow_background"
                    }
                },
                {
                    object: "block", type: "code",
                    code: {
                        rich_text: [{ text: { content: error.stack.slice(0, 2000) } }],
                        language: "javascript"
                    }
                },
            ] as any,
        });

        console.log(`[monitor] [notion] ✅ Task criada com sucesso: ${(page as any).id}`);
        return (page as any).id;
    } catch (err: any) {
        console.error("[monitor] [notion] ❌ Erro ao criar task:", err?.message || err);
        if (err?.body) console.error("[monitor] [notion] Body:", JSON.stringify(err.body).slice(0, 500));
        return null;
    }
}
