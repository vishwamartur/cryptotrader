"use client"

import { useState, useEffect } from "react"
import { tradeMonitor, type Trade, type TradeMetrics, type TradeAlert } from "@/lib/trade-monitor"
import { useToast } from "@/hooks/use-toast"

export function useTradeMonitor() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [alerts, setAlerts] = useState<TradeAlert[]>([])
  const [metrics, setMetrics] = useState<TradeMetrics | null>(null)
  const [timeframe, setTimeframe] = useState<"1D" | "7D" | "30D" | "ALL">("7D")
  const { toast } = useToast()

  useEffect(() => {
    // Subscribe to trade updates
    const unsubscribeTrades = tradeMonitor.subscribe((updatedTrades) => {
      setTrades(updatedTrades)
      setMetrics(tradeMonitor.calculateMetrics(timeframe))
    })

    // Subscribe to alerts
    const unsubscribeAlerts = tradeMonitor.subscribeToAlerts((alert) => {
      setAlerts((prev) => [alert, ...prev.slice(0, 19)])

      // Show toast notification for important alerts
      if (alert.severity === "success" || alert.severity === "error") {
        toast({
          title: alert.type === "FILL" ? "Trade Executed" : "Trade Alert",
          description: alert.message,
          variant: alert.severity === "error" ? "destructive" : "default",
        })
      }
    })

    // Initial load
    setTrades(tradeMonitor.getTrades())
    setAlerts(tradeMonitor.getAlerts())
    setMetrics(tradeMonitor.calculateMetrics(timeframe))

    return () => {
      unsubscribeTrades()
      unsubscribeAlerts()
    }
  }, [timeframe, toast])

  const addTrade = (trade: Omit<Trade, "id" | "timestamp">) => {
    const newTrade = tradeMonitor.addTrade(trade)

    // Simulate trade execution for demo
    if (trade.type === "MARKET") {
      tradeMonitor.simulateTradeUpdate(newTrade.id)
    }

    return newTrade
  }

  const updateTimeframe = (newTimeframe: "1D" | "7D" | "30D" | "ALL") => {
    setTimeframe(newTimeframe)
    setMetrics(tradeMonitor.calculateMetrics(newTimeframe))
  }

  return {
    trades,
    alerts,
    metrics,
    timeframe,
    addTrade,
    updateTimeframe,
    tradeMonitor,
  }
}
