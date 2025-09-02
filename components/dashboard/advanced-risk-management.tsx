"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown,
  RefreshCw,
  Activity,
  Target,
  BarChart3,
  Gauge,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react"

interface RiskMetrics {
  portfolioHeat: number
  maxDrawdown: number
  currentDrawdown: number
  valueAtRisk: number
  expectedShortfall: number
  betaToMarket: number
  correlationRisk: number
  concentrationRisk: number
  liquidityRisk: number
  leverageRatio: number
  riskAdjustedReturn: number
  volatility: number
  sharpeRatio: number
  sortinoRatio: number
  calmarRatio: number
}

interface PositionRisk {
  symbol: string
  positionSize: number
  riskAmount: number
  riskPercentage: number
  stopLoss: number
  unrealizedPnL: number
  daysHeld: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
}

interface RiskAlert {
  id: string
  type: 'WARNING' | 'CRITICAL'
  message: string
  timestamp: string
  acknowledged: boolean
}

interface AdvancedRiskManagementProps {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
}

export function AdvancedRiskManagement({ theme, autoRefresh, refreshInterval }: AdvancedRiskManagementProps) {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null)
  const [positions, setPositions] = useState<PositionRisk[]>([])
  const [alerts, setAlerts] = useState<RiskAlert[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchRiskData = async () => {
    setIsLoading(true)
    try {
      // Simulate risk metrics
      const simulatedMetrics: RiskMetrics = {
        portfolioHeat: Math.random() * 0.15, // 0-15%
        maxDrawdown: 0.08 + Math.random() * 0.07, // 8-15%
        currentDrawdown: Math.random() * 0.05, // 0-5%
        valueAtRisk: 0.03 + Math.random() * 0.04, // 3-7%
        expectedShortfall: 0.05 + Math.random() * 0.05, // 5-10%
        betaToMarket: 0.8 + Math.random() * 0.6, // 0.8-1.4
        correlationRisk: Math.random() * 0.8, // 0-80%
        concentrationRisk: Math.random() * 0.6, // 0-60%
        liquidityRisk: Math.random() * 0.3, // 0-30%
        leverageRatio: 1 + Math.random() * 2, // 1-3x
        riskAdjustedReturn: 0.1 + Math.random() * 0.15, // 10-25%
        volatility: 0.15 + Math.random() * 0.1, // 15-25%
        sharpeRatio: 1.2 + Math.random() * 0.8, // 1.2-2.0
        sortinoRatio: 1.5 + Math.random() * 1.0, // 1.5-2.5
        calmarRatio: 0.8 + Math.random() * 0.7 // 0.8-1.5
      }

      // Simulate position risks
      const simulatedPositions: PositionRisk[] = [
        {
          symbol: 'BTC-USD',
          positionSize: 0.05 + Math.random() * 0.05,
          riskAmount: 200 + Math.random() * 300,
          riskPercentage: 0.02 + Math.random() * 0.03,
          stopLoss: 44000 + Math.random() * 2000,
          unrealizedPnL: (Math.random() - 0.5) * 1000,
          daysHeld: Math.floor(Math.random() * 10),
          riskLevel: Math.random() > 0.7 ? 'HIGH' : Math.random() > 0.4 ? 'MEDIUM' : 'LOW'
        },
        {
          symbol: 'ETH-USD',
          positionSize: 0.03 + Math.random() * 0.04,
          riskAmount: 150 + Math.random() * 200,
          riskPercentage: 0.015 + Math.random() * 0.025,
          stopLoss: 2800 + Math.random() * 400,
          unrealizedPnL: (Math.random() - 0.5) * 500,
          daysHeld: Math.floor(Math.random() * 8),
          riskLevel: Math.random() > 0.6 ? 'HIGH' : Math.random() > 0.3 ? 'MEDIUM' : 'LOW'
        }
      ]

      // Generate risk alerts
      const newAlerts: RiskAlert[] = []
      
      if (simulatedMetrics.portfolioHeat > 0.1) {
        newAlerts.push({
          id: 'heat-warning',
          type: 'WARNING',
          message: `Portfolio heat at ${(simulatedMetrics.portfolioHeat * 100).toFixed(1)}% - consider reducing position sizes`,
          timestamp: new Date().toISOString(),
          acknowledged: false
        })
      }

      if (simulatedMetrics.currentDrawdown > 0.03) {
        newAlerts.push({
          id: 'drawdown-warning',
          type: 'CRITICAL',
          message: `Current drawdown at ${(simulatedMetrics.currentDrawdown * 100).toFixed(1)}% - review risk management`,
          timestamp: new Date().toISOString(),
          acknowledged: false
        })
      }

      if (simulatedMetrics.concentrationRisk > 0.4) {
        newAlerts.push({
          id: 'concentration-warning',
          type: 'WARNING',
          message: 'High concentration risk detected - diversify positions',
          timestamp: new Date().toISOString(),
          acknowledged: false
        })
      }

      setRiskMetrics(simulatedMetrics)
      setPositions(simulatedPositions)
      setAlerts(newAlerts)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch risk data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRiskData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchRiskData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'text-green-600 dark:text-green-400'
      case 'HIGH':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-yellow-600 dark:text-yellow-400'
    }
  }

  const getRiskBadgeColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
      case 'HIGH':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
    }
  }

  const getOverallRiskLevel = () => {
    if (!riskMetrics) return 'MEDIUM'
    
    const riskFactors = [
      riskMetrics.portfolioHeat > 0.1,
      riskMetrics.currentDrawdown > 0.03,
      riskMetrics.valueAtRisk > 0.05,
      riskMetrics.concentrationRisk > 0.5,
      riskMetrics.leverageRatio > 2
    ]
    
    const highRiskCount = riskFactors.filter(Boolean).length
    
    if (highRiskCount >= 3) return 'HIGH'
    if (highRiskCount >= 1) return 'MEDIUM'
    return 'LOW'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Advanced Risk Management
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getRiskBadgeColor(getOverallRiskLevel())}>
              {getOverallRiskLevel()} RISK
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchRiskData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {riskMetrics ? (
          <div className="space-y-6">
            {/* Risk Alerts */}
            {alerts.filter(alert => !alert.acknowledged).length > 0 && (
              <div className="space-y-2">
                {alerts.filter(alert => !alert.acknowledged).map(alert => (
                  <Alert key={alert.id} className={alert.type === 'CRITICAL' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>{alert.message}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {/* Risk Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm font-medium">Portfolio Heat</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {(riskMetrics.portfolioHeat * 100).toFixed(1)}%
                  </div>
                  <Progress value={riskMetrics.portfolioHeat * 100} className="h-2 mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4" />
                    <span className="text-sm font-medium">Current Drawdown</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">
                    {(riskMetrics.currentDrawdown * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Max: {(riskMetrics.maxDrawdown * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4" />
                    <span className="text-sm font-medium">Value at Risk</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {(riskMetrics.valueAtRisk * 100).toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    95% confidence
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="h-4 w-4" />
                    <span className="text-sm font-medium">Leverage</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {riskMetrics.leverageRatio.toFixed(1)}x
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Current exposure
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Risk Metrics Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Risk Ratios
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                    <span className="font-medium">{riskMetrics.sharpeRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sortino Ratio</span>
                    <span className="font-medium">{riskMetrics.sortinoRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Calmar Ratio</span>
                    <span className="font-medium">{riskMetrics.calmarRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Beta to Market</span>
                    <span className="font-medium">{riskMetrics.betaToMarket.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold">Risk Factors</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Concentration Risk</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{(riskMetrics.concentrationRisk * 100).toFixed(0)}%</span>
                      <Badge className={riskMetrics.concentrationRisk > 0.5 ? getRiskBadgeColor('HIGH') : riskMetrics.concentrationRisk > 0.3 ? getRiskBadgeColor('MEDIUM') : getRiskBadgeColor('LOW')}>
                        {riskMetrics.concentrationRisk > 0.5 ? 'HIGH' : riskMetrics.concentrationRisk > 0.3 ? 'MED' : 'LOW'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Correlation Risk</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{(riskMetrics.correlationRisk * 100).toFixed(0)}%</span>
                      <Badge className={riskMetrics.correlationRisk > 0.6 ? getRiskBadgeColor('HIGH') : riskMetrics.correlationRisk > 0.4 ? getRiskBadgeColor('MEDIUM') : getRiskBadgeColor('LOW')}>
                        {riskMetrics.correlationRisk > 0.6 ? 'HIGH' : riskMetrics.correlationRisk > 0.4 ? 'MED' : 'LOW'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Liquidity Risk</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{(riskMetrics.liquidityRisk * 100).toFixed(0)}%</span>
                      <Badge className={riskMetrics.liquidityRisk > 0.2 ? getRiskBadgeColor('HIGH') : riskMetrics.liquidityRisk > 0.1 ? getRiskBadgeColor('MEDIUM') : getRiskBadgeColor('LOW')}>
                        {riskMetrics.liquidityRisk > 0.2 ? 'HIGH' : riskMetrics.liquidityRisk > 0.1 ? 'MED' : 'LOW'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Volatility</span>
                    <span className="font-medium">{(riskMetrics.volatility * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Position Risk Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold">Position Risk Analysis</h4>
              <div className="space-y-3">
                {positions.map((position, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{position.symbol}</span>
                        <Badge className={getRiskBadgeColor(position.riskLevel)}>
                          {position.riskLevel}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          {(position.positionSize * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Position Size
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Risk Amount:</span>
                        <div className="font-medium">${position.riskAmount.toFixed(0)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Risk %:</span>
                        <div className="font-medium">{(position.riskPercentage * 100).toFixed(2)}%</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Unrealized P&L:</span>
                        <div className={`font-medium ${position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(0)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Days Held:</span>
                        <div className="font-medium">{position.daysHeld}</div>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Risk Utilization</span>
                        <span>{(position.riskPercentage * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={position.riskPercentage * 100} className="h-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Recommendations */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold mb-3">Risk Management Recommendations</h4>
              <ul className="space-y-2 text-sm">
                {riskMetrics.portfolioHeat > 0.1 && (
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Consider reducing position sizes to lower portfolio heat below 10%</span>
                  </li>
                )}
                {riskMetrics.concentrationRisk > 0.4 && (
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Diversify holdings to reduce concentration risk</span>
                  </li>
                )}
                {riskMetrics.leverageRatio > 2 && (
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>High leverage detected - consider reducing exposure</span>
                  </li>
                )}
                {riskMetrics.sharpeRatio < 1.5 && (
                  <li className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <span>Improve risk-adjusted returns by optimizing strategy selection</span>
                  </li>
                )}
                {getOverallRiskLevel() === 'LOW' && (
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Risk levels are within acceptable parameters</span>
                  </li>
                )}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {isLoading ? 'Loading risk analysis...' : 'No risk data available'}
          </div>
        )}

        {/* Last Update */}
        <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
