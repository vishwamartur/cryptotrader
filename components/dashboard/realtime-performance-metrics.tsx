"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3,
  RefreshCw,
  Activity,
  Target,
  Shield,
  Zap,
  Award,
  AlertTriangle
} from "lucide-react"

interface PerformanceMetrics {
  totalReturn: number
  dailyReturn: number
  weeklyReturn: number
  monthlyReturn: number
  sharpeRatio: number
  sortinoRatio: number
  maxDrawdown: number
  currentDrawdown: number
  winRate: number
  profitFactor: number
  totalTrades: number
  winningTrades: number
  losingTrades: number
  avgWin: number
  avgLoss: number
  largestWin: number
  largestLoss: number
  consecutiveWins: number
  consecutiveLosses: number
  portfolioValue: number
  unrealizedPnL: number
  realizedPnL: number
  volatility: number
}

interface RealTimePerformanceMetricsProps {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
}

export function RealTimePerformanceMetrics({ theme, autoRefresh, refreshInterval }: RealTimePerformanceMetricsProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [previousMetrics, setPreviousMetrics] = useState<PerformanceMetrics | null>(null)

  const fetchMetrics = async () => {
    setIsLoading(true)
    try {
      // In a real implementation, this would fetch from your performance tracking API
      // For now, we'll simulate realistic performance metrics
      const simulatedMetrics: PerformanceMetrics = {
        totalReturn: 0.15 + (Math.random() - 0.5) * 0.1, // 15% ± 5%
        dailyReturn: (Math.random() - 0.5) * 0.05, // ±2.5% daily
        weeklyReturn: (Math.random() - 0.5) * 0.15, // ±7.5% weekly
        monthlyReturn: 0.08 + (Math.random() - 0.5) * 0.1, // 8% ± 5% monthly
        sharpeRatio: 1.2 + Math.random() * 0.8, // 1.2-2.0
        sortinoRatio: 1.5 + Math.random() * 1.0, // 1.5-2.5
        maxDrawdown: 0.08 + Math.random() * 0.07, // 8-15%
        currentDrawdown: Math.random() * 0.05, // 0-5%
        winRate: 0.55 + Math.random() * 0.2, // 55-75%
        profitFactor: 1.3 + Math.random() * 0.7, // 1.3-2.0
        totalTrades: 150 + Math.floor(Math.random() * 50),
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 250 + Math.random() * 200, // $250-450
        avgLoss: 180 + Math.random() * 120, // $180-300
        largestWin: 1200 + Math.random() * 800, // $1200-2000
        largestLoss: -800 - Math.random() * 400, // -$800 to -$1200
        consecutiveWins: Math.floor(Math.random() * 8),
        consecutiveLosses: Math.floor(Math.random() * 4),
        portfolioValue: 10000 * (1 + (0.15 + (Math.random() - 0.5) * 0.1)),
        unrealizedPnL: (Math.random() - 0.5) * 500, // ±$250
        realizedPnL: 1500 + (Math.random() - 0.5) * 1000, // $1500 ± $500
        volatility: 0.15 + Math.random() * 0.1 // 15-25%
      }

      // Calculate dependent values
      simulatedMetrics.winningTrades = Math.floor(simulatedMetrics.totalTrades * simulatedMetrics.winRate)
      simulatedMetrics.losingTrades = simulatedMetrics.totalTrades - simulatedMetrics.winningTrades

      setPreviousMetrics(metrics)
      setMetrics(simulatedMetrics)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch performance metrics:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const getChangeIndicator = (current: number, previous: number | undefined) => {
    if (!previous) return null
    const change = current - previous
    if (Math.abs(change) < 0.001) return null
    
    return (
      <span className={`text-xs ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
        {change > 0 ? '↗' : '↘'} {Math.abs(change * 100).toFixed(2)}%
      </span>
    )
  }

  const getPerformanceColor = (value: number, threshold: { good: number; bad: number }) => {
    if (value >= threshold.good) return 'text-green-600 dark:text-green-400'
    if (value <= threshold.bad) return 'text-red-600 dark:text-red-400'
    return 'text-yellow-600 dark:text-yellow-400'
  }

  const getMetricBadge = (value: number, thresholds: { excellent: number; good: number; poor: number }) => {
    if (value >= thresholds.excellent) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Excellent</Badge>
    if (value >= thresholds.good) return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Good</Badge>
    if (value >= thresholds.poor) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Fair</Badge>
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Poor</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-Time Performance Metrics
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchMetrics}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {metrics ? (
          <div className="space-y-6">
            {/* Portfolio Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-sm font-medium">Portfolio Value</span>
                  </div>
                  <div className="text-2xl font-bold">
                    ${metrics.portfolioValue.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${metrics.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.totalReturn >= 0 ? '+' : ''}{(metrics.totalReturn * 100).toFixed(2)}%
                    </span>
                    {getChangeIndicator(metrics.totalReturn, previousMetrics?.totalReturn)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Daily P&L</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {metrics.dailyReturn >= 0 ? '+' : ''}${(metrics.dailyReturn * metrics.portfolioValue).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${metrics.dailyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(metrics.dailyReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4" />
                    <span className="text-sm font-medium">Win Rate</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {(metrics.winRate * 100).toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {metrics.winningTrades}/{metrics.totalTrades} trades
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" />
                    <span className="text-sm font-medium">Sharpe Ratio</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {metrics.sharpeRatio.toFixed(2)}
                  </div>
                  <div className="flex items-center gap-2">
                    {getMetricBadge(metrics.sharpeRatio, { excellent: 2.0, good: 1.5, poor: 1.0 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Return Analysis
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Return</span>
                    <span className={`font-medium ${getPerformanceColor(metrics.totalReturn, { good: 0.1, bad: -0.05 })}`}>
                      {metrics.totalReturn >= 0 ? '+' : ''}{(metrics.totalReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Weekly Return</span>
                    <span className={`font-medium ${getPerformanceColor(metrics.weeklyReturn, { good: 0.05, bad: -0.02 })}`}>
                      {metrics.weeklyReturn >= 0 ? '+' : ''}{(metrics.weeklyReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Monthly Return</span>
                    <span className={`font-medium ${getPerformanceColor(metrics.monthlyReturn, { good: 0.08, bad: -0.03 })}`}>
                      {metrics.monthlyReturn >= 0 ? '+' : ''}{(metrics.monthlyReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Volatility</span>
                    <span className="font-medium">
                      {(metrics.volatility * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Risk Metrics
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sharpe Ratio</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{metrics.sharpeRatio.toFixed(2)}</span>
                      {getMetricBadge(metrics.sharpeRatio, { excellent: 2.0, good: 1.5, poor: 1.0 })}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sortino Ratio</span>
                    <span className="font-medium">{metrics.sortinoRatio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Max Drawdown</span>
                    <span className={`font-medium ${getPerformanceColor(-metrics.maxDrawdown, { good: -0.05, bad: -0.15 })}`}>
                      -{(metrics.maxDrawdown * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Current Drawdown</span>
                    <span className={`font-medium ${metrics.currentDrawdown > 0.03 ? 'text-red-600' : 'text-green-600'}`}>
                      -{(metrics.currentDrawdown * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trading Statistics */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Trading Statistics
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Profit Factor</span>
                  <div className="text-lg font-bold">{metrics.profitFactor.toFixed(2)}</div>
                  {getMetricBadge(metrics.profitFactor, { excellent: 2.0, good: 1.5, poor: 1.2 })}
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Avg Win</span>
                  <div className="text-lg font-bold text-green-600">${metrics.avgWin.toFixed(0)}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Avg Loss</span>
                  <div className="text-lg font-bold text-red-600">${metrics.avgLoss.toFixed(0)}</div>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">Total Trades</span>
                  <div className="text-lg font-bold">{metrics.totalTrades}</div>
                </div>
              </div>
            </div>

            {/* P&L Breakdown */}
            <div className="space-y-4">
              <h4 className="font-semibold">P&L Breakdown</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Realized P&L</span>
                    <span className={`font-medium ${metrics.realizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.realizedPnL >= 0 ? '+' : ''}${metrics.realizedPnL.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, Math.abs(metrics.realizedPnL) / 2000 * 100)} 
                    className="h-2" 
                  />
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Unrealized P&L</span>
                    <span className={`font-medium ${metrics.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics.unrealizedPnL >= 0 ? '+' : ''}${metrics.unrealizedPnL.toLocaleString()}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(100, Math.abs(metrics.unrealizedPnL) / 500 * 100)} 
                    className="h-2" 
                  />
                </div>
              </div>
            </div>

            {/* Performance Alerts */}
            {(metrics.currentDrawdown > 0.05 || metrics.consecutiveLosses > 3 || metrics.sharpeRatio < 1.0) && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="font-semibold text-yellow-800 dark:text-yellow-200">Performance Alerts</span>
                </div>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {metrics.currentDrawdown > 0.05 && (
                    <li>• Current drawdown exceeds 5% - consider reducing position sizes</li>
                  )}
                  {metrics.consecutiveLosses > 3 && (
                    <li>• {metrics.consecutiveLosses} consecutive losses - review strategy performance</li>
                  )}
                  {metrics.sharpeRatio < 1.0 && (
                    <li>• Sharpe ratio below 1.0 - risk-adjusted returns need improvement</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {isLoading ? 'Loading performance metrics...' : 'No performance data available'}
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
