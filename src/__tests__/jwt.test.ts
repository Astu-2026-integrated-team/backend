import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

jest.mock('dotenv', () => ({ config: jest.fn() }));

const loadJwtModule = async () => import('../auth/jwt');

describe('JWT Utilities', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.SUPABASE_JWT_SECRET;
  });

  describe('extractBearerToken', () => {
    it('returns null if header is undefined', async () => {
      const { extractBearerToken } = await loadJwtModule();
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it('returns null if header does not start with Bearer', async () => {
      const { extractBearerToken } = await loadJwtModule();
      expect(extractBearerToken('Basic some-token')).toBeNull();
    });

    it('returns the token when correctly formatted', async () => {
      const { extractBearerToken } = await loadJwtModule();
      expect(extractBearerToken('Bearer my-secret-token')).toBe('my-secret-token');
    });

    it('returns null if header is malformed', async () => {
      const { extractBearerToken } = await loadJwtModule();
      expect(extractBearerToken('Bearer')).toBeNull();
    });
  });

  describe('verifyUserToken', () => {
    const loadVerifyUserToken = async () => {
      const jwtModule = await loadJwtModule();
      return jwtModule.verifyUserToken;
    };

    const createValidToken = (secretKey: string, payload: Record<string, unknown> = {}) => {
      return jwt.sign(
        { sub: 'user-123', email: 'test@example.com', ...payload },
        secretKey,
        { algorithm: 'HS256', audience: 'authenticated', expiresIn: '1h' }
      );
    };

    it('successfully verifies a valid Supabase HS256 token', async () => {
      process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
      const verifyUserToken = await loadVerifyUserToken();
      const token = createValidToken(process.env.SUPABASE_JWT_SECRET);
      const result = await verifyUserToken(token);

      expect(result).toEqual({
        subject: 'user-123',
        email: 'test@example.com',
      });
    });

    it('throws AuthError if token has wrong audience', async () => {
      process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
      const verifyUserToken = await loadVerifyUserToken();
      const token = jwt.sign(
        { sub: 'user-123' },
        process.env.SUPABASE_JWT_SECRET,
        { algorithm: 'HS256', audience: 'wrong-audience', expiresIn: '1h' }
      );

      await expect(verifyUserToken(token)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      });
    });

    it('throws AuthError if token is expired', async () => {
      process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
      const verifyUserToken = await loadVerifyUserToken();
      // Create token that expired 1 hour ago
      const token = jwt.sign(
        { sub: 'user-123', exp: Math.floor(Date.now() / 1000) - 3600 },
        process.env.SUPABASE_JWT_SECRET,
        { algorithm: 'HS256', audience: 'authenticated' }
      );

      await expect(verifyUserToken(token)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token.',
      });
    });

    it('throws AuthError if subject claim is missing', async () => {
      process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
      const verifyUserToken = await loadVerifyUserToken();
      const token = jwt.sign(
        { email: 'test@example.com' },
        process.env.SUPABASE_JWT_SECRET,
        { algorithm: 'HS256', audience: 'authenticated', expiresIn: '1h' }
      );

      await expect(verifyUserToken(token)).rejects.toThrow('Token is missing subject claim.');
    });

    it('handles missing email claim correctly', async () => {
      process.env.SUPABASE_JWT_SECRET = 'test-jwt-secret';
      const verifyUserToken = await loadVerifyUserToken();
      const token = jwt.sign(
        { sub: 'user-456' },
        process.env.SUPABASE_JWT_SECRET,
        { algorithm: 'HS256', audience: 'authenticated', expiresIn: '1h' }
      );

      const result = await verifyUserToken(token);

      expect(result).toEqual({
        subject: 'user-456',
        email: null,
      });
    });

    it('throws service unavailable when JWT auth is not configured', async () => {
      delete process.env.SUPABASE_JWT_SECRET;
      const verifyUserToken = await loadVerifyUserToken();

      await expect(verifyUserToken('token')).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        message: 'User authentication is not configured on this service.',
      });
    });
  });
});
