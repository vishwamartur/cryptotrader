"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { useOrderbook } from "@/hooks/use-orderbook"
import { useRealtimeOrderbook } from "@/hooks/use-realtime-orderbook"
import { ConnectionStatus } from "@/components/connection-status"
import { useEffect, useState } from "react"

interface OrderBookProps {
  symbol: string
}

export function OrderBook({ symbol }: OrderBookProps) {
  const { orderbook: restOrderbook, loading, error } = useOrderbook(symbol)
  const [useRealtime, setUseRealtime] = useState(false)

  const realtimeOrderbook = useRealtimeOrderbook(useRealtime ? symbol : "")

  useEffect(() => {
    if (!loading && restOrderbook && symbol && !useRealtime) {
      setUseRealtime(true)
    }
  }, [loading, restOrderbook, symbol, useRealtime])

  const orderbook = realtimeOrderbook.orderbook || restOrderbook

  if (!symbol) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">Select a trading pair to view order book</p>
        </CardContent>
      </Card>
    )
  }

  if (loading && !orderbook) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Order Book
            <RefreshCw className="h-4 w-4 animate-spin" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex justify-between animate-pulse">
                <div className="w-16 h-4 bg-muted rounded"></div>
                <div className="w-20 h-4 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !orderbook) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">{error || "Failed to load order book"}</p>
        </CardContent>
      </Card>
    )
  }

  if (!orderbook) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Order Book</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">No order book data available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            Order Book
            <Badge variant="secondary" className="text-xs">
              {symbol}
            </Badge>
          </div>
          <ConnectionStatus
            isConnected={realtimeOrderbook.isConnected}
            error={realtimeOrderbook.error}
            reconnectAttempts={realtimeOrderbook.reconnectAttempts}
            lastUpdate={realtimeOrderbook.lastUpdate}
          />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sell Orders (Asks) */}
        <div>
          <h4 className="text-sm font-medium text-red-600 mb-2">Sell Orders</h4>
          <div className="space-y-1">
            {orderbook.sell.slice(0, 5).map((order, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-red-600">{Number.parseFloat(order.price).toFixed(2)}</span>
                <span className="text-muted-foreground">{Number.parseFloat(order.size).toFixed(6)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spread */}
        <div className="border-t border-b py-2">
          <div className="text-center text-sm text-muted-foreground">
            Spread:{" "}
            {orderbook.sell.length > 0 && orderbook.buy.length > 0
              ? (Number.parseFloat(orderbook.sell[0].price) - Number.parseFloat(orderbook.buy[0].price)).toFixed(2)
              : "N/A"}
          </div>
        </div>

        {/* Buy Orders (Bids) */}
        <div>
          <h4 className="text-sm font-medium text-green-600 mb-2">Buy Orders</h4>
          <div className="space-y-1">
            {orderbook.buy.slice(0, 5).map((order, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-green-600">{Number.parseFloat(order.price).toFixed(2)}</span>
                <span className="text-muted-foreground">{Number.parseFloat(order.size).toFixed(6)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
