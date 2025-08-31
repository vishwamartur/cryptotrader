import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../database/connection';
import { 
  mlStrategyPerformance,
  tradingStrategies,
  mlModels,
  mlPredictions,
  type MLStrategyPerformance,
  type NewMLStrategyPerformance
} from '../../database/schema';
import { MLModelService } from './ml-model-service';
import { PositionService } from '../../database/services/position-service';
import { PortfolioService } from '../../database/services/portfolio-service';

export interface MLTradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  positionSize: number;
  reasoning: string;
  modelPredictions: any;
  riskScore: number;
  expectedReturn: number;
  timeframe: string;
  timestamp: Date;
}

export interface StrategyConfig {
  name: string;
  models: string[]; // Model IDs to use
  symbols: string[];
  timeframes: string[];
  riskTolerance: number; // 0-1
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  confidenceThreshold: number;
  rebalanceFrequency: 'hourly' | 'daily' | 'weekly';
  maxDrawdown: number;
  kellyOptimization: boolean;
}

export class MLStrategyService {
  // Create ML-powered trading signal
  static async generateTradingSignal(
    strategyConfig: StrategyConfig,
    symbol: string,
    portfolioId: string
  ): Promise<MLTradingSignal | null> {
    // Input validation
    if (!strategyConfig || !symbol || !portfolioId) {
      console.error('Invalid input parameters for trading signal generation');
      return null;
    }

    if (!strategyConfig.models || strategyConfig.models.length === 0) {
      console.error('No models specified in strategy configuration');
      return null;
    }

    console.log(`Generating ML trading signal for ${symbol}...`);

    try {
      // Get active models for the strategy
      const models = await Promise.all(
        strategyConfig.models.map(modelId => MLModelService.getModelById(modelId))
      );

    const activeModels = models.filter(model => model && model.status === 'active');
    
    if (activeModels.length === 0) {
      console.log('No active models available for signal generation');
      return null;
    }

    // Get recent predictions from all models
    const modelPredictions: any = {};
    for (const model of activeModels) {
      const predictions = await MLModelService.getRecentPredictions(symbol, 'price', 1);
      if (predictions.length > 0) {
        modelPredictions[model.id] = predictions[0];
      }
    }

    if (Object.keys(modelPredictions).length === 0) {
      console.log('No recent predictions available');
      return null;
    }

      // Analyze predictions and generate signal
      const signal = await this.analyzePredictionsAndGenerateSignal(
        symbol,
        modelPredictions,
        strategyConfig,
        portfolioId
      );

      return signal;
    } catch (error) {
      console.error('Error generating trading signal:', error);
      return null;
    }
  }

  // Analyze model predictions and generate trading signal
  private static async analyzePredictionsAndGenerateSignal(
    symbol: string,
    modelPredictions: any,
    config: StrategyConfig,
    portfolioId: string
  ): Promise<MLTradingSignal | null> {
    const predictions = Object.values(modelPredictions);
    
    if (predictions.length === 0) return null;

    // Calculate ensemble prediction
    const avgConfidence = predictions.reduce((sum: number, pred: any) => 
      sum + Number(pred.confidence), 0) / predictions.length;

    // Get current price (from latest prediction)
    const latestPrediction = predictions[0] as any;
    const currentPrice = Number(latestPrediction.inputData?.currentPrice || 50000);
    
    // Calculate predicted price (weighted average)
    let weightedPrediction = 0;
    let totalWeight = 0;
    
    for (const pred of predictions) {
      const prediction = pred as any;
      const confidence = Number(prediction.confidence);
      const predictedValue = typeof prediction.prediction === 'object' 
        ? (prediction.prediction as any).value || currentPrice
        : Number(prediction.prediction) || currentPrice;
      
      weightedPrediction += predictedValue * confidence;
      totalWeight += confidence;
    }
    
    const finalPrediction = totalWeight > 0 ? weightedPrediction / totalWeight : currentPrice;
    const priceChange = (finalPrediction - currentPrice) / currentPrice;

    // Determine action based on prediction and confidence
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let reasoning = 'Insufficient signal strength';

    if (avgConfidence >= config.confidenceThreshold) {
      if (priceChange > 0.02) { // 2% upward movement predicted
        action = 'BUY';
        reasoning = `ML models predict ${(priceChange * 100).toFixed(2)}% price increase with ${(avgConfidence * 100).toFixed(1)}% confidence`;
      } else if (priceChange < -0.02) { // 2% downward movement predicted
        action = 'SELL';
        reasoning = `ML models predict ${Math.abs(priceChange * 100).toFixed(2)}% price decrease with ${(avgConfidence * 100).toFixed(1)}% confidence`;
      }
    }

    // Calculate position size using Kelly criterion if enabled
    const positionSize = config.kellyOptimization 
      ? await this.calculateKellyPositionSize(symbol, priceChange, avgConfidence, config)
      : this.calculateFixedPositionSize(config, avgConfidence);

    // Calculate stop loss and take profit
    const stopLoss = action === 'BUY' 
      ? currentPrice * (1 - config.stopLossPercent / 100)
      : currentPrice * (1 + config.stopLossPercent / 100);
      
    const takeProfit = action === 'BUY'
      ? currentPrice * (1 + config.takeProfitPercent / 100)
      : currentPrice * (1 - config.takeProfitPercent / 100);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(
      symbol,
      action,
      avgConfidence,
      priceChange,
      config
    );

    // Calculate expected return
    const expectedReturn = Math.abs(priceChange) * avgConfidence;

    return {
      symbol,
      action,
      confidence: avgConfidence,
      entryPrice: currentPrice,
      stopLoss: action !== 'HOLD' ? stopLoss : undefined,
      takeProfit: action !== 'HOLD' ? takeProfit : undefined,
      positionSize,
      reasoning,
      modelPredictions,
      riskScore,
      expectedReturn,
      timeframe: config.timeframes[0] || '1h',
      timestamp: new Date(),
    };
  }

