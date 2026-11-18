import test from 'node:test';
import assert from 'node:assert';
import {
  normalizeDatabaseUrl,
  isTransientConnectionError,
  prisma
} from '../src/config/prisma.js';

test('Prisma Config - Normalizes Neon pooler URL and strips channel_binding', () => {
  const raw =
    'postgresql://user:pass@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
  const normalized = new URL(normalizeDatabaseUrl(raw));

  assert.strictEqual(normalized.searchParams.has('channel_binding'), false);
  assert.strictEqual(normalized.searchParams.get('sslmode'), 'require');
  assert.strictEqual(normalized.searchParams.get('pgbouncer'), 'true');
  assert.strictEqual(normalized.searchParams.get('connect_timeout'), '30');
  assert.strictEqual(normalized.searchParams.get('pool_timeout'), '30');
  assert.strictEqual(normalized.searchParams.get('connection_limit'), '5');
});

test('Prisma Config - Preserves explicit pool parameters and leaves local URLs untouched', () => {
  const customNeon =
    'postgresql://user:pass@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&connection_limit=8&connect_timeout=45';
  const normalizedNeon = new URL(normalizeDatabaseUrl(customNeon));
  assert.strictEqual(normalizedNeon.searchParams.get('connection_limit'), '8');
  assert.strictEqual(normalizedNeon.searchParams.get('connect_timeout'), '45');
  assert.strictEqual(normalizedNeon.searchParams.get('pgbouncer'), 'true');

  const local = 'postgresql://postgres:postgres@localhost:5432/meritx';
  assert.strictEqual(normalizeDatabaseUrl(local), local);
});

test('Prisma Config - Classifies transient PostgreSQL connection errors accurately', () => {
  assert.strictEqual(
    isTransientConnectionError({ message: 'Error in PostgreSQL connection: Error { kind: Closed, cause: None }' }),
    true
  );
  assert.strictEqual(
    isTransientConnectionError(
      { message: 'Error in PostgreSQL connection: Error { kind: Closed, cause: None }' },
      { allowClosedRetry: false }
    ),
    false
  );
  assert.strictEqual(
    isTransientConnectionError({ code: 'P1001', message: "Can't reach database server" }, { allowClosedRetry: false }),
    true
  );
  assert.strictEqual(
    isTransientConnectionError({ code: 'P1017', message: 'Server has closed the connection.' }),
    true
  );
  assert.strictEqual(
    isTransientConnectionError({ code: 'P2002', message: 'Unique constraint failed' }),
    false
  );
});

test('Prisma Config - Extended client exposes core Prisma methods', () => {
  assert.strictEqual(typeof prisma.$transaction, 'function');
  assert.strictEqual(typeof prisma.$queryRaw, 'function');
  assert.strictEqual(typeof prisma.$disconnect, 'function');
  assert.strictEqual(typeof prisma.exam.findMany, 'function');
});
