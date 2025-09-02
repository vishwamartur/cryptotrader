// Enhanced Strategy Engine with Profit Optimization
// Focuses on maximizing risk-adjusted returns and minimizing drawdowns

import { QuantStrategy, QuantSignal } from './quant-strategy-engine';
import { sma, ema, rsi, bollinger, atr, stochastic, macd } from './quant-math';
import { RiskManager } from './risk-management';

export interface EnhancedSignal extends QuantSignal {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskReward: number;
  expectedReturn: number;
  maxRisk: number;
  timeframe: string;
  marketRegime: 'trending' | 'ranging' | 'volatile' | 'calm';
  volatilityAdjustment: number;
}

export interface StrategyPerformance {
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalTrades: number;
  avgHoldTime: number;
  calmarRatio: number;
  volatility: number;
}

export class EnhancedStrategyEngine {
  private strategies: Map<string, QuantStrategy> = new Map();
  private performance: Map<string, StrategyPerformance> = new Map();
  private riskManager: RiskManager;
  private adaptiveWeights: Map<string, number> = new Map();
  
  constructor(riskManager: RiskManager) {
    this.riskManager = riskManager;
  }

  // Advanced Multi-Timeframe Momentum Strategy
  createAdvancedMomentumStrategy(): QuantStrategy {
    return {
      name: 'Advanced Momentum',
      description: 'Multi-timeframe momentum with volatility adjustment and profit optimization',
      run: (marketData: { prices: number[], volumes?: number[], timeframe?: string }) => {
        const { prices, volumes = [], timeframe = '1h' } = marketData;
        
        if (prices.length < 100) {
          return { action: 'hold', confidence: 0 };
        }

        // Calculate multiple indicators
        const rsiValues = rsi(prices, 14);
        const macdData = macd(prices, 12, 26, 9);
        const atrValues = atr(prices, prices, prices, 14); // Using prices as proxy for high/low
        const stochValues = stochastic(prices, prices, prices, 14, 3); // Using prices as proxy
        
        const currentPrice = prices[prices.length - 1];
        const currentRSI = rsiValues[rsiValues.length - 1];
        const currentMACD = macdData.macd[macdData.macd.length - 1];
        const currentSignal = macdData.signal[macdData.signal.length - 1];
        const currentATR = atrValues[atrValues.length - 1];
        const currentStoch = stochValues[stochValues.length - 1];

        // Market regime detection
        const volatility = this.calculateVolatility(prices.slice(-20));
        const trend = this.detectTrend(prices.slice(-50));
        const marketRegime = this.determineMarketRegime(volatility, trend);

        // Multi-factor scoring
        let momentumScore = 0;
        let confidence = 0;

        // RSI momentum (30% weight)
        if (currentRSI < 30) {
          momentumScore += 0.3;
        } else if (currentRSI > 70) {
          momentumScore -= 0.3;
        }

        // MACD momentum (40% weight)
        if (currentMACD > currentSignal) {
          momentumScore += 0.4;
        } else {
          momentumScore -= 0.4;
        }

        // Stochastic momentum (20% weight)
        if (currentStoch < 20) {
          momentumScore += 0.2;
        } else if (currentStoch > 80) {
          momentumScore -= 0.2;
        }

        // Volume confirmation (10% weight)
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const currentVolume = volumes[volumes.length - 1] || avgVolume;
        if (currentVolume > avgVolume * 1.2) {
          momentumScore += 0.1 * Math.sign(momentumScore);
        }

        // Volatility adjustment
        const volatilityAdjustment = Math.min(1.5, Math.max(0.5, 1 / volatility));
        confidence = Math.abs(momentumScore) * volatilityAdjustment;

        // Risk-reward optimization
        const stopLossDistance = currentATR * 2;
        const takeProfitDistance = stopLossDistance * 2.5; // 2.5:1 risk-reward

        const signal: EnhancedSignal = {
          action: momentumScore > 0.3 ? 'buy' : momentumScore < -0.3 ? 'sell' : 'hold',
          confidence: Math.min(0.95, confidence),
          entryPrice: currentPrice,
          stopLoss: momentumScore > 0 ? currentPrice - stopLossDistance : currentPrice + stopLossDistance,
          takeProfit: momentumScore > 0 ? currentPrice + takeProfitDistance : currentPrice - takeProfitDistance,
          positionSize: this.calculateOptimalPositionSize(confidence, volatility),
          riskReward: 2.5,
          expectedReturn: takeProfitDistance / currentPrice,
          maxRisk: stopLossDistance / currentPrice,
          timeframe,
          marketRegime,
          volatilityAdjustment,
          details: {
            rsi: currentRSI,
            macd: currentMACD,
            signal: currentSignal,
            stochastic: currentStoch,
            atr: currentATR,
            momentumScore,
            volatility
          }
        };

        return signal;
      }
    };
  }

