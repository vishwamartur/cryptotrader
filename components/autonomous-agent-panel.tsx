"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Bot, Play, Square, Pause, Settings, Activity, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { useAutonomousAgent } from "@/hooks/use-autonomous-agent"
import type { AgentConfig } from "@/lib/autonomous-agent"

export function AutonomousAgentPanel() {
  const [showConfig, setShowConfig] = useState(false)
  const [config, setConfig] = useState<AgentConfig>({
    aiConfig: {
      apiKey: "",
      model: "claude-3-5-sonnet-20241022",
      riskTolerance: "moderate",
      maxPositionSize: 5,
      stopLossPercentage: 3,
      takeProfitPercentage: 9,
      enableAutonomousTrading: true,
    },
    riskLimits: {
      maxPortfolioRisk: 10,
      maxPositionSize: 5,
      maxDrawdown: 15,
      maxDailyLoss: 1000,
      maxOpenPositions: 5,
      correlationLimit: 0.7,
      riskPerTrade: 0.02,
    },
    analysisInterval: 5, // 5 minutes
    maxConcurrentAnalyses: 3,
    emergencyStopLoss: 20,
    maxDailyTrades: 10,
    tradingHours: {
      start: "09:00",
      end: "17:00",
      timezone: "UTC",
      weekendsEnabled: false,
    },
  })

  const {
    state,
    decisions,
    isConfigured,
    initializeAgent,
    startAgent,
    stopAgent,
    pauseAgent,
    resumeAgent,
    updateConfig,
    resetDailyCounters,
  } = useAutonomousAgent()

  const handleInitialize = () => {
    if (!config.aiConfig.apiKey.trim()) {
      return
    }
    initializeAgent(config)
    setShowConfig(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING":
        return "bg-green-50 text-green-700"
      case "PAUSED":
        return "bg-yellow-50 text-yellow-700"
      case "ERROR":
        return "bg-red-50 text-red-700"
      default:
        return "bg-gray-50 text-gray-700"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "RUNNING":
        return <Activity className="h-4 w-4 text-green-600" />
      case "PAUSED":
        return <Pause className="h-4 w-4 text-yellow-600" />
      case "ERROR":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Square className="h-4 w-4 text-gray-600" />
    }
  }

  const getDecisionIcon = (action: string) => {
    switch (action) {
      case "TRADE":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "HOLD":
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            <CardTitle>Autonomous Agent</CardTitle>
            {state && (
              <Badge className={getStatusColor(state.status)}>
                {getStatusIcon(state.status)}
                {state.status}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>AI-powered autonomous trading agent</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConfigured && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">Configure the autonomous agent to get started</p>
            <Button onClick={() => setShowConfig(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure Agent
            </Button>
          </div>
        )}

        {showConfig && (
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Agent Configuration</h4>

            <div className="space-y-2">
              <Label>Claude API Key</Label>
              <Input
                type="password"
                placeholder="sk-ant-..."
                value={config.aiConfig.apiKey}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    aiConfig: { ...prev.aiConfig, apiKey: e.target.value },
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Analysis Interval (min)</Label>
                <Input
                  type="number"
                  value={config.analysisInterval}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      analysisInterval: Number(e.target.value),
                    }))
                  }
                  min="1"
                  max="60"
                />
              </div>
              <div className="space-y-2">
                <Label>Max Daily Trades</Label>
                <Input
                  type="number"
                  value={config.maxDailyTrades}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      maxDailyTrades: Number(e.target.value),
                    }))
                  }
                  min="1"
                  max="100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trading Start Time</Label>
                <Input
                  type="time"
                  value={config.tradingHours.start}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      tradingHours: { ...prev.tradingHours, start: e.target.value },
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Trading End Time</Label>
                <Input
                  type="time"
                  value={config.tradingHours.end}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      tradingHours: { ...prev.tradingHours, end: e.target.value },
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Emergency Stop Loss (%)</Label>
              <Input
                type="number"
                value={config.emergencyStopLoss}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    emergencyStopLoss: Number(e.target.value),
                  }))
                }
                min="5"
                max="50"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleInitialize} className="flex-1">
                Initialize Agent
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isConfigured && state && (
          <>
            {/* Control Buttons */}
            <div className="flex gap-2">
              {state.status === "STOPPED" && (
                <Button onClick={startAgent} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Start Agent
                </Button>
              )}
              {state.status === "RUNNING" && (
                <>
                  <Button onClick={pauseAgent} variant="outline" className="flex-1 bg-transparent">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                  <Button onClick={stopAgent} variant="destructive" className="flex-1">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
              {state.status === "PAUSED" && (
                <>
                  <Button onClick={resumeAgent} className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                  <Button onClick={stopAgent} variant="outline" className="flex-1 bg-transparent">
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                </>
              )}
            </div>

            {/* Agent Stats */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Daily Trades</p>
                <p className="font-medium">
                  {state.dailyTrades}/{config.maxDailyTrades}
                </p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Total Trades</p>
                <p className="font-medium">{state.totalTrades}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Daily P&L</p>
                <p className={`font-medium ${state.dailyPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {state.dailyPnL >= 0 ? "+" : ""}${state.dailyPnL.toFixed(2)}
                </p>
              </div>
            </div>

            {state.lastAnalysis && (
              <div className="text-sm text-muted-foreground">
                Last analysis: {state.lastAnalysis.toLocaleTimeString()}
              </div>
            )}

            {/* Errors */}
            {state.errors.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600">Recent Errors</h4>
                  {state.errors.slice(-3).map((error, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </>
            )}

            {/* Recent Decisions */}
            {decisions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium">Recent Decisions</h4>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {decisions.slice(0, 5).map((decision) => (
                        <div key={decision.id} className="flex items-start gap-2 text-sm">
                          {getDecisionIcon(decision.action)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {decision.action}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {decision.timestamp.toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{decision.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetDailyCounters} className="flex-1 bg-transparent">
                Reset Daily Counters
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
