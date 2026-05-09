export type AuthErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'SERVICE_UNAVAILABLE';

export class AuthError extends Error {
  public code: AuthErrorCode;
  public statusCode: number;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode =
      code === 'UNAUTHORIZED' ? 401 : code === 'FORBIDDEN' ? 403 : 503;
  }

  static unauthorized(message = 'Missing or invalid authentication token.') {
    return new AuthError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new AuthError('FORBIDDEN', message);
  }

  static serviceUnavailable(message = 'Service is temporarily unavailable.') {
    return new AuthError('SERVICE_UNAVAILABLE', message);
  }
}
