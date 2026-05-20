import jwt from 'jsonwebtoken';
import { ERROR_CODES  } from '../config/constants';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: ERROR_CODES.MISSING_TOKEN, message: 'Authorization header with Bearer token is required' }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, (process.env.JWT_SECRET as string));
    req.admin = (decoded as any).admin || decoded; // assuming the payload has admin info
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: ERROR_CODES.INVALID_TOKEN, message: 'Token is expired or invalid' }
    });
  }
};

export { authMiddleware };
