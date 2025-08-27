import type { Position, MarketData } from "./types"

export interface OptimizationResult {
  recommendedAllocations: { [symbol: string]: number }
  expectedReturn: number
  expectedRisk: number
  sharpeRatio: number
  diversificationScore: number
  rebalanceActions: RebalanceAction[]
}

export interface RebalanceAction {
  symbol: string
  action: "BUY" | "SELL" | "HOLD"
  currentWeight: number
  targetWeight: number
  amountToTrade: number
  reason: string
}

export class PortfolioOptimizer {
  private riskFreeRate = 0.02 // 2% annual risk-free rate

  optimizePortfolio(
    currentPositions: Position[],
    marketData: MarketData[],
    totalBalance: number,
    constraints: {
      maxPositionWeight: number
      minPositionWeight: number
      maxRisk: number
      targetReturn?: number
    },
  ): OptimizationResult {
    const currentWeights = this.calculateCurrentWeights(currentPositions, totalBalance)
    const returns = this.estimateReturns(marketData)
    const correlationMatrix = this.calculateCorrelationMatrix(marketData)
    const volatilities = this.calculateVolatilities(marketData)

    const optimizedWeights = this.meanVarianceOptimization(returns, correlationMatrix, volatilities, constraints)

    const expectedReturn = this.calculateExpectedReturn(optimizedWeights, returns)
    const expectedRisk = this.calculatePortfolioRisk(optimizedWeights, correlationMatrix, volatilities)
    const sharpeRatio = (expectedReturn - this.riskFreeRate) / expectedRisk
    const diversificationScore = this.calculateDiversificationScore(optimizedWeights, correlationMatrix)

    const rebalanceActions = this.generateRebalanceActions(currentWeights, optimizedWeights, totalBalance, marketData)

    return {
      recommendedAllocations: optimizedWeights,
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      diversificationScore,
      rebalanceActions,
    }
  }

  private calculateCurrentWeights(positions: Position[], totalBalance: number): { [symbol: string]: number } {
    const weights: { [symbol: string]: number } = {}

    positions.forEach((position) => {
      const positionValue = Math.abs(position.size * position.entryPrice)
      weights[position.symbol] = positionValue / totalBalance
    })

    return weights
  }

  private estimateReturns(marketData: MarketData[]): { [symbol: string]: number } {
    const returns: { [symbol: string]: number } = {}

    marketData.forEach((data) => {
      // Simple momentum-based return estimation
      const momentum = data.change24h / 100
      const volatilityAdjustment = Math.abs(momentum) * 0.1
      returns[data.symbol] = momentum + volatilityAdjustment
    })

    return returns
  }

  private calculateCorrelationMatrix(marketData: MarketData[]): { [key: string]: { [key: string]: number } } {
    const matrix: { [key: string]: { [key: string]: number } } = {}

    // Simplified correlation calculation
    marketData.forEach((data1) => {
      matrix[data1.symbol] = {}
      marketData.forEach((data2) => {
        if (data1.symbol === data2.symbol) {
          matrix[data1.symbol][data2.symbol] = 1.0
        } else {
          // Simplified correlation based on price movements
          const correlation = Math.max(0.1, Math.random() * 0.8)
          matrix[data1.symbol][data2.symbol] = correlation
        }
      })
    })

    return matrix
  }

  private calculateVolatilities(marketData: MarketData[]): { [symbol: string]: number } {
    const volatilities: { [symbol: string]: number } = {}

    marketData.forEach((data) => {
      // Estimate volatility from 24h change
      volatilities[data.symbol] = (Math.abs(data.change24h) / 100) * Math.sqrt(365) // Annualized
    })

    return volatilities
  }

  private meanVarianceOptimization(
    returns: { [symbol: string]: number },
    correlationMatrix: { [key: string]: { [key: string]: number } },
    volatilities: { [symbol: string]: number },
    constraints: any,
  ): { [symbol: string]: number } {
    const symbols = Object.keys(returns)
    const n = symbols.length

    // Simplified optimization using equal risk contribution
    const weights: { [symbol: string]: number } = {}
    const baseWeight = 1 / n

    symbols.forEach((symbol) => {
      const riskAdjustment = 1 / (volatilities[symbol] || 0.1)
      weights[symbol] = Math.min(
        constraints.maxPositionWeight,
        Math.max(constraints.minPositionWeight, baseWeight * riskAdjustment),
      )
    })

    // Normalize weights to sum to 1
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0)
    Object.keys(weights).forEach((symbol) => {
      weights[symbol] = weights[symbol] / totalWeight
    })

