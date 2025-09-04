"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Settings, 
  RefreshCw,
  Moon,
  Sun,
  Bell,
  BellOff,
  Home,
  BarChart3,
  Brain,
  Target,
  Shield,
  Zap,
  PieChart,
  LineChart,
  Wallet,
  Bot,
  Gauge
} from "lucide-react"

// Import existing components
import { MarketOverview } from "@/components/market-overview"
import { Portfolio } from "@/components/portfolio"
import { Navigation } from "@/components/navigation"
import { TradingInterface } from "@/components/trading-interface"
import { AITradingPanel } from "@/components/ai-trading-panel"
import { AutonomousAgentPanel } from "@/components/autonomous-agent-panel"
import { RiskDashboard } from "@/components/risk-dashboard"
import { TradeMonitor } from "@/components/trade-monitor"

// Import advanced dashboard components
import { LivePriceFeeds } from "@/components/dashboard/live-price-feeds"
import { PortfolioTracker } from "@/components/dashboard/portfolio-tracker"
import { TradingPositions } from "@/components/dashboard/trading-positions"
import { MarketSentiment } from "@/components/dashboard/market-sentiment"
import { AITradingSignals } from "@/components/dashboard/ai-trading-signals"
import { SystemHealth } from "@/components/dashboard/system-health"
import { StrategyPerformance } from "@/components/dashboard/strategy-performance"
import { RiskManagement } from "@/components/dashboard/risk-management"
import { OrderExecution } from "@/components/dashboard/order-execution"
import { PerformanceCharts } from "@/components/dashboard/performance-charts"
import { AlertsNotifications } from "@/components/dashboard/alerts-notifications"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { MLModelsOverview } from "@/components/dashboard/ml-models-overview"
import { MLPredictionsFeed } from "@/components/dashboard/ml-predictions-feed"
import { APIPerformanceMonitor } from "@/components/dashboard/api-performance-monitor"

gsap.registerPlugin(ScrollTrigger)

interface DashboardLayout {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
  notifications: boolean
  view: 'unified' | 'classic'
  compactMode: boolean
}

interface EnhancedTradingData {
  marketSignal: any
  mlPrediction: any
  strategySignals: any
  profitMetrics: any
  riskAssessment: any
  performanceProjection: any
}

interface EnhancedUnifiedDashboardProps {
  initialView?: 'overview' | 'trading' | 'analytics' | 'monitoring' | null
}

