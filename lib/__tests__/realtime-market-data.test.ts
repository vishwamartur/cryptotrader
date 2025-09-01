import { RealtimeMarketDataManager } from '../realtime-market-data';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window and navigator for browser environment
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
  },
  writable: true,
});

Object.defineProperty(window, 'addEventListener', {
  value: jest.fn(),
  writable: true,
});

describe('RealtimeMarketDataManager', () => {
  let manager: any;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    mockFetch.mockClear();
    
    // Create a new instance for each test
    manager = new (RealtimeMarketDataManager as any)();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('loadProducts', () => {
    it('should successfully load products with valid response', async () => {
      const mockResponse = {
        success: true,
        result: [
          {
            id: 1,
            symbol: 'BTC-USD',
            description: 'Bitcoin USD',
            productType: 'spot',
            underlyingAsset: 'BTC',
            quotingAsset: 'USD',
            settlingAsset: 'USD',
            tradingStatus: 'online',
            state: 'active'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const productsLoadedSpy = jest.fn();
      manager.on('productsLoaded', productsLoadedSpy);

      await manager.loadProducts();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/market/products'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );

      expect(productsLoadedSpy).toHaveBeenCalledWith([mockResponse.result[0]]);
    });

    it('should handle network errors with retry logic', async () => {
      const networkError = new Error('Failed to fetch');
      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, result: [] }),
        } as Response);

      const errorSpy = jest.fn();
      const retryAttemptSpy = jest.fn();
      manager.on('error', errorSpy);
      manager.on('retryAttempt', retryAttemptSpy);

      await manager.loadProducts();

      // Should have attempted retries
      expect(retryAttemptSpy).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout after 10000ms');
      timeoutError.name = 'AbortError';
      
      mockFetch.mockRejectedValueOnce(timeoutError);

      const errorSpy = jest.fn();
      manager.on('error', errorSpy);

      await manager.loadProducts();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRODUCTS_LOAD_FAILED',
          message: expect.stringContaining('timeout'),
          retryable: expect.any(Boolean),
        })
      );
    });

    it('should handle HTTP error responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const errorSpy = jest.fn();
      manager.on('error', errorSpy);

      await manager.loadProducts();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRODUCTS_LOAD_FAILED',
          message: expect.stringContaining('HTTP 404'),
        })
      );
    });

    it('should handle invalid response format', async () => {
      const invalidResponse = {
        success: false,
        message: 'Invalid request'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse,
      } as Response);

      const errorSpy = jest.fn();
      manager.on('error', errorSpy);

      await manager.loadProducts();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRODUCTS_LOAD_FAILED',
          message: 'Invalid request',
        })
      );
    });

    it('should emit loading states', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: [] }),
      } as Response);

      const loadingProductsSpy = jest.fn();
      manager.on('loadingProducts', loadingProductsSpy);

      await manager.loadProducts();

      expect(loadingProductsSpy).toHaveBeenCalledWith(true);
      expect(loadingProductsSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('fetchMarketData', () => {
    beforeEach(() => {
      // Add some subscribed symbols
      manager.subscribedSymbols.add('BTC-USD');
      manager.subscribedSymbols.add('ETH-USD');
    });

    it('should successfully fetch market data', async () => {
      const mockResponse = {
        success: true,
        result: [
          {
            symbol: 'BTC-USD',
            price: 45000,
            change: 1250,
            changePercent: 2.85,
            volume: 1500000000,
            high24h: 46000,
            low24h: 43500,
            bestBid: 44995,
            bestAsk: 45005,
            bestBidSize: 1.5,
            bestAskSize: 2.1,
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const marketDataSpy = jest.fn();
      manager.on('marketData', marketDataSpy);

      await manager.fetchMarketData();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/market/tickers?symbols=BTC-USD,ETH-USD'),
        expect.any(Object)
      );

      expect(marketDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USD',
          data: expect.objectContaining({
            symbol: 'BTC-USD',
            price: 45000,
            change: 1250,
            changePercent: 2.85,
          }),
        })
      );
    });

    it('should handle missing data gracefully', async () => {
      const mockResponse = {
        success: true,
        result: [
          {
            symbol: 'BTC-USD',
            // Missing price, change, etc.
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const marketDataSpy = jest.fn();
      manager.on('marketData', marketDataSpy);

      await manager.fetchMarketData();

      expect(marketDataSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTC-USD',
          data: expect.objectContaining({
            symbol: 'BTC-USD',
            price: 0, // Should default to 0
            change: 0,
            changePercent: 0,
          }),
        })
      );
    });
  });

  describe('network connectivity', () => {
    it('should check network connectivity before making requests', async () => {
      // Mock navigator.onLine to false
      Object.defineProperty(window.navigator, 'onLine', {
        value: false,
        writable: true,
      });

      const errorSpy = jest.fn();
      manager.on('error', errorSpy);

      await manager.loadProducts();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Network connectivity unavailable'),
        })
      );
    });

    it('should retry operations when network comes back online', async () => {
      const retryFailedOperationsSpy = jest.spyOn(manager, 'retryFailedOperations');
      
      // Simulate network coming back online
      const onlineCallback = (window.addEventListener as jest.Mock).mock.calls
        .find(call => call[0] === 'online')?.[1];
      
      if (onlineCallback) {
        onlineCallback();
      }

      expect(retryFailedOperationsSpy).toHaveBeenCalled();
    });
  });
});