  // Mean Reversion Strategy with Dynamic Bands
  createDynamicMeanReversionStrategy(): QuantStrategy {
    return {
      name: 'Dynamic Mean Reversion',
      description: 'Adaptive mean reversion with dynamic Bollinger Bands and volatility scaling',
      run: (marketData: { prices: number[], volumes?: number[] }) => {
        const { prices, volumes = [] } = marketData;
        
        if (prices.length < 50) {
          return { action: 'hold', confidence: 0 };
        }

        const currentPrice = prices[prices.length - 1];
        const volatility = this.calculateVolatility(prices.slice(-20));
        
        // Dynamic period based on volatility
        const period = Math.max(10, Math.min(30, Math.floor(20 / volatility)));
        const bands = bollinger(prices, period, 2 * volatility);
        
        const upperBand = bands.upper[bands.upper.length - 1];
        const lowerBand = bands.lower[bands.lower.length - 1];
        const middleBand = bands.middle[bands.middle.length - 1];
        
        // Position within bands
        const bandPosition = (currentPrice - lowerBand) / (upperBand - lowerBand);
        
        // RSI for confirmation
        const rsiValues = rsi(prices, 14);
        const currentRSI = rsiValues[rsiValues.length - 1];
        
        let signal: 'buy' | 'sell' | 'hold' = 'hold';
        let confidence = 0;
        
        // Mean reversion signals
        if (bandPosition < 0.2 && currentRSI < 35) {
          signal = 'buy';
          confidence = (0.2 - bandPosition) * 2 + (35 - currentRSI) / 100;
        } else if (bandPosition > 0.8 && currentRSI > 65) {
          signal = 'sell';
          confidence = (bandPosition - 0.8) * 2 + (currentRSI - 65) / 100;
        }
        
        confidence = Math.min(0.9, confidence);
        
        const atrValue = this.calculateATR(prices.slice(-14));
        const stopLossDistance = atrValue * 1.5;
        const takeProfitDistance = Math.abs(currentPrice - middleBand) * 0.8;
        
        const enhancedSignal: EnhancedSignal = {
          action: signal,
          confidence,
          entryPrice: currentPrice,
          stopLoss: signal === 'buy' ? currentPrice - stopLossDistance : currentPrice + stopLossDistance,
          takeProfit: signal === 'buy' ? currentPrice + takeProfitDistance : currentPrice - takeProfitDistance,
          positionSize: this.calculateOptimalPositionSize(confidence, volatility),
          riskReward: takeProfitDistance / stopLossDistance,
          expectedReturn: takeProfitDistance / currentPrice,
          maxRisk: stopLossDistance / currentPrice,
          timeframe: '1h',
          marketRegime: this.determineMarketRegime(volatility, this.detectTrend(prices.slice(-30))),
          volatilityAdjustment: 1 / volatility,
          details: {
            bandPosition,
            rsi: currentRSI,
            upperBand,
            lowerBand,
            middleBand,
            volatility
          }
        };
        
        return enhancedSignal;
      }
    };
  }

