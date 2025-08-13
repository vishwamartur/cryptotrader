"use client"

import { useState, useEffect, useCallback } from "react"
import { useWebSocket } from "./use-websocket"

interface OrderbookEntry {
  price: string
  size: string
}

interface RealtimeOrderbook {
  symbol: string
  buy: OrderbookEntry[]
  sell: OrderbookEntry[]
  timestamp: number
}

const WEBSOCKET_URL = "wss://socket.india.delta.exchange"

export function useRealtimeOrderbook(symbol: string) {
  const [orderbook, setOrderbook] = useState<RealtimeOrderbook | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const ws = useWebSocket({
    url: WEBSOCKET_URL,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  })

  const handleOrderbookUpdate = useCallback(
    (data: any) => {
      if (data.type === "l2_orderbook" && data.symbol === symbol) {
        const orderbookData: RealtimeOrderbook = {
          symbol: data.symbol,
          buy: data.buy || [],
          sell: data.sell || [],
          timestamp: Date.now(),
        }

        setOrderbook(orderbookData)
        setLastUpdate(Date.now())
      }
    },
    [symbol],
  )

  useEffect(() => {
    if (ws.isConnected && symbol) {
      ws.addMessageHandler("l2_orderbook", handleOrderbookUpdate)
      ws.subscribe([
        {
          name: "l2_orderbook",
          symbols: [symbol],
        },
      ])

      return () => {
        ws.removeMessageHandler("l2_orderbook")
        ws.unsubscribe([
          {
            name: "l2_orderbook",
            symbols: [symbol],
          },
        ])
      }
    }
  }, [ws.isConnected, symbol, ws, handleOrderbookUpdate])

  return {
    orderbook,
    isConnected: ws.isConnected,
    error: ws.error,
    lastUpdate,
    reconnectAttempts: ws.reconnectAttempts,
  }
}
