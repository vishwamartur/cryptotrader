// Integration Tests for Complete Trading System
// Tests the interaction between different components

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { testUtils } from './setup';

import { AutonomousAgent } from '../lib/autonomous-agent';
import { AITradingEngine } from '../lib/ai-trading-engine';
import { RiskManager } from '../lib/risk-management';
import { QuantStrategyEngine } from '../lib/quant-strategy-engine';
import { EnhancedMarketDataProvider } from '../lib/market-data-provider';
import { PortfolioOptimizer } from '../lib/portfolio-optimizer';

describe('Full System Integration Tests', () => {
  let agent: AutonomousAgent;
  let marketDataProvider: EnhancedMarketDataProvider;

  beforeEach(() => {
    const agentConfig = {
      aiConfig: {
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 1000,
        temperature: 0.1,
        systemPrompt: 'Test trading agent'
      },
      riskLimits: {
        maxPositionSize: 1000,
        maxDailyLoss: 500,
        maxDrawdown: 0.1,
        riskPerTrade: 0.02
      },
      analysisInterval: 1,
      maxConcurrentAnalyses: 3,
      emergencyStopLoss: 0.05,
      maxDailyTrades: 10,
      maxPositionSize: 5000,
      enabledStrategies: {
        ai: true,
        quant: true,
        hft: false,
        rl: false,
        defi: false
      },
      marketRegimes: {
        bull: { riskMultiplier: 0.8, positionSizeMultiplier: 1.2 },
        bear: { riskMultiplier: 1.5, positionSizeMultiplier: 0.8 },
        sideways: { riskMultiplier: 1.0, positionSizeMultiplier: 1.0 },
        volatile: { riskMultiplier: 2.0, positionSizeMultiplier: 0.6 }
      },
      tradingHours: {
        start: '00:00',
        end: '23:59',
        timezone: 'UTC',
        weekendsEnabled: true
      },
      circuitBreakers: {
        maxDrawdown: 0.15,
        maxConsecutiveLosses: 5,
        minAccountBalance: 1000,
        volatilityThreshold: 0.5
      },
      targets: {
        dailyReturnTarget: 0.02,
        monthlyReturnTarget: 0.1,
        maxVolatility: 0.3,
        minSharpeRatio: 1.0
      }
    };

    agent = new AutonomousAgent(agentConfig);
    marketDataProvider = new EnhancedMarketDataProvider();
  });

  afterEach(async () => {
    if (agent) {
      agent.stop();
    }
    if (marketDataProvider) {
      await marketDataProvider.disconnect();
    }
  });

  test('should start and stop autonomous agent successfully', async () => {
    expect(agent.getState().status).toBe('STOPPED');
    
    agent.start();
    expect(agent.getState().status).toBe('RUNNING');
    
    // Wait a bit for initialization
    await testUtils.wait(100);
    
    agent.stop();
    expect(agent.getState().status).toBe('STOPPED');
  });

  test('should handle market data subscription and analysis', async () => {
    const mockData = testUtils.generateMockMarketData(10);
    let receivedData: any = null;

    const subscriptionId = marketDataProvider.subscribe({
      symbol: 'BTC-USD',
      type: 'ticker',
      callback: (data) => {
        receivedData = data;
      }
    });

    expect(typeof subscriptionId).toBe('string');
    expect(marketDataProvider.getConnectionStatus().subscriptions).toBe(1);

    // Simulate receiving data
    const testData = await marketDataProvider.getRealtimeData('BTC-USD');
    expect(testData).toBeDefined();
    expect(testData.symbol).toBe('BTC-USD');

    marketDataProvider.unsubscribe(subscriptionId);
    expect(marketDataProvider.getConnectionStatus().subscriptions).toBe(0);
  });

  test('should integrate AI analysis with risk management', async () => {
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

    const mockMarketData = testUtils.generateMockMarketData(5);
    const mockPositions = testUtils.generateMockPositions(2);

    // Get AI analysis
    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    expect(analysis).toBeDefined();

    // Check risk metrics
    const riskMetrics = riskManager.calculateRiskMetrics(mockPositions, 10000);
    testUtils.validateRiskMetrics(riskMetrics);

    // Test risk approval for AI signal
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

  test('should integrate quantitative strategies with portfolio optimization', () => {
    const strategyEngine = new QuantStrategyEngine();
    const optimizer = new PortfolioOptimizer();

    const mockMarketData = testUtils.generateMockMarketData(50);
    const mockPositions = testUtils.generateMockPositions(3);

    // Run quantitative analysis
    const prices = mockMarketData.map(d => d.price);
    const volumes = mockMarketData.map(d => d.volume);

    // Test strategy execution (this would normally be done by the strategy engine)
    expect(prices.length).toBeGreaterThan(0);
    expect(volumes.length).toBeGreaterThan(0);

    // Run portfolio optimization
    const constraints = {
      maxPositionWeight: 0.4,
      minPositionWeight: 0.05,
      maxRisk: 0.2
    };

    const optimization = optimizer.optimizePortfolio(
      mockPositions,
      mockMarketData,
      10000,
      constraints
    );

    expect(optimization).toBeDefined();
    expect(optimization.recommendedAllocations).toBeDefined();
    expect(optimization.rebalanceActions).toBeInstanceOf(Array);
  });

  test('should handle complete trading workflow', async () => {
    const mockMarketData = testUtils.generateMockMarketData(20);
    const mockPositions = testUtils.generateMockPositions(2);

    // Step 1: Market Data Analysis
    const aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: 'Test'
    });

    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    expect(analysis).toBeDefined();

    // Step 2: Risk Assessment
    const riskManager = new RiskManager({
      maxPositionSize: 1000,
      maxDailyLoss: 500,
      maxDrawdown: 0.1,
      riskPerTrade: 0.02
    });

    const riskMetrics = riskManager.calculateRiskMetrics(mockPositions, 10000);
    testUtils.validateRiskMetrics(riskMetrics);

    // Step 3: Portfolio Optimization
    const optimizer = new PortfolioOptimizer();
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

    // Step 4: Decision Making
    let finalDecision = 'HOLD';
    if (analysis.signal !== 'HOLD' && analysis.confidence > 0.7) {
      const tradeAllowed = riskManager.shouldAllowTrade(
        analysis.signal as 'BUY' | 'SELL',
        'BTC-USD',
        analysis.positionSize,
        mockPositions,
        10000
      );
      
      if (tradeAllowed) {
        finalDecision = analysis.signal;
      }
    }

    expect(['BUY', 'SELL', 'HOLD']).toContain(finalDecision);

    // Verify all components worked together
    expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    expect(riskMetrics.totalExposure).toBeGreaterThanOrEqual(0);
    expect(optimization.expectedReturn).toBeDefined();
  });

  test('should handle error scenarios gracefully', async () => {
    // Test with invalid market data
    const invalidMarketData: any[] = [
      { symbol: 'BTC-USD', price: null, volume: 1000, timestamp: Date.now() },
      { symbol: 'BTC-USD', price: 'invalid', volume: 1000, timestamp: Date.now() }
    ];

    const aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: 'Test'
    });

    // Should handle invalid data gracefully
    const analysis = await aiEngine.analyzeMarket(invalidMarketData, [], 10000);
    expect(analysis.signal).toBe('HOLD');
    expect(analysis.confidence).toBe(0.5);
  });

  test('should maintain performance under load', async () => {
    const startTime = Date.now();
    const promises: Promise<any>[] = [];

    // Simulate concurrent operations
    for (let i = 0; i < 10; i++) {
      const mockData = testUtils.generateMockMarketData(10);
      const mockPositions = testUtils.generateMockPositions(2);

      const aiEngine = new AITradingEngine({
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 500,
        temperature: 0.1,
        systemPrompt: 'Test'
      });

      promises.push(aiEngine.analyzeMarket(mockData, mockPositions, 10000));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;

    expect(results.length).toBe(10);
    expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

    // All results should be valid
    results.forEach(result => {
      expect(result).toBeDefined();
      expect(['BUY', 'SELL', 'HOLD']).toContain(result.signal);
    });
  });

  test('should handle real-time data streaming simulation', async () => {
    const receivedUpdates: any[] = [];
    
    const subscriptionId = marketDataProvider.subscribe({
      symbol: 'BTC-USD',
      type: 'ticker',
      callback: (data) => {
        receivedUpdates.push(data);
      }
    });

    // Simulate multiple data updates
    for (let i = 0; i < 5; i++) {
      const data = await marketDataProvider.getRealtimeData('BTC-USD');
      expect(data).toBeDefined();
      await testUtils.wait(10); // Small delay between updates
    }

    marketDataProvider.unsubscribe(subscriptionId);
    
    // Verify subscription management
    expect(marketDataProvider.getConnectionStatus().subscriptions).toBe(0);
  });

  test('should validate system state consistency', () => {
    const state = agent.getState();
    
    // Verify state structure
    expect(state.status).toMatch(/STOPPED|RUNNING|PAUSED|ERROR|EMERGENCY_STOP/);
    expect(typeof state.totalTrades).toBe('number');
    expect(typeof state.dailyPnL).toBe('number');
    expect(typeof state.currentDrawdown).toBe('number');
    expect(Array.isArray(state.errors)).toBe(true);
    expect(Array.isArray(state.warnings)).toBe(true);
    expect(Array.isArray(state.decisions)).toBe(true);
    
    // Verify strategy performance structure
    expect(state.strategyPerformance).toBeDefined();
    expect(state.strategyPerformance.ai).toBeDefined();
    expect(state.strategyPerformance.quant).toBeDefined();
    
    // Verify circuit breaker structure
    expect(state.circuitBreakers).toBeDefined();
    expect(typeof state.circuitBreakers.drawdownTriggered).toBe('boolean');
    expect(typeof state.circuitBreakers.consecutiveLossesTriggered).toBe('boolean');
  });
});

