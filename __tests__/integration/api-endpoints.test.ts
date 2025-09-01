/**
 * Integration Tests for API Endpoints
 * Tests complete API functionality, data flow, and external integrations
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Mock Next.js API route handlers
const mockRequest = (method: string, body?: any, query?: any) => ({
  method,
  body,
  query,
  headers: {
    'content-type': 'application/json',
  },
});

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
};

// Mock external APIs
global.fetch = jest.fn();

describe('API Endpoints Integration Tests', () => {
  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
  });

  afterAll(async () => {
    // Cleanup
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check Endpoints', () => {
    test('GET /api/health should return system status', async () => {
      // Import the API route handler
      const { default: handler } = await import('../../app/api/health/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          timestamp: expect.any(String),
          services: expect.any(Object)
        })
      );
    });

    test('GET /api/health/detailed should return comprehensive health info', async () => {
      const { default: handler } = await import('../../app/api/health/detailed/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          database: expect.any(Object),
          apis: expect.any(Object)
        })
      );
    });

    test('GET /api/health/apis should check external API connectivity', async () => {
      // Mock successful API responses
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 'ok' })
      } as any);

      const { default: handler } = await import('../../app/api/health/apis/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          apis: expect.objectContaining({
            perplexity: expect.any(Object),
            coinbase: expect.any(Object),
            delta: expect.any(Object)
          })
        })
      );
    });
  });

  describe('AI Trading Endpoints', () => {
    test('POST /api/ai/analyze-market should analyze market data', async () => {
      // Mock AI API response
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                signal: 'BUY',
                confidence: 75,
                reasoning: 'Strong bullish momentum detected',
                positionSize: 0.1,
                entryPrice: 45000,
                stopLoss: 43500,
                takeProfit: 47500,
                riskReward: 2.3
              })
            }
          }]
        })
      } as any);

      const { default: handler } = await import('../../app/api/ai/analyze-market/route');
      
      const marketData = [
        { symbol: 'BTC-USD', price: 45000, volume: 1000000, timestamp: Date.now() }
      ];
      
      const req = mockRequest('POST', {
        marketData,
        positions: [],
        balance: 10000
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: 'BUY',
          confidence: 75,
          reasoning: expect.any(String)
        })
      );
    });

    test('POST /api/ai/execute-trade should execute autonomous trades', async () => {
      const { default: handler } = await import('../../app/api/ai/execute-trade/route');
      
      const req = mockRequest('POST', {
        analysis: {
          signal: 'BUY',
          confidence: 85,
          reasoning: 'High confidence signal',
          positionSize: 0.1,
          entryPrice: 45000,
          stopLoss: 43500,
          takeProfit: 47500,
          riskReward: 2.3
        },
        config: {
          enableAutonomousTrading: true,
          maxPositionSize: 0.1
        }
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: expect.any(Boolean),
          tradeId: expect.any(String)
        })
      );
    });

    test('should handle AI API failures gracefully', async () => {
      // Mock API failure
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValue(new Error('API Error'));

      const { default: handler } = await import('../../app/api/ai/analyze-market/route');
      
      const req = mockRequest('POST', {
        marketData: [],
        positions: [],
        balance: 10000
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: 'HOLD',
          confidence: expect.any(Number),
          reasoning: expect.stringContaining('analysis failed')
        })
      );
    });
  });

  describe('Market Data Endpoints', () => {
    test('GET /api/market/products should return available trading pairs', async () => {
      // Mock Coinbase API response
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            id: 'BTC-USD',
            display_name: 'BTC/USD',
            base_currency: 'BTC',
            quote_currency: 'USD',
            status: 'online'
          }
        ])
      } as any);

      const { default: handler } = await import('../../app/api/market/products/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          products: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              display_name: expect.any(String)
            })
          ])
        })
      );
    });

    test('GET /api/market/tickers should return current prices', async () => {
      // Mock ticker data
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            product_id: 'BTC-USD',
            price: '45000.00',
            volume_24h: '1000.50',
            price_percentage_change_24h: '2.5'
          }
        ])
      } as any);

      const { default: handler } = await import('../../app/api/market/tickers/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          tickers: expect.arrayContaining([
            expect.objectContaining({
              product_id: expect.any(String),
              price: expect.any(String)
            })
          ])
        })
      );
    });

    test('GET /api/market/realtime should establish WebSocket connection', async () => {
      const { default: handler } = await import('../../app/api/market/realtime/route');
      
      const req = mockRequest('GET', null, { symbols: 'BTC-USD,ETH-USD' });
      const res = mockResponse();

      await handler(req, res);

      // Should return WebSocket upgrade response or connection info
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('Portfolio Management Endpoints', () => {
    test('GET /api/portfolio/positions should return current positions', async () => {
      const { default: handler } = await import('../../app/api/portfolio/positions/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          positions: expect.any(Array),
          totalValue: expect.any(Number),
          unrealizedPnL: expect.any(Number)
        })
      );
    });

    test('GET /api/portfolio/balance should return account balance', async () => {
      const { default: handler } = await import('../../app/api/portfolio/balance/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          balance: expect.any(Number),
          availableBalance: expect.any(Number),
          currency: expect.any(String)
        })
      );
    });

    test('POST /api/portfolio/orders should place new orders', async () => {
      const { default: handler } = await import('../../app/api/portfolio/orders/route');
      
      const req = mockRequest('POST', {
        symbol: 'BTC-USD',
        side: 'buy',
        size: '0.01',
        type: 'market'
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: expect.any(String),
          status: expect.any(String),
          symbol: 'BTC-USD'
        })
      );
    });
  });

  describe('Risk Management Endpoints', () => {
    test('POST /api/risk/validate-trade should validate trade parameters', async () => {
      const { default: handler } = await import('../../app/api/risk/validate-trade/route');
      
      const req = mockRequest('POST', {
        symbol: 'BTC-USD',
        side: 'buy',
        size: 0.05,
        price: 45000,
        strategy: 'momentum'
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          approved: expect.any(Boolean),
          riskScore: expect.any(Number)
        })
      );
    });

    test('GET /api/risk/metrics should return current risk metrics', async () => {
      const { default: handler } = await import('../../app/api/risk/metrics/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolioRisk: expect.any(Number),
          maxDrawdown: expect.any(Number),
          currentDrawdown: expect.any(Number),
          alerts: expect.any(Array)
        })
      );
    });
  });

  describe('Strategy Execution Endpoints', () => {
    test('GET /api/strategies/list should return available strategies', async () => {
      const { default: handler } = await import('../../app/api/strategies/list/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          strategies: expect.arrayContaining([
            expect.objectContaining({
              name: expect.any(String),
              description: expect.any(String),
              parameters: expect.any(Object)
            })
          ])
        })
      );
    });

    test('POST /api/strategies/execute should run strategy analysis', async () => {
      const { default: handler } = await import('../../app/api/strategies/execute/route');
      
      const req = mockRequest('POST', {
        strategy: 'MovingAverageCrossover',
        marketData: {
          prices: Array.from({ length: 50 }, (_, i) => 45000 + i * 10),
          volumes: Array.from({ length: 50 }, () => 1000000)
        },
        parameters: {
          shortPeriod: 10,
          longPeriod: 30
        }
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(String),
          confidence: expect.any(Number),
          details: expect.any(Object)
        })
      );
    });
  });

  describe('Backtesting Endpoints', () => {
    test('POST /api/backtest/run should execute backtest', async () => {
      const { default: handler } = await import('../../app/api/backtest/run/route');
      
      const req = mockRequest('POST', {
        strategy: 'MovingAverageCrossover',
        data: Array.from({ length: 1000 }, (_, i) => ({
          symbol: 'BTC-USD',
          price: 45000 + Math.sin(i * 0.01) * 1000,
          volume: 1000000,
          timestamp: Date.now() - (1000 - i) * 60000
        })),
        parameters: {
          shortPeriod: 10,
          longPeriod: 30
        },
        initialBalance: 100000,
        commission: 0.001
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalReturn: expect.any(Number),
          totalTrades: expect.any(Number),
          winRate: expect.any(Number),
          sharpeRatio: expect.any(Number),
          maxDrawdown: expect.any(Number),
          trades: expect.any(Array)
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed request bodies', async () => {
      const { default: handler } = await import('../../app/api/ai/analyze-market/route');
      
      const req = mockRequest('POST', 'invalid json');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String)
        })
      );
    });

    test('should handle missing required parameters', async () => {
      const { default: handler } = await import('../../app/api/portfolio/orders/route');
      
      const req = mockRequest('POST', {
        symbol: 'BTC-USD'
        // Missing required fields: side, size, type
      });
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('required')
        })
      );
    });

    test('should handle unsupported HTTP methods', async () => {
      const { default: handler } = await import('../../app/api/health/route');
      
      const req = mockRequest('DELETE'); // Unsupported method
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Method not allowed'
        })
      );
    });

    test('should handle external API timeouts', async () => {
      // Mock timeout
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
        () => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const { default: handler } = await import('../../app/api/market/products/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('service unavailable')
        })
      );
    });

    test('should handle rate limiting', async () => {
      // Mock rate limit response
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' })
      } as any);

      const { default: handler } = await import('../../app/api/market/tickers/route');
      
      const req = mockRequest('GET');
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('rate limit')
        })
      );
    });
  });

  describe('Authentication and Authorization', () => {
    test('should require authentication for protected endpoints', async () => {
      const { default: handler } = await import('../../app/api/portfolio/orders/route');
      
      const req = mockRequest('POST', {
        symbol: 'BTC-USD',
        side: 'buy',
        size: '0.01',
        type: 'market'
      });
      // Remove authorization header
      delete req.headers.authorization;
      
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Unauthorized'
        })
      );
    });

    test('should validate API keys', async () => {
      const { default: handler } = await import('../../app/api/portfolio/positions/route');
      
      const req = mockRequest('GET');
      req.headers.authorization = 'Bearer invalid_token';
      
      const res = mockResponse();

      await handler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid token'
        })
      );
    });
  });
});
