"use client"

import React, { useState, useEffect } from "react"

import { QuantStrategyEngine, MovingAverageCrossoverStrategy, QuantSignal } from "../lib/quant-strategy-engine"
import { DummyMarketDataProvider } from "../lib/market-data-provider"
import { DummyOrderExecutor } from "../lib/quant-order-executor"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Settings, AlertCircle } from "lucide-react"
import { useTrading } from "@/hooks/use-trading"
import { OrderBook } from "@/components/order-book"
import { ApiCredentialsDialog } from "@/components/api-credentials-dialog"
import {
  mean,
  stddev,
  sharpeRatio,
  maxDrawdown,
  correlation
} from "../lib/quant-math"

interface TradingFormData {
  symbol: string
  price: string
  amount: string
  orderType: "limit_order" | "market_order"
}

const TRADING_PAIRS = [
  { value: "BTCUSDT", label: "BTC/USDT", product_id: "1" },
  { value: "ETHUSDT", label: "ETH/USDT", product_id: "2" },
  { value: "ADAUSDT", label: "ADA/USDT", product_id: "3" },
  { value: "SOLUSDT", label: "SOL/USDT", product_id: "4" },
]

export function TradingInterface() {
  // Quant Analytics State
  const [quantStats, setQuantStats] = useState<any>(null)
  useEffect(() => {
    if (quantPrices.length > 0) {
      const stats = {
        mean: mean(quantPrices),
        stddev: stddev(quantPrices),
        sharpe: sharpeRatio(quantPrices),
        drawdown: maxDrawdown(quantPrices),
        correlation: correlation(quantPrices, quantPrices.map((v, i) => i)), // demo: price vs time
      }
      setQuantStats(stats)
    }
  }, [quantPrices])
  const [buyForm, setBuyForm] = useState<TradingFormData>({
    symbol: "",
    price: "",
    amount: "",
    orderType: "limit_order",
  })
  const [sellForm, setSellForm] = useState<TradingFormData>({
    symbol: "",
    price: "",
    amount: "",
    orderType: "limit_order",
  })
  const [selectedPair, setSelectedPair] = useState("")
  const [apiCredentials, setApiCredentials] = useState<{ api_key: string; api_secret: string } | null>(null)
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false)

  const { placeOrder, isPlacingOrder } = useTrading()
  
  // Quant Trading State
  const [quantSymbol, setQuantSymbol] = useState("BTCUSDT")
  const [quantSignal, setQuantSignal] = useState<QuantSignal | null>(null)
  const [quantPrices, setQuantPrices] = useState<number[]>([])
  const [isQuantLoading, setIsQuantLoading] = useState(false)
  const quantEngine = new QuantStrategyEngine()
  quantEngine.addStrategy(MovingAverageCrossoverStrategy)
  const marketProvider = new DummyMarketDataProvider()
  const orderExecutor = new DummyOrderExecutor()
  
  useEffect(() => {
    async function fetchData() {
      setIsQuantLoading(true)
      // Simulate fetching historical prices
      const now = Date.now()
      const oneDayAgo = now - 24 * 3600 * 1000
      const data = await marketProvider.getHistoricalData(quantSymbol, oneDayAgo, now)
      setQuantPrices(data.map(d => d.price))
      setIsQuantLoading(false)
    }
    fetchData()
  }, [quantSymbol])
  
  useEffect(() => {
    if (quantPrices.length > 0) {
      const signal = MovingAverageCrossoverStrategy.run({ prices: quantPrices })
      setQuantSignal(signal)
    }
  }, [quantPrices])
  
  const handleQuantTrade = async () => {
    if (!quantSignal || quantSignal.action === "hold") return
    // For demo, use fixed quantity
    const order = {
      symbol: quantSymbol,
      action: quantSignal.action,
      quantity: 0.001,
      price: quantPrices[quantPrices.length - 1],
    }
    await orderExecutor.executeOrder(order)
    alert(`Executed ${order.action} order for ${order.symbol} at ${order.price}`)
  }

  const handleBuySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiCredentials) {
      setShowCredentialsDialog(true)
      return
    }

    const selectedProduct = TRADING_PAIRS.find((pair) => pair.value === buyForm.symbol)
    if (!selectedProduct) return

    await placeOrder(
      {
        product_id: selectedProduct.product_id,
        size: buyForm.amount,
        side: "buy",
        order_type: buyForm.orderType,
        ...(buyForm.orderType === "limit_order" && { limit_price: buyForm.price }),
      },
      apiCredentials,
    )
  }

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiCredentials) {
      setShowCredentialsDialog(true)
      return
    }

    const selectedProduct = TRADING_PAIRS.find((pair) => pair.value === sellForm.symbol)
    if (!selectedProduct) return

    await placeOrder(
      {
        product_id: selectedProduct.product_id,
        size: sellForm.amount,
        side: "sell",
        order_type: sellForm.orderType,
        ...(sellForm.orderType === "limit_order" && { limit_price: sellForm.price }),
      },
      apiCredentials,
    )
  }

  const calculateTotal = (price: string, amount: string) => {
    const p = Number.parseFloat(price) || 0
    const a = Number.parseFloat(amount) || 0
    return (p * a).toFixed(2)
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trading Interface */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Trading Interface
                <div className="flex items-center gap-2">
                  {!apiCredentials && (
                    <Badge variant="outline" className="text-xs">
                  {/* Quant Analytics Panel */}
                  <div className="mt-8">
                    <Card>
                      <CardHeader>
                        <CardTitle>Quant Analytics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {quantStats ? (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><strong>Mean:</strong> {quantStats.mean.toFixed(2)}</div>
                            <div><strong>Std Dev:</strong> {quantStats.stddev.toFixed(2)}</div>
                            <div><strong>Sharpe Ratio:</strong> {quantStats.sharpe.toFixed(2)}</div>
                            <div><strong>Max Drawdown:</strong> {(quantStats.drawdown * 100).toFixed(2)}%</div>
                            <div><strong>Correlation:</strong> {quantStats.correlation.toFixed(2)}</div>
                          </div>
                        ) : (
                          <div>Loading analytics...</div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                  {/* Quant Trading Panel */}
                  <div className="mt-8">
                    <Card>
                      <CardHeader>
                        <CardTitle>Quant Trading</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-col gap-4">
                          <div>
                            <Label htmlFor="quant-symbol">Symbol</Label>
                            <Select value={quantSymbol} onValueChange={setQuantSymbol}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select pair" />
                              </SelectTrigger>
                              <SelectContent>
                                {TRADING_PAIRS.map((pair) => (
                                  <SelectItem key={pair.value} value={pair.value}>
                                    {pair.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Strategy</Label>
                            <Badge variant="outline">Moving Average Crossover</Badge>
                          </div>
                          <div>
                            <Label>Signal</Label>
                            {isQuantLoading ? (
                              <span>Loading...</span>
                            ) : quantSignal ? (
                              <span>
                                <Badge variant={quantSignal.action === "buy" ? "success" : quantSignal.action === "sell" ? "destructive" : "outline"}>
                                  {quantSignal.action.toUpperCase()}
                                </Badge>
                                {quantSignal.confidence > 0 && (
                                  <span className="ml-2 text-xs text-muted-foreground">Confidence: {(quantSignal.confidence * 100).toFixed(1)}%</span>
                                )}
                              </span>
                            ) : (
                              <span>No signal</span>
                            )}
                          </div>
                          <Button
                            className="w-full"
                            disabled={!quantSignal || quantSignal.action === "hold"}
                            onClick={handleQuantTrade}
                          >
                            Execute Quant Trade
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                      <AlertCircle className="h-3 w-3 mr-1" />
                      API Required
                    </Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowCredentialsDialog(true)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="spot" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="spot">Spot</TabsTrigger>
                  <TabsTrigger value="futures">Futures</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                </TabsList>

                <TabsContent value="spot" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Buy Order */}
                    <form onSubmit={handleBuySubmit} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <h3 className="font-semibold text-green-600">Buy Order</h3>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="buy-pair">Trading Pair</Label>
                          <Select
                            value={buyForm.symbol}
                            onValueChange={(value) => {
                              setBuyForm({ ...buyForm, symbol: value })
                              setSelectedPair(value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select pair" />
                            </SelectTrigger>
                            <SelectContent>
                              {TRADING_PAIRS.map((pair) => (
                                <SelectItem key={pair.value} value={pair.value}>
                                  {pair.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="buy-order-type">Order Type</Label>
                          <Select
                            value={buyForm.orderType}
                            onValueChange={(value: "limit_order" | "market_order") =>
                              setBuyForm({ ...buyForm, orderType: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="limit_order">Limit Order</SelectItem>
                              <SelectItem value="market_order">Market Order</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {buyForm.orderType === "limit_order" && (
                          <div>
                            <Label htmlFor="buy-price">Price (USDT)</Label>
                            <Input
                              id="buy-price"
                              type="number"
                              step="0.01"
                              placeholder="43,250.00"
                              value={buyForm.price}
                              onChange={(e) => setBuyForm({ ...buyForm, price: e.target.value })}
                              required
                            />
                          </div>
                        )}

                        <div>
                          <Label htmlFor="buy-amount">Amount</Label>
                          <Input
                            id="buy-amount"
                            type="number"
                            step="0.00000001"
                            placeholder="0.001"
                            value={buyForm.amount}
                            onChange={(e) => setBuyForm({ ...buyForm, amount: e.target.value })}
                            required
                          />
                        </div>

                        {buyForm.orderType === "limit_order" && (
                          <div>
                            <Label htmlFor="buy-total">Total (USDT)</Label>
                            <Input id="buy-total" value={calculateTotal(buyForm.price, buyForm.amount)} disabled />
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={isPlacingOrder || !buyForm.symbol || !buyForm.amount}
                        >
                          {isPlacingOrder ? "Placing Order..." : "Place Buy Order"}
                        </Button>
                      </div>
                    </form>

                    {/* Sell Order */}
                    <form onSubmit={handleSellSubmit} className="space-y-4">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-red-500" />
                        <h3 className="font-semibold text-red-600">Sell Order</h3>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="sell-pair">Trading Pair</Label>
                          <Select
                            value={sellForm.symbol}
                            onValueChange={(value) => {
                              setSellForm({ ...sellForm, symbol: value })
                              setSelectedPair(value)
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select pair" />
                            </SelectTrigger>
                            <SelectContent>
                              {TRADING_PAIRS.map((pair) => (
                                <SelectItem key={pair.value} value={pair.value}>
                                  {pair.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="sell-order-type">Order Type</Label>
                          <Select
                            value={sellForm.orderType}
                            onValueChange={(value: "limit_order" | "market_order") =>
                              setSellForm({ ...sellForm, orderType: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="limit_order">Limit Order</SelectItem>
                              <SelectItem value="market_order">Market Order</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {sellForm.orderType === "limit_order" && (
                          <div>
                            <Label htmlFor="sell-price">Price (USDT)</Label>
                            <Input
                              id="sell-price"
                              type="number"
                              step="0.01"
                              placeholder="43,250.00"
                              value={sellForm.price}
                              onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })}
                              required
                            />
                          </div>
                        )}

                        <div>
                          <Label htmlFor="sell-amount">Amount</Label>
                          <Input
                            id="sell-amount"
                            type="number"
                            step="0.00000001"
                            placeholder="0.001"
                            value={sellForm.amount}
                            onChange={(e) => setSellForm({ ...sellForm, amount: e.target.value })}
                            required
                          />
                        </div>

                        {sellForm.orderType === "limit_order" && (
                          <div>
                            <Label htmlFor="sell-total">Total (USDT)</Label>
                            <Input id="sell-total" value={calculateTotal(sellForm.price, sellForm.amount)} disabled />
                          </div>
                        )}

                        <Button
                          type="submit"
                          className="w-full bg-red-600 hover:bg-red-700"
                          disabled={isPlacingOrder || !sellForm.symbol || !sellForm.amount}
                        >
                          {isPlacingOrder ? "Placing Order..." : "Place Sell Order"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </TabsContent>

                <TabsContent value="futures">
                  <p className="text-center text-muted-foreground py-8">
                    Futures trading interface will be implemented next
                  </p>
                </TabsContent>

                <TabsContent value="options">
                  <p className="text-center text-muted-foreground py-8">
                    Options trading interface will be implemented next
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Order Book */}
        <div className="lg:col-span-1">
          <OrderBook symbol={selectedPair} />
        </div>
      </div>

      <ApiCredentialsDialog
        open={showCredentialsDialog}
        onOpenChange={setShowCredentialsDialog}
        onSave={setApiCredentials}
        currentCredentials={apiCredentials}
      />
    </>
  )
}
