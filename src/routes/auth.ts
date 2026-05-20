import express from 'express';
const router = express.Router();
import { z  } from 'zod';
import { loginAdmin  } from '../services/auth-service';
import { ERROR_CODES  } from '../config/constants';

const STATUS_MAP = {
  [ERROR_CODES.INVALID_CREDENTIALS]: 401,
  [ERROR_CODES.INVALID_PAYLOAD]: 400
};

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: ERROR_CODES.INVALID_PAYLOAD, message: (parsed as any).error.errors[0].message }
      });
    }

    const result = await loginAdmin(parsed.data.username, parsed.data.password);
    return res.status(200).json({
      success: true,
      token: result.token,
      expiresIn: '24h',
      admin: result.admin
    });
  } catch (err) {
    const status = STATUS_MAP[(err as any).code] || 500;
    return res.status(status).json({
      success: false,
      error: { code: (err as any).code || ERROR_CODES.INTERNAL_ERROR, message: err.message }
    });
  }
});

export default router;
