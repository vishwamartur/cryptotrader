'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useWebSocketMarketData } from '@/hooks/use-websocket-market-data';

interface AITradingSignalsProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

interface SignalCardProps {
  signal: any;
  theme: 'light' | 'dark';
  onExecute?: (signal: any) => void;
  onDismiss?: (signal: any) => void;
}

function SignalCard({ signal, theme, onExecute, onDismiss }: SignalCardProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      const now = Date.now();
      const diff = now - signal.timestamp;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        setTimeAgo(`${hours}h ago`);
      } else if (minutes > 0) {
        setTimeAgo(`${minutes}m ago`);
      } else {
        setTimeAgo('Just now');
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000);
    return () => clearInterval(interval);
  }, [signal.timestamp]);

  const getSignalColor = (signalType: string) => {
    switch (signalType) {
      case 'BUY': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'SELL': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'BUY': return <TrendingUp className="w-4 h-4" />;
      case 'SELL': return <TrendingDown className="w-4 h-4" />;
      default: return <Minus className="w-4 h-4" />;
    }
  };

  const confidenceColor = signal.confidence >= 0.8 ? 'text-green-500' :
                         signal.confidence >= 0.6 ? 'text-yellow-500' : 'text-red-500';

  const riskReward = signal.signal === 'BUY' 
    ? (signal.takeProfit - signal.entryPrice) / (signal.entryPrice - signal.stopLoss)
    : (signal.entryPrice - signal.takeProfit) / (signal.stopLoss - signal.entryPrice);

  return (
    <Card className={`transition-all duration-200 hover:shadow-lg ${
      theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
    }`}>
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-500" />
              <span className="font-semibold">{signal.symbol.replace('-', '/')}</span>
              <Badge className={getSignalColor(signal.signal)}>
                {getSignalIcon(signal.signal)}
                <span className="ml-1">{signal.signal}</span>
              </Badge>
            </div>
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{timeAgo}</span>
            </div>
          </div>

          {/* Confidence Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Confidence</span>
              <span className={`text-sm font-medium ${confidenceColor}`}>
                {(signal.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <Progress 
              value={signal.confidence * 100} 
              className="h-2"
            />
          </div>

          {/* Price Levels */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="text-center">
              <div className="text-gray-500">Entry</div>
              <div className="font-medium">${signal.entryPrice.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">Stop Loss</div>
              <div className="font-medium text-red-500">${signal.stopLoss.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500">Take Profit</div>
              <div className="font-medium text-green-500">${signal.takeProfit.toFixed(2)}</div>
            </div>
          </div>

          {/* Risk/Reward */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              <Shield className="w-3 h-3 text-gray-500" />
              <span className="text-gray-500">Risk/Reward</span>
            </div>
            <span className={`font-medium ${
              riskReward >= 2 ? 'text-green-500' : 
              riskReward >= 1 ? 'text-yellow-500' : 'text-red-500'
            }`}>
              1:{riskReward.toFixed(2)}
            </span>
          </div>

          {/* Reasoning */}
          <div className="space-y-2">
            <div className="text-sm text-gray-500">AI Reasoning</div>
            <div className="text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              {signal.reasoning}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              onClick={() => onExecute?.(signal)}
              className="flex-1"
              disabled={signal.signal === 'HOLD'}
            >
              <Target className="w-3 h-3 mr-1" />
              Execute Trade
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss?.(signal)}
            >
              <XCircle className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AITradingSignals({ theme, autoRefresh, refreshInterval }: AITradingSignalsProps) {
  // Use WebSocket-based market data for real-time AI signal generation
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true,
    channels: ['v2/ticker', 'l1_orderbook']
  });

  // Mock AI signals based on real-time market data (replace with actual AI logic)
  const aiSignals = marketData.marketDataArray.slice(0, 10).map((data, index) => ({
    id: `signal_${index}`,
    symbol: data.symbol,
    type: Math.random() > 0.5 ? 'BUY' : 'SELL',
    confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
    price: parseFloat(data.close || '0'),
    timestamp: Date.now() - Math.random() * 3600000, // Random time in last hour
    reason: `Technical analysis indicates ${Math.random() > 0.5 ? 'bullish' : 'bearish'} momentum`
  }));

  const connectionStatus = marketData.isConnected ? 'connected' : 'disconnected';
  const lastUpdate = marketData.lastUpdate;
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');
  const [sortBy, setSortBy] = useState<'time' | 'confidence' | 'symbol'>('time');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Handle client-side hydration to prevent mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter and sort signals
  const filteredSignals = aiSignals
    .filter(signal => filter === 'ALL' || signal.signal === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'time':
          return b.timestamp - a.timestamp;
        case 'confidence':
          return b.confidence - a.confidence;
        case 'symbol':
          return a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });

  const handleExecuteTrade = async (signal: any) => {
    try {
      // In a real implementation, this would execute the trade
      console.log('Executing trade for signal:', signal);
      
      // Show success feedback
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to execute trade:', error);
      // Show error feedback
    }
  };

  const handleDismissSignal = (signal: any) => {
    // In a real implementation, this would remove the signal from the list
    console.log('Dismissing signal:', signal);
  };

  const generateNewSignal = async () => {
    setIsGenerating(true);
    try {
      // In a real implementation, this would trigger AI analysis
      await new Promise(resolve => setTimeout(resolve, 2000));
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate signal statistics
  const signalStats = {
    total: aiSignals.length,
    buy: aiSignals.filter(s => s.signal === 'BUY').length,
    sell: aiSignals.filter(s => s.signal === 'SELL').length,
    hold: aiSignals.filter(s => s.signal === 'HOLD').length,
    avgConfidence: aiSignals.length > 0 
      ? aiSignals.reduce((sum, s) => sum + s.confidence, 0) / aiSignals.length 
      : 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">AI Trading Signals</h3>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={generateNewSignal}
            disabled={isGenerating}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Analyzing...' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{signalStats.total}</div>
            <div className="text-xs text-gray-500">Total Signals</div>
          </CardContent>
        </Card>
        
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{signalStats.buy}</div>
            <div className="text-xs text-gray-500">Buy Signals</div>
          </CardContent>
        </Card>
        
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{signalStats.sell}</div>
            <div className="text-xs text-gray-500">Sell Signals</div>
          </CardContent>
        </Card>
        
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold text-gray-500">{signalStats.hold}</div>
            <div className="text-xs text-gray-500">Hold Signals</div>
          </CardContent>
        </Card>
        
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-3 text-center">
            <div className="text-2xl font-bold">{(signalStats.avgConfidence * 100).toFixed(0)}%</div>
            <div className="text-xs text-gray-500">Avg Confidence</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Filter:</span>
          {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map((filterOption) => (
            <Button
              key={filterOption}
              variant={filter === filterOption ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(filterOption)}
              className="text-xs"
            >
              {filterOption}
            </Button>
          ))}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          {(['time', 'confidence', 'symbol'] as const).map((sortOption) => (
            <Button
              key={sortOption}
              variant={sortBy === sortOption ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setSortBy(sortOption)}
              className="text-xs capitalize"
            >
              {sortOption}
            </Button>
          ))}
        </div>
      </div>

      {/* Signals List */}
      <div className="space-y-4">
        {filteredSignals.length === 0 ? (
          <Card className={`${
            theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            <CardContent className="p-8 text-center">
              <Brain className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <div className="text-gray-500">
                {aiSignals.length === 0 
                  ? 'No AI signals generated yet. Click "Generate" to create new signals.'
                  : `No ${filter.toLowerCase()} signals found.`
                }
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSignals.map((signal, index) => (
              <SignalCard
                key={`${signal.symbol}-${signal.timestamp}-${index}`}
                signal={signal}
                theme={theme}
                onExecute={handleExecuteTrade}
                onDismiss={handleDismissSignal}
              />
            ))}
          </div>
        )}
      </div>

      {/* Last Update */}
      <div className="text-xs text-gray-500 text-center">
        Last updated: {isClient ? new Date(lastUpdate).toLocaleString() : '--:--:--'}
      </div>
    </div>
  );
}
