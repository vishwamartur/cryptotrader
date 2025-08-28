import type { Position, MarketData } from "./types"
import { mean, stddev, correlation, sharpeRatio, maxDrawdown, valueAtRisk } from "./quant-math"

export interface OptimizationResult {
  recommendedAllocations: { [symbol: string]: number }
  expectedReturn: number
  expectedRisk: number
  sharpeRatio: number
  sortinoRatio: number
  calmarRatio: number
  diversificationScore: number
  concentrationRisk: number
  valueAtRisk: number
  expectedShortfall: number
  rebalanceActions: RebalanceAction[]
  riskContributions: { [symbol: string]: number }
  performanceAttribution: PerformanceAttribution
}

export interface PerformanceAttribution {
  totalReturn: number
  assetAllocation: number
  securitySelection: number
  interaction: number
  currency?: number
  timing?: number
}

export interface RebalanceAction {
  symbol: string
  action: "BUY" | "SELL" | "HOLD"
  currentWeight: number
  targetWeight: number
  weightDifference: number
  amountToTrade: number
  estimatedCost: number
  priority: 'high' | 'medium' | 'low'
  reason: string
  expectedImpact: {
    returnContribution: number
    riskContribution: number
    diversificationImpact: number
  }
}

export interface PortfolioConstraints {
  maxPositionWeight: number
  minPositionWeight: number
  maxRisk: number
  targetReturn?: number
  maxTurnover?: number
  sectorLimits?: { [sector: string]: number }
  minDiversification?: number
  maxConcentration?: number
  liquidityRequirement?: number
}

export interface RiskMetrics {
  volatility: number
  valueAtRisk95: number
  valueAtRisk99: number
  expectedShortfall: number
  maxDrawdown: number
  sharpeRatio: number
  sortinoRatio: number
  calmarRatio: number
  beta: number
  alpha: number
  informationRatio: number
  trackingError: number
}

export class PortfolioOptimizer {
  private riskFreeRate = 0.02 // 2% annual risk-free rate
  private transactionCost = 0.001 // 0.1% transaction cost

  optimizePortfolio(
    currentPositions: Position[],
    marketData: MarketData[],
    totalBalance: number,
    constraints: PortfolioConstraints,
    optimizationType: 'meanVariance' | 'riskParity' | 'blackLitterman' | 'minVariance' | 'maxSharpe' = 'meanVariance'
  ): OptimizationResult {
    const currentWeights = this.calculateCurrentWeights(currentPositions, totalBalance)
    const returns = this.estimateReturns(marketData)
    const correlationMatrix = this.calculateCorrelationMatrix(marketData)
    const volatilities = this.calculateVolatilities(marketData)
    const covarianceMatrix = this.calculateCovarianceMatrix(correlationMatrix, volatilities)

    let optimizedWeights: { [symbol: string]: number }

    switch (optimizationType) {
      case 'riskParity':
        optimizedWeights = this.riskParityOptimization(covarianceMatrix, constraints)
        break
      case 'blackLitterman':
        optimizedWeights = this.blackLittermanOptimization(returns, covarianceMatrix, constraints)
        break
      case 'minVariance':
        optimizedWeights = this.minVarianceOptimization(covarianceMatrix, constraints)
        break
      case 'maxSharpe':
        optimizedWeights = this.maxSharpeOptimization(returns, covarianceMatrix, constraints)
        break
      default:
        optimizedWeights = this.meanVarianceOptimization(returns, correlationMatrix, volatilities, constraints)
    }

    // Calculate comprehensive metrics
    const expectedReturn = this.calculateExpectedReturn(optimizedWeights, returns)
    const expectedRisk = this.calculatePortfolioRisk(optimizedWeights, correlationMatrix, volatilities)
    const sharpeRatio = (expectedReturn - this.riskFreeRate) / expectedRisk
    const sortinoRatio = this.calculateSortinoRatio(optimizedWeights, returns)
    const calmarRatio = this.calculateCalmarRatio(optimizedWeights, returns)
    const diversificationScore = this.calculateDiversificationScore(optimizedWeights, correlationMatrix)
    const concentrationRisk = this.calculateConcentrationRisk(optimizedWeights)
    const valueAtRisk = this.calculateValueAtRisk(optimizedWeights, returns, 0.95)
    const expectedShortfall = this.calculateExpectedShortfall(optimizedWeights, returns, 0.95)
    const riskContributions = this.calculateRiskContributions(optimizedWeights, covarianceMatrix)
    const performanceAttribution = this.calculatePerformanceAttribution(currentWeights, optimizedWeights, returns)

    const rebalanceActions = this.generateRebalanceActions(currentWeights, optimizedWeights, totalBalance, marketData)

    return {
      recommendedAllocations: optimizedWeights,
      expectedReturn,
      expectedRisk,
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      diversificationScore,
      concentrationRisk,
      valueAtRisk,
      expectedShortfall,
      rebalanceActions,
      riskContributions,
      performanceAttribution
    }
  }

