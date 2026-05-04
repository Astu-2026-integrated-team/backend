import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';

const uuidLikeSchema = z.string().uuid();

const telemetryPayloadSchema = z.object({
  schemaVersion: z.string().min(1),
  deviceId: z.string().min(1),
  vehicleId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }),
  fuelLevelLiters: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  source: z.string().min(1),
});

export const telemetryRouter = Router();

telemetryRouter.post('/telemetry', async (request, response) => {
  const parsedPayload = telemetryPayloadSchema.safeParse(request.body);

  if (!parsedPayload.success) {
    response.status(400).json({
      accepted: false,
      error: 'Invalid telemetry payload',
      details: parsedPayload.error.flatten(),
    });
    return;
  }

  if (!prisma) {
    response.status(503).json({
      accepted: false,
      error: 'Database is not configured',
    });
    return;
  }

  const payload = parsedPayload.data;

  try {
    await prisma.$transaction(async (tx) => {
      let resolvedVehicleId = payload.vehicleId;

      if (!uuidLikeSchema.safeParse(payload.vehicleId).success) {
        const matchedVehicle = await tx.vehicle.findFirst({
          where: {
            OR: [{ plateNumber: payload.vehicleId }, { label: payload.vehicleId }],
          },
          select: {
            vehicleId: true,
          },
        });

        if (!matchedVehicle) {
          response.status(400).json({
            accepted: false,
            error: 'Unknown vehicleId. Provide a UUID or an existing plateNumber/label.',
          });
          return;
        }

        resolvedVehicleId = matchedVehicle.vehicleId;
      }

      await tx.telemetryRaw.create({
        data: {
          payload,
          source: payload.source,
        },
      });

      await tx.telemetryNormalized.create({
        data: {
          vehicleId: resolvedVehicleId,
          deviceId: payload.deviceId,
          timestamp: new Date(payload.timestamp),
          fuelLevelLiters: payload.fuelLevelLiters,
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
      });

      await tx.vehicleLatestState.upsert({
        where: {
          vehicleId: resolvedVehicleId,
        },
        update: {
          lastSeenAt: new Date(payload.timestamp),
          fuelLevelLiters: payload.fuelLevelLiters,
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
        create: {
          vehicleId: resolvedVehicleId,
          lastSeenAt: new Date(payload.timestamp),
          fuelLevelLiters: payload.fuelLevelLiters,
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
      });
    });

    if (response.headersSent) {
      return;
    }

    response.json({ accepted: true });
  } catch (error) {
    response.status(500).json({
      accepted: false,
      error: 'Failed to ingest telemetry payload',
    });
  }
});
