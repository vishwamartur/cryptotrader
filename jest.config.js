/** @type {import('jest').Config} */
const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        target: 'es2020',
        lib: ['es2020'],
        allowJs: true,
        skipLibCheck: true,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true
      }
    }]
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.js'],
  collectCoverageFrom: [
    'components/**/*.tsx',
    'lib/**/*.ts',
    'app/api/**/*.ts',
    'hooks/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/**/*.test.ts',
    '!lib/**/index.ts',
    '!**/*.config.ts',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'json-summary',
    'lcov',
    'html'
  ],
  testTimeout: 30000,
  maxWorkers: '50%',
  verbose: true,
  detectOpenHandles: true,
  forceExit: false,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true
};

// Different configurations for different test types
const configs = {
  // Default configuration (CI tests)
  default: {
    ...baseConfig,
    testMatch: ['**/__tests__/**/ci.test.ts'],
    coverageThreshold: {
      global: {
        branches: 10,
        functions: 10,
        lines: 10,
        statements: 10
      }
    }
  },

  // Unit tests configuration
  unit: {
    ...baseConfig,
    testMatch: ['**/__tests__/unit/**/*.test.ts'],
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    testTimeout: 10000
  },

  // Integration tests configuration
  integration: {
    ...baseConfig,
    testMatch: ['**/__tests__/integration/**/*.test.ts'],
    testTimeout: 60000,
    setupFilesAfterEnv: [
      '<rootDir>/__tests__/jest.setup.js',
      '<rootDir>/__tests__/integration/setup.ts'
    ]
  },

  // Security tests configuration
  security: {
    ...baseConfig,
    testMatch: ['**/__tests__/security/**/*.test.ts'],
    testTimeout: 30000
  },

  // Performance tests configuration
  performance: {
    ...baseConfig,
    testMatch: ['**/__tests__/performance/**/*.test.ts'],
    testTimeout: 120000,
    maxWorkers: 1 // Run performance tests sequentially
  },

  // UAT tests configuration
  uat: {
    ...baseConfig,
    testMatch: ['**/__tests__/uat/**/*.test.ts'],
    testTimeout: 60000,
    testEnvironment: 'jsdom'
  },

  // All tests configuration
  all: {
    ...baseConfig,
    testMatch: [
      '**/__tests__/unit/**/*.test.ts',
      '**/__tests__/integration/**/*.test.ts',
      '**/__tests__/security/**/*.test.ts',
      '**/__tests__/performance/**/*.test.ts',
      '**/__tests__/uat/**/*.test.ts'
    ],
    coverageThreshold: {
      global: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    },
    testTimeout: 60000
  }
};

// Export the appropriate configuration based on environment variable
const testType = process.env.TEST_TYPE || 'default';
module.exports = configs[testType] || configs.default;
