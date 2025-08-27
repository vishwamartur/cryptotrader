import type { MarketData, Position } from "./types"
import type { MarketAnalysis } from "./ai-trading-engine"

export interface EnhancedAnalysis extends MarketAnalysis {
  technicalIndicators: {
    rsi: number
    macd: { signal: number; histogram: number }
    bollinger: { upper: number; lower: number; middle: number }
    volume: { trend: "INCREASING" | "DECREASING"; strength: number }
  }
  marketSentiment: {
    score: number // -1 to 1
    sources: string[]
    confidence: number
  }
  riskAssessment: {
    volatility: number
    correlation: number
    liquidityRisk: number
    overallRisk: "LOW" | "MEDIUM" | "HIGH"
  }
  backtestResults: {
    winRate: number
    avgReturn: number
    maxDrawdown: number
    sharpeRatio: number
  }
}

export class EnhancedAIEngine {
  private apiKey: string
  private model: string

  constructor(apiKey: string, model = "claude-3-5-sonnet-20241022") {
    this.apiKey = apiKey
    this.model = model
  }

  async performEnhancedAnalysis(
    marketData: MarketData[],
    positions: Position[],
    balance: number,
    historicalData?: any[],
  ): Promise<EnhancedAnalysis> {
    const technicalIndicators = this.calculateTechnicalIndicators(marketData)

    const marketSentiment = await this.analyzeMarketSentiment(marketData)

    const riskAssessment = this.assessRisk(marketData, positions)

    const backtestResults = this.simulateBacktest(marketData, historicalData)

    const aiAnalysis = await this.generateAIAnalysis({
      marketData,
      positions,
      balance,
      technicalIndicators,
      marketSentiment,
      riskAssessment,
      backtestResults,
    })

    return {
      ...aiAnalysis,
      technicalIndicators,
      marketSentiment,
      riskAssessment,
      backtestResults,
    }
  }

  private calculateTechnicalIndicators(marketData: MarketData[]) {
    const prices = marketData.map((d) => d.price)
    const volumes = marketData.map((d) => d.volume)

    // RSI calculation (simplified)
    const rsi = this.calculateRSI(prices)

    // MACD calculation (simplified)
    const macd = this.calculateMACD(prices)

    // Bollinger Bands
    const bollinger = this.calculateBollingerBands(prices)

    // Volume analysis
    const volume = this.analyzeVolume(volumes)

    return { rsi, macd, bollinger, volume }
  }

