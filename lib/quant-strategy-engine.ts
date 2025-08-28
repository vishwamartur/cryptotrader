// Quant Strategy Engine
// This module allows you to define and run quantitative trading strategies.

export type QuantStrategy = {
  name: string;
  description?: string;
  run: (marketData: any) => QuantSignal;
};

export type QuantSignal = {
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0 to 1
  details?: any;
};

export class QuantStrategyEngine {
  private strategies: QuantStrategy[] = [];

  addStrategy(strategy: QuantStrategy) {
    this.strategies.push(strategy);
  }

  runAll(marketData: any): QuantSignal[] {
    return this.strategies.map(strategy => strategy.run(marketData));
  }

  getStrategies(): QuantStrategy[] {
    return this.strategies;
  }
}

// Import mathematical functions
import { sma, ema, rsi, bollinger, mean, stddev } from './quant-math';

// Enhanced Moving Average Crossover Strategy
export const MovingAverageCrossoverStrategy: QuantStrategy = {
  name: 'Moving Average Crossover',
  description: 'Generates buy/sell signals based on short and long moving averages with volume confirmation.',
  run: (marketData: { prices: number[], volumes?: number[] }) => {
    const prices = marketData.prices || [];
    const volumes = marketData.volumes || [];

    if (prices.length < 50) {
      return { action: 'hold', confidence: 0 };
    }

    const shortMA = sma(prices, 10);
    const longMA = sma(prices, 30);

    if (shortMA.length < 2 || longMA.length < 2) {
      return { action: 'hold', confidence: 0 };
    }

    const currentShort = shortMA[shortMA.length - 1];
    const currentLong = longMA[longMA.length - 1];
    const prevShort = shortMA[shortMA.length - 2];
    const prevLong = longMA[longMA.length - 2];

    // Volume confirmation
    const avgVolume = volumes.length > 20 ? mean(volumes.slice(-20)) : 1;
    const currentVolume = volumes[volumes.length - 1] || 1;
    const volumeConfirmation = currentVolume > avgVolume * 1.2;

    // Crossover detection
    const bullishCrossover = prevShort <= prevLong && currentShort > currentLong;
    const bearishCrossover = prevShort >= prevLong && currentShort < currentLong;

    if (bullishCrossover) {
      const strength = (currentShort - currentLong) / currentLong;
      const confidence = Math.min(Math.abs(strength) * (volumeConfirmation ? 1.5 : 1), 0.9);
      return { action: 'buy', confidence, details: { strength, volumeConfirmation } };
    } else if (bearishCrossover) {
      const strength = (currentLong - currentShort) / currentShort;
      const confidence = Math.min(Math.abs(strength) * (volumeConfirmation ? 1.5 : 1), 0.9);
      return { action: 'sell', confidence, details: { strength, volumeConfirmation } };
    }

    return { action: 'hold', confidence: 0 };
  }
};

// Mean Reversion Strategy
export const MeanReversionStrategy: QuantStrategy = {
  name: 'Mean Reversion',
  description: 'Trades based on price deviation from moving average using Bollinger Bands.',
  run: (marketData: { prices: number[], volumes?: number[] }) => {
    const prices = marketData.prices || [];

    if (prices.length < 30) {
      return { action: 'hold', confidence: 0 };
    }

    const bands = bollinger(prices, 20, 2);
    const currentPrice = prices[prices.length - 1];
    const currentUpper = bands.upper[bands.upper.length - 1];
    const currentLower = bands.lower[bands.lower.lower - 1];
    const currentMiddle = bands.middle[bands.middle.length - 1];

    // Calculate position within bands
    const bandWidth = currentUpper - currentLower;
    const pricePosition = (currentPrice - currentLower) / bandWidth;

    if (pricePosition > 0.8) {
      // Price near upper band - sell signal
      const confidence = Math.min((pricePosition - 0.8) * 5, 0.9);
      return { action: 'sell', confidence, details: { pricePosition, bandWidth } };
    } else if (pricePosition < 0.2) {
      // Price near lower band - buy signal
      const confidence = Math.min((0.2 - pricePosition) * 5, 0.9);
      return { action: 'buy', confidence, details: { pricePosition, bandWidth } };
    }

    return { action: 'hold', confidence: 0 };
  }
};

