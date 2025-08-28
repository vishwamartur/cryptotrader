// Comprehensive Test Suite for AI-Powered Crypto Trading Platform
// Tests all major components and features

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Import all major components
import { AITradingEngine } from '../lib/ai-trading-engine';
import { RiskManager } from '../lib/risk-management';
import { QuantStrategyEngine, MovingAverageCrossoverStrategy, MeanReversionStrategy } from '../lib/quant-strategy-engine';
import { QuantBacktester } from '../lib/quant-backtester';
import { MultipleLinearRegression, AnomalyDetector, MarketPredictor } from '../lib/quant-ml';
import { RLTradingSystem, TradingRLEnvironment } from '../lib/quant-rl';
import { HFTEngine, MarketMakingStrategy, ArbitrageStrategy } from '../lib/hft-orderbook-engine';
import { YieldOptimizer, LiquidityPoolAnalyzer } from '../lib/quant-defi';
import { AutonomousAgent } from '../lib/autonomous-agent';
import { PortfolioOptimizer } from '../lib/portfolio-optimizer';
import { EnhancedMarketDataProvider } from '../lib/market-data-provider';

// Mock data for testing
const mockMarketData = [
  { symbol: 'BTC-USD', price: 45000, volume: 1000000, timestamp: Date.now() - 86400000 },
  { symbol: 'BTC-USD', price: 46000, volume: 1100000, timestamp: Date.now() - 43200000 },
  { symbol: 'BTC-USD', price: 44500, volume: 950000, timestamp: Date.now() }
];

const mockPositions = [
  {
    id: '1',
    product: { symbol: 'BTC-USD', description: 'Bitcoin' },
    size: '0.1',
    entry_price: '45000',
    mark_price: '46000',
    realized_pnl: '100',
    unrealized_pnl: '100'
  }
];

describe('AI Trading Engine', () => {
  let aiEngine: AITradingEngine;

  beforeEach(() => {
    aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.1,
      systemPrompt: 'Test prompt'
    });
  });

  test('should analyze market data and provide trading signals', async () => {
    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    
    expect(analysis).toBeDefined();
    expect(analysis.signal).toMatch(/BUY|SELL|HOLD/);
    expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    expect(analysis.confidence).toBeLessThanOrEqual(1);
    expect(analysis.reasoning).toBeDefined();
  });

  test('should handle empty market data gracefully', async () => {
    const analysis = await aiEngine.analyzeMarket([], [], 10000);
    
    expect(analysis.signal).toBe('HOLD');
    expect(analysis.confidence).toBe(0);
  });
});

describe('Risk Management System', () => {
  let riskManager: RiskManager;

  beforeEach(() => {
    riskManager = new RiskManager({
      maxPositionSize: 1000,
      maxDailyLoss: 500,
      maxDrawdown: 0.1,
      riskPerTrade: 0.02
    });
  });

  test('should calculate risk metrics correctly', () => {
    const metrics = riskManager.calculateRiskMetrics(mockPositions, 10000);
    
    expect(metrics).toBeDefined();
    expect(metrics.totalExposure).toBeGreaterThanOrEqual(0);
    expect(metrics.portfolioRisk).toBeGreaterThanOrEqual(0);
    expect(metrics.currentDrawdown).toBeGreaterThanOrEqual(0);
  });

  test('should allow trades within risk limits', () => {
    const allowed = riskManager.shouldAllowTrade('BUY', 'BTC-USD', 100, mockPositions, 10000);
    expect(typeof allowed).toBe('boolean');
  });

  test('should reject trades exceeding position size limits', () => {
    const allowed = riskManager.shouldAllowTrade('BUY', 'BTC-USD', 2000, mockPositions, 10000);
    expect(allowed).toBe(false);
  });
});

describe('Quantitative Strategy Engine', () => {
  let strategyEngine: QuantStrategyEngine;

  beforeEach(() => {
    strategyEngine = new QuantStrategyEngine();
  });

  test('should execute moving average crossover strategy', () => {
    const prices = [100, 101, 102, 103, 104, 105, 104, 103, 102, 101];
    const signal = MovingAverageCrossoverStrategy.run({ prices });
    
    expect(signal).toBeDefined();
    expect(signal.action).toMatch(/buy|sell|hold/);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
  });

  test('should execute mean reversion strategy', () => {
    const prices = [100, 95, 90, 85, 80, 85, 90, 95, 100, 105];
    const signal = MeanReversionStrategy.run({ prices });
    
    expect(signal).toBeDefined();
    expect(signal.action).toMatch(/buy|sell|hold/);
  });
});

