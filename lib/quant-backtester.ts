// Quant Backtesting Module
// Allows testing of quant strategies on historical data

import { QuantStrategy, QuantSignal } from './quant-strategy-engine';
import { MarketData } from './market-data-provider';
import { sharpeRatio, maxDrawdown, valueAtRisk, sortinoRatio, calmarRatio } from './quant-math';

export interface Trade {
  id: string;
  action: 'buy' | 'sell';
  price: number;
  quantity: number;
  timestamp: number;
  cost: number;
  slippage: number;
  pnl?: number;
}

export interface BacktestResult {
  // Basic metrics
  signals: QuantSignal[];
  trades: Trade[];
  totalReturn: number;
  totalCost: number;
  totalSlippage: number;

  // Performance metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  valueAtRisk: number;

  // Trade statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;

  // Portfolio evolution
  portfolioValues: number[];
  returns: number[];

  // Period analysis
  startDate: number;
  endDate: number;
  duration: number;
}

export class QuantBacktester {
  private initialCapital: number;

  constructor(
    private strategy: QuantStrategy,
    private costPerTrade = 0.001,
    private slippagePct = 0.0005,
    initialCapital = 10000
  ) {
    this.initialCapital = initialCapital;
  }

  runBacktest(historicalData: MarketData[]): BacktestResult {
    const signals: QuantSignal[] = [];
    const trades: Trade[] = [];
    const portfolioValues: number[] = [];
    const returns: number[] = [];

    let position: 'none' | 'long' | 'short' = 'none';
    let entryPrice = 0;
    let entryQuantity = 0;
    let currentCapital = this.initialCapital;
    let totalCost = 0;
    let totalSlippage = 0;
    let tradeId = 0;

    // Track portfolio value over time
    portfolioValues.push(currentCapital);

    // Avoid look-ahead bias: only use data up to i (not i+1)
    for (let i = 50; i < historicalData.length; i++) {
      const currentData = historicalData.slice(0, i + 1);
      const prices = currentData.slice(-50).map(d => d.price);
      const volumes = currentData.slice(-50).map(d => d.volume || 0);

      const signal = this.strategy.run({ prices, volumes });
      signals.push(signal);

      const { action, confidence } = signal;
      const price = historicalData[i].price;
      const timestamp = historicalData[i].timestamp;

      // Position sizing based on confidence and available capital
      const maxPositionSize = currentCapital * 0.1; // Max 10% per trade
      const positionSize = maxPositionSize * (confidence || 0.5);
      const quantity = positionSize / price;

      // Simulate transaction cost and slippage
      const cost = positionSize * this.costPerTrade;
      const slippage = positionSize * this.slippagePct;

      if (action === 'buy' && position !== 'long' && currentCapital > positionSize + cost + slippage) {
        // Close short position if exists
        if (position === 'short') {
          const pnl = entryQuantity * (entryPrice - price) - cost - slippage;
          currentCapital += pnl;

          trades.push({
            id: `trade_${++tradeId}`,
            action: 'buy',
            price,
            quantity: entryQuantity,
            timestamp,
            cost,
            slippage,
            pnl
          });
        }

        // Open long position
        position = 'long';
        entryPrice = price + slippage / quantity;
        entryQuantity = quantity;
        currentCapital -= positionSize + cost + slippage;
        totalCost += cost;
        totalSlippage += slippage;

        if (position !== 'short') {
          trades.push({
            id: `trade_${++tradeId}`,
            action: 'buy',
            price,
            quantity,
            timestamp,
            cost,
            slippage
          });
        }
      } else if (action === 'sell' && position !== 'short') {
        // Close long position if exists
        if (position === 'long') {
          const pnl = entryQuantity * (price - entryPrice) - cost - slippage;
          currentCapital += pnl + (entryQuantity * entryPrice);

          trades.push({
            id: `trade_${++tradeId}`,
            action: 'sell',
            price,
            quantity: entryQuantity,
            timestamp,
            cost,
            slippage,
            pnl
          });
        }

        // Open short position (if allowed)
        position = 'short';
        entryPrice = price - slippage / quantity;
        entryQuantity = quantity;
        currentCapital += positionSize - cost - slippage;
        totalCost += cost;
        totalSlippage += slippage;

        if (position !== 'long') {
          trades.push({
            id: `trade_${++tradeId}`,
            action: 'sell',
            price,
            quantity,
            timestamp,
            cost,
            slippage
          });
        }
      }

      // Calculate current portfolio value
      let portfolioValue = currentCapital;
      if (position === 'long') {
        portfolioValue += entryQuantity * price;
      } else if (position === 'short') {
        portfolioValue += entryQuantity * (2 * entryPrice - price);
      }

      portfolioValues.push(portfolioValue);

      // Calculate returns
      if (portfolioValues.length > 1) {
        const prevValue = portfolioValues[portfolioValues.length - 2];
        const returnPct = (portfolioValue - prevValue) / prevValue;
        returns.push(returnPct);
      }
    }

    // Close any remaining positions
    if (position !== 'none') {
      const finalPrice = historicalData[historicalData.length - 1].price;
      const finalTimestamp = historicalData[historicalData.length - 1].timestamp;
      const cost = entryQuantity * finalPrice * this.costPerTrade;
      const slippage = entryQuantity * finalPrice * this.slippagePct;

      let pnl = 0;
      if (position === 'long') {
        pnl = entryQuantity * (finalPrice - entryPrice) - cost - slippage;
        currentCapital += pnl + (entryQuantity * entryPrice);
      } else if (position === 'short') {
        pnl = entryQuantity * (entryPrice - finalPrice) - cost - slippage;
        currentCapital += pnl;
      }

      trades.push({
        id: `trade_${++tradeId}`,
        action: position === 'long' ? 'sell' : 'buy',
        price: finalPrice,
        quantity: entryQuantity,
        timestamp: finalTimestamp,
        cost,
        slippage,
        pnl
      });

      totalCost += cost;
      totalSlippage += slippage;
    }

    // Calculate comprehensive metrics
    return this.calculateMetrics(
      signals,
      trades,
      portfolioValues,
      returns,
      totalCost,
      totalSlippage,
      historicalData[0].timestamp,
      historicalData[historicalData.length - 1].timestamp
    );
  }

