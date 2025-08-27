export interface Trade {
  id: string
  symbol: string
  side: "BUY" | "SELL"
  type: "MARKET" | "LIMIT" | "STOP_LOSS" | "TAKE_PROFIT"
  size: number
  price: number
  executedPrice?: number
  status: "PENDING" | "FILLED" | "PARTIALLY_FILLED" | "CANCELLED" | "REJECTED"
  timestamp: Date
  executedAt?: Date
  pnl?: number
  commission: number
  source: "MANUAL" | "AI" | "STOP_LOSS" | "TAKE_PROFIT"
  aiConfidence?: number
  aiReasoning?: string
}

export interface TradeMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPnL: number
  totalCommission: number
  netPnL: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  profitFactor: number
  avgHoldTime: number
  tradesPerDay: number
}

export interface TradeAlert {
  id: string
  type: "EXECUTION" | "FILL" | "REJECTION" | "PROFIT_TARGET" | "STOP_LOSS"
  message: string
  trade: Trade
  timestamp: Date
  severity: "info" | "success" | "warning" | "error"
}

export class TradeMonitor {
  private trades: Trade[] = []
  private alerts: TradeAlert[] = []
  private subscribers: ((trades: Trade[]) => void)[] = []
  private alertSubscribers: ((alert: TradeAlert) => void)[] = []

  addTrade(trade: Omit<Trade, "id" | "timestamp">): Trade {
    const newTrade: Trade = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    }

    this.trades.unshift(newTrade)
    this.notifySubscribers()

    // Create execution alert
    const alert: TradeAlert = {
      id: `alert_${Date.now()}`,
      type: "EXECUTION",
      message: `${trade.side} order for ${trade.size} ${trade.symbol} at $${trade.price}`,
      trade: newTrade,
      timestamp: new Date(),
      severity: "info",
    }

