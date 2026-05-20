import { AuthContext } from '../../auth/types';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      admin?: boolean;
      user?: any;
      deviceId?: string;
    }
  }
}

export {};
