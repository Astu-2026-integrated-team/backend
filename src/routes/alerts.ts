import express from 'express';
const router = express.Router();
import { z  } from 'zod';
import { authMiddleware  } from '../middleware/auth-middleware';
import { listAlerts, getAlert, resolveAlert  } from '../services/alert-service';
import { ERROR_CODES  } from '../config/constants';

const STATUS_MAP = {
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_PAYLOAD]: 400
};

const resolveAlertSchema = z.object({
  status: z.enum(['acknowledged', 'resolved'])
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const result = await listAlerts({ status });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.get('/:alertId', authMiddleware, async (req, res) => {
  try {
    const alert = await getAlert(req.params.alertId);
    return res.status(200).json({ success: true, alert });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

router.patch('/:alertId/resolve', authMiddleware, async (req, res) => {
  try {
    const parsed = resolveAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    await resolveAlert(req.params.alertId, parsed.data.status);
    return res.status(200).json({ success: true, alertId: req.params.alertId, status: parsed.data.status, message: `Alert ${parsed.data.status}` });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

// For compatibility with spec which lists PATCH /api/alerts/:alertId
router.patch('/:alertId', authMiddleware, async (req, res) => {
  try {
    const parsed = resolveAlertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message } });
    }
    await resolveAlert(req.params.alertId, parsed.data.status);
    return res.status(200).json({ success: true, alertId: req.params.alertId, status: parsed.data.status, message: `Alert ${parsed.data.status}` });
  } catch (err) {
    const statusCode = STATUS_MAP[(err as any).code] || 500;
    return res.status(statusCode).json({ success: false, error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message } });
  }
});

export default router;