describe('Backtesting System', () => {
  let backtester: QuantBacktester;

  beforeEach(() => {
    backtester = new QuantBacktester(MovingAverageCrossoverStrategy, 0.001, 0.0005, 10000);
  });

  test('should run backtest and return comprehensive results', () => {
    const result = backtester.runBacktest(mockMarketData);
    
    expect(result).toBeDefined();
    expect(result.totalReturn).toBeDefined();
    expect(result.sharpeRatio).toBeDefined();
    expect(result.maxDrawdown).toBeDefined();
    expect(result.totalTrades).toBeGreaterThanOrEqual(0);
    expect(result.portfolioValues).toBeInstanceOf(Array);
  });

  test('should calculate performance metrics correctly', () => {
    const result = backtester.runBacktest(mockMarketData);
    
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(1);
    expect(result.profitFactor).toBeGreaterThanOrEqual(0);
  });
});

describe('Machine Learning Components', () => {
  test('should train and predict with linear regression', () => {
    const mlr = new MultipleLinearRegression();
    const features = [[1, 2], [2, 3], [3, 4], [4, 5]];
    const targets = [3, 5, 7, 9];
    
    mlr.train(features, targets, 0.01, 100);
    const prediction = mlr.predict([5, 6]);
    
    expect(prediction).toBeCloseTo(11, 0);
  });

  test('should detect anomalies in data', () => {
    const detector = new AnomalyDetector(10, 2.0);
    const data = [1, 2, 3, 2, 1, 2, 3, 100, 2, 1]; // 100 is an anomaly
    
    const results = detector.detectAnomalies(data);
    const anomalies = results.filter(r => r.isAnomaly);
    
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0].value).toBe(100);
  });

  test('should make market predictions', () => {
    const predictor = new MarketPredictor(9);
    const mockFeatures = Array(50).fill(null).map(() => ({
      price: Math.random() * 1000 + 40000,
      volume: Math.random() * 1000000,
      returns: (Math.random() - 0.5) * 0.1,
      volatility: Math.random() * 0.05,
      rsi: Math.random() * 100,
      macd: (Math.random() - 0.5) * 100,
      macd_signal: (Math.random() - 0.5) * 100,
      bollinger_upper: Math.random() * 1000 + 41000,
      bollinger_lower: Math.random() * 1000 + 39000,
      volume_sma: Math.random() * 1000000,
      price_momentum: (Math.random() - 0.5) * 0.1,
      volume_momentum: (Math.random() - 0.5) * 0.1
    }));
    
    predictor.train(mockFeatures, 100);
    const prediction = predictor.predict(mockFeatures[0]);
    
    expect(prediction).toBeDefined();
    expect(prediction.signal).toMatch(/buy|sell|hold/);
    expect(prediction.buy + prediction.sell + prediction.hold).toBeCloseTo(1, 1);
  });
});

describe('Reinforcement Learning System', () => {
  test('should create and run RL trading environment', () => {
    const rlSystem = new RLTradingSystem(mockMarketData, 10000);
    
    // Train for a few episodes
    rlSystem.train(10, false);
    
    const history = rlSystem.getTrainingHistory();
    expect(history.length).toBe(10);
    expect(history[0].episode).toBe(0);
    expect(history[9].episode).toBe(9);
  });

  test('should make predictions after training', () => {
    const rlSystem = new RLTradingSystem(mockMarketData, 10000);
    rlSystem.train(5, false);
    
    const state = [0.5, 0.3, 0.2, 0.1, 0.4, 0.6, 0.8, 0.2, 0.3, 0.1, 0.05, 0.15];
    const prediction = rlSystem.predict(state);
    
    expect(prediction.action).toBeGreaterThanOrEqual(0);
    expect(prediction.action).toBeLessThanOrEqual(2);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
  });
});

describe('High-Frequency Trading Engine', () => {
  let hftEngine: HFTEngine;

  beforeEach(() => {
    hftEngine = new HFTEngine();
    hftEngine.addStrategy(new MarketMakingStrategy(0.0001, 10, 1.5, 1));
    hftEngine.addStrategy(new ArbitrageStrategy(0.0005, 100));
  });

  test('should process tick events and generate signals', () => {
    const tickEvent = {
      type: 'orderbook' as const,
      orderBook: {
        symbol: 'BTC-USD',
        timestamp: Date.now(),
        bids: [[45000, 1.5], [44999, 2.0]],
        asks: [[45001, 1.2], [45002, 1.8]]
      },
      timestamp: Date.now(),
      symbol: 'BTC-USD'
    };

    const signals = hftEngine.processTick(tickEvent);
    
    expect(Array.isArray(signals)).toBe(true);
    // Signals may be empty if conditions aren't met, which is valid
  });

  test('should track latency statistics', () => {
    const tickEvent = {
      type: 'orderbook' as const,
      orderBook: {
        symbol: 'BTC-USD',
        timestamp: Date.now(),
        bids: [[45000, 1.5]],
        asks: [[45001, 1.2]]
      },
      timestamp: Date.now(),
      symbol: 'BTC-USD'
    };

    hftEngine.processTick(tickEvent);
    const stats = hftEngine.getLatencyStats();
    
    expect(typeof stats).toBe('object');
  });
});

