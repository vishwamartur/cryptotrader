"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Brain, TrendingUp, TrendingDown, Minus, Settings, Play } from "lucide-react"
import { useAITrading } from "@/hooks/use-ai-trading"
import { useMarketData } from "@/hooks/use-market-data"
import { usePortfolio } from "@/hooks/use-portfolio"

export function AITradingPanel() {
  const [showConfig, setShowConfig] = useState(false)
  const [apiKey, setApiKey] = useState("")
  const [riskTolerance, setRiskTolerance] = useState<"conservative" | "moderate" | "aggressive">("moderate")
  const [maxPositionSize, setMaxPositionSize] = useState(10)
  const [stopLossPercentage, setStopLossPercentage] = useState(5)
  const [takeProfitPercentage, setTakeProfitPercentage] = useState(15)
  const [enableAutonomous, setEnableAutonomous] = useState(false)

  const { analysis, isAnalyzing, isConfigured, config, initializeEngine, analyzeMarket, updateConfig } = useAITrading()

  const { marketData } = useMarketData()
  const { positions, balance } = usePortfolio()

  const handleConfigureAI = () => {
    if (!apiKey.trim()) {
      return
    }

    const aiConfig = {
      apiKey: apiKey.trim(),
      model: "llama-3.1-sonar-large-128k-online",
      riskTolerance,
      maxPositionSize,
      stopLossPercentage,
      takeProfitPercentage,
      enableAutonomousTrading: enableAutonomous,
    }

    initializeEngine(aiConfig)
    setShowConfig(false)
  }

  const handleAnalyze = () => {
    if (marketData && positions !== undefined && balance !== undefined) {
      analyzeMarket(marketData, positions, balance)
    }
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case "BUY":
        return "text-green-600 bg-green-50"
      case "SELL":
        return "text-red-600 bg-red-50"
      default:
        return "text-yellow-600 bg-yellow-50"
    }
  }

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case "BUY":
        return <TrendingUp className="h-4 w-4" />
      case "SELL":
        return <TrendingDown className="h-4 w-4" />
      default:
        return <Minus className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-600" />
            <CardTitle>AI Trading Engine</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {config?.enableAutonomousTrading && (
              <Badge variant="secondary" className="text-xs">
                <Play className="h-3 w-3 mr-1" />
                Autonomous
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>AI-powered market analysis and autonomous trading</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConfigured && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">Configure your AI trading engine to get started</p>
            <Button onClick={() => setShowConfig(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure AI Engine
            </Button>
          </div>
        )}

        {showConfig && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="api-key">Perplexity API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="pplx-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Risk Tolerance</Label>
                <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Position Size (%)</Label>
                <Input
                  type="number"
                  value={maxPositionSize}
                  onChange={(e) => setMaxPositionSize(Number(e.target.value))}
                  min="1"
                  max="50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Stop Loss (%)</Label>
                <Input
                  type="number"
                  value={stopLossPercentage}
                  onChange={(e) => setStopLossPercentage(Number(e.target.value))}
                  min="1"
                  max="20"
                />
              </div>

              <div className="space-y-2">
                <Label>Take Profit (%)</Label>
                <Input
                  type="number"
                  value={takeProfitPercentage}
                  onChange={(e) => setTakeProfitPercentage(Number(e.target.value))}
                  min="5"
                  max="50"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autonomous">Enable Autonomous Trading</Label>
              <Switch id="autonomous" checked={enableAutonomous} onCheckedChange={setEnableAutonomous} />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleConfigureAI} className="flex-1">
                Save Configuration
              </Button>
              <Button variant="outline" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isConfigured && (
          <>
            <div className="flex gap-2">
              <Button onClick={handleAnalyze} disabled={isAnalyzing} className="flex-1">
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze Market
                  </>
                )}
              </Button>
            </div>

            {analysis && (
              <div className="space-y-3">
                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getSignalIcon(analysis.signal)}
                    <Badge className={getSignalColor(analysis.signal)}>{analysis.signal}</Badge>
                  </div>
                  <Badge variant="outline">
                    {(analysis.confidence > 1 ? analysis.confidence : Math.round(analysis.confidence * 100))}% confidence
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Entry Price</p>
                    <p className="font-medium">${analysis.entryPrice?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Position Size</p>
                    <p className="font-medium">${analysis.positionSize?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stop Loss</p>
                    <p className="font-medium text-red-600">${analysis.stopLoss?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Take Profit</p>
                    <p className="font-medium text-green-600">${analysis.takeProfit?.toFixed(2)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">AI Reasoning:</p>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded">{analysis.reasoning}</p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
