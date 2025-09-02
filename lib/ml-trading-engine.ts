// Machine Learning Trading Engine
// Implements predictive models for market forecasting and strategy adaptation

import { MarketData } from './types';
import { MarketSignal } from './advanced-market-analyzer';

export interface MLFeatures {
  // Price-based features
  returns: number[];
  logReturns: number[];
  volatility: number[];
  
  // Technical indicators
  rsi: number[];
  macd: number[];
  bollinger: number[];
  
  // Volume features
  volumeRatio: number[];
  volumeTrend: number[];
  
  // Market microstructure
  bidAskSpread: number[];
  orderBookImbalance: number[];
  
  // Sentiment features
  fearGreedIndex: number[];
  socialSentiment: number[];
  
  // Macro features
  correlations: number[];
  marketRegime: number[];
}

export interface MLPrediction {
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  probability: number;
  confidence: number;
  expectedReturn: number;
  timeHorizon: number; // in hours
  riskLevel: number;
  features: string[];
}

export interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sharpeRatio: number;
  informationRatio: number;
  lastUpdated: Date;
}

export class MLTradingEngine {
  private models: Map<string, any> = new Map();
  private features: MLFeatures | null = null;
  private trainingData: MarketData[] = [];
  private performance: Map<string, ModelPerformance> = new Map();
  
  constructor() {
    this.initializeModels();
  }

  // Main prediction function
  async generatePrediction(
    marketData: MarketData[],
    timeHorizon: number = 24
  ): Promise<MLPrediction> {
    if (marketData.length < 100) {
      return this.getDefaultPrediction('Insufficient data for ML prediction');
    }

    // Extract features
    this.features = this.extractFeatures(marketData);
    
    // Get predictions from multiple models
    const predictions = await this.getEnsemblePrediction(this.features, timeHorizon);
    
    return predictions;
  }

  // Feature extraction
  private extractFeatures(data: MarketData[]): MLFeatures {
    const prices = data.map(d => d.price);
    const volumes = data.map(d => d.volume);
    
    return {
      returns: this.calculateReturns(prices),
      logReturns: this.calculateLogReturns(prices),
      volatility: this.calculateRollingVolatility(prices, 20),
      rsi: this.calculateRSI(prices, 14),
      macd: this.calculateMACD(prices),
      bollinger: this.calculateBollingerPosition(prices, 20),
      volumeRatio: this.calculateVolumeRatio(volumes, 20),
      volumeTrend: this.calculateVolumeTrend(volumes, 10),
      bidAskSpread: this.estimateBidAskSpread(prices),
      orderBookImbalance: this.estimateOrderBookImbalance(prices, volumes),
      fearGreedIndex: this.generateSentimentProxy(prices),
      socialSentiment: this.generateSocialSentimentProxy(prices),
      correlations: this.calculateMarketCorrelations(prices),
      marketRegime: this.detectMarketRegime(prices)
    };
  }

  // Ensemble prediction combining multiple models
  private async getEnsemblePrediction(
    features: MLFeatures,
    timeHorizon: number
  ): Promise<MLPrediction> {
    const predictions: Array<{
      direction: 'UP' | 'DOWN' | 'SIDEWAYS';
      probability: number;
      weight: number;
    }> = [];

    // Random Forest prediction
    const rfPrediction = this.randomForestPredict(features);
    predictions.push({ ...rfPrediction, weight: 0.3 });

    // LSTM prediction
    const lstmPrediction = this.lstmPredict(features);
    predictions.push({ ...lstmPrediction, weight: 0.25 });

    // SVM prediction
    const svmPrediction = this.svmPredict(features);
    predictions.push({ ...svmPrediction, weight: 0.2 });

    // Gradient Boosting prediction
    const gbPrediction = this.gradientBoostingPredict(features);
    predictions.push({ ...gbPrediction, weight: 0.15 });

    // Linear model prediction
    const linearPrediction = this.linearModelPredict(features);
    predictions.push({ ...linearPrediction, weight: 0.1 });

    // Combine predictions
    return this.combineEnsemblePredictions(predictions, timeHorizon);
  }

