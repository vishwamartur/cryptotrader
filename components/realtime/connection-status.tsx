"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { 
  Wifi, 
  WifiOff, 
  Shield, 
  ShieldAlert, 
  Activity, 
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react"
import { getGlobalRealtimeManager } from "@/lib/delta-realtime-manager"

interface ConnectionStatusProps {
  showDetails?: boolean
  className?: string
}

export function ConnectionStatus({ showDetails = false, className = "" }: ConnectionStatusProps) {
  const [connectionHealth, setConnectionHealth] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const realtimeManager = getGlobalRealtimeManager()
    
    // Initial health check
    updateConnectionHealth()

    // Set up health monitoring
    const healthInterval = setInterval(updateConnectionHealth, 5000)

    // Listen for connection events
    const handleConnected = () => updateConnectionHealth()
    const handleDisconnected = () => updateConnectionHealth()
    const handleAuthenticated = () => updateConnectionHealth()
    const handleError = () => updateConnectionHealth()
    const handleHealthUpdate = (health: any) => setConnectionHealth(health)

    realtimeManager.on('connected', handleConnected)
    realtimeManager.on('disconnected', handleDisconnected)
    realtimeManager.on('authenticated', handleAuthenticated)
    realtimeManager.on('error', handleError)
    realtimeManager.on('healthUpdate', handleHealthUpdate)

    return () => {
      clearInterval(healthInterval)
      realtimeManager.off('connected', handleConnected)
      realtimeManager.off('disconnected', handleDisconnected)
      realtimeManager.off('authenticated', handleAuthenticated)
      realtimeManager.off('error', handleError)
      realtimeManager.off('healthUpdate', handleHealthUpdate)
    }
  }, [])

  const updateConnectionHealth = () => {
    try {
      const realtimeManager = getGlobalRealtimeManager()
      const health = realtimeManager.getConnectionHealth()
      setConnectionHealth(health)
    } catch (error) {
      console.error('Failed to get connection health:', error)
    }
  }

  const handleReconnect = async () => {
    setIsLoading(true)
    try {
      const realtimeManager = getGlobalRealtimeManager()
      await realtimeManager.connect()
    } catch (error) {
      console.error('Manual reconnect failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDisconnect = () => {
    const realtimeManager = getGlobalRealtimeManager()
    realtimeManager.disconnect()
  }

  const clearErrors = () => {
    const realtimeManager = getGlobalRealtimeManager()
    realtimeManager.clearErrors()
    updateConnectionHealth()
  }

  if (!connectionHealth) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Activity className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading connection status...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getConnectionStatusBadge = () => {
    if (connectionHealth.connected && connectionHealth.authenticated) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle className="h-3 w-3 mr-1" />
          Connected & Authenticated
        </Badge>
      )
    } else if (connectionHealth.connected) {
      return (
        <Badge variant="secondary">
          <Wifi className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      )
    } else {
      return (
        <Badge variant="destructive">
          <WifiOff className="h-3 w-3 mr-1" />
          Disconnected
        </Badge>
      )
    }
  }

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return "text-green-500"
    if (latency < 300) return "text-yellow-500"
    return "text-red-500"
  }

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return "Never"
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>WebSocket Connection</span>
          </span>
          {getConnectionStatusBadge()}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Connection Actions */}
        <div className="flex space-x-2">
          {connectionHealth.connected ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDisconnect}
            >
              <WifiOff className="h-4 w-4 mr-1" />
              Disconnect
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleReconnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4 mr-1" />
              )}
              {isLoading ? 'Connecting...' : 'Connect'}
            </Button>
          )}
          
          {connectionHealth.errors.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearErrors}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Clear Errors
            </Button>
          )}
        </div>

        {showDetails && (
          <>
            <Separator />
            
            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Authentication</span>
                </div>
                <div className="flex items-center space-x-1">
                  {connectionHealth.authenticated ? (
                    <>
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Authenticated</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3 w-3 text-yellow-500" />
                      <span className="text-yellow-500">Not Authenticated</span>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Latency</span>
                </div>
                <span className={getLatencyColor(connectionHealth.latency)}>
                  {connectionHealth.latency}ms
                </span>
              </div>

              <div>
                <span className="font-medium">Messages Received</span>
                <div>{connectionHealth.messagesReceived.toLocaleString()}</div>
              </div>

              <div>
                <span className="font-medium">Messages Sent</span>
                <div>{connectionHealth.messagesSent.toLocaleString()}</div>
              </div>

              <div>
                <span className="font-medium">Reconnect Attempts</span>
                <div>{connectionHealth.reconnectAttempts}</div>
              </div>

              <div>
                <span className="font-medium">Last Heartbeat</span>
                <div>{formatTimestamp(connectionHealth.lastHeartbeat)}</div>
              </div>
            </div>

            {/* Subscriptions */}
            {connectionHealth.subscriptions.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Activity className="h-4 w-4" />
                    <span className="font-medium">Active Subscriptions</span>
                    <Badge variant="secondary">{connectionHealth.subscriptions.length}</Badge>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-1 text-xs">
                      {connectionHealth.subscriptions.map((subscription: string, index: number) => (
                        <div key={index} className="bg-muted px-2 py-1 rounded">
                          {subscription}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Errors */}
            {connectionHealth.errors.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-red-500">Recent Errors</span>
                    <Badge variant="destructive">{connectionHealth.errors.length}</Badge>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    <div className="space-y-1 text-xs">
                      {connectionHealth.errors.slice(-5).map((error: string, index: number) => (
                        <div key={index} className="bg-red-50 border border-red-200 px-2 py-1 rounded text-red-700">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Connection Health Score */}
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Connection Health</span>
                <span className="text-sm text-muted-foreground">
                  {calculateHealthScore(connectionHealth)}%
                </span>
              </div>
              <Progress value={calculateHealthScore(connectionHealth)} className="h-2" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function calculateHealthScore(health: any): number {
  let score = 0
  
  // Connection status (40 points)
  if (health.connected) score += 40
  
  // Authentication status (30 points)
  if (health.authenticated) score += 30
  
  // Latency score (20 points)
  if (health.latency < 100) score += 20
  else if (health.latency < 300) score += 10
  
  // Error score (10 points)
  if (health.errors.length === 0) score += 10
  else if (health.errors.length < 3) score += 5
  
  return Math.max(0, Math.min(100, score))
}
