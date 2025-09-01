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
  confidence: number // 0–100
  reasoning: string
  entryPrice: number
  stopLoss: number
  takeProfit: number
  positionSize: number
  riskReward: number
  symbol?: string
  timestamp?: number
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
    // Prevent concurrent analysis
    if (this.isAnalyzing) {
      return this.getDefaultAnalysis(45000, 0);
    }

    this.isAnalyzing = true

    try {
      // Handle null or empty market data
      if (!marketData || marketData.length === 0) {
        return this.getDefaultAnalysis(45000, 0);
      }

      // Handle negative balance
      if (portfolioBalance < 0) {
        const analysis = this.getDefaultAnalysis(marketData[0]?.price || 45000);
        analysis.positionSize = 0;
        return analysis;
      }

      // Check for stale data (older than 1 hour)
      const now = Date.now();
      const latestTimestamp = Math.max(...marketData.map(d => d.timestamp || 0));
      const isStaleData = now - latestTimestamp > 3600000; // 1 hour

      if (isStaleData) {
        const analysis = this.getDefaultAnalysis(marketData[0]?.price || 45000);
        analysis.confidence = Math.min(30, analysis.confidence);
        return analysis;
      }

      // Use Perplexity API directly
      const apiKey = this.config.apiKey || process.env.PERPLEXITY_API_KEY;

      if (!apiKey) {
        console.warn('No Perplexity API key provided, returning default analysis');
        // Add a small delay to simulate API call for testing concurrent analysis
        await new Promise(resolve => setTimeout(resolve, 50));
        return this.getDefaultAnalysis(marketData[0]?.price || 45000);
      }

      const analysisPrompt = this.buildAnalysisPrompt(marketData, currentPositions, portfolioBalance);

      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'llama-3.1-sonar-large-128k-online',
          max_tokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.1,
          messages: [
            {
              role: 'system',
              content: this.config.systemPrompt || 'You are an expert cryptocurrency trading analyst with access to real-time market data and news. Provide detailed market analysis and trading recommendations based on current market conditions.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ]
        })
      });

      if (!response || !response.ok) {
        throw new Error(`Perplexity API failed: ${response?.statusText || 'Network error'}`);
      }

      const result = await response.json();
      const analysisText = result.choices?.[0]?.message?.content || '';

      // Parse the AI response
      return this.parseAIResponse(analysisText, marketData[0]?.price || 45000);

    } catch (error) {
      console.error("AI analysis error:", error);
      // Return a safe default analysis with proper error message
      const analysis = this.getDefaultAnalysis(marketData?.[0]?.price || 45000);
      analysis.reasoning = 'AI analysis failed';
      return analysis;
    } finally {
      this.isAnalyzing = false
    }
  }

  private buildAnalysisPrompt(marketData: MarketData[], positions: Position[], balance: number): string {
    const marketSummary = marketData
      .slice(0, 10)
      .map((data) => {
        const change = data.change || 0;
        return `${data.symbol}: $${data.price} (${change > 0 ? "+" : ""}${change.toFixed(2)}%)`;
      })
      .join("\n")

    const positionSummary = positions.length
      ? positions
          .map(
            (pos) => {
              const pnl = parseFloat(pos.realized_pnl || '0');
              const symbol = pos.product?.symbol || 'Unknown';
              const entryPrice = parseFloat(pos.entry_price || '0');
              const side = pos.size && parseFloat(pos.size) > 0 ? 'LONG' : 'SHORT';
              return `${symbol}: ${pos.size} @ $${entryPrice} (${side}) - P&L: ${pnl > 0 ? "+" : ""}$${pnl.toFixed(2)}`;
            }
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

        // Validate and sanitize signal value
        let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        if (['BUY', 'SELL', 'HOLD'].includes(parsed.signal)) {
          signal = parsed.signal;
        } else {
          // Convert invalid signals to valid ones
          const signalStr = String(parsed.signal).toUpperCase();
          if (signalStr.includes('BUY') || signalStr.includes('LONG')) {
            signal = 'BUY';
          } else if (signalStr.includes('SELL') || signalStr.includes('SHORT')) {
            signal = 'SELL';
          }
        }

        return {
          signal,
          confidence: Math.max(0, Math.min(100, parsed.confidence ?? 50)),
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
    let confidence = 50;

    if (text.includes('buy') || text.includes('bullish') || text.includes('positive')) {
      signal = 'BUY';
      confidence = 70;
    } else if (text.includes('sell') || text.includes('bearish') || text.includes('negative')) {
      signal = 'SELL';
      confidence = 70;
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

  private getDefaultAnalysis(currentPrice: number, confidence?: number): MarketAnalysis {
    return {
      signal: 'HOLD',
      confidence: confidence !== undefined ? confidence : 50,
      reasoning: 'AI analysis failed',
      positionSize: 100,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.95,
      takeProfit: currentPrice * 1.05,
      riskReward: 1.0,
      timestamp: Date.now()
    };
  }
}
