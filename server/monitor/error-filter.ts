import crypto from "crypto";

export type Severity = "critical" | "warning" | "info";

export interface CapturedError {
    id: string;
    hash: string;
    message: string;
    stack: string;
    severity: Severity;
    module: string;
    context: Record<string, unknown>;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
}

// ─── Regras de severidade por padrao ─────────────────────────────────────────
const CRITICAL_PATTERNS = [
    /cannot read propert/i, /database.*error/i, /uncaughtexception/i,
    /connection.*refused/i, /ECONNREFUSED/i, /out of memory/i,
    /segmentation fault/i, /fatal/i,
];
const INFO_PATTERNS = [
    /jwt expired/i, /not found/i, /401/i, /403/i, /ENOENT/i,
    /invalid token/i, /session expired/i,
];

export function classifySeverity(message: string): Severity {
    if (CRITICAL_PATTERNS.some(p => p.test(message))) return "critical";
    if (INFO_PATTERNS.some(p => p.test(message))) return "info";
    return "warning";
}

// ─── Detecta modulo pelo stack trace ─────────────────────────────────────────
export function detectModule(stack: string): string {
    // Tenta pegar o path do arquivo que gerou o erro
    const farmMatch = stack.match(/farm[_-]([a-z]+)/i);
    if (farmMatch) return `farm-${farmMatch[1]}`;
    const srcMatch = stack.match(/server\/([^/.]+)/);
    if (srcMatch) return srcMatch[1];
    const routeMatch = stack.match(/\/api\/([^/]+)/);
    if (routeMatch) return routeMatch[1];
    return "unknown";
}

// ─── Hash para deduplicacao ──────────────────────────────────────────────────
export function hashError(message: string, stack: string): string {
    const normalized = (message + stack.split("\n").slice(0, 3).join(""))
        .replace(/\d+/g, "N")
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "UUID")
        .replace(/"[^"]{36,}"/g, '"..."');
    return crypto.createHash("md5").update(normalized).digest("hex").slice(0, 12);
}

// ─── Cache de deduplicacao (em memoria) ──────────────────────────────────────
const seenErrors = new Map<string, CapturedError>();
const DEDUP_WINDOW_MS = 30 * 60 * 1000; // 30 minutos

export function shouldProcess(hash: string): boolean {
    const existing = seenErrors.get(hash);
    if (!existing) return true;
    return Date.now() - existing.lastSeen.getTime() > DEDUP_WINDOW_MS;
}

export function trackError(error: Omit<CapturedError, "count" | "firstSeen" | "lastSeen">): CapturedError {
    const existing = seenErrors.get(error.hash);
    if (existing) {
        existing.count++;
        existing.lastSeen = new Date();
        return existing;
    }
    const tracked: CapturedError = { ...error, count: 1, firstSeen: new Date(), lastSeen: new Date() };
    seenErrors.set(error.hash, tracked);
    return tracked;
}

// Retorna erros recentes para o bot
export function getRecentErrors(hours: number = 24, severity?: string): CapturedError[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const results: CapturedError[] = [];
    seenErrors.forEach((err) => {
        if (err.lastSeen.getTime() > cutoff) {
            if (!severity || severity === "all" || err.severity === severity) {
                results.push(err);
            }
        }
    });
    return results.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
}

// Limpa erros antigos a cada hora
setInterval(() => {
    const cutoff = Date.now() - DEDUP_WINDOW_MS * 2;
    const toDelete: string[] = [];
    seenErrors.forEach((err, hash) => { if (err.lastSeen.getTime() < cutoff) toDelete.push(hash); });
    toDelete.forEach(h => seenErrors.delete(h));
}, 60 * 60 * 1000);
