/**
 * Comprehensive Testing and Validation Framework
 * Implements paper trading, integration tests, and A/B testing
 */

import { Logger, getLogger } from './logger';
import { EnhancedAPIClient } from './api-client';
import { MonitoringSystem, getMonitoring } from './monitoring';
import { TradingError } from './errors';

export enum TestMode {
  PAPER_TRADING = 'PAPER_TRADING',
  INTEGRATION_TEST = 'INTEGRATION_TEST',
  AB_TEST = 'AB_TEST',
  REGRESSION_TEST = 'REGRESSION_TEST'
}

export interface TestConfig {
  mode: TestMode;
  duration: number;
  initialBalance: number;
  maxDrawdown: number;
  symbols: string[];
  strategies: string[];
  enableRealTimeValidation: boolean;
}

export interface PaperTrade {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  strategy: string;
  metadata?: Record<string, any>;
}

export interface PaperPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  lastUpdate: number;
}

export interface TestResult {
  testId: string;
  mode: TestMode;
  startTime: number;
  endTime: number;
  duration: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  averageTradeSize: number;
  metadata?: Record<string, any>;
}

export interface ABTestVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, any>;
  metrics: {
    trades: number;
    pnl: number;
    winRate: number;
    avgDuration: number;
  };
}

export class TestingFramework {
  private readonly logger: Logger;
  private readonly monitoring: MonitoringSystem;
  private readonly apiClient: EnhancedAPIClient;
  private readonly paperTrades: Map<string, PaperTrade> = new Map();
  private readonly paperPositions: Map<string, PaperPosition> = new Map();
  private readonly testResults: Map<string, TestResult> = new Map();
  private readonly abTestVariants: Map<string, ABTestVariant> = new Map();
  private paperBalance: number = 100000; // Default $100k
  private currentTest?: TestConfig;

  constructor(apiClient: EnhancedAPIClient) {
    this.logger = getLogger();
    this.monitoring = getMonitoring();
    this.apiClient = apiClient;
  }

  // Paper Trading Implementation
  async startPaperTrading(config: TestConfig): Promise<string> {
    const testId = this.generateTestId();
    
    this.currentTest = config;
    this.paperBalance = config.initialBalance;
    this.paperTrades.clear();
    this.paperPositions.clear();

    this.logger.info('Paper trading started', {
      testId,
      initialBalance: config.initialBalance,
      symbols: config.symbols,
      strategies: config.strategies
    });

    this.monitoring.createAlert(
      'INFO' as any,
      'Paper Trading Started',
      `Paper trading session started with ${config.initialBalance} balance`,
      'testing',
      { testId, config }
    );

    return testId;
  }

  async executePaperTrade(
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number,
    price: number,
    strategy: string,
    metadata?: Record<string, any>
  ): Promise<PaperTrade> {
    if (!this.currentTest) {
      throw new TradingError(
        'No active paper trading session',
        'VALIDATION_ERROR' as any,
        'MEDIUM' as any
      );
    }

    const tradeValue = quantity * price;
    const commission = tradeValue * 0.001; // 0.1% commission

    // Validate sufficient balance for buy orders
    if (side === 'buy' && this.paperBalance < tradeValue + commission) {
      throw new TradingError(
        'Insufficient paper trading balance',
        'VALIDATION_ERROR' as any,
        'MEDIUM' as any,
        { 
          required: tradeValue + commission,
          available: this.paperBalance
        }
      );
    }

    const trade: PaperTrade = {
      id: this.generateTradeId(),
      timestamp: Date.now(),
      symbol,
      side,
      quantity,
      price,
      strategy,
      metadata
    };

    this.paperTrades.set(trade.id, trade);
    this.updatePaperPosition(trade);
    this.updatePaperBalance(trade, commission);

    this.logger.info('Paper trade executed', {
      tradeId: trade.id,
      symbol,
      side,
      quantity,
      price,
      strategy,
      newBalance: this.paperBalance
    });

    this.monitoring.monitorTradingOperation(
      'paper_trade',
      symbol,
      'success',
      0,
      { tradeId: trade.id, side, quantity, price, strategy }
    );

    return trade;
  }

  getPaperPortfolio(): {
    balance: number;
    positions: PaperPosition[];
    totalValue: number;
    unrealizedPnL: number;
    realizedPnL: number;
  } {
    const positions = Array.from(this.paperPositions.values());
    const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const totalRealizedPnL = positions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
    const totalPositionValue = positions.reduce((sum, pos) => 
      sum + (pos.quantity * pos.averagePrice), 0
    );

    return {
      balance: this.paperBalance,
      positions,
      totalValue: this.paperBalance + totalPositionValue,
      unrealizedPnL: totalUnrealizedPnL,
      realizedPnL: totalRealizedPnL
    };
  }

  // Integration Testing
  async runIntegrationTests(testSuite: string[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testName of testSuite) {
      const testId = this.generateTestId();
      const startTime = Date.now();

      this.logger.info('Running integration test', { testId, testName });

      try {
        const result = await this.executeIntegrationTest(testName, testId);
        results.push(result);
        
        this.logger.info('Integration test completed', {
          testId,
          testName,
          success: result.successfulTrades > 0,
          duration: result.duration
        });
      } catch (error) {
        this.logger.error('Integration test failed', {
          testId,
          testName,
          error: (error as Error).message
        }, error as Error);

        results.push({
          testId,
          mode: TestMode.INTEGRATION_TEST,
          startTime,
          endTime: Date.now(),
          duration: Date.now() - startTime,
          totalTrades: 0,
          successfulTrades: 0,
          failedTrades: 1,
          totalPnL: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          winRate: 0,
          averageTradeSize: 0,
          metadata: { testName, error: (error as Error).message }
        });
      }
    }

    return results;
  }

