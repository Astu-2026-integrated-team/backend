import jwt, { JwtPayload, VerifyErrors, VerifyCallback } from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthError } from './errors';

function getSupabaseJwtSecret(): string {
  if (!env.supabaseJwtSecret) {
    throw AuthError.serviceUnavailable(
      'User authentication is not configured on this service.'
    );
  }

  return env.supabaseJwtSecret;
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
 * Verifies a Supabase user JWT.
 * Validates the signature using HS256, checks expiration, and ensures the audience is 'authenticated'.
 * @param token The JWT string to verify.
 * @returns The subject (user ID) and optionally the email from the token.
 * @throws {AuthError} If the token is invalid, expired, or has wrong audience.
 */
export async function verifyUserToken(token: string): Promise<{ subject: string; email: string | null }> {
  try {
    const secretKey = getSupabaseJwtSecret();
    const payload = await new Promise<JwtPayload>((resolve, reject) => {
      jwt.verify(
        token,
        secretKey,
        {
          audience: 'authenticated',
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
    };
  } catch (error) {
    if (error instanceof AuthError) {
      throw error;
    }
    // Default error mapping
    throw AuthError.unauthorized('Invalid or expired token.');
  }
}
