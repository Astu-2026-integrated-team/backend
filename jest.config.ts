import type { Config } from 'jest';

const config: Config = {
  coverageThreshold: {
    global: {
      branches: 95, functions: 95, lines: 95, statements: 95
    },
    './src/services/alert-rule-engine.ts': {
      branches: 100, functions: 100, lines: 100, statements: 100
    },
    './src/services/trip-service.ts': {
      branches: 95, functions: 100, lines: 95, statements: 95
    },
    './src/services/telemetry-service.ts': {
      branches: 95, functions: 100, lines: 95, statements: 95
    }
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/db/*.ts'
  ],
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  setupFiles: ['<rootDir>/jest.setup.ts']
};

export default config;
