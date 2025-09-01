/**
 * Performance Testing and Benchmarking Suite
 * Tests system performance, load handling, and optimization
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Import components for performance testing
import { QuantBacktester } from '../../lib/quant-backtester';
import { MovingAverageCrossoverStrategy, MomentumStrategy } from '../../lib/quant-strategy-engine';
import { HFTEngine, MarketMakingStrategy } from '../../lib/hft-orderbook-engine';
import { MultipleLinearRegression, AnomalyDetector } from '../../lib/quant-ml';
import { AITradingEngine } from '../../lib/ai-trading-engine';
import { RiskManager } from '../../lib/risk-management';

// Performance measurement utilities
class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map();

  startMeasurement(name: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(duration);
      return duration;
    };
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  reset() {
    this.measurements.clear();
  }
}

// Memory usage monitoring
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss / 1024 / 1024, // MB
      heapUsed: usage.heapUsed / 1024 / 1024, // MB
      heapTotal: usage.heapTotal / 1024 / 1024, // MB
      external: usage.external / 1024 / 1024 // MB
    };
  }
  return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
}

// Generate test data
function generateMarketData(size: number, volatility: number = 0.02) {
  const data = [];
  let price = 45000;
  const baseVolume = 1000000;

  for (let i = 0; i < size; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility * price;
    price = Math.max(1000, price + change);
    
    data.push({
      symbol: 'BTC-USD',
      price: price,
      volume: baseVolume * (0.5 + Math.random()),
      timestamp: Date.now() - (size - i) * 60000,
      high: price * (1 + Math.random() * 0.01),
      low: price * (1 - Math.random() * 0.01),
      open: price * (0.99 + Math.random() * 0.02)
    });
  }

  return data;
}

describe('Performance Testing Suite', () => {
  let profiler: PerformanceProfiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    profiler.reset();
  });

  describe('Backtesting Performance', () => {
    test('should handle large dataset backtesting efficiently', () => {
      const datasetSizes = [1000, 5000, 10000, 50000];
      const maxExecutionTime = 10000; // 10 seconds

      datasetSizes.forEach(size => {
        const dataset = generateMarketData(size);
        const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);

        const endMeasurement = profiler.startMeasurement(`backtest_${size}`);
        const result = backtester.runBacktest(dataset);
        const duration = endMeasurement();

        expect(result).toBeDefined();
        expect(result.totalTrades).toBeGreaterThanOrEqual(0);
        expect(duration).toBeLessThan(maxExecutionTime);

        console.log(`Backtesting ${size} data points took ${duration.toFixed(2)}ms`);
      });

      // Verify performance scales reasonably
      const stats1k = profiler.getStats('backtest_1000');
      const stats10k = profiler.getStats('backtest_10000');
      
      if (stats1k && stats10k) {
        // 10x data should not take more than 20x time (allowing for some overhead)
        expect(stats10k.avg).toBeLessThan(stats1k.avg * 20);
      }
    });

    test('should maintain performance with multiple strategies', () => {
      const dataset = generateMarketData(5000);
      const strategies = [MovingAverageCrossoverStrategy, MomentumStrategy];
      
      strategies.forEach((strategy, index) => {
        const backtester = new QuantBacktester(strategy, 0.001, 0.0005, 100000);
        
        const endMeasurement = profiler.startMeasurement(`strategy_${index}`);
        const result = backtester.runBacktest(dataset);
        const duration = endMeasurement();

        expect(result).toBeDefined();
        expect(duration).toBeLessThan(5000); // 5 seconds max per strategy
      });
    });

    test('should handle concurrent backtesting', async () => {
      const dataset = generateMarketData(2000);
      const concurrentTests = 5;

      const promises = Array.from({ length: concurrentTests }, (_, i) => {
        return new Promise<number>((resolve) => {
          const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);
          
          const start = performance.now();
          const result = backtester.runBacktest(dataset);
          const duration = performance.now() - start;

          expect(result).toBeDefined();
          resolve(duration);
        });
      });

      const durations = await Promise.all(promises);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

      expect(avgDuration).toBeLessThan(3000); // 3 seconds average
      console.log(`Concurrent backtesting average: ${avgDuration.toFixed(2)}ms`);
    });
  });

  describe('Real-time Data Processing Performance', () => {
    test('should process market data updates efficiently', () => {
      const updateCounts = [100, 500, 1000, 5000];
      const maxProcessingTime = 100; // 100ms for batch processing

      updateCounts.forEach(count => {
        const updates = generateMarketData(count);
        
        const endMeasurement = profiler.startMeasurement(`market_updates_${count}`);
        
        // Simulate real-time processing
        const processedUpdates = updates.map(update => ({
          ...update,
          processed: true,
          processingTime: Date.now()
        }));

        const duration = endMeasurement();

        expect(processedUpdates).toHaveLength(count);
        expect(duration).toBeLessThan(maxProcessingTime);

        console.log(`Processing ${count} market updates took ${duration.toFixed(2)}ms`);
      });
    });

    test('should handle high-frequency trading calculations', () => {
      const hftEngine = new HFTEngine();
      const orderbook = {
        bids: Array.from({ length: 100 }, (_, i) => ({ price: 45000 - i, size: Math.random() * 10 })),
        asks: Array.from({ length: 100 }, (_, i) => ({ price: 45001 + i, size: Math.random() * 10 }))
      };

      const iterations = 1000;
      const endMeasurement = profiler.startMeasurement('hft_calculations');

      for (let i = 0; i < iterations; i++) {
        const strategy = new MarketMakingStrategy();
        const signal = strategy.analyze(orderbook, { symbol: 'BTC-USD', price: 45000 });
        expect(signal).toBeDefined();
      }

      const duration = endMeasurement();
      const avgPerCalculation = duration / iterations;

      expect(avgPerCalculation).toBeLessThan(1); // Less than 1ms per calculation
      console.log(`HFT calculations: ${avgPerCalculation.toFixed(3)}ms per iteration`);
    });
  });

  describe('Machine Learning Performance', () => {
    test('should train models efficiently', () => {
      const trainingDataSizes = [100, 500, 1000, 2000];
      
      trainingDataSizes.forEach(size => {
        const features = Array.from({ length: size }, () => 
          Array.from({ length: 10 }, () => Math.random())
        );
        const targets = Array.from({ length: size }, () => Math.random());

        const model = new MultipleLinearRegression();
        
        const endMeasurement = profiler.startMeasurement(`ml_training_${size}`);
        model.fit(features, targets);
        const duration = endMeasurement();

        expect(duration).toBeLessThan(5000); // 5 seconds max
        console.log(`ML training with ${size} samples took ${duration.toFixed(2)}ms`);
      });
    });

    test('should perform anomaly detection efficiently', () => {
      const detector = new AnomalyDetector();
      const dataPoints = generateMarketData(1000).map(d => [d.price, d.volume]);

      const endMeasurement = profiler.startMeasurement('anomaly_detection');
      detector.fit(dataPoints);
      
      const testPoints = generateMarketData(100).map(d => [d.price, d.volume]);
      const anomalies = testPoints.map(point => detector.predict(point));
      const duration = endMeasurement();

      expect(anomalies).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // 1 second max
      console.log(`Anomaly detection took ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage and Optimization', () => {
    test('should maintain reasonable memory usage during backtesting', () => {
      const initialMemory = getMemoryUsage();
      const largeDataset = generateMarketData(50000);

      const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);
      const result = backtester.runBacktest(largeDataset);

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(result).toBeDefined();
      expect(memoryIncrease).toBeLessThan(500); // Less than 500MB increase
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });

    test('should handle memory cleanup after operations', () => {
      const initialMemory = getMemoryUsage();
      
      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        const dataset = generateMarketData(5000);
        const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);
        backtester.runBacktest(dataset);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = getMemoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(200); // Less than 200MB permanent increase
      console.log(`Permanent memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });

  describe('API Response Time Performance', () => {
    test('should respond to AI analysis requests quickly', async () => {
      const aiEngine = new AITradingEngine({
        model: 'test-model',
        maxTokens: 1000,
        temperature: 0.1,
        systemPrompt: 'Test prompt'
      });

      // Mock fetch for consistent testing
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                signal: 'HOLD',
                confidence: 50,
                reasoning: 'Test analysis',
                positionSize: 0,
                entryPrice: 45000,
                stopLoss: 0,
                takeProfit: 0,
                riskReward: 1
              })
            }
          }]
        })
      });

      const marketData = generateMarketData(10);
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        const endMeasurement = profiler.startMeasurement('ai_analysis');
        const analysis = await aiEngine.analyzeMarket(marketData, [], 100000);
        const duration = endMeasurement();

        expect(analysis).toBeDefined();
        expect(duration).toBeLessThan(2000); // 2 seconds max per analysis
      }

      const stats = profiler.getStats('ai_analysis');
      if (stats) {
        console.log(`AI analysis average: ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(1000); // 1 second average
      }
    });

    test('should handle risk calculations efficiently', () => {
      const riskManager = new RiskManager();
      const positions = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        product: { symbol: `COIN${i}-USD`, description: `Coin ${i}` },
        size: (Math.random() * 0.1).toString(),
        entry_price: (40000 + Math.random() * 10000).toString(),
        mark_price: (40000 + Math.random() * 10000).toString(),
        realized_pnl: (Math.random() * 1000 - 500).toString(),
        unrealized_pnl: (Math.random() * 1000 - 500).toString()
      }));

      const iterations = 100;
      
      for (let i = 0; i < iterations; i++) {
        const endMeasurement = profiler.startMeasurement('risk_calculation');
        const metrics = riskManager.getRiskMetrics(positions, 100000);
        const alerts = riskManager.checkRiskLimits(metrics, positions, 100000);
        const duration = endMeasurement();

        expect(metrics).toBeDefined();
        expect(Array.isArray(alerts)).toBe(true);
        expect(duration).toBeLessThan(100); // 100ms max per calculation
      }

      const stats = profiler.getStats('risk_calculation');
      if (stats) {
        console.log(`Risk calculation average: ${stats.avg.toFixed(2)}ms`);
        expect(stats.avg).toBeLessThan(50); // 50ms average
      }
    });
  });

  describe('Database Query Performance', () => {
    test('should handle large result sets efficiently', async () => {
      // Mock database operations
      const mockQuery = async (size: number) => {
        const start = performance.now();
        
        // Simulate database query processing time
        const results = Array.from({ length: size }, (_, i) => ({
          id: i,
          symbol: `COIN${i}-USD`,
          price: 1000 + Math.random() * 50000,
          timestamp: Date.now() - i * 60000
        }));

        // Simulate network/processing delay
        await new Promise(resolve => setTimeout(resolve, Math.log(size) * 10));
        
        return {
          results,
          duration: performance.now() - start
        };
      };

      const querySizes = [100, 1000, 5000, 10000];
      
      for (const size of querySizes) {
        const { results, duration } = await mockQuery(size);
        
        expect(results).toHaveLength(size);
        expect(duration).toBeLessThan(5000); // 5 seconds max
        
        console.log(`Query with ${size} results took ${duration.toFixed(2)}ms`);
      }
    });

    test('should optimize batch operations', async () => {
      const batchSizes = [10, 50, 100, 500];
      
      for (const batchSize of batchSizes) {
        const endMeasurement = profiler.startMeasurement(`batch_${batchSize}`);
        
        // Simulate batch database operations
        const batches = Math.ceil(1000 / batchSize);
        const promises = Array.from({ length: batches }, async (_, i) => {
          const start = i * batchSize;
          const end = Math.min(start + batchSize, 1000);
          
          // Simulate batch processing
          await new Promise(resolve => setTimeout(resolve, 1));
          
          return Array.from({ length: end - start }, (_, j) => ({
            id: start + j,
            processed: true
          }));
        });

        const results = await Promise.all(promises);
        const duration = endMeasurement();

        expect(results.flat()).toHaveLength(1000);
        expect(duration).toBeLessThan(1000); // 1 second max
        
        console.log(`Batch size ${batchSize} took ${duration.toFixed(2)}ms`);
      }

      // Find optimal batch size (should be around 100-200 for this test)
      const allStats = batchSizes.map(size => ({
        size,
        stats: profiler.getStats(`batch_${size}`)
      })).filter(({ stats }) => stats !== null);

      const optimal = allStats.reduce((best, current) => 
        current.stats!.avg < best.stats!.avg ? current : best
      );

      console.log(`Optimal batch size: ${optimal.size}`);
      expect(optimal.size).toBeGreaterThan(10);
      expect(optimal.size).toBeLessThan(1000);
    });
  });

  describe('Stress Testing', () => {
    test('should handle high load scenarios', async () => {
      const concurrentRequests = 50;
      const requestsPerSecond = 100;
      
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        // Stagger requests to simulate realistic load
        await new Promise(resolve => setTimeout(resolve, (i * 1000) / requestsPerSecond));
        
        const start = performance.now();
        
        // Simulate API request processing
        const dataset = generateMarketData(100);
        const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);
        const result = backtester.runBacktest(dataset);
        
        const duration = performance.now() - start;
        
        return { result, duration, requestId: i };
      });

      const results = await Promise.all(promises);
      
      // All requests should complete successfully
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(({ result, duration }) => {
        expect(result).toBeDefined();
        expect(duration).toBeLessThan(5000); // 5 seconds max per request
      });

      const avgDuration = results.reduce((sum, { duration }) => sum + duration, 0) / results.length;
      console.log(`High load test - Average duration: ${avgDuration.toFixed(2)}ms`);
      
      expect(avgDuration).toBeLessThan(2000); // 2 seconds average under load
    });

    test('should maintain performance under memory pressure', () => {
      const initialMemory = getMemoryUsage();
      const largeArrays: number[][] = [];

      try {
        // Create memory pressure
        for (let i = 0; i < 100; i++) {
          largeArrays.push(new Array(10000).fill(Math.random()));
        }

        // Perform operations under memory pressure
        const dataset = generateMarketData(1000);
        const endMeasurement = profiler.startMeasurement('memory_pressure');
        
        const backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 100000);
        const result = backtester.runBacktest(dataset);
        
        const duration = endMeasurement();

        expect(result).toBeDefined();
        expect(duration).toBeLessThan(10000); // 10 seconds max under pressure

        const currentMemory = getMemoryUsage();
        console.log(`Memory usage under pressure: ${currentMemory.heapUsed.toFixed(2)}MB`);
        
      } finally {
        // Cleanup
        largeArrays.length = 0;
        if (global.gc) {
          global.gc();
        }
      }
    });
  });
});
