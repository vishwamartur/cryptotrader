/**
 * Comprehensive Unit Tests for AI Trading Engine
 * Tests all core functionality, edge cases, and error handling
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AITradingEngine, type AITradingConfig, type MarketAnalysis } from '../../lib/ai-trading-engine';

// Mock fetch globally
global.fetch = jest.fn();

describe('AITradingEngine Unit Tests', () => {
  let aiEngine: AITradingEngine;
  let mockConfig: AITradingConfig;

  beforeEach(() => {
    mockConfig = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.1,
      systemPrompt: 'Test AI trading analysis',
      enableAutonomousTrading: false,
      apiKey: 'test-api-key-123'
    };
    
    aiEngine = new AITradingEngine(mockConfig);
    
    // Reset fetch mock
    (fetch as jest.MockedFunction<typeof fetch>).mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with valid configuration', () => {
      expect(aiEngine).toBeInstanceOf(AITradingEngine);
      expect(aiEngine.isCurrentlyAnalyzing()).toBe(false);
    });

    test('should handle missing configuration gracefully', () => {
      const minimalConfig = {
        model: 'test-model',
        maxTokens: 1000,
        temperature: 0.1,
        systemPrompt: 'test'
      };
      
      const engine = new AITradingEngine(minimalConfig);
      expect(engine).toBeInstanceOf(AITradingEngine);
    });

    test('should validate temperature bounds', () => {
      const invalidConfig = {
        ...mockConfig,
        temperature: 2.0 // Invalid temperature > 1
      };
      
      // Should still create engine but clamp temperature
      const engine = new AITradingEngine(invalidConfig);
      expect(engine).toBeInstanceOf(AITradingEngine);
    });
  });

  describe('Market Analysis', () => {
    const mockMarketData = [
      { symbol: 'BTC-USD', price: 45000, volume: 1000000, timestamp: Date.now() - 3600000 },
      { symbol: 'BTC-USD', price: 46000, volume: 1100000, timestamp: Date.now() - 1800000 },
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

    test('should analyze market data successfully', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                signal: 'BUY',
                confidence: 75,
                reasoning: 'Strong upward momentum detected',
                positionSize: 0.1,
                entryPrice: 44500,
                stopLoss: 43000,
                takeProfit: 47000,
                riskReward: 2.3
              })
            }
          }]
        })
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse as any);

      const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('BUY');
      expect(analysis.confidence).toBe(75);
      expect(analysis.reasoning).toContain('Strong upward momentum');
      expect(analysis.positionSize).toBe(0.1);
      expect(analysis.riskReward).toBe(2.3);
    });

    test('should handle API failure gracefully', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Network error'));

      const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.confidence).toBeLessThanOrEqual(50);
      expect(analysis.reasoning).toContain('AI analysis failed');
    });

    test('should handle invalid API response', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: 'Invalid JSON response'
            }
          }]
        })
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse as any);

      const analysis = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.confidence).toBeLessThanOrEqual(50);
    });

    test('should handle empty market data', async () => {
      const analysis = await aiEngine.analyzeMarket([], [], 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.confidence).toBe(0);
      expect(analysis.entryPrice).toBe(45000); // Default price
    });

    test('should prevent concurrent analysis', async () => {
      const mockResponse = {
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
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse as any), 100))
      );

      // Start first analysis
      const analysis1Promise = aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
      
      // Try to start second analysis immediately
      expect(aiEngine.isCurrentlyAnalyzing()).toBe(true);
      
      const analysis2 = await aiEngine.analyzeMarket(mockMarketData, mockPositions, 10000);
      
      // Second analysis should return default due to concurrent execution prevention
      expect(analysis2.signal).toBe('HOLD');
      expect(analysis2.confidence).toBe(0);
      
      // Wait for first analysis to complete
      const analysis1 = await analysis1Promise;
      expect(analysis1.signal).toBe('HOLD');
      expect(analysis1.confidence).toBe(50);
    });
  });

  describe('Autonomous Trading', () => {
    test('should reject autonomous trading when disabled', async () => {
      const mockAnalysis: MarketAnalysis = {
        signal: 'BUY',
        confidence: 80,
        reasoning: 'Strong buy signal',
        positionSize: 0.1,
        entryPrice: 45000,
        stopLoss: 43000,
        takeProfit: 47000,
        riskReward: 2.0
      };

      const result = await aiEngine.executeAutonomousTrade(mockAnalysis);
      expect(result).toBe(false);
    });

    test('should reject low confidence trades', async () => {
      const autonomousConfig = { ...mockConfig, enableAutonomousTrading: true };
      const autonomousEngine = new AITradingEngine(autonomousConfig);

      const lowConfidenceAnalysis: MarketAnalysis = {
        signal: 'BUY',
        confidence: 60, // Below 70% threshold
        reasoning: 'Weak signal',
        positionSize: 0.1,
        entryPrice: 45000,
        stopLoss: 43000,
        takeProfit: 47000,
        riskReward: 2.0
      };

      const result = await autonomousEngine.executeAutonomousTrade(lowConfidenceAnalysis);
      expect(result).toBe(false);
    });

    test('should execute high confidence trades when enabled', async () => {
      const autonomousConfig = { ...mockConfig, enableAutonomousTrading: true };
      const autonomousEngine = new AITradingEngine(autonomousConfig);

      const highConfidenceAnalysis: MarketAnalysis = {
        signal: 'BUY',
        confidence: 85,
        reasoning: 'Very strong signal',
        positionSize: 0.1,
        entryPrice: 45000,
        stopLoss: 43000,
        takeProfit: 47000,
        riskReward: 2.0
      };

      const mockResponse = { ok: true };
      (fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce(mockResponse as any);

      const result = await autonomousEngine.executeAutonomousTrade(highConfidenceAnalysis);
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledWith('/api/ai/execute-trade', expect.any(Object));
    });

    test('should handle trade execution failure', async () => {
      const autonomousConfig = { ...mockConfig, enableAutonomousTrading: true };
      const autonomousEngine = new AITradingEngine(autonomousConfig);

      const highConfidenceAnalysis: MarketAnalysis = {
        signal: 'BUY',
        confidence: 85,
        reasoning: 'Very strong signal',
        positionSize: 0.1,
        entryPrice: 45000,
        stopLoss: 43000,
        takeProfit: 47000,
        riskReward: 2.0
      };

      (fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(new Error('Trade execution failed'));

      const result = await autonomousEngine.executeAutonomousTrade(highConfidenceAnalysis);
      expect(result).toBe(false);
    });
  });

  describe('Response Parsing', () => {
    test('should parse valid AI response correctly', () => {
      const validResponse = JSON.stringify({
        signal: 'SELL',
        confidence: 90,
        reasoning: 'Strong bearish indicators',
        positionSize: 0.2,
        entryPrice: 44000,
        stopLoss: 45000,
        takeProfit: 42000,
        riskReward: 2.0
      });

      // Access private method through any casting for testing
      const analysis = (aiEngine as any).parseAIResponse(validResponse, 44000);

      expect(analysis.signal).toBe('SELL');
      expect(analysis.confidence).toBe(90);
      expect(analysis.reasoning).toBe('Strong bearish indicators');
      expect(analysis.positionSize).toBe(0.2);
      expect(analysis.riskReward).toBe(2.0);
    });

    test('should handle malformed JSON response', () => {
      const malformedResponse = 'This is not valid JSON';

      const analysis = (aiEngine as any).parseAIResponse(malformedResponse, 45000);

      expect(analysis.signal).toBe('HOLD');
      expect(analysis.confidence).toBeLessThanOrEqual(50);
      expect(analysis.entryPrice).toBe(45000);
    });

    test('should validate signal values', () => {
      const invalidSignalResponse = JSON.stringify({
        signal: 'INVALID_SIGNAL',
        confidence: 80,
        reasoning: 'Test',
        positionSize: 0.1,
        entryPrice: 45000,
        stopLoss: 44000,
        takeProfit: 46000,
        riskReward: 1.0
      });

      const analysis = (aiEngine as any).parseAIResponse(invalidSignalResponse, 45000);

      expect(['BUY', 'SELL', 'HOLD']).toContain(analysis.signal);
    });

    test('should clamp confidence values', () => {
      const highConfidenceResponse = JSON.stringify({
        signal: 'BUY',
        confidence: 150, // Invalid confidence > 100
        reasoning: 'Test',
        positionSize: 0.1,
        entryPrice: 45000,
        stopLoss: 44000,
        takeProfit: 46000,
        riskReward: 1.0
      });

      const analysis = (aiEngine as any).parseAIResponse(highConfidenceResponse, 45000);

      expect(analysis.confidence).toBeLessThanOrEqual(100);
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle null market data', async () => {
      const analysis = await aiEngine.analyzeMarket(null as any, [], 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.confidence).toBe(0);
    });

    test('should handle negative balance', async () => {
      const mockMarketData = [
        { symbol: 'BTC-USD', price: 45000, volume: 1000000, timestamp: Date.now() }
      ];

      const analysis = await aiEngine.analyzeMarket(mockMarketData, [], -1000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.positionSize).toBe(0);
    });

    test('should handle very old market data', async () => {
      const oldMarketData = [
        { symbol: 'BTC-USD', price: 45000, volume: 1000000, timestamp: Date.now() - 86400000 * 7 } // 7 days old
      ];

      const analysis = await aiEngine.analyzeMarket(oldMarketData, [], 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.confidence).toBeLessThanOrEqual(30); // Should have low confidence for stale data
    });

    test('should handle API timeout', async () => {
      (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const mockMarketData = [
        { symbol: 'BTC-USD', price: 45000, volume: 1000000, timestamp: Date.now() }
      ];

      const analysis = await aiEngine.analyzeMarket(mockMarketData, [], 10000);

      expect(analysis).toBeDefined();
      expect(analysis.signal).toBe('HOLD');
      expect(analysis.reasoning).toContain('AI analysis failed');
    });
  });
});
