// Enhanced Backtesting Framework with Profit Optimization
// Comprehensive backtesting with realistic slippage, commissions, and market impact

import { MarketData } from './types';
import { EnhancedSignal } from './enhanced-strategy-engine';
import { ProfitOptimizer, ProfitMetrics } from './profit-optimizer';
import { AdvancedMarketAnalyzer, MarketSignal } from './advanced-market-analyzer';

export interface BacktestConfig {
  initialCapital: number;
  commission: number; // Percentage
  slippage: number; // Percentage
  maxPositions: number;
  riskPerTrade: number;
  enablePartialFills: boolean;
  enableRealisticTiming: boolean;
  marketImpact: boolean;
  borrowCosts: number; // For short positions
}

export interface BacktestTrade {
  id: string;
  entryTime: number;
  exitTime?: number;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  commission: number;
  slippage: number;
  pnl?: number;
  pnlPercentage?: number;
  holdTime?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  strategy: string;
  confidence: number;
  stopLoss?: number;
  takeProfit?: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'SIGNAL_EXIT' | 'TIME_EXIT' | 'MANUAL';
}

export interface BacktestResult {
  // Basic Performance
  totalReturn: number;
  annualizedReturn: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  
  // Risk Metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  volatility: number;
  
  // Trade Analysis
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number;
  avgHoldTime: number;
  
  // Advanced Metrics
  expectancy: number;
  systemQualityNumber: number;
  ulcerIndex: number;
  recoveryFactor: number;
  payoffRatio: number;
  
  // Detailed Results
  trades: BacktestTrade[];
  equityCurve: Array<{ time: number; value: number; drawdown: number }>;
  monthlyReturns: Array<{ month: string; return: number }>;
  
  // Strategy Performance
  strategyBreakdown: { [strategy: string]: ProfitMetrics };
  
  // Market Conditions Analysis
  performanceByVolatility: { low: number; medium: number; high: number };
  performanceByTrend: { bull: number; bear: number; sideways: number };
  
  // Execution Quality
  avgSlippage: number;
  avgCommission: number;
  fillRate: number;
}

export class EnhancedBacktester {
  private config: BacktestConfig;
  private analyzer: AdvancedMarketAnalyzer;
  private optimizer: ProfitOptimizer;
  private trades: BacktestTrade[] = [];
  private openPositions: Map<string, BacktestTrade> = new Map();
  private portfolioValue: number;
  private equityCurve: Array<{ time: number; value: number; drawdown: number }> = [];
  private highWaterMark: number;

  constructor(config: BacktestConfig) {
    this.config = config;
    this.analyzer = new AdvancedMarketAnalyzer();
    this.portfolioValue = config.initialCapital;
    this.highWaterMark = config.initialCapital;
    
    // Initialize profit optimizer with backtesting-specific config
    const optimizerConfig = {
      maxPositionSize: 0.2,
      riskPerTrade: config.riskPerTrade,
      profitTarget: 0.15,
      maxDrawdown: 0.15,
      adaptiveSizing: true,
      dynamicStops: true,
      trailingStops: true,
      partialProfitTaking: true
    };
    
    this.optimizer = new ProfitOptimizer(
      optimizerConfig,
      null as any, // Will be set later
      config.initialCapital
    );
  }

