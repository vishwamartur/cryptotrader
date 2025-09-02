"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Brain, 
  Target,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from "lucide-react"

interface TradingSignal {
  strategy: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  strength: number
  reasoning: string[]
  timestamp: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  expectedReturn: number
  timeframe: string
}

interface EnhancedTradingSignalsProps {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
}

export function EnhancedTradingSignals({ theme, autoRefresh, refreshInterval }: EnhancedTradingSignalsProps) {
  const [signals, setSignals] = useState<TradingSignal[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [consensusSignal, setConsensusSignal] = useState<'BUY' | 'SELL' | 'HOLD'>('HOLD')
  const [consensusConfidence, setConsensusConfidence] = useState(0)

  const fetchSignals = async () => {
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
          balance: 10000
        })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Convert response to trading signals format
        const newSignals: TradingSignal[] = [
          {
            strategy: 'Enhanced Market Analysis',
            signal: data.signal || 'HOLD',
            confidence: data.confidence || 50,
            strength: data.strength || 0,
            reasoning: data.reasoning || ['No analysis available'],
            timestamp: data.timestamp || new Date().toISOString(),
            riskLevel: data.riskAssessment?.riskLevel || 'MEDIUM',
            expectedReturn: data.performanceProjection?.expectedReturn || 0,
            timeframe: data.timeframe || '1h'
          }
        ]

        // Add strategy-specific signals
        if (data.strategies) {
          Object.entries(data.strategies).forEach(([name, strategy]: [string, any]) => {
            newSignals.push({
              strategy: `${name.charAt(0).toUpperCase() + name.slice(1)} Strategy`,
              signal: strategy.signal?.toUpperCase() || 'HOLD',
              confidence: strategy.confidence || 50,
              strength: Math.abs(strategy.confidence - 50) * 2,
              reasoning: strategy.details ? Object.values(strategy.details).map(String) : ['Strategy analysis'],
              timestamp: new Date().toISOString(),
              riskLevel: strategy.confidence > 80 ? 'LOW' : strategy.confidence > 60 ? 'MEDIUM' : 'HIGH',
              expectedReturn: (strategy.confidence - 50) / 100 * 0.05, // Estimated return
              timeframe: '1h'
            })
          })
        }

        // Add ML prediction as signal
        if (data.mlPrediction) {
          newSignals.push({
            strategy: 'Machine Learning Model',
            signal: data.mlPrediction.direction === 'UP' ? 'BUY' : 
                   data.mlPrediction.direction === 'DOWN' ? 'SELL' : 'HOLD',
            confidence: data.mlPrediction.confidence || 50,
            strength: data.mlPrediction.probability * 100,
            reasoning: data.mlPrediction.features || ['ML prediction'],
            timestamp: new Date().toISOString(),
            riskLevel: data.mlPrediction.riskLevel > 0.7 ? 'HIGH' : 
                      data.mlPrediction.riskLevel > 0.4 ? 'MEDIUM' : 'LOW',
            expectedReturn: data.mlPrediction.expectedReturn || 0,
            timeframe: `${data.mlPrediction.timeHorizon || 24}h`
          })
        }

        setSignals(newSignals)
        
        // Calculate consensus
        const buySignals = newSignals.filter(s => s.signal === 'BUY')
        const sellSignals = newSignals.filter(s => s.signal === 'SELL')
        
        if (buySignals.length > sellSignals.length) {
          setConsensusSignal('BUY')
          setConsensusConfidence(buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length)
        } else if (sellSignals.length > buySignals.length) {
          setConsensusSignal('SELL')
          setConsensusConfidence(sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length)
        } else {
          setConsensusSignal('HOLD')
          setConsensusConfidence(50)
        }
        
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch trading signals:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSignals()
    
    if (autoRefresh) {
      const interval = setInterval(fetchSignals, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const getSignalIcon = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'SELL':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-yellow-500" />
    }
  }

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'BUY':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-100 dark:border-green-800'
      case 'SELL':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100 dark:border-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-100 dark:border-yellow-800'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW':
        return 'text-green-600 dark:text-green-400'
      case 'HIGH':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-yellow-600 dark:text-yellow-400'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Enhanced Trading Signals
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getSignalColor(consensusSignal)}>
              Consensus: {consensusSignal}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchSignals}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Consensus Overview */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Signal Consensus</h4>
            <div className="flex items-center gap-2">
              {getSignalIcon(consensusSignal)}
              <span className="font-medium">{consensusSignal}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Confidence Level</span>
              <span className="font-medium">{Math.round(consensusConfidence)}%</span>
            </div>
            <Progress value={consensusConfidence} className="h-2" />
          </div>
        </div>

        {/* Individual Signals */}
        <div className="space-y-4">
          {signals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {isLoading ? 'Loading signals...' : 'No signals available'}
            </div>
          ) : (
            signals.map((signal, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getSignalIcon(signal.signal)}
                    <div>
                      <h4 className="font-semibold">{signal.strategy}</h4>
                      <p className="text-sm text-muted-foreground">{signal.timeframe} timeframe</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getSignalColor(signal.signal)}>
                      {signal.signal}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {Math.round(signal.confidence)}% confidence
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Strength:</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={signal.strength} className="h-1 flex-1" />
                      <span className="font-medium">{Math.round(signal.strength)}</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Risk Level:</span>
                    <span className={`ml-2 font-medium ${getRiskColor(signal.riskLevel)}`}>
                      {signal.riskLevel}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expected Return:</span>
                    <span className="ml-2 font-medium">
                      {signal.expectedReturn > 0 ? '+' : ''}{(signal.expectedReturn * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Updated:</span>
                    <span className="ml-2 font-medium">
                      {new Date(signal.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {signal.reasoning.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-foreground">Reasoning:</span>
                    <ul className="mt-1 text-sm space-y-1">
                      {signal.reasoning.slice(0, 3).map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Last Update */}
        <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
