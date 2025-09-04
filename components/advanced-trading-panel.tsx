"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Zap, Target, TrendingUp, BarChart3, Play, Layers, Clock, Shield } from "lucide-react"
import { advancedOrderManager, type AdvancedOrder } from "@/lib/advanced-order-types"
import { portfolioOptimizer } from "@/lib/portfolio-optimizer"
import { useWebSocketMarketData } from "@/hooks/use-websocket-market-data"
import { useWebSocketPortfolio } from "@/hooks/use-websocket-portfolio"

export function AdvancedTradingPanel() {
  const [selectedOrderType, setSelectedOrderType] = useState<"ICEBERG" | "TWAP" | "BRACKET" | "TRAILING_STOP">(
    "ICEBERG",
  )
  const [orderParams, setOrderParams] = useState({
    symbol: "BTCUSDT",
    side: "BUY" as "BUY" | "SELL",
    quantity: 1,
    price: 0,
    displayQuantity: 0.1,
    duration: 60,
    stopLoss: 0,
    takeProfit: 0,
    trailPercent: 2,
  })

  const [activeOrders, setActiveOrders] = useState<AdvancedOrder[]>([])
  const [optimizationResult, setOptimizationResult] = useState<any>(null)

  // Use WebSocket-based market data for real-time updates
  const marketDataWS = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true,
    channels: ['v2/ticker']
  })

  // Use WebSocket-based portfolio data for real-time updates
  const portfolio = useWebSocketPortfolio({
    autoConnect: true,
    environment: 'production',
    enableMockFallback: true
  })

  // Convert WebSocket data to expected format for backward compatibility
  const marketData = marketDataWS.marketDataArray
  const positions = portfolio.positions || []
  const balance = {
    total: parseFloat(portfolio.summary?.totalBalance || '0'),
    available: parseFloat(portfolio.summary?.availableBalance || '0'),
    reserved: parseFloat(portfolio.summary?.reservedBalance || '0')
  }

  const handleCreateOrder = () => {
    let order: AdvancedOrder

    switch (selectedOrderType) {
      case "ICEBERG":
        order = advancedOrderManager.createIcebergOrder({
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity,
          displayQuantity: orderParams.displayQuantity,
          price: orderParams.price,
        })
        break
      case "TWAP":
        order = advancedOrderManager.createTWAPOrder({
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity,
          duration: orderParams.duration,
        })
        break
      case "BRACKET":
        order = advancedOrderManager.createBracketOrder({
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity,
          entryPrice: orderParams.price,
          stopLoss: orderParams.stopLoss,
          takeProfit: orderParams.takeProfit,
        })
        break
      case "TRAILING_STOP":
        order = advancedOrderManager.createTrailingStop({
          symbol: orderParams.symbol,
          side: orderParams.side,
          quantity: orderParams.quantity,
          trailPercent: orderParams.trailPercent,
        })
        break
    }

    setActiveOrders([...activeOrders, order])
  }

  const handleOptimizePortfolio = () => {
    if (positions && balance && marketData) {
      const result = portfolioOptimizer.optimizePortfolio(positions, marketData, balance, {
        maxPositionWeight: 0.3,
        minPositionWeight: 0.05,
        maxRisk: 0.15,
      })
      setOptimizationResult(result)
    }
  }

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case "ICEBERG":
        return <Layers className="h-4 w-4" />
      case "TWAP":
        return <Clock className="h-4 w-4" />
      case "BRACKET":
        return <Shield className="h-4 w-4" />
      case "TRAILING_STOP":
        return <TrendingUp className="h-4 w-4" />
      default:
        return <Target className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          <CardTitle>Advanced Trading</CardTitle>
        </div>
        <CardDescription>Professional order types and portfolio optimization</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="orders" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="orders">Advanced Orders</TabsTrigger>
            <TabsTrigger value="optimization">Portfolio Optimization</TabsTrigger>
            <TabsTrigger value="active">Active Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Order Type</Label>
                  <Select value={selectedOrderType} onValueChange={setSelectedOrderType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ICEBERG">Iceberg Order</SelectItem>
                      <SelectItem value="TWAP">TWAP Order</SelectItem>
                      <SelectItem value="BRACKET">Bracket Order</SelectItem>
                      <SelectItem value="TRAILING_STOP">Trailing Stop</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    value={orderParams.symbol}
                    onChange={(e) => setOrderParams((prev) => ({ ...prev, symbol: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Side</Label>
                  <Select
                    value={orderParams.side}
                    onValueChange={(value: "BUY" | "SELL") => setOrderParams((prev) => ({ ...prev, side: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={orderParams.quantity}
                    onChange={(e) => setOrderParams((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={orderParams.price}
                    onChange={(e) => setOrderParams((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {selectedOrderType === "ICEBERG" && (
                <div className="space-y-2">
                  <Label>Display Quantity</Label>
                  <Input
                    type="number"
                    value={orderParams.displayQuantity}
                    onChange={(e) => setOrderParams((prev) => ({ ...prev, displayQuantity: Number(e.target.value) }))}
                  />
                </div>
              )}

              {selectedOrderType === "TWAP" && (
                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={orderParams.duration}
                    onChange={(e) => setOrderParams((prev) => ({ ...prev, duration: Number(e.target.value) }))}
                  />
                </div>
              )}

              {selectedOrderType === "BRACKET" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Stop Loss</Label>
                    <Input
                      type="number"
                      value={orderParams.stopLoss}
                      onChange={(e) => setOrderParams((prev) => ({ ...prev, stopLoss: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Take Profit</Label>
                    <Input
                      type="number"
                      value={orderParams.takeProfit}
                      onChange={(e) => setOrderParams((prev) => ({ ...prev, takeProfit: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              )}

              {selectedOrderType === "TRAILING_STOP" && (
                <div className="space-y-2">
                  <Label>Trail Percentage (%)</Label>
                  <Input
                    type="number"
                    value={orderParams.trailPercent}
                    onChange={(e) => setOrderParams((prev) => ({ ...prev, trailPercent: Number(e.target.value) }))}
                  />
                </div>
              )}

              <Button onClick={handleCreateOrder} className="w-full">
                <Play className="h-4 w-4 mr-2" />
                Create {selectedOrderType} Order
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <div className="space-y-4">
              <Button onClick={handleOptimizePortfolio} className="w-full">
                <BarChart3 className="h-4 w-4 mr-2" />
                Optimize Portfolio
              </Button>

              {optimizationResult && (
                <div className="space-y-4">
                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Expected Return</Label>
                      <p className="text-lg font-semibold text-green-600">
                        {(optimizationResult.expectedReturn * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Expected Risk</Label>
                      <p className="text-lg font-semibold text-red-600">
                        {(optimizationResult.expectedRisk * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Sharpe Ratio</Label>
                      <p className="text-lg font-semibold">{optimizationResult.sharpeRatio.toFixed(2)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Diversification Score</Label>
                      <p className="text-lg font-semibold text-blue-600">
                        {(optimizationResult.diversificationScore * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Rebalancing Actions</Label>
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {optimizationResult.rebalanceActions.map((action: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <Badge variant={action.action === "BUY" ? "default" : "secondary"}>{action.action}</Badge>
                              <span className="font-medium">{action.symbol}</span>
                            </div>
                            <div className="text-right text-sm">
                              <p>${action.amountToTrade.toFixed(2)}</p>
                              <p className="text-muted-foreground">{action.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {activeOrders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No active advanced orders</div>
                ) : (
                  activeOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getOrderTypeIcon(order.type)}
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{order.type}</Badge>
                            <span className="font-medium">{order.symbol}</span>
                            <Badge variant={order.side === "BUY" ? "default" : "secondary"}>{order.side}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Qty: {order.quantity} | Status: {order.status}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">{order.createdAt.toLocaleTimeString()}</p>
                        <Button variant="outline" size="sm" onClick={() => advancedOrderManager.cancelOrder(order.id)}>
                          Cancel
                        </Button>
                      </div>
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