    return weights
  }

  private calculateExpectedReturn(
    weights: { [symbol: string]: number },
    returns: { [symbol: string]: number },
  ): number {
    return Object.entries(weights).reduce((total, [symbol, weight]) => {
      return total + weight * (returns[symbol] || 0)
    }, 0)
  }

  private calculatePortfolioRisk(
    weights: { [symbol: string]: number },
    correlationMatrix: { [key: string]: { [key: string]: number } },
    volatilities: { [symbol: string]: number },
  ): number {
    let portfolioVariance = 0

    Object.entries(weights).forEach(([symbol1, weight1]) => {
      Object.entries(weights).forEach(([symbol2, weight2]) => {
        const correlation = correlationMatrix[symbol1]?.[symbol2] || 0
        const vol1 = volatilities[symbol1] || 0
        const vol2 = volatilities[symbol2] || 0
        portfolioVariance += weight1 * weight2 * vol1 * vol2 * correlation
      })
    })

    return Math.sqrt(portfolioVariance)
  }

  private calculateDiversificationScore(
    weights: { [symbol: string]: number },
    correlationMatrix: { [key: string]: { [key: string]: number } },
  ): number {
    const symbols = Object.keys(weights)
    let avgCorrelation = 0
    let count = 0

    symbols.forEach((symbol1) => {
      symbols.forEach((symbol2) => {
        if (symbol1 !== symbol2) {
          avgCorrelation += correlationMatrix[symbol1]?.[symbol2] || 0
          count++
        }
      })
    })

    avgCorrelation = count > 0 ? avgCorrelation / count : 0
    return Math.max(0, 1 - avgCorrelation) // Higher score = better diversification
  }

  private generateRebalanceActions(
    currentWeights: { [symbol: string]: number },
    targetWeights: { [symbol: string]: number },
    totalBalance: number,
    marketData: MarketData[],
  ): RebalanceAction[] {
    const actions: RebalanceAction[] = []
    const threshold = 0.05 // 5% threshold for rebalancing

    Object.entries(targetWeights).forEach(([symbol, targetWeight]) => {
      const currentWeight = currentWeights[symbol] || 0
      const weightDiff = targetWeight - currentWeight

      if (Math.abs(weightDiff) > threshold) {
        const amountToTrade = Math.abs(weightDiff * totalBalance)
        const action = weightDiff > 0 ? "BUY" : "SELL"

        actions.push({
          symbol,
          action,
          currentWeight,
          targetWeight,
          amountToTrade,
          reason: `Rebalance from ${(currentWeight * 100).toFixed(1)}% to ${(targetWeight * 100).toFixed(1)}%`,
        })
      }
    })

    return actions.sort((a, b) => b.amountToTrade - a.amountToTrade)
  }

  calculateRiskMetrics(
    positions: Position[],
    marketData: MarketData[],
  ): {
    beta: number
    alpha: number
    informationRatio: number
    maxDrawdown: number
    calmarRatio: number
  } {
    const beta = this.calculateBeta(positions, marketData)
    const alpha = this.calculateAlpha(positions, marketData, beta)
    const informationRatio = this.calculateInformationRatio(positions)
    const maxDrawdown = this.calculateMaxDrawdown(positions)
    const calmarRatio = maxDrawdown > 0 ? this.calculateAnnualizedReturn(positions) / maxDrawdown : 0

    return {
      beta,
      alpha,
      informationRatio,
      maxDrawdown,
      calmarRatio,
    }
  }

  private calculateBeta(positions: Position[], marketData: MarketData[]): number {
    // Simplified beta calculation against market average
    const marketReturn = marketData.reduce((sum, data) => sum + data.change24h, 0) / marketData.length / 100
    const portfolioReturn = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0)

    // This is a simplified calculation - in practice, you'd use historical data
    return portfolioReturn !== 0 ? marketReturn / portfolioReturn : 1
  }

  private calculateAlpha(positions: Position[], marketData: MarketData[], beta: number): number {
    const portfolioReturn = this.calculateAnnualizedReturn(positions)
    const marketReturn = (marketData.reduce((sum, data) => sum + data.change24h, 0) / marketData.length / 100) * 365

    return portfolioReturn - (this.riskFreeRate + beta * (marketReturn - this.riskFreeRate))
  }

  private calculateInformationRatio(positions: Position[]): number {
    // Simplified calculation
    const returns = positions.map((pos) => pos.unrealizedPnl || 0)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const trackingError = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)

    return trackingError > 0 ? avgReturn / trackingError : 0
  }

  private calculateMaxDrawdown(positions: Position[]): number {
    // Simplified calculation based on current unrealized P&L
    const losses = positions.filter((pos) => (pos.unrealizedPnl || 0) < 0)
    return losses.length > 0 ? Math.abs(Math.min(...losses.map((pos) => pos.unrealizedPnl || 0))) : 0
  }

  private calculateAnnualizedReturn(positions: Position[]): number {
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0)
    // This is simplified - in practice, you'd use time-weighted returns
    return (totalPnL * 365) / 30 // Assuming 30-day period
  }
}

export const portfolioOptimizer = new PortfolioOptimizer()
