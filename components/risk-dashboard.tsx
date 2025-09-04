"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Shield, AlertTriangle, TrendingDown, TrendingUp, Target, Settings, AlertCircle } from "lucide-react"
import { RiskManager, type RiskLimits, type RiskMetrics, type RiskAlert } from "@/lib/risk-management"
import { usePortfolio } from "@/hooks/use-portfolio"
import { useMarketData } from "@/hooks/use-market-data"

export function RiskDashboard() {
  const [riskManager, setRiskManager] = useState<RiskManager | null>(null)
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [limits, setLimits] = useState<RiskLimits>({
    maxPortfolioRisk: 10,
    maxPositionSize: 5,
    maxDrawdown: 15,
    maxDailyLoss: 1000,
    maxOpenPositions: 10,
    correlationLimit: 0.7,
    riskPerTrade: 0.02,
  })

  const { portfolioData } = usePortfolio(null)
  const positions = portfolioData?.positions || []
  const balance = portfolioData?.balance || { total: 0, available: 0, reserved: 0 }
  const { marketData } = useMarketData()

  useEffect(() => {
    const manager = new RiskManager(limits)
    setRiskManager(manager)
  }, [limits])

  useEffect(() => {
    if (riskManager && positions && balance && marketData) {
      // Mock historical P&L data - in real app, this would come from trade history
      const mockHistoricalPnL = Array.from({ length: 30 }, () => (Math.random() - 0.5) * 200)

      const metrics = riskManager.calculateRiskMetrics(positions, balance, marketData, mockHistoricalPnL)
      setRiskMetrics(metrics)

      const newAlerts = riskManager.checkRiskLimits(metrics, positions, balance)
      if (newAlerts.length > 0) {
        setAlerts((prev) => [...prev, ...newAlerts].slice(-10))
      }
    }
  }, [riskManager, positions, balance, marketData])

  const updateLimits = () => {
    if (riskManager) {
      riskManager.updateLimits(limits)
      setShowSettings(false)
    }
  }

  const getRiskColor = (value: number, threshold: number) => {
    const percentage = (value / threshold) * 100
    if (percentage >= 90) return "text-red-600"
    if (percentage >= 70) return "text-yellow-600"
    return "text-green-600"
  }

  const getRiskLevel = (value: number, threshold: number) => {
    const percentage = (value / threshold) * 100
    if (percentage >= 90) return "High"
    if (percentage >= 70) return "Medium"
    return "Low"
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <CardTitle>Risk Management</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>Real-time portfolio risk monitoring and alerts</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {showSettings && (
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Risk Limits Configuration</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Portfolio Risk (%)</Label>
                <Input
                  type="number"
                  value={limits.maxPortfolioRisk}
                  onChange={(e) => setLimits((prev) => ({ ...prev, maxPortfolioRisk: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Position Size (%)</Label>
                <Input
                  type="number"
                  value={limits.maxPositionSize}
                  onChange={(e) => setLimits((prev) => ({ ...prev, maxPositionSize: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Drawdown (%)</Label>
                <Input
                  type="number"
                  value={limits.maxDrawdown}
                  onChange={(e) => setLimits((prev) => ({ ...prev, maxDrawdown: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Daily Loss ($)</Label>
                <Input
                  type="number"
                  value={limits.maxDailyLoss}
                  onChange={(e) => setLimits((prev) => ({ ...prev, maxDailyLoss: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={updateLimits} className="flex-1">
                Save Limits
              </Button>
              <Button variant="outline" onClick={() => setShowSettings(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {riskMetrics && (
          <>
            {/* Risk Overview */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Portfolio Risk</span>
                  <Badge variant="outline" className={getRiskColor(riskMetrics.portfolioRisk, limits.maxPortfolioRisk)}>
                    {getRiskLevel(riskMetrics.portfolioRisk, limits.maxPortfolioRisk)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={(riskMetrics.portfolioRisk / limits.maxPortfolioRisk) * 100} className="flex-1" />
                  <span className="text-sm font-medium">{riskMetrics.portfolioRisk.toFixed(1)}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current Drawdown</span>
                  <Badge variant="outline" className={getRiskColor(riskMetrics.currentDrawdown, limits.maxDrawdown)}>
                    {getRiskLevel(riskMetrics.currentDrawdown, limits.maxDrawdown)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={(riskMetrics.currentDrawdown / limits.maxDrawdown) * 100} className="flex-1" />
                  <span className="text-sm font-medium">{riskMetrics.currentDrawdown.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Performance Metrics */}
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Target className="h-4 w-4 text-blue-600" />
                  <span className="text-muted-foreground">Win Rate</span>
                </div>
                <p className="font-medium">{(riskMetrics.winRate * 100).toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-muted-foreground">Avg Win</span>
                </div>
                <p className="font-medium text-green-600">${riskMetrics.avgWin.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <span className="text-muted-foreground">Avg Loss</span>
                </div>
                <p className="font-medium text-red-600">${riskMetrics.avgLoss.toFixed(2)}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <p className="text-muted-foreground">Sharpe Ratio</p>
                <p className="font-medium">{riskMetrics.sharpeRatio.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">Risk/Reward</p>
                <p className="font-medium">{riskMetrics.riskRewardRatio.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-muted-foreground">VaR (95%)</p>
                <p className="font-medium">${riskMetrics.valueAtRisk.toFixed(2)}</p>
              </div>
            </div>
          </>
        )}

        {/* Risk Alerts */}
        {alerts.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                Risk Alerts
              </h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {alerts.slice(-5).map((alert) => (
                  <Alert key={alert.id} variant={alert.type === "critical" ? "destructive" : "default"}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{alert.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
