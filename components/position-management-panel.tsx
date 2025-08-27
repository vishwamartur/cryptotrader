"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Briefcase, Play, Square, TrendingUp, TrendingDown, Target, X, BarChart3, CheckCircle } from "lucide-react"
import { usePositionManager } from "@/hooks/use-position-manager"
import type { RebalanceAction } from "@/lib/position-manager"

export function PositionManagementPanel() {
  const [selectedTab, setSelectedTab] = useState("positions")
  const [allocationSymbol, setAllocationSymbol] = useState("")
  const [allocationPercentage, setAllocationPercentage] = useState("")

  const {
    positions,
    metrics,
    rebalanceActions,
    isRunning,
    startManager,
    stopManager,
    closePosition,
    enableTakeProfit,
    setTargetAllocation,
  } = usePositionManager()

  const openPositions = positions.filter((p) => p.status === "OPEN")
  const closedPositions = positions.filter((p) => p.status === "CLOSED")

  const handleSetAllocation = () => {
    if (allocationSymbol && allocationPercentage) {
      setTargetAllocation(allocationSymbol, Number(allocationPercentage))
      setAllocationSymbol("")
      setAllocationPercentage("")
    }
  }

  const getPositionColor = (pnl: number) => {
    return pnl >= 0 ? "text-green-600" : "text-red-600"
  }

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 7) return "text-red-600"
    if (riskScore >= 4) return "text-yellow-600"
    return "text-green-600"
  }

  const getPriorityColor = (priority: RebalanceAction["priority"]) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-50 text-red-700"
      case "MEDIUM":
        return "bg-yellow-50 text-yellow-700"
      default:
        return "bg-blue-50 text-blue-700"
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-blue-600" />
            <CardTitle>Position Management</CardTitle>
            <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <Button onClick={startManager} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button onClick={stopManager} variant="outline" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </div>
        <CardDescription>Centralized position tracking and portfolio management</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
            <TabsTrigger value="allocation">Allocation</TabsTrigger>
            <TabsTrigger value="rebalance">Rebalance</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Open Positions ({openPositions.length})</h4>
              {metrics && (
                <div className="text-sm text-muted-foreground">
                  Total P&L:{" "}
                  <span className={getPositionColor(metrics.totalPnL)}>
                    {metrics.totalPnL >= 0 ? "+" : ""}${metrics.totalPnL.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            <ScrollArea className="h-96">
              <div className="space-y-3">
                {openPositions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No open positions</div>
                ) : (
                  openPositions.map((position) => (
                    <div key={position.id} className="p-4 border rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{position.symbol}</span>
                          <Badge
                            variant="outline"
                            className={position.side === "BUY" ? "text-green-600" : "text-red-600"}
                          >
                            {position.side}
                          </Badge>
                          {position.aiGenerated && (
                            <Badge variant="secondary" className="text-xs">
                              AI {position.aiConfidence}%
                            </Badge>
                          )}
                          {position.takeProfitActive && (
                            <Badge variant="outline" className="text-xs">
                              <Target className="h-3 w-3 mr-1" />
                              TP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => enableTakeProfit(position.id, "balanced")}
                            disabled={position.takeProfitActive}
                          >
                            <Target className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => closePosition(position.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Size</p>
                          <p className="font-medium">{position.size.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Entry</p>
                          <p className="font-medium">${position.entryPrice.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Current</p>
                          <p className="font-medium">${position.currentPrice.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">P&L</p>
                          <p className={`font-medium ${getPositionColor(position.unrealizedPnL)}`}>
                            {position.unrealizedPnL >= 0 ? "+" : ""}${position.unrealizedPnL.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-4">
                          <span className="text-muted-foreground">
                            Risk: <span className={getRiskColor(position.riskScore)}>{position.riskScore}/10</span>
                          </span>
                          <span className="text-muted-foreground">Hold: {position.holdingPeriod.toFixed(1)}h</span>
                        </div>
                        <span className="text-muted-foreground">{position.trades.length} trades</span>
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
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm text-muted-foreground">Portfolio Value</span>
                    </div>
                    <p className="text-2xl font-bold">${metrics.totalValue.toFixed(2)}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">Total Return</span>
                    </div>
                    <p className={`text-2xl font-bold ${getPositionColor(metrics.totalReturn)}`}>
                      {metrics.totalReturn >= 0 ? "+" : ""}
                      {metrics.totalReturn.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Net P&L</p>
                    <p className={`font-medium ${getPositionColor(metrics.netPnL)}`}>${metrics.netPnL.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Win Rate</p>
                    <p className="font-medium">{(metrics.winRate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Max Drawdown</p>
                    <p className="font-medium text-red-600">${metrics.maxDrawdown.toFixed(2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Open Positions</p>
                    <p className="font-medium">{metrics.openPositions}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Position</p>
                    <p className="font-medium">${metrics.avgPositionSize.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Concentration</p>
                    <p className="font-medium">{metrics.concentration.toFixed(1)}%</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Portfolio Risk</span>
                    <span>{metrics.portfolioRisk.toFixed(1)}%</span>
                  </div>
                  <Progress value={metrics.portfolioRisk} className="h-2" />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            <div className="space-y-4">
              <h4 className="font-medium">Set Target Allocation</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Symbol</Label>
                  <Input
                    placeholder="BTC-USD"
                    value={allocationSymbol}
                    onChange={(e) => setAllocationSymbol(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Percentage</Label>
                  <Input
                    type="number"
                    placeholder="25"
                    value={allocationPercentage}
                    onChange={(e) => setAllocationPercentage(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleSetAllocation} className="w-full">
                Set Allocation
              </Button>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Current Allocations</h4>
              <div className="text-center py-4 text-muted-foreground">No allocations set yet</div>
            </div>
          </TabsContent>

          <TabsContent value="rebalance" className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-medium">Rebalance Actions</h4>
              <Badge variant="outline">{rebalanceActions.length} actions</Badge>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {rebalanceActions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    Portfolio is balanced
                  </div>
                ) : (
                  rebalanceActions.map((action, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {action.action === "BUY" ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{action.symbol}</span>
                            <Badge variant="outline" className={getPriorityColor(action.priority)}>
                              {action.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{action.reason}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {action.action} {action.sizeChange.toFixed(4)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {action.currentSize.toFixed(4)} → {action.targetSize.toFixed(4)}
                        </p>
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
