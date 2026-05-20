import jwt, { JwtPayload, SignOptions, VerifyErrors, VerifyCallback } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthError } from './errors';
import { AppRole, isAppRole } from './types';

function getJwtSecret(): string {
  if (!env.jwtSecret) {
    throw AuthError.serviceUnavailable(
      'User authentication is not configured on this service.'
    );
  }

  return env.jwtSecret;
}

/**
 * Extracts a Bearer token from the Authorization header.
 * @param authHeader The Authorization header value (e.g. "Bearer eyJ...")
 * @returns The token string, or null if not a valid Bearer token.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  
  return null;
}

/**
 * Verifies an application JWT.
 * Validates the signature using HS256 and checks expiration.
 * @param token The JWT string to verify.
 * @returns The subject plus optional identity claims from the token.
 * @throws {AuthError} If the token is invalid, expired, or has wrong audience.
 */
export async function verifyUserToken(
  token: string,
): Promise<{ subject: string; email: string | null; role: AppRole | null; username: string | null }> {
  try {
    const secretKey = getJwtSecret();
    const payload = await new Promise<JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        secretKey,
        {
          algorithms: ['HS256'],
        },
        ((err: VerifyErrors | null, decoded: object | string | undefined) => {
          if (err) return reject(err);
          if (!decoded || typeof decoded === 'string') {
            return reject(AuthError.unauthorized('Invalid or expired token.'));
          }

          resolve(decoded as JwtPayload);
        }) as VerifyCallback
      );
    });

    if (!payload.sub) {
      throw AuthError.unauthorized('Token is missing subject claim.');
    }

    return {
      subject: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      role: typeof payload.role === 'string' && isAppRole(payload.role) ? payload.role : null,
      username: typeof payload.username === 'string' ? payload.username : null,
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    // Default error mapping
    throw AuthError.unauthorized('Invalid or expired token.');
  }
}

export function signAdminToken(payload: { subject: string; username: string; role?: AppRole }) {
  const secretKey = getJwtSecret();
  const role = payload.role ?? 'admin';
  const options: SignOptions = {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
    subject: payload.subject,
  };

  return jwt.sign(
    {
      username: payload.username,
      role,
    },
    secretKey,
    options,
  );
}