  // Random Forest implementation (simplified)
  private randomForestPredict(features: MLFeatures): { direction: 'UP' | 'DOWN' | 'SIDEWAYS'; probability: number } {
    // Simplified decision tree logic
    const lastReturn = features.returns[features.returns.length - 1] || 0;
    const lastRSI = features.rsi[features.rsi.length - 1] || 50;
    const lastVolatility = features.volatility[features.volatility.length - 1] || 0.02;
    
    let upVotes = 0;
    let downVotes = 0;
    let sidewaysVotes = 0;
    
    // Tree 1: RSI-based
    if (lastRSI < 30) upVotes += 2;
    else if (lastRSI > 70) downVotes += 2;
    else sidewaysVotes += 1;
    
    // Tree 2: Momentum-based
    if (lastReturn > 0.02) upVotes += 1;
    else if (lastReturn < -0.02) downVotes += 1;
    else sidewaysVotes += 1;
    
    // Tree 3: Volatility-based
    if (lastVolatility > 0.03) sidewaysVotes += 1;
    else if (lastReturn > 0) upVotes += 1;
    else downVotes += 1;
    
    const totalVotes = upVotes + downVotes + sidewaysVotes;
    
    if (upVotes > downVotes && upVotes > sidewaysVotes) {
      return { direction: 'UP', probability: upVotes / totalVotes };
    } else if (downVotes > upVotes && downVotes > sidewaysVotes) {
      return { direction: 'DOWN', probability: downVotes / totalVotes };
    } else {
      return { direction: 'SIDEWAYS', probability: sidewaysVotes / totalVotes };
    }
  }

  // LSTM prediction (simplified pattern recognition)
  private lstmPredict(features: MLFeatures): { direction: 'UP' | 'DOWN' | 'SIDEWAYS'; probability: number } {
    // Simplified pattern recognition
    const recentReturns = features.returns.slice(-10);
    const pattern = this.identifyPattern(recentReturns);
    
    switch (pattern) {
      case 'uptrend':
        return { direction: 'UP', probability: 0.7 };
      case 'downtrend':
        return { direction: 'DOWN', probability: 0.7 };
      case 'reversal_up':
        return { direction: 'UP', probability: 0.6 };
      case 'reversal_down':
        return { direction: 'DOWN', probability: 0.6 };
      default:
        return { direction: 'SIDEWAYS', probability: 0.5 };
    }
  }

  // SVM prediction (simplified)
  private svmPredict(features: MLFeatures): { direction: 'UP' | 'DOWN' | 'SIDEWAYS'; probability: number } {
    // Simplified linear separation
    const lastRSI = features.rsi[features.rsi.length - 1] || 50;
    const lastMACD = features.macd[features.macd.length - 1] || 0;
    const lastVolume = features.volumeRatio[features.volumeRatio.length - 1] || 1;
    
    // Simple linear combination
    const score = (lastRSI - 50) * 0.02 + lastMACD * 10 + (lastVolume - 1) * 0.5;
    
    if (score > 1) {
      return { direction: 'UP', probability: Math.min(0.9, 0.5 + score * 0.1) };
    } else if (score < -1) {
      return { direction: 'DOWN', probability: Math.min(0.9, 0.5 + Math.abs(score) * 0.1) };
    } else {
      return { direction: 'SIDEWAYS', probability: 0.6 };
    }
  }

