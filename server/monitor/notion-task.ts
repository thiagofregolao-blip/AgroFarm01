import type { AnalysisResult } from "./batch-analyzer";
import type { CapturedError } from "./error-filter";

const PRIORIDADE_EMOJI: Record<string, string> = { imediata: "🔴", alta: "🟠", media: "🟡", baixa: "🟢" };

// Lazy load Notion client
async function getNotion() {
    if (!process.env.NOTION_TOKEN || !process.env.NOTION_ERRORS_DB_ID) return null;
    try {
        const { Client } = await import("@notionhq/client");
        return new Client({ auth: process.env.NOTION_TOKEN });
    } catch { return null; }
}

export async function createErrorTask(analysis: AnalysisResult, error: CapturedError): Promise<string | null> {
    const notion = await getNotion();
    if (!notion) {
        console.log(`[monitor] [notion] SKIP — token/db nao configurado. Erro: ${error.message.slice(0, 60)}`);
        return null;
    }
    try {
        const emoji = PRIORIDADE_EMOJI[analysis.prioridade] ?? "⚪";
        const title = `${emoji} [${error.severity.toUpperCase()}] ${error.message.slice(0, 80)}`;
        const body = [
            `📍 Modulo: ${analysis.modulo}`,
            `🔁 Ocorrencias: ${error.count}x`,
            `⏱ Primeira vez: ${error.firstSeen.toLocaleString("pt-BR")}`,
            ``, `🧠 Causa raiz:`, analysis.causa,
            ``, `👤 Impacto:`, analysis.impacto,
            ``, `🔧 Correcao ${analysis.corrigivel ? "(bot pode aplicar)" : "(manual)"}:`, analysis.correcao,
        ].join("\n");

        const page = await notion.pages.create({
            parent: { database_id: process.env.NOTION_ERRORS_DB_ID! },
            properties: {
                Name: { title: [{ text: { content: title } }] },
                Status: { select: { name: analysis.corrigivel ? "Bot corrigiu" : "Aguardando revisao" } },
                Prioridade: { select: { name: analysis.prioridade } },
            } as any,
            children: [
                { object: "block", type: "callout", callout: { rich_text: [{ text: { content: body } }], icon: { emoji: "🤖" as any }, color: error.severity === "critical" ? "red_background" : "yellow_background" } },
                { object: "block", type: "code", code: { rich_text: [{ text: { content: error.stack.slice(0, 2000) } }], language: "javascript" } },
                ...(analysis.codigo ? [{ object: "block" as const, type: "code" as const, code: { rich_text: [{ text: { content: `// Fix sugerido\n${analysis.codigo}` } }], language: "typescript" as const } }] : []),
            ] as any,
        });
        console.log(`[monitor] [notion] task criada: ${(page as any).id}`);
        return (page as any).id;
    } catch (err) {
        console.error("[monitor] [notion] erro:", err);
        return null;
    }
}
