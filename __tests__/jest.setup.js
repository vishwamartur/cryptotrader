// Mock performance API for Node.js environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: () => {},
    measure: () => {},
    getEntriesByName: () => [],
    getEntriesByType: () => [],
    clearMarks: () => {},
    clearMeasures: () => {},
  };
}

// Mock fetch for AI API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({
      content: [{
        text: JSON.stringify({
          action: 'hold',
          confidence: 0.5,
          reasoning: 'Market conditions are neutral',
          riskLevel: 'medium'
        })
      }]
    }),
  })
);

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
}));

// Mock crypto API
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
};

// Suppress console.log in tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  // Reset mocks
  jest.clearAllMocks();
  
  // Suppress noisy console output in tests
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  // Restore console for debugging when needed
  if (process.env.JEST_VERBOSE) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  }
});