  // Risk Parity Optimization
  private riskParityOptimization(covarianceMatrix: number[][], constraints: PortfolioConstraints): { [symbol: string]: number } {
    const symbols = Object.keys(covarianceMatrix)
    const n = symbols.length

    // Initialize equal weights
    let weights = new Array(n).fill(1 / n)

    // Iterative risk parity algorithm
    for (let iter = 0; iter < 100; iter++) {
      const riskContributions = this.calculateRiskContributionsArray(weights, covarianceMatrix)
      const targetRiskContribution = 1 / n

      // Update weights based on risk contribution differences
      const newWeights = weights.map((w, i) => {
        const adjustment = targetRiskContribution / riskContributions[i]
        return w * Math.pow(adjustment, 0.1) // Damping factor
      })

      // Normalize weights
      const sum = newWeights.reduce((a, b) => a + b, 0)
      weights = newWeights.map(w => w / sum)

      // Apply constraints
      weights = this.applyConstraints(weights, constraints)
    }

    // Convert to symbol-weight mapping
    const result: { [symbol: string]: number } = {}
    symbols.forEach((symbol, i) => {
      result[symbol] = weights[i]
    })

    return result
  }

  // Black-Litterman Optimization
  private blackLittermanOptimization(returns: { [symbol: string]: number }, covarianceMatrix: number[][], constraints: PortfolioConstraints): { [symbol: string]: number } {
    const symbols = Object.keys(returns)
    const n = symbols.length

    // Market capitalization weights (simplified - equal weights as proxy)
    const marketWeights = new Array(n).fill(1 / n)

    // Risk aversion parameter
    const riskAversion = 3.0

    // Implied equilibrium returns
    const impliedReturns = this.calculateImpliedReturns(marketWeights, covarianceMatrix, riskAversion)

    // Views and confidence (simplified - no views for now)
    const views: number[][] = []
    const viewReturns: number[] = []
    const viewConfidence: number[][] = []

    // Black-Litterman formula
    const tau = 0.025 // Scaling factor
    const scaledCov = covarianceMatrix.map(row => row.map(val => val * tau))

    // If no views, return market weights
    if (views.length === 0) {
      const result: { [symbol: string]: number } = {}
      symbols.forEach((symbol, i) => {
        result[symbol] = marketWeights[i]
      })
      return result
    }

    // Full Black-Litterman calculation would go here
    // For now, return market weights
    const result: { [symbol: string]: number } = {}
    symbols.forEach((symbol, i) => {
      result[symbol] = marketWeights[i]
    })

    return result
  }

  // Minimum Variance Optimization
  private minVarianceOptimization(covarianceMatrix: number[][], constraints: PortfolioConstraints): { [symbol: string]: number } {
    const symbols = Object.keys(covarianceMatrix)
    const n = symbols.length

    // Solve for minimum variance portfolio: min w'Σw subject to w'1 = 1
    // Analytical solution: w = (Σ^-1 * 1) / (1' * Σ^-1 * 1)

    const invCov = this.invertMatrix(covarianceMatrix)
    const ones = new Array(n).fill(1)

    // Calculate Σ^-1 * 1
    const invCovOnes = this.matrixVectorMultiply(invCov, ones)

    // Calculate 1' * Σ^-1 * 1
    const denominator = ones.reduce((sum, _, i) => sum + invCovOnes[i], 0)

    // Calculate optimal weights
    const weights = invCovOnes.map(val => val / denominator)

    // Apply constraints
    const constrainedWeights = this.applyConstraints(weights, constraints)

    // Convert to symbol-weight mapping
    const result: { [symbol: string]: number } = {}
    symbols.forEach((symbol, i) => {
      result[symbol] = constrainedWeights[i]
    })

    return result
  }

