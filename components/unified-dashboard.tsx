"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  AlertTriangle, 
  Settings, 
  Maximize2, 
  Minimize2,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
  Moon,
  Sun,
  Bell,
  BellOff,
  Home,
  BarChart3
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
import { AdvancedTradingPanel } from "@/components/advanced-trading-panel"

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
import { DeltaConnectionStatus } from "@/components/dashboard/delta-connection-status"

gsap.registerPlugin(ScrollTrigger)

interface DashboardLayout {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
  notifications: boolean
  view: 'home' | 'advanced'
}

interface WelcomeProps {
  onGetStarted: () => void
  theme: 'light' | 'dark'
}

const WelcomeSection: React.FC<WelcomeProps> = ({ onGetStarted, theme }) => (
  <div className="text-center py-12 mb-8">
    <div className="max-w-4xl mx-auto">
      <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-500 to-green-400 bg-clip-text text-transparent">
        Welcome to CryptoTrader
      </h1>
      <p className="text-xl mb-8 text-gray-600 dark:text-gray-300">
        AI-powered cryptocurrency trading platform with advanced analytics, risk management, and automated trading strategies.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
          <CardContent className="p-6 text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h3 className="text-lg font-semibold mb-2">AI Trading Signals</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Advanced machine learning algorithms analyze market patterns and generate trading signals
            </p>
          </CardContent>
        </Card>
        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold mb-2">Risk Management</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Comprehensive risk monitoring with real-time alerts and portfolio protection
            </p>
          </CardContent>
        </Card>
        <Card className={theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}>
          <CardContent className="p-6 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 text-blue-500" />
            <h3 className="text-lg font-semibold mb-2">Real-time Analytics</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Live market data, portfolio tracking, and performance analytics
            </p>
          </CardContent>
        </Card>
      </div>
      <Button onClick={onGetStarted} size="lg" className="px-8 py-3 text-lg">
        Get Started <TrendingUp className="ml-2 w-5 h-5" />
      </Button>
    </div>
  </div>
)

