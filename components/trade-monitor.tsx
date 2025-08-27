"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Activity, TrendingUp, Clock, DollarSign, Target, AlertCircle, CheckCircle, XCircle, Minus } from "lucide-react"
import { useTradeMonitor } from "@/hooks/use-trade-monitor"
import type { Trade, TradeAlert } from "@/lib/trade-monitor"

export function TradeMonitor() {
  const { trades, alerts, metrics, timeframe, updateTimeframe } = useTradeMonitor()
  const [selectedTab, setSelectedTab] = useState("trades")

  const getStatusIcon = (status: Trade["status"]) => {
    switch (status) {
      case "FILLED":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "REJECTED":
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />
      case "PARTIALLY_FILLED":
        return <Minus className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: Trade["status"]) => {
    switch (status) {
      case "FILLED":
        return "bg-green-50 text-green-700"
      case "REJECTED":
      case "CANCELLED":
        return "bg-red-50 text-red-700"
      case "PENDING":
        return "bg-yellow-50 text-yellow-700"
      case "PARTIALLY_FILLED":
        return "bg-blue-50 text-blue-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  const getSideColor = (side: Trade["side"]) => {
    return side === "BUY" ? "text-green-600" : "text-red-600"
  }

  const getAlertIcon = (type: TradeAlert["type"]) => {
    switch (type) {
      case "FILL":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "REJECTION":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "EXECUTION":
        return <Activity className="h-4 w-4 text-blue-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-600" />
            <CardTitle>Trade Monitor</CardTitle>
          </div>
          <Select value={timeframe} onValueChange={updateTimeframe}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1D">1D</SelectItem>
              <SelectItem value="7D">7D</SelectItem>
              <SelectItem value="30D">30D</SelectItem>
              <SelectItem value="ALL">ALL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>Real-time trade execution monitoring and analytics</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trades">Trades</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="trades" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {trades.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No trades yet</div>
                ) : (
                  trades.map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(trade.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`font-medium ${getSideColor(trade.side)}`}>{trade.side}</span>
                            <span className="font-medium">{trade.symbol}</span>
                            <Badge variant="outline" className={getStatusColor(trade.status)}>
                              {trade.status}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {trade.size} @ ${trade.executedPrice || trade.price}
                            {trade.source === "AI" && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                AI {trade.aiConfidence}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {trade.pnl !== undefined && (
                          <div className={`font-medium ${trade.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          {trade.executedAt
                            ? trade.executedAt.toLocaleTimeString()
                            : trade.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="metrics" className="space-y-4">
            {metrics && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Total Trades</span>
                    </div>
                    <p className="text-2xl font-bold">{metrics.totalTrades}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Win Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600">{(metrics.winRate * 100).toFixed(1)}%</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Net P&L</span>
                    </div>
                    <p className={`text-xl font-bold ${metrics.netPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {metrics.netPnL >= 0 ? "+" : ""}${metrics.netPnL.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Profit Factor</span>
                    </div>
                    <p className="text-xl font-bold">{metrics.profitFactor.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Avg Win</p>
                    <p className="font-medium text-green-600">${metrics.avgWin.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Loss</p>
                    <p className="font-medium text-red-600">${metrics.avgLoss.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Largest Win</p>
                    <p className="font-medium text-green-600">${metrics.largestWin.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Largest Loss</p>
                    <p className="font-medium text-red-600">${metrics.largestLoss.toFixed(2)}</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Avg Hold Time</p>
                    <p className="font-medium">{metrics.avgHoldTime.toFixed(1)}h</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Trades/Day</p>
                    <p className="font-medium">{metrics.tradesPerDay.toFixed(1)}</p>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No alerts yet</div>
                ) : (
                  alerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{alert.message}</p>
                        <p className="text-xs text-muted-foreground">{alert.timestamp.toLocaleString()}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {alert.type}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
