"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from "lucide-react"
import { useWebSocketMarketData } from "@/hooks/use-websocket-market-data"
import { ConnectionStatus } from "@/components/connection-status"
import { useEffect, useState } from "react"

const MAJOR_SYMBOLS = ["BTCUSDT", "ETHUSDT", "ADAUSDT", "SOLUSDT", "MATICUSDT", "AVAXUSDT"]

export function MarketOverview() {
  // Use WebSocket-based market data instead of REST API
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToMajorPairs: true,
    subscribeToAllProducts: false,
    channels: ['ticker'],
    maxSymbols: 50
  })

  // Convert WebSocket data to display format
  const displayData = marketData.marketDataArray || []

  if (marketData.isLoading && displayData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Market Overview
            <RefreshCw className="h-4 w-4 animate-spin" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-4 bg-muted rounded"></div>
                  <div className="w-20 h-3 bg-muted rounded"></div>
                </div>
                <div className="text-right space-y-1">
                  <div className="w-24 h-4 bg-muted rounded"></div>
                  <div className="w-16 h-3 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (marketData.error && displayData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Market Overview
            <Button variant="ghost" size="sm" onClick={marketData.connect}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{marketData.error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Market Overview
          <div className="flex items-center gap-2">
            <ConnectionStatus
              isConnected={marketData.isConnected}
              error={marketData.error}
              reconnectAttempts={0}
              lastUpdate={marketData.lastUpdate?.getTime() || 0}
            />
            <Button variant="ghost" size="sm" onClick={marketData.connect}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No market data available</p>
          ) : (
            displayData.map((coin) => (
              <div
                key={coin.symbol}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-semibold">{coin.symbol}</p>
                    <p className="text-sm text-muted-foreground">Vol: {coin.volume}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-semibold">${coin.price}</p>
                  <div className="flex items-center gap-1 justify-end">
                    {coin.change.startsWith("+") ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    )}
                    <Badge
                      variant={coin.change.startsWith("+") ? "default" : "destructive"}
                      className={`text-xs ${
                        coin.change.startsWith("+")
                          ? "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-100"
                          : ""
                      }`}
                    >
                      {coin.changePercent}
                    </Badge>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
