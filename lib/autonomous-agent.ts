import { AITradingEngine, type AITradingConfig, type MarketAnalysis } from "./ai-trading-engine"
import { RiskManager, type RiskLimits, type RiskMetrics } from "./risk-management"
import { tradeMonitor } from "./trade-monitor"
import { QuantStrategyEngine, StrategyEnsemble } from "./quant-strategy-engine"
import { RLTradingSystem } from "./quant-rl"
import { HFTEngine } from "./hft-orderbook-engine"
import { YieldOptimizer } from "./quant-defi"
import type { MarketData, Position } from "./types"

export interface AgentConfig {
  // Core AI Configuration
  aiConfig: AITradingConfig
  riskLimits: RiskLimits

  // Trading Parameters
  analysisInterval: number // minutes
  maxConcurrentAnalyses: number
  emergencyStopLoss: number // percentage
  maxDailyTrades: number
  maxPositionSize: number // USD

  // Strategy Configuration
  enabledStrategies: {
    ai: boolean
    quant: boolean
    hft: boolean
    rl: boolean
    defi: boolean
  }

  // Market Adaptation
  marketRegimes: {
    bull: { riskMultiplier: number; positionSizeMultiplier: number }
    bear: { riskMultiplier: number; positionSizeMultiplier: number }
    sideways: { riskMultiplier: number; positionSizeMultiplier: number }
    volatile: { riskMultiplier: number; positionSizeMultiplier: number }
  }

  // Trading Schedule
  tradingHours: {
    start: string // "09:00"
    end: string // "17:00"
    timezone: string
    weekendsEnabled: boolean
  }

  // Safety Controls
  circuitBreakers: {
    maxDrawdown: number // percentage
    maxConsecutiveLosses: number
    minAccountBalance: number // USD
    volatilityThreshold: number
  }

  // Performance Targets
  targets: {
    dailyReturnTarget: number // percentage
    monthlyReturnTarget: number // percentage
    maxVolatility: number // percentage
    minSharpeRatio: number
  }
}

export interface AgentState {
  // Core Status
  status: "STOPPED" | "RUNNING" | "PAUSED" | "ERROR" | "EMERGENCY_STOP"
  lastAnalysis: Date | null
  lastHeartbeat: Date | null
  uptime: number // milliseconds

  // Trading Metrics
  totalTrades: number
  dailyTrades: number
  weeklyTrades: number
  monthlyTrades: number

  // Performance Metrics
  dailyPnL: number
  weeklyPnL: number
  monthlyPnL: number
  totalPnL: number
  unrealizedPnL: number

  // Risk Metrics
  currentDrawdown: number
  maxDrawdown: number
  consecutiveLosses: number
  currentVolatility: number
  sharpeRatio: number

  // Strategy Performance
  strategyPerformance: {
    ai: { trades: number; pnl: number; winRate: number }
    quant: { trades: number; pnl: number; winRate: number }
    hft: { trades: number; pnl: number; winRate: number }
    rl: { trades: number; pnl: number; winRate: number }
    defi: { trades: number; pnl: number; winRate: number }
  }

  // Market Analysis
  currentMarketRegime: 'bull' | 'bear' | 'sideways' | 'volatile'
  marketConfidence: number
  volatilityIndex: number

  // System Health
  errors: string[]
  warnings: string[]
  decisions: AgentDecision[]

  // Circuit Breaker Status
  circuitBreakers: {
    drawdownTriggered: boolean
    consecutiveLossesTriggered: boolean
    balanceTriggered: boolean
    volatilityTriggered: boolean
  }
}

export interface AgentDecision {
  id: string
  timestamp: Date

  // Analysis Results
  analysis: MarketAnalysis
  marketRegime: 'bull' | 'bear' | 'sideways' | 'volatile'

  // Decision Details
  action: "TRADE" | "HOLD" | "SKIP" | "EMERGENCY_STOP" | "REBALANCE"
  strategy: 'ai' | 'quant' | 'hft' | 'rl' | 'defi' | 'ensemble'
  confidence: number
  reason: string

  // Trade Information
  tradeId?: string
  symbol?: string
  side?: 'buy' | 'sell'
  quantity?: number
  price?: number

