"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Target, Play, Square, Activity, CheckCircle, Clock } from "lucide-react"
import { useTakeProfit } from "@/hooks/use-take-profit"
import type { PositionTakeProfit, TakeProfitEvent } from "@/lib/take-profit-system"

export function TakeProfitPanel() {
  const [selectedStrategy, setSelectedStrategy] = useState("balanced")
  const [customTakeProfitPrice, setCustomTakeProfitPrice] = useState("")
  const [selectedTab, setSelectedTab] = useState("positions")

  const { isRunning, strategies, activePositions, events, startSystem, stopSystem } = useTakeProfit()

  const getStrategyColor = (type: string) => {
    switch (type) {
      case "TRAILING":
        return "bg-blue-50 text-blue-700"
      case "SCALED":
        return "bg-green-50 text-green-700"
      case "DYNAMIC":
        return "bg-purple-50 text-purple-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  const getEventIcon = (type: TakeProfitEvent["type"]) => {
    switch (type) {
      case "PARTIAL_CLOSE":
      case "FULL_CLOSE":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "TRAILING_UPDATED":
        return <Activity className="h-4 w-4 text-blue-600" />
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />
    }
  }

  const calculateUnrealizedProfit = (position: PositionTakeProfit) => {
    const priceDiff =
      position.side === "BUY"
        ? position.currentPrice - position.entryPrice
        : position.entryPrice - position.currentPrice
    return priceDiff * position.remainingSize
  }

  const getProgressToNextLevel = (position: PositionTakeProfit) => {
    const nextLevel = position.strategy.levels.find((l) => l.isActive && !l.isTriggered)
    if (!nextLevel) return 100

    const priceDiff =
      position.side === "BUY"
        ? position.currentPrice - position.entryPrice
        : position.entryPrice - position.currentPrice

    const targetDiff =
      position.side === "BUY"
        ? nextLevel.priceTarget - position.entryPrice
        : position.entryPrice - nextLevel.priceTarget

    return Math.min(100, Math.max(0, (priceDiff / targetDiff) * 100))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-green-600" />
            <CardTitle>Take Profit System</CardTitle>
            <Badge variant={isRunning ? "default" : "secondary"}>{isRunning ? "Active" : "Inactive"}</Badge>
          </div>
          <div className="flex gap-2">
            {!isRunning ? (
              <Button onClick={startSystem} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button onClick={stopSystem} variant="outline" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
        </div>
        <CardDescription>Automated take profit management with trailing stops</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="strategies">Strategies</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {activePositions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No active take profit positions</div>
                ) : (
                  activePositions.map((position) => {
                    const unrealizedProfit = calculateUnrealizedProfit(position)
                    const progress = getProgressToNextLevel(position)
                    const activeLevels = position.strategy.levels.filter((l) => l.isActive && !l.isTriggered).length
                    const triggeredLevels = position.strategy.levels.filter((l) => l.isTriggered).length

                    return (
                      <div key={position.tradeId} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{position.symbol}</span>
                            <Badge
                              variant="outline"
                              className={position.side === "BUY" ? "text-green-600" : "text-red-600"}
                            >
                              {position.side}
                            </Badge>
                            <Badge variant="outline" className={getStrategyColor(position.strategy.type)}>
                              {position.strategy.name}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${unrealizedProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                              {unrealizedProfit >= 0 ? "+" : ""}${unrealizedProfit.toFixed(2)}
                            </div>
                            <div className="text-sm text-muted-foreground">${position.currentPrice.toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progress to next level</span>
                            <span>{progress.toFixed(1)}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Entry Price</p>
                            <p className="font-medium">${position.entryPrice.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Remaining Size</p>
                            <p className="font-medium">{position.remainingSize.toFixed(4)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Realized Profit</p>
                            <p className="font-medium text-green-600">${position.totalProfitRealized.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Levels: {triggeredLevels} triggered, {activeLevels} active
                          </span>
                          <span className="text-muted-foreground">
                            Updated: {position.lastUpdate.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="strategies" className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Select Strategy</Label>
                <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {strategies.map((strategy) => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name} ({strategy.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Custom Take Profit Price (Optional)</Label>
                <Input
                  type="number"
                  placeholder="Enter target price"
                  value={customTakeProfitPrice}
                  onChange={(e) => setCustomTakeProfitPrice(e.target.value)}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-medium">Available Strategies</h4>
              {strategies.map((strategy) => (
                <div key={strategy.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{strategy.name}</span>
                      <Badge variant="outline" className={getStrategyColor(strategy.type)}>
                        {strategy.type}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">{strategy.levels.length} levels</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {strategy.levels.map((level, index) => (
                      <span key={level.id}>
                        {level.percentage}%{level.trailingDistance ? ` (trailing ${level.trailingDistance}%)` : ""}
                        {index < strategy.levels.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="events" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-2">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No events yet</div>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      {getEventIcon(event.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {event.type.replace("_", " ")}
                          </Badge>
                          {event.profit > 0 && (
                            <span className="text-sm font-medium text-green-600">+${event.profit.toFixed(2)}</span>
                          )}
                        </div>
                        <p className="text-sm">{event.reason}</p>
                        <p className="text-xs text-muted-foreground">{event.timestamp.toLocaleString()}</p>
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
