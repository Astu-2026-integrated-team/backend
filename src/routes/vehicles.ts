import express from 'express';
const router = express.Router();
import { z  } from 'zod';
import { authMiddleware  } from '../middleware/auth-middleware';
import { listVehicles, registerVehicle, getVehicle, updateVehicle, getVehicleHistory, listVehicleTrips, listVehicleAlerts  } from '../services/vehicle-service';
import { ERROR_CODES  } from '../config/constants';

const STATUS_MAP = {
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.DUPLICATE_VEHICLE_ID]: 409,
  [ERROR_CODES.INVALID_PAYLOAD]: 400
};

const registerVehicleSchema = z.object({
  vehicleId: z.string().min(1),
  plateNumber: z.string().min(1),
  label: z.string().min(1),
  tankCapacityLiters: z.number().positive(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  color: z.string().optional(),
  assignedDriverId: z.string().optional().nullable(),
  assignedDeviceId: z.string().optional().nullable()
});

const updateVehicleSchema = z.object({
  plateNumber: z.string().optional(),
  label: z.string().optional(),
  tankCapacityLiters: z.number().positive().optional(),
  make: z.string().optional(),
  model: z.string().optional(),
  year: z.number().int().optional(),
  color: z.string().optional(),
  assignedDriverId: z.string().optional().nullable(),
  assignedDeviceId: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional()
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, deviceStatus } = req.query;
    const result = await listVehicles({ status: status as string, deviceStatus: deviceStatus as string });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const parsed = registerVehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    const result = await registerVehicle(parsed.data);
    return res.status(201).json({ success: true, vehicleId: result.vehicleId, message: 'Vehicle registered successfully' });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:vehicleId', authMiddleware, async (req, res) => {
  try {
    const vehicle = await getVehicle(req.params.vehicleId);
    return res.status(200).json({ success: true, vehicle });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.patch('/:vehicleId', authMiddleware, async (req, res) => {
  try {
    const parsed = updateVehicleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    await updateVehicle(req.params.vehicleId, parsed.data);
    return res.status(200).json({ success: true, message: 'Vehicle updated successfully' });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:vehicleId/history', authMiddleware, async (req, res) => {
  try {
    const { from, to, limit, offset, fields } = req.query;
    const result = await getVehicleHistory(req.params.vehicleId, { 
      from: from as string, to: to as string, 
      limit: limit ? parseInt(limit as string, 10) : undefined, 
      offset: offset ? parseInt(offset as string, 10) : undefined, 
      fields: fields as string 
    });
    return res.status(200).json({ success: true, vehicleId: req.params.vehicleId, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:vehicleId/trips', authMiddleware, async (req, res) => {
  try {
    const { from, to, status, limit, offset } = req.query;
    const result = await listVehicleTrips(req.params.vehicleId, {
      from: from as string, to: to as string, status: status as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined
    });
    return res.status(200).json({ success: true, vehicleId: req.params.vehicleId, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:vehicleId/alerts', authMiddleware, async (req, res) => {
  try {
    const { status, severity, limit, offset } = req.query;
    const result = await listVehicleAlerts(req.params.vehicleId, {
      status: status as string, severity: severity as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined
    });
    return res.status(200).json({ success: true, vehicleId: req.params.vehicleId, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

export default router;
