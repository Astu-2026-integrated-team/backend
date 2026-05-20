import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();

jest.mock('../lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
  },
}));

describe('auth routes', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  afterEach(() => {
    delete process.env.SUPABASE_DB_URL;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRES_IN;
  });

  it('logs in an admin and returns a backend JWT', async () => {
    const passwordHash = await bcrypt.hash('secret', 10);

    mockFindUnique.mockResolvedValue({
      adminId: 'admin-001',
      username: 'admin',
      passwordHash,
      lastLoginAt: null,
    });
    mockUpdate.mockResolvedValue({
      adminId: 'admin-001',
      username: 'admin',
      passwordHash,
      lastLoginAt: new Date(),
    });

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'secret',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.admin).toEqual({
      adminId: 'admin-001',
      username: 'admin',
    });
    expect(typeof response.body.token).toBe('string');

    const decoded = jwt.verify(response.body.token, 'test-jwt-secret') as jwt.JwtPayload;
    expect(decoded.sub).toBe('admin-001');
    expect(decoded.username).toBe('admin');
    expect(decoded.role).toBe('admin');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { adminId: 'admin-001' },
      data: {
        lastLoginAt: expect.any(Date),
      },
    });
  });

  it('returns INVALID_CREDENTIALS when username is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app).post('/api/auth/login').send({
      username: 'missing',
      password: 'wrong',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Username or password is incorrect',
      },
    });
  });

  it('returns INVALID_CREDENTIALS when password is wrong', async () => {
    const passwordHash = await bcrypt.hash('secret', 10);

    mockFindUnique.mockResolvedValue({
      adminId: 'admin-001',
      username: 'admin',
      passwordHash,
      lastLoginAt: null,
    });

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app).post('/api/auth/login').send({
      username: 'admin',
      password: 'wrong',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Username or password is incorrect',
      },
    });
  });

  it('returns INVALID_PAYLOAD for email-based request bodies from the old flow', async () => {
    const { app } = require('../app') as typeof import('../app');

    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'secret',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'INVALID_PAYLOAD',
        message: 'Invalid login request body.',
      },
    });
  });
});
