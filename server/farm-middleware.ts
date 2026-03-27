/**
 * Farm Middleware & Shared Utilities
 * Used by all farm route modules
 */
import { Request, Response, NextFunction } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import multer from "multer";

const scryptAsync = promisify(scrypt);

export const upload = multer({ storage: multer.memoryStorage() });

export async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
    const [hashed, salt] = stored.split(".");
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Cache for employee -> farmer_id lookups (populated on first request)
const employeeFarmerCache = new Map<string, string>();

/**
 * For funcionario_fazenda users, look up their farmer_id from farm_employees.
 * Returns the farmer_id that owns this employee, or null.
 */
export async function getEffectiveFarmerId(req: Request): Promise<string | null> {
    const user = req.user;
    if (!user) return null;

    if (user.role === 'funcionario_fazenda') {
        // Check cache first
        const cached = employeeFarmerCache.get(user.id);
        if (cached) return cached;

        const { db } = await import("./db");
        const { farmEmployees } = await import("../shared/schema");
        const { eq } = await import("drizzle-orm");

        const [emp] = await db.select({ farmerId: farmEmployees.farmerId })
            .from(farmEmployees)
            .where(eq(farmEmployees.userId, user.id))
            .limit(1);

        if (emp) {
            employeeFarmerCache.set(user.id, emp.farmerId);
            return emp.farmerId;
        }
        return null;
    }

    return user.id;
}

// Middleware: require authenticated user with role 'agricultor', 'administrador', or 'funcionario_fazenda'
export function requireFarmer(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Autenticacao necessaria" });
    }
    const role = req.user?.role;
    if (role !== 'agricultor' && role !== 'administrador' && role !== 'admin_agricultor' && role !== 'funcionario_fazenda') {
        return res.status(403).json({ error: "Acesso restrito a agricultores" });
    }
    next();
}

// Middleware: require PDV session
export function requirePdv(req: Request, res: Response, next: NextFunction) {
    if (!req.session.pdvTerminalId) {
        return res.status(401).json({ error: "PDV authentication required" });
    }
    next();
}

// Middleware: require admin for manuals
export function requireAdminManuals(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Autenticacao necessaria" });
    }
    const role = req.user?.role;
    if (role !== 'administrador' && role !== 'admin_agricultor') {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
    }
    next();
}

// Helper: get farmer ID from request (uses effective farmer ID for funcionario_fazenda)
export function getFarmerId(req: any): string | null {
    // For sync contexts where the caller hasn't resolved the effective farmer ID yet,
    // use the user's own ID. Callers should prefer getEffectiveFarmerId() for async contexts.
    const id = req.user?.id;
    return id ? id.toString() : null;
}

// Helper: parse date string safely, avoiding UTC midnight timezone shift
// "2026-03-15" -> new Date("2026-03-15T12:00:00") to stay on the correct day in any timezone
export function parseLocalDate(value: string | Date | null | undefined): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    const s = String(value);
    if (s.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return new Date(s + "T12:00:00");
    }
    return new Date(s);
}