  private calculateMetrics(
    signals: QuantSignal[],
    trades: Trade[],
    portfolioValues: number[],
    returns: number[],
    totalCost: number,
    totalSlippage: number,
    startDate: number,
    endDate: number
  ): BacktestResult {
    const totalReturn = (portfolioValues[portfolioValues.length - 1] - this.initialCapital) / this.initialCapital;

    // Trade statistics
    const completedTrades = trades.filter(t => t.pnl !== undefined);
    const winningTrades = completedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = completedTrades.filter(t => (t.pnl || 0) < 0);

    const winRate = completedTrades.length > 0 ? winningTrades.length / completedTrades.length : 0;
    const avgWin = winningTrades.length > 0 ?
      winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ?
      Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length) : 0;

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    // Risk metrics
    const portfolioPrices = portfolioValues.slice(1); // Remove initial value
    const sharpe = returns.length > 0 ? sharpeRatio(returns) : 0;
    const sortino = returns.length > 0 ? sortinoRatio(returns) : 0;
    const calmar = portfolioPrices.length > 0 ? calmarRatio(returns, portfolioPrices) : 0;
    const maxDD = portfolioPrices.length > 0 ? maxDrawdown(portfolioPrices) : 0;
    const var95 = returns.length > 0 ? valueAtRisk(returns, 0.95) : 0;

    const duration = endDate - startDate;

    return {
      // Basic metrics
      signals,
      trades,
      totalReturn,
      totalCost,
      totalSlippage,

      // Performance metrics
      sharpeRatio: sharpe,
      sortinoRatio: sortino,
      calmarRatio: calmar,
      maxDrawdown: maxDD,
      valueAtRisk: var95,

      // Trade statistics
      totalTrades: completedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,

      // Portfolio evolution
      portfolioValues,
      returns,

      // Period analysis
      startDate,
      endDate,
      duration
    };
  }

  // Monte Carlo simulation for strategy robustness testing
  runMonteCarloSimulation(
    historicalData: MarketData[],
    iterations: number = 1000,
    randomSeed?: number
  ): {
    results: BacktestResult[];
    statistics: {
      avgReturn: number;
      stdReturn: number;
      winProbability: number;
      worstCase: number;
      bestCase: number;
    };
  } {
    const results: BacktestResult[] = [];

    for (let i = 0; i < iterations; i++) {
      // Shuffle data to test robustness
      const shuffledData = this.shuffleArray([...historicalData], randomSeed ? randomSeed + i : undefined);
      const result = this.runBacktest(shuffledData);
      results.push(result);
    }

    const returns = results.map(r => r.totalReturn);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const winProbability = results.filter(r => r.totalReturn > 0).length / results.length;
    const worstCase = Math.min(...returns);
    const bestCase = Math.max(...returns);

    return {
      results,
      statistics: {
        avgReturn,
        stdReturn,
        winProbability,
        worstCase,
        bestCase
      }
    };
  }

  private shuffleArray<T>(array: T[], seed?: number): T[] {
    const rng = seed ? this.seededRandom(seed) : Math.random;

    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private seededRandom(seed: number): () => number {
    let x = Math.sin(seed) * 10000;
    return () => {
      x = Math.sin(x) * 10000;
      return x - Math.floor(x);
    };
  }
}
