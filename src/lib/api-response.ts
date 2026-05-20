import type { Response } from 'express';

export function writeApiError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
