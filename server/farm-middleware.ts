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

// Middleware: require authenticated user with role 'agricultor' or 'administrador'
export function requireFarmer(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Autenticacao necessaria" });
    }
    const role = req.user?.role;
    if (role !== 'agricultor' && role !== 'administrador') {
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

// Helper: get farmer ID from request
export function getFarmerId(req: any): string | null {
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