  // Breakout Strategy with Volume Confirmation
  createVolumeBreakoutStrategy(): QuantStrategy {
    return {
      name: 'Volume Breakout',
      description: 'Breakout strategy with volume confirmation and false breakout filtering',
      run: (marketData: { prices: number[], volumes?: number[] }) => {
        const { prices, volumes = [] } = marketData;
        
        if (prices.length < 50 || volumes.length < 50) {
          return { action: 'hold', confidence: 0 };
        }

        const currentPrice = prices[prices.length - 1];
        const currentVolume = volumes[volumes.length - 1];
        
        // Calculate support and resistance levels
        const lookback = 20;
        const recentPrices = prices.slice(-lookback);
        const recentVolumes = volumes.slice(-lookback);
        
        const resistance = Math.max(...recentPrices);
        const support = Math.min(...recentPrices);
        const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / lookback;
        
        // Volume spike detection
        const volumeSpike = currentVolume > avgVolume * 1.5;
        const significantVolumeSpike = currentVolume > avgVolume * 2;
        
        // Breakout detection
        const breakoutThreshold = (resistance - support) * 0.02; // 2% of range
        
        let signal: 'buy' | 'sell' | 'hold' = 'hold';
        let confidence = 0;
        
        if (currentPrice > resistance + breakoutThreshold && volumeSpike) {
          signal = 'buy';
          confidence = 0.7 + (significantVolumeSpike ? 0.2 : 0);
        } else if (currentPrice < support - breakoutThreshold && volumeSpike) {
          signal = 'sell';
          confidence = 0.7 + (significantVolumeSpike ? 0.2 : 0);
        }
        
        const atrValue = this.calculateATR(prices.slice(-14));
        const stopLossDistance = atrValue * 2;
        const takeProfitDistance = (resistance - support) * 0.6;
        
        const enhancedSignal: EnhancedSignal = {
          action: signal,
          confidence,
          entryPrice: currentPrice,
          stopLoss: signal === 'buy' ? currentPrice - stopLossDistance : currentPrice + stopLossDistance,
          takeProfit: signal === 'buy' ? currentPrice + takeProfitDistance : currentPrice - takeProfitDistance,
          positionSize: this.calculateOptimalPositionSize(confidence, this.calculateVolatility(prices.slice(-20))),
          riskReward: takeProfitDistance / stopLossDistance,
          expectedReturn: takeProfitDistance / currentPrice,
          maxRisk: stopLossDistance / currentPrice,
          timeframe: '1h',
          marketRegime: 'trending',
          volatilityAdjustment: 1,
          details: {
            resistance,
            support,
            volumeSpike,
            currentVolume,
            avgVolume,
            breakoutThreshold
          }
        };
        
        return enhancedSignal;
      }
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.02;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private detectTrend(prices: number[]): number {
    if (prices.length < 10) return 0;
    
    const firstHalf = prices.slice(0, Math.floor(prices.length / 2));
    const secondHalf = prices.slice(Math.floor(prices.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }

  private determineMarketRegime(volatility: number, trend: number): 'trending' | 'ranging' | 'volatile' | 'calm' {
    if (volatility > 0.03) {
      return 'volatile';
    } else if (volatility < 0.01) {
      return 'calm';
    } else if (Math.abs(trend) > 0.02) {
      return 'trending';
    } else {
      return 'ranging';
    }
  }

  private calculateOptimalPositionSize(confidence: number, volatility: number): number {
    // Kelly Criterion inspired position sizing
    const baseSize = 0.02; // 2% base position
    const confidenceMultiplier = confidence * 2;
    const volatilityAdjustment = Math.max(0.5, Math.min(2, 1 / volatility));
    
    return Math.min(0.1, baseSize * confidenceMultiplier * volatilityAdjustment);
  }

  private calculateATR(prices: number[]): number {
    if (prices.length < 2) return prices[0] * 0.02;
    
    const trueRanges = [];
    for (let i = 1; i < prices.length; i++) {
      trueRanges.push(Math.abs(prices[i] - prices[i-1]));
    }
    
    return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  }
}
