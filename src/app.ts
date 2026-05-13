import express from 'express';

import { registerExpressRoutes } from './contracts/express-routes';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { apiRouter } from './routes/index';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use('/api', apiRouter);
<<<<<<< HEAD

app.get('/health', async (_request, response) => {
  let clientReady = false;
  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      clientReady = true;
    } catch {
      clientReady = false;
    }
  }
  response.json({
    status: 'ok',
    appName: env.appName,
    environment: env.appEnv,
    prismaConfigured: env.prismaConfigured,
    authConfigured: env.authConfigured,
    clientReady,
  });
});
=======
registerExpressRoutes(app);
>>>>>>> 3e4cd9b (feat: add Express OpenAPI contract validation)

app.use(notFoundHandler);
app.use(errorHandler);