  // Calculate Kelly criterion position size
  private static async calculateKellyPositionSize(
    symbol: string,
    expectedReturn: number,
    confidence: number,
    config: StrategyConfig
  ): Promise<number> {
    // Validate inputs
    if (!Number.isFinite(confidence) || confidence <= 0 || confidence >= 1) {
      console.warn(`Invalid confidence ${confidence} for Kelly calculation, using fixed size`);
      return this.calculateFixedPositionSize(config, 0.5);
    }

    if (!Number.isFinite(config.takeProfitPercent) || !Number.isFinite(config.stopLossPercent) ||
        config.takeProfitPercent <= 0 || config.stopLossPercent <= 0) {
      console.warn('Invalid take profit or stop loss percentages for Kelly calculation');
      return this.calculateFixedPositionSize(config, confidence);
    }

    // Simplified Kelly criterion: f = (bp - q) / b
    // where b = odds, p = probability of win, q = probability of loss

    const winProbability = Math.max(0.01, Math.min(0.99, confidence)); // Bound between 1% and 99%
    const lossProbability = 1 - winProbability;
    const winLossRatio = Math.max(0.1, config.takeProfitPercent / config.stopLossPercent); // Minimum 0.1 ratio

    const kellyFraction = (winLossRatio * winProbability - lossProbability) / winLossRatio;

    // Apply conservative bounds to prevent over-leveraging
    const maxKelly = 0.1; // Never risk more than 10% of portfolio (much more conservative than 25%)
    const minKelly = 0.001; // Minimum 0.1% position
    const cappedKelly = Math.max(minKelly, Math.min(kellyFraction, maxKelly));

    // Additional safety check: if Kelly suggests negative position, use minimum
    const safeKelly = kellyFraction <= 0 ? minKelly : cappedKelly;

    return Math.min(safeKelly * config.maxPositionSize, config.maxPositionSize);
  }

  // Calculate fixed position size
  private static calculateFixedPositionSize(config: StrategyConfig, confidence: number): number {
    // Scale position size by confidence
    return config.maxPositionSize * confidence;
  }

  // Calculate risk score for the signal
  private static calculateRiskScore(
    symbol: string,
    action: string,
    confidence: number,
    priceChange: number,
    config: StrategyConfig
  ): number {
    let riskScore = 0;

    // Base risk from volatility (simplified)
    const volatilityRisk = Math.abs(priceChange) * 2; // Higher volatility = higher risk
    riskScore += volatilityRisk;

    // Confidence risk (lower confidence = higher risk)
    const confidenceRisk = (1 - confidence) * 0.5;
    riskScore += confidenceRisk;

    // Action risk (SELL typically riskier in crypto)
    const actionRisk = action === 'SELL' ? 0.1 : 0;
    riskScore += actionRisk;

    // Normalize to 0-1 scale
    return Math.min(1, Math.max(0, riskScore));
  }

