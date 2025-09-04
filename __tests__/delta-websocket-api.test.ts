import { DeltaWebSocketAPI } from '../lib/delta-websocket-api';
import { DeltaWebSocketClient } from '../lib/delta-websocket-client';
import { DeltaExchangeAPI } from '../lib/delta-exchange';
import { EventEmitter } from 'events';

// Mock the WebSocket client
class MockWebSocketClient extends EventEmitter {
  private connected = false;
  private authenticated = false;

  async connect() {
    this.connected = true;
    this.emit('connected');
  }

  disconnect() {
    this.connected = false;
    this.authenticated = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  subscribe(channels: any[]) {
    this.emit('subscribed', { channels });
  }

  unsubscribe(channels: any[]) {
    this.emit('unsubscribed', { channels });
  }

  getConnectionStatus() {
    return {
      connected: this.connected,
      authenticated: this.authenticated,
      reconnectAttempts: 0,
      lastHeartbeat: Date.now(),
      subscriptions: new Map(),
      messagesReceived: 0,
      messagesSent: 0,
      latency: 50,
      errors: [],
    };
  }

  // Helper methods for testing
  simulateAuthentication() {
    this.authenticated = true;
    this.emit('authenticated');
  }

  simulateTickerUpdate(data: any) {
    this.emit('message', { type: 'v2_ticker', ...data });
  }

  simulateOrderbookUpdate(data: any) {
    this.emit('message', { type: 'l2_orderbook', ...data });
  }

  simulateTradeUpdate(data: any) {
    this.emit('message', { type: 'all_trades', ...data });
  }

  simulateBalanceUpdate(data: any) {
    this.emit('message', { type: 'margins', ...data });
  }

  simulatePositionUpdate(data: any) {
    this.emit('message', { type: 'positions', ...data });
  }

  simulateOrderUpdate(data: any) {
    this.emit('message', { type: 'orders', ...data });
  }
}

// Mock the REST client
class MockRestClient {
  async placeOrder(orderData: any) {
    return {
      success: true,
      result: {
        id: 'order_123',
        ...orderData
      }
    };
  }

  async cancelOrder(orderId: string) {
    return {
      success: true,
      result: { id: orderId, state: 'cancelled' }
    };
  }

  async getProducts() {
    return {
      success: true,
      result: [
        { symbol: 'BTCUSD', id: 1 },
        { symbol: 'ETHUSD', id: 2 }
      ]
    };
  }
}

describe('DeltaWebSocketAPI', () => {
  let wsClient: MockWebSocketClient;
  let restClient: MockRestClient;
  let wsAPI: DeltaWebSocketAPI;

  beforeEach(() => {
    wsClient = new MockWebSocketClient();
    restClient = new MockRestClient();
    wsAPI = new DeltaWebSocketAPI(wsClient as any, restClient as any);
  });

  afterEach(() => {
    wsAPI.disconnect();
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const connectedSpy = jest.fn();
      wsAPI.on('connected', connectedSpy);

      await wsAPI.connect();

      expect(connectedSpy).toHaveBeenCalled();
    });

    test('should handle authentication', async () => {
      const authenticatedSpy = jest.fn();
      wsAPI.on('authenticated', authenticatedSpy);

      await wsAPI.connect();
      wsClient.simulateAuthentication();

      expect(authenticatedSpy).toHaveBeenCalled();
    });

    test('should disconnect properly', () => {
      const disconnectedSpy = jest.fn();
      wsAPI.on('disconnected', disconnectedSpy);

      wsAPI.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });

  describe('Ticker Data Streaming', () => {
    beforeEach(async () => {
      await wsAPI.connect();
    });

    test('should subscribe to tickers', () => {
      const subscribedSpy = jest.fn();
      wsAPI.on('subscribed', subscribedSpy);

      const symbols = ['BTCUSD', 'ETHUSD'];
      wsAPI.subscribeToTickers(symbols);

      expect(subscribedSpy).toHaveBeenCalledWith({
        type: 'tickers',
        symbols
      });
    });

    test('should handle ticker updates', () => {
      const tickerSpy = jest.fn();
      wsAPI.on('ticker', tickerSpy);

      const tickerData = {
        symbol: 'BTCUSD',
        price: '50000',
        change: '1000',
        changePercent: '2.0',
        volume: '1000000',
        high: '51000',
        low: '49000',
        timestamp: Date.now()
      };

      wsClient.simulateTickerUpdate(tickerData);

      expect(tickerSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSD',
          price: '50000',
          change: '1000'
        })
      );

      // Check if data is cached
      const cachedTicker = wsAPI.getTicker('BTCUSD');
      expect(cachedTicker).toBeTruthy();
      expect(cachedTicker.symbol).toBe('BTCUSD');
    });

    test('should unsubscribe from tickers', () => {
      const unsubscribedSpy = jest.fn();
      wsAPI.on('unsubscribed', unsubscribedSpy);

      const symbols = ['BTCUSD'];
      wsAPI.unsubscribeFromTickers(symbols);

      expect(unsubscribedSpy).toHaveBeenCalledWith({
        type: 'tickers',
        symbols
      });
    });
  });

