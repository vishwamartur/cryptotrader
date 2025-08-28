// Performance and Load Testing Suite
// Tests system performance under various conditions

import { describe, test, expect, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';

import { QuantBacktester } from '../lib/quant-backtester';
import { MovingAverageCrossoverStrategy } from '../lib/quant-strategy-engine';
import { HFTEngine, MarketMakingStrategy } from '../lib/hft-orderbook-engine';
import { EnhancedMarketDataProvider } from '../lib/market-data-provider';
import { MultipleLinearRegression } from '../lib/quant-ml';

// Generate large dataset for performance testing
function generateLargeMarketData(size: number) {
  const data = [];
  const basePrice = 45000;
  let currentPrice = basePrice;
  
  for (let i = 0; i < size; i++) {
    const change = (Math.random() - 0.5) * 1000;
    currentPrice += change;
    
    data.push({
      symbol: 'BTC-USD',
      price: Math.max(1000, currentPrice), // Ensure positive price
      volume: Math.random() * 1000000 + 100000,
      timestamp: Date.now() - (size - i) * 60000 // 1 minute intervals
    });
  }
  
  return data;
}

describe('Performance Tests', () => {
  test('should handle large dataset backtesting efficiently', () => {
    const largeDataset = generateLargeMarketData(10000); // 10k data points
    const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);
    
    const startTime = performance.now();
    const result = backtester.runBacktest(largeDataset);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    
    expect(result).toBeDefined();
    expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    
    console.log(`Backtesting 10k data points took ${executionTime.toFixed(2)}ms`);
  });

  test('should process high-frequency tick data efficiently', () => {
    const hftEngine = new HFTEngine();
    hftEngine.addStrategy(new MarketMakingStrategy());
    
    const tickEvents = Array(1000).fill(null).map((_, i) => ({
      type: 'orderbook' as const,
      orderBook: {
        symbol: 'BTC-USD',
        timestamp: Date.now() + i,
        bids: [[45000 + Math.random() * 10, Math.random() * 5]],
        asks: [[45010 + Math.random() * 10, Math.random() * 5]]
      },
      timestamp: Date.now() + i,
      symbol: 'BTC-USD'
    }));
    
    const startTime = performance.now();
    
    tickEvents.forEach(event => {
      hftEngine.processTick(event);
    });
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    const avgLatency = executionTime / tickEvents.length;
    
    expect(avgLatency).toBeLessThan(1); // Average latency should be < 1ms per tick
    
    console.log(`Processed ${tickEvents.length} ticks in ${executionTime.toFixed(2)}ms (avg: ${avgLatency.toFixed(3)}ms per tick)`);
  });

  test('should handle concurrent market data subscriptions', async () => {
    const provider = new EnhancedMarketDataProvider();
    const subscriptions: string[] = [];
    const receivedData: any[] = [];
    
    // Create 100 concurrent subscriptions
    for (let i = 0; i < 100; i++) {
      const subscriptionId = provider.subscribe({
        symbol: `SYMBOL_${i}`,
        type: 'ticker',
        callback: (data) => {
          receivedData.push(data);
        }
      });
      subscriptions.push(subscriptionId);
    }
    
    expect(subscriptions.length).toBe(100);
    expect(provider.getConnectionStatus().subscriptions).toBe(100);
    
    // Clean up
    subscriptions.forEach(id => provider.unsubscribe(id));
    expect(provider.getConnectionStatus().subscriptions).toBe(0);
  });

  test('should train ML models efficiently with large datasets', () => {
    const mlr = new MultipleLinearRegression();
    
    // Generate large training dataset
    const features: number[][] = [];
    const targets: number[] = [];
    
    for (let i = 0; i < 10000; i++) {
      const feature = [Math.random(), Math.random(), Math.random()];
      const target = feature[0] * 2 + feature[1] * 3 + feature[2] * 1.5 + Math.random() * 0.1;
      
      features.push(feature);
      targets.push(target);
    }
    
    const startTime = performance.now();
    mlr.train(features, targets, 0.01, 100);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    
    // Test prediction accuracy
    const testFeature = [0.5, 0.3, 0.7];
    const prediction = mlr.predict(testFeature);
    const expected = testFeature[0] * 2 + testFeature[1] * 3 + testFeature[2] * 1.5;
    
    expect(Math.abs(prediction - expected)).toBeLessThan(0.5); // Reasonable accuracy
    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`ML training with 10k samples took ${executionTime.toFixed(2)}ms`);
  });
});

