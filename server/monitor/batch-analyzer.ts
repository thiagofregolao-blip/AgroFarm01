import type { CapturedError } from "./error-filter";

export interface AnalysisResult {
    errorId: string;
    causa: string;
    modulo: string;
    corrigivel: boolean;
    correcao: string;
    codigo: string | null;
    prioridade: "imediata" | "alta" | "media" | "baixa";
    impacto: string;
}

// ─── Fila de batch ──────────────────────────────────────────────────────────
const batchQueue: CapturedError[] = [];
let batchTimer: NodeJS.Timeout | null = null;
const BATCH_WINDOW_MS = 2 * 60 * 1000;
const BATCH_MAX_SIZE = 8;

export function enqueueBatch(error: CapturedError): void {
    if (error.severity === "critical") {
        analyzeSingle(error).catch(console.error);
        return;
    }
    if (error.severity === "info") {
        console.log(`[monitor] [info] ${error.message.slice(0, 80)} (sem analise IA)`);
        return;
    }
    batchQueue.push(error);
    if (batchQueue.length >= BATCH_MAX_SIZE) { flushBatch(); return; }
    if (!batchTimer) batchTimer = setTimeout(flushBatch, BATCH_WINDOW_MS);
}

function flushBatch(): void {
    if (batchTimer) { clearTimeout(batchTimer); batchTimer = null; }
    if (batchQueue.length === 0) return;
    const batch = batchQueue.splice(0);
    analyzeInBatch(batch).catch(console.error);
}

// ─── Lazy load Anthropic SDK (so carrega se a key existir) ───────────────────
async function getClient() {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    try {
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } catch { return null; }
}

const SYSTEM_PROMPT = `Voce e o bot de monitoramento do AgroFarm Digital (agronegocio, Paraguai/Brasil).
Stack: Node.js, Express, TypeScript, PostgreSQL, Drizzle ORM, Mailgun, n8n webhooks.
Modulos: estoque, faturas, romaneios, talhoes, aplicacoes, contas a pagar/receber, PDV diesel.
Responda SOMENTE com JSON valido, sem markdown, sem texto extra.
Seja objetivo. Maximo 2 frases por campo.`;

// ─── Analise unica (criticos) ────────────────────────────────────────────────
async function analyzeSingle(error: CapturedError): Promise<AnalysisResult> {
    console.log(`[monitor] [critical] analisando: ${error.message.slice(0, 60)}`);
    const client = await getClient();
    if (!client) {
        const fallback = buildFallbackAnalysis(error);
        process.emit("monitor:analyzed" as any, fallback, error);
        return fallback;
    }
    try {
        const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 600,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildSinglePrompt(error) }],
        });
        const result = parseAnalysis(error.id, response.content[0].type === "text" ? response.content[0].text : "");
        process.emit("monitor:analyzed" as any, result, error);
        return result;
    } catch (err) {
        console.error("[monitor] erro na analise:", err);
        const fallback = buildFallbackAnalysis(error);
        process.emit("monitor:analyzed" as any, fallback, error);
        return fallback;
    }
}

// ─── Analise em lote (warnings) ──────────────────────────────────────────────
async function analyzeInBatch(errors: CapturedError[]): Promise<AnalysisResult[]> {
    console.log(`[monitor] [batch] analisando ${errors.length} erros`);
    const client = await getClient();
    if (!client) {
        return errors.map(e => {
            const f = buildFallbackAnalysis(e);
            process.emit("monitor:analyzed" as any, f, e);
            return f;
        });
    }
    try {
        const response = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1200,
            system: SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildBatchPrompt(errors) }],
        });
        const text = response.content[0].type === "text" ? response.content[0].text : "[]";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return [];
        const results: AnalysisResult[] = JSON.parse(jsonMatch[0]);
        results.forEach((result, i) => { if (errors[i]) process.emit("monitor:analyzed" as any, result, errors[i]); });
        return results;
    } catch (err) {
        console.error("[monitor] erro no batch:", err);
        return [];
    }
}

function buildFallbackAnalysis(error: CapturedError): AnalysisResult {
    return {
        errorId: error.id, causa: error.message.slice(0, 100), modulo: error.module,
        corrigivel: false, correcao: "Revisao manual necessaria — API key nao configurada.",
        codigo: null, prioridade: error.severity === "critical" ? "imediata" : "media",
        impacto: "Indeterminado sem analise IA.",
    };
}

function buildSinglePrompt(error: CapturedError): string {
    return `Analise este erro critico. Responda com JSON:
{"errorId":"${error.id}","causa":"...","modulo":"...","corrigivel":true/false,"correcao":"...","codigo":"... ou null","prioridade":"imediata|alta|media|baixa","impacto":"..."}

Erro: ${error.message}
Stack: ${error.stack.split("\n").slice(0, 5).join("\n")}
Modulo: ${error.module} | Ocorrencias: ${error.count}x
Contexto: ${JSON.stringify(error.context).slice(0, 300)}`;
}

function buildBatchPrompt(errors: CapturedError[]): string {
    const list = errors.map((e, i) => `${i + 1}. [${e.id}] ${e.message}\n   Stack: ${e.stack.split("\n")[0]}\n   Modulo: ${e.module} | ${e.count}x`).join("\n\n");
    return `Analise estes ${errors.length} erros. Responda com array JSON:
[{"errorId":"...","causa":"...","modulo":"...","corrigivel":true/false,"correcao":"...","codigo":null,"prioridade":"alta|media|baixa","impacto":"..."}]

Erros:\n${list}`;
}

function parseAnalysis(errorId: string, text: string): AnalysisResult {
    try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { return { errorId, causa: "Nao foi possivel analisar.", modulo: "unknown", corrigivel: false, correcao: "Revisao manual.", codigo: null, prioridade: "media", impacto: "Indeterminado." }; }
}
