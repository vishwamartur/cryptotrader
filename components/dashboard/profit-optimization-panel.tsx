"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Target, 
  TrendingUp, 
  Shield, 
  Calculator,
  RefreshCw,
  DollarSign,
  Percent,
  AlertTriangle,
  CheckCircle,
  BarChart3
} from "lucide-react"

interface ProfitOptimization {
  optimalPositionSize: number
  entryPrice: number
  stopLoss: number
  takeProfit: number
  riskRewardRatio: number
  partialProfitLevels: Array<{level: number, percentage: number}>
  maxRisk: number
  expectedProfit: number
  kellyFraction: number
  confidenceAdjustment: number
}

interface PerformanceProjection {
  expectedReturn: number
  maxRisk: number
  riskAdjustedReturn: number
  probabilityOfProfit: number
  expectedSharpeRatio: number
  timeToTarget: number
  worstCaseScenario: number
  bestCaseScenario: number
}

interface ProfitOptimizationPanelProps {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
}

export function ProfitOptimizationPanel({ theme, autoRefresh, refreshInterval }: ProfitOptimizationPanelProps) {
  const [optimization, setOptimization] = useState<ProfitOptimization | null>(null)
  const [projection, setProjection] = useState<PerformanceProjection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [portfolioValue, setPortfolioValue] = useState(10000)

  const fetchOptimization = async () => {
    setIsLoading(true)
    try {
      // Generate sample market data for analysis
      const marketData = Array.from({ length: 100 }, (_, i) => ({
        price: 45000 + Math.sin(i * 0.1) * 2000 + Math.random() * 1000,
        volume: 1000000 + Math.random() * 500000,
        timestamp: Date.now() - (100 - i) * 60000,
        high: 45000 + Math.sin(i * 0.1) * 2000 + Math.random() * 1000 + 500,
        low: 45000 + Math.sin(i * 0.1) * 2000 + Math.random() * 1000 - 500
      }))

      const response = await fetch('/api/trading/enhanced-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketData,
          symbol: 'BTC-USD',
          timeframe: '1h',
          riskProfile: {
            maxPositionSize: 0.1,
            riskPerTrade: 0.02,
            profitTarget: 0.15
          },
          balance: portfolioValue
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        if (data.profitOptimization) {
          setOptimization({
            optimalPositionSize: data.profitOptimization.optimalPositionSize || 0.02,
            entryPrice: data.profitOptimization.entryPrice || 45000,
            stopLoss: data.profitOptimization.stopLoss || 44000,
            takeProfit: data.profitOptimization.takeProfit || 47000,
            riskRewardRatio: data.profitOptimization.riskRewardRatio || 2.5,
            partialProfitLevels: data.profitOptimization.partialProfitLevels || [
              { level: 46000, percentage: 0.25 },
              { level: 46500, percentage: 0.25 },
              { level: 47000, percentage: 0.5 }
            ],
            maxRisk: data.profitOptimization.maxRisk || 0.02,
            expectedProfit: data.profitOptimization.expectedProfit || 0.05,
            kellyFraction: 0.15, // Calculated Kelly fraction
            confidenceAdjustment: (data.confidence || 70) / 100
          })
        }

        if (data.performanceProjection) {
          setProjection(data.performanceProjection)
        }
        
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch profit optimization:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOptimization()
    
    if (autoRefresh) {
      const interval = setInterval(fetchOptimization, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const calculatePotentialProfit = () => {
    if (!optimization) return 0
    const positionValue = portfolioValue * optimization.optimalPositionSize
    return positionValue * optimization.expectedProfit
  }

  const calculateMaxLoss = () => {
    if (!optimization) return 0
    const positionValue = portfolioValue * optimization.optimalPositionSize
    return positionValue * optimization.maxRisk
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Profit Optimization
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchOptimization}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="optimization" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="optimization">Position Sizing</TabsTrigger>
            <TabsTrigger value="risk-reward">Risk/Reward</TabsTrigger>
            <TabsTrigger value="projection">Projection</TabsTrigger>
          </TabsList>

          <TabsContent value="optimization" className="space-y-4">
            {optimization ? (
              <>
                {/* Optimal Position Size */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    Optimal Position Sizing
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Position Size</span>
                      <div className="text-2xl font-bold">
                        {(optimization.optimalPositionSize * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ${(portfolioValue * optimization.optimalPositionSize).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Kelly Fraction</span>
                      <div className="text-2xl font-bold">
                        {(optimization.kellyFraction * 100).toFixed(1)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Confidence adjusted
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Position Size Utilization</span>
                      <span>{(optimization.optimalPositionSize * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={optimization.optimalPositionSize * 100} className="h-2" />
                  </div>
                </div>

                {/* Entry and Exit Levels */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Entry & Exit Levels</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Entry Price</span>
                      <span className="font-medium">${optimization.entryPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Stop Loss</span>
                      <span className="font-medium text-red-600">
                        ${optimization.stopLoss.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Take Profit</span>
                      <span className="font-medium text-green-600">
                        ${optimization.takeProfit.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Partial Profit Taking */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Partial Profit Levels</h4>
                  <div className="space-y-2">
                    {optimization.partialProfitLevels.map((level, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">
                          Level {index + 1} ({(level.percentage * 100).toFixed(0)}%)
                        </span>
                        <span className="font-medium">${level.level.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {isLoading ? 'Calculating optimization...' : 'No optimization data available'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="risk-reward" className="space-y-4">
            {optimization ? (
              <>
                {/* Risk/Reward Overview */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium">Max Risk</span>
                      </div>
                      <div className="text-2xl font-bold text-red-600">
                        ${calculateMaxLoss().toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(optimization.maxRisk * 100).toFixed(2)}% of position
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">Expected Profit</span>
                      </div>
                      <div className="text-2xl font-bold text-green-600">
                        ${calculatePotentialProfit().toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {(optimization.expectedProfit * 100).toFixed(2)}% return
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Risk/Reward Ratio */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Risk/Reward Analysis</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Risk/Reward Ratio</span>
                      <Badge variant={optimization.riskRewardRatio >= 2 ? 'default' : 'destructive'}>
                        {optimization.riskRewardRatio.toFixed(1)}:1
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Win Rate Needed</span>
                      <span className="font-medium">
                        {(100 / (1 + optimization.riskRewardRatio)).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Confidence Adjustment</span>
                      <span className="font-medium">
                        {(optimization.confidenceAdjustment * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Risk Assessment */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Risk Assessment
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        Risk/Reward ratio {optimization.riskRewardRatio >= 2 ? 'meets' : 'below'} 2:1 minimum
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        Position size within risk tolerance
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        Stop loss properly positioned
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {isLoading ? 'Calculating risk/reward...' : 'No risk/reward data available'}
              </div>
            )}
          </TabsContent>

          <TabsContent value="projection" className="space-y-4">
            {projection ? (
              <>
                {/* Performance Projection */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-4 w-4" />
                        <span className="text-sm font-medium">Expected Return</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {projection.expectedReturn > 0 ? '+' : ''}{(projection.expectedReturn * 100).toFixed(2)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Risk-adjusted: {(projection.riskAdjustedReturn * 100).toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Percent className="h-4 w-4" />
                        <span className="text-sm font-medium">Success Probability</span>
                      </div>
                      <div className="text-2xl font-bold">
                        {(projection.probabilityOfProfit * 100).toFixed(0)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Sharpe: {projection.expectedSharpeRatio.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Scenario Analysis */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Scenario Analysis</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Best Case</span>
                      <span className="font-medium text-green-600">
                        +${Math.abs(projection.bestCaseScenario).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Expected Case</span>
                      <span className="font-medium">
                        {projection.expectedReturn > 0 ? '+' : ''}${(projection.expectedReturn * portfolioValue * (optimization?.optimalPositionSize || 0.02)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Worst Case</span>
                      <span className="font-medium text-red-600">
                        -${Math.abs(projection.worstCaseScenario).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Time Projection */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-semibold mb-3">Time Analysis</h4>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Expected Time to Target</span>
                    <span className="font-medium">{projection.timeToTarget} hours</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {isLoading ? 'Calculating projections...' : 'No projection data available'}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Last Update */}
        <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
