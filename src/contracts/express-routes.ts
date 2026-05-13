import type { Express, RequestHandler } from 'express';

import { env } from '../config/env';
import { prisma } from '../lib/prisma';

export type ExpressRouteDefinition = {
  method: 'get';
  path: string;
  summary: string;
  description: string;
  tags: string[];
  responseStatusCodes: number[];
  handler: RequestHandler;
};

const healthHandler: RequestHandler = async (_request, response) => {
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
    clientReady,
  });
};

export const expressRouteDefinitions: ExpressRouteDefinition[] = [
  {
    method: 'get',
    path: '/health',
    summary: 'Check Express backend health',
    description:
      'Returns the Express runtime status and whether the Prisma database probe can complete.',
    tags: ['System'],
    responseStatusCodes: [200],
    handler: healthHandler,
  },
];

export function registerExpressRoutes(app: Express) {
  for (const route of expressRouteDefinitions) {
    switch (route.method) {
      case 'get':
        app.get(route.path, route.handler);
        break;
      default: {
        const exhaustiveCheck: never = route.method;
        throw new Error(`Unsupported method: ${exhaustiveCheck}`);
      }
    }
  }
}
