import { db } from "../db";
import { sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export async function logActivity(params: {
    farmerId: string;
    userId: string;
    userName?: string;
    action: string;      // 'create' | 'update' | 'delete' | 'confirm' | 'login' | 'enable' | 'disable' | etc.
    entity: string;      // 'invoice' | 'stock' | 'expense' | 'employee' | 'equipment' | 'cash' | etc.
    entityId?: string;
    details?: Record<string, any>;
    ipAddress?: string;
}) {
    try {
        await db.execute(sql`
            INSERT INTO farm_activity_logs (id, farmer_id, user_id, user_name, action, entity, entity_id, details, ip_address, created_at)
            VALUES (gen_random_uuid(), ${params.farmerId}, ${params.userId}, ${params.userName || null},
                    ${params.action}, ${params.entity}, ${params.entityId || null},
                    ${params.details ? JSON.stringify(params.details) : null}::jsonb,
                    ${params.ipAddress || null}, now())
        `);
    } catch (err) {
        console.error("[ACTIVITY_LOG]", err);
        // Never throw — logging should not break the main flow
    }
}

export function activityLogMiddleware(req: Request, res: Response, next: NextFunction) {
    // Only log mutating requests on farm API
    if (!req.path.startsWith('/api/farm/') || req.method === 'GET') {
        return next();
    }

    // Capture the original res.json to log after response
    const originalJson = res.json.bind(res);
    res.json = function (data: any) {
        // Log after successful response (status < 400)
        if (res.statusCode < 400 && req.user) {
            const action = req.method === 'POST' ? 'create' : req.method === 'PUT' ? 'update' : req.method === 'DELETE' ? 'delete' : req.method;
            // Extract entity from path: /api/farm/invoices/xxx → invoices
            const pathParts = req.path.replace('/api/farm/', '').split('/');
            const entity = pathParts[0] || 'unknown';
            const entityId = pathParts[1] || undefined;

            logActivity({
                farmerId: (req.user as any).id,
                userId: (req.user as any).id,
                userName: (req.user as any).name || (req.user as any).username,
                action,
                entity,
                entityId,
                details: { method: req.method, path: req.path, statusCode: res.statusCode },
                ipAddress: req.ip || (req.headers['x-forwarded-for'] as string),
            });
        }
        return originalJson(data);
    } as any;
    next();
}
