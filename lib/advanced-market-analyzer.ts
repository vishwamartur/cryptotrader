// Advanced Market Analysis Engine
// Combines technical analysis, sentiment analysis, and machine learning
// for superior market prediction and signal generation

import { MarketData } from './types';
import { sma, ema, rsi, macd, bollinger, atr, stochastic } from './quant-math';

export interface MarketSignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  confidence: number; // 0-100
  timeframe: string;
  reasoning: string[];
  technicalScore: number;
  sentimentScore: number;
  momentumScore: number;
  volatilityScore: number;
  volumeScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedMove: number;
  probability: number;
}

export interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerMiddle: number;
  atr: number;
  stochastic: number;
  stochasticSignal: number;
  adx: number;
  cci: number;
  williamsR: number;
  momentum: number;
  roc: number; // Rate of Change
  obv: number; // On Balance Volume
}

export interface MarketRegime {
  type: 'BULL_TREND' | 'BEAR_TREND' | 'SIDEWAYS' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY';
  strength: number;
  duration: number;
  confidence: number;
}

export interface SentimentData {
  fearGreedIndex: number;
  socialSentiment: number;
  newsScore: number;
  whaleActivity: number;
  institutionalFlow: number;
  retailSentiment: number;
}

export class AdvancedMarketAnalyzer {
  private historicalData: MarketData[] = [];
  private indicators: TechnicalIndicators | null = null;
  private currentRegime: MarketRegime | null = null;
  
  constructor() {}

  // Main analysis function
  analyzeMarket(
    marketData: MarketData[],
    sentimentData?: SentimentData,
    timeframe: string = '1h'
  ): MarketSignal {
    this.historicalData = marketData;
    
    if (marketData.length < 50) {
      return this.getDefaultSignal('Insufficient data for analysis');
    }

    // Calculate all technical indicators
    this.indicators = this.calculateTechnicalIndicators(marketData);
    
    // Determine market regime
    this.currentRegime = this.determineMarketRegime(marketData);
    
    // Calculate individual scores
    const technicalScore = this.calculateTechnicalScore();
    const momentumScore = this.calculateMomentumScore();
    const volatilityScore = this.calculateVolatilityScore();
    const volumeScore = this.calculateVolumeScore(marketData);
    const sentimentScore = sentimentData ? this.calculateSentimentScore(sentimentData) : 50;
    
    // Combine scores with regime-based weighting
    const signal = this.generateCombinedSignal(
      technicalScore,
      momentumScore,
      volatilityScore,
      volumeScore,
      sentimentScore,
      timeframe
    );

    return signal;
  }

  private calculateTechnicalIndicators(data: MarketData[]): TechnicalIndicators {
    const prices = data.map(d => d.price);
    const volumes = data.map(d => d.volume);
    const highs = data.map(d => d.high || d.price);
    const lows = data.map(d => d.low || d.price);
    const closes = prices;

    // Moving averages
    const sma20Values = sma(prices, 20);
    const sma50Values = sma(prices, 50);
    const ema12Values = ema(prices, 12);
    const ema26Values = ema(prices, 26);

    // Oscillators
    const rsiValues = rsi(prices, 14);
    const macdData = macd(prices, 12, 26, 9);
    const stochValues = stochastic(highs, lows, closes, 14, 3);
    
    // Bollinger Bands
    const bollingerData = bollinger(prices, 20, 2);
    
    // ATR
    const atrValues = atr(highs, lows, closes, 14);
    
    // Additional indicators
    const adxValue = this.calculateADX(highs, lows, closes, 14);
    const cciValue = this.calculateCCI(highs, lows, closes, 20);
    const williamsRValue = this.calculateWilliamsR(highs, lows, closes, 14);
    const momentumValue = this.calculateMomentum(prices, 10);
    const rocValue = this.calculateROC(prices, 12);
    const obvValue = this.calculateOBV(prices, volumes);

    return {
      sma20: sma20Values[sma20Values.length - 1] || 0,
      sma50: sma50Values[sma50Values.length - 1] || 0,
      ema12: ema12Values[ema12Values.length - 1] || 0,
      ema26: ema26Values[ema26Values.length - 1] || 0,
      rsi: rsiValues[rsiValues.length - 1] || 50,
      macd: macdData.macd[macdData.macd.length - 1] || 0,
      macdSignal: macdData.signal[macdData.signal.length - 1] || 0,
      macdHistogram: macdData.histogram[macdData.histogram.length - 1] || 0,
      bollingerUpper: bollingerData.upper[bollingerData.upper.length - 1] || 0,
      bollingerLower: bollingerData.lower[bollingerData.lower.length - 1] || 0,
      bollingerMiddle: bollingerData.middle[bollingerData.middle.length - 1] || 0,
      atr: atrValues[atrValues.length - 1] || 0,
      stochastic: stochValues[stochValues.length - 1] || 50,
      stochasticSignal: stochValues[stochValues.length - 2] || 50, // Previous value as signal
      adx: adxValue,
      cci: cciValue,
      williamsR: williamsRValue,
      momentum: momentumValue,
      roc: rocValue,
      obv: obvValue
    };
  }