  describe('Orderbook Data Streaming', () => {
    beforeEach(async () => {
      await wsAPI.connect();
    });

    test('should subscribe to orderbook', () => {
      const subscribedSpy = jest.fn();
      wsAPI.on('subscribed', subscribedSpy);

      const symbols = ['BTCUSD'];
      wsAPI.subscribeToOrderbook(symbols);

      expect(subscribedSpy).toHaveBeenCalledWith({
        type: 'orderbook',
        symbols
      });
    });

    test('should handle orderbook snapshots', () => {
      const orderbookSpy = jest.fn();
      wsAPI.on('orderbook', orderbookSpy);

      const orderbookData = {
        symbol: 'BTCUSD',
        buy: [
          { price: '49900', size: '1.5' },
          { price: '49800', size: '2.0' }
        ],
        sell: [
          { price: '50100', size: '1.0' },
          { price: '50200', size: '1.5' }
        ],
        timestamp: Date.now()
      };

      wsClient.simulateOrderbookUpdate(orderbookData);

      expect(orderbookSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSD',
          buy: expect.arrayContaining([
            expect.objectContaining({ price: '49900', size: '1.5' })
          ])
        })
      );

      // Check if data is cached
      const cachedOrderbook = wsAPI.getOrderbook('BTCUSD');
      expect(cachedOrderbook).toBeTruthy();
      expect(cachedOrderbook.buy).toHaveLength(2);
    });
  });

  describe('Trade Data Streaming', () => {
    beforeEach(async () => {
      await wsAPI.connect();
    });

    test('should subscribe to trades', () => {
      const subscribedSpy = jest.fn();
      wsAPI.on('subscribed', subscribedSpy);

      const symbols = ['BTCUSD'];
      wsAPI.subscribeToTrades(symbols);

      expect(subscribedSpy).toHaveBeenCalledWith({
        type: 'trades',
        symbols
      });
    });

    test('should handle trade updates', () => {
      const tradeSpy = jest.fn();
      wsAPI.on('trade', tradeSpy);

      const tradeData = {
        symbol: 'BTCUSD',
        price: '50000',
        size: 0.5,
        side: 'buy',
        timestamp: Date.now(),
        tradeId: 'trade_123'
      };

      wsClient.simulateTradeUpdate(tradeData);

      expect(tradeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSD',
          price: '50000',
          size: 0.5,
          side: 'buy'
        })
      );
    });
  });

  describe('Portfolio Data Streaming', () => {
    beforeEach(async () => {
      await wsAPI.connect();
      wsClient.simulateAuthentication();
    });

    test('should subscribe to balances', () => {
      const subscribedSpy = jest.fn();
      wsAPI.on('subscribed', subscribedSpy);

      wsAPI.subscribeToBalances();

      expect(subscribedSpy).toHaveBeenCalledWith({
        type: 'balances',
        symbols: ['all']
      });
    });

    test('should handle balance updates', () => {
      const balanceSpy = jest.fn();
      wsAPI.on('balance', balanceSpy);

      const balanceData = {
        asset_symbol: 'USDT',
        available_balance: '10000',
        balance: '12000',
        blocked_margin: '2000',
        unrealized_pnl: '500',
        timestamp: Date.now()
      };

      wsClient.simulateBalanceUpdate(balanceData);

      expect(balanceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assetSymbol: 'USDT',
          availableBalance: '10000',
          walletBalance: '12000'
        })
      );

      // Check if data is cached
      const cachedBalance = wsAPI.getBalance('USDT');
      expect(cachedBalance).toBeTruthy();
      expect(cachedBalance.assetSymbol).toBe('USDT');
    });

    test('should handle position updates', () => {
      const positionSpy = jest.fn();
      wsAPI.on('position', positionSpy);

      const positionData = {
        symbol: 'BTCUSD',
        product_id: 1,
        size: '0.5',
        entry_price: '49000',
        margin: '1000',
        realized_pnl: '100',
        unrealized_pnl: '500',
        timestamp: Date.now()
      };

      wsClient.simulatePositionUpdate(positionData);

      expect(positionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: 'BTCUSD',
          size: '0.5',
          entryPrice: '49000'
        })
      );

      // Check if data is cached
      const cachedPosition = wsAPI.getPosition('BTCUSD');
      expect(cachedPosition).toBeTruthy();
      expect(cachedPosition.symbol).toBe('BTCUSD');
    });

    test('should handle position closure', () => {
      // First add a position
      const positionData = {
        symbol: 'BTCUSD',
        product_id: 1,
        size: '0.5',
        entry_price: '49000',
        margin: '1000',
        realized_pnl: '100',
        timestamp: Date.now()
      };

      wsClient.simulatePositionUpdate(positionData);
      expect(wsAPI.getPosition('BTCUSD')).toBeTruthy();

      // Then close the position
      const closureData = {
        ...positionData,
        size: '0'
      };

      wsClient.simulatePositionUpdate(closureData);
      expect(wsAPI.getPosition('BTCUSD')).toBeNull();
    });

    test('should handle order updates', () => {
      const orderSpy = jest.fn();
      wsAPI.on('order', orderSpy);

      const orderData = {
        order_id: 123,
        client_order_id: 'client_123',
        symbol: 'BTCUSD',
        product_id: 1,
        side: 'buy',
        size: '0.5',
        unfilled_size: '0.3',
        limit_price: '49000',
        state: 'open',
        order_type: 'limit_order',
        timestamp: Date.now()
      };

      wsClient.simulateOrderUpdate(orderData);

      expect(orderSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 123,
          symbol: 'BTCUSD',
          side: 'buy',
          state: 'open'
        })
      );

      // Check if data is cached
      const cachedOrder = wsAPI.getOrder(123);
      expect(cachedOrder).toBeTruthy();
      expect(cachedOrder.orderId).toBe(123);
    });
  });

  describe('REST API Fallback', () => {
    test('should place orders via REST API', async () => {
      const orderData = {
        symbol: 'BTCUSD',
        side: 'buy',
        size: '0.5',
        price: '50000'
      };

      const result = await wsAPI.placeOrder(orderData);

      expect(result.success).toBe(true);
      expect(result.result.id).toBe('order_123');
    });

    test('should cancel orders via REST API', async () => {
      const result = await wsAPI.cancelOrder('order_123');

      expect(result.success).toBe(true);
      expect(result.result.state).toBe('cancelled');
    });

    test('should get products via REST API', async () => {
      const result = await wsAPI.getProducts();

      expect(result.success).toBe(true);
      expect(result.result).toHaveLength(2);
    });
  });

  describe('Data Access Methods', () => {
    beforeEach(async () => {
      await wsAPI.connect();
    });

    test('should return all tickers', () => {
      // Add some test data
      wsClient.simulateTickerUpdate({
        symbol: 'BTCUSD',
        price: '50000',
        timestamp: Date.now()
      });

      wsClient.simulateTickerUpdate({
        symbol: 'ETHUSD',
        price: '3000',
        timestamp: Date.now()
      });

      const allTickers = wsAPI.getAllTickers();
      expect(allTickers).toHaveLength(2);
      expect(allTickers.map(t => t.symbol)).toContain('BTCUSD');
      expect(allTickers.map(t => t.symbol)).toContain('ETHUSD');
    });

    test('should return all balances', () => {
      wsClient.simulateAuthentication();

      // Add some test data
      wsClient.simulateBalanceUpdate({
        asset_symbol: 'USDT',
        available_balance: '10000',
        balance: '12000',
        timestamp: Date.now()
      });

      const allBalances = wsAPI.getBalances();
      expect(allBalances).toHaveLength(1);
      expect(allBalances[0].assetSymbol).toBe('USDT');
    });

    test('should return all positions', () => {
      wsClient.simulateAuthentication();

      // Add some test data
      wsClient.simulatePositionUpdate({
        symbol: 'BTCUSD',
        product_id: 1,
        size: '0.5',
        entry_price: '49000',
        timestamp: Date.now()
      });

      const allPositions = wsAPI.getPositions();
      expect(allPositions).toHaveLength(1);
      expect(allPositions[0].symbol).toBe('BTCUSD');
    });
  });

  describe('Connection Status', () => {
    test('should return connection status', () => {
      const status = wsAPI.getConnectionStatus();

      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('authenticated');
      expect(status).toHaveProperty('reconnectAttempts');
      expect(status).toHaveProperty('lastHeartbeat');
    });
  });
});