  private async executeIntegrationTest(testName: string, testId: string): Promise<TestResult> {
    const startTime = Date.now();
    let successfulTrades = 0;
    let failedTrades = 0;

    // Test API connectivity
    try {
      await this.apiClient.request({
        method: 'GET',
        endpoint: '/v2/products',
        priority: 'HIGH' as any
      });
      successfulTrades++;
    } catch (error) {
      failedTrades++;
      this.logger.error('API connectivity test failed', { testId }, error as Error);
    }

    // Test market data fetching
    try {
      await this.apiClient.request({
        method: 'GET',
        endpoint: '/v2/tickers',
        priority: 'NORMAL' as any
      });
      successfulTrades++;
    } catch (error) {
      failedTrades++;
      this.logger.error('Market data test failed', { testId }, error as Error);
    }

    const endTime = Date.now();
    const result: TestResult = {
      testId,
      mode: TestMode.INTEGRATION_TEST,
      startTime,
      endTime,
      duration: endTime - startTime,
      totalTrades: successfulTrades + failedTrades,
      successfulTrades,
      failedTrades,
      totalPnL: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      winRate: successfulTrades / (successfulTrades + failedTrades),
      averageTradeSize: 0,
      metadata: { testName }
    };

    this.testResults.set(testId, result);
    return result;
  }

  // A/B Testing Framework
  createABTest(
    testName: string,
    variants: { id: string; name: string; weight: number; config: Record<string, any> }[]
  ): string {
    const testId = this.generateTestId();

    variants.forEach(variant => {
      const abVariant: ABTestVariant = {
        ...variant,
        metrics: {
          trades: 0,
          pnl: 0,
          winRate: 0,
          avgDuration: 0
        }
      };
      this.abTestVariants.set(`${testId}_${variant.id}`, abVariant);
    });

    this.logger.info('A/B test created', {
      testId,
      testName,
      variants: variants.map(v => ({ id: v.id, name: v.name, weight: v.weight }))
    });

    return testId;
  }

  selectABTestVariant(testId: string): ABTestVariant | null {
    const variants = Array.from(this.abTestVariants.entries())
      .filter(([key]) => key.startsWith(testId))
      .map(([, variant]) => variant);

    if (variants.length === 0) {
      return null;
    }

    // Weighted random selection
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
      random -= variant.weight;
      if (random <= 0) {
        return variant;
      }
    }

    return variants[0]; // Fallback
  }

  recordABTestResult(
    testId: string,
    variantId: string,
    pnl: number,
    duration: number,
    success: boolean
  ): void {
    const key = `${testId}_${variantId}`;
    const variant = this.abTestVariants.get(key);
    
    if (!variant) {
      return;
    }

    variant.metrics.trades++;
    variant.metrics.pnl += pnl;
    variant.metrics.avgDuration = (variant.metrics.avgDuration * (variant.metrics.trades - 1) + duration) / variant.metrics.trades;
    
    if (success) {
      variant.metrics.winRate = (variant.metrics.winRate * (variant.metrics.trades - 1) + 1) / variant.metrics.trades;
    } else {
      variant.metrics.winRate = (variant.metrics.winRate * (variant.metrics.trades - 1)) / variant.metrics.trades;
    }

    this.logger.debug('A/B test result recorded', {
      testId,
      variantId,
      pnl,
      duration,
      success,
      metrics: variant.metrics
    });
  }

  getABTestResults(testId: string): ABTestVariant[] {
    return Array.from(this.abTestVariants.entries())
      .filter(([key]) => key.startsWith(testId))
      .map(([, variant]) => variant)
      .sort((a, b) => b.metrics.pnl - a.metrics.pnl);
  }

  // Utility methods
  private updatePaperPosition(trade: PaperTrade): void {
    let position = this.paperPositions.get(trade.symbol);
    
    if (!position) {
      position = {
        symbol: trade.symbol,
        quantity: 0,
        averagePrice: 0,
        unrealizedPnL: 0,
        realizedPnL: 0,
        lastUpdate: Date.now()
      };
      this.paperPositions.set(trade.symbol, position);
    }

    if (trade.side === 'buy') {
      const newQuantity = position.quantity + trade.quantity;
      position.averagePrice = ((position.averagePrice * position.quantity) + (trade.price * trade.quantity)) / newQuantity;
      position.quantity = newQuantity;
    } else {
      // Sell order - realize P&L
      const soldQuantity = Math.min(position.quantity, trade.quantity);
      const realizedPnL = soldQuantity * (trade.price - position.averagePrice);
      position.realizedPnL += realizedPnL;
      position.quantity -= soldQuantity;
    }

    position.lastUpdate = Date.now();
  }

  private updatePaperBalance(trade: PaperTrade, commission: number): void {
    if (trade.side === 'buy') {
      this.paperBalance -= (trade.quantity * trade.price) + commission;
    } else {
      this.paperBalance += (trade.quantity * trade.price) - commission;
    }
  }

  private generateTestId(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public utility methods
  getTestResults(): TestResult[] {
    return Array.from(this.testResults.values());
  }

  clearTestData(): void {
    this.paperTrades.clear();
    this.paperPositions.clear();
    this.testResults.clear();
    this.abTestVariants.clear();
    this.currentTest = undefined;
    this.paperBalance = 100000;
    
    this.logger.info('Test data cleared');
  }

  getTestingMetrics() {
    return {
      activePaperTrades: this.paperTrades.size,
      paperPositions: this.paperPositions.size,
      testResults: this.testResults.size,
      abTestVariants: this.abTestVariants.size,
      paperBalance: this.paperBalance,
      currentTest: this.currentTest
    };
  }
}
