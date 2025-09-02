// Enhanced Trading Analysis API
// Integrates all profit-focused components for comprehensive market analysis

import { type NextRequest, NextResponse } from "next/server";
import { AdvancedMarketAnalyzer } from '@/lib/advanced-market-analyzer';
import { MLTradingEngine } from '@/lib/ml-trading-engine';
import { EnhancedStrategyEngine } from '@/lib/enhanced-strategy-engine';
import { ProfitOptimizer } from '@/lib/profit-optimizer';
import { withPerformanceMonitoring, trackDatabaseQuery, trackExternalAPICall } from '@/lib/monitoring/performance-middleware';

export const POST = withPerformanceMonitoring(
  async (request: NextRequest) => {
    try {
      const { marketData, symbol, timeframe, riskProfile, balance } = await request.json();

    if (!marketData || marketData.length < 50) {
      return NextResponse.json(
        { error: 'Insufficient market data for analysis (minimum 50 data points required)' },
        { status: 400 }
      );
    }

    // Initialize enhanced analysis engines
    const marketAnalyzer = new AdvancedMarketAnalyzer();
    const mlEngine = new MLTradingEngine();
    const strategyEngine = new EnhancedStrategyEngine(null as any);
    
    // Initialize profit optimizer
    const optimizerConfig = {
      maxPositionSize: riskProfile?.maxPositionSize || 0.1,
      riskPerTrade: riskProfile?.riskPerTrade || 0.02,
      profitTarget: riskProfile?.profitTarget || 0.15,
      maxDrawdown: riskProfile?.maxDrawdown || 0.15,
      adaptiveSizing: true,
      dynamicStops: true,
      trailingStops: true,
      partialProfitTaking: true
    };
    
    const profitOptimizer = new ProfitOptimizer(
      optimizerConfig,
      null as any,
      balance || 10000
    );

    // 1. Advanced Market Analysis
    const marketSignal = await marketAnalyzer.analyzeMarket(marketData, undefined, timeframe);

    // 2. Machine Learning Prediction
    const mlPrediction = await mlEngine.generatePrediction(marketData, 24);

    // 3. Strategy Analysis
    const strategies = {
      momentum: strategyEngine.createAdvancedMomentumStrategy(),
      meanReversion: strategyEngine.createDynamicMeanReversionStrategy(),
      breakout: strategyEngine.createVolumeBreakoutStrategy()
    };

    const strategySignals = {
      momentum: strategies.momentum.run({
        prices: marketData.map((d: any) => d.price),
        volumes: marketData.map((d: any) => d.volume || 1000000),
        timeframe
      }),
      meanReversion: strategies.meanReversion.run({
        prices: marketData.map((d: any) => d.price),
        volumes: marketData.map((d: any) => d.volume || 1000000)
      }),
      breakout: strategies.breakout.run({
        prices: marketData.map((d: any) => d.price),
        volumes: marketData.map((d: any) => d.volume || 1000000)
      })
    };

    // 4. Combine all signals for optimal trading decision
    const combinedAnalysis = combineAnalysisResults(
      marketSignal,
      mlPrediction,
      strategySignals,
      marketData
    );

    // 5. Profit Optimization
    const currentPrice = marketData[marketData.length - 1].price;
    const volatility = calculateVolatility(marketData.map((d: any) => d.price));
    
    // Calculate optimal position size
    const optimalPositionSize = profitOptimizer.calculateDynamicPositionSize(
      combinedAnalysis as any,
      volatility
    );

    // Calculate adaptive stop loss
    const atr = calculateATR(marketData.map((d: any) => d.price));
    const adaptiveStopLoss = profitOptimizer.calculateAdaptiveStopLoss(
      combinedAnalysis as any,
      currentPrice,
      atr,
      volatility
    );

    // Calculate partial profit levels
    const partialProfitLevels = profitOptimizer.calculatePartialProfitLevels(
      combinedAnalysis as any
    );

    // 6. Risk Assessment
    const riskMetrics = calculateRiskMetrics(
      combinedAnalysis,
      volatility,
      marketSignal,
      mlPrediction
    );

    // 7. Performance Projections
    const performanceProjection = calculatePerformanceProjection(
      combinedAnalysis,
      riskMetrics,
      optimalPositionSize
    );

    // 8. Generate comprehensive response
    const response = {
      timestamp: new Date().toISOString(),
      symbol: symbol || 'BTC-USD',
      timeframe: timeframe || '1h',
      
      // Primary Trading Signal
      signal: combinedAnalysis.action,
      confidence: combinedAnalysis.confidence,
      strength: combinedAnalysis.strength,
      
      // Market Analysis
      marketAnalysis: {
        signal: marketSignal.signal,
        technicalScore: marketSignal.technicalScore,
        momentumScore: marketSignal.momentumScore,
        volatilityScore: marketSignal.volatilityScore,
        volumeScore: marketSignal.volumeScore,
        riskLevel: marketSignal.riskLevel,
        marketRegime: marketSignal.reasoning.includes('trending') ? 'trending' : 
                     marketSignal.reasoning.includes('ranging') ? 'ranging' : 'volatile'
      },
      
      // ML Prediction
      mlPrediction: {
        direction: mlPrediction.direction,
        probability: mlPrediction.probability,
        confidence: mlPrediction.confidence,
        expectedReturn: mlPrediction.expectedReturn,
        timeHorizon: mlPrediction.timeHorizon,
        features: mlPrediction.features
      },
      
      // Strategy Signals
      strategies: {
        momentum: {
          signal: strategySignals.momentum.action,
          confidence: strategySignals.momentum.confidence,
          details: strategySignals.momentum.details
        },
        meanReversion: {
          signal: strategySignals.meanReversion.action,
          confidence: strategySignals.meanReversion.confidence,
          details: strategySignals.meanReversion.details
        },
        breakout: {
          signal: strategySignals.breakout.action,
          confidence: strategySignals.breakout.confidence,
          details: strategySignals.breakout.details
        }
      },
      
      // Profit Optimization
      profitOptimization: {
        optimalPositionSize: optimalPositionSize,
        entryPrice: currentPrice,
        stopLoss: adaptiveStopLoss,
        takeProfit: combinedAnalysis.takeProfit,
        riskRewardRatio: combinedAnalysis.riskReward,
        partialProfitLevels: partialProfitLevels,
        maxRisk: (Math.abs(currentPrice - adaptiveStopLoss) / currentPrice) * optimalPositionSize,
        expectedProfit: combinedAnalysis.expectedReturn * optimalPositionSize
      },
      
      // Risk Assessment
      riskAssessment: riskMetrics,
      
      // Performance Projection
      performanceProjection: performanceProjection,
      
      // Market Conditions
      marketConditions: {
        currentPrice: currentPrice,
        volatility: volatility,
        atr: atr,
        volume: marketData[marketData.length - 1].volume || 0,
        trend: determineTrend(marketData),
        support: findSupport(marketData.map((d: any) => d.price)),
        resistance: findResistance(marketData.map((d: any) => d.price))
      },
      
      // Reasoning
      reasoning: generateComprehensiveReasoning(
        marketSignal,
        mlPrediction,
        strategySignals,
        combinedAnalysis
      )
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Enhanced analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to perform enhanced analysis' },
      { status: 500 }
    );
  }
},
{
  endpoint: '/api/trading/enhanced-analysis',
  isCritical: true,
  isTradingEndpoint: true,
  operation: 'SIGNAL_GENERATION'
}
)

