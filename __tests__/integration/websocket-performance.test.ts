import { DeltaRealtimeManager } from '../../lib/delta-realtime-manager';
import { performance } from 'perf_hooks';

// Mock WebSocket for performance testing
class PerformanceMockWebSocket {
  public readyState = 1; // OPEN
  public onopen: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;

  private messageQueue: any[] = [];
  private isProcessing = false;

  constructor(url: string) {
    // Simulate connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 1);
  }

  send(data: string) {
    // Simulate message sending
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }));
    }
  }

  // Performance testing methods
  simulateHighFrequencyMessages(count: number, intervalMs: number = 1) {
    let messageCount = 0;
    
    const sendMessage = () => {
      if (messageCount >= count) return;
      
      const message = {
        type: 'v2_ticker',
        symbol: `SYMBOL${messageCount % 10}`,
        price: (50000 + Math.random() * 1000).toFixed(2),
        volume: (Math.random() * 1000000).toFixed(2),
        timestamp: Date.now() * 1000 // microseconds
      };

      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', {
          data: JSON.stringify(message)
        }));
      }

      messageCount++;
      
      if (messageCount < count) {
        setTimeout(sendMessage, intervalMs);
      }
    };

    sendMessage();
  }

  simulateBurstMessages(burstSize: number, burstCount: number, burstIntervalMs: number = 100) {
    let currentBurst = 0;
    
    const sendBurst = () => {
      if (currentBurst >= burstCount) return;
      
      // Send burst of messages
      for (let i = 0; i < burstSize; i++) {
        const message = {
          type: 'v2_ticker',
          symbol: `BURST_SYMBOL${i}`,
          price: (50000 + Math.random() * 1000).toFixed(2),
          timestamp: Date.now() * 1000
        };

        if (this.onmessage) {
          this.onmessage(new MessageEvent('message', {
            data: JSON.stringify(message)
          }));
        }
      }

      currentBurst++;
      
      if (currentBurst < burstCount) {
        setTimeout(sendBurst, burstIntervalMs);
      }
    };

    sendBurst();
  }
}

// Mock the global WebSocket
(global as any).WebSocket = PerformanceMockWebSocket;

