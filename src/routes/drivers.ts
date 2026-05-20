import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';
import { writeApiError } from '../lib/api-response';
import { generateNextDriverId } from '../lib/driver-id';
import { prisma } from '../lib/prisma';
import { requireAdmin } from '../middleware/admin-auth';

const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

const DRIVER_STATUSES = ['active', 'suspended', 'inactive'] as const;

const registerDriverBodySchema = z
  .object({
    fullName: z.string().trim().min(1),
    licenseNumber: z.string().trim().min(1),
    phoneNumber: z
      .string()
      .trim()
      .regex(E164_PHONE_REGEX, 'Phone number must be in E.164 format (e.g. +251912345678).')
      .optional(),
  })
  .strict();

const updateDriverBodySchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    licenseNumber: z.string().trim().min(1).optional(),
    phoneNumber: z
      .union([
        z
          .string()
          .trim()
          .regex(E164_PHONE_REGEX, 'Phone number must be in E.164 format (e.g. +251912345678).'),
        z.null(),
      ])
      .optional(),
    status: z.enum(DRIVER_STATUSES).optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.fullName !== undefined ||
      body.licenseNumber !== undefined ||
      body.phoneNumber !== undefined ||
      body.status !== undefined,
    { message: 'At least one field must be provided to update a driver.' },
  );

const driversRouter = Router();

function mapDriver(driver: {
  driverId: string;
  fullName: string;
  licenseNumber: string;
  phoneNumber: string | null;
  status: string;
  createdAt: Date;
}) {
  return {
    driverId: driver.driverId,
    fullName: driver.fullName,
    licenseNumber: driver.licenseNumber,
    phoneNumber: driver.phoneNumber,
    status: driver.status,
    createdAt: driver.createdAt.toISOString(),
  };
}

driversRouter.post('/', ...requireAdmin, async (req, res) => {
  const parsedBody = registerDriverBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    writeApiError(res, 400, 'INVALID_PAYLOAD', 'Invalid driver registration request body.');
    return;
  }

  if (!prisma) {
    writeApiError(res, 503, 'SERVICE_UNAVAILABLE', 'Database is not configured.');
    return;
  }

  try {
    const driverId = await generateNextDriverId();

    const driver = await prisma.driver.create({
      data: {
        driverId,
        fullName: parsedBody.data.fullName,
        licenseNumber: parsedBody.data.licenseNumber,
        phoneNumber: parsedBody.data.phoneNumber ?? null,
        status: 'active',
      },
    });

    res.status(201).json({
      success: true,
      driverId: driver.driverId,
      message: 'Driver registered',
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      writeApiError(
        res,
        409,
        'DUPLICATE_LICENSE',
        'Registering driver with existing license number',
      );
      return;
    }

    if (error instanceof Error && error.message === 'Database is not configured.') {
      writeApiError(res, 503, 'SERVICE_UNAVAILABLE', 'Database is not configured.');
      return;
    }

    console.error('Register driver failed', error);
    writeApiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
});

driversRouter.patch('/:driverId', ...requireAdmin, async (req, res) => {
  const parsedBody = updateDriverBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    writeApiError(res, 400, 'INVALID_PAYLOAD', 'Invalid driver update request body.');
    return;
  }

  if (!prisma) {
    writeApiError(res, 503, 'SERVICE_UNAVAILABLE', 'Database is not configured.');
    return;
  }

  const driverId = String(req.params.driverId);
  const data: Prisma.DriverUpdateInput = {};

  if (parsedBody.data.fullName !== undefined) {
    data.fullName = parsedBody.data.fullName;
  }
  if (parsedBody.data.licenseNumber !== undefined) {
    data.licenseNumber = parsedBody.data.licenseNumber;
  }
  if (parsedBody.data.phoneNumber !== undefined) {
    data.phoneNumber = parsedBody.data.phoneNumber;
  }
  if (parsedBody.data.status !== undefined) {
    data.status = parsedBody.data.status;
  }

  try {
    const driver = await prisma.driver.update({
      where: { driverId },
      data,
    });

    res.json({
      success: true,
      driverId: driver.driverId,
      message: 'Driver updated successfully.',
      driver: mapDriver(driver),
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      writeApiError(res, 404, 'NOT_FOUND', `Driver ${driverId} not found.`);
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      writeApiError(
        res,
        409,
        'DUPLICATE_LICENSE',
        'Registering driver with existing license number',
      );
      return;
    }

    console.error('Update driver failed', error);
    writeApiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
});

driversRouter.get('/', ...requireAdmin, async (_req, res) => {
  if (!prisma) {
    writeApiError(res, 503, 'SERVICE_UNAVAILABLE', 'Database is not configured.');
    return;
  }

  try {
    const drivers = await prisma.driver.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      drivers: drivers.map(mapDriver),
    });
  } catch (error) {
    console.error('List drivers failed', error);
    writeApiError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
});

export { driversRouter, registerDriverBodySchema, updateDriverBodySchema };
