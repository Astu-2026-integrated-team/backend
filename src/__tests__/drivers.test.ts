import jwt from 'jsonwebtoken';
import request from 'supertest';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const mockDriverFindMany = jest.fn();
const mockDriverCreate = jest.fn();
const mockDriverUpdate = jest.fn();

jest.mock('../lib/prisma', () => ({
  prisma: {
    driver: {
      findMany: mockDriverFindMany,
      create: mockDriverCreate,
      update: mockDriverUpdate,
    },
  },
}));

function adminBearer() {
  return jwt.sign(
    { username: 'admin', role: 'admin' },
    'test-jwt-secret',
    { algorithm: 'HS256', subject: 'admin-001', expiresIn: '1h' },
  );
}

describe('drivers routes', () => {
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

  it('registers a driver as admin', async () => {
    mockDriverFindMany.mockResolvedValue([{ driverId: 'DRV-002' }]);
    mockDriverCreate.mockResolvedValue({
      driverId: 'DRV-003',
      fullName: 'Chaltu Gemechu',
      licenseNumber: 'ETH-2022-9871',
      phoneNumber: '+251912345678',
      status: 'active',
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
    });

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .post('/api/drivers')
      .set('Authorization', `Bearer ${adminBearer()}`)
      .send({
        fullName: 'Chaltu Gemechu',
        licenseNumber: 'ETH-2022-9871',
        phoneNumber: '+251912345678',
      });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      driverId: 'DRV-003',
      message: 'Driver registered',
    });
    expect(mockDriverCreate).toHaveBeenCalledWith({
      data: {
        driverId: 'DRV-003',
        fullName: 'Chaltu Gemechu',
        licenseNumber: 'ETH-2022-9871',
        phoneNumber: '+251912345678',
        status: 'active',
      },
    });
  });

  it('lists drivers as admin', async () => {
    mockDriverFindMany.mockResolvedValue([
      {
        driverId: 'DRV-001',
        fullName: 'Bekele Tadesse',
        licenseNumber: 'ETH-2020-1111',
        phoneNumber: null,
        status: 'active',
        createdAt: new Date('2026-05-19T10:00:00.000Z'),
      },
    ]);

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .get('/api/drivers')
      .set('Authorization', `Bearer ${adminBearer()}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.drivers).toHaveLength(1);
    expect(response.body.drivers[0]).toEqual({
      driverId: 'DRV-001',
      fullName: 'Bekele Tadesse',
      licenseNumber: 'ETH-2020-1111',
      phoneNumber: null,
      status: 'active',
      createdAt: '2026-05-19T10:00:00.000Z',
    });
  });

  it('returns 401 without a token', async () => {
    const { app } = require('../app') as typeof import('../app');

    const response = await request(app).get('/api/drivers');

    expect(response.status).toBe(401);
  });

  it('returns 403 for non-admin JWT', async () => {
    const viewerToken = jwt.sign(
      { username: 'viewer', role: 'viewer' },
      'test-jwt-secret',
      { algorithm: 'HS256', subject: 'viewer-001', expiresIn: '1h' },
    );

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .get('/api/drivers')
      .set('Authorization', `Bearer ${viewerToken}`);

    expect(response.status).toBe(401);
  });

  it('returns INVALID_PAYLOAD for invalid phone format', async () => {
    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .post('/api/drivers')
      .set('Authorization', `Bearer ${adminBearer()}`)
      .send({
        fullName: 'Test Driver',
        licenseNumber: 'ETH-2022-9999',
        phoneNumber: '0912345678',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('updates a driver as admin', async () => {
    mockDriverUpdate.mockResolvedValue({
      driverId: 'DRV-001',
      fullName: 'Chaltu Gemechu Updated',
      licenseNumber: 'ETH-2022-9871',
      phoneNumber: '+251911111111',
      status: 'suspended',
      createdAt: new Date('2026-05-20T10:00:00.000Z'),
    });

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .patch('/api/drivers/DRV-001')
      .set('Authorization', `Bearer ${adminBearer()}`)
      .send({
        fullName: 'Chaltu Gemechu Updated',
        status: 'suspended',
        phoneNumber: '+251911111111',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.driverId).toBe('DRV-001');
    expect(response.body.driver.status).toBe('suspended');
    expect(mockDriverUpdate).toHaveBeenCalledWith({
      where: { driverId: 'DRV-001' },
      data: {
        fullName: 'Chaltu Gemechu Updated',
        status: 'suspended',
        phoneNumber: '+251911111111',
      },
    });
  });

  it('returns NOT_FOUND when driver does not exist', async () => {
    const notFoundError = new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)(
      'Record not found',
      { code: 'P2025', clientVersion: 'test' },
    );
    mockDriverUpdate.mockRejectedValue(notFoundError);

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .patch('/api/drivers/DRV-999')
      .set('Authorization', `Bearer ${adminBearer()}`)
      .send({ status: 'inactive' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns INVALID_PAYLOAD when patch body is empty', async () => {
    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .patch('/api/drivers/DRV-001')
      .set('Authorization', `Bearer ${adminBearer()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PAYLOAD');
  });

  it('returns DUPLICATE_LICENSE when license already exists', async () => {
    mockDriverFindMany.mockResolvedValue([]);
    const duplicateError = new (require('@prisma/client').Prisma.PrismaClientKnownRequestError)(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: 'test' },
    );
    mockDriverCreate.mockRejectedValue(duplicateError);

    const { app } = require('../app') as typeof import('../app');

    const response = await request(app)
      .post('/api/drivers')
      .set('Authorization', `Bearer ${adminBearer()}`)
      .send({
        fullName: 'Duplicate',
        licenseNumber: 'ETH-2022-9871',
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'DUPLICATE_LICENSE',
        message: 'Registering driver with existing license number',
      },
    });
  });
});
