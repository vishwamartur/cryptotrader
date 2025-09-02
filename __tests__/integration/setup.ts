// Integration test setup
import { jest } from '@jest/globals';

// Mock Next.js modules for integration tests
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((data, options) => ({
      json: async () => data,
      status: options?.status || 200
    }))
  }
}));

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = 'test-key';
process.env.DELTA_API_KEY = 'test-key';
process.env.DELTA_API_SECRET = 'test-secret';

// Global test timeout
jest.setTimeout(60000);

// Mock fetch globally
global.fetch = jest.fn();

// Setup console to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