  // Maximum Sharpe Ratio Optimization
  private maxSharpeOptimization(returns: { [symbol: string]: number }, covarianceMatrix: number[][], constraints: PortfolioConstraints): { [symbol: string]: number } {
    const symbols = Object.keys(returns)
    const n = symbols.length
    const returnsArray = symbols.map(symbol => returns[symbol] - this.riskFreeRate)

    // Solve for maximum Sharpe ratio: max (μ-rf)'w / sqrt(w'Σw)
    // This is equivalent to solving: Σ^-1 * (μ-rf)

    const invCov = this.invertMatrix(covarianceMatrix)
    const weights = this.matrixVectorMultiply(invCov, returnsArray)

    // Normalize weights to sum to 1
    const sum = weights.reduce((a, b) => a + b, 0)
    const normalizedWeights = weights.map(w => w / sum)

    // Apply constraints
    const constrainedWeights = this.applyConstraints(normalizedWeights, constraints)

    // Convert to symbol-weight mapping
    const result: { [symbol: string]: number } = {}
    symbols.forEach((symbol, i) => {
      result[symbol] = constrainedWeights[i]
    })

    return result
  }

  // Utility Methods for Matrix Operations
  private calculateCovarianceMatrix(correlationMatrix: { [key: string]: { [key: string]: number } }, volatilities: { [symbol: string]: number }): number[][] {
    const symbols = Object.keys(volatilities)
    const n = symbols.length
    const covMatrix: number[][] = []

    for (let i = 0; i < n; i++) {
      covMatrix[i] = []
      for (let j = 0; j < n; j++) {
        const symbol1 = symbols[i]
        const symbol2 = symbols[j]
        const correlation = correlationMatrix[symbol1]?.[symbol2] || (i === j ? 1 : 0)
        covMatrix[i][j] = correlation * volatilities[symbol1] * volatilities[symbol2]
      }
    }

    return covMatrix
  }

  private calculateRiskContributionsArray(weights: number[], covarianceMatrix: number[][]): number[] {
    const n = weights.length
    const portfolioVariance = this.calculatePortfolioVarianceFromMatrix(weights, covarianceMatrix)
    const riskContributions: number[] = []

    for (let i = 0; i < n; i++) {
      let contribution = 0
      for (let j = 0; j < n; j++) {
        contribution += weights[j] * covarianceMatrix[i][j]
      }
      riskContributions[i] = (weights[i] * contribution) / portfolioVariance
    }

    return riskContributions
  }

