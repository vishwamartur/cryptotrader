import type { MarketData, Position } from "./types"
import NodeCache from "node-cache"
import { debounce } from "lodash"
import crypto from "crypto"
import { performance } from "perf_hooks"

interface CacheEntry {
  analysis: MarketAnalysis
  timestamp: number
  hash: string
}

interface PerformanceMetrics {
  totalRequests: number
  cacheHits: number
  cacheMisses: number
  averageLatency: number
  errorRate: number
  lastRequestTime: number
}

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
  cacheEnabled?: boolean
  cacheMaxEntries?: number
  cacheTTL?: number
  requestTimeout?: number
  maxConcurrentRequests?: number
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
  private cache: NodeCache
  private debouncedAnalyzeMarket: Function
  private performanceMetrics: PerformanceMetrics
  private requestQueue: Array<{
    resolve: (value: MarketAnalysis) => void
    reject: (reason: any) => void
    args: [MarketData[], Position[], number]
  }> = []
  private activeRequests = 0

  constructor(config: AITradingConfig) {
    this.config = {
      cacheEnabled: true,
      cacheMaxEntries: 1000,
      cacheTTL: 60, // 1 minute
      requestTimeout: 1000,
      maxConcurrentRequests: 5,
      ...config
    }

    // Initialize cache with performance optimizations
    this.cache = new NodeCache({
      maxKeys: this.config.cacheMaxEntries,
      stdTTL: this.config.cacheTTL,
      checkperiod: 30, // Check for expired keys every 30 seconds
      useClones: false // Disable cloning for better performance
    })

    // Initialize performance metrics
    this.performanceMetrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
      errorRate: 0,
      lastRequestTime: 0
    }

    // Create debounced version of analyze method
    this.debouncedAnalyzeMarket = debounce(
      this.performAnalysis.bind(this),
      500,
      { leading: false, trailing: true }
    )
  }

  async analyzeMarket(
    marketData: MarketData[],
    currentPositions: Position[],
    portfolioBalance: number,
  ): Promise<MarketAnalysis> {
    const startTime = performance.now()
    this.performanceMetrics.totalRequests++

    try {
      // Quick validation checks
      if (!marketData || marketData.length === 0) {
        return this.getDefaultAnalysis(45000, 0)
      }

      if (portfolioBalance < 0) {
        const analysis = this.getDefaultAnalysis(marketData[0]?.price || 45000)
        analysis.positionSize = 0
        return analysis
      }

      // Check for stale data
      const now = Date.now()
      const latestTimestamp = Math.max(...marketData.map(d => (d as any).timestamp || d.lastUpdated || 0))
      const isStaleData = now - latestTimestamp > 3600000

      if (isStaleData) {
        const analysis = this.getDefaultAnalysis(marketData[0]?.price || 45000)
        analysis.confidence = Math.min(30, analysis.confidence)
        return analysis
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(marketData, currentPositions, portfolioBalance)

      if (this.config.cacheEnabled) {
        const cachedAnalysis = this.getCachedAnalysis(cacheKey)
        if (cachedAnalysis) {
          this.performanceMetrics.cacheHits++
          this.updateLatencyMetrics(startTime)
          return cachedAnalysis
        }
        this.performanceMetrics.cacheMisses++
      }

      // Check concurrent request limit
      if (this.activeRequests >= this.config.maxConcurrentRequests!) {
        return new Promise((resolve, reject) => {
          this.requestQueue.push({
            resolve,
            reject,
            args: [marketData, currentPositions, portfolioBalance]
          })
        })
      }

      // Use debounced analysis for better performance
      return new Promise((resolve, reject) => {
        this.debouncedAnalyzeMarket(marketData, currentPositions, portfolioBalance)
          .then(resolve)
          .catch(reject)
      })

    } catch (error) {
      this.performanceMetrics.errorRate = (this.performanceMetrics.errorRate * (this.performanceMetrics.totalRequests - 1) + 1) / this.performanceMetrics.totalRequests
      console.error("AI analysis error:", error)
      const analysis = this.getDefaultAnalysis(marketData?.[0]?.price || 45000)
      analysis.reasoning = 'AI analysis failed'
      return analysis
    } finally {
      this.updateLatencyMetrics(startTime)
    }
  }

  private async performAnalysis(
    marketData: MarketData[],
    currentPositions: Position[],
    portfolioBalance: number
  ): Promise<MarketAnalysis> {
    if (this.isAnalyzing) {
      return this.getDefaultAnalysis(marketData[0]?.price || 45000)
    }

    this.activeRequests++
    this.isAnalyzing = true

    try {
      const apiKey = this.config.apiKey || process.env.PERPLEXITY_API_KEY

      if (!apiKey) {
        console.warn('No Perplexity API key provided, returning default analysis')
        await new Promise(resolve => setTimeout(resolve, 10))
        return this.getDefaultAnalysis(marketData[0]?.price || 45000)
      }

      const analysisPrompt = this.buildOptimizedPrompt(marketData, currentPositions, portfolioBalance)
      const currentPrice = marketData[0]?.price || 45000

      // Optimized API call with timeout and retries
      const analysisText = await this.makeOptimizedAPICall(analysisPrompt, apiKey)

      const analysis = this.parseAIResponse(analysisText, currentPrice)

      // Cache the result
      if (this.config.cacheEnabled) {
        const cacheKey = this.generateCacheKey(marketData, currentPositions, portfolioBalance)
        this.cacheAnalysis(cacheKey, analysis)
      }

      return analysis

    } finally {
      this.isAnalyzing = false
      this.activeRequests--

      // Process queued requests
      if (this.requestQueue.length > 0 && this.activeRequests < this.config.maxConcurrentRequests!) {
        const nextRequest = this.requestQueue.shift()
        if (nextRequest) {
          this.performAnalysis(...nextRequest.args)
            .then(nextRequest.resolve)
            .catch(nextRequest.reject)
        }
      }
    }
  }

  private async makeOptimizedAPICall(prompt: string, apiKey: string): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.requestTimeout)

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'CryptoTrader/1.0 Performance-Optimized',
          'Connection': 'keep-alive'
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
              content: prompt
            }
          ]
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Perplexity API failed: ${response.statusText}`)
      }

      const result = await response.json()
      return result.choices?.[0]?.message?.content || ''

    } catch (error) {
      clearTimeout(timeoutId)

      // Fallback to cached result or default
      throw error
    }
  }

  private generateCacheKey(marketData: MarketData[], positions: Position[], balance: number): string {
    const dataString = JSON.stringify({
      marketData: marketData.slice(0, 5).map(d => ({
        symbol: d.symbol,
        price: d.price,
        change: d.change,
        volume: d.volume
      })),
      positionsCount: positions.length,
      balance: Math.round(balance),
      timestampBucket: Math.floor(Date.now() / 60000) // 1-minute bucket
    })

    const hash = crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16)
    return `ai_analysis_${hash}`
  }

  private getCachedAnalysis(cacheKey: string): MarketAnalysis | null {
    const cached = this.cache.get<CacheEntry>(cacheKey)
    if (cached) {
      // Verify cache entry is still valid
      const age = Date.now() - cached.timestamp
      if (age < (this.config.cacheTTL! * 1000)) {
        return { ...cached.analysis, timestamp: Date.now() }
      }
      this.cache.del(cacheKey)
    }
    return null
  }

  private cacheAnalysis(cacheKey: string, analysis: MarketAnalysis): void {
    const entry: CacheEntry = {
      analysis: { ...analysis },
      timestamp: Date.now(),
      hash: cacheKey
    }
    this.cache.set(cacheKey, entry, this.config.cacheTTL)
  }

  private updateLatencyMetrics(startTime: number): void {
    const latency = performance.now() - startTime
    this.performanceMetrics.lastRequestTime = Date.now()

    // Update rolling average latency
    const alpha = 0.1 // Smoothing factor
    this.performanceMetrics.averageLatency =
      alpha * latency + (1 - alpha) * this.performanceMetrics.averageLatency
  }

  private buildOptimizedPrompt(marketData: MarketData[], positions: Position[], balance: number): string {
    // Pre-compute and cache template parts
    const marketTemplate = this.buildMarketSummary(marketData)
    const positionTemplate = this.buildPositionSummary(positions)

    return [
      'EXPERT CRYPTOCURRENCY TRADING ANALYSIS',
      '========================================',
      '',
      'MARKET DATA:',
      marketTemplate,
      '',
      'POSITIONS:',
      positionTemplate,
      '',
      `BALANCE: $${balance.toFixed(2)}`,
      '',
      'RISK PARAMETERS:',
      `- Tolerance: ${this.config.riskTolerance}`,
      `- Max Position: ${this.config.maxPositionSize}%`,
      `- Stop Loss: ${this.config.stopLossPercentage}%`,
      `- Take Profit: ${this.config.takeProfitPercentage}%`,
      '',
      'REQUIREMENTS: Analyze trends, momentum, technical indicators. Consider portfolio exposure and risk management. Provide specific entry/exit points with confidence (0-100).',
      '',
      'RESPONSE FORMAT: JSON with signal, confidence, reasoning, entryPrice, stopLoss, takeProfit, positionSize, riskReward, symbol.'
    ].join('\n')
  }

  private buildMarketSummary(marketData: MarketData[]): string {
    return marketData
      .slice(0, 8) // Reduced from 10 for better performance
      .map(data => {
        const change = data.change || 0
        const volume = data.volume ? ` Vol: ${(data.volume / 1000000).toFixed(1)}M` : ''
        return `${data.symbol}: $${data.price} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)${volume}`
      })
      .join('\n')
  }

  private buildPositionSummary(positions: Position[]): string {
    if (!positions.length) return 'No open positions'

    return positions
      .slice(0, 5) // Limit for performance
      .map(pos => {
        const pnl = parseFloat(pos.realized_pnl || '0')
        const symbol = pos.product?.symbol || 'Unknown'
        const entryPrice = parseFloat(pos.entry_price || '0')
        const side = pos.size && parseFloat(pos.size) > 0 ? 'LONG' : 'SHORT'
        return `${symbol}: ${pos.size} @ $${entryPrice} (${side}) P&L: ${pnl > 0 ? '+' : ''}$${pnl.toFixed(2)}`
      })
      .join('\n')
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

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  getCacheStats(): {
    keys: number
    hits: number
    misses: number
    hitRate: number
    ksize: number
  } {
    const stats = this.cache.getStats()
    return {
      keys: stats.keys,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0,
      ksize: stats.ksize
    }
  }

  clearCache(): void {
    this.cache.flushAll()
  }

  preloadCache(marketData: MarketData[], positions: Position[], balance: number): void {
    if (!this.config.cacheEnabled) return

    const analysis = this.getDefaultAnalysis(marketData[0]?.price || 45000)
    const cacheKey = this.generateCacheKey(marketData, positions, balance)
    this.cacheAnalysis(cacheKey, analysis)
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
