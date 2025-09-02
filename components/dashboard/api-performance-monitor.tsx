"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  RefreshCw,
  Zap,
  TrendingUp,
  TrendingDown,
  Wifi,
  WifiOff,
  Server,
  Database,
  Globe,
  BarChart3
} from "lucide-react"

interface PerformanceMetrics {
  avgResponseTime: number
  errorRate: number
  throughput: number
  criticalEndpoints: string[]
  healthyEndpoints: number
  degradedEndpoints: number
  criticalEndpoints: number
}

interface TradingPerformanceMetrics {
  missedOpportunities: number
  avgTradingLatency: number
  tradingSuccessRate: number
  profitabilityImpact: number
}

interface APIHealthStatus {
  endpoint: string
  status: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
  avgResponseTime: number
  errorRate: number
  throughput: number
  lastChecked: number
}

interface ExternalAPIMetrics {
  provider: string
  endpoint: string
  rateLimitUsage: number
  rateLimitRemaining: number
  connectionStatus: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'
  lastLatency: number
  errorCount: number
}

interface PerformanceAlert {
  id: string
  type: 'LATENCY' | 'ERROR_RATE' | 'THROUGHPUT' | 'EXTERNAL_API' | 'WEBSOCKET'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  endpoint?: string
  currentValue: number
  threshold: number
  timestamp: number
  acknowledged: boolean
}

interface APIPerformanceMonitorProps {
  theme: 'light' | 'dark'
  autoRefresh: boolean
  refreshInterval: number
}

