import type { MarketData, Position } from "./types"

export interface AITradingConfig {
  apiKey: string
  model: string
  riskTolerance: "conservative" | "moderate" | "aggressive"
  maxPositionSize: number
  stopLossPercentage: number
  takeProfitPercentage: number
  enableAutonomousTrading: boolean
}

export interface MarketAnalysis {
  signal: "BUY" | "SELL" | "HOLD"
  confidence: number
  reasoning: string
  entryPrice: number
  stopLoss: number
  takeProfit: number
  positionSize: number
  riskReward: number
}

export class AITradingEngine {
  private config: AITradingConfig
  private isAnalyzing = false

  constructor(config: AITradingConfig) {
    this.config = config
  }

  async analyzeMarket(
    marketData: MarketData[],
    currentPositions: Position[],
    portfolioBalance: number,
  ): Promise<MarketAnalysis> {
    this.isAnalyzing = true

    try {
      const analysisPrompt = this.buildAnalysisPrompt(marketData, currentPositions, portfolioBalance)

      const response = await fetch("/api/ai/analyze-market", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: analysisPrompt,
          config: this.config,
          marketData,
          positions: currentPositions,
          balance: portfolioBalance,
        }),
      })

      if (!response.ok) {
        throw new Error(`AI analysis failed: ${response.statusText}`)
      }

      const analysis = await response.json()
      return analysis
    } finally {
      this.isAnalyzing = false
    }
  }

  private buildAnalysisPrompt(marketData: MarketData[], positions: Position[], balance: number): string {
    const marketSummary = marketData
      .slice(0, 10)
      .map((data) => `${data.symbol}: $${data.price} (${data.change24h > 0 ? "+" : ""}${data.change24h.toFixed(2)}%)`)
      .join("\n")

    const positionSummary = positions.length
      ? positions
          .map(
            (pos) =>
              `${pos.symbol}: ${pos.size} @ $${pos.entryPrice} (${pos.side}) - P&L: ${pos.unrealizedPnl > 0 ? "+" : ""}$${pos.unrealizedPnl.toFixed(2)}`,
          )
          .join("\n")
      : "No open positions"

    return `
You are an expert cryptocurrency trading AI with access to real-time market data. Analyze the current market conditions and provide a trading recommendation.

CURRENT MARKET DATA:
${marketSummary}

CURRENT POSITIONS:
${positionSummary}

PORTFOLIO BALANCE: $${balance.toFixed(2)}

RISK PARAMETERS:
- Risk Tolerance: ${this.config.riskTolerance}
- Max Position Size: ${this.config.maxPositionSize}%
- Stop Loss: ${this.config.stopLossPercentage}%
- Take Profit: ${this.config.takeProfitPercentage}%

INSTRUCTIONS:
1. Analyze market trends, momentum, and technical indicators
2. Consider current portfolio exposure and risk management
3. Evaluate potential entry/exit points
4. Provide a clear BUY/SELL/HOLD recommendation with confidence level (0-100)
5. Include specific entry price, stop loss, and take profit levels
6. Calculate appropriate position size based on risk parameters
7. Explain your reasoning in detail

Respond with a JSON object containing:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": number (0-100),
  "reasoning": "detailed explanation",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number,
  "positionSize": number (in USD),
  "riskReward": number,
  "symbol": "recommended trading pair"
}
`
  }

  async executeAutonomousTrade(analysis: MarketAnalysis): Promise<boolean> {
    if (!this.config.enableAutonomousTrading) {
      console.log("Autonomous trading is disabled")
      return false
    }

    if (analysis.confidence < 70) {
      console.log(`Confidence too low (${analysis.confidence}%) for autonomous execution`)
      return false
    }

    try {
      const response = await fetch("/api/ai/execute-trade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          analysis,
          config: this.config,
        }),
      })

      return response.ok
    } catch (error) {
      console.error("Failed to execute autonomous trade:", error)
      return false
    }
  }

  isCurrentlyAnalyzing(): boolean {
    return this.isAnalyzing
  }

  updateConfig(newConfig: Partial<AITradingConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }
}
