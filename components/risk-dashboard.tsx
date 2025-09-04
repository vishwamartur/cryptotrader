"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Shield, AlertTriangle, TrendingDown, TrendingUp, Target, Settings, AlertCircle, Wifi, WifiOff, Clock, CheckCircle } from "lucide-react"
import { RiskManager, type RiskLimits, type RiskMetrics, type RiskAlert } from "@/lib/risk-management"
import { useWebSocketPortfolio } from "@/hooks/use-websocket-portfolio"
import { useWebSocketMarketData } from "@/hooks/use-websocket-market-data"

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

  // Use WebSocket-based portfolio data for real-time risk monitoring
  const portfolio = useWebSocketPortfolio({
    autoConnect: true,
    environment: 'production',
    enableMockFallback: true // Enable mock data for risk analysis when credentials are not available
  })

  // Use WebSocket-based market data with "all" symbol subscription for comprehensive risk analysis
  const marketDataWS = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true, // ✅ Use "all" symbol subscription for comprehensive risk monitoring
    subscribeToMajorPairs: false, // Disable individual subscriptions since we're using "all"
    subscribeToAllProducts: false,
    channels: ['v2/ticker', 'l1_orderbook'], // Enhanced channels for better risk analysis
    maxSymbols: 1000, // Allow all symbols for comprehensive risk assessment
    environment: 'production'
  })

  // Memoize positions and balance to prevent unnecessary re-renders
  const positions = useMemo(() => {
    // Convert WebSocket positions to expected format for RiskManager (lib/types.ts Position interface)
    return (portfolio.positions || []).map(wsPosition => {
      // Create minimal Product object with required fields
      const product = {
        id: wsPosition.product.id,
        symbol: wsPosition.product.symbol,
        description: `${wsPosition.product.symbol} Position`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        settlement_time: '',
        notional_type: '',
        impact_size: 0,
        initial_margin: 0,
        maintenance_margin: 0,
        contract_value: '1',
        contract_unit_currency: 'USD',
        tick_size: '0.01',
        product_specs: {},
        state: 'live',
        trading_status: 'operational',
        max_leverage_notional: '0',
        default_leverage: '1',
        initial_margin_scaling_factor: '1',
        maintenance_margin_scaling_factor: '1',
        taker_commission_rate: '0.001',
        maker_commission_rate: '0.001',
        liquidation_penalty_factor: '0.05',
        contract_type: 'perpetual',
        position_size_limit: 1000000,
        basis_factor_max_limit: '0.1',
        is_quanto: false,
        funding_method: 'fixed',
        annualized_funding: '0',
        price_band: '0.1',
        underlying_asset: {},
        quoting_asset: {},
        settling_asset: {},
        spot_index: {}
      };

      return {
        user_id: 1, // Default user ID
        size: wsPosition.size || '0',
        entry_price: wsPosition.entry_price || '0',
        margin: '0', // Default margin
        liquidation_price: '0', // Default liquidation price
        bankruptcy_price: '0', // Default bankruptcy price
        adl_level: 0, // Default ADL level
        auto_topup: false, // Default auto topup
        realized_pnl: wsPosition.realized_pnl || '0',
        realized_funding: '0', // Default realized funding
        product,
        // Optional fields
        unrealized_pnl: wsPosition.unrealized_pnl || '0',
        mark_price: wsPosition.mark_price || wsPosition.entry_price || '0',
        id: `${wsPosition.product.id}`
      };
    })
  }, [portfolio.positions])

  const balance = useMemo(() => {
    // Convert WebSocket balance format to expected format
    const totalBalance = parseFloat(portfolio.summary.totalBalance || '0')
    const availableBalance = parseFloat(portfolio.summary.availableBalance || '0')
    const reservedBalance = parseFloat(portfolio.summary.reservedBalance || '0')

    return {
      total: totalBalance,
      available: availableBalance,
      reserved: reservedBalance
    }
  }, [portfolio.summary])

  // Memoize market data to prevent unnecessary re-renders
  const stableMarketData = useMemo(() => {
    // Convert MarketDataItem[] to MarketData[] format expected by RiskManager
    return (marketDataWS.marketDataArray || []).map(item => ({
      symbol: item.symbol,
      price: parseFloat(item.price || '0'),
      change: parseFloat(item.change || '0'),
      changePercent: parseFloat(item.changePercent || '0'),
      volume: parseFloat(item.volume || '0'),
      high24h: parseFloat(item.high || '0'),
      low24h: parseFloat(item.low || '0'),
      lastUpdated: item.lastUpdate.getTime()
    }))
  }, [marketDataWS.marketDataArray])

  useEffect(() => {
    const manager = new RiskManager(limits)
    setRiskManager(manager)
  }, [limits])

  // Memoize the historical P&L data to prevent regeneration on every render
  const mockHistoricalPnL = useMemo(() => {
    return Array.from({ length: 30 }, () => (Math.random() - 0.5) * 200)
  }, []) // Empty dependency array - only generate once

  // Use useCallback to memoize the risk calculation function
  const calculateRiskMetrics = useCallback(() => {
    if (!riskManager) {
      console.log('[RiskDashboard] Risk manager not initialized yet')
      return
    }

    // Enhanced validation for WebSocket data
    if (!positions || positions.length === 0) {
      console.log('[RiskDashboard] No positions available for risk calculation')
      if (!portfolio.isUsingMockData) {
        // Only show warning if not using mock data
        console.warn('[RiskDashboard] No positions found - check WebSocket portfolio connection')
      }
      return
    }

    if (!balance || balance.total === 0) {
      console.log('[RiskDashboard] No balance data available for risk calculation')
      if (!portfolio.isUsingMockData) {
        console.warn('[RiskDashboard] No balance data - check WebSocket portfolio connection')
      }
      return
    }

    try {
      console.log('[RiskDashboard] Calculating risk metrics', {
        positionsCount: positions.length,
        totalBalance: balance.total,
        marketDataCount: stableMarketData.length,
        portfolioConnected: portfolio.isConnected,
        marketDataConnected: marketDataWS.isConnected,
        usingMockData: portfolio.isUsingMockData
      })

      const metrics = riskManager.calculateRiskMetrics(positions, balance.total, stableMarketData, mockHistoricalPnL)
      setRiskMetrics(prevMetrics => {
        // Only update if metrics have actually changed to prevent unnecessary re-renders
        if (JSON.stringify(prevMetrics) !== JSON.stringify(metrics)) {
          console.log('[RiskDashboard] Risk metrics updated via WebSocket data')
          return metrics
        }
        return prevMetrics
      })

      const newAlerts = riskManager.checkRiskLimits(metrics, positions, balance.total)
      if (newAlerts.length > 0) {
        console.log('[RiskDashboard] New risk alerts generated:', newAlerts.length)
        setAlerts((prev) => [...prev, ...newAlerts].slice(-10))
      }
    } catch (error) {
      console.error('[RiskDashboard] Error calculating risk metrics:', error)
      // Add user-friendly error handling
      setAlerts((prev) => [...prev, {
        id: Date.now().toString(),
        type: 'warning' as const,
        severity: 'warning' as const,
        message: 'Risk calculation error - check data connections',
        timestamp: new Date(),
        metric: 'system',
        currentValue: 0,
        threshold: 0
      }].slice(-10))
    }
  }, [riskManager, positions, balance, stableMarketData, mockHistoricalPnL, portfolio.isConnected, portfolio.isUsingMockData, marketDataWS.isConnected])

  useEffect(() => {
    // Add a small delay to prevent rapid successive calculations
    const timeoutId = setTimeout(() => {
      calculateRiskMetrics()
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [calculateRiskMetrics])

  // WebSocket connection monitoring and reconnection
  useEffect(() => {
    const checkConnections = () => {
      if (!portfolio.isConnected || !marketDataWS.isConnected) {
        console.log('[RiskDashboard] WebSocket connection check:', {
          portfolio: portfolio.isConnected,
          marketData: marketDataWS.isConnected
        })
      }
    }

    // Check connections every 30 seconds
    const connectionCheckInterval = setInterval(checkConnections, 30000)

    return () => clearInterval(connectionCheckInterval)
  }, [portfolio.isConnected, marketDataWS.isConnected])

  // Real-time data update monitoring
  useEffect(() => {
    if (portfolio.isConnected && portfolio.positions?.length > 0) {
      console.log('[RiskDashboard] Real-time portfolio update received:', {
        positions: portfolio.positions.length,
        totalBalance: balance.total,
        timestamp: new Date().toISOString()
      })
    }
  }, [portfolio.positions, portfolio.isConnected, balance.total])

  useEffect(() => {
    if (marketDataWS.isConnected && marketDataWS.marketDataArray?.length > 0) {
      console.log('[RiskDashboard] Real-time market data update received:', {
        symbols: marketDataWS.marketDataArray.length,
        timestamp: new Date().toISOString()
      })
    }
  }, [marketDataWS.marketDataArray, marketDataWS.isConnected])

  const updateLimits = useCallback(() => {
    if (riskManager) {
      console.log('[RiskDashboard] Updating risk limits:', limits)
      riskManager.updateLimits(limits)
      setShowSettings(false)
      // Recalculate metrics after updating limits
      setTimeout(() => calculateRiskMetrics(), 50)
    }
  }, [riskManager, limits, calculateRiskMetrics])

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
        {/* WebSocket Connection Status */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {portfolio.isConnected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                Portfolio: {portfolio.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {marketDataWS.isConnected ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-600" />
              )}
              <span className="text-sm font-medium">
                Market Data: {marketDataWS.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Positions: {portfolio.positions?.length || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3" />
              <span>Symbols: {marketDataWS.marketDataArray?.length || 0}</span>
            </div>
            {portfolio.isUsingMockData && (
              <Badge variant="outline" className="text-xs">
                Mock Data
              </Badge>
            )}
          </div>
        </div>
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

        {/* Error Handling and Loading States */}
        {(!portfolio.isConnected || !marketDataWS.isConnected) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {!portfolio.isConnected && !marketDataWS.isConnected
                ? "Portfolio and market data connections are offline. Risk calculations may be inaccurate."
                : !portfolio.isConnected
                ? "Portfolio connection is offline. Position data may be outdated."
                : "Market data connection is offline. Price data may be outdated."
              }
              {portfolio.isUsingMockData && " Using mock data for demonstration."}
            </AlertDescription>
          </Alert>
        )}

        {/* Real-time Data Status */}
        {(portfolio.isConnected || marketDataWS.isConnected) && (
          <div className="text-xs text-muted-foreground text-center">
            Last updated: {new Date().toLocaleTimeString()} •
            Real-time WebSocket data streaming active
          </div>
        )}

        {riskMetrics && (
          <>
            {/* Real-time Data Indicator */}
            <div className="flex items-center justify-between text-xs text-muted-foreground border-b pb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  (portfolio.isConnected && marketDataWS.isConnected)
                    ? 'bg-green-500 animate-pulse'
                    : 'bg-red-500'
                }`} />
                <span>
                  {(portfolio.isConnected && marketDataWS.isConnected)
                    ? 'Live Risk Monitoring Active'
                    : 'Risk Monitoring Limited'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span>Portfolio: {portfolio.positions?.length || 0} positions</span>
                <span>Balance: ${balance.total.toFixed(2)}</span>
                <span>Updated: {new Date().toLocaleTimeString()}</span>
              </div>
            </div>

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
