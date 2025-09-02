import { tradeMonitor, type Trade } from "./trade-monitor"
import { takeProfitSystem } from "./take-profit-system"
import type { RiskManager } from "./risk-management"
import type { AITradingEngine } from "./ai-trading-engine"
import type { MarketData } from "./types"

export interface ManagedPosition {
  id: string
  symbol: string
  side: "BUY" | "SELL"
  size: number
  entryPrice: number
  currentPrice: number
  unrealizedPnL: number
  realizedPnL: number
  totalPnL: number
  entryTime: Date
  lastUpdate: Date
  status: "OPEN" | "CLOSING" | "CLOSED"

  // Integration data
  trades: Trade[]
  takeProfitActive: boolean
  takeProfitStrategy?: string
  aiGenerated: boolean
  aiConfidence?: number
  riskScore: number

  // Performance metrics
  maxUnrealizedPnL: number
  maxDrawdown: number
  holdingPeriod: number // in hours
  commission: number
}

export interface PositionAllocation {
  symbol: string
  targetPercentage: number
  currentPercentage: number
  deviation: number
  rebalanceNeeded: boolean
}

export interface PortfolioMetrics {
  totalValue: number
  totalPnL: number
  totalUnrealizedPnL: number
  totalRealizedPnL: number
  totalCommission: number
  netPnL: number

  // Performance metrics
  totalReturn: number
  dailyReturn: number
  volatility: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number

  // Position metrics
  totalPositions: number
  openPositions: number
  profitablePositions: number
  avgPositionSize: number
  largestPosition: number

  // Risk metrics
  portfolioRisk: number
  concentration: number
  correlation: number
}

export interface RebalanceAction {
  symbol: string
  action: "BUY" | "SELL" | "HOLD"
  currentSize: number
  targetSize: number
  sizeChange: number
  reason: string
  priority: "HIGH" | "MEDIUM" | "LOW"
}

export class PositionManager {
  private positions: Map<string, ManagedPosition> = new Map()
  private allocations: Map<string, PositionAllocation> = new Map()
  private riskManager: RiskManager
  private aiEngine: AITradingEngine | null = null
  private subscribers: ((positions: ManagedPosition[]) => void)[] = []
  private marketData: Map<string, MarketData> = new Map()
  private portfolioValue = 10000 // Starting portfolio value
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null

  constructor(riskManager: RiskManager) {
    this.riskManager = riskManager
    this.initializeIntegrations()
  }

  private initializeIntegrations(): void {
    // Subscribe to trade monitor updates
    tradeMonitor.subscribe((trades) => {
      this.syncWithTrades(trades)
    })

    // Subscribe to take profit system events
    takeProfitSystem.subscribe((events) => {
      this.syncWithTakeProfitEvents(events)
    })
  }

  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    takeProfitSystem.start()

    // Start position monitoring
    this.intervalId = setInterval(() => {
      this.updatePositions()
    }, 5000) // Update every 5 seconds

