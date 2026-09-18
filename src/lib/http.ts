import { ZodError } from 'zod';
import { ConflictError, InvalidCursorError } from '../storage/errors.js';
import { logger } from './logger.js';

export interface HandlerResult<T = unknown> {
  statusCode: number;
  body: T;
}

export interface ErrorBody {
  error: string;
  details?: unknown;
}

export const ok = <T>(body: T, statusCode = 200): HandlerResult<T> => ({ statusCode, body });

export const error = (statusCode: number, message: string, details?: unknown): HandlerResult<ErrorBody> => ({
  statusCode,
  body: details === undefined ? { error: message } : { error: message, details },
});

export const notFound = () => error(404, 'Item not found');

export function handleError(err: unknown, context: Record<string, unknown> = {}): HandlerResult<ErrorBody> {
  if (err instanceof ZodError) {
    return error(
      400,
      'Validation failed',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  if (err instanceof InvalidCursorError) {
    return error(400, err.message);
  }
  if (err instanceof ConflictError) {
    return error(409, err.message);
  }

  logger.error('Unhandled error', { ...context, error: err instanceof Error ? err.stack : String(err) });
  // don't leak internals to the client
  return error(500, 'Internal server error');
}