  // Main backtesting function
  async runBacktest(
    marketData: MarketData[],
    strategy: (data: MarketData[], analyzer: AdvancedMarketAnalyzer) => MarketSignal,
    startDate?: Date,
    endDate?: Date
  ): Promise<BacktestResult> {
    this.reset();
    
    // Filter data by date range if provided
    let filteredData = marketData;
    if (startDate || endDate) {
      filteredData = marketData.filter(d => {
        const dataTime = new Date(d.timestamp);
        return (!startDate || dataTime >= startDate) && (!endDate || dataTime <= endDate);
      });
    }

    // Process each data point
    for (let i = 50; i < filteredData.length; i++) { // Start after 50 periods for indicators
      const currentData = filteredData.slice(0, i + 1);
      const currentBar = filteredData[i];
      
      // Update existing positions
      this.updatePositions(currentBar);
      
      // Generate trading signal
      const signal = strategy(currentData, this.analyzer);
      
      // Process signal if we have capacity
      if (this.openPositions.size < this.config.maxPositions) {
        await this.processSignal(signal, currentBar, i);
      }
      
      // Update portfolio value and equity curve
      this.updatePortfolioValue(currentBar);
      this.recordEquityPoint(currentBar.timestamp);
    }

    // Close all remaining positions at the end
    const lastBar = filteredData[filteredData.length - 1];
    this.closeAllPositions(lastBar, 'TIME_EXIT');

    return this.calculateResults(filteredData);
  }

  private async processSignal(signal: MarketSignal, bar: MarketData, index: number): Promise<void> {
    if (signal.signal === 'HOLD' || signal.confidence < 60) {
      return;
    }

    // Calculate position size
    const positionSize = this.calculatePositionSize(signal, bar.price);
    
    if (positionSize <= 0) return;

    // Apply slippage and check for fill
    const { fillPrice, filled } = this.simulateExecution(signal.signal, bar, positionSize);
    
    if (!filled) return;

    // Create trade
    const trade: BacktestTrade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entryTime: bar.timestamp,
      symbol: 'BTC-USD', // Default symbol
      side: signal.signal === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice: fillPrice,
      size: positionSize,
      commission: this.calculateCommission(positionSize * fillPrice),
      slippage: Math.abs(fillPrice - bar.price) / bar.price,
      maxFavorableExcursion: 0,
      maxAdverseExcursion: 0,
      strategy: 'enhanced_strategy',
      confidence: signal.confidence,
      stopLoss: this.calculateStopLoss(signal, fillPrice),
      takeProfit: this.calculateTakeProfit(signal, fillPrice)
    };

