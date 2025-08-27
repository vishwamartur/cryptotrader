"use client"

import { Badge } from "@/components/ui/badge"
import { Wifi, WifiOff, RefreshCw } from "lucide-react"

interface ConnectionStatusProps {
  isConnected: boolean
  error?: string | null
  reconnectAttempts?: number
  lastUpdate?: number
}

export function ConnectionStatus({ isConnected, error, reconnectAttempts = 0, lastUpdate }: ConnectionStatusProps) {
  const getStatusColor = () => {
    if (error) return "destructive"
    if (!isConnected) return "secondary"
    return "default"
  }

  const getStatusText = () => {
    if (error) return "Connection Error"
    if (!isConnected && reconnectAttempts > 0) return `Reconnecting... (${reconnectAttempts})`
    if (!isConnected) return "Disconnected"
    return "Live"
  }

  const getStatusIcon = () => {
    if (error) return <WifiOff className="h-3 w-3" />
    if (!isConnected && reconnectAttempts > 0) return <RefreshCw className="h-3 w-3 animate-spin" />
    if (!isConnected) return <WifiOff className="h-3 w-3" />
    return <Wifi className="h-3 w-3" />
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getStatusColor()} className="text-xs flex items-center gap-1">
        {getStatusIcon()}
        {getStatusText()}
      </Badge>
      {lastUpdate && isConnected && (
        <span className="text-xs text-muted-foreground">
          Updated {Math.floor((Date.now() - lastUpdate) / 1000)}s ago
        </span>
      )}
    </div>
  )
}