function combineAnalysisResults(
  marketSignal: any,
  mlPrediction: any,
  strategySignals: any,
  marketData: any[]
): any {
  // Weighted scoring system
  const weights = {
    market: 0.35,
    ml: 0.25,
    momentum: 0.15,
    meanReversion: 0.15,
    breakout: 0.10
  };

  let buyScore = 0;
  let sellScore = 0;
  let totalConfidence = 0;

  // Market signal contribution
  if (marketSignal.signal === 'BUY') {
    buyScore += weights.market * (marketSignal.confidence / 100);
  } else if (marketSignal.signal === 'SELL') {
    sellScore += weights.market * (marketSignal.confidence / 100);
  }
  totalConfidence += weights.market * (marketSignal.confidence / 100);

  // ML prediction contribution
  if (mlPrediction.direction === 'UP') {
    buyScore += weights.ml * mlPrediction.probability;
  } else if (mlPrediction.direction === 'DOWN') {
    sellScore += weights.ml * mlPrediction.probability;
  }
  totalConfidence += weights.ml * (mlPrediction.confidence / 100);

  // Strategy signals contribution
  const strategyWeights = [weights.momentum, weights.meanReversion, weights.breakout];
  const strategies = [strategySignals.momentum, strategySignals.meanReversion, strategySignals.breakout];
  
  strategies.forEach((signal, index) => {
    const weight = strategyWeights[index];
    const confidence = signal.confidence || 0;
    
    if (signal.action === 'buy') {
      buyScore += weight * (confidence / 100);
    } else if (signal.action === 'sell') {
      sellScore += weight * (confidence / 100);
    }
    totalConfidence += weight * (confidence / 100);
  });

  // Determine final signal
  let action = 'HOLD';
  let confidence = 50;
  let strength = 0;

  if (buyScore > sellScore && buyScore > 0.4) {
    action = 'BUY';
    confidence = Math.min(95, buyScore * 100);
    strength = Math.min(100, (buyScore - sellScore) * 150);
  } else if (sellScore > buyScore && sellScore > 0.4) {
    action = 'SELL';
    confidence = Math.min(95, sellScore * 100);
    strength = Math.min(100, (sellScore - buyScore) * 150);
  } else {
    confidence = Math.max(30, totalConfidence * 60);
    strength = Math.abs(buyScore - sellScore) * 100;
  }

  // Calculate position parameters
  const currentPrice = marketData[marketData.length - 1].price;
  const volatility = calculateVolatility(marketData.map((d: any) => d.price));
  const atr = calculateATR(marketData.map((d: any) => d.price));
  
  const stopLossDistance = Math.max(currentPrice * 0.02, atr * 2);
  const takeProfitDistance = stopLossDistance * 2.5; // 2.5:1 risk-reward

  return {
    action,
    confidence,
    strength,
    entryPrice: currentPrice,
    stopLoss: action === 'BUY' ? currentPrice - stopLossDistance : currentPrice + stopLossDistance,
    takeProfit: action === 'BUY' ? currentPrice + takeProfitDistance : currentPrice - takeProfitDistance,
    riskReward: 2.5,
    expectedReturn: takeProfitDistance / currentPrice,
    maxRisk: stopLossDistance / currentPrice,
    marketRegime: volatility > 0.03 ? 'volatile' : volatility < 0.01 ? 'calm' : 'normal',
    volatilityAdjustment: 1 / Math.max(0.5, volatility * 50)
  };
}

