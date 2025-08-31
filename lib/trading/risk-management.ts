/**
 * Comprehensive Risk Management System
 * Implements position sizing, stop-loss, drawdown protection, and portfolio risk controls
 */

import { Logger, getLogger } from './logger';
import { MonitoringSystem, getMonitoring } from './monitoring';
import { TradingError, RiskManagementError } from './errors';

export interface RiskConfig {
  maxPositionSize: number; // Percentage of portfolio
  maxPortfolioRisk: number; // Maximum portfolio risk percentage
  maxDrawdown: number; // Maximum drawdown before trading suspension
  stopLossPercentage: number; // Default stop-loss percentage
  takeProfitPercentage: number; // Default take-profit percentage
  maxDailyLoss: number; // Maximum daily loss limit
  maxOpenPositions: number; // Maximum number of open positions
  volatilityLookback: number; // Days for volatility calculation
  correlationThreshold: number; // Maximum correlation between positions
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: number;
  strategy: string;
  metadata?: Record<string, any>;
}

export interface RiskMetrics {
  portfolioValue: number;
  totalExposure: number;
  unrealizedPnL: number;
  realizedPnL: number;
  dailyPnL: number;
  maxDrawdown: number;
  currentDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  var95: number; // Value at Risk 95%
  beta: number;
  openPositions: number;
  riskUtilization: number; // Percentage of risk budget used
}

export interface RiskAlert {
  type: 'position_size' | 'drawdown' | 'correlation' | 'volatility' | 'exposure';
  severity: 'warning' | 'critical';
  message: string;
  symbol?: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export class RiskManager {
  private readonly config: RiskConfig;
  private readonly logger: Logger;
  private readonly monitoring: MonitoringSystem;
  private readonly positions: Map<string, Position> = new Map();
  private readonly priceHistory: Map<string, number[]> = new Map();
  private portfolioValue: number = 100000; // Default portfolio value
  private dailyStartValue: number = 100000;
  private maxPortfolioValue: number = 100000;
  private tradingSuspended: boolean = false;

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = {
      maxPositionSize: 0.05, // 5% of portfolio
      maxPortfolioRisk: 0.02, // 2% portfolio risk
      maxDrawdown: 0.10, // 10% maximum drawdown
      stopLossPercentage: 0.02, // 2% stop-loss
      takeProfitPercentage: 0.04, // 4% take-profit
      maxDailyLoss: 0.03, // 3% daily loss limit
      maxOpenPositions: 10,
      volatilityLookback: 20,
      correlationThreshold: 0.7,
      ...config
    };

    this.logger = getLogger();
    this.monitoring = getMonitoring();
  }

  // Position Management
  async validateTrade(
    symbol: string,
    side: 'long' | 'short',
    quantity: number,
    price: number,
    strategy: string
  ): Promise<{ approved: boolean; adjustedQuantity?: number; reason?: string }> {
    if (this.tradingSuspended) {
      return {
        approved: false,
        reason: 'Trading suspended due to risk limits'
      };
    }

    const tradeValue = quantity * price;
    const positionSizeRatio = tradeValue / this.portfolioValue;

    // Check position size limit
    if (positionSizeRatio > this.config.maxPositionSize) {
      const maxQuantity = Math.floor((this.portfolioValue * this.config.maxPositionSize) / price);
      
      this.logger.warn('Position size exceeds limit', {
        symbol,
        requestedQuantity: quantity,
        maxQuantity,
        positionSizeRatio,
        limit: this.config.maxPositionSize
      });

      return {
        approved: true,
        adjustedQuantity: maxQuantity,
        reason: 'Position size adjusted to comply with risk limits'
      };
    }

    // Check maximum open positions
    if (this.positions.size >= this.config.maxOpenPositions) {
      return {
        approved: false,
        reason: 'Maximum number of open positions reached'
      };
    }

    // Check correlation with existing positions
    const correlationRisk = await this.checkCorrelationRisk(symbol);
    if (correlationRisk > this.config.correlationThreshold) {
      this.monitoring.monitorRiskEvent(
        'high_correlation',
        symbol,
        'medium',
        { correlation: correlationRisk, threshold: this.config.correlationThreshold }
      );

      return {
        approved: false,
        reason: `High correlation with existing positions: ${correlationRisk.toFixed(2)}`
      };
    }

    // Check portfolio risk
    const portfolioRisk = this.calculatePortfolioRisk();
    if (portfolioRisk > this.config.maxPortfolioRisk) {
      return {
        approved: false,
        reason: `Portfolio risk limit exceeded: ${(portfolioRisk * 100).toFixed(2)}%`
      };
    }

    return { approved: true };
  }

