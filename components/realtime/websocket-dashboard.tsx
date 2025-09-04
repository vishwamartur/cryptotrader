"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  Zap, 
  Database, 
  Clock, 
  AlertTriangle,
  TrendingUp,
  Wifi,
  BarChart3,
  Settings
} from "lucide-react"
import { getGlobalRealtimeManager } from "@/lib/delta-realtime-manager"
import { ConnectionStatus } from "./connection-status"

interface WebSocketDashboardProps {
  className?: string
}

export function WebSocketDashboard({ className = "" }: WebSocketDashboardProps) {
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)
  const [connectionHealth, setConnectionHealth] = useState<any>(null)
  const [alerts, setAlerts] = useState<any[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const realtimeManager = getGlobalRealtimeManager()
    
    // Initial data fetch
    updateDashboardData()

    // Set up event listeners
    const handlePerformanceMetrics = (metrics: any) => {
      setPerformanceMetrics(metrics)
    }

    const handlePerformanceAlert = (alert: any) => {
      setAlerts(prev => [alert, ...prev].slice(0, 10)) // Keep last 10 alerts
    }

    const handleConnected = () => {
      setIsConnected(true)
      updateDashboardData()
    }

    const handleDisconnected = () => {
      setIsConnected(false)
      updateDashboardData()
    }

    realtimeManager.on('performanceMetrics', handlePerformanceMetrics)
    realtimeManager.on('performanceAlert', handlePerformanceAlert)
    realtimeManager.on('connected', handleConnected)
    realtimeManager.on('disconnected', handleDisconnected)

    // Update dashboard data every 5 seconds
    const updateInterval = setInterval(updateDashboardData, 5000)

    return () => {
      clearInterval(updateInterval)
      realtimeManager.off('performanceMetrics', handlePerformanceMetrics)
      realtimeManager.off('performanceAlert', handlePerformanceAlert)
      realtimeManager.off('connected', handleConnected)
      realtimeManager.off('disconnected', handleDisconnected)
    }
  }, [])

  const updateDashboardData = () => {
    try {
      const realtimeManager = getGlobalRealtimeManager()
      const health = realtimeManager.getConnectionHealth()
      const metrics = realtimeManager.getPerformanceMetrics()
      
      setConnectionHealth(health)
      setPerformanceMetrics(metrics)
      setIsConnected(health.connected)
    } catch (error) {
      console.error('Failed to update dashboard data:', error)
    }
  }

  const formatUptime = (uptime: number) => {
    const seconds = Math.floor(uptime / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  const getHealthScore = () => {
    if (!performanceMetrics || !connectionHealth) return 0
    
    let score = 0
    if (connectionHealth.connected) score += 30
    if (connectionHealth.authenticated) score += 20
    if (performanceMetrics.averageLatency < 500) score += 20
    if (performanceMetrics.errorRate < 0.05) score += 20
    if (performanceMetrics.messagesPerSecond > 0) score += 10
    
    return Math.min(100, score)
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return "text-green-500"
    if (latency < 300) return "text-yellow-500"
    return "text-red-500"
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (!performanceMetrics || !connectionHealth) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Activity className="h-5 w-5 animate-spin" />
            <span>Loading WebSocket dashboard...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Wifi className="h-6 w-6" />
          <h2 className="text-2xl font-bold">WebSocket Dashboard</h2>
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Health Score:</span>
          <div className="flex items-center space-x-2">
            <Progress value={getHealthScore()} className="w-20 h-2" />
            <span className="text-sm font-medium">{getHealthScore()}%</span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Messages/sec</p>
                <p className="text-2xl font-bold">{performanceMetrics.messagesPerSecond}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Avg Latency</p>
                <p className={`text-2xl font-bold ${getLatencyColor(performanceMetrics.averageLatency)}`}>
                  {performanceMetrics.averageLatency.toFixed(0)}ms
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-sm text-muted-foreground">Memory</p>
                <p className="text-2xl font-bold">{performanceMetrics.memoryUsage.toFixed(1)}MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Uptime</p>
                <p className="text-lg font-bold">{formatUptime(performanceMetrics.connectionUptime)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="streams">Data Streams</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="connection">Connection</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Performance Metrics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Messages:</span>
                    <div className="font-medium">{connectionHealth.messagesReceived.toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Error Rate:</span>
                    <div className="font-medium">{(performanceMetrics.errorRate * 100).toFixed(2)}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Subscriptions:</span>
                    <div className="font-medium">{performanceMetrics.subscriptionCount}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Active Streams:</span>
                    <div className="font-medium">{performanceMetrics.dataStreamHealth.size}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ConnectionStatus showDetails={false} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="streams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Stream Health</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceMetrics.dataStreamHealth.size > 0 ? (
                <div className="space-y-3">
                  {Array.from(performanceMetrics.dataStreamHealth.entries()).map(([streamType, health]: [string, any]) => (
                    <div key={streamType} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center space-x-3">
                        <Badge variant={health.isHealthy ? "default" : "destructive"}>
                          {health.isHealthy ? "Healthy" : "Unhealthy"}
                        </Badge>
                        <span className="font-medium">{streamType}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {health.messageCount} messages | {health.averageMessageSize.toFixed(0)} bytes avg
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No active data streams</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Recent Alerts</span>
                {alerts.length > 0 && (
                  <Badge variant="destructive">{alerts.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.map((alert, index) => (
                    <div key={index} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">Type: {alert.type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No recent alerts</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connection" className="space-y-4">
          <ConnectionStatus showDetails={true} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
