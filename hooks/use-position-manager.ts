"use client"

import { useState, useEffect } from "react"
import {
  PositionManager,
  type ManagedPosition,
  type PortfolioMetrics,
  type RebalanceAction,
} from "@/lib/position-manager"
import { RiskManager } from "@/lib/risk-management"
import { useToast } from "@/hooks/use-toast"

export function usePositionManager() {
  const [positionManager] = useState(
    () =>
      new PositionManager(
        new RiskManager({
          maxPortfolioRisk: 10,
          maxPositionSize: 5,
          maxDrawdown: 15,
          maxDailyLoss: 1000,
          maxOpenPositions: 10,
          correlationLimit: 0.7,
        }),
      ),
  )

  const [positions, setPositions] = useState<ManagedPosition[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [rebalanceActions, setRebalanceActions] = useState<RebalanceAction[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Subscribe to position updates
    const unsubscribe = positionManager.subscribe((updatedPositions) => {
      setPositions(updatedPositions)
      setMetrics(positionManager.calculatePortfolioMetrics())
      setRebalanceActions(positionManager.calculateRebalanceActions())
    })

    // Initial load
    setPositions(positionManager.getPositions())
    setMetrics(positionManager.calculatePortfolioMetrics())

    return unsubscribe
  }, [positionManager])

  const startManager = () => {
    positionManager.start()
    setIsRunning(true)
    toast({
      title: "Position Manager Started",
      description: "Now monitoring all positions and integrations",
    })
  }

  const stopManager = () => {
    positionManager.stop()
    setIsRunning(false)
    toast({
      title: "Position Manager Stopped",
      description: "Position monitoring has been stopped",
    })
  }

  const closePosition = (positionId: string) => {
    positionManager.closePosition(positionId)
    toast({
      title: "Position Closed",
      description: "Position has been closed successfully",
    })
  }

  const enableTakeProfit = (positionId: string, strategyId: string) => {
    positionManager.enableTakeProfit(positionId, strategyId)
    toast({
      title: "Take Profit Enabled",
      description: "Take profit strategy has been applied to position",
    })
  }

  const setTargetAllocation = (symbol: string, percentage: number) => {
    positionManager.setTargetAllocation(symbol, percentage)
    setRebalanceActions(positionManager.calculateRebalanceActions())
    toast({
      title: "Allocation Updated",
      description: `Target allocation for ${symbol} set to ${percentage}%`,
    })
  }

  const updateMarketData = (symbol: string, data: any) => {
    positionManager.updateMarketData(symbol, data)
  }

  return {
    positionManager,
    positions,
    metrics,
    rebalanceActions,
    isRunning,
    startManager,
    stopManager,
    closePosition,
    enableTakeProfit,
    setTargetAllocation,
    updateMarketData,
  }
}
