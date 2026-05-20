import express from 'express';
const router = express.Router();
import { z  } from 'zod';
import { deviceAuthMiddleware  } from '../middleware/device-auth-middleware';
import { ingestTelemetry  } from '../services/telemetry-service';
import { ERROR_CODES  } from '../config/constants';

const STATUS_MAP = {
  [ERROR_CODES.UNKNOWN_DEVICE]: 401,
  [ERROR_CODES.INVALID_PAYLOAD]: 400
};

const telemetrySchema = z.object({
  t: z.number().int(),
  fuel_l: z.number(),
  fuel_pct: z.number().int().min(0).max(100),
  engine: z.boolean(),
  door: z.boolean(),
  temp_c: z.number(),
  accel_g: z.number(),
  speed_kmh: z.number(),
  rate_lhr: z.number(),
  trip_sec: z.number().int(),
  fuel_used: z.number(),
  lat: z.number(),
  lon: z.number(),
  location: z.string(),
  geofence_ok: z.boolean(),
  low_fuel: z.boolean(),
  parking: z.boolean(),
  overspeed: z.boolean(),
  alert: z.string().nullable().optional()
});

router.post('/', deviceAuthMiddleware, async (req, res) => {
  try {
    const parsed = telemetrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        accepted: false,
        error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message }
      });
    }

    const result = await ingestTelemetry(req.deviceId, parsed.data);
    return res.status(200).json({
      accepted: true,
      telemetryId: result.telemetryId,
      vehicleId: result.vehicleId,
      message: 'telemetry stored'
    });
  } catch (err) {
    const status = STATUS_MAP[(err as any).code] || 500;
    return res.status(status).json({
      accepted: false,
      error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message }
    });
  }
});

export default router;
