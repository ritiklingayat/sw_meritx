import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy'
]);

const CONNECTION_ACQUISITION_CODES = new Set(['P1001', 'P1002', 'P1008', 'P2024']);
const CONNECTION_CLOSED_CODES = new Set(['P1017']);

export function normalizeDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (!parsed.protocol.startsWith('postgres')) return rawUrl;

    const host = parsed.hostname.toLowerCase();
    const isNeon = host.includes('neon.tech');
    const isPooler = host.includes('-pooler') || parsed.searchParams.get('pgbouncer') === 'true';

    if (isNeon || isPooler) {
      // Prisma's Rust PostgreSQL engine (quaint) drops sockets on Neon PgBouncer when channel_binding is forced
      if (parsed.searchParams.has('channel_binding')) {
        parsed.searchParams.delete('channel_binding');
      }
      if (!parsed.searchParams.has('sslmode')) {
        parsed.searchParams.set('sslmode', 'require');
      }
      if (isPooler && !parsed.searchParams.has('pgbouncer')) {
        parsed.searchParams.set('pgbouncer', 'true');
      }
      if (!parsed.searchParams.has('connect_timeout')) {
        parsed.searchParams.set('connect_timeout', '30');
      }
      if (!parsed.searchParams.has('pool_timeout')) {
        parsed.searchParams.set('pool_timeout', '30');
      }
      if (!parsed.searchParams.has('connection_limit')) {
        parsed.searchParams.set('connection_limit', '5');
      }
    }

    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

export function isTransientConnectionError(error, { allowClosedRetry = true } = {}) {
  if (!error) return false;
  const code = error.code;
  const msg = String(error.message || '');

  if (CONNECTION_ACQUISITION_CODES.has(code)) return true;
  if (
    msg.includes("Can't reach database server") ||
    msg.includes('Timed out fetching a new connection from the connection pool')
  ) {
    return true;
  }

  if (allowClosedRetry) {
    if (CONNECTION_CLOSED_CODES.has(code)) return true;
    if (
      msg.includes('Server has closed the connection') ||
      msg.includes('kind: Closed') ||
      msg.includes('Connection terminated unexpectedly') ||
      msg.includes('ECONNRESET') ||
      msg.includes('ETIMEDOUT')
    ) {
      return true;
    }
  }

  return false;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const prismaClientSingleton = () => {
  const datasourceUrl = normalizeDatabaseUrl(env.DATABASE_URL);
  const logConfig =
    env.NODE_ENV === 'development'
      ? [
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'error' }
        ]
      : [{ emit: 'event', level: 'error' }];

  const baseClient = new PrismaClient({
    ...(datasourceUrl ? { datasourceUrl } : {}),
    log: logConfig
  });

  let lastClosedLogAt = 0;

  baseClient.$on('error', (event) => {
    const message = String(event?.message || '');
    // Neon serverless compute suspends idle TCP sockets, causing PgBouncer/quaint to emit
    // "Error in PostgreSQL connection: Error { kind: Closed, cause: None }".
    // Prisma opens a fresh socket on the next query; throttle this benign notice.
    if (message.includes('kind: Closed') || message.includes('Server has closed the connection')) {
      const now = Date.now();
      if (now - lastClosedLogAt > 30000) {
        lastClosedLogAt = now;
        logger.warn('PostgreSQL idle connection closed by remote pooler; Prisma will reconnect automatically.', {
          target: event?.target
        });
      }
      return;
    }
    logger.error('Prisma engine error', { message, target: event?.target });
  });

  if (env.NODE_ENV === 'development') {
    baseClient.$on('warn', (event) => {
      logger.warn('Prisma engine warning', { message: event?.message, target: event?.target });
    });
  }

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const allowClosedRetry = READ_OPERATIONS.has(operation);
          const maxAttempts = 3;
          let lastError;

          for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              lastError = error;
              if (
                attempt < maxAttempts &&
                isTransientConnectionError(error, { allowClosedRetry })
              ) {
                await delay(attempt * 300);
                continue;
              }
              throw error;
            }
          }

          throw lastError;
        }
      }
    }
  });
};

const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();
globalForPrisma.prisma = prisma;

export async function checkDatabaseConnection(retries = 2) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, message: 'Database connection verified' };
    } catch (error) {
      lastError = error;
      if (attempt < retries && isTransientConnectionError(error)) {
        await delay(attempt * 500);
        continue;
      }
      break;
    }
  }
  return { ok: false, error: lastError?.message || 'Database connection failed' };
}
