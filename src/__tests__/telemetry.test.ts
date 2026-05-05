import request from 'supertest';
import express from 'express';

// Prisma instance is swapped per test via this variable.
let mockPrismaInstance: Record<string, unknown> | null = null;

jest.mock('../lib/prisma', () => ({
  get prisma() {
    return mockPrismaInstance;
  },
}));

// Import the router after the mock is in place.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { telemetryRouter } = require('../routes/telemetry') as typeof import('../routes/telemetry');

const app = express();
app.use(express.json());
app.use('/api', telemetryRouter);

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const VALID_PAYLOAD = {
  schemaVersion: '1.0',
  deviceId: 'device-001',
  vehicleId: VALID_UUID,
  timestamp: '2024-01-01T00:00:00+00:00',
  fuelLevelLiters: 50.5,
  latitude: 9.02,
  longitude: 38.74,
  source: 'gps',
};

function makeTxMock(vehicleFindUnique: jest.Mock) {
  return {
    vehicle: { findUnique: vehicleFindUnique },
    telemetryRaw: { create: jest.fn().mockResolvedValue({}) },
    telemetryNormalized: { create: jest.fn().mockResolvedValue({}) },
    vehicleLatestState: { upsert: jest.fn().mockResolvedValue({}) },
  };
}

describe('POST /api/telemetry', () => {
  beforeEach(() => {
    mockPrismaInstance = {
      $transaction: jest.fn(),
    };
  });

  it('returns 400 for a missing required field', async () => {
    const res = await request(app).post('/api/telemetry').send({});
    expect(res.status).toBe(400);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error).toBe('Invalid telemetry payload');
  });

  it('returns 400 for an invalid timestamp format', async () => {
    const res = await request(app)
      .post('/api/telemetry')
      .send({ ...VALID_PAYLOAD, timestamp: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body.accepted).toBe(false);
  });

  it('returns 503 when the database is not configured', async () => {
    mockPrismaInstance = null;
    const res = await request(app).post('/api/telemetry').send(VALID_PAYLOAD);
    expect(res.status).toBe(503);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error).toBe('Database is not configured');
  });

  it('returns 400 when UUID vehicleId does not exist in the database', async () => {
    const txMock = makeTxMock(jest.fn().mockResolvedValue(null));
    (mockPrismaInstance!.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
    );

    const res = await request(app).post('/api/telemetry').send(VALID_PAYLOAD);
    expect(res.status).toBe(400);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error).toContain('No vehicle with this UUID');
  });

  it('returns 400 when non-UUID vehicleId is not found by plateNumber or label', async () => {
    const txMock = makeTxMock(jest.fn().mockResolvedValue(null));
    (mockPrismaInstance!.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
    );

    const res = await request(app)
      .post('/api/telemetry')
      .send({ ...VALID_PAYLOAD, vehicleId: 'UNKNOWN-PLATE' });
    expect(res.status).toBe(400);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error).toContain('Unknown vehicleId');
  });

  it('returns 200 when vehicleId is a valid UUID that exists', async () => {
    const txMock = makeTxMock(jest.fn().mockResolvedValue({ vehicleId: VALID_UUID }));
    (mockPrismaInstance!.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
    );

    const res = await request(app).post('/api/telemetry').send(VALID_PAYLOAD);
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);
  });

  it('resolves vehicleId by plateNumber', async () => {
    const txMock = makeTxMock(jest.fn().mockResolvedValue({ vehicleId: VALID_UUID }));
    (mockPrismaInstance!.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
    );

    const res = await request(app)
      .post('/api/telemetry')
      .send({ ...VALID_PAYLOAD, vehicleId: 'PLATE-001' });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);
    // Only one findUnique call (by plate); label lookup is skipped when plate matches.
    expect(txMock.vehicle.findUnique).toHaveBeenCalledTimes(1);
    expect(txMock.vehicle.findUnique).toHaveBeenCalledWith({
      where: { plateNumber: 'PLATE-001' },
      select: { vehicleId: true },
    });
  });

  it('resolves vehicleId by label when plateNumber does not match', async () => {
    const txMock = makeTxMock(
      jest
        .fn()
        .mockResolvedValueOnce(null) // plateNumber miss
        .mockResolvedValueOnce({ vehicleId: VALID_UUID }), // label hit
    );
    (mockPrismaInstance!.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: typeof txMock) => Promise<void>) => fn(txMock),
    );

    const res = await request(app)
      .post('/api/telemetry')
      .send({ ...VALID_PAYLOAD, vehicleId: 'Truck Alpha' });
    expect(res.status).toBe(200);
    expect(res.body.accepted).toBe(true);
    expect(txMock.vehicle.findUnique).toHaveBeenCalledTimes(2);
  });

  it('returns 500 when the database transaction throws unexpectedly', async () => {
    (mockPrismaInstance!.$transaction as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await request(app).post('/api/telemetry').send(VALID_PAYLOAD);
    expect(res.status).toBe(500);
    expect(res.body.accepted).toBe(false);
    expect(res.body.error).toBe('Failed to ingest telemetry payload');
  });
});
