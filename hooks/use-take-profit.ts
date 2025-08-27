"use client"

import { useState, useEffect } from "react"
import {
  takeProfitSystem,
  type TakeProfitStrategy,
  type PositionTakeProfit,
  type TakeProfitEvent,
} from "@/lib/take-profit-system"
import { useToast } from "@/hooks/use-toast"

export function useTakeProfit() {
  const [isRunning, setIsRunning] = useState(false)
  const [strategies, setStrategies] = useState<TakeProfitStrategy[]>([])
  const [activePositions, setActivePositions] = useState<PositionTakeProfit[]>([])
  const [events, setEvents] = useState<TakeProfitEvent[]>([])
  const { toast } = useToast()

  useEffect(() => {
    // Subscribe to events
    const unsubscribe = takeProfitSystem.subscribe((newEvents) => {
      setEvents(newEvents)

      // Show notifications for important events
      const latestEvent = newEvents[0]
      if (latestEvent && (latestEvent.type === "PARTIAL_CLOSE" || latestEvent.type === "FULL_CLOSE")) {
        toast({
          title: "Take Profit Triggered",
          description: `${latestEvent.reason} - Profit: $${latestEvent.profit.toFixed(2)}`,
        })
      }
    })

    // Load initial data
    setStrategies(takeProfitSystem.getStrategies())
    setActivePositions(takeProfitSystem.getActivePositions())
    setEvents(takeProfitSystem.getEvents())

    return unsubscribe
  }, [toast])

  const startSystem = () => {
    takeProfitSystem.start()
    setIsRunning(true)
    toast({
      title: "Take Profit System Started",
      description: "Monitoring positions for take profit opportunities",
    })
  }

  const stopSystem = () => {
    takeProfitSystem.stop()
    setIsRunning(false)
    toast({
      title: "Take Profit System Stopped",
      description: "No longer monitoring take profit levels",
    })
  }

  const addPosition = (tradeId: string, trade: any, strategyId: string, takeProfitPrice?: number) => {
    takeProfitSystem.addPosition(trade, strategyId, takeProfitPrice)
    setActivePositions(takeProfitSystem.getActivePositions())

    toast({
      title: "Take Profit Added",
      description: `Added take profit strategy for ${trade.symbol}`,
    })
  }

  const removePosition = (tradeId: string) => {
    takeProfitSystem.removePosition(tradeId)
    setActivePositions(takeProfitSystem.getActivePositions())
  }

  const updateMarketData = (symbol: string, data: any) => {
    takeProfitSystem.updateMarketData(symbol, data)
    // Refresh active positions to show updated prices
    setActivePositions(takeProfitSystem.getActivePositions())
  }

  return {
    isRunning,
    strategies,
    activePositions,
    events,
    startSystem,
    stopSystem,
    addPosition,
    removePosition,
    updateMarketData,
    takeProfitSystem,
  }
}
