/**
 * Middleware de erro centralizado.
 *
 * Formato padrao de resposta de erro (todos os endpoints passam por aqui):
 *   { ok: false, error: string, code?: string }
 *
 * Uso no index.ts — registrar DEPOIS de todas as rotas:
 *   import { errorHandler } from './lib/error-handler'
 *   app.use(errorHandler)
 *
 * Para lancar erros com status HTTP especifico nas rotas:
 *   import { AppError } from './lib/error-handler'
 *   throw new AppError(404, 'Recurso nao encontrado', 'NOT_FOUND')
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Erro de validacao Zod
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn('Validation error', { route: req.path, method: req.method, details });
    res.status(400).json({ ok: false, error: `Dados invalidos: ${details}`, code: 'VALIDATION_ERROR' });
    return;
  }

  // Erro de aplicacao com status controlado
  if (err instanceof AppError) {
    logger.warn('App error', { route: req.path, method: req.method, code: err.code, status: err.statusCode });
    res.status(err.statusCode).json({ ok: false, error: err.message, code: err.code });
    return;
  }

  // Erro inesperado
  const message = err instanceof Error ? err.message : 'Erro interno do servidor';
  logger.error('Unhandled error', { route: req.path, method: req.method }, err instanceof Error ? err : new Error(String(err)));
  res.status(500).json({ ok: false, error: message, code: 'INTERNAL_ERROR' });
}
