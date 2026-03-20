/**
 * Logger centralizado — substitui console.log espalhado pelo projeto.
 * Formato JSON em producao, formato legivel em desenvolvimento.
 * Uso: import { logger } from './lib/logger'
 *      logger.info('mensagem', { contexto: 'opcional' })
 *      logger.error('falha', { route: '/api/foo', userId: '123' }, err)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const isProd = process.env.NODE_ENV === 'production';

function timestamp(): string {
  return new Date().toISOString();
}

function write(level: LogLevel, message: string, context?: LogContext, err?: unknown): void {
  const entry: Record<string, unknown> = {
    ts: timestamp(),
    level,
    msg: message,
    ...context,
  };

  if (err instanceof Error) {
    entry.error = err.message;
    entry.stack = err.stack;
  } else if (err !== undefined) {
    entry.error = String(err);
  }

  if (isProd) {
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  } else {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[90m', // cinza
      info:  '\x1b[36m', // ciano
      warn:  '\x1b[33m', // amarelo
      error: '\x1b[31m', // vermelho
    };
    const reset = '\x1b[0m';
    const prefix = `${colors[level]}[${level.toUpperCase()}]${reset}`;
    const contextStr = context && Object.keys(context).length
      ? ' ' + JSON.stringify(context)
      : '';
    const errStr = entry.error ? ` | error: ${entry.error}` : '';
    const output = `${prefix} ${message}${contextStr}${errStr}`;
    if (level === 'error' || level === 'warn') {
      console.error(output);
      if (err instanceof Error && err.stack) {
        console.error(err.stack);
      }
    } else {
      console.log(output);
    }
  }
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => write('debug', msg, ctx),
  info:  (msg: string, ctx?: LogContext) => write('info',  msg, ctx),
  warn:  (msg: string, ctx?: LogContext) => write('warn',  msg, ctx),
  error: (msg: string, ctx?: LogContext, err?: unknown) => write('error', msg, ctx, err),
};