export function APIPerformanceMonitor({ theme, autoRefresh, refreshInterval }: APIPerformanceMonitorProps) {
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null)
  const [tradingMetrics, setTradingMetrics] = useState<TradingPerformanceMetrics | null>(null)
  const [apiHealth, setApiHealth] = useState<APIHealthStatus[]>([])
  const [externalAPIs, setExternalAPIs] = useState<ExternalAPIMetrics[]>([])
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchPerformanceData = async () => {
    setIsLoading(true)
    try {
      // Simulate API call to performance monitoring endpoint
      const response = await fetch('/api/monitoring/performance', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const data = await response.json()
        setPerformanceMetrics(data.performanceMetrics)
        setTradingMetrics(data.tradingMetrics)
        setApiHealth(data.apiHealth)
        setExternalAPIs(data.externalAPIs)
        setAlerts(data.alerts)
      } else {
        // Simulate performance data for demo
        setPerformanceMetrics({
          avgResponseTime: 150 + Math.random() * 100,
          errorRate: Math.random() * 0.02,
          throughput: 50 + Math.random() * 30,
          criticalEndpoints: Math.random() > 0.8 ? ['/api/trading/order'] : [],
          healthyEndpoints: 12 + Math.floor(Math.random() * 3),
          degradedEndpoints: Math.floor(Math.random() * 2),
          criticalEndpoints: Math.random() > 0.9 ? 1 : 0
        })

        setTradingMetrics({
          missedOpportunities: Math.floor(Math.random() * 3),
          avgTradingLatency: 80 + Math.random() * 50,
          tradingSuccessRate: 0.95 + Math.random() * 0.04,
          profitabilityImpact: (Math.random() - 0.5) * 0.02
        })

        setApiHealth([
          {
            endpoint: '/api/trading/order',
            status: Math.random() > 0.8 ? 'DEGRADED' : 'HEALTHY',
            avgResponseTime: 120 + Math.random() * 80,
            errorRate: Math.random() * 0.01,
            throughput: 20 + Math.random() * 10,
            lastChecked: Date.now()
          },
          {
            endpoint: '/api/market/data',
            status: 'HEALTHY',
            avgResponseTime: 50 + Math.random() * 30,
            errorRate: Math.random() * 0.005,
            throughput: 100 + Math.random() * 50,
            lastChecked: Date.now()
          },
          {
            endpoint: '/api/portfolio/balance',
            status: 'HEALTHY',
            avgResponseTime: 80 + Math.random() * 40,
            errorRate: Math.random() * 0.003,
            throughput: 30 + Math.random() * 20,
            lastChecked: Date.now()
          }
        ])

        setExternalAPIs([
          {
            provider: 'COINBASE',
            endpoint: '/products',
            rateLimitUsage: Math.random() * 0.8,
            rateLimitRemaining: 1000 - Math.floor(Math.random() * 800),
            connectionStatus: Math.random() > 0.95 ? 'DISCONNECTED' : 'CONNECTED',
            lastLatency: 200 + Math.random() * 100,
            errorCount: Math.floor(Math.random() * 3)
          },
          {
            provider: 'BINANCE',
            endpoint: '/ticker/24hr',
            rateLimitUsage: Math.random() * 0.6,
            rateLimitRemaining: 1200 - Math.floor(Math.random() * 600),
            connectionStatus: 'CONNECTED',
            lastLatency: 150 + Math.random() * 80,
            errorCount: Math.floor(Math.random() * 2)
          }
        ])

        // Generate alerts based on metrics
        const newAlerts: PerformanceAlert[] = []
        if (performanceMetrics && performanceMetrics.avgResponseTime > 200) {
          newAlerts.push({
            id: 'latency-alert',
            type: 'LATENCY',
            severity: 'MEDIUM',
            message: 'Average response time exceeding 200ms',
            currentValue: performanceMetrics.avgResponseTime,
            threshold: 200,
            timestamp: Date.now(),
            acknowledged: false
          })
        }

        setAlerts(newAlerts)
      }
      
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Failed to fetch performance data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPerformanceData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchPerformanceData, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval])

  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'CONNECTED':
        return 'text-green-600 dark:text-green-400'
      case 'DEGRADED':
      case 'RECONNECTING':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'CRITICAL':
      case 'DISCONNECTED':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'CONNECTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'DEGRADED':
      case 'RECONNECTING':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'CRITICAL':
      case 'DISCONNECTED':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const formatLatency = (latency: number) => {
    return `${latency.toFixed(0)}ms`
  }

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            API Performance Monitor
          </div>
          <div className="flex items-center gap-2">
            {performanceMetrics && (
              <Badge variant={
                performanceMetrics.criticalEndpoints > 0 ? 'destructive' :
                performanceMetrics.degradedEndpoints > 0 ? 'secondary' : 'default'
              }>
                {performanceMetrics.criticalEndpoints > 0 ? 'CRITICAL' :
                 performanceMetrics.degradedEndpoints > 0 ? 'DEGRADED' : 'HEALTHY'}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchPerformanceData}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
            <TabsTrigger value="external">External APIs</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Performance Overview */}
            {performanceMetrics && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Avg Response Time</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatLatency(performanceMetrics.avgResponseTime)}
                    </div>
                    <Progress 
                      value={Math.min(100, (performanceMetrics.avgResponseTime / 500) * 100)} 
                      className="h-2 mt-2" 
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">Error Rate</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {formatPercentage(performanceMetrics.errorRate)}
                    </div>
                    <Progress 
                      value={Math.min(100, (performanceMetrics.errorRate / 0.05) * 100)} 
                      className="h-2 mt-2" 
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4" />
                      <span className="text-sm font-medium">Throughput</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {performanceMetrics.throughput.toFixed(0)} req/s
                    </div>
                    <Progress 
                      value={Math.min(100, (performanceMetrics.throughput / 100) * 100)} 
                      className="h-2 mt-2" 
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="h-4 w-4" />
                      <span className="text-sm font-medium">Endpoint Health</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {performanceMetrics.healthyEndpoints}/{performanceMetrics.healthyEndpoints + performanceMetrics.degradedEndpoints + performanceMetrics.criticalEndpoints}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Healthy endpoints
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Trading Performance Impact */}
            {tradingMetrics && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Trading Performance Impact
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm text-muted-foreground">Missed Opportunities</span>
                    <div className="text-lg font-bold text-red-600">
                      {tradingMetrics.missedOpportunities}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Trading Latency</span>
                    <div className="text-lg font-bold">
                      {formatLatency(tradingMetrics.avgTradingLatency)}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Success Rate</span>
                    <div className="text-lg font-bold text-green-600">
                      {formatPercentage(tradingMetrics.tradingSuccessRate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Profit Impact</span>
                    <div className={`text-lg font-bold ${tradingMetrics.profitabilityImpact >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tradingMetrics.profitabilityImpact >= 0 ? '+' : ''}{formatPercentage(tradingMetrics.profitabilityImpact)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-4">
            <div className="space-y-3">
              {apiHealth.map((endpoint, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(endpoint.status)}
                      <span className="font-medium">{endpoint.endpoint}</span>
                      <Badge variant={
                        endpoint.status === 'HEALTHY' ? 'default' :
                        endpoint.status === 'DEGRADED' ? 'secondary' : 'destructive'
                      }>
                        {endpoint.status}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatLatency(endpoint.avgResponseTime)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg Response Time
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Error Rate:</span>
                      <div className="font-medium">{formatPercentage(endpoint.errorRate)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Throughput:</span>
                      <div className="font-medium">{endpoint.throughput.toFixed(1)} req/min</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Checked:</span>
                      <div className="font-medium">
                        {new Date(endpoint.lastChecked).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Performance</span>
                      <span>{Math.max(0, 100 - (endpoint.avgResponseTime / 5)).toFixed(0)}%</span>
                    </div>
                    <Progress 
                      value={Math.max(0, 100 - (endpoint.avgResponseTime / 5))} 
                      className="h-1" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="external" className="space-y-4">
            <div className="space-y-3">
              {externalAPIs.map((api, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {api.connectionStatus === 'CONNECTED' ? 
                        <Wifi className="h-4 w-4 text-green-500" /> : 
                        <WifiOff className="h-4 w-4 text-red-500" />
                      }
                      <span className="font-medium">{api.provider}</span>
                      <Badge variant={api.connectionStatus === 'CONNECTED' ? 'default' : 'destructive'}>
                        {api.connectionStatus}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatLatency(api.lastLatency)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Last Latency
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Rate Limit Usage:</span>
                      <div className="font-medium">{formatPercentage(api.rateLimitUsage)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Remaining:</span>
                      <div className="font-medium">{api.rateLimitRemaining}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Error Count:</span>
                      <div className="font-medium">{api.errorCount}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Endpoint:</span>
                      <div className="font-medium">{api.endpoint}</div>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Rate Limit Usage</span>
                      <span>{formatPercentage(api.rateLimitUsage)}</span>
                    </div>
                    <Progress 
                      value={api.rateLimitUsage * 100} 
                      className="h-1" 
                    />
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            {alerts.filter(alert => !alert.acknowledged).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p>No active alerts</p>
                <p className="text-sm">All systems are operating normally</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.filter(alert => !alert.acknowledged).map(alert => (
                  <Alert key={alert.id} className={
                    alert.severity === 'CRITICAL' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' :
                    alert.severity === 'HIGH' ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20' :
                    'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20'
                  }>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{alert.message}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {alert.endpoint && `Endpoint: ${alert.endpoint} • `}
                          Current: {alert.currentValue.toFixed(2)} • 
                          Threshold: {alert.threshold} • 
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
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
          </TabsContent>
        </Tabs>

        {/* Last Update */}
        <div className="mt-6 pt-4 border-t text-center text-sm text-muted-foreground">
          Last updated: {lastUpdate.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  )
}