describe('Component Interaction Tests', () => {
  test('should pass data correctly between components', async () => {
    const mockMarketData = testUtils.generateMockMarketData(10);
    const mockPositions = testUtils.generateMockPositions(3);

    // Test data flow: Market Data -> AI Analysis -> Risk Check -> Portfolio Optimization
    
    // 1. Market data should be properly formatted
    mockMarketData.forEach(data => {
      expect(data.symbol).toBeDefined();
      expect(typeof data.price).toBe('number');
      expect(typeof data.timestamp).toBe('number');
    });

    // 2. AI analysis should accept market data
    const aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: 'Test'
    });

    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    expect(analysis).toBeDefined();

    // 3. Risk manager should accept positions and balance
    const riskManager = new RiskManager({
      maxPositionSize: 1000,
      maxDailyLoss: 500,
      maxDrawdown: 0.1,
      riskPerTrade: 0.02
    });

    const riskMetrics = riskManager.calculateRiskMetrics(mockPositions, 10000);
    expect(riskMetrics).toBeDefined();

    // 4. Portfolio optimizer should accept all inputs
    const optimizer = new PortfolioOptimizer();
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

    // Verify data consistency across components
    expect(analysis.positionSize).toBeGreaterThan(0);
    expect(riskMetrics.totalExposure).toBeGreaterThanOrEqual(0);
    expect(optimization.expectedReturn).toBeDefined();
  });

  test('should handle component failures gracefully', async () => {
    // Test with components that might fail
    const mockMarketData = testUtils.generateMockMarketData(5);
    const mockPositions = testUtils.generateMockPositions(2);

    // Mock API failure
    testUtils.mockApiError('Network error');

    const aiEngine = new AITradingEngine({
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 1000,
      temperature: 0.1,
      systemPrompt: 'Test'
    });

    // Should handle API failure gracefully
    const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
    
    // Should return safe defaults on failure
    expect(analysis.signal).toBe('HOLD');
    expect(analysis.confidence).toBe(0.5);
  });
});
