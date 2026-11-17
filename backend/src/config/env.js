import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/meritx'),
  DIRECT_URL: z.string().optional(),
  JWT_SECRET: z.string().default('meritx_super_secret_jwt_access_key_min_32_characters_long_2026'),
  JWT_REFRESH_SECRET: z.string().default('meritx_super_secret_jwt_refresh_key_min_32_characters_long_2026'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  RAZORPAY_KEY_ID: z.string().default('rzp_test_meritx_demo'),
  RAZORPAY_KEY_SECRET: z.string().default('rzp_secret_demo_meritx_2026'),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  ENABLE_REAL_MONEY: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
  ENABLE_REAL_WITHDRAWALS: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
  ENABLE_PAID_ENTRY: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
  ENABLE_CASH_PRIZES: z.enum(['true', 'false']).transform((v) => v === 'true').default('false'),
  SEED_DEMO_USERS: z.enum(['true', 'false']).transform((v) => v === 'true').default('true'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration error');
}

export const env = parsed.data;
