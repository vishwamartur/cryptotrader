import type { Position, MarketData } from "./types"

export interface RiskMetrics {
  totalExposure: number
  portfolioRisk: number
  maxDrawdown: number
  currentDrawdown: number
  sharpeRatio: number
  winRate: number
  avgWin: number
  avgLoss: number
  riskRewardRatio: number
  valueAtRisk: number
}

export interface RiskLimits {
  maxPortfolioRisk: number // Maximum portfolio risk percentage
  maxPositionSize: number // Maximum single position size
  maxDrawdown: number // Maximum allowed drawdown
  maxDailyLoss: number // Maximum daily loss limit
  maxOpenPositions: number // Maximum number of open positions
  correlationLimit: number // Maximum correlation between positions
}

export interface RiskAlert {
  id: string
  type: "warning" | "critical"
  message: string
  timestamp: Date
  metric: string
  currentValue: number
  threshold: number
}

export class RiskManager {
  private limits: RiskLimits
  private alerts: RiskAlert[] = []
  private dailyPnL = 0
  private startOfDayBalance = 0

  constructor(limits: RiskLimits) {
    this.limits = limits
    this.startOfDayBalance = 0
  }

  calculateRiskMetrics(
    positions: Position[],
    balance: number,
    marketData: MarketData[],
    historicalPnL: number[] = [],
  ): RiskMetrics {
    const totalExposure = this.calculateTotalExposure(positions)
    const portfolioRisk = this.calculatePortfolioRisk(positions, balance)
    const currentDrawdown = this.calculateCurrentDrawdown(balance, historicalPnL)
    const maxDrawdown = this.calculateMaxDrawdown(historicalPnL)
    const valueAtRisk = this.calculateVaR(positions, marketData)

    // Calculate performance metrics
    const wins = historicalPnL.filter((pnl) => pnl > 0)
    const losses = historicalPnL.filter((pnl) => pnl < 0)

    const winRate = historicalPnL.length > 0 ? wins.length / historicalPnL.length : 0
    const avgWin = wins.length > 0 ? wins.reduce((sum, win) => sum + win, 0) / wins.length : 0
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, loss) => sum + loss, 0) / losses.length) : 0
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0

    const sharpeRatio = this.calculateSharpeRatio(historicalPnL)

    return {
      totalExposure,
      portfolioRisk,
      maxDrawdown,
      currentDrawdown,
      sharpeRatio,
      winRate,
      avgWin,
      avgLoss,
      riskRewardRatio,
      valueAtRisk,
    }
  }

  private calculateTotalExposure(positions: Position[]): number {
    return positions.reduce((total, position) => {
      return total + Math.abs(position.size * position.entryPrice)
    }, 0)
  }

  private calculatePortfolioRisk(positions: Position[], balance: number): number {
    const totalRisk = positions.reduce((risk, position) => {
      const positionValue = Math.abs(position.size * position.entryPrice)
      const stopLossDistance = Math.abs(position.entryPrice - (position.stopLoss || position.entryPrice * 0.95))
      const positionRisk = (stopLossDistance / position.entryPrice) * positionValue
      return risk + positionRisk
    }, 0)

    return balance > 0 ? (totalRisk / balance) * 100 : 0
  }

  private calculateCurrentDrawdown(currentBalance: number, historicalPnL: number[]): number {
    if (historicalPnL.length === 0) return 0

    let peak = this.startOfDayBalance
    for (const pnl of historicalPnL) {
      peak = Math.max(peak, peak + pnl)
    }

    return peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0
  }

  private calculateMaxDrawdown(historicalPnL: number[]): number {
    if (historicalPnL.length === 0) return 0

    let peak = this.startOfDayBalance
    let maxDrawdown = 0
    let currentBalance = this.startOfDayBalance

    for (const pnl of historicalPnL) {
      currentBalance += pnl
      peak = Math.max(peak, currentBalance)
      const drawdown = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0
      maxDrawdown = Math.max(maxDrawdown, drawdown)
    }

    return maxDrawdown
  }

  private calculateVaR(positions: Position[], marketData: MarketData[], confidenceLevel = 0.95): number {
    // Simplified VaR calculation using historical simulation
    const portfolioValue = positions.reduce((total, pos) => total + Math.abs(pos.size * pos.entryPrice), 0)

    // Calculate average volatility from market data
    const avgVolatility = marketData.reduce((sum, data) => sum + Math.abs(data.change24h), 0) / marketData.length

    // VaR = Portfolio Value * Volatility * Z-score for confidence level
    const zScore = confidenceLevel === 0.95 ? 1.645 : 2.33 // 95% or 99%
    return portfolioValue * (avgVolatility / 100) * zScore
  }

  private calculateSharpeRatio(historicalPnL: number[], riskFreeRate = 0.02): number {
    if (historicalPnL.length < 2) return 0

    const avgReturn = historicalPnL.reduce((sum, pnl) => sum + pnl, 0) / historicalPnL.length
    const variance = historicalPnL.reduce((sum, pnl) => sum + Math.pow(pnl - avgReturn, 2), 0) / historicalPnL.length
    const stdDev = Math.sqrt(variance)

    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0
  }

  checkRiskLimits(metrics: RiskMetrics, positions: Position[], balance: number): RiskAlert[] {
    const newAlerts: RiskAlert[] = []

    // Check portfolio risk limit
    if (metrics.portfolioRisk > this.limits.maxPortfolioRisk) {
      newAlerts.push({
        id: `portfolio-risk-${Date.now()}`,
        type: "critical",
        message: `Portfolio risk (${metrics.portfolioRisk.toFixed(1)}%) exceeds limit (${this.limits.maxPortfolioRisk}%)`,
        timestamp: new Date(),
        metric: "portfolioRisk",
        currentValue: metrics.portfolioRisk,
        threshold: this.limits.maxPortfolioRisk,
      })
    }

    // Check drawdown limit
    if (metrics.currentDrawdown > this.limits.maxDrawdown) {
      newAlerts.push({
        id: `drawdown-${Date.now()}`,
        type: "critical",
        message: `Current drawdown (${metrics.currentDrawdown.toFixed(1)}%) exceeds limit (${this.limits.maxDrawdown}%)`,
        timestamp: new Date(),
        metric: "drawdown",
        currentValue: metrics.currentDrawdown,
        threshold: this.limits.maxDrawdown,
      })
    }

    // Check daily loss limit
    if (this.dailyPnL < -this.limits.maxDailyLoss) {
      newAlerts.push({
        id: `daily-loss-${Date.now()}`,
        type: "critical",
        message: `Daily loss ($${Math.abs(this.dailyPnL).toFixed(2)}) exceeds limit ($${this.limits.maxDailyLoss})`,
        timestamp: new Date(),
        metric: "dailyLoss",
        currentValue: Math.abs(this.dailyPnL),
        threshold: this.limits.maxDailyLoss,
      })
    }

    // Check maximum open positions
    if (positions.length > this.limits.maxOpenPositions) {
      newAlerts.push({
        id: `max-positions-${Date.now()}`,
        type: "warning",
        message: `Open positions (${positions.length}) exceed limit (${this.limits.maxOpenPositions})`,
        timestamp: new Date(),
        metric: "openPositions",
        currentValue: positions.length,
        threshold: this.limits.maxOpenPositions,
      })
    }

    // Check individual position sizes
    positions.forEach((position, index) => {
      const positionSize = (Math.abs(position.size * position.entryPrice) / balance) * 100
      if (positionSize > this.limits.maxPositionSize) {
        newAlerts.push({
          id: `position-size-${index}-${Date.now()}`,
          type: "warning",
          message: `Position ${position.symbol} size (${positionSize.toFixed(1)}%) exceeds limit (${this.limits.maxPositionSize}%)`,
          timestamp: new Date(),
          metric: "positionSize",
          currentValue: positionSize,
          threshold: this.limits.maxPositionSize,
        })
      }
    })

    this.alerts = [...this.alerts, ...newAlerts].slice(-50) // Keep last 50 alerts
    return newAlerts
  }

  calculateOptimalPositionSize(balance: number, entryPrice: number, stopLoss: number, riskPerTrade = 2): number {
    const riskAmount = balance * (riskPerTrade / 100)
    const priceRisk = Math.abs(entryPrice - stopLoss)

    if (priceRisk === 0) return 0

    const positionSize = riskAmount / priceRisk
    const maxPositionValue = balance * (this.limits.maxPositionSize / 100)
    const maxSize = maxPositionValue / entryPrice

    return Math.min(positionSize, maxSize)
  }

  shouldAllowTrade(
    signal: "BUY" | "SELL",
    symbol: string,
    positionSize: number,
    currentPositions: Position[],
    balance: number,
  ): { allowed: boolean; reason?: string } {
    // Check if daily loss limit would be exceeded
    if (this.dailyPnL < -this.limits.maxDailyLoss) {
      return { allowed: false, reason: "Daily loss limit exceeded" }
    }

    // Check if max positions limit would be exceeded
    if (currentPositions.length >= this.limits.maxOpenPositions) {
      return { allowed: false, reason: "Maximum open positions limit reached" }
    }

    // Check if position size exceeds limit
    const positionValue = positionSize * 1 // Assuming price of 1 for calculation
    const positionSizePercent = (positionValue / balance) * 100
    if (positionSizePercent > this.limits.maxPositionSize) {
      return { allowed: false, reason: "Position size exceeds limit" }
    }

    return { allowed: true }
  }

  updateDailyPnL(pnl: number): void {
    this.dailyPnL += pnl
  }

  resetDailyPnL(): void {
    this.dailyPnL = 0
    this.startOfDayBalance = 0
  }

  getAlerts(): RiskAlert[] {
    return this.alerts
  }

  updateLimits(newLimits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...newLimits }
  }
}
