import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../database/connection';
import { mlFeatures, marketData, type MLFeature, type NewMLFeature } from '../../database/schema';
import { MarketDataService } from '../../database/services/market-data-service';

export interface TechnicalIndicators {
  sma_5: number;
  sma_10: number;
  sma_20: number;
  sma_50: number;
  ema_12: number;
  ema_26: number;
  rsi_14: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  bb_upper: number;
  bb_middle: number;
  bb_lower: number;
  bb_width: number;
  stoch_k: number;
  stoch_d: number;
  atr_14: number;
  adx_14: number;
  cci_20: number;
  williams_r: number;
}

export interface MarketMicrostructure {
  bid_ask_spread: number;
  bid_ask_ratio: number;
  volume_weighted_price: number;
  price_impact: number;
  order_flow_imbalance: number;
  tick_direction: number;
  volume_profile: number[];
  support_resistance: { support: number; resistance: number };
}

export interface VolatilityMetrics {
  realized_volatility: number;
  garch_volatility: number;
  parkinson_volatility: number;
  garman_klass_volatility: number;
  volatility_of_volatility: number;
  volatility_skew: number;
  volatility_smile: number[];
}

export class FeatureEngineeringService {
  // Create feature set for a symbol at a specific timestamp
  static async createFeatureSet(
    symbol: string,
    timestamp: Date,
    lookbackPeriods: number = 100
  ): Promise<MLFeature> {
    // Get historical market data
    const endTime = timestamp;
    const startTime = new Date(endTime.getTime() - (lookbackPeriods * 60 * 60 * 1000)); // lookback hours
    
    const historicalData = await MarketDataService.getHistoricalData(symbol, startTime, endTime, lookbackPeriods);
    
    if (historicalData.length < 20) {
      throw new Error(`Insufficient data for feature engineering: ${historicalData.length} points`);
    }

    // Calculate technical indicators
    const technicalIndicators = this.calculateTechnicalIndicators(historicalData);
    
    // Calculate market microstructure features
    const marketMicrostructure = this.calculateMarketMicrostructure(historicalData);
    
    // Calculate volatility metrics
    const volatilityMetrics = this.calculateVolatilityMetrics(historicalData);
    
    // Calculate correlation data (simplified - in production would use multiple assets)
    const correlationData = this.calculateCorrelationData(historicalData);
    
    // Combine all features
    const features = {
      ...technicalIndicators,
      price_momentum_1h: this.calculateMomentum(historicalData, 1),
      price_momentum_4h: this.calculateMomentum(historicalData, 4),
      price_momentum_24h: this.calculateMomentum(historicalData, 24),
      volume_momentum_1h: this.calculateVolumeMomentum(historicalData, 1),
      volume_momentum_4h: this.calculateVolumeMomentum(historicalData, 4),
      volume_momentum_24h: this.calculateVolumeMomentum(historicalData, 24),
      price_acceleration: this.calculateAcceleration(historicalData),
      volume_acceleration: this.calculateVolumeAcceleration(historicalData),
      trend_strength: this.calculateTrendStrength(historicalData),
      market_regime: this.identifyMarketRegime(historicalData),
    };

    // Store feature set in database
    const featureData: Omit<NewMLFeature, 'id' | 'createdAt'> = {
      symbol,
      timestamp,
      features,
      technicalIndicators,
      marketMicrostructure,
      sentimentData: {}, // Placeholder for sentiment data
      macroeconomic: {}, // Placeholder for macro data
      volatilityMetrics,
      correlationData,
    };

    const [feature] = await db.insert(mlFeatures).values(featureData).returning();
    return feature;
  }

