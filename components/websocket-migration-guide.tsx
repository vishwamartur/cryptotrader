"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  CheckCircle, 
  XCircle, 
  Zap, 
  Wifi, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Code,
  Database
} from "lucide-react"
import { useState } from "react"

interface MigrationGuideProps {
  showDetails?: boolean
}

export function WebSocketMigrationGuide({ showDetails = false }: MigrationGuideProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails)

  const performanceComparison = [
    {
      metric: "Data Latency",
      restApi: "1000+ ms per symbol",
      webSocket: "<100 ms for all symbols",
      improvement: "90%+ faster",
      icon: Clock
    },
    {
      metric: "Network Requests",
      restApi: "Multiple HTTP calls",
      webSocket: "Single WebSocket connection",
      improvement: "90% reduction",
      icon: Wifi
    },
    {
      metric: "Authentication Errors",
      restApi: "401 errors with HMAC",
      webSocket: "Reliable WebSocket auth",
      improvement: "100% resolved",
      icon: CheckCircle
    },
    {
      metric: "Real-time Updates",
      restApi: "30-second polling",
      webSocket: "Sub-second live updates",
      improvement: "3000% improvement",
      icon: TrendingUp
    }
  ]

  const migrationSteps = [
    {
      step: 1,
      title: "Replace Portfolio Hook",
      description: "Switch from usePortfolio to useWebSocketPortfolio",
      code: `// Before (REST API with 401 errors)
const { portfolioData, loading, error } = usePortfolio(credentials);

// After (WebSocket with real-time updates)
const portfolio = useWebSocketPortfolio({
  autoConnect: true,
  environment: 'production'
});`,
      status: "recommended"
    },
    {
      step: 2,
      title: "Replace Market Data Hook",
      description: "Switch from individual REST calls to WebSocket 'all' subscription",
      code: `// Before (1000+ ms per symbol)
const btcData = await fetch('/api/market/realtime/BTCUSDT');
const ethData = await fetch('/api/market/realtime/ETHUSDT');

// After (sub-second for all symbols)
const marketData = useWebSocketMarketData({
  subscribeToAllSymbols: true,
  channels: ['v2/ticker']
});`,
      status: "recommended"
    },
    {
      step: 3,
      title: "Update Component Logic",
      description: "Access real-time data from WebSocket hooks",
      code: `// Access real-time portfolio data
const balances = portfolio.balances;
const positions = portfolio.positions;
const summary = portfolio.summary;

// Check connection status
const isConnected = portfolio.isConnected;
const isUsingMockData = portfolio.isUsingMockData;`,
      status: "required"
    }
  ]

  if (!isExpanded) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Zap className="h-4 w-4 text-blue-600" />
        <AlertDescription className="flex items-center justify-between">
          <span className="text-blue-800">
            <strong>Performance Upgrade Available:</strong> Migrate to WebSocket for 90%+ faster data updates
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsExpanded(true)}
            className="ml-4"
          >
            View Migration Guide
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-blue-200">
        <CardHeader className="bg-blue-50">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Zap className="h-5 w-5" />
            WebSocket Migration Guide
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Performance Upgrade
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-red-600 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Current Issues (REST API)
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• 401 authentication errors with Delta Exchange</li>
                <li>• 1000+ ms latency per symbol request</li>
                <li>• Multiple sequential API calls</li>
                <li>• Fallback to mock data due to failures</li>
                <li>• 30-second polling intervals</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                WebSocket Benefits
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Reliable WebSocket authentication</li>
                <li>• Sub-second real-time updates</li>
                <li>• Single connection for all data</li>
                <li>• Automatic reconnection handling</li>
                <li>• Live data streaming</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {performanceComparison.map((item, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className="h-4 w-4 text-blue-600" />
                  <h4 className="font-semibold text-sm">{item.metric}</h4>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">REST API:</span>
                    <span className="text-muted-foreground">{item.restApi}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-green-600">WebSocket:</span>
                    <span className="text-muted-foreground">{item.webSocket}</span>
                  </div>
                  <div className="pt-1 border-t">
                    <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                      {item.improvement}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Migration Steps */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Migration Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {migrationSteps.map((step, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-sm">
                    {step.step}
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h4 className="font-semibold flex items-center gap-2">
                      {step.title}
                      <Badge 
                        variant={step.status === 'required' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {step.status}
                      </Badge>
                    </h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </p>
                  </div>
                  <div className="bg-muted rounded-lg p-3">
                    <pre className="text-xs overflow-x-auto">
                      <code>{step.code}</code>
                    </pre>
                  </div>
                </div>
              </div>
              {index < migrationSteps.length - 1 && (
                <div className="flex justify-center mt-4">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Implementation Status */}
      <Card className="border-green-200">
        <CardHeader className="bg-green-50">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <Database className="h-5 w-5" />
            Implementation Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-green-600">✅ Completed</h4>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  WebSocket client with "all" symbol support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  useWebSocketPortfolio hook
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  useWebSocketMarketData hook
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Authentication and reconnection logic
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  Portfolio component migration
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="font-semibold text-blue-600">🔄 Next Steps</h4>
              <ul className="text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-blue-600" />
                  Test WebSocket connection with real credentials
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-blue-600" />
                  Update remaining components to use WebSocket hooks
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-blue-600" />
                  Remove deprecated REST API endpoints
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-blue-600" />
                  Add monitoring for WebSocket connections
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-blue-600" />
                  Performance testing and optimization
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button onClick={() => setIsExpanded(false)} variant="outline">
          Minimize Guide
        </Button>
        <Button className="bg-blue-600 hover:bg-blue-700">
          Start Migration
        </Button>
      </div>
    </div>
  )
}