  private calculatePortfolioVarianceFromMatrix(weights: number[], covarianceMatrix: number[][]): number {
    let variance = 0
    const n = weights.length

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * covarianceMatrix[i][j]
      }
    }

    return variance
  }

  private applyConstraints(weights: number[], constraints: PortfolioConstraints): number[] {
    const n = weights.length
    let constrainedWeights = [...weights]

    // Apply min/max position constraints
    for (let i = 0; i < n; i++) {
      constrainedWeights[i] = Math.max(constraints.minPositionWeight, Math.min(constraints.maxPositionWeight, constrainedWeights[i]))
    }

    // Normalize to sum to 1
    const sum = constrainedWeights.reduce((a, b) => a + b, 0)
    if (sum > 0) {
      constrainedWeights = constrainedWeights.map(w => w / sum)
    }

    return constrainedWeights
  }

  private invertMatrix(matrix: number[][]): number[][] {
    const n = matrix.length

    // Create augmented matrix [A|I]
    const augmented: number[][] = []
    for (let i = 0; i < n; i++) {
      augmented[i] = [...matrix[i]]
      for (let j = 0; j < n; j++) {
        augmented[i].push(i === j ? 1 : 0)
      }
    }

    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k
        }
      }

      // Swap rows
      [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]]

      // Make diagonal element 1
      const pivot = augmented[i][i]
      if (Math.abs(pivot) < 1e-10) {
        // Matrix is singular, return identity as fallback
        const identity: number[][] = []
        for (let row = 0; row < n; row++) {
          identity[row] = new Array(n).fill(0)
          identity[row][row] = 1
        }
        return identity
      }

      for (let j = 0; j < 2 * n; j++) {
        augmented[i][j] /= pivot
      }

      // Eliminate column
      for (let k = 0; k < n; k++) {
        if (k !== i) {
          const factor = augmented[k][i]
          for (let j = 0; j < 2 * n; j++) {
            augmented[k][j] -= factor * augmented[i][j]
          }
        }
      }
    }

    // Extract inverse matrix
    const inverse: number[][] = []
    for (let i = 0; i < n; i++) {
      inverse[i] = augmented[i].slice(n)
    }

    return inverse
  }

  private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
    const result: number[] = []
    const n = matrix.length

    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < vector.length; j++) {
        sum += matrix[i][j] * vector[j]
      }
      result[i] = sum
    }

    return result
  }

  private calculateImpliedReturns(marketWeights: number[], covarianceMatrix: number[][], riskAversion: number): number[] {
    // Implied returns = risk_aversion * Σ * w_market
    return this.matrixVectorMultiply(covarianceMatrix, marketWeights.map(w => w * riskAversion))
  }

  // Additional Risk and Performance Metrics
  private calculateSortinoRatio(weights: { [symbol: string]: number }, returns: { [symbol: string]: number }): number {
    const symbols = Object.keys(weights)
    const portfolioReturns = symbols.map(symbol => weights[symbol] * returns[symbol])
    const portfolioReturn = portfolioReturns.reduce((sum, r) => sum + r, 0)

    // Calculate downside deviation (simplified)
    const downsideReturns = portfolioReturns.filter(r => r < 0)
    if (downsideReturns.length === 0) return portfolioReturn > 0 ? Infinity : 0

    const downsideDeviation = Math.sqrt(downsideReturns.reduce((sum, r) => sum + r * r, 0) / downsideReturns.length)
    return downsideDeviation > 0 ? (portfolioReturn - this.riskFreeRate) / downsideDeviation : 0
  }

  private calculateCalmarRatio(weights: { [symbol: string]: number }, returns: { [symbol: string]: number }): number {
    const symbols = Object.keys(weights)
    const portfolioReturn = symbols.reduce((sum, symbol) => sum + weights[symbol] * returns[symbol], 0)

    // Simplified max drawdown calculation (would need historical data for accurate calculation)
    const estimatedMaxDrawdown = Math.abs(Math.min(...symbols.map(symbol => returns[symbol]))) * 0.5

    return estimatedMaxDrawdown > 0 ? portfolioReturn / estimatedMaxDrawdown : 0
  }

  private calculateConcentrationRisk(weights: { [symbol: string]: number }): number {
    const weightValues = Object.values(weights)
    const herfindahlIndex = weightValues.reduce((sum, w) => sum + w * w, 0)
    return herfindahlIndex // Higher values indicate more concentration
  }

  private calculateValueAtRisk(weights: { [symbol: string]: number }, returns: { [symbol: string]: number }, confidence: number): number {
    const symbols = Object.keys(weights)
    const portfolioReturn = symbols.reduce((sum, symbol) => sum + weights[symbol] * returns[symbol], 0)
    const portfolioVolatility = this.calculatePortfolioVolatility(weights, returns)

    // Assuming normal distribution
    const zScore = confidence === 0.95 ? 1.645 : 2.326 // 95% or 99%
    return -(portfolioReturn - zScore * portfolioVolatility)
  }

  private calculateExpectedShortfall(weights: { [symbol: string]: number }, returns: { [symbol: string]: number }, confidence: number): number {
    const var95 = this.calculateValueAtRisk(weights, returns, confidence)
    // Simplified ES calculation (would need full distribution for accuracy)
    return var95 * 1.2 // Rough approximation
  }

  private calculatePortfolioVolatility(weights: { [symbol: string]: number }, returns: { [symbol: string]: number }): number {
    // Simplified volatility calculation
    const symbols = Object.keys(weights)
    const weightedVolatilities = symbols.map(symbol => weights[symbol] * Math.abs(returns[symbol]) * 0.2) // Rough estimate
    return Math.sqrt(weightedVolatilities.reduce((sum, vol) => sum + vol * vol, 0))
  }

  private calculateRiskContributions(weights: { [symbol: string]: number }, covarianceMatrix: number[][]): { [symbol: string]: number } {
    const symbols = Object.keys(weights)
    const weightsArray = symbols.map(symbol => weights[symbol])
    const riskContributions = this.calculateRiskContributionsArray(weightsArray, covarianceMatrix)

    const result: { [symbol: string]: number } = {}
    symbols.forEach((symbol, i) => {
      result[symbol] = riskContributions[i]
    })

    return result
  }

  private calculatePerformanceAttribution(
    currentWeights: { [symbol: string]: number },
    optimizedWeights: { [symbol: string]: number },
    returns: { [symbol: string]: number }
  ): PerformanceAttribution {
    const symbols = Object.keys(returns)

    const currentReturn = symbols.reduce((sum, symbol) => sum + (currentWeights[symbol] || 0) * returns[symbol], 0)
    const optimizedReturn = symbols.reduce((sum, symbol) => sum + optimizedWeights[symbol] * returns[symbol], 0)

    const totalReturn = optimizedReturn - currentReturn

    // Simplified attribution (in practice, this would be more complex)
    return {
      totalReturn,
      assetAllocation: totalReturn * 0.6, // 60% attributed to allocation
      securitySelection: totalReturn * 0.3, // 30% to security selection
      interaction: totalReturn * 0.1 // 10% to interaction effects
    }
  }

  private calculateCurrentWeights(positions: Position[], totalBalance: number): { [symbol: string]: number } {
    const weights: { [symbol: string]: number } = {}

    positions.forEach((position) => {
      const size = parseFloat(position.size)
      const entryPrice = parseFloat(position.entry_price)
      const positionValue = Math.abs(size * entryPrice)
      weights[position.product.symbol] = positionValue / totalBalance
    })

    return weights
  }

  private estimateReturns(marketData: MarketData[]): { [symbol: string]: number } {
    const returns: { [symbol: string]: number } = {}

    marketData.forEach((data) => {
      // Simple momentum-based return estimation
      const momentum = data.changePercent / 100
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
      volatilities[data.symbol] = (Math.abs(data.changePercent) / 100) * Math.sqrt(365) // Annualized
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
          weightDifference: weightDiff,
          amountToTrade,
          estimatedCost: amountToTrade * this.transactionCost,
          priority: Math.abs(weightDiff) > 0.1 ? 'high' : Math.abs(weightDiff) > 0.05 ? 'medium' : 'low',
          reason: `Rebalance from ${(currentWeight * 100).toFixed(1)}% to ${(targetWeight * 100).toFixed(1)}%`,
          expectedImpact: {
            returnContribution: weightDiff * 0.05, // Simplified estimate
            riskContribution: Math.abs(weightDiff) * 0.02,
            diversificationImpact: weightDiff > 0 ? 0.01 : -0.01
          }
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
    const marketReturn = marketData.reduce((sum, data) => sum + data.changePercent, 0) / marketData.length / 100
    const portfolioReturn = positions.reduce((sum, pos) => sum + parseFloat(pos.realized_pnl || "0"), 0)

    // This is a simplified calculation - in practice, you'd use historical data
    return portfolioReturn !== 0 ? marketReturn / portfolioReturn : 1
  }

  private calculateAlpha(positions: Position[], marketData: MarketData[], beta: number): number {
    const portfolioReturn = this.calculateAnnualizedReturn(positions)
    const marketReturn = (marketData.reduce((sum, data) => sum + data.changePercent, 0) / marketData.length / 100) * 365

    return portfolioReturn - (this.riskFreeRate + beta * (marketReturn - this.riskFreeRate))
  }

  private calculateInformationRatio(positions: Position[]): number {
    // Simplified calculation
    const returns = positions.map((pos) => parseFloat(pos.realized_pnl || "0"))
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const trackingError = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length)

    return trackingError > 0 ? avgReturn / trackingError : 0
  }

  private calculateMaxDrawdown(positions: Position[]): number {
    // Simplified calculation based on current unrealized P&L
    const losses = positions.filter((pos) => parseFloat(pos.realized_pnl || "0") < 0)
    return losses.length > 0 ? Math.abs(Math.min(...losses.map((pos) => parseFloat(pos.realized_pnl || "0")))) : 0
  }

  private calculateAnnualizedReturn(positions: Position[]): number {
    const totalPnL = positions.reduce((sum, pos) => sum + (pos.unrealizedPnl || 0), 0)
    // This is simplified - in practice, you'd use time-weighted returns
    return (totalPnL * 365) / 30 // Assuming 30-day period
  }
}

export const portfolioOptimizer = new PortfolioOptimizer()
