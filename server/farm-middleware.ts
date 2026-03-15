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
    const role = (req.user as any)?.role;
    if (role !== 'agricultor' && role !== 'administrador') {
        return res.status(403).json({ error: "Acesso restrito a agricultores" });
    }
    next();
}

// Middleware: require PDV session
export function requirePdv(req: Request, res: Response, next: NextFunction) {
    if (!(req.session as any).pdvTerminalId) {
        return res.status(401).json({ error: "PDV authentication required" });
    }
    next();
}

// Middleware: require admin for manuals
export function requireAdminManuals(req: Request, res: Response, next: NextFunction) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ error: "Autenticacao necessaria" });
    }
    const role = (req.user as any)?.role;
    if (role !== 'administrador') {
        return res.status(403).json({ error: "Acesso restrito a administradores" });
    }
    next();
}

// Helper: get farmer ID from request
export function getFarmerId(req: any): string | null {
    const id = (req.user as any)?.id;
    return id ? id.toString() : null;
}
