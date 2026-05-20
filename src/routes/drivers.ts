import express from 'express';
const router = express.Router();
import { z  } from 'zod';
import { authMiddleware  } from '../middleware/auth-middleware';
import { listDrivers, registerDriver, getDriver, updateDriver, getDriverViolations  } from '../services/driver-service';
import { ERROR_CODES  } from '../config/constants';

const STATUS_MAP = {
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.DUPLICATE_LICENSE]: 409,
  [ERROR_CODES.INVALID_PAYLOAD]: 400
};

const registerDriverSchema = z.object({
  fullName: z.string().min(1),
  licenseNumber: z.string().min(1),
  phoneNumber: z.string().optional()
});

const updateDriverSchema = z.object({
  fullName: z.string().optional(),
  licenseNumber: z.string().optional(),
  phoneNumber: z.string().optional(),
  status: z.enum(['active', 'suspended', 'inactive']).optional()
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await listDrivers();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = registerDriverSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    const result = await registerDriver(parsed.data);
    return res.status(201).json({ success: true, driverId: result.driverId, message: 'Driver registered' });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:driverId', authMiddleware, async (req, res) => {
  try {
    const driver = await getDriver(req.params.driverId);
    return res.status(200).json({ success: true, driver });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.patch('/:driverId', authMiddleware, async (req, res) => {
  try {
    const parsed = updateDriverSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    await updateDriver(req.params.driverId, parsed.data);
    return res.status(200).json({ success: true, message: 'Driver updated' });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:driverId/violations', authMiddleware, async (req, res) => {
  try {
    const { from, to, type, limit } = req.query;
    const result = await getDriverViolations(req.params.driverId, {
      from, to, type,
      limit: limit ? parseInt(limit as string, 10) : undefined
    });
    const driver = await getDriver(req.params.driverId);
    return res.status(200).json({ success: true, driverId: req.params.driverId, driver, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

export default router;
