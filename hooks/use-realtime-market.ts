"use client"

import { useState, useEffect, useCallback } from "react"
import { useWebSocket } from "./use-websocket"

interface RealtimePrice {
  symbol: string
  price: string
  change: string
  changePercent: string
  volume: string
  high: string
  low: string
  timestamp: number
}

const WEBSOCKET_URL = "wss://socket.india.delta.exchange"

export function useRealtimeMarket(symbols: string[] = []) {
  const [prices, setPrices] = useState<Map<string, RealtimePrice>>(new Map())
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const ws = useWebSocket({
    url: WEBSOCKET_URL,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  })

  const handleTickerUpdate = useCallback((data: any) => {
    if (data.type === "v2_ticker" && data.symbol) {
      const tickerData = data
      const changeNum = Number.parseFloat(tickerData.change || "0")
      const openPrice = Number.parseFloat(tickerData.open || tickerData.close || "0")
      const changePercent = openPrice > 0 ? ((changeNum / openPrice) * 100).toFixed(2) : "0.00"

      const priceUpdate: RealtimePrice = {
        symbol: tickerData.symbol,
        price: Number.parseFloat(tickerData.close || "0").toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        }),
        change: changeNum >= 0 ? `+${changeNum.toFixed(2)}` : changeNum.toFixed(2),
        changePercent: changeNum >= 0 ? `+${changePercent}%` : `${changePercent}%`,
        volume: formatVolume(tickerData.volume || "0"),
        high: tickerData.high || "0",
        low: tickerData.low || "0",
        timestamp: Date.now(),
      }

      setPrices((prev) => new Map(prev.set(tickerData.symbol, priceUpdate)))
      setLastUpdate(Date.now())
    }
  }, [])

  useEffect(() => {
    if (ws.isConnected && symbols.length > 0) {
      // Subscribe to ticker updates
      ws.addMessageHandler("v2_ticker", handleTickerUpdate)
      ws.subscribe([
        {
          name: "v2_ticker",
          symbols: symbols,
        },
      ])

      return () => {
        ws.removeMessageHandler("v2_ticker")
        ws.unsubscribe([
          {
            name: "v2_ticker",
            symbols: symbols,
          },
        ])
      }
    }
  }, [ws.isConnected, symbols, ws, handleTickerUpdate])

  return {
    prices: Array.from(prices.values()),
    pricesMap: prices,
    isConnected: ws.isConnected,
    error: ws.error,
    lastUpdate,
    reconnectAttempts: ws.reconnectAttempts,
  }
}

function formatVolume(volume: string): string {
  const num = Number.parseFloat(volume)
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return num.toFixed(2)
}
