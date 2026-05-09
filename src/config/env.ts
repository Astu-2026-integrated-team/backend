import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  APP_NAME: z.string().default('Fuel-Aware Backend'),
  APP_ENV: z.string().default('development'),
  APP_HOST: z.string().optional(),
  HOST: z.string().optional(),
  APP_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
  SUPABASE_DB_URL: z.string().url().optional(),
  SUPABASE_PRISMA_URL: z.string().url().optional(),
  SUPABASE_DIRECT_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  AUTH_DEVICE_TOKEN_PEPPER: z.string().min(1).optional(),
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  appName: parsedEnv.APP_NAME,
  appEnv: parsedEnv.APP_ENV,
  host: parsedEnv.APP_HOST ?? parsedEnv.HOST ?? '0.0.0.0',
  port: parsedEnv.PORT ?? parsedEnv.APP_PORT ?? 8000,
  supabaseDbUrl: parsedEnv.SUPABASE_DB_URL,
  supabasePrismaUrl: parsedEnv.SUPABASE_PRISMA_URL ?? parsedEnv.SUPABASE_DB_URL,
  supabaseDirectUrl: parsedEnv.SUPABASE_DIRECT_URL,
  prismaConfigured: Boolean(
    parsedEnv.SUPABASE_PRISMA_URL ?? parsedEnv.SUPABASE_DB_URL
  ),
  authConfigured: Boolean(
    parsedEnv.SUPABASE_URL &&
      parsedEnv.SUPABASE_ANON_KEY &&
      parsedEnv.SUPABASE_JWT_SECRET &&
      parsedEnv.AUTH_DEVICE_TOKEN_PEPPER
  ),
  supabaseUrl: parsedEnv.SUPABASE_URL,
  supabaseAnonKey: parsedEnv.SUPABASE_ANON_KEY,
  supabaseJwtSecret: parsedEnv.SUPABASE_JWT_SECRET,
  authDeviceTokenPepper: parsedEnv.AUTH_DEVICE_TOKEN_PEPPER,
} as const;
