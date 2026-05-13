import { readFileSync } from 'node:fs';
import path from 'node:path';

type OpenApiDocument = {
  openapi?: string;
  paths?: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
};

function normalizeSpec(spec: OpenApiDocument) {
  const normalized: Record<string, Record<string, string[]>> = {};

  for (const [path, operations] of Object.entries(spec.paths ?? {})) {
    normalized[path] = {};
    for (const [method, operation] of Object.entries(operations)) {
      normalized[path][method] = Object.keys(operation.responses ?? {}).sort();
    }
  }

  return normalized;
}

function normalizeRoutes(
  expressRouteDefinitions: Array<{
    method: string;
    path: string;
    responseStatusCodes: number[];
  }>,
) {
  const normalized: Record<string, Record<string, string[]>> = {};

  for (const route of expressRouteDefinitions) {
    normalized[route.path] = {
      [route.method]: route.responseStatusCodes.map((statusCode) => String(statusCode)).sort(),
    };
  }

  return normalized;
}

process.env.APP_ENV ??= 'development';
process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY ??= 'dummy-anon-key';
process.env.SUPABASE_JWT_SECRET ??= 'dummy-jwt-secret-that-must-be-at-least-32-chars-long';
process.env.AUTH_DEVICE_TOKEN_PEPPER ??= 'dummy-pepper';

const spec = JSON.parse(
  readFileSync(path.resolve(process.cwd(), 'openapi/express.json'), 'utf-8'),
) as OpenApiDocument;

if (!spec.openapi || !spec.paths) {
  throw new Error('openapi/express.json is not a valid OpenAPI document.');
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { expressRouteDefinitions } = require('../src/contracts/express-routes') as typeof import('../src/contracts/express-routes');

const expected = normalizeRoutes(expressRouteDefinitions);
const documented = normalizeSpec(spec);

if (JSON.stringify(expected) !== JSON.stringify(documented)) {
  throw new Error(
    `Express OpenAPI contract mismatch.\nExpected: ${JSON.stringify(expected, null, 2)}\nDocumented: ${JSON.stringify(documented, null, 2)}`,
  );
}

console.log('Express OpenAPI contract matches route definitions.');
