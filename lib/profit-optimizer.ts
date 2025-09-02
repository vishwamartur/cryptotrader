// Advanced Profit Optimization System
// Focuses on maximizing risk-adjusted returns through dynamic position sizing,
// adaptive stop-losses, and intelligent profit-taking mechanisms

import { EnhancedSignal, StrategyPerformance } from './enhanced-strategy-engine';
import { RiskManager } from './risk-management';
import { Trade } from './trade-monitor';

export interface OptimizationConfig {
  maxPositionSize: number;
  riskPerTrade: number;
  profitTarget: number;
  maxDrawdown: number;
  adaptiveSizing: boolean;
  dynamicStops: boolean;
  trailingStops: boolean;
  partialProfitTaking: boolean;
}

export interface ProfitMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgHoldTime: number;
  totalTrades: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  largestWin: number;
  largestLoss: number;
  volatility: number;
  beta: number;
  alpha: number;
}

export class ProfitOptimizer {
  private config: OptimizationConfig;
  private riskManager: RiskManager;
  private trades: Trade[] = [];
  private portfolioValue: number;
  private initialCapital: number;
  private highWaterMark: number;
  private consecutiveWins = 0;
  private consecutiveLosses = 0;
  private adaptiveMultiplier = 1.0;

  constructor(
    config: OptimizationConfig,
    riskManager: RiskManager,
    initialCapital: number
  ) {
    this.config = config;
    this.riskManager = riskManager;
    this.initialCapital = initialCapital;
    this.portfolioValue = initialCapital;
    this.highWaterMark = initialCapital;
  }

  // Kelly Criterion Position Sizing
  calculateKellyPositionSize(
    signal: EnhancedSignal,
    historicalWinRate: number,
    avgWin: number,
    avgLoss: number
  ): number {
    if (avgLoss === 0 || historicalWinRate === 0) {
      return this.config.riskPerTrade;
    }

    // Kelly formula: f = (bp - q) / b
    // where b = odds received (avgWin/avgLoss), p = probability of win, q = probability of loss
    const b = Math.abs(avgWin / avgLoss);
    const p = historicalWinRate;
    const q = 1 - p;
    
    const kellyFraction = (b * p - q) / b;
    
    // Apply safety factor and confidence adjustment
    const safetyFactor = 0.25; // Use 25% of Kelly to reduce risk
    const confidenceAdjustment = signal.confidence;
    
    let optimalSize = kellyFraction * safetyFactor * confidenceAdjustment;
    
    // Apply adaptive multiplier based on recent performance
    optimalSize *= this.adaptiveMultiplier;
    
    // Ensure within risk limits
    return Math.max(0.001, Math.min(this.config.maxPositionSize, optimalSize));
  }

  // Dynamic Position Sizing Based on Market Conditions
  calculateDynamicPositionSize(signal: EnhancedSignal, marketVolatility: number): number {
    let baseSize = this.config.riskPerTrade;
    
    // Adjust for confidence
    baseSize *= signal.confidence;
    
    // Adjust for volatility (inverse relationship)
    const volatilityAdjustment = Math.max(0.5, Math.min(2.0, 1 / marketVolatility));
    baseSize *= volatilityAdjustment;
    
    // Adjust for risk-reward ratio
    const rrAdjustment = Math.min(1.5, signal.riskReward / 2);
    baseSize *= rrAdjustment;
    
    // Market regime adjustment
    const regimeMultiplier = this.getRegimeMultiplier(signal.marketRegime);
    baseSize *= regimeMultiplier;
    
    // Recent performance adjustment
    baseSize *= this.adaptiveMultiplier;
    
    return Math.max(0.001, Math.min(this.config.maxPositionSize, baseSize));
  }

  // Adaptive Stop Loss Calculation
  calculateAdaptiveStopLoss(
    signal: EnhancedSignal,
    currentPrice: number,
    atr: number,
    volatility: number
  ): number {
    let stopDistance = atr * 2; // Base stop at 2 ATR
    
    // Adjust for volatility
    stopDistance *= Math.max(0.5, Math.min(2.0, volatility / 0.02));
    
    // Adjust for confidence (higher confidence = tighter stops)
    const confidenceAdjustment = Math.max(0.7, 2 - signal.confidence);
    stopDistance *= confidenceAdjustment;
    
    // Market regime adjustment
    if (signal.marketRegime === 'volatile') {
      stopDistance *= 1.5;
    } else if (signal.marketRegime === 'calm') {
      stopDistance *= 0.8;
    }
    
    const stopLoss = signal.action === 'buy' 
      ? currentPrice - stopDistance 
      : currentPrice + stopDistance;
    
    return stopLoss;
  }