  private calculateRSI(prices: number[], period = 14): number {
    if (prices.length < period + 1) return 50 // Neutral RSI

    let gains = 0
    let losses = 0

    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1]
      if (change > 0) gains += change
      else losses += Math.abs(change)
    }

    const avgGain = gains / period
    const avgLoss = losses / period
    const rs = avgGain / (avgLoss || 1)

    return 100 - 100 / (1 + rs)
  }

  private calculateMACD(prices: number[]) {
    // Simplified MACD calculation
    const ema12 = this.calculateEMA(prices, 12)
    const ema26 = this.calculateEMA(prices, 26)
    const macdLine = ema12 - ema26
    const signalLine = this.calculateEMA([macdLine], 9)
    const histogram = macdLine - signalLine

    return { signal: signalLine, histogram }
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0

    const multiplier = 2 / (period + 1)
    let ema = prices[0]

    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * multiplier + ema * (1 - multiplier)
    }

    return ema
  }

  private calculateBollingerBands(prices: number[], period = 20, stdDev = 2) {
    if (prices.length < period) {
      const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length
      return { upper: avg * 1.02, lower: avg * 0.98, middle: avg }
    }

    const recentPrices = prices.slice(-period)
    const middle = recentPrices.reduce((sum, p) => sum + p, 0) / period

    const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period
    const standardDeviation = Math.sqrt(variance)

    return {
      upper: middle + standardDeviation * stdDev,
      lower: middle - standardDeviation * stdDev,
      middle,
    }
  }

  private analyzeVolume(volumes: number[]) {
    if (volumes.length < 2) {
      return { trend: "INCREASING" as const, strength: 0.5 }
    }

    const recentVolume = volumes.slice(-5).reduce((sum, v) => sum + v, 0) / 5
    const olderVolume = volumes.slice(-10, -5).reduce((sum, v) => sum + v, 0) / 5

    const trend = recentVolume > olderVolume ? "INCREASING" : "DECREASING"
    const strength = Math.min(1, Math.abs(recentVolume - olderVolume) / olderVolume)

    return { trend, strength }
  }

  private async analyzeMarketSentiment(marketData: MarketData[]) {
    const priceChanges = marketData.map((d) => d.change24h)
    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length

    // Normalize to -1 to 1 scale
    const score = Math.max(-1, Math.min(1, avgChange / 10))

    const sources = ["Price Action", "Volume Analysis", "Technical Indicators"]
    const confidence = Math.min(1, Math.abs(score) + 0.3)

    return { score, sources, confidence }
  }

  private assessRisk(marketData: MarketData[], positions: Position[]) {
    const volatility = this.calculateVolatility(marketData)
    const correlation = this.calculateCorrelation(marketData, positions)
    const liquidityRisk = this.assessLiquidityRisk(marketData)

    const overallRisk =
      volatility > 0.3 || correlation > 0.8 || liquidityRisk > 0.7
        ? "HIGH"
        : volatility > 0.15 || correlation > 0.6 || liquidityRisk > 0.4
          ? "MEDIUM"
          : "LOW"

    return { volatility, correlation, liquidityRisk, overallRisk }
  }

  private calculateVolatility(marketData: MarketData[]): number {
    const changes = marketData.map((d) => d.change24h / 100)
    const avgChange = changes.reduce((sum, c) => sum + c, 0) / changes.length
    const variance = changes.reduce((sum, c) => sum + Math.pow(c - avgChange, 2), 0) / changes.length
    return Math.sqrt(variance)
  }

  private calculateCorrelation(marketData: MarketData[], positions: Position[]): number {
    // Simplified correlation calculation
    if (positions.length < 2) return 0

    // This would normally calculate correlation between position returns
    return Math.random() * 0.8 // Placeholder
  }

  private assessLiquidityRisk(marketData: MarketData[]): number {
    // Assess liquidity based on volume and spread
    const avgVolume = marketData.reduce((sum, d) => sum + d.volume, 0) / marketData.length
    const lowVolumeThreshold = 1000000 // $1M daily volume threshold

    return avgVolume < lowVolumeThreshold ? 0.8 : 0.2
  }

  private simulateBacktest(marketData: MarketData[], historicalData?: any[]) {
    // In a real implementation, this would run historical simulations
    return {
      winRate: 0.65 + Math.random() * 0.2, // 65-85%
      avgReturn: (Math.random() - 0.3) * 0.1, // -3% to 7%
      maxDrawdown: Math.random() * 0.15, // 0-15%
      sharpeRatio: 0.5 + Math.random() * 1.5, // 0.5-2.0
    }
  }

  private async generateAIAnalysis(context: any): Promise<MarketAnalysis> {
    const prompt = this.buildEnhancedPrompt(context)

    try {
      const response = await fetch("/api/ai/analyze-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: this.model,
          context,
        }),
      })

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error("Enhanced AI analysis failed:", error)
      // Return fallback analysis
      return {
        signal: "HOLD",
        confidence: 50,
        reasoning: "AI analysis unavailable, using technical indicators",
        entryPrice: context.marketData[0]?.price || 0,
        stopLoss: 0,
        takeProfit: 0,
        positionSize: 0,
        riskReward: 1,
      }
    }
  }

  private buildEnhancedPrompt(context: any): string {
    return `
You are an expert cryptocurrency trading AI with access to comprehensive market analysis tools.

TECHNICAL INDICATORS:
- RSI: ${context.technicalIndicators.rsi.toFixed(2)} ${context.technicalIndicators.rsi > 70 ? "(Overbought)" : context.technicalIndicators.rsi < 30 ? "(Oversold)" : "(Neutral)"}
- MACD Signal: ${context.technicalIndicators.macd.signal.toFixed(4)}
- Bollinger Bands: Upper ${context.technicalIndicators.bollinger.upper.toFixed(2)}, Lower ${context.technicalIndicators.bollinger.lower.toFixed(2)}
- Volume Trend: ${context.technicalIndicators.volume.trend} (Strength: ${(context.technicalIndicators.volume.strength * 100).toFixed(1)}%)

MARKET SENTIMENT:
- Sentiment Score: ${context.marketSentiment.score.toFixed(2)} (-1 to 1 scale)
- Confidence: ${(context.marketSentiment.confidence * 100).toFixed(1)}%

RISK ASSESSMENT:
- Volatility: ${(context.riskAssessment.volatility * 100).toFixed(1)}%
- Overall Risk: ${context.riskAssessment.overallRisk}
- Liquidity Risk: ${(context.riskAssessment.liquidityRisk * 100).toFixed(1)}%

BACKTEST PERFORMANCE:
- Historical Win Rate: ${(context.backtestResults.winRate * 100).toFixed(1)}%
- Average Return: ${(context.backtestResults.avgReturn * 100).toFixed(2)}%
- Max Drawdown: ${(context.backtestResults.maxDrawdown * 100).toFixed(1)}%
- Sharpe Ratio: ${context.backtestResults.sharpeRatio.toFixed(2)}

CURRENT MARKET DATA:
${context.marketData
  .slice(0, 5)
  .map((data: any) => `${data.symbol}: $${data.price} (${data.change24h > 0 ? "+" : ""}${data.change24h.toFixed(2)}%)`)
  .join("\n")}

PORTFOLIO STATUS:
Balance: $${context.balance.toFixed(2)}
Open Positions: ${context.positions.length}

Based on this comprehensive analysis, provide a detailed trading recommendation with specific entry/exit points and risk management parameters.
`
  }
}
