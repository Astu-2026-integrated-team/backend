import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const loadEnvModule = async () => import('../config/env.js');

describe('env config optional blank values', () => {
  beforeEach(() => {
    jest.resetModules();

    delete process.env.SUPABASE_DB_URL;
    delete process.env.SUPABASE_PRISMA_URL;
    delete process.env.SUPABASE_DIRECT_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.AUTH_DEVICE_TOKEN_PEPPER;
  });

  it('treats blank optional auth and Supabase values as unset', async () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_ANON_KEY = '';
    process.env.SUPABASE_JWT_SECRET = '';
    process.env.AUTH_DEVICE_TOKEN_PEPPER = '';
    process.env.SUPABASE_PRISMA_URL = '';
    process.env.SUPABASE_DIRECT_URL = '';

    const { env } = await loadEnvModule();

    expect(env.supabaseUrl).toBeUndefined();
    expect(env.supabaseAnonKey).toBeUndefined();
    expect(env.supabaseJwtSecret).toBeUndefined();
    expect(env.authDeviceTokenPepper).toBeUndefined();
    expect(env.supabasePrismaUrl).toBeUndefined();
    expect(env.supabaseDirectUrl).toBeUndefined();
    expect(env.authConfigured).toBe(false);
  });

  it('returns false when only SUPABASE_PRISMA_URL is set', async () => {
    process.env.SUPABASE_PRISMA_URL = 'postgresql://postgres:password@db.example.co:5432/postgres';

    const { env } = await loadEnvModule();

    expect(env.prismaConfigured).toBe(false);
    expect(env.supabasePrismaUrl).toBe(process.env.SUPABASE_PRISMA_URL);
  });
});
