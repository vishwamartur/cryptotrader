/**
 * Comprehensive Test Suite for Delta Exchange WebSocket "All" Symbol Implementation
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DeltaWebSocketClient } from '../lib/delta-websocket-client';
import { useDeltaWebSocket } from '../hooks/use-delta-websocket';
import { useWebSocketMarketData } from '../hooks/use-websocket-market-data';
import { renderHook, act } from '@testing-library/react';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    // Mock send functionality
    console.log('MockWebSocket send:', data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  addEventListener(type: string, listener: EventListener) {
    if (type === 'open') this.onopen = listener as any;
    if (type === 'close') this.onclose = listener as any;
    if (type === 'message') this.onmessage = listener as any;
    if (type === 'error') this.onerror = listener as any;
  }

  removeEventListener(type: string, listener: EventListener) {
    if (type === 'open') this.onopen = null;
    if (type === 'close') this.onclose = null;
    if (type === 'message') this.onmessage = null;
    if (type === 'error') this.onerror = null;
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;

describe('Delta WebSocket "All" Symbol Implementation', () => {
  let client: DeltaWebSocketClient;

  beforeEach(() => {
    client = new DeltaWebSocketClient({
      environment: 'testnet',
      apiKey: 'test-api-key',
      apiSecret: 'test-api-secret'
    });
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Environment Configuration', () => {
    test('should use production URL by default', () => {
      const prodClient = new DeltaWebSocketClient({});
      expect(prodClient['config'].baseUrl).toBe('wss://socket.india.delta.exchange');
    });

    test('should use testnet URL when specified', () => {
      const testClient = new DeltaWebSocketClient({ environment: 'testnet' });
      expect(testClient['config'].baseUrl).toBe('wss://socket.testnet.deltaex.org');
    });

    test('should allow custom URL override', () => {
      const customClient = new DeltaWebSocketClient({
        baseUrl: 'wss://custom.websocket.url'
      });
      expect(customClient['config'].baseUrl).toBe('wss://custom.websocket.url');
    });
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const connectPromise = client.connect();
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(client.getConnectionState().connected).toBe(true);
    });

    test('should handle connection timeout', async () => {
      // Mock a WebSocket that never connects
      (global as any).WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          this.readyState = MockWebSocket.CONNECTING;
          // Never call onopen
        }
      };

      const timeoutClient = new DeltaWebSocketClient({
        environment: 'testnet',
        connectionTimeout: 100
      });

      await expect(timeoutClient.connect()).rejects.toThrow();
    });

    test('should reconnect after connection loss', async () => {
      await client.connect();
      
      const reconnectSpy = jest.spyOn(client as any, 'handleReconnect');
      
      // Simulate connection loss
      const mockWs = client['ws'] as MockWebSocket;
      mockWs.close();
      
      expect(reconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Authentication', () => {
    test('should authenticate with valid credentials', async () => {
      await client.connect();
      
      const authPromise = client.authenticate();
      
      // Simulate auth success response
      setTimeout(() => {
        const mockWs = client['ws'] as MockWebSocket;
        if (mockWs.onmessage) {
          mockWs.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'auth_success',
              data: { message: 'Authentication successful' }
            })
          }));
        }
      }, 10);
      
      const result = await authPromise;
      expect(result).toBe(true);
      expect(client.getConnectionState().authenticated).toBe(true);
    });

    test('should handle authentication failure', async () => {
      await client.connect();
      
      const authPromise = client.authenticate();
      
      // Simulate auth error response
      setTimeout(() => {
        const mockWs = client['ws'] as MockWebSocket;
        if (mockWs.onmessage) {
          mockWs.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'auth_error',
              data: { message: 'Invalid API key' }
            })
          }));
        }
      }, 10);
      
      await expect(authPromise).rejects.toThrow('Authentication failed: Invalid API key');
    });

    test('should handle authentication timeout', async () => {
      const timeoutClient = new DeltaWebSocketClient({
        environment: 'testnet',
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        authTimeout: 100
      });

      await timeoutClient.connect();
      
      // Don't send auth response - should timeout
      await expect(timeoutClient.authenticate()).rejects.toThrow('Authentication timeout');
    });
  });

  describe('"All" Symbol Subscriptions', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should subscribe to all symbols for supported channels', () => {
      const sendSpy = jest.spyOn(client as any, 'sendMessage');
      
      client.subscribeToAllSymbols(['v2/ticker', 'ticker']);
      
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'subscribe',
        payload: {
          channels: [
            { name: 'v2/ticker', symbols: ['all'] },
            { name: 'ticker', symbols: ['all'] }
          ]
        }
      });
    });

    test('should validate channels that support "all" subscription', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      client.subscribeToAllSymbols(['l2_orderbook']); // Doesn't support "all"
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('does not support "all" symbol subscription')
      );
      
      consoleSpy.mockRestore();
    });

    test('should handle mixed channel types correctly', () => {
      const sendSpy = jest.spyOn(client as any, 'sendMessage');
      
      client.subscribe([
        { name: 'v2/ticker', symbols: ['all'] },
        { name: 'l2_orderbook', symbols: ['BTCUSDT', 'ETHUSDT'] }
      ]);
      
      expect(sendSpy).toHaveBeenCalledWith({
        type: 'subscribe',
        payload: {
          channels: [
            { name: 'v2/ticker', symbols: ['all'] },
            { name: 'l2_orderbook', symbols: ['BTCUSDT', 'ETHUSDT'] }
          ]
        }
      });
    });

    test('should enforce channel limits for specific symbols', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Try to subscribe to more than 20 symbols for l2_orderbook
      const manySymbols = Array.from({ length: 25 }, (_, i) => `SYMBOL${i}`);
      
      client.subscribe([{
        name: 'l2_orderbook',
        symbols: manySymbols
      }]);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeds limit of 20 symbols')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should handle ticker messages', () => {
      const messageHandler = jest.fn();
      client.addMessageHandler('v2/ticker', messageHandler);
      
      const mockWs = client['ws'] as MockWebSocket;
      if (mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'v2/ticker',
            symbol: 'BTCUSDT',
            data: {
              price: '50000',
              change: '1000',
              change_percent: '2.0',
              volume: '1000000'
            }
          })
        }));
      }
      
      expect(messageHandler).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        data: expect.objectContaining({
          price: '50000',
          change: '1000'
        })
      }));
    });

    test('should handle order book messages', () => {
      const messageHandler = jest.fn();
      client.addMessageHandler('l2_orderbook', messageHandler);
      
      const mockWs = client['ws'] as MockWebSocket;
      if (mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', {
          data: JSON.stringify({
            type: 'l2_orderbook',
            symbol: 'BTCUSDT',
            data: {
              buy: [['50000', '1.0'], ['49999', '2.0']],
              sell: [['50001', '1.5'], ['50002', '2.5']]
            }
          })
        }));
      }
      
      expect(messageHandler).toHaveBeenCalledWith(expect.objectContaining({
        symbol: 'BTCUSDT',
        data: expect.objectContaining({
          buy: [['50000', '1.0'], ['49999', '2.0']],
          sell: [['50001', '1.5'], ['50002', '2.5']]
        })
      }));
    });

    test('should handle malformed messages gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const mockWs = client['ws'] as MockWebSocket;
      if (mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', {
          data: 'invalid json'
        }));
      }
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error parsing message')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Subscription Management', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should track subscriptions correctly', () => {
      client.subscribe([
        { name: 'v2/ticker', symbols: ['all'] },
        { name: 'l2_orderbook', symbols: ['BTCUSDT', 'ETHUSDT'] }
      ]);
      
      const subscriptions = client.getSubscriptions();
      expect(subscriptions).toContain('v2/ticker:all');
      expect(subscriptions).toContain('l2_orderbook:BTCUSDT,ETHUSDT');
    });

    test('should unsubscribe correctly', () => {
      const sendSpy = jest.spyOn(client as any, 'sendMessage');
      
      // First subscribe
      client.subscribe([{ name: 'v2/ticker', symbols: ['BTCUSDT'] }]);
      
      // Then unsubscribe
      client.unsubscribe([{ name: 'v2/ticker', symbols: ['BTCUSDT'] }]);
      
      expect(sendSpy).toHaveBeenLastCalledWith({
        type: 'unsubscribe',
        payload: {
          channels: [{ name: 'v2/ticker', symbols: ['BTCUSDT'] }]
        }
      });
    });

    test('should queue subscriptions when not connected', () => {
      const disconnectedClient = new DeltaWebSocketClient({
        environment: 'testnet'
      });
      
      disconnectedClient.subscribe([{ name: 'v2/ticker', symbols: ['all'] }]);
      
      expect(disconnectedClient['subscriptionQueue']).toHaveLength(1);
      expect(disconnectedClient['subscriptionQueue'][0]).toEqual({
        name: 'v2/ticker',
        symbols: ['all']
      });
    });
  });

  describe('Error Handling', () => {
    test('should emit error events', (done) => {
      client.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });
      
      // Simulate error
      const mockWs = client['ws'] as MockWebSocket;
      if (mockWs && mockWs.onerror) {
        mockWs.onerror(new Event('error'));
      }
    });

    test('should handle connection errors gracefully', async () => {
      // Mock WebSocket that throws on construction
      (global as any).WebSocket = class {
        constructor() {
          throw new Error('Connection failed');
        }
      };
      
      const errorClient = new DeltaWebSocketClient({
        environment: 'testnet'
      });
      
      await expect(errorClient.connect()).rejects.toThrow();
    });
  });
});

describe('React Hook Integration', () => {
  test('useWebSocketMarketData should support "all" symbol subscription', () => {
    const { result } = renderHook(() => 
      useWebSocketMarketData({
        subscribeToAllSymbols: true,
        channels: ['v2/ticker'],
        environment: 'testnet'
      })
    );
    
    expect(result.current.subscribeToAllSymbols).toBeDefined();
    expect(typeof result.current.subscribeToAllSymbols).toBe('function');
  });

  test('should handle connection state changes', async () => {
    const { result } = renderHook(() => 
      useWebSocketMarketData({
        autoConnect: true,
        environment: 'testnet'
      })
    );
    
    // Initially should be connecting
    expect(result.current.isConnecting).toBe(true);
    expect(result.current.isConnected).toBe(false);
    
    // Wait for connection
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });
    
    // Should be connected
    expect(result.current.isConnected).toBe(true);
    expect(result.current.isConnecting).toBe(false);
  });
});
