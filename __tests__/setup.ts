// Test Setup and Global Configuration
// This file runs before all tests to set up the testing environment

import { jest } from '@jest/globals';

// Mock WebSocket for testing
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back for testing
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data }));
      }
    }, 1);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
    }
  }
}

// Mock performance.now for consistent timing in tests
const mockPerformanceNow = jest.fn(() => Date.now());

// Set up global mocks
beforeAll(() => {
  // Mock WebSocket
  (global as any).WebSocket = MockWebSocket;
  
  // Mock performance.now
  Object.defineProperty(global, 'performance', {
    value: {
      now: mockPerformanceNow
    },
    writable: true
  });

  // Mock console methods to reduce noise in tests
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});

  // Set up environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.PERPLEXITY_API_KEY = 'test-api-key';
  
  // Mock fetch for API calls
  (global as any).fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        id: 'cmpl-test',
        choices: [{
          message: {
            role: 'assistant',
            content: JSON.stringify({
              signal: 'HOLD',
              confidence: 50,
              reasoning: 'Test reasoning',
              positionSize: 100,
              entryPrice: 45000,
              stopLoss: 44000,
              takeProfit: 46000,
              riskReward: 1.0
            })
          }
        }]
      }),
      text: () => Promise.resolve(JSON.stringify({
        choices: [{ message: { content: '{"signal":"HOLD","confidence":50}' } }]
      }))
    })
  );
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  mockPerformanceNow.mockReturnValue(Date.now());
});

// Clean up after all tests
afterAll(() => {
  jest.restoreAllMocks();
});

// Global test utilities
export const testUtils = {
  // Generate mock market data
  generateMockMarketData: (count: number = 100, symbol: string = 'BTC-USD') => {
    const data = [];
    let price = 45000;
    const baseTime = Date.now() - (count * 60000); // 1 minute intervals
    
    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 1000;
      price = Math.max(1000, price + change);
      
      data.push({
        symbol,
        price,
        volume: Math.random() * 1000000 + 100000,
        timestamp: baseTime + (i * 60000),
        bid: price - Math.random() * 10,
        ask: price + Math.random() * 10,
        high24h: price + Math.random() * 500,
        low24h: price - Math.random() * 500,
        change: change,
        changePercent: (change / price) * 100,
        lastUpdated: baseTime + (i * 60000)
      });
    }
    
    return data;
  },

  // Generate mock positions
  generateMockPositions: (count: number = 5) => {
    return Array(count).fill(null).map((_, i) => ({
      id: i.toString(),
      product: {
        symbol: `SYMBOL_${i}`,
        description: `Test Asset ${i}`
      },
      size: (Math.random() * 10).toFixed(4),
      entry_price: (Math.random() * 1000 + 100).toFixed(2),
      mark_price: (Math.random() * 1000 + 100).toFixed(2),
      realized_pnl: (Math.random() * 200 - 100).toFixed(2),
      unrealized_pnl: (Math.random() * 200 - 100).toFixed(2)
    }));
  },

  // Generate mock order book data
  generateMockOrderBook: (symbol: string = 'BTC-USD', levels: number = 10) => {
    const midPrice = 45000 + (Math.random() - 0.5) * 1000;
    const bids: [number, number][] = [];
    const asks: [number, number][] = [];
    
    for (let i = 0; i < levels; i++) {
      bids.push([midPrice - (i + 1) * 0.5, Math.random() * 10 + 1]);
      asks.push([midPrice + (i + 1) * 0.5, Math.random() * 10 + 1]);
    }
    
    return {
      symbol,
      timestamp: Date.now(),
      bids: bids.sort((a, b) => b[0] - a[0]), // Sort descending
      asks: asks.sort((a, b) => a[0] - b[0])  // Sort ascending
    };
  },

  // Wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Create mock technical features for ML testing
  generateMockTechnicalFeatures: (count: number = 100) => {
    return Array(count).fill(null).map(() => ({
      price: Math.random() * 10000 + 40000,
      volume: Math.random() * 1000000,
      returns: (Math.random() - 0.5) * 0.1,
      volatility: Math.random() * 0.05,
      sma_5: Math.random() * 10000 + 40000,
      sma_20: Math.random() * 10000 + 40000,
      ema_12: Math.random() * 10000 + 40000,
      ema_26: Math.random() * 10000 + 40000,
      rsi: Math.random() * 100,
      macd: (Math.random() - 0.5) * 100,
      macd_signal: (Math.random() - 0.5) * 100,
      bollinger_upper: Math.random() * 10000 + 41000,
      bollinger_lower: Math.random() * 10000 + 39000,
      volume_sma: Math.random() * 1000000,
      price_momentum: (Math.random() - 0.5) * 0.1,
      volume_momentum: (Math.random() - 0.5) * 0.1
    }));
  },

  // Validate trading signal format
  validateTradingSignal: (signal: any) => {
    expect(signal).toBeDefined();
    expect(signal.action).toMatch(/buy|sell|hold/i);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
    return true;
  },

  // Validate backtest result format
  validateBacktestResult: (result: any) => {
    expect(result).toBeDefined();
    expect(typeof result.totalReturn).toBe('number');
    expect(typeof result.sharpeRatio).toBe('number');
    expect(typeof result.maxDrawdown).toBe('number');
    expect(typeof result.totalTrades).toBe('number');
    expect(Array.isArray(result.portfolioValues)).toBe(true);
    expect(Array.isArray(result.returns)).toBe(true);
    expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    return true;
  },

  // Validate risk metrics format
  validateRiskMetrics: (metrics: any) => {
    expect(metrics).toBeDefined();
    expect(typeof metrics.totalExposure).toBe('number');
    expect(typeof metrics.portfolioRisk).toBe('number');
    expect(typeof metrics.currentDrawdown).toBe('number');
    expect(metrics.totalExposure).toBeGreaterThanOrEqual(0);
    expect(metrics.portfolioRisk).toBeGreaterThanOrEqual(0);
    expect(metrics.currentDrawdown).toBeGreaterThanOrEqual(0);
    return true;
  },

  // Mock API responses
  mockApiResponse: (data: any) => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
      text: () => Promise.resolve(JSON.stringify(data))
    });
  },

  // Mock API error
  mockApiError: (error: string = 'API Error') => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(error));
  }
};

// Export for use in tests
export { MockWebSocket };

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase timeout for integration tests
jest.setTimeout(30000);