    this.openPositions.set(trade.id, trade);
    this.portfolioValue -= trade.commission;
  }

  private updatePositions(bar: MarketData): void {
    const positionsToClose: string[] = [];

    for (const [id, position] of this.openPositions) {
      // Update MFE and MAE
      const currentPnL = this.calculateUnrealizedPnL(position, bar.price);
      
      if (currentPnL > position.maxFavorableExcursion) {
        position.maxFavorableExcursion = currentPnL;
      }
      if (currentPnL < position.maxAdverseExcursion) {
        position.maxAdverseExcursion = currentPnL;
      }

      // Check exit conditions
      const exitReason = this.checkExitConditions(position, bar);
      if (exitReason) {
        this.closePosition(position, bar, exitReason);
        positionsToClose.push(id);
      }
    }

    // Remove closed positions
    positionsToClose.forEach(id => this.openPositions.delete(id));
  }

  private calculatePositionSize(signal: MarketSignal, price: number): number {
    const availableCapital = this.portfolioValue * 0.95; // Keep 5% cash buffer
    const riskAmount = availableCapital * this.config.riskPerTrade;
    
    // Calculate position size based on risk
    const stopDistance = Math.abs(price - (signal as any).stopLoss || price * 0.02);
    const maxShares = riskAmount / stopDistance;
    
    // Apply confidence adjustment
    const confidenceAdjustment = signal.confidence / 100;
    const adjustedShares = maxShares * confidenceAdjustment;
    
    // Ensure we don't exceed available capital
    const maxAffordableShares = availableCapital / price;
    
    return Math.min(adjustedShares, maxAffordableShares);
  }

  private simulateExecution(
    side: 'BUY' | 'SELL',
    bar: MarketData,
    size: number
  ): { fillPrice: number; filled: boolean } {
    let fillPrice = bar.price;
    
    // Apply slippage
    const slippageAmount = bar.price * this.config.slippage;
    if (side === 'BUY') {
      fillPrice += slippageAmount;
    } else {
      fillPrice -= slippageAmount;
    }

    // Apply market impact for large orders
    if (this.config.marketImpact) {
      const marketImpact = this.calculateMarketImpact(size, bar.volume);
      if (side === 'BUY') {
        fillPrice += marketImpact;
      } else {
        fillPrice -= marketImpact;
      }
    }

    // Simulate partial fills in low liquidity
    const filled = this.config.enablePartialFills ? 
      this.simulatePartialFill(size, bar.volume) : true;

    return { fillPrice, filled };
  }

  private calculateMarketImpact(orderSize: number, volume: number): number {
    // Simple market impact model
    const orderRatio = orderSize / volume;
    return orderRatio * 0.001; // 0.1% impact per 1% of volume
  }

  private simulatePartialFill(orderSize: number, volume: number): boolean {
    // Assume orders larger than 1% of volume have 50% chance of partial fill
    const orderRatio = orderSize / volume;
    if (orderRatio > 0.01) {
      return Math.random() > 0.5;
    }
    return true;
  }

  private calculateCommission(tradeValue: number): number {
    return tradeValue * this.config.commission;
  }

  private calculateStopLoss(signal: MarketSignal, entryPrice: number): number {
    // Use signal's stop loss or default to 2% risk
    return (signal as any).stopLoss || 
           (signal.signal === 'BUY' ? entryPrice * 0.98 : entryPrice * 1.02);
  }

  private calculateTakeProfit(signal: MarketSignal, entryPrice: number): number {
    // Use signal's take profit or default to 2:1 risk-reward
    return (signal as any).takeProfit || 
           (signal.signal === 'BUY' ? entryPrice * 1.04 : entryPrice * 0.96);
  }

  private calculateUnrealizedPnL(position: BacktestTrade, currentPrice: number): number {
    if (position.side === 'LONG') {
      return (currentPrice - position.entryPrice) * position.size;
    } else {
      return (position.entryPrice - currentPrice) * position.size;
    }
  }

  private checkExitConditions(position: BacktestTrade, bar: MarketData): string | null {
    const currentPrice = bar.price;
    
    // Stop loss
    if (position.stopLoss) {
      if ((position.side === 'LONG' && currentPrice <= position.stopLoss) ||
          (position.side === 'SHORT' && currentPrice >= position.stopLoss)) {
        return 'STOP_LOSS';
      }
    }
    
    // Take profit
    if (position.takeProfit) {
      if ((position.side === 'LONG' && currentPrice >= position.takeProfit) ||
          (position.side === 'SHORT' && currentPrice <= position.takeProfit)) {
        return 'TAKE_PROFIT';
      }
    }
    
    // Time-based exit (e.g., max hold time)
    const holdTime = bar.timestamp - position.entryTime;
    if (holdTime > 7 * 24 * 60 * 60 * 1000) { // 7 days max hold
      return 'TIME_EXIT';
    }
    
    return null;
  }

  private closePosition(position: BacktestTrade, bar: MarketData, reason: string): void {
    const { fillPrice } = this.simulateExecution(
      position.side === 'LONG' ? 'SELL' : 'BUY',
      bar,
      position.size
    );

    position.exitTime = bar.timestamp;
    position.exitPrice = fillPrice;
    position.exitReason = reason as any;
    position.holdTime = bar.timestamp - position.entryTime;
    
    // Calculate PnL
    const grossPnL = this.calculateUnrealizedPnL(position, fillPrice);
    const exitCommission = this.calculateCommission(position.size * fillPrice);
    position.pnl = grossPnL - exitCommission;
    position.pnlPercentage = position.pnl / (position.entryPrice * position.size);
    
    // Add borrowing costs for short positions
    if (position.side === 'SHORT' && position.holdTime) {
      const borrowCost = (position.entryPrice * position.size) * 
                        this.config.borrowCosts * 
                        (position.holdTime / (365 * 24 * 60 * 60 * 1000));
      position.pnl -= borrowCost;
    }

    this.trades.push(position);
    this.portfolioValue += position.pnl - exitCommission;
  }

  private closeAllPositions(bar: MarketData, reason: string): void {
    for (const position of this.openPositions.values()) {
      this.closePosition(position, bar, reason);
    }
    this.openPositions.clear();
  }

  private updatePortfolioValue(bar: MarketData): void {
    let totalValue = this.portfolioValue;
    
    // Add unrealized PnL from open positions
    for (const position of this.openPositions.values()) {
      totalValue += this.calculateUnrealizedPnL(position, bar.price);
    }
    
    if (totalValue > this.highWaterMark) {
      this.highWaterMark = totalValue;
    }
  }

  private recordEquityPoint(timestamp: number): void {
    let currentValue = this.portfolioValue;
    
    // Add unrealized PnL
    for (const position of this.openPositions.values()) {
      // Use last known price - in real implementation, would use current market price
      currentValue += position.maxFavorableExcursion; // Approximation
    }
    
    const drawdown = (this.highWaterMark - currentValue) / this.highWaterMark;
    
    this.equityCurve.push({
      time: timestamp,
      value: currentValue,
      drawdown
    });
  }

  private calculateResults(marketData: MarketData[]): BacktestResult {
    const completedTrades = this.trades.filter(t => t.pnl !== undefined);
    
    if (completedTrades.length === 0) {
      return this.getEmptyResult();
    }

    // Basic calculations
    const totalReturn = (this.portfolioValue - this.config.initialCapital) / this.config.initialCapital;
    const wins = completedTrades.filter(t => t.pnl! > 0);
    const losses = completedTrades.filter(t => t.pnl! <= 0);
    
    // Risk metrics
    const returns = this.calculatePeriodReturns();
    const sharpeRatio = this.calculateSharpeRatio(returns);
    const maxDrawdown = Math.max(...this.equityCurve.map(e => e.drawdown));
    
    // Trade analysis
    const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl!, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnl!, 0) / losses.length) : 0;
    const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : 0;
    
    return {
      totalReturn,
      annualizedReturn: this.annualizeReturn(totalReturn, marketData.length),
      totalTrades: completedTrades.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate: wins.length / completedTrades.length,
      sharpeRatio,
      sortinoRatio: this.calculateSortinoRatio(returns),
      calmarRatio: maxDrawdown > 0 ? this.annualizeReturn(totalReturn, marketData.length) / maxDrawdown : 0,
      maxDrawdown,
      maxDrawdownDuration: this.calculateMaxDrawdownDuration(),
      volatility: this.calculateVolatility(returns),
      avgWin,
      avgLoss,
      largestWin: wins.length > 0 ? Math.max(...wins.map(t => t.pnl!)) : 0,
      largestLoss: losses.length > 0 ? Math.min(...losses.map(t => t.pnl!)) : 0,
      profitFactor,
      avgHoldTime: this.calculateAvgHoldTime(completedTrades),
      expectancy: this.calculateExpectancy(completedTrades),
      systemQualityNumber: this.calculateSQN(completedTrades),
      ulcerIndex: this.calculateUlcerIndex(),
      recoveryFactor: maxDrawdown > 0 ? totalReturn / maxDrawdown : 0,
      payoffRatio: avgLoss > 0 ? avgWin / avgLoss : 0,
      trades: completedTrades,
      equityCurve: this.equityCurve,
      monthlyReturns: this.calculateMonthlyReturns(),
      strategyBreakdown: {},
      performanceByVolatility: { low: 0, medium: 0, high: 0 },
      performanceByTrend: { bull: 0, bear: 0, sideways: 0 },
      avgSlippage: completedTrades.reduce((sum, t) => sum + t.slippage, 0) / completedTrades.length,
      avgCommission: completedTrades.reduce((sum, t) => sum + t.commission, 0) / completedTrades.length,
      fillRate: 1.0 // Simplified for now
    };
  }

  private reset(): void {
    this.trades = [];
    this.openPositions.clear();
    this.portfolioValue = this.config.initialCapital;
    this.equityCurve = [];
    this.highWaterMark = this.config.initialCapital;
  }

  private calculatePeriodReturns(): number[] {
    const returns: number[] = [];
    for (let i = 1; i < this.equityCurve.length; i++) {
      const prevValue = this.equityCurve[i - 1].value;
      const currentValue = this.equityCurve[i].value;
      returns.push((currentValue - prevValue) / prevValue);
    }
    return returns;
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const negativeReturns = returns.filter(r => r < 0);
    
    if (negativeReturns.length === 0) return avgReturn > 0 ? Infinity : 0;
    
    const downsideVariance = negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length;
    const downsideStdDev = Math.sqrt(downsideVariance);
    
    return downsideStdDev > 0 ? avgReturn / downsideStdDev : 0;
  }

  private annualizeReturn(totalReturn: number, periods: number): number {
    // Assuming daily data
    const years = periods / 365;
    return years > 0 ? Math.pow(1 + totalReturn, 1 / years) - 1 : 0;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Annualized
  }

  private calculateMaxDrawdownDuration(): number {
    let maxDuration = 0;
    let currentDuration = 0;
    
    for (const point of this.equityCurve) {
      if (point.drawdown > 0) {
        currentDuration++;
        maxDuration = Math.max(maxDuration, currentDuration);
      } else {
        currentDuration = 0;
      }
    }
    
    return maxDuration;
  }

  private calculateAvgHoldTime(trades: BacktestTrade[]): number {
    const holdTimes = trades.filter(t => t.holdTime).map(t => t.holdTime!);
    return holdTimes.length > 0 ? holdTimes.reduce((sum, time) => sum + time, 0) / holdTimes.length : 0;
  }

  private calculateExpectancy(trades: BacktestTrade[]): number {
    if (trades.length === 0) return 0;
    
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    return totalPnL / trades.length;
  }

  private calculateSQN(trades: BacktestTrade[]): number {
    if (trades.length === 0) return 0;
    
    const pnls = trades.map(t => t.pnl || 0);
    const avgPnL = pnls.reduce((sum, pnl) => sum + pnl, 0) / pnls.length;
    const stdDev = Math.sqrt(pnls.reduce((sum, pnl) => sum + Math.pow(pnl - avgPnL, 2), 0) / pnls.length);
    
    return stdDev > 0 ? (avgPnL / stdDev) * Math.sqrt(trades.length) : 0;
  }

  private calculateUlcerIndex(): number {
    if (this.equityCurve.length === 0) return 0;
    
    const squaredDrawdowns = this.equityCurve.map(point => point.drawdown * point.drawdown);
    const avgSquaredDrawdown = squaredDrawdowns.reduce((sum, dd) => sum + dd, 0) / squaredDrawdowns.length;
    
    return Math.sqrt(avgSquaredDrawdown);
  }

  private calculateMonthlyReturns(): Array<{ month: string; return: number }> {
    // Simplified implementation
    return [];
  }

  private getEmptyResult(): BacktestResult {
    return {
      totalReturn: 0,
      annualizedReturn: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      volatility: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      avgHoldTime: 0,
      expectancy: 0,
      systemQualityNumber: 0,
      ulcerIndex: 0,
      recoveryFactor: 0,
      payoffRatio: 0,
      trades: [],
      equityCurve: [],
      monthlyReturns: [],
      strategyBreakdown: {},
      performanceByVolatility: { low: 0, medium: 0, high: 0 },
      performanceByTrend: { bull: 0, bear: 0, sideways: 0 },
      avgSlippage: 0,
      avgCommission: 0,
      fillRate: 0
    };
  }
}
