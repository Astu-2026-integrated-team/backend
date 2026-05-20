import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signAdminToken } from '../auth/jwt';
import { prisma } from '../lib/prisma';

const loginBodySchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .strict();

const authRouter = Router();

function writeError(
  response: import('express').Response,
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

async function loadAdminUser(username: string) {
  if (!prisma) {
    throw new Error('Database is not configured.');
  }

  const adminUser = await prisma.adminUser.findUnique({
    where: { username },
  });

  if (!adminUser) {
    const error = new Error('Username or password is incorrect');
    error.name = 'InvalidCredentialsError';
    throw error;
  }

  return adminUser;
}

async function verifyPassword(password: string, passwordHash: string) {
  const matches = await bcrypt.compare(password, passwordHash);

  if (!matches) {
    const error = new Error('Username or password is incorrect');
    error.name = 'InvalidCredentialsError';
    throw error;
  }
}

function buildSuccessPayload(
  adminUser: Awaited<ReturnType<typeof loadAdminUser>>,
) {
  return {
    success: true,
    token: signAdminToken({
      subject: adminUser.adminId,
      username: adminUser.username,
      role: 'admin',
    }),
    admin: {
      adminId: adminUser.adminId,
      username: adminUser.username,
    },
  };
}

async function updateLastLogin(adminId: string) {
  if (!prisma) {
    throw new Error('Database is not configured.');
  }

  await prisma.adminUser.update({
    where: { adminId },
    data: {
      lastLoginAt: new Date(),
    },
  });
}

authRouter.post('/login', async (req, res) => {
  const parsedBody = loginBodySchema.safeParse(req.body);
  if (!parsedBody.success) {
    writeError(res, 400, 'INVALID_PAYLOAD', 'Invalid login request body.');
    return;
  }

  try {
    const adminUser = await loadAdminUser(parsedBody.data.username);
    await verifyPassword(parsedBody.data.password, adminUser.passwordHash);
    await updateLastLogin(adminUser.adminId);

    res.json(buildSuccessPayload(adminUser));
  } catch (error) {
    if (error instanceof Error && error.name === 'InvalidCredentialsError') {
      writeError(res, 401, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
      return;
    }

    if (error instanceof Error && error.message === 'Database is not configured.') {
      writeError(res, 503, 'SERVICE_UNAVAILABLE', 'Authentication database is not configured.');
      return;
    }

    console.error('Login request failed', error);
    writeError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
  }
});

export { authRouter };
