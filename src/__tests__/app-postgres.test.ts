import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const maybeIt =
  process.env.CI_POSTGRES_INTEGRATION === '1' ? it : it.skip;

describe('Express App with live Postgres', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  maybeIt('reports Prisma connectivity when Postgres is reachable', async () => {
    process.env.SUPABASE_DB_URL ??=
      'postgresql://postgres:postgres@127.0.0.1:5432/postgres';

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('../app') as typeof import('../app');

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.prismaConfigured).toBe(true);
    expect(response.body.clientReady).toBe(true);
  });
});