describe('Memory Usage Tests', () => {
  test('should not leak memory during continuous backtesting', () => {
    const dataset = generateLargeMarketData(1000);
    const backtester = new QuantBacktester(MovingAverageCrossoverStrategy);
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Run multiple backtests
    for (let i = 0; i < 10; i++) {
      backtester.runBacktest(dataset);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    
    console.log(`Memory increase after 10 backtests: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });

  test('should handle large order book updates without memory leaks', () => {
    const hftEngine = new HFTEngine();
    hftEngine.addStrategy(new MarketMakingStrategy());
    
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Process many order book updates
    for (let i = 0; i < 10000; i++) {
      const tickEvent = {
        type: 'orderbook' as const,
        orderBook: {
          symbol: 'BTC-USD',
          timestamp: Date.now() + i,
          bids: Array(100).fill(null).map(() => [45000 + Math.random() * 100, Math.random() * 10]),
          asks: Array(100).fill(null).map(() => [45100 + Math.random() * 100, Math.random() * 10])
        },
        timestamp: Date.now() + i,
        symbol: 'BTC-USD'
      };
      
      hftEngine.processTick(tickEvent);
    }
    
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    
    console.log(`Memory increase after 10k order book updates: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
  });
});

describe('Stress Tests', () => {
  test('should handle extreme market volatility', () => {
    // Generate extremely volatile market data
    const volatileData = [];
    let price = 45000;
    
    for (let i = 0; i < 1000; i++) {
      // Extreme price swings (up to 20% per tick)
      const change = (Math.random() - 0.5) * 0.4 * price;
      price = Math.max(1000, price + change);
      
      volatileData.push({
        symbol: 'BTC-USD',
        price,
        volume: Math.random() * 10000000, // High volume
        timestamp: Date.now() + i * 1000
      });
    }
    
    const backtester = new QuantBacktester(MovingAverageCrossoverStrategy);
    
    expect(() => {
      const result = backtester.runBacktest(volatileData);
      expect(result).toBeDefined();
      expect(isFinite(result.totalReturn)).toBe(true);
      expect(isFinite(result.sharpeRatio)).toBe(true);
    }).not.toThrow();
  });

  test('should handle rapid subscription/unsubscription cycles', () => {
    const provider = new EnhancedMarketDataProvider();
    
    // Rapidly create and destroy subscriptions
    for (let cycle = 0; cycle < 100; cycle++) {
      const subscriptions: string[] = [];
      
      // Create 10 subscriptions
      for (let i = 0; i < 10; i++) {
        const id = provider.subscribe({
          symbol: `TEST_${i}`,
          type: 'ticker',
          callback: () => {}
        });
        subscriptions.push(id);
      }
      
      expect(provider.getConnectionStatus().subscriptions).toBe(10);
      
      // Remove all subscriptions
      subscriptions.forEach(id => provider.unsubscribe(id));
      expect(provider.getConnectionStatus().subscriptions).toBe(0);
    }
    
    // System should still be stable
    expect(provider.getConnectionStatus().errors.length).toBe(0);
  });

  test('should handle concurrent strategy execution', () => {
    const hftEngine = new HFTEngine();
    
    // Add multiple strategies
    for (let i = 0; i < 10; i++) {
      hftEngine.addStrategy(new MarketMakingStrategy(0.0001 + i * 0.0001, 10, 1.5, 1));
    }
    
    const tickEvent = {
      type: 'orderbook' as const,
      orderBook: {
        symbol: 'BTC-USD',
        timestamp: Date.now(),
        bids: [[45000, 10], [44999, 15]],
        asks: [[45001, 8], [45002, 12]]
      },
      timestamp: Date.now(),
      symbol: 'BTC-USD'
    };
    
    const startTime = performance.now();
    
    // Process the same tick 1000 times to stress test
    for (let i = 0; i < 1000; i++) {
      const signals = hftEngine.processTick(tickEvent);
      expect(Array.isArray(signals)).toBe(true);
    }
    
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    console.log(`Processed 1000 ticks with 10 strategies in ${executionTime.toFixed(2)}ms`);
  });
});

describe('Error Handling and Recovery', () => {
  test('should handle malformed market data gracefully', () => {
    const backtester = new QuantBacktester(MovingAverageCrossoverStrategy);
    
    const malformedData = [
      { symbol: 'BTC-USD', price: 45000, volume: 1000, timestamp: Date.now() },
      { symbol: 'BTC-USD', price: null as any, volume: 1000, timestamp: Date.now() },
      { symbol: 'BTC-USD', price: 'invalid' as any, volume: 1000, timestamp: Date.now() },
      { symbol: 'BTC-USD', price: 46000, volume: 1000, timestamp: Date.now() }
    ];
    
    expect(() => {
      const result = backtester.runBacktest(malformedData);
      expect(result).toBeDefined();
    }).not.toThrow();
  });

  test('should recover from strategy execution errors', () => {
    const hftEngine = new HFTEngine();
    
    // Add a strategy that might throw errors
    const faultyStrategy = {
      getName: () => 'FaultyStrategy',
      isEnabled: () => true,
      setEnabled: () => {},
      onTick: () => {
        if (Math.random() < 0.5) {
          throw new Error('Random strategy error');
        }
        return [];
      }
    };
    
    hftEngine.addStrategy(faultyStrategy as any);
    
    const tickEvent = {
      type: 'orderbook' as const,
      orderBook: {
        symbol: 'BTC-USD',
        timestamp: Date.now(),
        bids: [[45000, 10]],
        asks: [[45001, 8]]
      },
      timestamp: Date.now(),
      symbol: 'BTC-USD'
    };
    
    // Should not crash even with faulty strategy
    expect(() => {
      for (let i = 0; i < 100; i++) {
        hftEngine.processTick(tickEvent);
      }
    }).not.toThrow();
  });

  test('should handle network disconnections gracefully', async () => {
    const provider = new EnhancedMarketDataProvider('wss://invalid-url.example.com');
    
    // Should handle connection failure gracefully
    await expect(provider.connect()).rejects.toThrow();
    
    expect(provider.isConnected()).toBe(false);
    expect(provider.getConnectionStatus().connected).toBe(false);
    
    // Should still allow subscriptions (they'll be queued)
    const subscriptionId = provider.subscribe({
      symbol: 'BTC-USD',
      type: 'ticker',
      callback: () => {}
    });
    
    expect(typeof subscriptionId).toBe('string');
  });
});

describe('Benchmark Tests', () => {
  test('should benchmark strategy execution speed', () => {
    const strategies = [
      MovingAverageCrossoverStrategy
    ];
    
    const testData = { prices: Array(100).fill(null).map(() => Math.random() * 1000 + 40000) };
    
    strategies.forEach(strategy => {
      const iterations = 10000;
      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        strategy.run(testData);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;
      
      expect(avgTime).toBeLessThan(1); // Should be less than 1ms per execution
      
      console.log(`${strategy.name}: ${iterations} executions in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(3)}ms)`);
    });
  });

  test('should benchmark portfolio optimization speed', () => {
    const { PortfolioOptimizer } = require('../lib/portfolio-optimizer');
    const optimizer = new PortfolioOptimizer();
    
    const mockPositions = Array(10).fill(null).map((_, i) => ({
      id: i.toString(),
      product: { symbol: `SYMBOL_${i}`, description: `Asset ${i}` },
      size: (Math.random() * 10).toString(),
      entry_price: (Math.random() * 1000 + 100).toString(),
      mark_price: (Math.random() * 1000 + 100).toString(),
      realized_pnl: (Math.random() * 100 - 50).toString(),
      unrealized_pnl: (Math.random() * 100 - 50).toString()
    }));
    
    const mockMarketData = Array(10).fill(null).map((_, i) => ({
      symbol: `SYMBOL_${i}`,
      price: Math.random() * 1000 + 100,
      changePercent: (Math.random() - 0.5) * 10,
      volume: Math.random() * 1000000,
      high24h: Math.random() * 1100 + 100,
      low24h: Math.random() * 900 + 100,
      lastUpdated: Date.now()
    }));
    
    const constraints = {
      maxPositionWeight: 0.3,
      minPositionWeight: 0.05,
      maxRisk: 0.2
    };
    
    const startTime = performance.now();
    const result = optimizer.optimizePortfolio(mockPositions, mockMarketData, 100000, constraints);
    const endTime = performance.now();
    
    const executionTime = endTime - startTime;
    
    expect(result).toBeDefined();
    expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
    
    console.log(`Portfolio optimization took ${executionTime.toFixed(2)}ms`);
  });
});
