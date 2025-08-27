"use client"

import { useState, useEffect, useCallback } from "react"
import { useWebSocket } from "./use-websocket"

interface RealtimeBalance {
  asset_symbol: string
  available_balance: string
  wallet_balance: string
  unrealized_pnl: string
  timestamp: number
}

interface RealtimePosition {
  symbol: string
  size: string
  entry_price: string
  margin: string
  realized_pnl: string
  timestamp: number
}

interface RealtimeOrder {
  id: number
  symbol: string
  side: "buy" | "sell"
  size: string
  price: string
  state: string
  timestamp: number
}

const WEBSOCKET_URL = "wss://socket.india.delta.exchange"

export function useRealtimePortfolio(credentials: { api_key: string; api_secret: string } | null) {
  const [balances, setBalances] = useState<RealtimeBalance[]>([])
  const [positions, setPositions] = useState<RealtimePosition[]>([])
  const [orders, setOrders] = useState<RealtimeOrder[]>([])
  const [lastUpdate, setLastUpdate] = useState<number>(0)

  const ws = useWebSocket({
    url: WEBSOCKET_URL,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
  })

  const handleMarginUpdate = useCallback((data: any) => {
    if (data.type === "margins") {
      const balanceUpdate: RealtimeBalance = {
        asset_symbol: data.asset_symbol,
        available_balance: data.available_balance,
        wallet_balance: data.wallet_balance,
        unrealized_pnl: data.unrealized_pnl,
        timestamp: Date.now(),
      }

      setBalances((prev) => {
        const updated = prev.filter((b) => b.asset_symbol !== data.asset_symbol)
        return [...updated, balanceUpdate]
      })
      setLastUpdate(Date.now())
    }
  }, [])

  const handlePositionUpdate = useCallback((data: any) => {
    if (data.type === "positions") {
      const positionUpdate: RealtimePosition = {
        symbol: data.product?.symbol || data.symbol,
        size: data.size,
        entry_price: data.entry_price,
        margin: data.margin,
        realized_pnl: data.realized_pnl,
        timestamp: Date.now(),
      }

      setPositions((prev) => {
        const updated = prev.filter((p) => p.symbol !== positionUpdate.symbol)
        if (Number.parseFloat(positionUpdate.size) !== 0) {
          return [...updated, positionUpdate]
        }
        return updated
      })
      setLastUpdate(Date.now())
    }
  }, [])

  const handleOrderUpdate = useCallback((data: any) => {
    if (data.type === "orders") {
      const orderUpdate: RealtimeOrder = {
        id: data.id,
        symbol: data.product?.symbol || data.symbol,
        side: data.side,
        size: data.size,
        price: data.limit_price || data.price || "0",
        state: data.state,
        timestamp: Date.now(),
      }

      setOrders((prev) => {
        const updated = prev.filter((o) => o.id !== data.id)
        if (data.state !== "cancelled" && data.state !== "closed") {
          return [orderUpdate, ...updated].slice(0, 50) // Keep last 50 orders
        }
        return updated
      })
      setLastUpdate(Date.now())
    }
  }, [])

  useEffect(() => {
    if (ws.isConnected && credentials) {
      // Authenticate first
      ws.authenticate(credentials.api_key, credentials.api_secret)

      // Add message handlers
      ws.addMessageHandler("margins", handleMarginUpdate)
      ws.addMessageHandler("positions", handlePositionUpdate)
      ws.addMessageHandler("orders", handleOrderUpdate)

      // Subscribe to private channels
      ws.subscribe([
        { name: "margins", symbols: ["all"] },
        { name: "positions", symbols: ["all"] },
        { name: "orders", symbols: ["all"] },
      ])

      return () => {
        ws.removeMessageHandler("margins")
        ws.removeMessageHandler("positions")
        ws.removeMessageHandler("orders")
        ws.unsubscribe([
          { name: "margins", symbols: ["all"] },
          { name: "positions", symbols: ["all"] },
          { name: "orders", symbols: ["all"] },
        ])
      }
    }
  }, [ws.isConnected, credentials, ws, handleMarginUpdate, handlePositionUpdate, handleOrderUpdate])

  return {
    balances,
    positions,
    orders,
    isConnected: ws.isConnected,
    error: ws.error,
    lastUpdate,
    reconnectAttempts: ws.reconnectAttempts,
  }
}