  private calculateTechnicalScore(): number {
    if (!this.indicators) return 50;
    
    const { rsi, macd, macdSignal, stochastic, cci, williamsR } = this.indicators;
    let score = 50; // Neutral starting point
    
    // RSI analysis (30% weight)
    if (rsi < 30) score += 15; // Oversold - bullish
    else if (rsi > 70) score -= 15; // Overbought - bearish
    else if (rsi > 45 && rsi < 55) score += 5; // Neutral zone
    
    // MACD analysis (25% weight)
    if (macd > macdSignal) score += 12.5;
    else score -= 12.5;
    
    // Stochastic analysis (20% weight)
    if (stochastic < 20) score += 10;
    else if (stochastic > 80) score -= 10;
    
    // CCI analysis (15% weight)
    if (cci < -100) score += 7.5;
    else if (cci > 100) score -= 7.5;
    
    // Williams %R analysis (10% weight)
    if (williamsR < -80) score += 5;
    else if (williamsR > -20) score -= 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateMomentumScore(): number {
    if (!this.indicators) return 50;
    
    const { momentum, roc, macdHistogram, adx } = this.indicators;
    let score = 50;
    
    // Momentum (30% weight)
    if (momentum > 0) score += 15;
    else score -= 15;
    
    // Rate of Change (25% weight)
    if (roc > 2) score += 12.5;
    else if (roc < -2) score -= 12.5;
    
    // MACD Histogram (25% weight)
    if (macdHistogram > 0) score += 12.5;
    else score -= 12.5;
    
    // ADX for trend strength (20% weight)
    if (adx > 25) {
      // Strong trend - amplify momentum signals
      const amplification = Math.min(10, (adx - 25) / 5);
      if (momentum > 0) score += amplification;
      else score -= amplification;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateVolatilityScore(): number {
    if (!this.indicators || !this.historicalData.length) return 50;
    
    const { atr, bollingerUpper, bollingerLower } = this.indicators;
    const currentPrice = this.historicalData[this.historicalData.length - 1].price;
    
    // Bollinger Band position
    const bandWidth = bollingerUpper - bollingerLower;
    const bandPosition = (currentPrice - bollingerLower) / bandWidth;
    
    // ATR-based volatility
    const avgPrice = this.historicalData.slice(-20).reduce((sum, d) => sum + d.price, 0) / 20;
    const volatilityRatio = atr / avgPrice;
    
    let score = 50;
    
    // High volatility reduces confidence
    if (volatilityRatio > 0.03) score -= 20;
    else if (volatilityRatio < 0.01) score += 10;
    
    // Bollinger band extremes
    if (bandPosition < 0.1 || bandPosition > 0.9) score += 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateVolumeScore(data: MarketData[]): number {
    if (data.length < 20) return 50;
    
    const volumes = data.map(d => d.volume);
    const recentVolumes = volumes.slice(-5);
    const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    
    let score = 50;
    
    // Volume confirmation
    if (currentVolume > avgVolume * 1.5) score += 20;
    else if (currentVolume < avgVolume * 0.5) score -= 10;
    
    // Volume trend
    const volumeTrend = recentVolumes.slice(-3).reduce((sum, v) => sum + v, 0) / 3 -
                       recentVolumes.slice(0, 2).reduce((sum, v) => sum + v, 0) / 2;
    
    if (volumeTrend > 0) score += 10;
    else score -= 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateSentimentScore(sentiment: SentimentData): number {
    const {
      fearGreedIndex,
      socialSentiment,
      newsScore,
      whaleActivity,
      institutionalFlow,
      retailSentiment
    } = sentiment;
    
    // Weighted sentiment calculation
    const score = (
      fearGreedIndex * 0.25 +
      socialSentiment * 0.20 +
      newsScore * 0.15 +
      whaleActivity * 0.20 +
      institutionalFlow * 0.15 +
      retailSentiment * 0.05
    );
    
    return Math.max(0, Math.min(100, score));
  }

  private determineMarketRegime(data: MarketData[]): MarketRegime {
    if (data.length < 50) {
      return {
        type: 'SIDEWAYS',
        strength: 50,
        duration: 0,
        confidence: 30
      };
    }
    
    const prices = data.map(d => d.price);
    const sma20Values = sma(prices, 20);
    const sma50Values = sma(prices, 50);
    
    const currentSMA20 = sma20Values[sma20Values.length - 1];
    const currentSMA50 = sma50Values[sma50Values.length - 1];
    
    // Calculate volatility
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    const volatility = Math.sqrt(returns.reduce((sum, r) => sum + r * r, 0) / returns.length);
    
    // Determine regime
    let type: MarketRegime['type'];
    let strength = 50;
    
    if (volatility > 0.03) {
      type = 'HIGH_VOLATILITY';
      strength = Math.min(100, volatility * 1000);
    } else if (volatility < 0.01) {
      type = 'LOW_VOLATILITY';
      strength = Math.max(0, 100 - volatility * 5000);
    } else if (currentSMA20 > currentSMA50 * 1.02) {
      type = 'BULL_TREND';
      strength = Math.min(100, ((currentSMA20 / currentSMA50) - 1) * 5000);
    } else if (currentSMA20 < currentSMA50 * 0.98) {
      type = 'BEAR_TREND';
      strength = Math.min(100, (1 - (currentSMA20 / currentSMA50)) * 5000);
    } else {
      type = 'SIDEWAYS';
      strength = 50;
    }
    
    return {
      type,
      strength,
      duration: 0, // Would need historical regime tracking
      confidence: Math.min(100, strength + 20)
    };
  }

  private generateCombinedSignal(
    technicalScore: number,
    momentumScore: number,
    volatilityScore: number,
    volumeScore: number,
    sentimentScore: number,
    timeframe: string
  ): MarketSignal {
    // Regime-based weighting
    const regimeWeights = this.getRegimeWeights();
    
    // Calculate weighted composite score
    const compositeScore = (
      technicalScore * regimeWeights.technical +
      momentumScore * regimeWeights.momentum +
      volatilityScore * regimeWeights.volatility +
      volumeScore * regimeWeights.volume +
      sentimentScore * regimeWeights.sentiment
    );
    
    // Determine signal
    let signal: 'BUY' | 'SELL' | 'HOLD';
    let strength: number;
    let confidence: number;
    
    if (compositeScore > 65) {
      signal = 'BUY';
      strength = Math.min(100, (compositeScore - 50) * 2);
      confidence = Math.min(95, compositeScore + 10);
    } else if (compositeScore < 35) {
      signal = 'SELL';
      strength = Math.min(100, (50 - compositeScore) * 2);
      confidence = Math.min(95, (100 - compositeScore) + 10);
    } else {
      signal = 'HOLD';
      strength = Math.abs(compositeScore - 50);
      confidence = Math.max(30, 100 - Math.abs(compositeScore - 50) * 2);
    }
    
    // Generate reasoning
    const reasoning = this.generateReasoning(
      technicalScore,
      momentumScore,
      volatilityScore,
      volumeScore,
      sentimentScore
    );
    
    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(volatilityScore, confidence);
    
    // Calculate expected move and probability
    const expectedMove = this.calculateExpectedMove();
    const probability = this.calculateProbability(confidence, strength);
    
    return {
      signal,
      strength,
      confidence,
      timeframe,
      reasoning,
      technicalScore,
      sentimentScore,
      momentumScore,
      volatilityScore,
      volumeScore,
      riskLevel,
      expectedMove,
      probability
    };
  }

  private getRegimeWeights(): { technical: number; momentum: number; volatility: number; volume: number; sentiment: number } {
    if (!this.currentRegime) {
      return { technical: 0.3, momentum: 0.25, volatility: 0.2, volume: 0.15, sentiment: 0.1 };
    }
    
    switch (this.currentRegime.type) {
      case 'BULL_TREND':
      case 'BEAR_TREND':
        return { technical: 0.25, momentum: 0.35, volatility: 0.15, volume: 0.15, sentiment: 0.1 };
      case 'SIDEWAYS':
        return { technical: 0.4, momentum: 0.15, volatility: 0.2, volume: 0.15, sentiment: 0.1 };
      case 'HIGH_VOLATILITY':
        return { technical: 0.2, momentum: 0.2, volatility: 0.35, volume: 0.15, sentiment: 0.1 };
      case 'LOW_VOLATILITY':
        return { technical: 0.35, momentum: 0.25, volatility: 0.1, volume: 0.2, sentiment: 0.1 };
      default:
        return { technical: 0.3, momentum: 0.25, volatility: 0.2, volume: 0.15, sentiment: 0.1 };
    }
  }

  // Helper methods for additional indicators
  private calculateADX(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified ADX calculation
    if (highs.length < period + 1) return 25;
    
    let dmPlus = 0, dmMinus = 0, tr = 0;
    
    for (let i = 1; i < period + 1; i++) {
      const highDiff = highs[highs.length - i] - highs[highs.length - i - 1];
      const lowDiff = lows[lows.length - i - 1] - lows[lows.length - i];
      
      dmPlus += Math.max(0, highDiff);
      dmMinus += Math.max(0, lowDiff);
      
      const trueRange = Math.max(
        highs[highs.length - i] - lows[lows.length - i],
        Math.abs(highs[highs.length - i] - closes[closes.length - i - 1]),
        Math.abs(lows[lows.length - i] - closes[closes.length - i - 1])
      );
      tr += trueRange;
    }
    
    const diPlus = (dmPlus / tr) * 100;
    const diMinus = (dmMinus / tr) * 100;
    
    return Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
  }

  private calculateCCI(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period) return 0;
    
    const typicalPrices = [];
    for (let i = 0; i < period; i++) {
      const idx = closes.length - 1 - i;
      typicalPrices.push((highs[idx] + lows[idx] + closes[idx]) / 3);
    }
    
    const smaTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
    const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
    
    return (typicalPrices[0] - smaTP) / (0.015 * meanDeviation);
  }

  private calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period) return -50;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  private calculateMomentum(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;
    
    const current = prices[prices.length - 1];
    const previous = prices[prices.length - 1 - period];
    
    return ((current - previous) / previous) * 100;
  }

  private calculateROC(prices: number[], period: number): number {
    return this.calculateMomentum(prices, period); // Same calculation
  }

  private calculateOBV(prices: number[], volumes: number[]): number {
    if (prices.length < 2 || volumes.length < 2) return 0;
    
    let obv = 0;
    for (let i = 1; i < Math.min(prices.length, volumes.length); i++) {
      if (prices[i] > prices[i - 1]) {
        obv += volumes[i];
      } else if (prices[i] < prices[i - 1]) {
        obv -= volumes[i];
      }
    }
    
    return obv;
  }

  private generateReasoning(
    technical: number,
    momentum: number,
    volatility: number,
    volume: number,
    sentiment: number
  ): string[] {
    const reasons: string[] = [];
    
    if (technical > 65) reasons.push('Strong technical indicators support upward movement');
    else if (technical < 35) reasons.push('Technical indicators suggest downward pressure');
    
    if (momentum > 65) reasons.push('Positive momentum confirms trend strength');
    else if (momentum < 35) reasons.push('Negative momentum indicates potential reversal');
    
    if (volatility > 70) reasons.push('High volatility increases opportunity but also risk');
    else if (volatility < 30) reasons.push('Low volatility suggests stable conditions');
    
    if (volume > 65) reasons.push('Strong volume confirms price movement');
    else if (volume < 35) reasons.push('Weak volume questions sustainability of move');
    
    if (sentiment > 65) reasons.push('Positive market sentiment supports bullish outlook');
    else if (sentiment < 35) reasons.push('Negative sentiment creates bearish bias');
    
    return reasons;
  }

  private calculateRiskLevel(volatilityScore: number, confidence: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    const riskScore = (100 - volatilityScore) + (100 - confidence);
    
    if (riskScore > 120) return 'HIGH';
    else if (riskScore > 80) return 'MEDIUM';
    else return 'LOW';
  }

  private calculateExpectedMove(): number {
    if (!this.indicators) return 0.02;
    
    const { atr } = this.indicators;
    const currentPrice = this.historicalData[this.historicalData.length - 1]?.price || 0;
    
    return currentPrice > 0 ? (atr / currentPrice) : 0.02;
  }

  private calculateProbability(confidence: number, strength: number): number {
    return Math.min(95, (confidence + strength) / 2);
  }

  private getDefaultSignal(reason: string): MarketSignal {
    return {
      signal: 'HOLD',
      strength: 0,
      confidence: 30,
      timeframe: '1h',
      reasoning: [reason],
      technicalScore: 50,
      sentimentScore: 50,
      momentumScore: 50,
      volatilityScore: 50,
      volumeScore: 50,
      riskLevel: 'MEDIUM',
      expectedMove: 0.02,
      probability: 30
    };
  }
}