  async openPosition(
    symbol: string,
    side: 'long' | 'short',
    quantity: number,
    entryPrice: number,
    strategy: string,
    metadata?: Record<string, any>
  ): Promise<Position> {
    const validation = await this.validateTrade(symbol, side, quantity, entryPrice, strategy);
    
    if (!validation.approved) {
      throw new RiskManagementError(
        validation.reason || 'Trade validation failed',
        { symbol, side, quantity, entryPrice, strategy }
      );
    }

    const finalQuantity = validation.adjustedQuantity || quantity;
    const volatility = this.calculateVolatility(symbol);
    
    const position: Position = {
      id: this.generatePositionId(),
      symbol,
      side,
      quantity: finalQuantity,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: this.calculateStopLoss(entryPrice, side, volatility),
      takeProfit: this.calculateTakeProfit(entryPrice, side, volatility),
      unrealizedPnL: 0,
      realizedPnL: 0,
      timestamp: Date.now(),
      strategy,
      metadata
    };

    this.positions.set(position.id, position);

    this.logger.info('Position opened', {
      positionId: position.id,
      symbol,
      side,
      quantity: finalQuantity,
      entryPrice,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      strategy
    });

    this.monitoring.monitorTradingOperation(
      'open_position',
      symbol,
      'success',
      0,
      { positionId: position.id, side, quantity: finalQuantity, entryPrice }
    );

    return position;
  }

  updatePositionPrice(positionId: string, currentPrice: number): void {
    const position = this.positions.get(positionId);
    if (!position) {
      return;
    }

    const previousPnL = position.unrealizedPnL;
    position.currentPrice = currentPrice;
    
    if (position.side === 'long') {
      position.unrealizedPnL = (currentPrice - position.entryPrice) * position.quantity;
    } else {
      position.unrealizedPnL = (position.entryPrice - currentPrice) * position.quantity;
    }

    // Check stop-loss and take-profit
    this.checkStopLossAndTakeProfit(position);

    // Update price history for volatility calculation
    this.updatePriceHistory(position.symbol, currentPrice);

    // Log significant P&L changes
    const pnlChange = Math.abs(position.unrealizedPnL - previousPnL);
    if (pnlChange > this.portfolioValue * 0.001) { // 0.1% of portfolio
      this.logger.debug('Position P&L updated', {
        positionId,
        symbol: position.symbol,
        currentPrice,
        unrealizedPnL: position.unrealizedPnL,
        pnlChange
      });
    }
  }

  closePosition(positionId: string, exitPrice: number, reason: string = 'manual'): Position | null {
    const position = this.positions.get(positionId);
    if (!position) {
      return null;
    }

    // Calculate final P&L
    if (position.side === 'long') {
      position.realizedPnL = (exitPrice - position.entryPrice) * position.quantity;
    } else {
      position.realizedPnL = (position.entryPrice - exitPrice) * position.quantity;
    }

    this.positions.delete(positionId);

    this.logger.info('Position closed', {
      positionId,
      symbol: position.symbol,
      exitPrice,
      realizedPnL: position.realizedPnL,
      reason,
      duration: Date.now() - position.timestamp
    });

    this.monitoring.monitorTradingOperation(
      'close_position',
      position.symbol,
      'success',
      Date.now() - position.timestamp,
      { positionId, exitPrice, realizedPnL: position.realizedPnL, reason }
    );

    return position;
  }

