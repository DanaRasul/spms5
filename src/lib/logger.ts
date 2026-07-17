/**
 * Production logger — never exposes stack traces to API consumers.
 * Logs to stdout in JSON format for easy ingestion by log aggregators.
 */

import { Prisma } from '@prisma/client';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  path?: string;
  endpoint?: string;
  method?: string;
  error?: string;
  errorName?: string;
  stack?: string;
  prismaCode?: string;
  prismaMeta?: unknown;
  sqlState?: string;
  meta?: Record<string, unknown>;
}

function serializeError(error: unknown): Pick<
  LogEntry,
  'error' | 'errorName' | 'stack' | 'prismaCode' | 'prismaMeta' | 'sqlState'
> {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      error: error.message,
      errorName: error.name,
      stack: error.stack,
      prismaCode: error.code,
      prismaMeta: error.meta,
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      error: error.message,
      errorName: error.name,
      stack: error.stack,
    };
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      error: error.message,
      errorName: error.name,
      stack: error.stack,
    };
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      error: error.message,
      errorName: error.name,
      stack: error.stack,
    };
  }

  if (error instanceof Error) {
    const extra = error as Error & { code?: string; meta?: unknown; sqlState?: string };
    return {
      error: error.message,
      errorName: error.name,
      stack: error.stack,
      prismaCode: typeof extra.code === 'string' ? extra.code : undefined,
      prismaMeta: extra.meta,
      sqlState: extra.sqlState,
    };
  }

  if (typeof error === 'string') {
    return { error };
  }

  if (error && typeof error === 'object') {
    try {
      return { error: JSON.stringify(error) };
    } catch {
      return { error: String(error) };
    }
  }

  return {};
}

function write(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === 'error' || entry.level === 'warn') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>): void {
    write({ level: 'info', message, timestamp: new Date().toISOString(), meta });
  },
  warn(message: string, meta?: Record<string, unknown>): void {
    write({ level: 'warn', message, timestamp: new Date().toISOString(), meta });
  },
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    write({
      level: 'error',
      message,
      timestamp: new Date().toISOString(),
      ...serializeError(error),
      meta,
    });
  },
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      write({ level: 'debug', message, timestamp: new Date().toISOString(), meta });
    }
  },
};

export interface ApiErrorContext {
  endpoint: string;
  method?: string;
  requestId?: string;
  userId?: string;
  meta?: Record<string, unknown>;
}

/**
 * Logs a failed API request with full diagnostic detail (server-side only).
 */
export function logApiError(message: string, error: unknown, ctx: ApiErrorContext): void {
  logger.error(message, error, {
    endpoint: ctx.endpoint,
    method: ctx.method,
    requestId: ctx.requestId,
    userId: ctx.userId,
    ...ctx.meta,
  });
}

const TRANSACTION_CLOSED_CODES = new Set(['P2028', 'P2034']);
const DUPLICATE_CODES = new Set(['P2002']);

/**
 * Maps known Prisma / application errors to HTTP responses.
 * Returns null when the error should fall through to a generic 500.
 */
export function mapPrismaError(error: unknown): { status: number; message: string; error: string } | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (DUPLICATE_CODES.has(error.code)) {
      return { status: 409, error: 'Conflict', message: 'duplicateRecord' };
    }
    if (TRANSACTION_CLOSED_CODES.has(error.code)) {
      return { status: 503, error: 'Service Unavailable', message: 'transactionConflict' };
    }
    if (error.code === 'P2025') {
      return { status: 404, error: 'Not Found', message: 'recordNotFound' };
    }
  }

  const code = (error as { code?: string })?.code;
  if (code === 'DUPLICATE_ACTIVE') {
    return { status: 409, error: 'Conflict', message: 'vehicleAlreadyInside' };
  }
  if (code === 'SPACE_UNAVAILABLE') {
    return { status: 409, error: 'Conflict', message: 'spaceNotAvailable' };
  }
  if (code === 'SPACE_NOT_FOUND') {
    return { status: 404, error: 'Not Found', message: 'spaceNotFound' };
  }
  if (code === 'ALREADY_EXITED') {
    return { status: 409, error: 'Conflict', message: 'vehicleAlreadyExited' };
  }
  if (code === 'NOT_INSIDE') {
    return { status: 409, error: 'Conflict', message: 'vehicleNotInside' };
  }
  if (code === 'DUPLICATE_PLATE') {
    return { status: 409, error: 'Conflict', message: 'vehicleAlreadyInside' };
  }
  if (code === 'LOCK_TIMEOUT') {
    return { status: 503, error: 'Service Unavailable', message: 'lockTimeout' };
  }

  return null;
}

/**
 * Wraps an API route handler with global exception handling.
 * Logs the full error server-side; returns a safe generic message to the client.
 */
export function withErrorHandler(
  handler: (req: Request, ctx?: unknown) => Promise<Response>
): (req: Request, ctx?: unknown) => Promise<Response> {
  return async (req: Request, ctx?: unknown) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      logApiError('Unhandled API exception', err, {
        endpoint: req.url,
        method: req.method,
      });
      return new Response(
        JSON.stringify({
          error: 'Internal Server Error',
          message: 'An unexpected error occurred. Please try again later.',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  };
}