function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0.02;
  
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i-1]) / prices[i-1]);
  }
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  
  return Math.sqrt(variance);
}

function calculateATR(prices: number[]): number {
  if (prices.length < 2) return prices[0] * 0.02;
  
  const trueRanges = [];
  for (let i = 1; i < prices.length; i++) {
    trueRanges.push(Math.abs(prices[i] - prices[i-1]));
  }
  
  return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
}

function calculateRiskMetrics(
  combinedAnalysis: any,
  volatility: number,
  marketSignal: any,
  mlPrediction: any
): any {
  const baseRisk = volatility * 100;
  const confidenceRisk = (100 - combinedAnalysis.confidence) / 100;
  const marketRisk = marketSignal.riskLevel === 'HIGH' ? 0.8 : marketSignal.riskLevel === 'MEDIUM' ? 0.5 : 0.2;
  
  const overallRisk = (baseRisk + confidenceRisk + marketRisk) / 3;
  
  return {
    overallRisk: Math.min(1, overallRisk),
    volatilityRisk: baseRisk,
    confidenceRisk: confidenceRisk,
    marketRisk: marketRisk,
    riskLevel: overallRisk > 0.7 ? 'HIGH' : overallRisk > 0.4 ? 'MEDIUM' : 'LOW',
    maxDrawdownRisk: volatility * 3,
    liquidityRisk: 0.1, // Simplified
    correlationRisk: 0.2 // Simplified
  };
}