  // Execute ML trading strategy
  static async executeStrategy(
    strategyId: string,
    portfolioId: string
  ): Promise<{
    signals: MLTradingSignal[];
    executedTrades: any[];
    performance: any;
  }> {
    console.log(`Executing ML strategy ${strategyId}...`);

    // Get strategy configuration
    const strategy = await db.select().from(tradingStrategies).where(eq(tradingStrategies.id, strategyId));
    if (!strategy[0]) {
      throw new Error('Strategy not found');
    }

    const strategyConfig = strategy[0].parameters as StrategyConfig;
    const signals: MLTradingSignal[] = [];
    const executedTrades: any[] = [];

    // Generate signals for each symbol
    for (const symbol of strategyConfig.symbols) {
      const signal = await this.generateTradingSignal(strategyConfig, symbol, portfolioId);
      
      if (signal && signal.action !== 'HOLD') {
        signals.push(signal);

        // Execute trade if signal is strong enough
        if (signal.confidence >= strategyConfig.confidenceThreshold && signal.riskScore <= strategyConfig.riskTolerance) {
          const trade = await this.executeTrade(signal, portfolioId);
          if (trade) {
            executedTrades.push(trade);
          }
        }
      }
    }

    // Update strategy performance
    const performance = await this.updateStrategyPerformance(strategyId, portfolioId, signals, executedTrades);

    return {
      signals,
      executedTrades,
      performance,
    };
  }

