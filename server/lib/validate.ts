/**
 * Helper de validacao de request com Zod.
 *
 * Uso nas rotas:
 *   import { validateBody, validateQuery } from './lib/validate'
 *   import { z } from 'zod'
 *
 *   const schema = z.object({ nome: z.string(), valor: z.number() })
 *
 *   app.post('/api/foo', requireAuth, validateBody(schema), async (req, res) => {
 *     const { nome, valor } = req.body  // tipado e validado
 *     ...
 *   })
 *
 * Em caso de erro, retorna automaticamente:
 *   400 { ok: false, error: 'Dados invalidos: nome: Required', code: 'VALIDATION_ERROR' }
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from './logger';

function formatZodError(err: ZodError): string {
  return err.errors.map((e) => `${e.path.join('.') || 'campo'}: ${e.message}`).join(', ');
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = formatZodError(result.error);
      logger.warn('Body validation failed', { route: req.path, method: req.method, details });
      res.status(400).json({ ok: false, error: `Dados invalidos: ${details}`, code: 'VALIDATION_ERROR' });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = formatZodError(result.error);
      logger.warn('Query validation failed', { route: req.path, method: req.method, details });
      res.status(400).json({ ok: false, error: `Parametros invalidos: ${details}`, code: 'VALIDATION_ERROR' });
      return;
    }
    (req as any).validatedQuery = result.data;
    next();
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = formatZodError(result.error);
      logger.warn('Params validation failed', { route: req.path, method: req.method, details });
      res.status(400).json({ ok: false, error: `Parametros de rota invalidos: ${details}`, code: 'VALIDATION_ERROR' });
      return;
    }
    next();
  };
}