  // Risk Assessment
  riskMetrics?: RiskMetrics
  riskScore: number
  positionSizeRatio: number

  // Performance Tracking
  expectedReturn: number
  actualReturn?: number
  executionLatency?: number
  slippage?: number
}

export class AutonomousAgent {
  private config: AgentConfig
  private state: AgentState
  private aiEngine: AITradingEngine
  private riskManager: RiskManager
  private quantEngine: QuantStrategyEngine
  private strategyEnsemble: StrategyEnsemble
  private rlSystem: RLTradingSystem | null = null
  private hftEngine: HFTEngine
  private yieldOptimizer: YieldOptimizer

  private intervalId: NodeJS.Timeout | null = null
  private heartbeatId: NodeJS.Timeout | null = null
  private subscribers: ((state: AgentState) => void)[] = []
  private isAnalyzing = false
  private startTime: Date = new Date()

  // Performance tracking
  private performanceHistory: Array<{
    timestamp: Date
    pnl: number
    drawdown: number
    trades: number
    volatility: number
  }> = []

  constructor(config: AgentConfig) {
    this.config = config
    // Initialize trading engines
    this.aiEngine = new AITradingEngine(config.aiConfig)
    this.riskManager = new RiskManager(config.riskLimits)
    this.quantEngine = new QuantStrategyEngine()
    this.strategyEnsemble = new StrategyEnsemble()
    this.hftEngine = new HFTEngine()
    this.yieldOptimizer = new YieldOptimizer()

    // Initialize RL system if enabled
    if (config.enabledStrategies.rl) {
      // Will be initialized with market data when available
      this.rlSystem = null
    }

    this.state = this.createInitialState()
  }

  private createInitialState(): AgentState {
    return {
      // Core Status
      status: "STOPPED",
      lastAnalysis: null,
      lastHeartbeat: null,
      uptime: 0,

      // Trading Metrics
      totalTrades: 0,
      dailyTrades: 0,
      weeklyTrades: 0,
      monthlyTrades: 0,

      // Performance Metrics
      dailyPnL: 0,
      weeklyPnL: 0,
      monthlyPnL: 0,
      totalPnL: 0,
      unrealizedPnL: 0,

      // Risk Metrics
      currentDrawdown: 0,
      maxDrawdown: 0,
      consecutiveLosses: 0,
      currentVolatility: 0,
      sharpeRatio: 0,

      // Strategy Performance
      strategyPerformance: {
        ai: { trades: 0, pnl: 0, winRate: 0 },
        quant: { trades: 0, pnl: 0, winRate: 0 },
        hft: { trades: 0, pnl: 0, winRate: 0 },
        rl: { trades: 0, pnl: 0, winRate: 0 },
        defi: { trades: 0, pnl: 0, winRate: 0 }
      },

      // Market Analysis
      currentMarketRegime: 'sideways',
      marketConfidence: 0.5,
      volatilityIndex: 0,

      // System Health
      errors: [],
      warnings: [],
      decisions: [],

      // Circuit Breaker Status
      circuitBreakers: {
        drawdownTriggered: false,
        consecutiveLossesTriggered: false,
        balanceTriggered: false,
        volatilityTriggered: false
      }
    }
  }

  start(): void {
    if (this.state.status === "RUNNING") return

    this.state.status = "RUNNING"
    this.state.errors = []
    this.state.warnings = []
    this.startTime = new Date()
    this.state.lastHeartbeat = new Date()
    this.notifySubscribers()

    // Start the analysis loop
    this.intervalId = setInterval(
      () => {
        this.performAnalysisAndTrade()
      },
      this.config.analysisInterval * 60 * 1000,
    )

    // Start heartbeat monitoring
    this.heartbeatId = setInterval(
      () => {
        this.updateHeartbeat()
      },
      30000, // 30 seconds
    )

    // Perform initial analysis
    this.performAnalysisAndTrade()

    console.log("Autonomous agent started with enhanced features")
    this.logSystemStatus()
  }

  private updateHeartbeat(): void {
    this.state.lastHeartbeat = new Date()
    this.state.uptime = Date.now() - this.startTime.getTime()

    // Check circuit breakers
    this.checkCircuitBreakers()

    // Update performance metrics
    this.updatePerformanceMetrics()

    this.notifySubscribers()
  }