function calculatePerformanceProjection(
  combinedAnalysis: any,
  riskMetrics: any,
  positionSize: number
): any {
  const expectedReturn = combinedAnalysis.expectedReturn * positionSize;
  const maxRisk = combinedAnalysis.maxRisk * positionSize;
  
  return {
    expectedReturn: expectedReturn,
    maxRisk: maxRisk,
    riskAdjustedReturn: expectedReturn / Math.max(0.01, riskMetrics.overallRisk),
    probabilityOfProfit: Math.max(0.3, combinedAnalysis.confidence / 100),
    expectedSharpeRatio: expectedReturn / Math.max(0.01, riskMetrics.volatilityRisk),
    timeToTarget: 24, // hours
    breakEvenPrice: combinedAnalysis.entryPrice,
    worstCaseScenario: -maxRisk,
    bestCaseScenario: expectedReturn * 1.5
  };
}

function determineTrend(marketData: any[]): string {
  const prices = marketData.map((d: any) => d.price);
  const recentPrices = prices.slice(-20);
  const olderPrices = prices.slice(-40, -20);
  
  const recentAvg = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
  const olderAvg = olderPrices.reduce((sum, p) => sum + p, 0) / olderPrices.length;
  
  const change = (recentAvg - olderAvg) / olderAvg;
  
  if (change > 0.02) return 'bullish';
  if (change < -0.02) return 'bearish';
  return 'neutral';
}

function findSupport(prices: number[]): number {
  const recentPrices = prices.slice(-50);
  return Math.min(...recentPrices);
}

function findResistance(prices: number[]): number {
  const recentPrices = prices.slice(-50);
  return Math.max(...recentPrices);
}

function generateComprehensiveReasoning(
  marketSignal: any,
  mlPrediction: any,
  strategySignals: any,
  combinedAnalysis: any
): string[] {
  const reasoning = [];
  
  // Market analysis reasoning
  if (marketSignal.confidence > 70) {
    reasoning.push(`Strong technical analysis supports ${marketSignal.signal} signal with ${marketSignal.confidence}% confidence`);
  }
  
  // ML prediction reasoning
  if (mlPrediction.confidence > 60) {
    reasoning.push(`Machine learning models predict ${mlPrediction.direction} movement with ${mlPrediction.confidence}% confidence`);
  }
  
  // Strategy consensus
  const strategies = [strategySignals.momentum, strategySignals.meanReversion, strategySignals.breakout];
  const buySignals = strategies.filter(s => s.action === 'buy').length;
  const sellSignals = strategies.filter(s => s.action === 'sell').length;
  
  if (buySignals > sellSignals) {
    reasoning.push(`${buySignals} out of 3 strategies recommend buying`);
  } else if (sellSignals > buySignals) {
    reasoning.push(`${sellSignals} out of 3 strategies recommend selling`);
  }
  
  // Risk-reward assessment
  if (combinedAnalysis.riskReward > 2) {
    reasoning.push(`Favorable risk-reward ratio of ${combinedAnalysis.riskReward}:1`);
  }
  
  // Market conditions
  if (combinedAnalysis.marketRegime === 'volatile') {
    reasoning.push('High volatility environment requires careful position sizing');
  } else if (combinedAnalysis.marketRegime === 'calm') {
    reasoning.push('Low volatility environment allows for larger position sizes');
  }
  
  return reasoning;
}