  // Trailing Stop Management
  updateTrailingStop(
    trade: Trade,
    currentPrice: number,
    atr: number
  ): number | null {
    if (!this.config.trailingStops || !trade.executedPrice) {
      return null;
    }
    
    const trailDistance = atr * 2;
    let newStopLoss: number;
    
    if (trade.side === 'BUY') {
      newStopLoss = currentPrice - trailDistance;
      // Only move stop loss up for long positions
      if (trade.stopLoss && newStopLoss > trade.stopLoss) {
        return newStopLoss;
      }
    } else {
      newStopLoss = currentPrice + trailDistance;
      // Only move stop loss down for short positions
      if (trade.stopLoss && newStopLoss < trade.stopLoss) {
        return newStopLoss;
      }
    }
    
    return null;
  }

  // Partial Profit Taking Strategy
  calculatePartialProfitLevels(signal: EnhancedSignal): Array<{level: number, percentage: number}> {
    if (!this.config.partialProfitTaking) {
      return [];
    }
    
    const entryPrice = signal.entryPrice;
    const fullTarget = signal.takeProfit;
    const distance = Math.abs(fullTarget - entryPrice);
    
    const levels = [];
    
    // Take 25% profit at 50% of target
    levels.push({
      level: signal.action === 'buy' 
        ? entryPrice + (distance * 0.5)
        : entryPrice - (distance * 0.5),
      percentage: 0.25
    });
    
    // Take 25% profit at 75% of target
    levels.push({
      level: signal.action === 'buy'
        ? entryPrice + (distance * 0.75)
        : entryPrice - (distance * 0.75),
      percentage: 0.25
    });
    
    // Take 50% profit at full target
    levels.push({
      level: fullTarget,
      percentage: 0.5
    });
    
    return levels;
  }

  // Performance-Based Adaptive Sizing
  updateAdaptiveMultiplier(): void {
    const recentTrades = this.trades.slice(-20); // Last 20 trades
    
    if (recentTrades.length < 10) return;
    
    const winRate = recentTrades.filter(t => (t.pnl || 0) > 0).length / recentTrades.length;
    const avgReturn = recentTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / recentTrades.length;
    
    // Increase size after good performance, decrease after poor performance
    if (winRate > 0.6 && avgReturn > 0) {
      this.adaptiveMultiplier = Math.min(1.5, this.adaptiveMultiplier * 1.1);
    } else if (winRate < 0.4 || avgReturn < 0) {
      this.adaptiveMultiplier = Math.max(0.5, this.adaptiveMultiplier * 0.9);
    }
    
    // Reset after consecutive losses
    if (this.consecutiveLosses >= 3) {
      this.adaptiveMultiplier = Math.max(0.3, this.adaptiveMultiplier * 0.8);
    }
    
    // Boost after consecutive wins
    if (this.consecutiveWins >= 3) {
      this.adaptiveMultiplier = Math.min(1.3, this.adaptiveMultiplier * 1.05);
    }
  }

