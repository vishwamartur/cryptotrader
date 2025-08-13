import { AITradingEngine, type AITradingConfig, type MarketAnalysis } from "./ai-trading-engine"
import { RiskManager, type RiskLimits, type RiskMetrics } from "./risk-management"
import { tradeMonitor } from "./trade-monitor"
import type { MarketData, Position } from "./types"

export interface AgentConfig {
  aiConfig: AITradingConfig
  riskLimits: RiskLimits
  analysisInterval: number // minutes
  maxConcurrentAnalyses: number
  emergencyStopLoss: number // percentage
  maxDailyTrades: number
  tradingHours: {
    start: string // "09:00"
    end: string // "17:00"
    timezone: string
  }
}

export interface AgentState {
  status: "STOPPED" | "RUNNING" | "PAUSED" | "ERROR"
  lastAnalysis: Date | null
  totalTrades: number
  dailyTrades: number
  dailyPnL: number
  errors: string[]
  decisions: AgentDecision[]
}

export interface AgentDecision {
  id: string
  timestamp: Date
  analysis: MarketAnalysis
  action: "TRADE" | "HOLD" | "SKIP"
  reason: string
  tradeId?: string
  riskMetrics?: RiskMetrics
}

export class AutonomousAgent {
  private config: AgentConfig
  private state: AgentState
  private aiEngine: AITradingEngine
  private riskManager: RiskManager
  private intervalId: NodeJS.Timeout | null = null
  private subscribers: ((state: AgentState) => void)[] = []
  private isAnalyzing = false

  constructor(config: AgentConfig) {
    this.config = config
    this.aiEngine = new AITradingEngine(config.aiConfig)
    this.riskManager = new RiskManager(config.riskLimits)

    this.state = {
      status: "STOPPED",
      lastAnalysis: null,
      totalTrades: 0,
      dailyTrades: 0,
      dailyPnL: 0,
      errors: [],
      decisions: [],
    }
  }

  start(): void {
    if (this.state.status === "RUNNING") return

    this.state.status = "RUNNING"
    this.state.errors = []
    this.notifySubscribers()

    // Start the analysis loop
    this.intervalId = setInterval(
      () => {
        this.performAnalysisAndTrade()
      },
      this.config.analysisInterval * 60 * 1000,
    )

    // Perform initial analysis
    this.performAnalysisAndTrade()

    console.log("Autonomous agent started")
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.state.status = "STOPPED"
    this.notifySubscribers()
    console.log("Autonomous agent stopped")
  }

  pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.state.status = "PAUSED"
    this.notifySubscribers()
    console.log("Autonomous agent paused")
  }

  resume(): void {
    if (this.state.status !== "PAUSED") return

    this.start()
    console.log("Autonomous agent resumed")
  }

  private async performAnalysisAndTrade(): Promise<void> {
    if (this.isAnalyzing || this.state.status !== "RUNNING") return

    this.isAnalyzing = true

    try {
      // Check if we're within trading hours
      if (!this.isWithinTradingHours()) {
        this.addDecision({
          analysis: {} as MarketAnalysis,
          action: "SKIP",
          reason: "Outside trading hours",
        })
        return
      }

      // Check daily trade limit
      if (this.state.dailyTrades >= this.config.maxDailyTrades) {
        this.addDecision({
          analysis: {} as MarketAnalysis,
          action: "SKIP",
          reason: "Daily trade limit reached",
        })
        return
      }

      // Fetch current market data and portfolio
      const { marketData, positions, balance } = await this.fetchMarketState()

      // Calculate current risk metrics
      const riskMetrics = this.riskManager.calculateRiskMetrics(positions, balance, marketData)

      // Check for emergency conditions
      if (this.shouldEmergencyStop(riskMetrics, balance)) {
        this.emergencyStop(riskMetrics)
        return
      }

      // Perform AI analysis
      const analysis = await this.aiEngine.analyzeMarket(marketData, positions, balance)
      this.state.lastAnalysis = new Date()

      // Make trading decision
      const decision = await this.makeTradeDecision(analysis, riskMetrics, positions, balance)
      this.addDecision(decision)

      // Execute trade if decision is to trade
      if (decision.action === "TRADE" && decision.tradeId) {
        this.state.totalTrades++
        this.state.dailyTrades++
        console.log(`Autonomous trade executed: ${decision.tradeId}`)
      }
    } catch (error) {
      this.handleError(error as Error)
    } finally {
      this.isAnalyzing = false
      this.notifySubscribers()
    }
  }

  private async makeTradeDecision(
    analysis: MarketAnalysis,
    riskMetrics: RiskMetrics,
    positions: Position[],
    balance: number,
  ): Promise<AgentDecision> {
    const decision: AgentDecision = {
      id: `decision_${Date.now()}`,
      timestamp: new Date(),
      analysis,
      action: "HOLD",
      reason: "",
      riskMetrics,
    }

    // Check AI confidence threshold
    if (analysis.confidence < 70) {
      decision.action = "HOLD"
      decision.reason = `AI confidence too low: ${analysis.confidence}%`
      return decision
    }

    // Check risk limits
    const tradeAllowed = this.riskManager.shouldAllowTrade(
      analysis.signal,
      analysis.symbol || "BTC-USD",
      analysis.positionSize,
      positions,
      balance,
    )

    if (!tradeAllowed.allowed) {
      decision.action = "SKIP"
      decision.reason = `Risk check failed: ${tradeAllowed.reason}`
      return decision
    }

    // Calculate optimal position size
    const optimalSize = this.riskManager.calculateOptimalPositionSize(
      balance,
      analysis.entryPrice,
      analysis.stopLoss,
      2, // 2% risk per trade
    )

    // Execute the trade
    try {
      const trade = tradeMonitor.addTrade({
        symbol: analysis.symbol || "BTC-USD",
        side: analysis.signal,
        type: "LIMIT",
        size: Math.min(optimalSize, analysis.positionSize),
        price: analysis.entryPrice,
        commission: 0.1, // 0.1% commission
        source: "AI",
        aiConfidence: analysis.confidence,
        aiReasoning: analysis.reasoning,
        status: "PENDING",
      })

      // Simulate trade execution
      tradeMonitor.simulateTradeUpdate(trade.id)

      decision.action = "TRADE"
      decision.reason = `AI signal: ${analysis.signal} with ${analysis.confidence}% confidence`
      decision.tradeId = trade.id
    } catch (error) {
      decision.action = "SKIP"
      decision.reason = `Trade execution failed: ${(error as Error).message}`
    }

    return decision
  }

  private shouldEmergencyStop(riskMetrics: RiskMetrics, balance: number): boolean {
    // Emergency stop conditions
    return (
      riskMetrics.currentDrawdown > this.config.emergencyStopLoss ||
      riskMetrics.portfolioRisk > this.config.riskLimits.maxPortfolioRisk * 1.5 ||
      this.state.dailyPnL < -balance * 0.05 // 5% daily loss
    )
  }

  private emergencyStop(riskMetrics: RiskMetrics): void {
    this.stop()
    this.state.status = "ERROR"

    const errorMsg = `Emergency stop triggered - Drawdown: ${riskMetrics.currentDrawdown.toFixed(1)}%, Risk: ${riskMetrics.portfolioRisk.toFixed(1)}%`
    this.state.errors.push(errorMsg)

    this.addDecision({
      analysis: {} as MarketAnalysis,
      action: "SKIP",
      reason: errorMsg,
      riskMetrics,
    })

    console.error("EMERGENCY STOP:", errorMsg)
  }

  private isWithinTradingHours(): boolean {
    const now = new Date()
    const currentTime = now.toTimeString().slice(0, 5) // "HH:MM"

    return currentTime >= this.config.tradingHours.start && currentTime <= this.config.tradingHours.end
  }

  private async fetchMarketState(): Promise<{
    marketData: MarketData[]
    positions: Position[]
    balance: number
  }> {
    // In a real implementation, this would fetch from your data sources
    // For now, return mock data
    return {
      marketData: [
        {
          symbol: "BTC-USD",
          price: 45000 + (Math.random() - 0.5) * 1000,
          change24h: (Math.random() - 0.5) * 10,
          volume: Math.random() * 1000000,
        },
      ],
      positions: [],
      balance: 10000,
    }
  }

  private addDecision(decision: Omit<AgentDecision, "id" | "timestamp">): void {
    const fullDecision: AgentDecision = {
      ...decision,
      id: `decision_${Date.now()}`,
      timestamp: new Date(),
    }

    this.state.decisions.unshift(fullDecision)
    this.state.decisions = this.state.decisions.slice(0, 100) // Keep last 100 decisions
  }

  private handleError(error: Error): void {
    const errorMsg = `Agent error: ${error.message}`
    this.state.errors.push(errorMsg)
    this.state.errors = this.state.errors.slice(-10) // Keep last 10 errors

    console.error("Autonomous agent error:", error)

    // Stop agent on critical errors
    if (this.state.errors.length >= 5) {
      this.state.status = "ERROR"
      this.stop()
    }
  }

  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.aiConfig) {
      this.aiEngine.updateConfig(newConfig.aiConfig)
    }

    if (newConfig.riskLimits) {
      this.riskManager.updateLimits(newConfig.riskLimits)
    }
  }

  getState(): AgentState {
    return { ...this.state }
  }

  getDecisions(limit = 20): AgentDecision[] {
    return this.state.decisions.slice(0, limit)
  }

  subscribe(callback: (state: AgentState) => void): () => void {
    this.subscribers.push(callback)
    return () => {
      const index = this.subscribers.indexOf(callback)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.getState()))
  }

  // Reset daily counters (should be called at start of each trading day)
  resetDailyCounters(): void {
    this.state.dailyTrades = 0
    this.state.dailyPnL = 0
    this.riskManager.resetDailyPnL()
  }
}