  private checkCircuitBreakers(): void {
    const breakers = this.state.circuitBreakers

    // Check drawdown circuit breaker
    if (this.state.currentDrawdown > this.config.circuitBreakers.maxDrawdown) {
      if (!breakers.drawdownTriggered) {
        breakers.drawdownTriggered = true
        this.triggerEmergencyStop('Maximum drawdown exceeded')
      }
    }

    // Check consecutive losses
    if (this.state.consecutiveLosses >= this.config.circuitBreakers.maxConsecutiveLosses) {
      if (!breakers.consecutiveLossesTriggered) {
        breakers.consecutiveLossesTriggered = true
        this.triggerEmergencyStop('Maximum consecutive losses exceeded')
      }
    }

    // Check volatility threshold
    if (this.state.currentVolatility > this.config.circuitBreakers.volatilityThreshold) {
      if (!breakers.volatilityTriggered) {
        breakers.volatilityTriggered = true
        this.state.warnings.push(`High volatility detected: ${this.state.currentVolatility.toFixed(2)}%`)
      }
    }
  }

  private triggerEmergencyStop(reason: string): void {
    console.error(`EMERGENCY STOP TRIGGERED: ${reason}`)
    this.state.status = "EMERGENCY_STOP"
    this.state.errors.push(`Emergency stop: ${reason}`)

    // Stop all trading activities
    this.stop()

    // Log emergency stop decision
    const decision: AgentDecision = {
      id: `emergency_${Date.now()}`,
      timestamp: new Date(),
      analysis: {} as MarketAnalysis, // Empty analysis for emergency stop
      marketRegime: this.state.currentMarketRegime,
      action: "EMERGENCY_STOP",
      strategy: 'ensemble',
      confidence: 1.0,
      reason,
      riskScore: 1.0,
      positionSizeRatio: 0,
      expectedReturn: 0
    }

    this.state.decisions.push(decision)
    this.notifySubscribers()
  }

  private logSystemStatus(): void {
    console.log('=== Autonomous Trading Agent Status ===')
    console.log(`Enabled Strategies: ${Object.entries(this.config.enabledStrategies)
      .filter(([_, enabled]) => enabled)
      .map(([strategy, _]) => strategy)
      .join(', ')}`)
    console.log(`Analysis Interval: ${this.config.analysisInterval} minutes`)
    console.log(`Max Daily Trades: ${this.config.maxDailyTrades}`)
    console.log(`Emergency Stop Loss: ${this.config.emergencyStopLoss}%`)
    console.log('=====================================')
  }

  private updatePerformanceMetrics(): void {
    // Calculate current performance metrics
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Update time-based metrics from performance history
    const todayHistory = this.performanceHistory.filter(h => h.timestamp >= dayStart)
    const weekHistory = this.performanceHistory.filter(h => h.timestamp >= weekStart)
    const monthHistory = this.performanceHistory.filter(h => h.timestamp >= monthStart)

    if (todayHistory.length > 0) {
      this.state.dailyPnL = todayHistory[todayHistory.length - 1].pnl
      this.state.currentDrawdown = todayHistory[todayHistory.length - 1].drawdown
    }

    if (weekHistory.length > 0) {
      this.state.weeklyPnL = weekHistory[weekHistory.length - 1].pnl
    }

    if (monthHistory.length > 0) {
      this.state.monthlyPnL = monthHistory[monthHistory.length - 1].pnl
    }

    // Calculate volatility from recent performance
    if (this.performanceHistory.length > 10) {
      const recentReturns = this.performanceHistory.slice(-10).map(h => h.pnl)
      const avgReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length
      const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / recentReturns.length
      this.state.currentVolatility = Math.sqrt(variance) * 100
    }

    // Calculate Sharpe ratio (simplified)
    if (this.performanceHistory.length > 30) {
      const returns = this.performanceHistory.slice(-30).map(h => h.pnl)
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
      const stdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)
      this.state.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0
    }