describe('WebSocket Performance Tests', () => {
  let manager: DeltaRealtimeManager;
  let mockWs: PerformanceMockWebSocket;

  beforeEach(() => {
    manager = new DeltaRealtimeManager({
      maxTradeHistory: 1000,
      maxOrderbookLevels: 50
    });
  });

  afterEach(() => {
    if (manager) {
      manager.disconnect();
    }
  });

  describe('Message Processing Performance', () => {
    test('should handle high-frequency ticker updates efficiently', async () => {
      const messageCount = 10000;
      const startTime = performance.now();
      let processedMessages = 0;

      // Connect and set up listener
      await manager.connect();
      
      manager.on('ticker', () => {
        processedMessages++;
      });

      // Get the mock WebSocket instance
      const wsClient = (manager as any).wsClient;
      mockWs = (wsClient as any).ws;

      // Start performance test
      const testStartTime = performance.now();
      
      // Simulate high-frequency messages
      mockWs.simulateHighFrequencyMessages(messageCount, 0.1);

      // Wait for all messages to be processed
      await new Promise<void>((resolve) => {
        const checkCompletion = () => {
          if (processedMessages >= messageCount) {
            resolve();
          } else {
            setTimeout(checkCompletion, 10);
          }
        };
        checkCompletion();
      });

      const testEndTime = performance.now();
      const totalTime = testEndTime - testStartTime;
      const messagesPerSecond = (messageCount / totalTime) * 1000;

      console.log(`Processed ${messageCount} messages in ${totalTime.toFixed(2)}ms`);
      console.log(`Performance: ${messagesPerSecond.toFixed(0)} messages/second`);

      expect(processedMessages).toBe(messageCount);
      expect(messagesPerSecond).toBeGreaterThan(1000); // Should handle at least 1000 msg/sec
    });

    test('should handle message bursts without memory leaks', async () => {
      const burstSize = 100;
      const burstCount = 50;
      const totalMessages = burstSize * burstCount;
      
      let processedMessages = 0;
      const initialMemory = process.memoryUsage();

      await manager.connect();
      
      manager.on('ticker', () => {
        processedMessages++;
      });

      const wsClient = (manager as any).wsClient;
      mockWs = (wsClient as any).ws;

      // Simulate burst messages
      mockWs.simulateBurstMessages(burstSize, burstCount, 10);

      // Wait for all messages to be processed
      await new Promise<void>((resolve) => {
        const checkCompletion = () => {
          if (processedMessages >= totalMessages) {
            resolve();
          } else {
            setTimeout(checkCompletion, 50);
          }
        };
        checkCompletion();
      });

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerMessage = memoryIncrease / totalMessages;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Memory per message: ${memoryIncreasePerMessage.toFixed(2)} bytes`);

      expect(processedMessages).toBe(totalMessages);
      expect(memoryIncreasePerMessage).toBeLessThan(1000); // Less than 1KB per message
    });

    test('should maintain performance with multiple subscriptions', async () => {
      const symbols = Array.from({ length: 100 }, (_, i) => `SYMBOL${i}`);
      const messagesPerSymbol = 100;
      const totalMessages = symbols.length * messagesPerSymbol;
      
      let processedMessages = 0;
      const startTime = performance.now();

      await manager.connect();
      
      // Subscribe to all symbols
      manager.subscribeToTickers(symbols);
      
      manager.on('ticker', () => {
        processedMessages++;
      });

      const wsClient = (manager as any).wsClient;
      mockWs = (wsClient as any).ws;

      // Simulate messages for all symbols
      for (let i = 0; i < messagesPerSymbol; i++) {
        symbols.forEach((symbol, index) => {
          setTimeout(() => {
            const message = {
              type: 'v2_ticker',
              symbol: symbol,
              price: (50000 + Math.random() * 1000).toFixed(2),
              timestamp: Date.now() * 1000
            };

            if (mockWs.onmessage) {
              mockWs.onmessage(new MessageEvent('message', {
                data: JSON.stringify(message)
              }));
            }
          }, i * 10 + index);
        });
      }

      // Wait for all messages to be processed
      await new Promise<void>((resolve) => {
        const checkCompletion = () => {
          if (processedMessages >= totalMessages) {
            resolve();
          } else {
            setTimeout(checkCompletion, 100);
          }
        };
        checkCompletion();
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const messagesPerSecond = (totalMessages / totalTime) * 1000;

      console.log(`Processed ${totalMessages} messages from ${symbols.length} symbols`);
      console.log(`Performance: ${messagesPerSecond.toFixed(0)} messages/second`);

      expect(processedMessages).toBe(totalMessages);
      expect(messagesPerSecond).toBeGreaterThan(500); // Should handle at least 500 msg/sec with many subscriptions
    });
  });

  describe('Data Structure Performance', () => {
    test('should efficiently store and retrieve ticker data', async () => {
      const symbolCount = 1000;
      const symbols = Array.from({ length: symbolCount }, (_, i) => `PERF_SYMBOL${i}`);

      await manager.connect();

      // Add ticker data for all symbols
      const addStartTime = performance.now();
      
      symbols.forEach(symbol => {
        const tickerData = {
          symbol,
          price: '50000',
          change: '100',
          changePercent: '0.2',
          volume: '1000000',
          high: '51000',
          low: '49000',
          timestamp: Date.now()
        };
        
        // Simulate ticker update
        manager.emit('ticker', tickerData);
      });

      const addEndTime = performance.now();
      const addTime = addEndTime - addStartTime;

      // Test retrieval performance
      const retrieveStartTime = performance.now();
      
      symbols.forEach(symbol => {
        const ticker = manager.getTicker(symbol);
        expect(ticker).toBeTruthy();
      });

      const retrieveEndTime = performance.now();
      const retrieveTime = retrieveEndTime - retrieveStartTime;

      console.log(`Added ${symbolCount} tickers in ${addTime.toFixed(2)}ms`);
      console.log(`Retrieved ${symbolCount} tickers in ${retrieveTime.toFixed(2)}ms`);

      expect(addTime).toBeLessThan(100); // Should add 1000 tickers in less than 100ms
      expect(retrieveTime).toBeLessThan(50); // Should retrieve 1000 tickers in less than 50ms
    });

    test('should handle large orderbook updates efficiently', async () => {
      const symbol = 'LARGE_ORDERBOOK_TEST';
      const levelsCount = 1000;

      await manager.connect();

      // Create large orderbook
      const bids = Array.from({ length: levelsCount }, (_, i) => ({
        price: (50000 - i).toString(),
        size: (Math.random() * 10).toFixed(8)
      }));

      const asks = Array.from({ length: levelsCount }, (_, i) => ({
        price: (50001 + i).toString(),
        size: (Math.random() * 10).toFixed(8)
      }));

      const orderbookData = {
        symbol,
        buy: bids,
        sell: asks,
        timestamp: Date.now()
      };

      const updateStartTime = performance.now();
      
      // Simulate orderbook update
      manager.emit('orderbook', orderbookData);

      const updateEndTime = performance.now();
      const updateTime = updateEndTime - updateStartTime;

      // Test retrieval
      const retrieveStartTime = performance.now();
      const retrievedOrderbook = manager.getOrderbook(symbol);
      const retrieveEndTime = performance.now();
      const retrieveTime = retrieveEndTime - retrieveStartTime;

      console.log(`Updated orderbook with ${levelsCount * 2} levels in ${updateTime.toFixed(2)}ms`);
      console.log(`Retrieved orderbook in ${retrieveTime.toFixed(2)}ms`);

      expect(retrievedOrderbook).toBeTruthy();
      expect(retrievedOrderbook.buy).toHaveLength(levelsCount);
      expect(retrievedOrderbook.sell).toHaveLength(levelsCount);
      expect(updateTime).toBeLessThan(50); // Should update large orderbook in less than 50ms
      expect(retrieveTime).toBeLessThan(10); // Should retrieve in less than 10ms
    });
  });

  describe('Connection Health Monitoring', () => {
    test('should track connection metrics accurately', async () => {
      await manager.connect();

      const initialHealth = manager.getConnectionHealth();
      expect(initialHealth.messagesReceived).toBe(0);

      // Simulate some activity
      const messageCount = 1000;
      const wsClient = (manager as any).wsClient;
      mockWs = (wsClient as any).ws;

      mockWs.simulateHighFrequencyMessages(messageCount, 1);

      // Wait for messages to be processed
      await new Promise(resolve => setTimeout(resolve, messageCount * 2));

      const finalHealth = manager.getConnectionHealth();
      
      expect(finalHealth.messagesReceived).toBeGreaterThan(initialHealth.messagesReceived);
      expect(finalHealth.lastHeartbeat).toBeGreaterThan(initialHealth.lastHeartbeat);
    });
  });
});
