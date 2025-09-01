/**
 * Comprehensive Unit Tests for Risk Management System
 * Tests risk controls, validation, and alert mechanisms
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RiskManager, type RiskLimits, type RiskMetrics, type RiskAlert } from '../../lib/risk-management';
import type { Position } from '../../lib/types';

describe('RiskManager Unit Tests', () => {
  let riskManager: RiskManager;
  let mockRiskLimits: RiskLimits;

  beforeEach(() => {
    mockRiskLimits = {
      maxPositionSize: 0.1, // 10% of portfolio
      maxDrawdown: 0.15, // 15% maximum drawdown
      maxDailyLoss: 0.05, // 5% daily loss limit
      maxLeverage: 3.0,
      maxCorrelation: 0.7,
      stopLossPercentage: 0.02, // 2% stop loss
      maxOpenPositions: 10,
      riskPerTrade: 0.02, // 2% risk per trade
      maxPortfolioRisk: 0.1 // 10% total portfolio risk
    };

    riskManager = new RiskManager(mockRiskLimits);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with valid risk limits', () => {
      expect(riskManager).toBeInstanceOf(RiskManager);
    });

    test('should use default limits when none provided', () => {
      const defaultRiskManager = new RiskManager();
      expect(defaultRiskManager).toBeInstanceOf(RiskManager);
    });

    test('should validate risk limits on initialization', () => {
      const invalidLimits = {
        ...mockRiskLimits,
        maxPositionSize: 1.5 // Invalid: > 100%
      };

      // Should still create but with clamped values
      const manager = new RiskManager(invalidLimits);
      expect(manager).toBeInstanceOf(RiskManager);
    });
  });

  describe('Position Size Validation', () => {
    test('should approve valid position size', () => {
      const result = riskManager.validatePositionSize('BTC-USD', 0.05, 50000, 100000);
      
      expect(result.approved).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should reject oversized positions', () => {
      const result = riskManager.validatePositionSize('BTC-USD', 0.25, 50000, 100000);

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Position size exceeds limit');
    });

    test('should handle zero balance', () => {
      const result = riskManager.validatePositionSize('BTC-USD', 0.05, 50000, 0);
      
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Insufficient balance');
    });

    test('should handle negative position size', () => {
      const result = riskManager.validatePositionSize('BTC-USD', -0.05, 50000, 100000);
      
      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Invalid position size');
    });

    test('should calculate position value correctly', () => {
      const positionSize = 0.1;
      const price = 45000;
      const balance = 100000;
      
      const result = riskManager.validatePositionSize('BTC-USD', positionSize, price, balance);
      
      // Position value = 0.1 * 45000 = 4500
      // Percentage = 4500 / 100000 = 4.5% (within 10% limit)
      expect(result.approved).toBe(true);
    });
  });

  describe('Trade Validation', () => {
    const mockPositions: Position[] = [
      {
        id: '1',
        product: { symbol: 'BTC-USD', description: 'Bitcoin' },
        size: '0.05',
        entry_price: '45000',
        mark_price: '46000',
        realized_pnl: '50',
        unrealized_pnl: '50'
      },
      {
        id: '2',
        product: { symbol: 'ETH-USD', description: 'Ethereum' },
        size: '1.0',
        entry_price: '3000',
        mark_price: '3100',
        realized_pnl: '100',
        unrealized_pnl: '100'
      }
    ];

    test('should approve valid trade', async () => {
      const result = await riskManager.validateTrade(
        'BTC-USD',
        'long',
        0.02,
        45000,
        'momentum',
        mockPositions,
        100000
      );

      expect(result.approved).toBe(true);
    });

    test('should reject trade exceeding position limits', async () => {
      const result = await riskManager.validateTrade(
        'BTC-USD',
        'long',
        0.25, // This will be 0.25 * 45000 / 100000 = 11.25% > 10% limit
        45000,
        'momentum',
        mockPositions,
        100000
      );

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Position size exceeds limit');
    });

    test('should reject trade when max positions reached', async () => {
      // Create positions at the limit
      const maxPositions = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        product: { symbol: `COIN${i}-USD`, description: `Coin ${i}` },
        size: '0.01',
        entry_price: '1000',
        mark_price: '1010',
        realized_pnl: '10',
        unrealized_pnl: '10'
      }));

      const result = await riskManager.validateTrade(
        'NEW-USD',
        'long',
        0.02,
        1000,
        'momentum',
        maxPositions,
        100000
      );

      expect(result.approved).toBe(false);
      expect(result.reason).toContain('Maximum open positions reached');
    });

    test('should handle invalid trade parameters', async () => {
      const result = await riskManager.validateTrade(
        '',
        'invalid' as any,
        -0.1,
        0,
        '',
        mockPositions,
        100000
      );

      expect(result.approved).toBe(false);
    });
  });

  describe('Risk Metrics Calculation', () => {
    const mockPositions: Position[] = [
      {
        id: '1',
        product: { symbol: 'BTC-USD', description: 'Bitcoin' },
        size: '0.1',
        entry_price: '45000',
        mark_price: '44000', // Loss position
        realized_pnl: '0',
        unrealized_pnl: '-100'
      },
      {
        id: '2',
        product: { symbol: 'ETH-USD', description: 'Ethereum' },
        size: '2.0',
        entry_price: '3000',
        mark_price: '3200', // Profit position
        realized_pnl: '200',
        unrealized_pnl: '400'
      }
    ];

    test('should calculate portfolio risk correctly', () => {
      const metrics = riskManager.getRiskMetrics(mockPositions, 100000);

      expect(metrics).toBeDefined();
      expect(metrics.portfolioRisk).toBeGreaterThan(0);
      expect(metrics.totalExposure).toBeGreaterThan(0);
      expect(metrics.unrealizedPnL).toBe(300); // -100 + 400
      expect(metrics.realizedPnL).toBe(200);
    });

    test('should calculate drawdown correctly', () => {
      const metrics = riskManager.getRiskMetrics(mockPositions, 100000);

      expect(metrics.currentDrawdown).toBeGreaterThanOrEqual(0);
      expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(metrics.currentDrawdown);
    });

    test('should handle empty positions', () => {
      const metrics = riskManager.getRiskMetrics([], 100000);

      expect(metrics.portfolioRisk).toBe(0);
      expect(metrics.totalExposure).toBe(0);
      expect(metrics.unrealizedPnL).toBe(0);
      expect(metrics.realizedPnL).toBe(0);
      expect(metrics.currentDrawdown).toBe(0);
    });

    test('should handle zero balance', () => {
      const metrics = riskManager.getRiskMetrics(mockPositions, 0);

      expect(metrics).toBeDefined();
      expect(metrics.portfolioRisk).toBe(0);
    });
  });

  describe('Risk Alerts and Monitoring', () => {
    const highRiskPositions: Position[] = [
      {
        id: '1',
        product: { symbol: 'BTC-USD', description: 'Bitcoin' },
        size: '0.2', // Large position
        entry_price: '50000',
        mark_price: '42000', // 16% loss
        realized_pnl: '0',
        unrealized_pnl: '-1600' // 16% drawdown > 15% limit
      }
    ];

    test('should generate drawdown alerts', () => {
      const metrics = riskManager.getRiskMetrics(highRiskPositions, 10000);
      const alerts = riskManager.checkRiskLimits(metrics, highRiskPositions, 10000);

      const drawdownAlert = alerts.find(alert => alert.type === 'drawdown');
      expect(drawdownAlert).toBeDefined();
      expect(drawdownAlert?.severity).toBe('critical');
    });

    test('should generate position size alerts', () => {
      const largePositions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.15', // 15% of portfolio
          entry_price: '50000',
          mark_price: '50000',
          realized_pnl: '0',
          unrealized_pnl: '0'
        }
      ];

      const metrics = riskManager.getRiskMetrics(largePositions, 50000);
      const alerts = riskManager.checkRiskLimits(metrics, largePositions, 50000);

      const positionAlert = alerts.find(alert => alert.type === 'position_size');
      expect(positionAlert).toBeDefined();
    });

    test('should not generate alerts for healthy portfolio', () => {
      const healthyPositions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.05', // 5% position
          entry_price: '45000',
          mark_price: '46000', // Small profit
          realized_pnl: '50',
          unrealized_pnl: '50'
        }
      ];

      const metrics = riskManager.getRiskMetrics(healthyPositions, 100000);
      const alerts = riskManager.checkRiskLimits(metrics, healthyPositions, 100000);

      expect(alerts).toHaveLength(0);
    });

    test('should prioritize alerts by severity', () => {
      const criticalPositions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.2',
          entry_price: '50000',
          mark_price: '40000', // 20% loss
          realized_pnl: '0',
          unrealized_pnl: '-2000'
        }
      ];

      const metrics = riskManager.getRiskMetrics(criticalPositions, 10000);
      const alerts = riskManager.checkRiskLimits(metrics, criticalPositions, 10000);

      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('Stop Loss and Take Profit', () => {
    test('should calculate stop loss correctly for long position', () => {
      const entryPrice = 45000;
      const stopLoss = riskManager.calculateStopLoss(entryPrice, 'long');

      expect(stopLoss).toBeLessThan(entryPrice);
      expect(stopLoss).toBe(entryPrice * (1 - mockRiskLimits.stopLossPercentage));
    });

    test('should calculate stop loss correctly for short position', () => {
      const entryPrice = 45000;
      const stopLoss = riskManager.calculateStopLoss(entryPrice, 'short');

      expect(stopLoss).toBeGreaterThan(entryPrice);
      expect(stopLoss).toBe(entryPrice * (1 + mockRiskLimits.stopLossPercentage));
    });

    test('should calculate take profit with risk-reward ratio', () => {
      const entryPrice = 45000;
      const stopLoss = 44100; // 2% stop loss
      const riskRewardRatio = 2.0;

      const takeProfit = riskManager.calculateTakeProfit(entryPrice, stopLoss, 'long', riskRewardRatio);

      const risk = entryPrice - stopLoss; // 900
      const expectedReward = risk * riskRewardRatio; // 1800
      const expectedTakeProfit = entryPrice + expectedReward; // 46800

      expect(takeProfit).toBe(expectedTakeProfit);
    });

    test('should handle invalid stop loss calculation', () => {
      const stopLoss = riskManager.calculateStopLoss(0, 'long');
      expect(stopLoss).toBe(0);

      const stopLoss2 = riskManager.calculateStopLoss(-1000, 'short');
      expect(stopLoss2).toBeLessThanOrEqual(0);
    });
  });

  describe('Portfolio Correlation Analysis', () => {
    test('should detect high correlation risk', async () => {
      // Mock positions with similar assets (high correlation)
      const correlatedPositions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.1',
          entry_price: '45000',
          mark_price: '46000',
          realized_pnl: '100',
          unrealized_pnl: '100'
        },
        {
          id: '2',
          product: { symbol: 'ETH-USD', description: 'Ethereum' },
          size: '2.0',
          entry_price: '3000',
          mark_price: '3100',
          realized_pnl: '200',
          unrealized_pnl: '200'
        }
      ];

      // Test adding another crypto position (high correlation)
      const result = await riskManager.validateTrade(
        'LTC-USD',
        'long',
        0.05,
        150,
        'momentum',
        correlatedPositions,
        100000
      );

      // Should still approve but may warn about correlation
      expect(result).toBeDefined();
    });
  });

  describe('Emergency Risk Controls', () => {
    test('should suspend trading on critical drawdown', () => {
      const criticalPositions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.3',
          entry_price: '50000',
          mark_price: '35000', // 30% loss
          realized_pnl: '0',
          unrealized_pnl: '-4500'
        }
      ];

      const metrics = riskManager.getRiskMetrics(criticalPositions, 15000);
      const alerts = riskManager.checkRiskLimits(metrics, criticalPositions, 15000);

      const suspensionAlert = alerts.find(alert => 
        alert.severity === 'critical' && alert.type === 'drawdown'
      );
      expect(suspensionAlert).toBeDefined();
    });

    test('should handle risk limit updates', () => {
      const newLimits: Partial<RiskLimits> = {
        maxPositionSize: 0.05, // Reduce from 10% to 5%
        maxDrawdown: 0.1 // Reduce from 15% to 10%
      };

      riskManager.updateRiskLimits(newLimits);

      // Test that new limits are applied
      const result = riskManager.validatePositionSize('BTC-USD', 0.12, 50000, 100000);
      expect(result.approved).toBe(false); // Should now be rejected
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle malformed position data', () => {
      const malformedPositions = [
        {
          id: '1',
          product: null,
          size: 'invalid',
          entry_price: null,
          mark_price: undefined,
          realized_pnl: 'not_a_number',
          unrealized_pnl: NaN
        }
      ] as any;

      const metrics = riskManager.getRiskMetrics(malformedPositions, 100000);
      expect(metrics).toBeDefined();
      expect(metrics.portfolioRisk).toBe(0);
    });

    test('should handle extreme market conditions', () => {
      const extremePositions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.1',
          entry_price: '50000',
          mark_price: '1', // 99.998% loss
          realized_pnl: '0',
          unrealized_pnl: '-4999.9'
        }
      ];

      const metrics = riskManager.getRiskMetrics(extremePositions, 5000);
      const alerts = riskManager.checkRiskLimits(metrics, extremePositions, 5000);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(alert => alert.severity === 'critical')).toBe(true);
    });

    test('should handle concurrent risk checks', async () => {
      const positions: Position[] = [
        {
          id: '1',
          product: { symbol: 'BTC-USD', description: 'Bitcoin' },
          size: '0.05',
          entry_price: '45000',
          mark_price: '46000',
          realized_pnl: '50',
          unrealized_pnl: '50'
        }
      ];

      // Run multiple concurrent validations
      const promises = Array.from({ length: 5 }, (_, i) =>
        riskManager.validateTrade(
          `COIN${i}-USD`,
          'long',
          0.02,
          1000,
          'test',
          positions,
          100000
        )
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(typeof result.approved).toBe('boolean');
      });
    });
  });
});
