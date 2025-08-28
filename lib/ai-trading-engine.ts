import type { MarketData, Position } from "./types"

export interface AITradingConfig {
  apiKey?: string
  model: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  riskTolerance?: "conservative" | "moderate" | "aggressive"
  maxPositionSize?: number
  stopLossPercentage?: number
  takeProfitPercentage?: number
  enableAutonomousTrading?: boolean
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
      // Use Anthropic API directly
      const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;

      if (!apiKey) {
        console.warn('No Anthropic API key provided, returning default analysis');
        return this.getDefaultAnalysis(marketData[0]?.price || 45000);
      }

      const analysisPrompt = this.buildAnalysisPrompt(marketData, currentPositions, portfolioBalance);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-5-sonnet-20241022',
          max_tokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.1,
          system: this.config.systemPrompt || 'You are an expert cryptocurrency trading analyst.',
          messages: [
            {
              role: 'user',
              content: analysisPrompt
            }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API failed: ${response.statusText}`);
      }

      const result = await response.json();
      const analysisText = result.content?.[0]?.text || '';

      // Parse the AI response
      return this.parseAIResponse(analysisText, marketData[0]?.price || 45000);

    } catch (error) {
      console.error("AI analysis error:", error);
      // Return a safe default analysis
      return this.getDefaultAnalysis(marketData[0]?.price || 45000);
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

  private parseAIResponse(analysisText: string, currentPrice: number): MarketAnalysis {
    try {
      // Try to extract JSON from the AI response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          signal: parsed.signal || 'HOLD',
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
          reasoning: parsed.reasoning || analysisText.substring(0, 200),
          positionSize: Math.max(0, parsed.positionSize || 100),
          entryPrice: parsed.entryPrice || currentPrice,
          stopLoss: parsed.stopLoss || currentPrice * 0.95,
          takeProfit: parsed.takeProfit || currentPrice * 1.05,
          riskReward: parsed.riskReward || 1.0,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI response as JSON:', error);
    }

    // Fallback: analyze text for sentiment
    const text = analysisText.toLowerCase();
    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0.5;

    if (text.includes('buy') || text.includes('bullish') || text.includes('positive')) {
      signal = 'BUY';
      confidence = 0.7;
    } else if (text.includes('sell') || text.includes('bearish') || text.includes('negative')) {
      signal = 'SELL';
      confidence = 0.7;
    }

    return {
      signal,
      confidence,
      reasoning: analysisText.substring(0, 200) + (analysisText.length > 200 ? '...' : ''),
      positionSize: 100,
      entryPrice: currentPrice,
      stopLoss: currentPrice * (signal === 'BUY' ? 0.95 : 1.05),
      takeProfit: currentPrice * (signal === 'BUY' ? 1.05 : 0.95),
      riskReward: 1.0,
      timestamp: Date.now()
    };
  }

  private getDefaultAnalysis(currentPrice: number): MarketAnalysis {
    return {
      signal: 'HOLD',
      confidence: 0.5,
      reasoning: 'Default analysis - insufficient data or API unavailable',
      positionSize: 100,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.95,
      takeProfit: currentPrice * 1.05,
      riskReward: 1.0,
      timestamp: Date.now()
    };
  }
}
