process.env.APP_ENV ??= 'development';
process.env.SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.SUPABASE_ANON_KEY ??= 'dummy-anon-key';
process.env.SUPABASE_JWT_SECRET ??= 'dummy-jwt-secret-that-must-be-at-least-32-chars-long';
process.env.AUTH_DEVICE_TOKEN_PEPPER ??= 'dummy-pepper';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('../src/app');

process.stdout.write('Node app imports successfully.\n');