  // Calculate technical indicators
  private static calculateTechnicalIndicators(data: any[]): TechnicalIndicators {
    const prices = data.map(d => Number(d.price));
    const volumes = data.map(d => Number(d.volume));
    const highs = data.map(d => Number(d.high24h || d.price * 1.02));
    const lows = data.map(d => Number(d.low24h || d.price * 0.98));
    const closes = prices;

    return {
      sma_5: this.sma(prices, 5),
      sma_10: this.sma(prices, 10),
      sma_20: this.sma(prices, 20),
      sma_50: this.sma(prices, 50),
      ema_12: this.ema(prices, 12),
      ema_26: this.ema(prices, 26),
      rsi_14: this.rsi(prices, 14),
      macd: this.ema(prices, 12) - this.ema(prices, 26),
      macd_signal: this.ema([this.ema(prices, 12) - this.ema(prices, 26)], 9),
      macd_histogram: (this.ema(prices, 12) - this.ema(prices, 26)) - this.ema([this.ema(prices, 12) - this.ema(prices, 26)], 9),
      bb_upper: this.sma(prices, 20) + (2 * this.stddev(prices, 20)),
      bb_middle: this.sma(prices, 20),
      bb_lower: this.sma(prices, 20) - (2 * this.stddev(prices, 20)),
      bb_width: (2 * this.stddev(prices, 20)) / this.sma(prices, 20),
      stoch_k: this.stochasticK(highs, lows, closes, 14),
      stoch_d: this.sma([this.stochasticK(highs, lows, closes, 14)], 3),
      atr_14: this.atr(highs, lows, closes, 14),
      adx_14: this.adx(highs, lows, closes, 14),
      cci_20: this.cci(highs, lows, closes, 20),
      williams_r: this.williamsR(highs, lows, closes, 14),
    };
  }

  // Calculate market microstructure features
  private static calculateMarketMicrostructure(data: any[]): MarketMicrostructure {
    const latest = data[0];
    const bid = Number(latest.bid || latest.price * 0.999);
    const ask = Number(latest.ask || latest.price * 1.001);
    const price = Number(latest.price);
    const volume = Number(latest.volume);

    return {
      bid_ask_spread: ask - bid,
      bid_ask_ratio: bid / ask,
      volume_weighted_price: this.vwap(data),
      price_impact: Math.abs(price - this.vwap(data)) / this.vwap(data),
      order_flow_imbalance: Math.random() - 0.5, // Placeholder
      tick_direction: data.length > 1 ? Math.sign(Number(data[0].price) - Number(data[1].price)) : 0,
      volume_profile: this.calculateVolumeProfile(data),
      support_resistance: this.calculateSupportResistance(data),
    };
  }

  // Calculate volatility metrics
  private static calculateVolatilityMetrics(data: any[]): VolatilityMetrics {
    const prices = data.map(d => Number(d.price));
    const returns = this.calculateReturns(prices);

    return {
      realized_volatility: this.stddev(returns, returns.length) * Math.sqrt(24), // Annualized
      garch_volatility: this.garchVolatility(returns),
      parkinson_volatility: this.parkinsonVolatility(data),
      garman_klass_volatility: this.garmanKlassVolatility(data),
      volatility_of_volatility: this.volatilityOfVolatility(returns),
      volatility_skew: this.skewness(returns),
      volatility_smile: this.calculateVolatilitySmile(data),
    };
  }

  // Calculate correlation data
  private static calculateCorrelationData(data: any[]) {
    const prices = data.map(d => Number(d.price));
    const volumes = data.map(d => Number(d.volume));

    return {
      price_volume_correlation: this.correlation(prices, volumes),
      autocorrelation_1: this.autocorrelation(prices, 1),
      autocorrelation_5: this.autocorrelation(prices, 5),
      autocorrelation_24: this.autocorrelation(prices, 24),
    };
  }

