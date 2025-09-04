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

// Mock WebSocket with enhanced functionality for Delta Exchange WebSocket testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen(new Event('open'));
    }, 10);
  }

  send(data) {
    // Mock send functionality
    this.lastSentData = data;
  }

  close(code = 1000, reason = 'Normal closure') {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose({ code, reason });
  }

  addEventListener(event, handler) {
    this[`on${event}`] = handler;
  }

  removeEventListener(event, handler) {
    this[`on${event}`] = null;
  }

  // Helper method for testing
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(error) {
    if (this.onerror) {
      this.onerror(error);
    }
  }
}

MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSING = 2;
MockWebSocket.CLOSED = 3;

global.WebSocket = MockWebSocket;

// Mock crypto API with HMAC support for WebSocket authentication
const crypto = require('crypto');

global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  createHmac: crypto.createHmac,
  createCipher: crypto.createCipher,
  createCipherGCM: crypto.createCipherGCM,
  createDecipher: crypto.createDecipher,
  createDecipherGCM: crypto.createDecipherGCM,
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
