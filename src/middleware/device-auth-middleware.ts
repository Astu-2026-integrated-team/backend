import { ERROR_CODES  } from '../config/constants';
import { supabase  } from '../db/supabase-client';

const deviceAuthMiddleware = async (req, res, next) => {
  const deviceToken = req.headers['x-device-token'];
  const deviceId = req.headers['x-device-id'];

  if (deviceToken !== process.env.AUTH_DEVICE_TOKEN_PEPPER) {
    return res.status(401).json({
      accepted: false,
      error: { code: ERROR_CODES.FORBIDDEN, message: 'Invalid device token' }
    });
  }

  if (!deviceId) {
    return res.status(401).json({
      accepted: false,
      error: { code: ERROR_CODES.UNKNOWN_DEVICE, message: 'X-Device-Id header is required' }
    });
  }

  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('vehicleId')
      .eq('deviceId', deviceId)
      .single();

    if (error || !device) {
      return res.status(401).json({
        accepted: false,
        error: { code: ERROR_CODES.UNKNOWN_DEVICE, message: 'Device not registered' }
      });
    }

    req.deviceId = deviceId;
    req.vehicleId = device.vehicleId;
    next();
  } catch {
    return res.status(500).json({
      accepted: false,
      error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error during device auth' }
    });
  }
};

export { deviceAuthMiddleware };
