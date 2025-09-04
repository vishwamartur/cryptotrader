import { DeltaWebSocketClient } from '../lib/delta-websocket-client';
import { EventEmitter } from 'events';

// Mock WebSocket
class MockWebSocket extends EventEmitter {
  public readyState: number = WebSocket.CONNECTING;
  public url: string;
  
  constructor(url: string) {
    super();
    this.url = url;
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.emit('open');
    }, 10);
  }
  
  send(data: string) {
    // Simulate message sending
    this.emit('message-sent', data);
  }
  
  close(code?: number, reason?: string) {
    this.readyState = WebSocket.CLOSED;
    this.emit('close', { code: code || 1000, reason: reason || 'Normal closure' });
  }
  
  // Simulate receiving messages
  simulateMessage(data: any) {
    this.emit('message', { data: JSON.stringify(data) });
  }
  
  simulateError(error: Error) {
    this.emit('error', error);
  }
}

// Mock global WebSocket
(global as any).WebSocket = MockWebSocket;
(global as any).WebSocket.CONNECTING = 0;
(global as any).WebSocket.OPEN = 1;
(global as any).WebSocket.CLOSING = 2;
(global as any).WebSocket.CLOSED = 3;

describe('DeltaWebSocketClient', () => {
  let client: DeltaWebSocketClient;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    client = new DeltaWebSocketClient({
      baseUrl: 'wss://test.example.com',
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
      heartbeatInterval: 1000,
    });
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const connectPromise = client.connect();
      
      // Wait for connection
      await expect(connectPromise).resolves.toBeUndefined();
      
      const status = client.getConnectionStatus();
      expect(status.connected).toBe(true);
    });

    test('should handle connection errors', async () => {
      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      // Start connection
      const connectPromise = client.connect();
      
      // Simulate connection error
      setTimeout(() => {
        const ws = (client as any).ws;
        if (ws) {
          ws.simulateError(new Error('Connection failed'));
        }
      }, 5);

      await expect(connectPromise).rejects.toThrow('Connection failed');
      expect(errorSpy).toHaveBeenCalled();
    });

    test('should disconnect properly', async () => {
      await client.connect();
      
      const disconnectSpy = jest.fn();
      client.on('disconnected', disconnectSpy);
      
      client.disconnect();
      
      expect(disconnectSpy).toHaveBeenCalledWith({
        code: 1000,
        reason: 'Client disconnect'
      });
      
      const status = client.getConnectionStatus();
      expect(status.connected).toBe(false);
    });
  });

  describe('Authentication', () => {
    test('should authenticate with valid credentials', async () => {
      client = new DeltaWebSocketClient({
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        baseUrl: 'wss://test.example.com',
      });

      const authenticatedSpy = jest.fn();
      client.on('authenticated', authenticatedSpy);

      await client.connect();

      // Simulate successful auth response
      setTimeout(() => {
        const ws = (client as any).ws;
        if (ws) {
          ws.simulateMessage({
            type: 'auth',
            success: true
          });
        }
      }, 20);

      // Wait for authentication
      await new Promise(resolve => {
        client.on('authenticated', resolve);
      });

      expect(authenticatedSpy).toHaveBeenCalled();
      
      const status = client.getConnectionStatus();
      expect(status.authenticated).toBe(true);
    });

    test('should handle authentication failure', async () => {
      client = new DeltaWebSocketClient({
        apiKey: 'invalid-key',
        apiSecret: 'invalid-secret',
        baseUrl: 'wss://test.example.com',
      });

      const errorSpy = jest.fn();
      client.on('error', errorSpy);

      await client.connect();

      // Simulate auth failure
      setTimeout(() => {
        const ws = (client as any).ws;
        if (ws) {
          ws.simulateMessage({
            type: 'auth',
            success: false,
            error: 'Invalid credentials'
          });
        }
      }, 20);

      // Wait for error
      await new Promise(resolve => {
        client.on('error', resolve);
      });

      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid credentials')
        })
      );
    });
  });

  describe('Subscriptions', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should subscribe to channels', () => {
      const channels = [
        { name: 'v2_ticker', symbols: ['BTCUSD', 'ETHUSD'] },
        { name: 'l2_orderbook', symbols: ['BTCUSD'] }
      ];

      const subscribedSpy = jest.fn();
      client.on('subscribed', subscribedSpy);

      client.subscribe(channels);

      expect(subscribedSpy).toHaveBeenCalledWith(channels);
      
      const status = client.getConnectionStatus();
      expect(status.subscriptions.size).toBe(2);
    });

    test('should unsubscribe from channels', () => {
      const channels = [
        { name: 'v2_ticker', symbols: ['BTCUSD'] }
      ];

      // First subscribe
      client.subscribe(channels);
      
      const unsubscribedSpy = jest.fn();
      client.on('unsubscribed', unsubscribedSpy);

      // Then unsubscribe
      client.unsubscribe(channels);

      expect(unsubscribedSpy).toHaveBeenCalledWith(channels);
      
      const status = client.getConnectionStatus();
      expect(status.subscriptions.size).toBe(0);
    });

    test('should queue subscriptions when not connected', () => {
      client.disconnect();
      
      const channels = [
        { name: 'v2_ticker', symbols: ['BTCUSD'] }
      ];

      // This should queue the subscription
      client.subscribe(channels);
      
      // Subscription should be queued, not active
      const status = client.getConnectionStatus();
      expect(status.subscriptions.size).toBe(0);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await client.connect();
    });

    test('should handle incoming messages', () => {
      const messageHandler = jest.fn();
      client.addMessageHandler('v2_ticker', messageHandler);

      const testMessage = {
        type: 'v2_ticker',
        symbol: 'BTCUSD',
        price: '50000',
        volume: '1000'
      };

      // Simulate incoming message
      const ws = (client as any).ws;
      if (ws) {
        ws.simulateMessage(testMessage);
      }

      expect(messageHandler).toHaveBeenCalledWith(testMessage);
    });

    test('should handle ping/pong messages', () => {
      const ws = (client as any).ws;
      const sendSpy = jest.spyOn(ws, 'send');

      // Simulate ping message
      ws.simulateMessage({ type: 'ping' });

      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: 'pong' })
      );
    });

    test('should handle malformed messages gracefully', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const ws = (client as any).ws;
      if (ws) {
        // Simulate malformed message
        ws.emit('message', { data: 'invalid json' });
      }

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('Reconnection Logic', () => {
    test('should attempt reconnection on connection loss', async () => {
      await client.connect();
      
      const reconnectingSpy = jest.fn();
      client.on('reconnecting', reconnectingSpy);

      // Simulate connection loss
      const ws = (client as any).ws;
      if (ws) {
        ws.close(1006, 'Connection lost');
      }

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(reconnectingSpy).toHaveBeenCalledWith({
        attempt: 1,
        delay: expect.any(Number)
      });
    });

    test('should stop reconnecting after max attempts', async () => {
      client = new DeltaWebSocketClient({
        baseUrl: 'wss://test.example.com',
        maxReconnectAttempts: 2,
        reconnectInterval: 50,
      });

      await client.connect();

      // Simulate repeated connection failures
      for (let i = 0; i < 3; i++) {
        const ws = (client as any).ws;
        if (ws) {
          ws.close(1006, 'Connection lost');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const status = client.getConnectionStatus();
      expect(status.reconnectAttempts).toBe(2);
    });
  });

  describe('Connection Health', () => {
    test('should track connection statistics', async () => {
      await client.connect();
      
      // Simulate some activity
      const testMessage = { type: 'test', data: 'test' };
      client.sendMessage(testMessage);
      
      const ws = (client as any).ws;
      if (ws) {
        ws.simulateMessage({ type: 'response' });
      }

      const status = client.getConnectionStatus();
      expect(status.messagesSent).toBe(1);
      expect(status.messagesReceived).toBe(1);
      expect(status.lastHeartbeat).toBeGreaterThan(0);
    });

    test('should track errors', () => {
      const testError = new Error('Test error');
      client.emit('error', testError);

      const status = client.getConnectionStatus();
      expect(status.errors).toContain('Test error');
    });
  });
});
