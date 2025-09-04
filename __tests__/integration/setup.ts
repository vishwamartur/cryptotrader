/**
 * Integration Test Setup
 * Configures the test environment for integration tests
 */

// Mock environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.PERPLEXITY_API_KEY = 'test-api-key';
process.env.DELTA_EXCHANGE_API_KEY = 'test-delta-key';
process.env.DELTA_EXCHANGE_API_SECRET = 'test-delta-secret';

// Mock fetch for API calls
global.fetch = jest.fn();

// Setup global test utilities
beforeEach(() => {
  // Reset all mocks before each test
  jest.clearAllMocks();
  
  // Reset fetch mock
  (global.fetch as jest.Mock).mockClear();
});

afterEach(() => {
  // Clean up after each test
  jest.restoreAllMocks();
});

// Global test timeout
jest.setTimeout(60000);

export {};