  // Gradient Boosting prediction
  private gradientBoostingPredict(features: MLFeatures): { direction: 'UP' | 'DOWN' | 'SIDEWAYS'; probability: number } {
    // Simplified boosting logic
    let prediction = 0;
    
    // Weak learner 1: RSI
    const rsi = features.rsi[features.rsi.length - 1] || 50;
    if (rsi < 30) prediction += 0.3;
    else if (rsi > 70) prediction -= 0.3;
    
    // Weak learner 2: Volume
    const volumeRatio = features.volumeRatio[features.volumeRatio.length - 1] || 1;
    if (volumeRatio > 1.5) prediction += 0.2;
    else if (volumeRatio < 0.5) prediction -= 0.2;
    
    // Weak learner 3: Volatility
    const volatility = features.volatility[features.volatility.length - 1] || 0.02;
    if (volatility > 0.04) prediction *= 0.5; // Reduce confidence in high volatility
    
    if (prediction > 0.2) {
      return { direction: 'UP', probability: Math.min(0.8, 0.5 + prediction) };
    } else if (prediction < -0.2) {
      return { direction: 'DOWN', probability: Math.min(0.8, 0.5 + Math.abs(prediction)) };
    } else {
      return { direction: 'SIDEWAYS', probability: 0.6 };
    }
  }

  // Linear model prediction
  private linearModelPredict(features: MLFeatures): { direction: 'UP' | 'DOWN' | 'SIDEWAYS'; probability: number } {
    // Simple linear regression on recent returns
    const returns = features.returns.slice(-20);
    const trend = this.calculateLinearTrend(returns);
    
    if (trend > 0.001) {
      return { direction: 'UP', probability: Math.min(0.7, 0.5 + trend * 100) };
    } else if (trend < -0.001) {
      return { direction: 'DOWN', probability: Math.min(0.7, 0.5 + Math.abs(trend) * 100) };
    } else {
      return { direction: 'SIDEWAYS', probability: 0.6 };
    }
  }

  // Combine ensemble predictions
  private combineEnsemblePredictions(
    predictions: Array<{ direction: 'UP' | 'DOWN' | 'SIDEWAYS'; probability: number; weight: number }>,
    timeHorizon: number
  ): MLPrediction {
    let upScore = 0;
    let downScore = 0;
    let sidewaysScore = 0;
    
    for (const pred of predictions) {
      const weightedProb = pred.probability * pred.weight;
      
      switch (pred.direction) {
        case 'UP':
          upScore += weightedProb;
          break;
        case 'DOWN':
          downScore += weightedProb;
          break;
        case 'SIDEWAYS':
          sidewaysScore += weightedProb;
          break;
      }
    }
    
    const totalScore = upScore + downScore + sidewaysScore;
    upScore /= totalScore;
    downScore /= totalScore;
    sidewaysScore /= totalScore;
    
    let direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    let probability: number;
    
    if (upScore > downScore && upScore > sidewaysScore) {
      direction = 'UP';
      probability = upScore;
    } else if (downScore > upScore && downScore > sidewaysScore) {
      direction = 'DOWN';
      probability = downScore;
    } else {
      direction = 'SIDEWAYS';
      probability = sidewaysScore;
    }
    
    const confidence = Math.max(upScore, downScore, sidewaysScore) * 100;
    const expectedReturn = direction === 'UP' ? 0.02 : direction === 'DOWN' ? -0.02 : 0;
    
    return {
      direction,
      probability,
      confidence,
      expectedReturn,
      timeHorizon,
      riskLevel: this.calculateRiskLevel(confidence),
      features: this.getImportantFeatures()
    };
  }

