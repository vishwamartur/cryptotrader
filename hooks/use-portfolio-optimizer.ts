"use client"

import { useState } from "react"
import { portfolioOptimizer, type OptimizationResult } from "@/lib/portfolio-optimizer"
import { useMarketData } from "./use-market-data"
import { usePortfolio } from "./use-portfolio"

export function usePortfolioOptimizer() {
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { marketData } = useMarketData()
  const { positions, balance } = usePortfolio()

  const optimizePortfolio = async (constraints?: {
    maxPositionWeight?: number
    minPositionWeight?: number
    maxRisk?: number
    targetReturn?: number
  }) => {
    if (!positions || !balance || !marketData) {
      setError("Missing required data for optimization")
      return
    }

    setIsOptimizing(true)
    setError(null)

    try {
      const defaultConstraints = {
        maxPositionWeight: 0.25, // 25% max per position
        minPositionWeight: 0.02, // 2% minimum per position
        maxRisk: 0.15, // 15% max portfolio risk
        ...constraints,
      }

      const result = portfolioOptimizer.optimizePortfolio(positions, marketData, balance, defaultConstraints)

      setOptimizationResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed")
    } finally {
      setIsOptimizing(false)
    }
  }

  const calculateRiskMetrics = () => {
    if (!positions || !marketData) return null

    return portfolioOptimizer.calculateRiskMetrics(positions, marketData)
  }

  const clearOptimization = () => {
    setOptimizationResult(null)
    setError(null)
  }

  return {
    optimizationResult,
    isOptimizing,
    error,
    optimizePortfolio,
    calculateRiskMetrics,
    clearOptimization,
  }
}