    // Update max drawdown
    if (this.state.currentDrawdown > this.state.maxDrawdown) {
      this.state.maxDrawdown = this.state.currentDrawdown
    }
  }

  private determineMarketRegime(analysis: MarketAnalysis): 'bull' | 'bear' | 'sideways' | 'volatile' {
    // Simple market regime detection based on analysis
    const confidence = analysis.confidence
    const signal = analysis.signal

    // High volatility regime
    if (this.state.currentVolatility > 30) {
      return 'volatile'
    }

    // Bull market - strong buy signals with high confidence
    if (signal === 'BUY' && confidence > 0.8) {
      return 'bull'
    }

    // Bear market - strong sell signals with high confidence
    if (signal === 'SELL' && confidence > 0.8) {
      return 'bear'
    }

    // Default to sideways market
    return 'sideways'
  }

  private calculateRiskScore(analysis: MarketAnalysis, riskMetrics: RiskMetrics): number {
    let riskScore = 0

    // Base risk from confidence (lower confidence = higher risk)
    riskScore += (1 - analysis.confidence) * 0.3

    // Risk from current drawdown
    riskScore += riskMetrics.currentDrawdown * 0.002 // 0.2% per 1% drawdown

    // Risk from portfolio risk
    riskScore += riskMetrics.portfolioRisk * 0.01

    // Risk from volatility
    riskScore += this.state.currentVolatility * 0.01

    // Risk from position size
    const positionRatio = analysis.positionSize / 10000 // Assuming 10k balance
    riskScore += positionRatio * 0.2

    return Math.min(1, Math.max(0, riskScore))
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    if (this.heartbeatId) {
      clearInterval(this.heartbeatId)
      this.heartbeatId = null
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

    if (this.heartbeatId) {
      clearInterval(this.heartbeatId)
      this.heartbeatId = null
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
          marketRegime: this.state.currentMarketRegime,
          action: "SKIP",
          strategy: 'ensemble',
          confidence: 0,
          reason: "Outside trading hours",
          riskScore: 0,
          positionSizeRatio: 0,
          expectedReturn: 0
        })
        return
      }

      // Check daily trade limit
      if (this.state.dailyTrades >= this.config.maxDailyTrades) {
        this.addDecision({
          analysis: {} as MarketAnalysis,
          marketRegime: this.state.currentMarketRegime,
          action: "SKIP",
          strategy: 'ensemble',
          confidence: 0,
          reason: "Daily trade limit reached",
          riskScore: 0,
          positionSizeRatio: 0,
          expectedReturn: 0
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
    const marketRegime = this.determineMarketRegime(analysis)

    const decision: AgentDecision = {
      id: `decision_${Date.now()}`,
      timestamp: new Date(),
      analysis,
      marketRegime,
      action: "HOLD",
      strategy: 'ai',
      confidence: analysis.confidence,
      reason: "",
      riskMetrics,
      riskScore: this.calculateRiskScore(analysis, riskMetrics),
      positionSizeRatio: analysis.positionSize / balance,
      expectedReturn: analysis.riskReward || 0
    }

    // Check AI confidence threshold
    if (analysis.confidence < 0.7) {
      decision.action = "HOLD"
      decision.reason = `AI confidence too low: ${(analysis.confidence * 100).toFixed(1)}%`
      return decision
    }

    // Skip if signal is HOLD
    if (analysis.signal === "HOLD") {
      decision.reason = "AI analysis suggests holding position"
      return decision
    }

    // Check risk limits for BUY/SELL signals
    const tradeAllowed = this.riskManager.shouldAllowTrade(
      analysis.signal as "BUY" | "SELL",
      "BTC-USD", // Default symbol - should be configurable
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
        symbol: "BTC-USD", // Default symbol - should be configurable
        side: analysis.signal as "BUY" | "SELL",
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
      marketRegime: this.state.currentMarketRegime,
      action: "SKIP",
      strategy: 'ensemble',
      confidence: 0,
      reason: errorMsg,
      riskMetrics,
      riskScore: 1.0,
      positionSizeRatio: 0,
      expectedReturn: 0
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
          change: (Math.random() - 0.5) * 10,
          changePercent: (Math.random() - 0.5) * 5,
          volume: Math.random() * 1000000,
          high24h: 46000,
          low24h: 44000,
          lastUpdated: Date.now()
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