  // Calculate Comprehensive Profit Metrics
  calculateProfitMetrics(): ProfitMetrics {
    const completedTrades = this.trades.filter(t => t.status === 'FILLED' && t.pnl !== undefined);
    
    if (completedTrades.length === 0) {
      return this.getEmptyMetrics();
    }
    
    const pnls = completedTrades.map(t => t.pnl!);
    const wins = pnls.filter(p => p > 0);
    const losses = pnls.filter(p => p < 0);
    
    const totalReturn = (this.portfolioValue - this.initialCapital) / this.initialCapital;
    const totalPnL = pnls.reduce((sum, pnl) => sum + pnl, 0);
    
    // Calculate drawdown
    const currentDrawdown = (this.highWaterMark - this.portfolioValue) / this.highWaterMark;
    const maxDrawdown = this.calculateMaxDrawdown();
    
    // Calculate Sharpe ratio (assuming 2% risk-free rate)
    const riskFreeRate = 0.02;
    const returns = this.calculateDailyReturns();
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStd = this.calculateStandardDeviation(returns);
    const sharpeRatio = returnStd > 0 ? (avgReturn - riskFreeRate / 252) / returnStd : 0;
    
    // Calculate Sortino ratio (downside deviation)
    const downsideReturns = returns.filter(r => r < 0);
    const downsideStd = downsideReturns.length > 0 ? this.calculateStandardDeviation(downsideReturns) : returnStd;
    const sortinoRatio = downsideStd > 0 ? (avgReturn - riskFreeRate / 252) / downsideStd : 0;
    
    // Calculate other metrics
    const winRate = wins.length / completedTrades.length;
    const avgWin = wins.length > 0 ? wins.reduce((sum, w) => sum + w, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, l) => sum + l, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
    
    return {
      totalReturn,
      annualizedReturn: this.annualizeReturn(totalReturn),
      sharpeRatio,
      sortinoRatio,
      calmarRatio: maxDrawdown > 0 ? this.annualizeReturn(totalReturn) / maxDrawdown : 0,
      maxDrawdown,
      currentDrawdown,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      avgHoldTime: this.calculateAvgHoldTime(completedTrades),
      totalTrades: completedTrades.length,
      consecutiveWins: this.consecutiveWins,
      consecutiveLosses: this.consecutiveLosses,
      largestWin: wins.length > 0 ? Math.max(...wins) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses) : 0,
      volatility: returnStd * Math.sqrt(252), // Annualized
      beta: this.calculateBeta(),
      alpha: this.calculateAlpha(totalReturn, sharpeRatio)
    };
  }

  // Risk-Adjusted Position Sizing
  calculateRiskAdjustedSize(
    signal: EnhancedSignal,
    currentDrawdown: number,
    recentVolatility: number
  ): number {
    let baseSize = this.calculateDynamicPositionSize(signal, recentVolatility);
    
    // Reduce size during drawdown periods
    if (currentDrawdown > 0.05) { // 5% drawdown
      const drawdownAdjustment = Math.max(0.3, 1 - (currentDrawdown * 2));
      baseSize *= drawdownAdjustment;
    }
    
    // Reduce size if approaching max drawdown limit
    const drawdownBuffer = this.config.maxDrawdown - currentDrawdown;
    if (drawdownBuffer < 0.03) { // Within 3% of max drawdown
      baseSize *= 0.5;
    }
    
    return baseSize;
  }

  private getRegimeMultiplier(regime: string): number {
    switch (regime) {
      case 'trending': return 1.2;
      case 'ranging': return 0.8;
      case 'volatile': return 0.7;
      case 'calm': return 1.1;
      default: return 1.0;
    }
  }

  private calculateMaxDrawdown(): number {
    let maxDD = 0;
    let peak = this.initialCapital;
    
    // This would need historical portfolio values
    // For now, return current drawdown as approximation
    return (this.highWaterMark - this.portfolioValue) / this.highWaterMark;
  }

  private calculateDailyReturns(): number[] {
    // This would calculate daily returns from portfolio value history
    // For now, return empty array
    return [];
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private annualizeReturn(totalReturn: number): number {
    // Assuming the period is less than a year, this is a simplified calculation
    return totalReturn * (252 / Math.max(1, this.trades.length)); // 252 trading days
  }

  private calculateAvgHoldTime(trades: Trade[]): number {
    const holdTimes = trades
      .filter(t => t.executedAt && t.timestamp)
      .map(t => (t.executedAt!.getTime() - t.timestamp.getTime()) / (1000 * 60 * 60)); // Hours
    
    return holdTimes.length > 0 ? holdTimes.reduce((sum, time) => sum + time, 0) / holdTimes.length : 0;
  }

  private calculateBeta(): number {
    // This would calculate beta against a benchmark
    // For now, return 1.0 as default
    return 1.0;
  }

  private calculateAlpha(totalReturn: number, sharpeRatio: number): number {
    // Simplified alpha calculation
    const marketReturn = 0.1; // Assume 10% market return
    const beta = this.calculateBeta();
    
    return totalReturn - (0.02 + beta * (marketReturn - 0.02)); // CAPM
  }

  private getEmptyMetrics(): ProfitMetrics {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgHoldTime: 0,
      totalTrades: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      largestWin: 0,
      largestLoss: 0,
      volatility: 0,
      beta: 1.0,
      alpha: 0
    };
  }

  // Update portfolio value and track performance
  updatePortfolioValue(newValue: number): void {
    this.portfolioValue = newValue;
    
    if (newValue > this.highWaterMark) {
      this.highWaterMark = newValue;
    }
  }

  // Add completed trade for tracking
  addTrade(trade: Trade): void {
    this.trades.push(trade);

    if (trade.pnl !== undefined) {
      if (trade.pnl > 0) {
        this.consecutiveWins++;
        this.consecutiveLosses = 0;
      } else {
        this.consecutiveLosses++;
        this.consecutiveWins = 0;
      }

      this.updateAdaptiveMultiplier();
    }
  }

  // Real-time profit optimization
  optimizeActivePositions(
    activePositions: Trade[],
    currentPrices: { [symbol: string]: number },
    marketVolatility: { [symbol: string]: number }
  ): Array<{
    tradeId: string;
    action: 'HOLD' | 'CLOSE_PARTIAL' | 'CLOSE_FULL' | 'TRAIL_STOP';
    percentage?: number;
    newStopLoss?: number;
    reason: string;
  }> {
    const optimizations: Array<{
      tradeId: string;
      action: 'HOLD' | 'CLOSE_PARTIAL' | 'CLOSE_FULL' | 'TRAIL_STOP';
      percentage?: number;
      newStopLoss?: number;
      reason: string;
    }> = [];

    for (const position of activePositions) {
      if (!position.executedPrice || !currentPrices[position.symbol]) continue;

      const currentPrice = currentPrices[position.symbol];
      const entryPrice = position.executedPrice;
      const unrealizedPnL = position.side === 'BUY'
        ? (currentPrice - entryPrice) / entryPrice
        : (entryPrice - currentPrice) / entryPrice;

      // Profit taking logic
      if (unrealizedPnL > 0.15) { // 15% profit
        optimizations.push({
          tradeId: position.id,
          action: 'CLOSE_PARTIAL',
          percentage: 0.5,
          reason: 'Taking 50% profit at 15% gain'
        });
      } else if (unrealizedPnL > 0.08) { // 8% profit
        optimizations.push({
          tradeId: position.id,
          action: 'CLOSE_PARTIAL',
          percentage: 0.25,
          reason: 'Taking 25% profit at 8% gain'
        });
      }

      // Trailing stop logic
      if (unrealizedPnL > 0.05 && this.config.trailingStops) {
        const volatility = marketVolatility[position.symbol] || 0.02;
        const trailDistance = Math.max(0.02, volatility * 2);

        const newStopLoss = position.side === 'BUY'
          ? currentPrice * (1 - trailDistance)
          : currentPrice * (1 + trailDistance);

        if (!position.stopLoss ||
            (position.side === 'BUY' && newStopLoss > position.stopLoss) ||
            (position.side === 'SELL' && newStopLoss < position.stopLoss)) {
          optimizations.push({
            tradeId: position.id,
            action: 'TRAIL_STOP',
            newStopLoss,
            reason: `Trailing stop to ${newStopLoss.toFixed(2)}`
          });
        }
      }

      // Risk management - cut losses early in high volatility
      if (unrealizedPnL < -0.03) { // 3% loss
        const volatility = marketVolatility[position.symbol] || 0.02;
        if (volatility > 0.04) { // High volatility
          optimizations.push({
            tradeId: position.id,
            action: 'CLOSE_FULL',
            reason: 'Cutting losses early due to high volatility'
          });
        }
      }
    }

    return optimizations;
  }

  // Portfolio heat management
  calculatePortfolioHeat(activePositions: Trade[]): {
    totalHeat: number;
    riskPerPosition: { [tradeId: string]: number };
    recommendations: string[];
  } {
    let totalRisk = 0;
    const riskPerPosition: { [tradeId: string]: number } = {};
    const recommendations: string[] = [];

    for (const position of activePositions) {
      if (!position.executedPrice) continue;

      const positionValue = position.size * position.executedPrice;
      const riskAmount = position.stopLoss
        ? Math.abs(position.executedPrice - position.stopLoss) * position.size
        : positionValue * 0.02; // Default 2% risk

      const riskPercentage = riskAmount / this.portfolioValue;
      riskPerPosition[position.id] = riskPercentage;
      totalRisk += riskPercentage;
    }

    // Generate recommendations
    if (totalRisk > 0.1) { // 10% total portfolio risk
      recommendations.push('Total portfolio risk exceeds 10% - consider reducing position sizes');
    }

    if (Object.values(riskPerPosition).some(risk => risk > 0.03)) { // 3% per position
      recommendations.push('Some positions exceed 3% risk - consider tighter stops or smaller sizes');
    }

    if (activePositions.length > 5) {
      recommendations.push('High number of concurrent positions - consider focusing on best setups');
    }

    return {
      totalHeat: totalRisk,
      riskPerPosition,
      recommendations
    };
  }
}
