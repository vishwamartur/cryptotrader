"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Zap, 
  Activity,
  BarChart3,
  Clock,
  Globe
} from "lucide-react"
import { useWebSocketMarketData } from "@/hooks/use-websocket-market-data"
import { useState, useEffect, useMemo } from "react"

interface RealtimeMarketDashboardProps {
  showAllSymbols?: boolean
  maxDisplaySymbols?: number
}

export function RealtimeMarketDashboard({ 
  showAllSymbols = true, 
  maxDisplaySymbols = 50 
}: RealtimeMarketDashboardProps) {
  // Use WebSocket with "all" symbol subscription for maximum efficiency
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: showAllSymbols, // ✅ Subscribe to ALL symbols efficiently
    subscribeToMajorPairs: !showAllSymbols, // Fallback to major pairs if not using "all"
    subscribeToAllProducts: false,
    channels: ['v2/ticker', 'l1_orderbook', 'all_trades'], // Comprehensive real-time data
    maxSymbols: 1000, // Allow all symbols
    environment: 'production'
  });

  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());

  // Update timestamp when new data arrives
  useEffect(() => {
    if (marketData.statistics.lastUpdate > 0) {
      setLastUpdateTime(new Date(marketData.statistics.lastUpdate));
    }
  }, [marketData.statistics.lastUpdate]);

  // Real-time performance metrics
  const performanceMetrics = useMemo(() => {
    const totalSymbols = marketData.marketDataArray.length;
    const connectedSymbols = marketData.connectedSymbols;
    const updateFrequency = marketData.isConnected ? 'Real-time (<1s)' : 'Disconnected';
    const dataEfficiency = totalSymbols > 0 ? `${connectedSymbols}/${totalSymbols} active` : '0/0';
    
    return {
      totalSymbols,
      connectedSymbols,
      updateFrequency,
      dataEfficiency,
      connectionUptime: marketData.isConnected ? 'Active' : 'Disconnected',
      subscriptionType: showAllSymbols ? 'All Symbols WebSocket' : 'Major Pairs WebSocket'
    };
  }, [marketData, showAllSymbols]);

  // Sort and filter market data for display
  const displayData = useMemo(() => {
    const data = marketData.marketDataArray
      .filter(item => item.price && parseFloat(item.price) > 0)
      .sort((a, b) => {
        const volumeA = parseFloat(a.volume || '0');
        const volumeB = parseFloat(b.volume || '0');
        return volumeB - volumeA; // Sort by volume descending
      })
      .slice(0, maxDisplaySymbols);
    
    return data;
  }, [marketData.marketDataArray, maxDisplaySymbols]);

  // Market statistics
  const marketStats = useMemo(() => {
    const gainers = displayData.filter(item => parseFloat(item.changePercent || '0') > 0).length;
    const losers = displayData.filter(item => parseFloat(item.changePercent || '0') < 0).length;
    const totalVolume = displayData.reduce((sum, item) => sum + parseFloat(item.volume || '0'), 0);
    
    return {
      gainers,
      losers,
      neutral: displayData.length - gainers - losers,
      totalVolume: totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      averageChange: displayData.length > 0 
        ? (displayData.reduce((sum, item) => sum + parseFloat(item.changePercent || '0'), 0) / displayData.length).toFixed(2)
        : '0.00'
    };
  }, [displayData]);

  if (marketData.isConnecting) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Market Dashboard
            <RefreshCw className="h-4 w-4 animate-spin ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
              <p className="text-lg font-semibold">Connecting to WebSocket...</p>
              <p className="text-sm text-muted-foreground">
                Establishing real-time connection for {showAllSymbols ? 'all symbols' : 'major pairs'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Real-time Status Header */}
      <Card className="border-blue-200">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-blue-600" />
              Real-time Market Dashboard
              {marketData.isConnected ? (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <Wifi className="h-3 w-3 mr-1" />
                  Live WebSocket
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-600 border-red-600">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Disconnected
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Updated: {lastUpdateTime.toLocaleTimeString()}</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{performanceMetrics.totalSymbols}</div>
              <div className="text-xs text-muted-foreground">Total Symbols</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{marketStats.gainers}</div>
              <div className="text-xs text-muted-foreground">Gainers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{marketStats.losers}</div>
              <div className="text-xs text-muted-foreground">Losers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{marketStats.totalVolume}</div>
              <div className="text-xs text-muted-foreground">Total Volume</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{performanceMetrics.updateFrequency}</div>
              <div className="text-xs text-muted-foreground">Update Speed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{performanceMetrics.subscriptionType}</div>
              <div className="text-xs text-muted-foreground">Data Source</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Data Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Market Overview
          </TabsTrigger>
          <TabsTrigger value="gainers" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top Gainers
          </TabsTrigger>
          <TabsTrigger value="losers" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Top Losers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                All Cryptocurrency Pairs (Real-time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {displayData.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No market data available</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={marketData.connect}
                    className="mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconnect
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {displayData.map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold">{item.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            Vol: {parseFloat(item.volume || '0').toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-semibold">
                          ${parseFloat(item.price || '0').toLocaleString(undefined, { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 6 
                          })}
                        </p>
                        <div className="flex items-center gap-1">
                          {parseFloat(item.changePercent || '0') >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${
                            parseFloat(item.changePercent || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {parseFloat(item.changePercent || '0').toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gainers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                Top Gainers (Real-time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {displayData
                  .filter(item => parseFloat(item.changePercent || '0') > 0)
                  .sort((a, b) => parseFloat(b.changePercent || '0') - parseFloat(a.changePercent || '0'))
                  .slice(0, 10)
                  .map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50"
                    >
                      <div>
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="text-sm font-mono">${parseFloat(item.price || '0').toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-bold">+{parseFloat(item.changePercent || '0').toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="losers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <TrendingDown className="h-4 w-4" />
                Top Losers (Real-time)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {displayData
                  .filter(item => parseFloat(item.changePercent || '0') < 0)
                  .sort((a, b) => parseFloat(a.changePercent || '0') - parseFloat(b.changePercent || '0'))
                  .slice(0, 10)
                  .map((item) => (
                    <div
                      key={item.symbol}
                      className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50"
                    >
                      <div>
                        <p className="font-semibold">{item.symbol}</p>
                        <p className="text-sm font-mono">${parseFloat(item.price || '0').toFixed(4)}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-red-600">
                          <TrendingDown className="h-4 w-4" />
                          <span className="font-bold">{parseFloat(item.changePercent || '0').toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* WebSocket Performance Info */}
      {marketData.error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <WifiOff className="h-4 w-4" />
              <span className="text-sm">WebSocket Error: {marketData.error}</span>
              <Button variant="outline" size="sm" onClick={marketData.connect}>
                Reconnect
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