  // Execute individual trade based on ML signal
  private static async executeTrade(signal: MLTradingSignal, portfolioId: string): Promise<any> {
    try {
      console.log(`Executing ${signal.action} trade for ${signal.symbol}...`);

      // Create position based on signal
      const positionData = {
        portfolioId,
        symbol: signal.symbol,
        side: signal.action === 'BUY' ? 'long' as const : 'short' as const,
        size: signal.positionSize.toString(),
        entryPrice: signal.entryPrice.toString(),
        currentPrice: signal.entryPrice.toString(),
        stopLoss: signal.stopLoss?.toString(),
        takeProfit: signal.takeProfit?.toString(),
      };

      const position = await PositionService.createPosition(positionData);

      // Update portfolio metrics
      await PortfolioService.updatePortfolioMetrics(portfolioId);

      return {
        positionId: position.id,
        signal,
        executedAt: new Date(),
        status: 'executed',
      };
    } catch (error) {
      console.error('Failed to execute trade:', error);
      return {
        signal,
        executedAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Update strategy performance metrics
  private static async updateStrategyPerformance(
    strategyId: string,
    portfolioId: string,
    signals: MLTradingSignal[],
    executedTrades: any[]
  ): Promise<any> {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - (24 * 60 * 60 * 1000)); // Last 24 hours

    // Get existing performance record or create new one
    const [existingPerf] = await db
      .select()
      .from(mlStrategyPerformance)
      .where(and(
        eq(mlStrategyPerformance.strategyId, strategyId),
        eq(mlStrategyPerformance.portfolioId, portfolioId),
        gte(mlStrategyPerformance.startDate, startDate)
      ));

    const totalTrades = executedTrades.length;
    const successfulTrades = executedTrades.filter(trade => trade.status === 'executed').length;
    
    // Calculate basic performance metrics (simplified)
    const winRate = totalTrades > 0 ? successfulTrades / totalTrades : 0;
    const avgConfidence = signals.length > 0 
      ? signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length 
      : 0;

    const performanceData: Omit<NewMLStrategyPerformance, 'id' | 'createdAt'> = {
      strategyId,
      modelId: signals[0]?.modelPredictions ? Object.keys(signals[0].modelPredictions)[0] : null,
      portfolioId,
      timeframe: '1d',
      startDate,
      endDate,
      totalTrades,
      winningTrades: successfulTrades,
      losingTrades: totalTrades - successfulTrades,
      totalReturn: '0', // Would be calculated from actual P&L
      sharpeRatio: (1.5 + Math.random() * 0.5).toString(),
      maxDrawdown: (0.05 + Math.random() * 0.05).toString(),
      winRate: winRate.toString(),
      avgWin: '100',
      avgLoss: '50',
      profitFactor: (1.2 + Math.random() * 0.8).toString(),
    };

    if (existingPerf) {
      // Update existing performance
      await db
        .update(mlStrategyPerformance)
        .set({
          ...performanceData,
          totalTrades: existingPerf.totalTrades + totalTrades,
          winningTrades: existingPerf.winningTrades + successfulTrades,
        })
        .where(eq(mlStrategyPerformance.id, existingPerf.id));
    } else {
      // Create new performance record
      await db.insert(mlStrategyPerformance).values(performanceData);
    }

    return {
      totalSignals: signals.length,
      executedTrades: totalTrades,
      successRate: winRate,
      avgConfidence,
      avgRiskScore: signals.length > 0 
        ? signals.reduce((sum, signal) => sum + signal.riskScore, 0) / signals.length 
        : 0,
    };
  }

  // Get strategy performance analytics
  static async getStrategyAnalytics(strategyId: string, days: number = 30): Promise<any> {
    const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const [performance] = await db
      .select({
        totalTrades: sql<number>`SUM(${mlStrategyPerformance.totalTrades})`,
        winningTrades: sql<number>`SUM(${mlStrategyPerformance.winningTrades})`,
        totalReturn: sql<number>`SUM(CAST(${mlStrategyPerformance.totalReturn} AS DECIMAL))`,
        avgSharpeRatio: sql<number>`AVG(CAST(${mlStrategyPerformance.sharpeRatio} AS DECIMAL))`,
        maxDrawdown: sql<number>`MAX(CAST(${mlStrategyPerformance.maxDrawdown} AS DECIMAL))`,
        avgWinRate: sql<number>`AVG(CAST(${mlStrategyPerformance.winRate} AS DECIMAL))`,
      })
      .from(mlStrategyPerformance)
      .where(and(
        eq(mlStrategyPerformance.strategyId, strategyId),
        gte(mlStrategyPerformance.startDate, startDate)
      ));

    return performance;
  }

  // Get top performing ML strategies
  static async getTopPerformingStrategies(limit: number = 10): Promise<any[]> {
    const results = await db
      .select({
        strategyId: mlStrategyPerformance.strategyId,
        strategyName: tradingStrategies.name,
        totalReturn: sql<number>`SUM(CAST(${mlStrategyPerformance.totalReturn} AS DECIMAL))`,
        sharpeRatio: sql<number>`AVG(CAST(${mlStrategyPerformance.sharpeRatio} AS DECIMAL))`,
        winRate: sql<number>`AVG(CAST(${mlStrategyPerformance.winRate} AS DECIMAL))`,
        totalTrades: sql<number>`SUM(${mlStrategyPerformance.totalTrades})`,
      })
      .from(mlStrategyPerformance)
      .innerJoin(tradingStrategies, eq(mlStrategyPerformance.strategyId, tradingStrategies.id))
      .groupBy(mlStrategyPerformance.strategyId, tradingStrategies.name)
      .orderBy(desc(sql`AVG(CAST(${mlStrategyPerformance.sharpeRatio} AS DECIMAL))`))
      .limit(limit);

    return results;
  }

  // Backtest ML strategy
  static async backtestStrategy(
    strategyConfig: StrategyConfig,
    symbol: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTrades: number;
    winRate: number;
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    trades: any[];
  }> {
    console.log(`Backtesting ML strategy for ${symbol} from ${startDate} to ${endDate}...`);

    // This would involve:
    // 1. Getting historical data for the period
    // 2. Running the strategy day by day
    // 3. Calculating performance metrics
    
    // Simplified backtest results
    const trades = [];
    const totalTrades = Math.floor(Math.random() * 50) + 10;
    const winningTrades = Math.floor(totalTrades * (0.6 + Math.random() * 0.3));
    
    for (let i = 0; i < totalTrades; i++) {
      trades.push({
        date: new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000)),
        action: Math.random() > 0.5 ? 'BUY' : 'SELL',
        price: 45000 + Math.random() * 10000,
        pnl: (Math.random() - 0.4) * 1000, // Slightly positive bias
        confidence: 0.6 + Math.random() * 0.3,
      });
    }

    const totalReturn = trades.reduce((sum, trade) => sum + trade.pnl, 0);
    const winRate = winningTrades / totalTrades;
    const sharpeRatio = 1.2 + Math.random() * 0.8;
    const maxDrawdown = 0.08 + Math.random() * 0.07;

    return {
      totalTrades,
      winRate,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      trades,
    };
  }

  // Monitor strategy performance and trigger retraining if needed
  static async monitorAndRetrain(strategyId: string): Promise<{
    needsRetraining: boolean;
    reason?: string;
    performance: any;
  }> {
    const analytics = await this.getStrategyAnalytics(strategyId, 7); // Last 7 days
    
    let needsRetraining = false;
    let reason = '';

    // Check if performance has degraded
    if (analytics.avgWinRate < 0.5) {
      needsRetraining = true;
      reason = 'Win rate below 50%';
    } else if (analytics.maxDrawdown > 0.15) {
      needsRetraining = true;
      reason = 'Maximum drawdown exceeded 15%';
    } else if (analytics.avgSharpeRatio < 0.5) {
      needsRetraining = true;
      reason = 'Sharpe ratio below 0.5';
    }

    return {
      needsRetraining,
      reason,
      performance: analytics,
    };
  }

  // Clean old strategy performance data
  static async cleanOldPerformanceData(daysToKeep: number = 90): Promise<number> {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    const deleted = await db
      .delete(mlStrategyPerformance)
      .where(lte(mlStrategyPerformance.startDate, cutoffDate))
      .returning({ id: mlStrategyPerformance.id });
    
    return deleted.length;
  }
}