export function UnifiedDashboard() {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Dashboard state
  const [layout, setLayout] = useState<DashboardLayout>({
    theme: 'dark',
    autoRefresh: true,
    refreshInterval: 1000,
    notifications: true,
    view: 'home'
  })

  const [isFullscreen, setIsFullscreen] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting')
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [clientTimeString, setClientTimeString] = useState<string>('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [alerts, setAlerts] = useState<any[]>([])

  // Animation setup
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.set(".trading-card", { opacity: 0, y: 50, scale: 0.95 })
      gsap.set(".header-element", { opacity: 0, y: -30 })

      // Header animation
      gsap.to(".header-element", {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.1,
      })

      // Cards entrance animation
      gsap.to(".trading-card", {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 1,
        ease: "power3.out",
        stagger: 0.15,
        delay: 0.3,
      })

      // Floating animation
      gsap.to(".trading-card", {
        y: -5,
        duration: 2,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.3,
        delay: 1.5,
      })

      gsap.to(".pulse-element", {
        scale: 1.05,
        duration: 1.5,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1,
        stagger: 0.2,
      })
    }, containerRef)

    return () => ctx.revert()
  }, [layout.view])

  // Theme management
  useEffect(() => {
    document.documentElement.classList.toggle('dark', layout.theme === 'dark')
    localStorage.setItem('dashboard-theme', layout.theme)
  }, [layout.theme])

  // Load saved preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('dashboard-theme') as 'light' | 'dark' || 'dark'
    const savedWelcome = localStorage.getItem('dashboard-welcome-dismissed') === 'true'
    
    setLayout(prev => ({ ...prev, theme: savedTheme }))
    setShowWelcome(!savedWelcome)
  }, [])

  // Client-side time formatting
  useEffect(() => {
    const updateTimeString = () => {
      setClientTimeString(lastUpdate.toLocaleTimeString())
    }

    updateTimeString()
    const interval = setInterval(updateTimeString, 1000)
    return () => clearInterval(interval)
  }, [lastUpdate])

  // Simulate real-time data updates
  useEffect(() => {
    setConnectionStatus('connected')

    const updateInterval = setInterval(() => {
      setLastUpdate(new Date())
    }, layout.refreshInterval || 5000)

    return () => clearInterval(updateInterval)
  }, [layout.refreshInterval])

  // Save layout changes
  const saveLayout = useCallback((newLayout: DashboardLayout) => {
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout))
    setLayout(newLayout)
  }, [])

  // Handle getting started
  const handleGetStarted = () => {
    setShowWelcome(false)
    localStorage.setItem('dashboard-welcome-dismissed', 'true')
  }

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = layout.theme === 'light' ? 'dark' : 'light'
    saveLayout({ ...layout, theme: newTheme })
  }

  // Toggle view
  const toggleView = () => {
    const newView = layout.view === 'home' ? 'advanced' : 'home'
    saveLayout({ ...layout, view: newView })
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
    setIsFullscreen(!isFullscreen)
  }

  // Export dashboard data
  const exportData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      layout,
      connectionStatus,
      alerts: alerts.slice(0, 100)
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cryptotrader-dashboard-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div ref={containerRef} className={`min-h-screen transition-colors duration-300 ${
      layout.theme === 'dark' 
        ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900' 
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-100'
    }`}>
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      </div>

      {/* Navigation */}
      <div className="header-element relative z-50">
        <Navigation theme={layout.theme} connectionStatus={connectionStatus} />
      </div>

      {/* Dashboard Controls */}
      <div className={`sticky top-16 z-40 border-b backdrop-blur-sm ${
        layout.theme === 'dark'
          ? 'bg-gray-900/80 border-gray-800'
          : 'bg-white/80 border-gray-200'
      }`}>
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                Last update: {clientTimeString || 'Loading...'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {/* View toggle */}
              <Button variant="ghost" size="sm" onClick={toggleView}>
                {layout.view === 'home' ? (
                  <><BarChart3 className="w-4 h-4 mr-2" /> Advanced</>
                ) : (
                  <><Home className="w-4 h-4 mr-2" /> Home</>
                )}
              </Button>

              {/* Notifications toggle */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => saveLayout({ ...layout, notifications: !layout.notifications })}
              >
                {layout.notifications ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </Button>

              {/* Theme toggle */}
              <Button variant="ghost" size="sm" onClick={toggleTheme}>
                {layout.theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>

              {/* Export data */}
              <Button variant="ghost" size="sm" onClick={exportData}>
                <Download className="w-4 h-4" />
              </Button>

              {/* Fullscreen toggle */}
              <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>

              {/* Settings */}
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 relative z-10">
        {/* Welcome Section */}
        {showWelcome && layout.view === 'home' && (
          <WelcomeSection onGetStarted={handleGetStarted} theme={layout.theme} />
        )}

        {/* Dashboard Content */}
        {(!showWelcome || layout.view === 'advanced') && (
          <div ref={gridRef}>
            {layout.view === 'home' ? (
              // Home View - Original Trading Dashboard
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 trading-card">
                  <MarketOverview />
                </div>
                <div className="lg:col-span-1 trading-card pulse-element">
                  <Portfolio />
                </div>
                <div className="lg:col-span-2 trading-card" data-component="ai-trading-panel">
                  <AITradingPanel />
                </div>
                <div className="lg:col-span-2 trading-card">
                  <AutonomousAgentPanel />
                </div>
                <div className="lg:col-span-2 trading-card pulse-element" data-component="risk-dashboard">
                  <RiskDashboard />
                </div>
                <div className="lg:col-span-2 trading-card">
                  <TradeMonitor />
                </div>
                <div className="lg:col-span-2 trading-card">
                  <AdvancedTradingPanel />
                </div>
                <div className="lg:col-span-2 trading-card" data-component="trading-interface">
                  <TradingInterface />
                </div>
              </div>
            ) : (
              // Advanced View - Advanced Dashboard Components
              <Tabs defaultValue="realtime" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="realtime">Real-time</TabsTrigger>
                  <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                  <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  <TabsTrigger value="controls">Controls</TabsTrigger>
                </TabsList>

                <TabsContent value="realtime" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 trading-card">
                      <LivePriceFeeds theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <PortfolioTracker theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="lg:col-span-2 trading-card">
                      <AITradingSignals theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <TradingPositions theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="monitoring" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="trading-card">
                      <SystemHealth theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <RiskManagement theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <OrderExecution theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <DeltaConnectionStatus theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="lg:col-span-2 trading-card">
                      <AlertsNotifications theme={layout.theme} alerts={alerts} onDismiss={(id) => setAlerts(prev => prev.filter(a => a.id !== id))} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="analytics" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="trading-card">
                      <StrategyPerformance theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <MarketSentiment theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="lg:col-span-2 trading-card">
                      <PerformanceCharts theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="lg:col-span-2 trading-card">
                      <MLModelsOverview theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="trading-card">
                      <MLPredictionsFeed theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="controls" className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="trading-card">
                      <QuickActions theme={layout.theme} autoRefresh={layout.autoRefresh} refreshInterval={layout.refreshInterval} />
                    </div>
                    <div className="lg:col-span-2 trading-card">
                      <TradingInterface />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