export function EnhancedUnifiedDashboard({ initialView }: EnhancedUnifiedDashboardProps = {}) {
  const [layout, setLayout] = useState<DashboardLayout>({
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 5000,
    notifications: true,
    view: initialView || 'unified',
    compactMode: false
  })

  const [showWelcome, setShowWelcome] = useState(false)
  const [tradingData, setTradingData] = useState<EnhancedTradingData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  
  const gridRef = useRef<HTMLDivElement>(null)
  const welcomeRef = useRef<HTMLDivElement>(null)

  // Enhanced trading analysis hook
  const fetchEnhancedAnalysis = useCallback(async () => {
    if (isLoading) return
    
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
        setTradingData(data)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Failed to fetch enhanced analysis:', error)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading])

  // Auto-refresh enhanced analysis
  useEffect(() => {
    fetchEnhancedAnalysis()
    
    if (layout.autoRefresh) {
      const interval = setInterval(fetchEnhancedAnalysis, layout.refreshInterval)
      return () => clearInterval(interval)
    }
  }, [layout.autoRefresh, layout.refreshInterval, fetchEnhancedAnalysis])

  // GSAP animations
  useEffect(() => {
    if (gridRef.current) {
      gsap.fromTo(
        gridRef.current.children,
        { opacity: 0, y: 20 },
        { 
          opacity: 1, 
          y: 0, 
          duration: 0.6, 
          stagger: 0.1,
          ease: "power2.out"
        }
      )
    }
  }, [layout.view])

  const toggleTheme = () => {
    setLayout(prev => ({ ...prev, theme: prev.theme === 'light' ? 'dark' : 'light' }))
  }

  const toggleAutoRefresh = () => {
    setLayout(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }))
  }

  const toggleNotifications = () => {
    setLayout(prev => ({ ...prev, notifications: !prev.notifications }))
  }

  const toggleView = () => {
    setLayout(prev => ({ ...prev, view: prev.view === 'unified' ? 'classic' : 'unified' }))
  }

  const toggleCompactMode = () => {
    setLayout(prev => ({ ...prev, compactMode: !prev.compactMode }))
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      layout.theme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900'
    }`}>
      {/* Enhanced Navigation */}
      <Navigation />
      
      {/* Dashboard Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">Enhanced Trading Dashboard</h1>
              <Badge variant={tradingData?.marketSignal?.signal === 'BUY' ? 'default' : 
                             tradingData?.marketSignal?.signal === 'SELL' ? 'destructive' : 'secondary'}>
                {tradingData?.marketSignal?.signal || 'LOADING'}
              </Badge>
              {tradingData && (
                <Badge variant="outline">
                  Confidence: {Math.round(tradingData.marketSignal?.confidence || 0)}%
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchEnhancedAnalysis}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={layout.autoRefresh}
                  onCheckedChange={toggleAutoRefresh}
                />
                <Label className="text-sm">Auto-refresh</Label>
              </div>
              
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {layout.theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              
              <Button variant="ghost" size="sm" onClick={toggleNotifications}>
                {layout.notifications ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              </Button>
              
              <Button variant="ghost" size="sm" onClick={toggleView}>
                {layout.view === 'unified' ? <Home className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          {/* Status Bar */}
          <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
              {tradingData && (
                <>
                  <span>•</span>
                  <span>Market Regime: {tradingData.marketAnalysis?.marketRegime || 'Unknown'}</span>
                  <span>•</span>
                  <span>Risk Level: {tradingData.riskAssessment?.riskLevel || 'Medium'}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 text-green-500" />
              <span>System Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="container mx-auto px-4 py-6">
        {layout.view === 'unified' ? (
          // Enhanced Unified View
          <div ref={gridRef} className="space-y-6">
            {/* Top Row - Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="trading-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Portfolio Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${tradingData?.profitOptimization?.expectedProfit ? 
                      (10000 + tradingData.profitOptimization.expectedProfit * 10000).toLocaleString() : 
                      '10,000'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tradingData?.performanceProjection?.expectedReturn ? 
                      `+${(tradingData.performanceProjection.expectedReturn * 100).toFixed(2)}%` : 
                      '+0.00%'} today
                  </p>
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Active Signals
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tradingData ? Object.values(tradingData.strategies || {}).filter((s: any) => s.signal !== 'hold').length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tradingData?.strategies?.momentum?.signal === 'buy' ? 'Momentum: BUY' : 
                     tradingData?.strategies?.momentum?.signal === 'sell' ? 'Momentum: SELL' : 'No strong signals'}
                  </p>
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    ML Confidence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tradingData?.mlPrediction?.confidence ? Math.round(tradingData.mlPrediction.confidence) : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Predicts: {tradingData?.mlPrediction?.direction || 'SIDEWAYS'}
                  </p>
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Risk Score
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {tradingData?.riskAssessment?.overallRisk ? 
                      Math.round((1 - tradingData.riskAssessment.overallRisk) * 100) : 85}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {tradingData?.riskAssessment?.riskLevel || 'Medium'} Risk
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Second Row - Main Trading Components */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Enhanced Market Overview with ML Predictions */}
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      Market Analysis & Predictions
                      <Badge variant={tradingData?.signal === 'BUY' ? 'default' : 
                                   tradingData?.signal === 'SELL' ? 'destructive' : 'secondary'}>
                        {tradingData?.signal || 'HOLD'}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MarketOverview />
                    {tradingData && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">Enhanced Analysis</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Technical Score:</span>
                            <span className="ml-2 font-medium">{tradingData.marketAnalysis?.technicalScore || 0}/100</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Momentum Score:</span>
                            <span className="ml-2 font-medium">{tradingData.marketAnalysis?.momentumScore || 0}/100</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">ML Probability:</span>
                            <span className="ml-2 font-medium">{Math.round((tradingData.mlPrediction?.probability || 0) * 100)}%</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Expected Move:</span>
                            <span className="ml-2 font-medium">{((tradingData.marketConditions?.volatility || 0) * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Strategy Performance Dashboard */}
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle>Strategy Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tradingData?.strategies ? (
                      <div className="space-y-4">
                        {Object.entries(tradingData.strategies).map(([name, strategy]: [string, any]) => (
                          <div key={name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge variant={strategy.signal === 'buy' ? 'default' : 
                                           strategy.signal === 'sell' ? 'destructive' : 'secondary'}>
                                {strategy.signal?.toUpperCase() || 'HOLD'}
                              </Badge>
                              <span className="font-medium capitalize">{name}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">{Math.round(strategy.confidence || 0)}%</div>
                              <div className="text-xs text-muted-foreground">Confidence</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <StrategyPerformance theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                {/* Enhanced Portfolio with Profit Optimization */}
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle>Portfolio & Optimization</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Portfolio />
                    {tradingData?.profitOptimization && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">Profit Optimization</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Optimal Position Size:</span>
                            <span className="font-medium">{(tradingData.profitOptimization.optimalPositionSize * 100).toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Risk/Reward Ratio:</span>
                            <span className="font-medium">{tradingData.profitOptimization.riskRewardRatio?.toFixed(1) || '2.5'}:1</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Max Risk:</span>
                            <span className="font-medium">{(tradingData.profitOptimization.maxRisk * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Enhanced Risk Management */}
                <Card className="trading-card">
                  <CardHeader>
                    <CardTitle>Advanced Risk Management</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RiskDashboard />
                    {tradingData?.riskAssessment && (
                      <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Volatility Risk:</span>
                            <span className="font-medium">{Math.round(tradingData.riskAssessment.volatilityRisk * 100)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Confidence Risk:</span>
                            <span className="font-medium">{Math.round(tradingData.riskAssessment.confidenceRisk * 100)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Overall Risk:</span>
                            <Badge variant={tradingData.riskAssessment.riskLevel === 'HIGH' ? 'destructive' : 
                                          tradingData.riskAssessment.riskLevel === 'MEDIUM' ? 'secondary' : 'default'}>
                              {tradingData.riskAssessment.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Third Row - Trading Interface and AI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle>Enhanced Trading Interface</CardTitle>
                </CardHeader>
                <CardContent>
                  <TradingInterface />
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader>
                  <CardTitle>AI Trading & Autonomous Agent</CardTitle>
                </CardHeader>
                <CardContent>
                  <AITradingPanel />
                </CardContent>
              </Card>
            </div>

            {/* Fourth Row - Monitoring and Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="trading-card">
                <CardHeader>
                  <CardTitle>Trade Monitor</CardTitle>
                </CardHeader>
                <CardContent>
                  <TradeMonitor />
                </CardContent>
              </Card>

              <Card className="trading-card">
                <CardHeader>
                  <CardTitle>Performance Charts</CardTitle>
                </CardHeader>
                <CardContent>
                  <PerformanceCharts theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                </CardContent>
              </Card>
            </div>

            {/* Fifth Row - API Performance and System Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <APIPerformanceMonitor
                theme={layout.theme}
                autoRefresh={layout.autoRefresh}
                refreshInterval={layout.refreshInterval}
              />

              <Card className="trading-card">
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <SystemHealth theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Classic View - Original Dashboard Layout
          <div ref={gridRef}>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-3 trading-card">
                <MarketOverview />
              </div>
              <div className="lg:col-span-1 trading-card">
                <Portfolio />
              </div>
              <div className="lg:col-span-2 trading-card">
                <AITradingPanel />
              </div>
              <div className="lg:col-span-2 trading-card">
                <AutonomousAgentPanel />
              </div>
              <div className="lg:col-span-2 trading-card">
                <RiskDashboard />
              </div>
              <div className="lg:col-span-2 trading-card">
                <TradeMonitor />
              </div>
              <div className="lg:col-span-4 trading-card">
                <TradingInterface />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
