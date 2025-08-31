'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign,
  PieChart,
  Target,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useRealtimeData } from '@/hooks/use-realtime-data';
import { Button } from '@/components/ui/button';

interface PortfolioTrackerProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  changePercent?: number;
  icon: React.ReactNode;
  theme: 'light' | 'dark';
  isPositive?: boolean;
  subtitle?: string;
}

function MetricCard({ 
  title, 
  value, 
  change, 
  changePercent, 
  icon, 
  theme, 
  isPositive,
  subtitle 
}: MetricCardProps) {
  return (
    <Card className={`${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-400">{subtitle}</p>
            )}
            {(change !== undefined || changePercent !== undefined) && (
              <div className={`flex items-center text-sm ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}>
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {change !== undefined && (
                  <span>{isPositive ? '+' : ''}${Math.abs(change).toFixed(2)}</span>
                )}
                {changePercent !== undefined && (
                  <span className="ml-1">
                    ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={`p-3 rounded-full ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'
          }`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AllocationChartProps {
  positions: any[];
  theme: 'light' | 'dark';
}

function AllocationChart({ positions, theme }: AllocationChartProps) {
  if (!positions || positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        No positions to display
      </div>
    );
  }

  const totalValue = positions.reduce((sum, pos) => sum + Math.abs(pos.currentPrice * pos.size), 0);
  
  const allocations = positions.map(pos => ({
    symbol: pos.symbol,
    value: Math.abs(pos.currentPrice * pos.size),
    percentage: (Math.abs(pos.currentPrice * pos.size) / totalValue) * 100,
    color: getColorForSymbol(pos.symbol)
  }));

  return (
    <div className="space-y-3">
      <h4 className="font-semibold">Portfolio Allocation</h4>
      <div className="space-y-2">
        {allocations.map((allocation, index) => (
          <div key={allocation.symbol} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: allocation.color }}
                />
                <span>{allocation.symbol.replace('-', '/')}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>${allocation.value.toLocaleString()}</span>
                <span className="text-gray-500">
                  ({allocation.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
            <Progress 
              value={allocation.percentage} 
              className="h-2"
              style={{
                '--progress-background': allocation.color
              } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function getColorForSymbol(symbol: string): string {
  const colors = {
    'BTC-USD': '#f7931a',
    'ETH-USD': '#627eea',
    'ADA-USD': '#0033ad',
    'SOL-USD': '#9945ff'
  };
  return colors[symbol as keyof typeof colors] || '#6b7280';
}

export function PortfolioTracker({ theme, autoRefresh, refreshInterval }: PortfolioTrackerProps) {
  const { portfolio, connectionStatus, lastUpdate } = useRealtimeData();
  const [showValues, setShowValues] = useState(true);
  const [timeframe, setTimeframe] = useState<'1D' | '7D' | '30D'>('1D');
  const [isClient, setIsClient] = useState(false);

  // Handle client-side hydration to prevent mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Calculate additional metrics
  const calculateMetrics = () => {
    if (!portfolio) return null;

    const totalInvested = portfolio.positions.reduce((sum, pos) => 
      sum + (pos.entryPrice * pos.size), 0
    );
    
    const totalReturn = portfolio.totalPnL;
    const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;
    
    const winningPositions = portfolio.positions.filter(pos => pos.unrealizedPnL > 0).length;
    const totalPositions = portfolio.positions.length;
    const winRate = totalPositions > 0 ? (winningPositions / totalPositions) * 100 : 0;

    return {
      totalInvested,
      totalReturn,
      totalReturnPercent,
      winRate,
      winningPositions,
      totalPositions
    };
  };

  const metrics = calculateMetrics();

  const formatValue = (value: number, hideValue = false) => {
    if (hideValue) return '••••••';
    // Use toFixed instead of toLocaleString to prevent hydration mismatch
    return isClient ? value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) : value.toFixed(2);
  };

  if (!portfolio) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Portfolio Tracker</h3>
          <Badge variant="secondary">Loading...</Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className={`${
              theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            } animate-pulse`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-300 rounded w-24"></div>
                  <div className="h-8 bg-gray-300 rounded w-32"></div>
                  <div className="h-4 bg-gray-300 rounded w-20"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Portfolio Tracker</h3>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowValues(!showValues)}
          >
            {showValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          
          <div className="flex items-center space-x-1">
            {(['1D', '7D', '30D'] as const).map((tf) => (
              <Button
                key={tf}
                variant={timeframe === tf ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTimeframe(tf)}
                className="text-xs"
              >
                {tf}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Value"
          value={`$${formatValue(portfolio.totalValue, !showValues)}`}
          subtitle={`Balance: $${formatValue(portfolio.balance, !showValues)}`}
          icon={<DollarSign className="w-5 h-5 text-blue-500" />}
          theme={theme}
        />
        
        <MetricCard
          title="Total P&L"
          value={`$${formatValue(Math.abs(portfolio.totalPnL), !showValues)}`}
          change={portfolio.totalPnL}
          changePercent={metrics?.totalReturnPercent}
          icon={portfolio.totalPnL >= 0 ? 
            <TrendingUp className="w-5 h-5 text-green-500" /> : 
            <TrendingDown className="w-5 h-5 text-red-500" />
          }
          theme={theme}
          isPositive={portfolio.totalPnL >= 0}
        />
        
        <MetricCard
          title="Daily P&L"
          value={`$${formatValue(Math.abs(portfolio.dailyPnL), !showValues)}`}
          change={portfolio.dailyPnL}
          icon={portfolio.dailyPnL >= 0 ? 
            <TrendingUp className="w-5 h-5 text-green-500" /> : 
            <TrendingDown className="w-5 h-5 text-red-500" />
          }
          theme={theme}
          isPositive={portfolio.dailyPnL >= 0}
        />
        
        <MetricCard
          title="Win Rate"
          value={`${metrics?.winRate.toFixed(1)}%`}
          subtitle={`${metrics?.winningPositions}/${metrics?.totalPositions} positions`}
          icon={<Target className="w-5 h-5 text-purple-500" />}
          theme={theme}
        />
      </div>

      {/* Portfolio Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-6">
            <AllocationChart positions={portfolio.positions} theme={theme} />
          </CardContent>
        </Card>

        {/* Position Summary */}
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <h4 className="font-semibold">Position Summary</h4>
              <div className="space-y-3">
                {portfolio.positions.map((position, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getColorForSymbol(position.symbol) }}
                      />
                      <div>
                        <div className="font-medium">
                          {position.symbol.replace('-', '/')}
                        </div>
                        <div className="text-sm text-gray-500">
                          {position.size.toFixed(4)} @ ${position.entryPrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`font-medium ${
                        position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {position.unrealizedPnL >= 0 ? '+' : ''}${position.unrealizedPnL.toFixed(2)}
                      </div>
                      <div className={`text-sm ${
                        position.unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        ({position.unrealizedPnL >= 0 ? '+' : ''}{position.unrealizedPnLPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {new Date(lastUpdate).toLocaleString()}
      </div>
    </div>
  );
}