  // Risk Calculations
  calculatePortfolioRisk(): number {
    let totalRisk = 0;
    
    for (const position of this.positions.values()) {
      const positionValue = Math.abs(position.quantity * position.currentPrice);
      const volatility = this.calculateVolatility(position.symbol);
      const positionRisk = (positionValue / this.portfolioValue) * volatility;
      totalRisk += positionRisk;
    }

    return totalRisk;
  }

  calculateVolatility(symbol: string): number {
    const prices = this.priceHistory.get(symbol) || [];
    if (prices.length < 2) {
      return 0.02; // Default 2% volatility
    }

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  getRiskMetrics(): RiskMetrics {
    const positions = Array.from(this.positions.values());
    const totalExposure = positions.reduce((sum, pos) => 
      sum + Math.abs(pos.quantity * pos.currentPrice), 0
    );
    const unrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    const realizedPnL = positions.reduce((sum, pos) => sum + pos.realizedPnL, 0);
    
    const currentValue = this.portfolioValue + unrealizedPnL;
    const currentDrawdown = (this.maxPortfolioValue - currentValue) / this.maxPortfolioValue;
    const dailyPnL = currentValue - this.dailyStartValue;

    return {
      portfolioValue: currentValue,
      totalExposure,
      unrealizedPnL,
      realizedPnL,
      dailyPnL,
      maxDrawdown: (this.maxPortfolioValue - Math.min(...this.getPortfolioHistory())) / this.maxPortfolioValue,
      currentDrawdown,
      sharpeRatio: this.calculateSharpeRatio(),
      volatility: this.calculatePortfolioVolatility(),
      var95: this.calculateVaR(0.95),
      beta: this.calculateBeta(),
      openPositions: positions.length,
      riskUtilization: this.calculatePortfolioRisk() / this.config.maxPortfolioRisk
    };
  }

  // Risk Monitoring
  checkRiskLimits(): RiskAlert[] {
    const alerts: RiskAlert[] = [];
    const metrics = this.getRiskMetrics();

    // Check drawdown limit
    if (metrics.currentDrawdown > this.config.maxDrawdown) {
      alerts.push({
        type: 'drawdown',
        severity: 'critical',
        message: `Maximum drawdown exceeded: ${(metrics.currentDrawdown * 100).toFixed(2)}%`,
        value: metrics.currentDrawdown,
        threshold: this.config.maxDrawdown,
        timestamp: Date.now()
      });

      this.suspendTrading('Maximum drawdown exceeded');
    }

    // Check daily loss limit
    if (metrics.dailyPnL < -this.portfolioValue * this.config.maxDailyLoss) {
      alerts.push({
        type: 'exposure',
        severity: 'critical',
        message: `Daily loss limit exceeded: ${metrics.dailyPnL.toFixed(2)}`,
        value: Math.abs(metrics.dailyPnL),
        threshold: this.portfolioValue * this.config.maxDailyLoss,
        timestamp: Date.now()
      });

      this.suspendTrading('Daily loss limit exceeded');
    }

    // Check portfolio risk utilization
    if (metrics.riskUtilization > 0.8) {
      alerts.push({
        type: 'exposure',
        severity: 'warning',
        message: `High risk utilization: ${(metrics.riskUtilization * 100).toFixed(1)}%`,
        value: metrics.riskUtilization,
        threshold: 0.8,
        timestamp: Date.now()
      });
    }

    return alerts;
  }

  private checkStopLossAndTakeProfit(position: Position): void {
    if (!position.stopLoss && !position.takeProfit) {
      return;
    }

    const shouldTriggerStopLoss = position.stopLoss && (
      (position.side === 'long' && position.currentPrice <= position.stopLoss) ||
      (position.side === 'short' && position.currentPrice >= position.stopLoss)
    );

    const shouldTriggerTakeProfit = position.takeProfit && (
      (position.side === 'long' && position.currentPrice >= position.takeProfit) ||
      (position.side === 'short' && position.currentPrice <= position.takeProfit)
    );

    if (shouldTriggerStopLoss) {
      this.logger.warn('Stop-loss triggered', {
        positionId: position.id,
        symbol: position.symbol,
        currentPrice: position.currentPrice,
        stopLoss: position.stopLoss
      });

      this.monitoring.monitorRiskEvent(
        'stop_loss_triggered',
        position.symbol,
        'high',
        { positionId: position.id, currentPrice: position.currentPrice, stopLoss: position.stopLoss }
      );

      this.closePosition(position.id, position.currentPrice, 'stop_loss');
    } else if (shouldTriggerTakeProfit) {
      this.logger.info('Take-profit triggered', {
        positionId: position.id,
        symbol: position.symbol,
        currentPrice: position.currentPrice,
        takeProfit: position.takeProfit
      });

      this.closePosition(position.id, position.currentPrice, 'take_profit');
    }
  }

  private calculateStopLoss(entryPrice: number, side: 'long' | 'short', volatility: number): number {
    const stopLossDistance = Math.max(this.config.stopLossPercentage, volatility * 2);
    
    if (side === 'long') {
      return entryPrice * (1 - stopLossDistance);
    } else {
      return entryPrice * (1 + stopLossDistance);
    }
  }

  private calculateTakeProfit(entryPrice: number, side: 'long' | 'short', volatility: number): number {
    const takeProfitDistance = Math.max(this.config.takeProfitPercentage, volatility * 3);
    
    if (side === 'long') {
      return entryPrice * (1 + takeProfitDistance);
    } else {
      return entryPrice * (1 - takeProfitDistance);
    }
  }

  private async checkCorrelationRisk(symbol: string): Promise<number> {
    // Simplified correlation calculation
    // In a real implementation, this would use historical price data
    const existingSymbols = Array.from(new Set(Array.from(this.positions.values()).map(p => p.symbol)));
    
    if (existingSymbols.length === 0) {
      return 0;
    }

    // Return a mock correlation value for demonstration
    // In practice, this would calculate actual correlation coefficients
    return Math.random() * 0.5; // Random correlation between 0 and 0.5
  }

  private updatePriceHistory(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }

    const history = this.priceHistory.get(symbol)!;
    history.push(price);

    // Keep only the last N prices for volatility calculation
    if (history.length > this.config.volatilityLookback) {
      history.shift();
    }
  }

