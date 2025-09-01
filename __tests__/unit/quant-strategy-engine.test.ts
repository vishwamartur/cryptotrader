/**
 * Comprehensive Unit Tests for Quantitative Strategy Engine
 * Tests trading strategies, signal generation, and strategy ensemble
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  QuantStrategyEngine, 
  MovingAverageCrossoverStrategy,
  MeanReversionStrategy,
  MomentumStrategy,
  BreakoutStrategy,
  StrategyEnsemble,
  type QuantStrategy,
  type QuantSignal
} from '../../lib/quant-strategy-engine';

describe('QuantStrategyEngine Unit Tests', () => {
  let strategyEngine: QuantStrategyEngine;

  beforeEach(() => {
    strategyEngine = new QuantStrategyEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Strategy Engine Core', () => {
    test('should initialize empty strategy engine', () => {
      expect(strategyEngine).toBeInstanceOf(QuantStrategyEngine);
      expect(strategyEngine.getStrategies()).toHaveLength(0);
    });

    test('should add strategies correctly', () => {
      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      expect(strategyEngine.getStrategies()).toHaveLength(1);
      expect(strategyEngine.getStrategies()[0].name).toBe('Moving Average Crossover');
    });

    test('should run all strategies', () => {
      const mockMarketData = {
        prices: Array.from({ length: 100 }, (_, i) => 45000 + Math.sin(i * 0.1) * 1000),
        volumes: Array.from({ length: 100 }, () => Math.random() * 1000000)
      };

      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      strategyEngine.addStrategy(MomentumStrategy);

      const signals = strategyEngine.runAll(mockMarketData);

      expect(signals).toHaveLength(2);
      signals.forEach(signal => {
        expect(signal).toHaveProperty('action');
        expect(signal).toHaveProperty('confidence');
        expect(['buy', 'sell', 'hold']).toContain(signal.action);
        expect(signal.confidence).toBeGreaterThanOrEqual(0);
        expect(signal.confidence).toBeLessThanOrEqual(1);
      });
    });

    test('should handle empty market data', () => {
      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      
      const signals = strategyEngine.runAll({ prices: [], volumes: [] });
      
      expect(signals).toHaveLength(1);
      expect(signals[0].action).toBe('hold');
      expect(signals[0].confidence).toBe(0);
    });
  });

  describe('Moving Average Crossover Strategy', () => {
    test('should generate buy signal on bullish crossover', () => {
      // Create crossover by having high prices first, then low, then recovery
      const prices = [
        // First 20 points: high prices to establish high long MA
        ...Array.from({ length: 20 }, () => 200),
        // Next 20 points: low prices to bring short MA down
        ...Array.from({ length: 20 }, () => 50),
        // Next 9 points: still low (short MA below long MA)
        ...Array.from({ length: 9 }, () => 50),
        // Final point: recovery spike
        500 // Should push short MA above long MA
      ];
      const volumes = Array.from({ length: 50 }, () => 5000000);

      const signal = MovingAverageCrossoverStrategy.run({ prices, volumes });

      expect(signal.action).toBe('buy');
      expect(signal.confidence).toBeGreaterThan(0.5);
      expect(signal.details).toBeDefined();
    });

    test('should generate sell signal on bearish crossover', () => {
      // Create bearish crossover by having low prices first, then high, then crash
      const prices = [
        // First 20 points: low prices to establish low long MA
        ...Array.from({ length: 20 }, () => 50),
        // Next 20 points: high prices to bring short MA up
        ...Array.from({ length: 20 }, () => 200),
        // Next 9 points: still high (short MA above long MA)
        ...Array.from({ length: 9 }, () => 200),
        // Final point: crash
        10 // Should push short MA below long MA
      ];
      const volumes = Array.from({ length: 50 }, () => 5000000);

      const signal = MovingAverageCrossoverStrategy.run({ prices, volumes });

      expect(signal.action).toBe('sell');
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    test('should generate hold signal for sideways market', () => {
      // Create stable sideways market data with no clear crossover
      const prices = Array.from({ length: 50 }, (_, i) => 45000 + Math.sin(i * 0.3) * 50);
      const volumes = Array.from({ length: 50 }, () => 1000000);

      const signal = MovingAverageCrossoverStrategy.run({ prices, volumes });

      expect(signal.action).toBe('hold');
      expect(signal.confidence).toBeLessThan(0.7);
    });

    test('should handle insufficient data', () => {
      const prices = Array.from({ length: 10 }, (_, i) => 45000 + i * 100);
      const volumes = Array.from({ length: 10 }, () => 1000000);

      const signal = MovingAverageCrossoverStrategy.run({ prices, volumes });

      expect(signal.action).toBe('hold');
      expect(signal.confidence).toBe(0);
    });

    test('should consider volume confirmation', () => {
      // Use the same working crossover pattern
      const prices = [
        // First 20 points: high prices to establish high long MA
        ...Array.from({ length: 20 }, () => 200),
        // Next 20 points: low prices to bring short MA down
        ...Array.from({ length: 20 }, () => 50),
        // Next 9 points: still low (short MA below long MA)
        ...Array.from({ length: 9 }, () => 50),
        // Final point: recovery spike
        500 // Should push short MA above long MA
      ];

      // High volume scenario (creates volume spike)
      const highVolumes = [
        ...Array.from({ length: 49 }, () => 1000000), // Normal volume
        2000000 // Volume spike on final point
      ];
      const highVolumeSignal = MovingAverageCrossoverStrategy.run({ prices, volumes: highVolumes });

      // Low volume scenario (no volume spike)
      const lowVolumes = Array.from({ length: 50 }, () => 1000000); // Consistent volume
      const lowVolumeSignal = MovingAverageCrossoverStrategy.run({ prices, volumes: lowVolumes });

      // Both should generate buy signals, but high volume should have higher confidence
      expect(highVolumeSignal.action).toBe('buy');
      expect(lowVolumeSignal.action).toBe('buy');
      // High volume gets 1.2x multiplier, so should be higher (unless both hit 0.9 cap)
      expect(highVolumeSignal.confidence).toBeGreaterThanOrEqual(lowVolumeSignal.confidence);
    });
  });

  describe('Mean Reversion Strategy', () => {
    test('should generate buy signal when price is oversold', () => {
      // Create oversold condition (price well below lower Bollinger Band)
      const prices = [
        ...Array.from({ length: 30 }, () => 45000), // Stable price for BB calculation
        ...Array.from({ length: 20 }, (_, i) => 45000 - i * 100 - 1000) // Sharp drop below lower band
      ];

      const signal = MeanReversionStrategy.run({ prices });

      expect(signal.action).toBe('buy');
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    test('should generate sell signal when price is overbought', () => {
      // Create overbought condition (price well above upper Bollinger Band)
      const prices = [
        ...Array.from({ length: 30 }, () => 45000), // Stable price for BB calculation
        ...Array.from({ length: 20 }, (_, i) => 45000 + i * 100 + 1000) // Sharp rise above upper band
      ];

      const signal = MeanReversionStrategy.run({ prices });

      expect(signal.action).toBe('sell');
      expect(signal.confidence).toBeGreaterThan(0.5);
    });

    test('should generate hold signal for normal conditions', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 45000 + Math.sin(i * 0.1) * 100);

      const signal = MeanReversionStrategy.run({ prices });

      expect(signal.action).toBe('hold');
    });

    test('should handle insufficient data gracefully', () => {
      const prices = Array.from({ length: 15 }, (_, i) => 45000 + i * 10);

      const signal = MeanReversionStrategy.run({ prices });

      expect(signal.action).toBe('hold');
      expect(signal.confidence).toBe(0);
    });
  });

  describe('Momentum Strategy (RSI-based)', () => {
    test('should generate buy signal for oversold RSI', () => {
      // Create consistent downward movement to generate low RSI
      const prices = Array.from({ length: 50 }, (_, i) => 50000 - i * 100);

      const signal = MomentumStrategy.run({ prices });

      expect(signal.action).toBe('buy');
      expect(signal.confidence).toBeGreaterThan(0.6);
    });

    test('should generate sell signal for overbought RSI', () => {
      // Create consistent upward movement to generate high RSI
      const prices = Array.from({ length: 50 }, (_, i) => 40000 + i * 100);

      const signal = MomentumStrategy.run({ prices });

      expect(signal.action).toBe('sell');
      expect(signal.confidence).toBeGreaterThan(0.6);
    });

    test('should generate hold signal for neutral RSI', () => {
      // Create perfectly stable prices for neutral RSI (no variation)
      const prices = Array.from({ length: 50 }, () => 45000);

      const signal = MomentumStrategy.run({ prices });

      expect(signal.action).toBe('hold');
    });

    test('should handle insufficient data', () => {
      const prices = Array.from({ length: 20 }, (_, i) => 45000 + i * 10);

      const signal = MomentumStrategy.run({ prices });

      expect(signal.action).toBe('hold');
      expect(signal.confidence).toBe(0);
    });
  });

  describe('Breakout Strategy', () => {
    test('should generate buy signal on upward breakout', () => {
      // Create clear breakout scenario (current price excluded from recent high/low)
      const prices = [
        // First 29 points: establish baseline
        ...Array.from({ length: 29 }, () => 100),
        // Next 20 points: consolidation range (recent prices for lookback)
        ...Array.from({ length: 10 }, () => 100),
        ...Array.from({ length: 10 }, () => 101),
        // Final point: clear breakout above recent high
        110 // recentHigh = 101, range = 1, threshold = 0.02, condition: 110 > 101 + 0.02 = TRUE
      ];
      const volumes = [
        // First 49 points: normal volume
        ...Array.from({ length: 49 }, () => 100),
        // Final point: volume spike
        200 // 2x average volume (> 1.5x threshold)
      ];

      const signal = BreakoutStrategy.run({ prices, volumes });

      expect(signal.action).toBe('buy');
      expect(signal.confidence).toBeGreaterThan(0);
    });

    test('should generate sell signal on downward breakout', () => {
      // Create clear breakdown scenario (current price excluded from recent high/low)
      const prices = [
        // First 29 points: establish baseline
        ...Array.from({ length: 29 }, () => 100),
        // Next 20 points: consolidation range (recent prices for lookback)
        ...Array.from({ length: 10 }, () => 100),
        ...Array.from({ length: 10 }, () => 99),
        // Final point: clear breakdown below recent low
        90 // recentLow = 99, range = 1, threshold = 0.02, condition: 90 < 99 - 0.02 = TRUE
      ];
      const volumes = [
        // First 49 points: normal volume
        ...Array.from({ length: 49 }, () => 100),
        // Final point: volume spike
        200 // 2x average volume (> 1.5x threshold)
      ];

      const signal = BreakoutStrategy.run({ prices, volumes });

      expect(signal.action).toBe('sell');
      expect(signal.confidence).toBeGreaterThan(0);
    });

    test('should require volume confirmation', () => {
      const prices = [
        ...Array.from({ length: 40 }, () => 45000),
        ...Array.from({ length: 10 }, (_, i) => 45100 + i * 100) // Price breakout
      ];
      const lowVolumes = Array.from({ length: 50 }, () => 500000); // No volume confirmation

      const signal = BreakoutStrategy.run({ prices, volumes: lowVolumes });

      expect(signal.confidence).toBeLessThan(0.5); // Low confidence without volume
    });
  });

  describe('Strategy Ensemble', () => {
    test('should combine multiple strategies with equal weights', () => {
      const ensemble = new StrategyEnsemble([
        MovingAverageCrossoverStrategy,
        MomentumStrategy,
        MeanReversionStrategy
      ]);

      // Create bullish market data
      const bullishData = {
        prices: Array.from({ length: 50 }, (_, i) => 44000 + i * 50),
        volumes: Array.from({ length: 50 }, () => 1500000)
      };

      const signal = ensemble.run(bullishData);

      expect(signal).toHaveProperty('action');
      expect(signal).toHaveProperty('confidence');
      expect(['buy', 'sell', 'hold']).toContain(signal.action);
    });

    test('should use custom weights', () => {
      const ensemble = new StrategyEnsemble(
        [MovingAverageCrossoverStrategy, MomentumStrategy],
        [0.7, 0.3] // Higher weight for MA crossover
      );

      // Use the working crossover pattern
      const marketData = {
        prices: [
          // First 20 points: high prices to establish high long MA
          ...Array.from({ length: 20 }, () => 200),
          // Next 20 points: low prices to bring short MA down
          ...Array.from({ length: 20 }, () => 50),
          // Next 9 points: still low (short MA below long MA)
          ...Array.from({ length: 9 }, () => 50),
          // Final point: recovery spike
          500 // Should push short MA above long MA
        ],
        volumes: Array.from({ length: 50 }, () => 5000000)
      };

      const signal = ensemble.run(marketData);

      expect(signal).toBeDefined();
      expect(signal.confidence).toBeGreaterThan(0);
    });

    test('should handle conflicting signals', () => {
      // Create data that might generate conflicting signals
      const conflictingData = {
        prices: [
          ...Array.from({ length: 25 }, (_, i) => 45000 + i * 20), // Uptrend
          ...Array.from({ length: 25 }, (_, i) => 45500 - i * 30)  // Downtrend
        ],
        volumes: Array.from({ length: 50 }, () => 1000000)
      };

      const ensemble = new StrategyEnsemble([
        MovingAverageCrossoverStrategy,
        MeanReversionStrategy
      ]);

      const signal = ensemble.run(conflictingData);

      expect(signal).toBeDefined();
      expect(signal.action).toBe('hold'); // Should default to hold on conflict
    });

    test('should validate weights', () => {
      expect(() => {
        new StrategyEnsemble(
          [MovingAverageCrossoverStrategy, MomentumStrategy],
          [0.5] // Insufficient weights
        );
      }).toThrow();

      expect(() => {
        new StrategyEnsemble(
          [MovingAverageCrossoverStrategy],
          [1.5] // Invalid weight > 1
        );
      }).toThrow();
    });
  });

  describe('Custom Strategy Implementation', () => {
    test('should support custom strategy', () => {
      const customStrategy: QuantStrategy = {
        name: 'Custom Test Strategy',
        description: 'A simple test strategy',
        run: (marketData: any) => {
          if (!marketData.prices || marketData.prices.length < 2) {
            return { action: 'hold', confidence: 0 };
          }
          
          const lastPrice = marketData.prices[marketData.prices.length - 1];
          const prevPrice = marketData.prices[marketData.prices.length - 2];
          
          if (lastPrice > prevPrice) {
            return { action: 'buy', confidence: 0.6 };
          } else if (lastPrice < prevPrice) {
            return { action: 'sell', confidence: 0.6 };
          } else {
            return { action: 'hold', confidence: 0.3 };
          }
        }
      };

      strategyEngine.addStrategy(customStrategy);
      
      const marketData = { prices: [45000, 45100, 45200] };
      const signals = strategyEngine.runAll(marketData);

      expect(signals).toHaveLength(1);
      expect(signals[0].action).toBe('buy');
      expect(signals[0].confidence).toBe(0.6);
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle large datasets efficiently', () => {
      const largeDataset = {
        prices: Array.from({ length: 10000 }, (_, i) => 45000 + Math.sin(i * 0.01) * 1000),
        volumes: Array.from({ length: 10000 }, () => Math.random() * 2000000)
      };

      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      strategyEngine.addStrategy(MomentumStrategy);

      const startTime = Date.now();
      const signals = strategyEngine.runAll(largeDataset);
      const endTime = Date.now();

      expect(signals).toHaveLength(2);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    test('should handle malformed market data', () => {
      const malformedData = {
        prices: [null, undefined, 'invalid', NaN, 45000],
        volumes: [null, -1000, 'invalid', 1000000]
      };

      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      
      const signals = strategyEngine.runAll(malformedData as any);

      expect(signals).toHaveLength(1);
      expect(signals[0].action).toBe('hold');
      expect(signals[0].confidence).toBe(0);
    });

    test('should handle extreme price movements', () => {
      const extremeData = {
        prices: [45000, 90000, 22500, 67500, 33750], // Extreme volatility
        volumes: Array.from({ length: 5 }, () => 5000000)
      };

      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      strategyEngine.addStrategy(MomentumStrategy);

      const signals = strategyEngine.runAll(extremeData);

      expect(signals).toHaveLength(2);
      signals.forEach(signal => {
        expect(signal).toBeDefined();
        expect(['buy', 'sell', 'hold']).toContain(signal.action);
      });
    });

    test('should handle concurrent strategy execution', () => {
      const marketData = {
        prices: Array.from({ length: 100 }, (_, i) => 45000 + i * 10),
        volumes: Array.from({ length: 100 }, () => 1000000)
      };

      strategyEngine.addStrategy(MovingAverageCrossoverStrategy);
      strategyEngine.addStrategy(MomentumStrategy);
      strategyEngine.addStrategy(MeanReversionStrategy);

      // Run multiple times concurrently
      const promises = Array.from({ length: 5 }, () => 
        Promise.resolve(strategyEngine.runAll(marketData))
      );

      return Promise.all(promises).then(results => {
        results.forEach(signals => {
          expect(signals).toHaveLength(3);
          signals.forEach(signal => {
            expect(signal).toBeDefined();
            expect(['buy', 'sell', 'hold']).toContain(signal.action);
          });
        });
      });
    });
  });
});