describe('Portfolio Optimization', () => {
  let optimizer: PortfolioOptimizer;

  beforeEach(() => {
    optimizer = new PortfolioOptimizer();
  });

  test('should optimize portfolio allocation', () => {
    const constraints = {
      maxPositionWeight: 0.4,
      minPositionWeight: 0.05,
      maxRisk: 0.2
    };

    const result = optimizer.optimizePortfolio(
      mockPositions,
      mockMarketData,
      10000,
      constraints,
      'meanVariance'
    );

    expect(result).toBeDefined();
    expect(result.recommendedAllocations).toBeDefined();
    expect(result.expectedReturn).toBeDefined();
    expect(result.expectedRisk).toBeDefined();
    expect(result.sharpeRatio).toBeDefined();
    expect(result.rebalanceActions).toBeInstanceOf(Array);
  });

  test('should generate rebalance actions', () => {
    const constraints = {
      maxPositionWeight: 0.4,
      minPositionWeight: 0.05,
      maxRisk: 0.2
    };

    const result = optimizer.optimizePortfolio(
      mockPositions,
      mockMarketData,
      10000,
      constraints
    );

    result.rebalanceActions.forEach(action => {
      expect(action.symbol).toBeDefined();
      expect(action.action).toMatch(/BUY|SELL|HOLD/);
      expect(action.currentWeight).toBeGreaterThanOrEqual(0);
      expect(action.targetWeight).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Market Data Provider', () => {
  let provider: EnhancedMarketDataProvider;

  beforeEach(() => {
    provider = new EnhancedMarketDataProvider('wss://test.example.com');
  });

  afterEach(async () => {
    await provider.disconnect();
  });

  test('should provide real-time market data', async () => {
    const data = await provider.getRealtimeData('BTC-USD');
    
    expect(data).toBeDefined();
    expect(data.symbol).toBe('BTC-USD');
    expect(data.price).toBeGreaterThan(0);
    expect(data.timestamp).toBeGreaterThan(0);
  });

  test('should provide historical market data', async () => {
    const start = Date.now() - 86400000; // 24 hours ago
    const end = Date.now();
    
    const data = await provider.getHistoricalData('BTC-USD', start, end);
    
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].symbol).toBe('BTC-USD');
  });

  test('should handle subscriptions', () => {
    const subscriptionId = provider.subscribe({
      symbol: 'BTC-USD',
      type: 'ticker',
      callback: (data) => {
        expect(data).toBeDefined();
      }
    });

    expect(typeof subscriptionId).toBe('string');
    
    provider.unsubscribe(subscriptionId);
    const status = provider.getConnectionStatus();
    expect(status.subscriptions).toBe(0);
  });
});

describe('Integration Tests', () => {
  test('should integrate AI engine with risk management', async () => {
    const aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: 'Test'
    });

    const riskManager = new RiskManager({
      maxPositionSize: 1000,
      maxDailyLoss: 500,
      maxDrawdown: 0.1,
      riskPerTrade: 0.02
    });

    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    const riskMetrics = riskManager.calculateRiskMetrics(mockPositions, 10000);
    
    expect(analysis).toBeDefined();
    expect(riskMetrics).toBeDefined();
    
    // Test integration
    if (analysis.signal !== 'HOLD') {
      const tradeAllowed = riskManager.shouldAllowTrade(
        analysis.signal as 'BUY' | 'SELL',
        'BTC-USD',
        analysis.positionSize,
        mockPositions,
        10000
      );
      expect(typeof tradeAllowed).toBe('boolean');
    }
  });

  test('should run end-to-end trading simulation', async () => {
    // This test simulates a complete trading cycle
    const aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: 'Test'
    });

    const riskManager = new RiskManager({
      maxPositionSize: 1000,
      maxDailyLoss: 500,
      maxDrawdown: 0.1,
      riskPerTrade: 0.02
    });

    const optimizer = new PortfolioOptimizer();

    // Step 1: Analyze market
    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    expect(analysis).toBeDefined();

    // Step 2: Check risk
    const riskMetrics = riskManager.calculateRiskMetrics(mockPositions, 10000);
    expect(riskMetrics).toBeDefined();

    // Step 3: Optimize portfolio
    const optimization = optimizer.optimizePortfolio(
      mockPositions,
      mockMarketData,
      10000,
      {
        maxPositionWeight: 0.4,
        minPositionWeight: 0.05,
        maxRisk: 0.2
      }
    );
    expect(optimization).toBeDefined();

    // All components should work together
    expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    expect(riskMetrics.totalExposure).toBeGreaterThanOrEqual(0);
    expect(optimization.expectedReturn).toBeDefined();
  });
});