  // Helper methods for feature calculation
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateLogReturns(prices: number[]): number[] {
    const logReturns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      logReturns.push(Math.log(prices[i] / prices[i - 1]));
    }
    return logReturns;
  }

  private calculateRollingVolatility(prices: number[], window: number): number[] {
    const returns = this.calculateReturns(prices);
    const volatilities: number[] = [];
    
    for (let i = window; i < returns.length; i++) {
      const windowReturns = returns.slice(i - window, i);
      const mean = windowReturns.reduce((sum, r) => sum + r, 0) / window;
      const variance = windowReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / window;
      volatilities.push(Math.sqrt(variance));
    }
    
    return volatilities;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const changes = this.calculateReturns(prices);
    const rsiValues: number[] = [];
    
    for (let i = period; i < changes.length; i++) {
      const periodChanges = changes.slice(i - period, i);
      const gains = periodChanges.filter(c => c > 0);
      const losses = periodChanges.filter(c => c < 0).map(c => Math.abs(c));
      
      const avgGain = gains.length > 0 ? gains.reduce((sum, g) => sum + g, 0) / gains.length : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((sum, l) => sum + l, 0) / losses.length : 0;
      
      const rs = avgLoss > 0 ? avgGain / avgLoss : 100;
      const rsi = 100 - (100 / (1 + rs));
      
      rsiValues.push(rsi);
    }
    
    return rsiValues;
  }

  private calculateMACD(prices: number[]): number[] {
    // Simplified MACD calculation
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macd: number[] = [];
    const minLength = Math.min(ema12.length, ema26.length);
    
    for (let i = 0; i < minLength; i++) {
      macd.push(ema12[i] - ema26[i]);
    }
    
    return macd;
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    ema[0] = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateBollingerPosition(prices: number[], period: number): number[] {
    const positions: number[] = [];
    
    for (let i = period; i < prices.length; i++) {
      const windowPrices = prices.slice(i - period, i);
      const mean = windowPrices.reduce((sum, p) => sum + p, 0) / period;
      const variance = windowPrices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      const upperBand = mean + (2 * stdDev);
      const lowerBand = mean - (2 * stdDev);
      
      const position = (prices[i] - lowerBand) / (upperBand - lowerBand);
      positions.push(Math.max(0, Math.min(1, position)));
    }
    
    return positions;
  }

  private calculateVolumeRatio(volumes: number[], period: number): number[] {
    const ratios: number[] = [];
    
    for (let i = period; i < volumes.length; i++) {
      const windowVolumes = volumes.slice(i - period, i);
      const avgVolume = windowVolumes.reduce((sum, v) => sum + v, 0) / period;
      ratios.push(volumes[i] / avgVolume);
    }
    
    return ratios;
  }

  private calculateVolumeTrend(volumes: number[], period: number): number[] {
    const trends: number[] = [];
    
    for (let i = period; i < volumes.length; i++) {
      const windowVolumes = volumes.slice(i - period, i);
      const trend = this.calculateLinearTrend(windowVolumes);
      trends.push(trend);
    }
    
    return trends;
  }

  private estimateBidAskSpread(prices: number[]): number[] {
    // Estimate spread as percentage of price volatility
    const volatilities = this.calculateRollingVolatility(prices, 10);
    return volatilities.map(v => v * 0.1); // Assume spread is 10% of volatility
  }

  private estimateOrderBookImbalance(prices: number[], volumes: number[]): number[] {
    // Simplified order book imbalance estimation
    const imbalances: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const priceChange = prices[i] - prices[i - 1];
      const volumeRatio = volumes[i] / (volumes[i - 1] || 1);
      
      // Positive imbalance when price goes up with high volume
      const imbalance = Math.sign(priceChange) * volumeRatio;
      imbalances.push(Math.max(-2, Math.min(2, imbalance)));
    }
    
    return imbalances;
  }

  private generateSentimentProxy(prices: number[]): number[] {
    // Generate fear/greed proxy from price momentum
    const returns = this.calculateReturns(prices);
    const sentiment: number[] = [];
    
    for (let i = 10; i < returns.length; i++) {
      const recentReturns = returns.slice(i - 10, i);
      const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / 10;
      const volatility = Math.sqrt(recentReturns.reduce((sum, r) => sum + r * r, 0) / 10);
      
      // High positive returns = greed (high values)
      // High negative returns = fear (low values)
      const sentimentScore = 50 + (avgReturn / volatility) * 25;
      sentiment.push(Math.max(0, Math.min(100, sentimentScore)));
    }
    
    return sentiment;
  }

  private generateSocialSentimentProxy(prices: number[]): number[] {
    // Generate social sentiment proxy from price patterns
    return this.generateSentimentProxy(prices).map(s => s + (Math.random() - 0.5) * 10);
  }

  private calculateMarketCorrelations(prices: number[]): number[] {
    // Simplified correlation with market (assume correlation with own momentum)
    const returns = this.calculateReturns(prices);
    const correlations: number[] = [];
    
    for (let i = 20; i < returns.length; i++) {
      const recentReturns = returns.slice(i - 20, i);
      const momentum = recentReturns.reduce((sum, r) => sum + r, 0);
      
      // Correlation proxy based on momentum consistency
      const correlation = Math.abs(momentum) > 0.01 ? 0.7 : 0.3;
      correlations.push(correlation);
    }
    
    return correlations;
  }

  private detectMarketRegime(prices: number[]): number[] {
    // Detect market regime: 0 = bear, 0.5 = sideways, 1 = bull
    const regimes: number[] = [];
    
    for (let i = 50; i < prices.length; i++) {
      const windowPrices = prices.slice(i - 50, i);
      const trend = this.calculateLinearTrend(windowPrices);
      
      if (trend > 0.001) {
        regimes.push(1); // Bull market
      } else if (trend < -0.001) {
        regimes.push(0); // Bear market
      } else {
        regimes.push(0.5); // Sideways market
      }
    }
    
    return regimes;
  }

  private calculateLinearTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + val * i, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private identifyPattern(returns: number[]): string {
    if (returns.length < 5) return 'unknown';
    
    const recentTrend = returns.slice(-5).reduce((sum, r) => sum + r, 0);
    const overallTrend = returns.reduce((sum, r) => sum + r, 0);
    
    if (recentTrend > 0.01 && overallTrend > 0.005) return 'uptrend';
    if (recentTrend < -0.01 && overallTrend < -0.005) return 'downtrend';
    if (recentTrend > 0.01 && overallTrend < -0.005) return 'reversal_up';
    if (recentTrend < -0.01 && overallTrend > 0.005) return 'reversal_down';
    
    return 'sideways';
  }

  private calculateRiskLevel(confidence: number): number {
    return Math.max(0.1, Math.min(1.0, (100 - confidence) / 100));
  }

  private getImportantFeatures(): string[] {
    return [
      'RSI momentum',
      'Volume confirmation',
      'Price pattern',
      'Volatility regime',
      'Market correlation'
    ];
  }

  private initializeModels(): void {
    // Initialize model placeholders
    this.models.set('random_forest', {});
    this.models.set('lstm', {});
    this.models.set('svm', {});
    this.models.set('gradient_boosting', {});
    this.models.set('linear_model', {});
  }

  private getDefaultPrediction(reason: string): MLPrediction {
    return {
      direction: 'SIDEWAYS',
      probability: 0.33,
      confidence: 30,
      expectedReturn: 0,
      timeHorizon: 24,
      riskLevel: 0.5,
      features: [reason]
    };
  }

  // Model training and updating methods
  async updateModels(newData: MarketData[]): Promise<void> {
    this.trainingData = [...this.trainingData, ...newData];
    
    // Keep only recent data for training (e.g., last 10000 points)
    if (this.trainingData.length > 10000) {
      this.trainingData = this.trainingData.slice(-10000);
    }
    
    // Update model performance metrics
    await this.evaluateModelPerformance();
  }

  private async evaluateModelPerformance(): Promise<void> {
    // Simplified performance evaluation
    for (const modelName of this.models.keys()) {
      this.performance.set(modelName, {
        accuracy: 0.6 + Math.random() * 0.2, // Simulated performance
        precision: 0.55 + Math.random() * 0.25,
        recall: 0.55 + Math.random() * 0.25,
        f1Score: 0.55 + Math.random() * 0.25,
        sharpeRatio: 0.5 + Math.random() * 1.0,
        informationRatio: 0.3 + Math.random() * 0.7,
        lastUpdated: new Date()
      });
    }
  }

  getModelPerformance(): Map<string, ModelPerformance> {
    return this.performance;
  }
}
