import type { Request, Response, NextFunction } from "express";
import { classifySeverity, detectModule, hashError, shouldProcess, trackError } from "./error-filter";
import { enqueueBatch } from "./batch-analyzer";
import { createErrorTask } from "./notion-task";
import type { AnalysisResult } from "./batch-analyzer";
import type { CapturedError } from "./error-filter";
import crypto from "crypto";

// Liga listener de analises concluidas → cria task no Notion (TODOS os erros vao pro Notion)
process.on("monitor:analyzed" as any, async (result: AnalysisResult, error: CapturedError) => {
    // Envia TODOS os erros pro Notion para facilitar debug durante testes
    await createErrorTask(result, error);
    console.log(JSON.stringify({
        level: "monitor", errorId: error.id, severity: error.severity,
        module: result.modulo, prioridade: result.prioridade,
        corrigivel: result.corrigivel, ocorrencias: error.count,
        ts: new Date().toISOString(),
    }));
});

// ─── Middleware Express (colocar DEPOIS de todas as rotas) ────────────────────
export function monitorMiddleware() {
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
        try {
            const message = err.message || "Unknown error";
            const stack = err.stack || "";
            const severity = classifySeverity(message);
            const hash = hashError(message, stack);
            const mod = detectModule(stack);

            const tracked = trackError({
                id: crypto.randomUUID(), hash, message, stack, severity, module: mod,
                context: {
                    method: req.method, path: req.path,
                    userId: (req as any).user?.id,
                    body: sanitizeBody(req.body),
                },
            });

            // Sempre processa o primeiro erro de cada hash, ou erros de teste
            const isTest = message.includes("[TEST]");
            if (!shouldProcess(hash) && !isTest && tracked.count > 1) {
                console.log(`[monitor] [dedup] ${message.slice(0, 60)} (${tracked.count}x)`);
            } else {
                console.log(`[monitor] [processing] ${message.slice(0, 60)} severity=${severity} module=${mod}`);
                enqueueBatch(tracked);
            }
        } catch (monitorErr) {
            console.error("[monitor] erro interno:", monitorErr);
        }
        next(err);
    };
}

// ─── Captura erros globais Node.js ───────────────────────────────────────────
export function setupGlobalHandlers() {
    process.on("uncaughtException", (err) => {
        const hash = hashError(err.message, err.stack || "");
        const tracked = trackError({
            id: crypto.randomUUID(), hash, message: err.message, stack: err.stack || "",
            severity: "critical", module: detectModule(err.stack || ""),
            context: { type: "uncaughtException" },
        });
        enqueueBatch(tracked);
        console.error("[monitor] [uncaughtException]", err);
    });

    process.on("unhandledRejection", (reason) => {
        const message = reason instanceof Error ? reason.message : String(reason);
        const stack = reason instanceof Error ? reason.stack || "" : "";
        const hash = hashError(message, stack);
        const tracked = trackError({
            id: crypto.randomUUID(), hash, message, stack,
            severity: "warning", module: detectModule(stack),
            context: { type: "unhandledRejection" },
        });
        enqueueBatch(tracked);
        console.error("[monitor] [unhandledRejection]", reason);
    });

    console.log("[monitor] ✅ Global error handlers registrados");
}

function sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== "object") return {};
    const safe = { ...(body as Record<string, unknown>) };
    ["senha", "password", "token", "cpf", "rg", "cartao", "card", "apiKey"].forEach(k => { if (k in safe) safe[k] = "[REDACTED]"; });
    return safe;
}
