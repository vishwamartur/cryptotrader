// API Integration Tests
// Tests all API endpoints for functionality and error handling

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { testUtils } from './setup';

// Mock Next.js request/response for testing
const mockRequest = (body: any, method: string = 'POST', url: string = 'http://localhost:3000/api/test') => ({
  json: async () => body,
  url,
  method
});

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('API Integration Tests', () => {
  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
    process.env.PERPLEXITY_API_KEY = 'test-api-key';
  });

  afterAll(() => {
    // Clean up
    jest.restoreAllMocks();
  });

  describe('AI Trading API', () => {
    test('should analyze market data successfully', async () => {
      const { POST } = await import('../app/api/ai/analyze/route');
      
      const mockMarketData = testUtils.generateMockMarketData(10);
      const mockPositions = testUtils.generateMockPositions(2);
      
      const request = mockRequest({
        marketData: mockMarketData,
        positions: mockPositions,
        balance: 10000
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.signal).toMatch(/BUY|SELL|HOLD/);
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
      expect(result.data.confidence).toBeLessThanOrEqual(1);
    });

    test('should handle invalid market data', async () => {
      const { POST } = await import('../app/api/ai/analyze/route');
      
      const request = mockRequest({
        marketData: [], // Empty array
        positions: [],
        balance: 10000
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(response.status).toHaveBeenCalledWith(400);
    });

    test('should handle missing required fields', async () => {
      const { POST } = await import('../app/api/ai/analyze/route');
      
      const request = mockRequest({
        // Missing marketData
        positions: [],
        balance: 10000
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Risk Management API', () => {
    test('should calculate risk metrics successfully', async () => {
      const { POST } = await import('../app/api/risk/metrics/route');
      
      const mockPositions = testUtils.generateMockPositions(3);
      
      const request = mockRequest({
        positions: mockPositions,
        balance: 10000
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.totalExposure).toBe('number');
      expect(typeof result.data.portfolioRisk).toBe('number');
      expect(result.data.totalExposure).toBeGreaterThanOrEqual(0);
    });

    test('should validate trade successfully', async () => {
      const { POST } = await import('../app/api/risk/validate-trade/route');
      
      const request = mockRequest({
        signal: 'BUY',
        symbol: 'BTC-USD',
        positionSize: 1000,
        positions: [],
        balance: 10000
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.allowed).toBe('boolean');
      expect(typeof result.data.riskScore).toBe('number');
      expect(result.data.adjustedSize).toBeGreaterThan(0);
    });

    test('should reject invalid trade signals', async () => {
      const { POST } = await import('../app/api/risk/validate-trade/route');
      
      const request = mockRequest({
        signal: 'INVALID', // Invalid signal
        symbol: 'BTC-USD',
        positionSize: 1000,
        positions: [],
        balance: 10000
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Strategies API', () => {
    test('should list available strategies', async () => {
      const { GET } = await import('../app/api/strategies/list/route');
      
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/strategies/list');
      
      const response = await GET(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.strategies).toBeDefined();
      expect(Array.isArray(result.data.strategies)).toBe(true);
      expect(result.data.strategies.length).toBeGreaterThan(0);
      
      // Check strategy structure
      const strategy = result.data.strategies[0];
      expect(strategy.name).toBeDefined();
      expect(strategy.description).toBeDefined();
      expect(strategy.category).toBeDefined();
      expect(Array.isArray(strategy.parameters)).toBe(true);
    });

    test('should execute strategy successfully', async () => {
      const { POST } = await import('../app/api/strategies/execute/route');
      
      const request = mockRequest({
        strategy: 'MovingAverageCrossover',
        data: {
          prices: [44000, 44500, 45000, 45200, 45100, 45300, 45150, 45400]
        },
        parameters: {
          shortPeriod: 3,
          longPeriod: 5
        }
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.action).toMatch(/BUY|SELL|HOLD/);
      expect(typeof result.data.confidence).toBe('number');
    });

    test('should handle unknown strategy', async () => {
      const { POST } = await import('../app/api/strategies/execute/route');
      
      const request = mockRequest({
        strategy: 'UnknownStrategy',
        data: { prices: [100, 101, 102] }
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('STRATEGY_NOT_FOUND');
    });
  });

  describe('Backtesting API', () => {
    test('should run backtest successfully', async () => {
      const { POST } = await import('../app/api/backtest/run/route');
      
      const mockData = testUtils.generateMockMarketData(100);
      
      const request = mockRequest({
        strategy: 'MovingAverageCrossover',
        data: mockData,
        parameters: {
          transactionCost: 0.001,
          slippage: 0.0005,
          initialCapital: 10000
        }
      });

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.totalReturn).toBe('number');
      expect(typeof result.data.sharpeRatio).toBe('number');
      expect(typeof result.data.maxDrawdown).toBe('number');
      expect(typeof result.data.totalTrades).toBe('number');
      expect(Array.isArray(result.data.portfolioValues)).toBe(true);
      expect(result.data.metadata).toBeDefined();
    });

    test('should handle insufficient data', async () => {
      const { POST } = await import('../app/api/backtest/run/route');
      
      const request = mockRequest({
        strategy: 'MovingAverageCrossover',
        data: testUtils.generateMockMarketData(5), // Too few data points
        parameters: {
          transactionCost: 0.001,
          slippage: 0.0005,
          initialCapital: 10000
        }
      });

      const response = await POST(request as any);
      const result = await response.json();

      // Should either succeed with limited data or return appropriate error
      if (result.error) {
        expect(result.code).toMatch(/INSUFFICIENT_DATA|VALIDATION_ERROR/);
      } else {
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Portfolio API', () => {
    test('should get portfolio status successfully', async () => {
      const { GET } = await import('../app/api/portfolio/status/route');
      
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/portfolio/status');
      
      const response = await GET(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(typeof result.data.totalValue).toBe('number');
      expect(typeof result.data.totalPnL).toBe('number');
      expect(Array.isArray(result.data.positions)).toBe(true);
      expect(result.data.allocation).toBeDefined();
      expect(result.data.performance).toBeDefined();
    });

    test('should filter portfolio by symbol', async () => {
      const { GET } = await import('../app/api/portfolio/status/route');
      
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/portfolio/status?symbol=BTC-USD');
      
      const response = await GET(request as any);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.positions.length).toBeLessThanOrEqual(1);
      if (result.data.positions.length > 0) {
        expect(result.data.positions[0].symbol).toBe('BTC-USD');
      }
    });
  });

  describe('Market Data API', () => {
    test('should get real-time market data successfully', async () => {
      const { GET } = await import('../app/api/market/realtime/[symbol]/route');
      
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/market/realtime/BTC-USD');
      
      const response = await GET(request as any, { params: { symbol: 'BTC-USD' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.symbol).toBe('BTC-USD');
      expect(typeof result.data.price).toBe('number');
      expect(typeof result.data.volume).toBe('number');
      expect(result.data.price).toBeGreaterThan(0);
    });

    test('should handle unsupported symbol', async () => {
      const { GET } = await import('../app/api/market/realtime/[symbol]/route');
      
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/market/realtime/INVALID-SYMBOL');
      
      const response = await GET(request as any, { params: { symbol: 'INVALID-SYMBOL' } });
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('SYMBOL_NOT_SUPPORTED');
    });

    test('should include orderbook when requested', async () => {
      const { GET } = await import('../app/api/market/realtime/[symbol]/route');
      
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/market/realtime/BTC-USD?includeOrderbook=true');
      
      const response = await GET(request as any, { params: { symbol: 'BTC-USD' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.orderbook).toBeDefined();
      expect(Array.isArray(result.data.orderbook.bids)).toBe(true);
      expect(Array.isArray(result.data.orderbook.asks)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle method not allowed errors', async () => {
      const { GET } = await import('../app/api/ai/analyze/route');
      
      const response = await GET();
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('METHOD_NOT_ALLOWED');
    });

    test('should handle malformed JSON', async () => {
      const { POST } = await import('../app/api/ai/analyze/route');
      
      // Mock request with invalid JSON
      const request = {
        json: async () => { throw new Error('Invalid JSON'); },
        url: 'http://localhost:3000/api/ai/analyze',
        method: 'POST'
      };

      const response = await POST(request as any);
      const result = await response.json();

      expect(result.error).toBe(true);
      expect(result.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Performance Tests', () => {
    test('should handle concurrent API requests', async () => {
      const { GET } = await import('../app/api/portfolio/status/route');
      
      const requests = Array(10).fill(null).map(() => {
        const request = mockRequest({}, 'GET', 'http://localhost:3000/api/portfolio/status');
        return GET(request as any);
      });

      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        const result = await response.json();
        expect(result.success).toBe(true);
      }
    });

    test('should respond within acceptable time limits', async () => {
      const { GET } = await import('../app/api/market/realtime/[symbol]/route');
      
      const startTime = Date.now();
      const request = mockRequest({}, 'GET', 'http://localhost:3000/api/market/realtime/BTC-USD');
      const response = await GET(request as any, { params: { symbol: 'BTC-USD' } });
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
      
      const result = await response.json();
      expect(result.success).toBe(true);
    });
  });
});