  private calculateSharpeRatio(): number {
    // Simplified Sharpe ratio calculation
    // Would need historical returns data for accurate calculation
    return 1.5; // Mock value
  }

  private calculatePortfolioVolatility(): number {
    // Simplified portfolio volatility calculation
    return 0.15; // Mock 15% volatility
  }

  private calculateVaR(confidence: number): number {
    // Simplified VaR calculation
    const portfolioValue = this.getRiskMetrics().portfolioValue;
    return portfolioValue * 0.02; // Mock 2% VaR
  }

  private calculateBeta(): number {
    // Simplified beta calculation
    return 1.2; // Mock beta
  }

  private getPortfolioHistory(): number[] {
    // Mock portfolio history
    return [this.portfolioValue];
  }

  private suspendTrading(reason: string): void {
    this.tradingSuspended = true;
    
    this.logger.critical('Trading suspended', { reason });
    
    this.monitoring.createAlert(
      'CRITICAL' as any,
      'Trading Suspended',
      `Trading has been suspended: ${reason}`,
      'risk_management',
      { reason, timestamp: Date.now() }
    );
  }

  private generatePositionId(): string {
    return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public utility methods
  getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId);
  }

  resumeTrading(): void {
    this.tradingSuspended = false;
    this.logger.info('Trading resumed');
  }

  isTradingSuspended(): boolean {
    return this.tradingSuspended;
  }

  updatePortfolioValue(value: number): void {
    this.portfolioValue = value;
    this.maxPortfolioValue = Math.max(this.maxPortfolioValue, value);
  }

  resetDailyMetrics(): void {
    this.dailyStartValue = this.portfolioValue;
    this.logger.info('Daily metrics reset', { portfolioValue: this.portfolioValue });
  }
}