    this.addAlert(alert)
    return newTrade
  }

  updateTrade(tradeId: string, updates: Partial<Trade>): void {
    const tradeIndex = this.trades.findIndex((t) => t.id === tradeId)
    if (tradeIndex === -1) return

    const oldTrade = this.trades[tradeIndex]
    this.trades[tradeIndex] = { ...oldTrade, ...updates }

    // Create alerts for status changes
    if (updates.status && updates.status !== oldTrade.status) {
      let alertType: TradeAlert["type"] = "EXECUTION"
      let severity: TradeAlert["severity"] = "info"
      let message = ""

      switch (updates.status) {
        case "FILLED":
          alertType = "FILL"
          severity = "success"
          message = `${oldTrade.side} order filled: ${oldTrade.size} ${oldTrade.symbol} at $${updates.executedPrice || oldTrade.price}`
          break
        case "REJECTED":
          alertType = "REJECTION"
          severity = "error"
          message = `${oldTrade.side} order rejected: ${oldTrade.symbol}`
          break
        case "CANCELLED":
          severity = "warning"
          message = `${oldTrade.side} order cancelled: ${oldTrade.symbol}`
          break
      }

      if (message) {
        this.addAlert({
          id: `alert_${Date.now()}`,
          type: alertType,
          message,
          trade: this.trades[tradeIndex],
          timestamp: new Date(),
          severity,
        })
      }
    }

    this.notifySubscribers()
  }

  private addAlert(alert: TradeAlert): void {
    this.alerts.unshift(alert)
    this.alerts = this.alerts.slice(0, 100) // Keep last 100 alerts
    this.alertSubscribers.forEach((callback) => callback(alert))
  }

  calculateMetrics(timeframe: "1D" | "7D" | "30D" | "ALL" = "ALL"): TradeMetrics {
    let filteredTrades = this.trades.filter((t) => t.status === "FILLED")

    // Filter by timeframe
    if (timeframe !== "ALL") {
      const now = new Date()
      const days = timeframe === "1D" ? 1 : timeframe === "7D" ? 7 : 30
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      filteredTrades = filteredTrades.filter((t) => t.executedAt && t.executedAt >= cutoff)
    }

    const totalTrades = filteredTrades.length
    const winningTrades = filteredTrades.filter((t) => (t.pnl || 0) > 0)
    const losingTrades = filteredTrades.filter((t) => (t.pnl || 0) < 0)

    const totalPnL = filteredTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const totalCommission = filteredTrades.reduce((sum, t) => sum + t.commission, 0)
    const netPnL = totalPnL - totalCommission

    const winPnLs = winningTrades.map((t) => t.pnl || 0)
    const lossPnLs = losingTrades.map((t) => Math.abs(t.pnl || 0))

    const avgWin = winPnLs.length > 0 ? winPnLs.reduce((sum, pnl) => sum + pnl, 0) / winPnLs.length : 0
    const avgLoss = lossPnLs.length > 0 ? lossPnLs.reduce((sum, pnl) => sum + pnl, 0) / lossPnLs.length : 0

    const largestWin = winPnLs.length > 0 ? Math.max(...winPnLs) : 0
    const largestLoss = lossPnLs.length > 0 ? Math.max(...lossPnLs) : 0

    const grossProfit = winPnLs.reduce((sum, pnl) => sum + pnl, 0)
    const grossLoss = lossPnLs.reduce((sum, pnl) => sum + pnl, 0)
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0

    // Calculate average hold time
    const holdTimes = filteredTrades
      .filter((t) => t.executedAt)
      .map((t) => (t.executedAt!.getTime() - t.timestamp.getTime()) / (1000 * 60 * 60)) // hours

    const avgHoldTime = holdTimes.length > 0 ? holdTimes.reduce((sum, time) => sum + time, 0) / holdTimes.length : 0

    // Calculate trades per day
    const daysSinceFirstTrade =
      filteredTrades.length > 0
        ? Math.max(
            1,
            (Date.now() - filteredTrades[filteredTrades.length - 1].timestamp.getTime()) / (1000 * 60 * 60 * 24),
          )
        : 1
    const tradesPerDay = totalTrades / daysSinceFirstTrade

    return {
      totalTrades,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: totalTrades > 0 ? winningTrades.length / totalTrades : 0,
      totalPnL,
      totalCommission,
      netPnL,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,
      avgHoldTime,
      tradesPerDay,
    }
  }

  getTrades(limit = 50): Trade[] {
    return this.trades.slice(0, limit)
  }

  getAlerts(limit = 20): TradeAlert[] {
    return this.alerts.slice(0, limit)
  }

  getTradeById(id: string): Trade | undefined {
    return this.trades.find((t) => t.id === id)
  }

  subscribe(callback: (trades: Trade[]) => void): () => void {
    this.subscribers.push(callback)
    return () => {
      const index = this.subscribers.indexOf(callback)
      if (index > -1) {
        this.subscribers.splice(index, 1)
      }
    }
  }

  subscribeToAlerts(callback: (alert: TradeAlert) => void): () => void {
    this.alertSubscribers.push(callback)
    return () => {
      const index = this.alertSubscribers.indexOf(callback)
      if (index > -1) {
        this.alertSubscribers.splice(index, 1)
      }
    }
  }

  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => callback(this.trades))
  }

  // Simulate trade execution updates (in real app, this would come from WebSocket)
  simulateTradeUpdate(tradeId: string): void {
    setTimeout(
      () => {
        this.updateTrade(tradeId, {
          status: "FILLED",
          executedAt: new Date(),
          executedPrice: Math.random() > 0.5 ? undefined : Math.random() * 1000,
          pnl: (Math.random() - 0.5) * 200,
        })
      },
      Math.random() * 5000 + 1000,
    ) // 1-6 seconds
  }

  clearOldTrades(days = 30): void {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    this.trades = this.trades.filter((t) => t.timestamp >= cutoff)
    this.notifySubscribers()
  }
}

// Global trade monitor instance
export const tradeMonitor = new TradeMonitor()
