import express from 'express';
const router = express.Router();
import { z  } from 'zod';
import { authMiddleware  } from '../middleware/auth-middleware';
import { listDevices, registerDevice, updateDevice, getDevice  } from '../services/device-service';
import { ERROR_CODES  } from '../config/constants';

const STATUS_MAP = {
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.DUPLICATE_DEVICE_ID]: 409,
  [ERROR_CODES.INVALID_PAYLOAD]: 400
};

const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  vehicleId: z.string().optional().nullable(),
  firmwareVersion: z.string().optional()
});

const updateDeviceSchema = z.object({
  vehicleId: z.string().optional().nullable(),
  firmwareVersion: z.string().optional()
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await listDevices();
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = registerDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    const adminId = (req as any).admin.adminId;
    const result = await registerDevice(parsed.data, adminId);
    return res.status(201).json({ success: true, deviceId: result.deviceId, message: 'Device registered successfully' });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const device = await getDevice(req.params.deviceId);
    return res.status(200).json({ success: true, device });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.patch('/:deviceId', authMiddleware, async (req, res) => {
  try {
    const parsed = updateDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    await updateDevice(req.params.deviceId, parsed.data);
    return res.status(200).json({ success: true, deviceId: req.params.deviceId, message: `Device updated. Assigned to ${parsed.data.vehicleId || 'none'}.` });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

export default router;