    console.log("Position manager started")
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    takeProfitSystem.stop()
    console.log("Position manager stopped")
  }

  addPosition(trade: Trade, aiGenerated = false, aiConfidence?: number): ManagedPosition {
    const existingPosition = this.findPositionBySymbol(trade.symbol, trade.side)

    if (existingPosition) {
      // Add to existing position
      return this.addToPosition(existingPosition, trade, aiGenerated, aiConfidence)
    } else {
      // Create new position
      return this.createNewPosition(trade, aiGenerated, aiConfidence)
    }
  }

  private createNewPosition(trade: Trade, aiGenerated: boolean, aiConfidence?: number): ManagedPosition {
    const position: ManagedPosition = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      symbol: trade.symbol,
      side: trade.side,
      size: trade.size,
      entryPrice: trade.executedPrice || trade.price,
      currentPrice: trade.executedPrice || trade.price,
      unrealizedPnL: 0,
      realizedPnL: 0,
      totalPnL: 0,
      entryTime: trade.executedAt || trade.timestamp,
      lastUpdate: new Date(),
      status: "OPEN",
      trades: [trade],
      takeProfitActive: false,
      aiGenerated,
      aiConfidence,
      riskScore: this.calculateRiskScore(trade),
      maxUnrealizedPnL: 0,
      maxDrawdown: 0,
      holdingPeriod: 0,
      commission: trade.commission,
    }

    this.positions.set(position.id, position)
    this.notifySubscribers()

    console.log(`Created new position: ${position.symbol} ${position.side} ${position.size}`)
    return position
  }

  private addToPosition(
    position: ManagedPosition,
    trade: Trade,
    aiGenerated: boolean,
    aiConfidence?: number,
  ): ManagedPosition {
    // Calculate new average entry price
    const totalValue = position.size * position.entryPrice + trade.size * (trade.executedPrice || trade.price)
    const totalSize = position.size + trade.size

    position.entryPrice = totalValue / totalSize
    position.size = totalSize
    position.trades.push(trade)
    position.commission += trade.commission
    position.lastUpdate = new Date()

    if (aiGenerated) {
      position.aiGenerated = true
      position.aiConfidence = aiConfidence
    }

    this.positions.set(position.id, position)
    this.notifySubscribers()

    console.log(`Added to position: ${position.symbol} new size ${position.size}`)
    return position
  }

  private findPositionBySymbol(symbol: string, side: "BUY" | "SELL"): ManagedPosition | undefined {
    return Array.from(this.positions.values()).find(
      (pos) => pos.symbol === symbol && pos.side === side && pos.status === "OPEN",
    )
  }

  closePosition(positionId: string, price?: number): void {
    const position = this.positions.get(positionId)
    if (!position || position.status !== "OPEN") return

    const closePrice = price || position.currentPrice

    // Create closing trade
    const closeTrade = tradeMonitor.addTrade({
      symbol: position.symbol,
      side: position.side === "BUY" ? "SELL" : "BUY",
      type: "MARKET",
      size: position.size,
      price: closePrice,
      commission: 0.1,
      source: "MANUAL",
      status: "FILLED",
    })

    // Update position
    position.status = "CLOSED"
    position.realizedPnL = this.calculateRealizedPnL(position, closePrice)
    position.totalPnL = position.realizedPnL
    position.trades.push(closeTrade)
    position.lastUpdate = new Date()

    // Remove from take profit system
    if (position.takeProfitActive) {
      takeProfitSystem.removePosition(closeTrade.id)
    }

    this.notifySubscribers()
    console.log(`Closed position: ${position.symbol} P&L: ${position.realizedPnL.toFixed(2)}`)
  }

  updateMarketData(symbol: string, data: MarketData): void {
    this.marketData.set(symbol, data)
    takeProfitSystem.updateMarketData(symbol, data)
  }

  private updatePositions(): void {
    for (const [id, position] of this.positions) {
      if (position.status !== "OPEN") continue

      const marketData = this.marketData.get(position.symbol)
      if (!marketData) continue

      // Update current price and P&L
      position.currentPrice = marketData.price
      position.unrealizedPnL = this.calculateUnrealizedPnL(position)
      position.totalPnL = position.realizedPnL + position.unrealizedPnL
      position.holdingPeriod = (Date.now() - position.entryTime.getTime()) / (1000 * 60 * 60) // hours

      // Update performance metrics
      position.maxUnrealizedPnL = Math.max(position.maxUnrealizedPnL, position.unrealizedPnL)
      if (position.unrealizedPnL < 0) {
        position.maxDrawdown = Math.max(position.maxDrawdown, Math.abs(position.unrealizedPnL))
      }

      // Update risk score
      position.riskScore = this.calculateRiskScore(position)

      position.lastUpdate = new Date()
    }

    this.notifySubscribers()
  }

  private calculateUnrealizedPnL(position: ManagedPosition): number {
    if (position.side === "BUY") {
      return (position.currentPrice - position.entryPrice) * position.size
    } else {
      return (position.entryPrice - position.currentPrice) * position.size
    }
  }

  private calculateRealizedPnL(position: ManagedPosition, closePrice: number): number {
    if (position.side === "BUY") {
      return (closePrice - position.entryPrice) * position.size - position.commission
    } else {
      return (position.entryPrice - closePrice) * position.size - position.commission
    }
  }

  private calculateRiskScore(position: ManagedPosition | Trade): number {
    // Simple risk scoring based on position size and volatility
    const marketData = this.marketData.get(position.symbol)
    const volatility = marketData ? Math.abs(marketData.change) : 5

    const positionValue = position.size * (('executedPrice' in position ? position.executedPrice : 0) || ('price' in position ? (position as any).price : 0) || 0)
    const portfolioPercentage = (positionValue / this.portfolioValue) * 100

    // Risk score from 1-10 (10 being highest risk)
    let riskScore = Math.min(10, portfolioPercentage / 2) // Base on position size
    riskScore += Math.min(3, volatility / 5) // Add volatility component

    return Math.round(riskScore * 10) / 10
  }

  calculatePortfolioMetrics(): PortfolioMetrics {
    const openPositions = Array.from(this.positions.values()).filter((p) => p.status === "OPEN")
    const allPositions = Array.from(this.positions.values())

    const totalUnrealizedPnL = openPositions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0)
    const totalRealizedPnL = allPositions.reduce((sum, pos) => sum + pos.realizedPnL, 0)
    const totalCommission = allPositions.reduce((sum, pos) => sum + pos.commission, 0)
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL
    const netPnL = totalPnL - totalCommission

    const totalValue = this.portfolioValue + totalUnrealizedPnL
    const totalReturn = (netPnL / this.portfolioValue) * 100

    const profitablePositions = allPositions.filter((p) => p.totalPnL > 0).length
    const winRate = allPositions.length > 0 ? profitablePositions / allPositions.length : 0

    const positionValues = openPositions.map((p) => p.size * p.currentPrice)
    const avgPositionSize =
      positionValues.length > 0 ? positionValues.reduce((sum, val) => sum + val, 0) / positionValues.length : 0
    const largestPosition = positionValues.length > 0 ? Math.max(...positionValues) : 0

    const concentration = largestPosition / totalValue
    // Calculate portfolio risk using public method
    const mockPositions: any[] = openPositions.map((p) => ({
      user_id: 1,
      size: p.size.toString(),
      entry_price: p.entryPrice.toString(),
      margin: "0",
      liquidation_price: "0",
      bankruptcy_price: "0",
      adl_level: 0,
      auto_topup: false,
      realized_pnl: p.unrealizedPnL.toString(),
      realized_funding: "0",
      product: { symbol: p.symbol, description: p.symbol }
    }));

    const portfolioRisk = this.riskManager.getRiskMetrics(mockPositions, totalValue).portfolioRisk || 0;

    return {
      totalValue,
      totalPnL,
      totalUnrealizedPnL,
      totalRealizedPnL,
      totalCommission,
      netPnL,
      totalReturn,
      dailyReturn: 0, // Would need historical data
      volatility: 0, // Would need historical data
      sharpeRatio: 0, // Would need historical data
      maxDrawdown: Math.max(...allPositions.map((p) => p.maxDrawdown)),
      winRate,
      totalPositions: allPositions.length,
      openPositions: openPositions.length,
      profitablePositions,
      avgPositionSize,
      largestPosition,
      portfolioRisk,
      concentration: concentration * 100,
      correlation: 0, // Would need correlation analysis
    }
  }

  setTargetAllocation(symbol: string, percentage: number): void {
    this.allocations.set(symbol, {
      symbol,
      targetPercentage: percentage,
      currentPercentage: 0,
      deviation: 0,
      rebalanceNeeded: false,
    })
  }

  calculateRebalanceActions(): RebalanceAction[] {
    const actions: RebalanceAction[] = []
    const metrics = this.calculatePortfolioMetrics()

    for (const [symbol, allocation] of this.allocations) {
      const position = this.findPositionBySymbol(symbol, "BUY")
      const currentValue = position ? position.size * position.currentPrice : 0
      const currentPercentage = (currentValue / metrics.totalValue) * 100

      allocation.currentPercentage = currentPercentage
      allocation.deviation = Math.abs(currentPercentage - allocation.targetPercentage)
      allocation.rebalanceNeeded = allocation.deviation > 2 // 2% threshold

      if (allocation.rebalanceNeeded) {
        const targetValue = (allocation.targetPercentage / 100) * metrics.totalValue
        const marketData = this.marketData.get(symbol)

        if (marketData) {
          const targetSize = targetValue / marketData.price
          const currentSize = position ? position.size : 0
          const sizeChange = targetSize - currentSize

          actions.push({
            symbol,
            action: sizeChange > 0 ? "BUY" : sizeChange < 0 ? "SELL" : "HOLD",
            currentSize,
            targetSize,
            sizeChange: Math.abs(sizeChange),
            reason: `Rebalance to ${allocation.targetPercentage}% (current: ${currentPercentage.toFixed(1)}%)`,
            priority: allocation.deviation > 5 ? "HIGH" : allocation.deviation > 3 ? "MEDIUM" : "LOW",
          })
        }
      }
    }

    return actions.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  enableTakeProfit(positionId: string, strategyId: string): void {
    const position = this.positions.get(positionId)
    if (!position || position.status !== "OPEN") return

    // Create a mock trade for take profit system
    const mockTrade: Trade = {
      id: `tp_${position.id}`,
      symbol: position.symbol,
      side: position.side,
      type: "LIMIT",
      size: position.size,
      price: position.entryPrice,
      executedPrice: position.entryPrice,
      status: "FILLED",
      timestamp: position.entryTime,
      executedAt: position.entryTime,
      commission: 0,
      source: "MANUAL",
    }

    takeProfitSystem.addPosition(mockTrade, strategyId)
    position.takeProfitActive = true
    position.takeProfitStrategy = strategyId

    this.notifySubscribers()
  }

  private syncWithTrades(trades: Trade[]): void {
    // Sync with new trades from trade monitor
    const newTrades = trades.filter(
      (trade) => !Array.from(this.positions.values()).some((pos) => pos.trades.some((t) => t.id === trade.id)),
    )

    for (const trade of newTrades) {
      if (trade.status === "FILLED" && trade.source !== "TAKE_PROFIT") {
        this.addPosition(trade, trade.source === "AI", trade.aiConfidence)
      }
    }
  }

  private syncWithTakeProfitEvents(events: any[]): void {
    // Handle take profit events
    for (const event of events) {
      if (event.type === "PARTIAL_CLOSE" || event.type === "FULL_CLOSE") {
        // Update position based on take profit execution
        const position = Array.from(this.positions.values()).find((p) =>
          p.trades.some((t) => t.id === event.positionId),
        )

        if (position) {
          position.realizedPnL += event.profit
          position.totalPnL = position.realizedPnL + position.unrealizedPnL

          if (event.type === "FULL_CLOSE") {
            position.status = "CLOSED"
            position.takeProfitActive = false
          }
        }
      }
    }
  }

  // Public getters
  getPositions(): ManagedPosition[] {
    return Array.from(this.positions.values())
  }

  getOpenPositions(): ManagedPosition[] {
    return Array.from(this.positions.values()).filter((p) => p.status === "OPEN")
  }

  getPosition(id: string): ManagedPosition | undefined {
    return this.positions.get(id)
  }

  getAllocations(): PositionAllocation[] {
    return Array.from(this.allocations.values())
  }

  subscribe(callback: (positions: ManagedPosition[]) => void): () => void {
    this.subscribers.push(callback)
    return () => {
      const index = this.subscribers.indexOf(callback)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.getPositions()))
  }

  setAIEngine(aiEngine: AITradingEngine): void {
    this.aiEngine = aiEngine
  }
}