// Momentum Strategy using RSI
export const MomentumStrategy: QuantStrategy = {
  name: 'RSI Momentum',
  description: 'Uses RSI to identify overbought/oversold conditions.',
  run: (marketData: { prices: number[] }) => {
    const prices = marketData.prices || [];

    if (prices.length < 30) {
      return { action: 'hold', confidence: 0 };
    }

    const rsiValues = rsi(prices, 14);
    const currentRSI = rsiValues[rsiValues.length - 1];

    if (currentRSI > 70) {
      // Overbought - sell signal
      const confidence = Math.min((currentRSI - 70) / 30, 0.9);
      return { action: 'sell', confidence, details: { rsi: currentRSI } };
    } else if (currentRSI < 30) {
      // Oversold - buy signal
      const confidence = Math.min((30 - currentRSI) / 30, 0.9);
      return { action: 'buy', confidence, details: { rsi: currentRSI } };
    }

    return { action: 'hold', confidence: 0 };
  }
};

// Breakout Strategy
export const BreakoutStrategy: QuantStrategy = {
  name: 'Breakout Trading',
  description: 'Identifies breakouts from consolidation patterns with volume confirmation.',
  run: (marketData: { prices: number[], volumes?: number[] }) => {
    const prices = marketData.prices || [];
    const volumes = marketData.volumes || [];

    if (prices.length < 50) {
      return { action: 'hold', confidence: 0 };
    }

    // Calculate recent high and low
    const lookbackPeriod = 20;
    const recentPrices = prices.slice(-lookbackPeriod);
    const recentHigh = Math.max(...recentPrices);
    const recentLow = Math.min(...recentPrices);
    const currentPrice = prices[prices.length - 1];

    // Calculate volatility
    const returns = prices.slice(-20).map((price, i, arr) =>
      i > 0 ? (price - arr[i-1]) / arr[i-1] : 0
    ).slice(1);
    const volatility = stddev(returns);

    // Volume analysis
    const avgVolume = volumes.length > 20 ? mean(volumes.slice(-20)) : 1;
    const currentVolume = volumes[volumes.length - 1] || 1;
    const volumeSpike = currentVolume > avgVolume * 1.5;

    // Breakout detection
    const range = recentHigh - recentLow;
    const breakoutThreshold = range * 0.02; // 2% of range

    if (currentPrice > recentHigh + breakoutThreshold && volumeSpike) {
      const strength = (currentPrice - recentHigh) / recentHigh;
      const confidence = Math.min(strength * 10 * (1 + volatility), 0.9);
      return {
        action: 'buy',
        confidence,
        details: { breakoutType: 'upward', strength, volatility, volumeSpike }
      };
    } else if (currentPrice < recentLow - breakoutThreshold && volumeSpike) {
      const strength = (recentLow - currentPrice) / currentPrice;
      const confidence = Math.min(strength * 10 * (1 + volatility), 0.9);
      return {
        action: 'sell',
        confidence,
        details: { breakoutType: 'downward', strength, volatility, volumeSpike }
      };
    }

    return { action: 'hold', confidence: 0 };
  }
};

// Multi-Strategy Ensemble
export class StrategyEnsemble {
  private strategies: QuantStrategy[] = [];
  private weights: number[] = [];

  constructor() {
    this.addStrategy(MovingAverageCrossoverStrategy, 0.3);
    this.addStrategy(MeanReversionStrategy, 0.25);
    this.addStrategy(MomentumStrategy, 0.25);
    this.addStrategy(BreakoutStrategy, 0.2);
  }

  addStrategy(strategy: QuantStrategy, weight: number = 1) {
    this.strategies.push(strategy);
    this.weights.push(weight);
  }

  run(marketData: any): QuantSignal {
    const signals = this.strategies.map(strategy => strategy.run(marketData));

    // Weighted voting system
    let buyScore = 0;
    let sellScore = 0;
    let totalWeight = 0;

    signals.forEach((signal, i) => {
      const weight = this.weights[i] || 1;
      totalWeight += weight;

      if (signal.action === 'buy') {
        buyScore += signal.confidence * weight;
      } else if (signal.action === 'sell') {
        sellScore += signal.confidence * weight;
      }
    });

    buyScore /= totalWeight;
    sellScore /= totalWeight;

    const threshold = 0.3;

    if (buyScore > sellScore && buyScore > threshold) {
      return {
        action: 'buy',
        confidence: buyScore,
        details: { buyScore, sellScore, signals }
      };
    } else if (sellScore > buyScore && sellScore > threshold) {
      return {
        action: 'sell',
        confidence: sellScore,
        details: { buyScore, sellScore, signals }
      };
    }

    return { action: 'hold', confidence: 0, details: { buyScore, sellScore, signals } };
  }
}