  // Helper functions for technical indicators
  private static sma(values: number[], period: number): number {
    if (values.length < period) return values[values.length - 1] || 0;
    const slice = values.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  private static ema(values: number[], period: number): number {
    if (values.length === 0) return 0;
    if (values.length === 1) return values[0];
    
    const multiplier = 2 / (period + 1);
    let ema = values[0];
    
    for (let i = 1; i < values.length; i++) {
      ema = (values[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private static rsi(values: number[], period: number): number {
    if (values.length < period + 1) return 50;
    
    const changes = [];
    for (let i = 1; i < values.length; i++) {
      changes.push(values[i] - values[i - 1]);
    }
    
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? -change : 0);
    
    const avgGain = this.sma(gains, period);
    const avgLoss = this.sma(losses, period);
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private static stddev(values: number[], period: number): number {
    if (values.length < period) return 0;
    
    const slice = values.slice(-period);
    const mean = slice.reduce((sum, val) => sum + val, 0) / period;
    const squaredDiffs = slice.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
    
    return Math.sqrt(variance);
  }

  private static stochasticK(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < period) return 50;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    if (highestHigh === lowestLow) return 50;
    
    return ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  private static atr(highs: number[], lows: number[], closes: number[], period: number): number {
    if (closes.length < 2) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < closes.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.sma(trueRanges, Math.min(period, trueRanges.length));
  }

  // Additional helper functions (simplified implementations)
  private static adx(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified ADX calculation
    return Math.random() * 100; // Placeholder
  }

  private static cci(highs: number[], lows: number[], closes: number[], period: number): number {
    // Simplified CCI calculation
    return (Math.random() - 0.5) * 400; // Placeholder
  }

  private static williamsR(highs: number[], lows: number[], closes: number[], period: number): number {
    const stochK = this.stochasticK(highs, lows, closes, period);
    return stochK - 100;
  }

  private static calculateMomentum(data: any[], hours: number): number {
    if (data.length < hours + 1) return 0;
    const current = Number(data[0].price);
    const previous = Number(data[hours].price);
    return (current - previous) / previous;
  }

  private static calculateVolumeMomentum(data: any[], hours: number): number {
    if (data.length < hours + 1) return 0;
    const current = Number(data[0].volume);
    const previous = Number(data[hours].volume);
    return (current - previous) / previous;
  }

  private static calculateAcceleration(data: any[]): number {
    if (data.length < 3) return 0;
    const prices = data.slice(0, 3).map(d => Number(d.price));
    const velocity1 = prices[0] - prices[1];
    const velocity2 = prices[1] - prices[2];
    return velocity1 - velocity2;
  }

  private static calculateVolumeAcceleration(data: any[]): number {
    if (data.length < 3) return 0;
    const volumes = data.slice(0, 3).map(d => Number(d.volume));
    const velocity1 = volumes[0] - volumes[1];
    const velocity2 = volumes[1] - volumes[2];
    return velocity1 - velocity2;
  }

  private static calculateTrendStrength(data: any[]): number {
    if (data.length < 20) return 0;
    const prices = data.slice(0, 20).map(d => Number(d.price));
    const sma20 = this.sma(prices, 20);
    const currentPrice = prices[0];
    return Math.abs(currentPrice - sma20) / sma20;
  }

  private static identifyMarketRegime(data: any[]): string {
    if (data.length < 50) return 'unknown';
    
    const prices = data.slice(0, 50).map(d => Number(d.price));
    const volatility = this.stddev(prices, 20);
    const trend = this.calculateMomentum(data, 24);
    
    if (volatility > 0.05) return 'high_volatility';
    if (Math.abs(trend) > 0.1) return trend > 0 ? 'trending_up' : 'trending_down';
    return 'sideways';
  }

  private static vwap(data: any[]): number {
    let totalVolume = 0;
    let totalVolumePrice = 0;
    
    for (const item of data) {
      const price = Number(item.price);
      const volume = Number(item.volume);
      totalVolumePrice += price * volume;
      totalVolume += volume;
    }
    
    return totalVolume > 0 ? totalVolumePrice / totalVolume : 0;
  }

  private static calculateVolumeProfile(data: any[]): number[] {
    // Simplified volume profile calculation
    return data.slice(0, 10).map(d => Number(d.volume));
  }

  private static calculateSupportResistance(data: any[]): { support: number; resistance: number } {
    const prices = data.map(d => Number(d.price));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    return {
      support: minPrice,
      resistance: maxPrice,
    };
  }

  private static calculateReturns(prices: number[]): number[] {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private static garchVolatility(returns: number[]): number {
    // Simplified GARCH volatility
    return this.stddev(returns, returns.length);
  }

  private static parkinsonVolatility(data: any[]): number {
    // Simplified Parkinson volatility
    let sum = 0;
    for (const item of data) {
      const high = Number(item.high24h || item.price * 1.02);
      const low = Number(item.low24h || item.price * 0.98);
      sum += Math.pow(Math.log(high / low), 2);
    }
    return Math.sqrt(sum / data.length);
  }

  private static garmanKlassVolatility(data: any[]): number {
    // Simplified Garman-Klass volatility
    return this.parkinsonVolatility(data) * 0.8; // Approximation
  }

  private static volatilityOfVolatility(returns: number[]): number {
    const volatilities = [];
    const windowSize = 10;
    
    for (let i = windowSize; i < returns.length; i++) {
      const window = returns.slice(i - windowSize, i);
      volatilities.push(this.stddev(window, windowSize));
    }
    
    return this.stddev(volatilities, volatilities.length);
  }

  private static skewness(values: number[]): number {
    const n = values.length;
    if (n < 3) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    const skew = values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n;
    return skew;
  }

  private static calculateVolatilitySmile(data: any[]): number[] {
    // Simplified volatility smile calculation
    return [0.15, 0.18, 0.20, 0.18, 0.15]; // Placeholder
  }

  private static correlation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n < 2) return 0;
    
    const xSlice = x.slice(0, n);
    const ySlice = y.slice(0, n);
    
    const meanX = xSlice.reduce((sum, val) => sum + val, 0) / n;
    const meanY = ySlice.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let sumXSquared = 0;
    let sumYSquared = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = xSlice[i] - meanX;
      const yDiff = ySlice[i] - meanY;
      numerator += xDiff * yDiff;
      sumXSquared += xDiff * xDiff;
      sumYSquared += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(sumXSquared * sumYSquared);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  private static autocorrelation(values: number[], lag: number): number {
    if (values.length < lag + 1) return 0;
    
    const x = values.slice(0, -lag);
    const y = values.slice(lag);
    
    return this.correlation(x, y);
  }

  // Get features for symbol and timestamp
  static async getFeatures(symbol: string, timestamp: Date): Promise<MLFeature | null> {
    const [feature] = await db
      .select()
      .from(mlFeatures)
      .where(and(
        eq(mlFeatures.symbol, symbol),
        eq(mlFeatures.timestamp, timestamp)
      ));
    
    return feature || null;
  }

  // Get latest features for symbol
  static async getLatestFeatures(symbol: string): Promise<MLFeature | null> {
    const [feature] = await db
      .select()
      .from(mlFeatures)
      .where(eq(mlFeatures.symbol, symbol))
      .orderBy(desc(mlFeatures.timestamp))
      .limit(1);
    
    return feature || null;
  }

  // Bulk create features for multiple symbols
  static async bulkCreateFeatures(
    symbols: string[],
    timestamp: Date,
    lookbackPeriods: number = 100
  ): Promise<MLFeature[]> {
    const features = [];
    
    for (const symbol of symbols) {
      try {
        const feature = await this.createFeatureSet(symbol, timestamp, lookbackPeriods);
        features.push(feature);
      } catch (error) {
        console.error(`Failed to create features for ${symbol}:`, error);
      }
    }
    
    return features;
  }

  // Clean old features
  static async cleanOldFeatures(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    const deleted = await db
      .delete(mlFeatures)
      .where(lte(mlFeatures.timestamp, cutoffDate))
      .returning({ id: mlFeatures.id });
    
    return deleted.length;
  }
}
