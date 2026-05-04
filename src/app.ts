import express from 'express';

import { env } from './config/env';
import { prisma } from './lib/prisma';
import { telemetryRouter } from './routes/telemetry';

export const app = express();

app.use(express.json());
app.use('/api', telemetryRouter);

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    appName: env.appName,
    environment: env.appEnv,
    prismaConfigured: env.prismaConfigured,
    clientReady: Boolean(prisma),
  });
});
