'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity,
  Volume2,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { useRealtimeData } from '@/hooks/use-realtime-data';

interface LivePriceFeedsProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

interface PriceCardProps {
  symbol: string;
  data: any;
  theme: 'light' | 'dark';
  onClick: () => void;
  isSelected: boolean;
}

function PriceCard({ symbol, data, theme, onClick, isSelected }: PriceCardProps) {
  const [priceAnimation, setPriceAnimation] = useState<'up' | 'down' | null>(null);
  const [prevPrice, setPrevPrice] = useState(data?.price || 0);

  useEffect(() => {
    if (data?.price && data.price !== prevPrice) {
      setPriceAnimation(data.price > prevPrice ? 'up' : 'down');
      setPrevPrice(data.price);
      
      const timer = setTimeout(() => setPriceAnimation(null), 1000);
      return () => clearTimeout(timer);
    }
  }, [data?.price, prevPrice]);

  if (!data) {
    return (
      <Card className={`cursor-pointer transition-all duration-200 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } animate-pulse`}>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-gray-300 rounded w-16"></div>
              <div className="h-4 bg-gray-300 rounded w-12"></div>
            </div>
            <div className="h-8 bg-gray-300 rounded w-24"></div>
            <div className="h-4 bg-gray-300 rounded w-20"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isPositive = data.change >= 0;
  const formatPrice = (price: number) => {
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    // Use toFixed instead of toLocaleString to prevent hydration mismatch
    return price.toFixed(2);
  };

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } ${
        priceAnimation === 'up' ? 'bg-green-500/10 border-green-500/50' :
        priceAnimation === 'down' ? 'bg-red-500/10 border-red-500/50' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-lg">{symbol.replace('-', '/')}</span>
              <Badge variant="outline" className="text-xs">
                LIVE
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              {isPositive ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <div className={`text-2xl font-bold transition-colors duration-300 ${
              priceAnimation === 'up' ? 'text-green-500' :
              priceAnimation === 'down' ? 'text-red-500' : ''
            }`}>
              ${formatPrice(data.price)}
            </div>
            
            {/* Change */}
            <div className="flex items-center space-x-2">
              <span className={`flex items-center text-sm font-medium ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}>
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {isPositive ? '+' : ''}${Math.abs(data.change).toFixed(2)}
              </span>
              <span className={`text-sm ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}>
                ({isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
            <div>
              <span className="block">24h High</span>
              <span className="font-medium">${formatPrice(data.high24h)}</span>
            </div>
            <div>
              <span className="block">24h Low</span>
              <span className="font-medium">${formatPrice(data.low24h)}</span>
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 text-gray-500">
              <Volume2 className="w-3 h-3" />
              <span>Volume</span>
            </div>
            <span className="font-medium">
              {(data.volume / 1000000).toFixed(2)}M
            </span>
          </div>

          {/* Bid/Ask Spread */}
          {data.bid && data.ask && (
            <div className="flex items-center justify-between text-xs">
              <div className="text-green-600">
                Bid: ${formatPrice(data.bid)}
              </div>
              <div className="text-red-600">
                Ask: ${formatPrice(data.ask)}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LivePriceFeeds({ theme, autoRefresh, refreshInterval }: LivePriceFeedsProps) {
  const { marketData, connectionStatus, lastUpdate } = useRealtimeData();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isClient, setIsClient] = useState(false);

  // Handle client-side hydration to prevent mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  const symbols = ['BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD'];

  // Sort symbols based on current sort criteria
  const sortedSymbols = [...symbols].sort((a, b) => {
    const aData = marketData[a];
    const bData = marketData[b];
    
    if (!aData || !bData) return 0;
    
    let comparison = 0;
    switch (sortBy) {
      case 'symbol':
        comparison = a.localeCompare(b);
        break;
      case 'price':
        comparison = aData.price - bData.price;
        break;
      case 'change':
        comparison = aData.changePercent - bData.changePercent;
        break;
    }
    
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (criteria: 'symbol' | 'price' | 'change') => {
    if (sortBy === criteria) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(criteria);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Live Price Feeds</h3>
          <Badge variant={connectionStatus === 'connected' ? 'default' : 'destructive'}>
            {connectionStatus}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            Last update: {isClient ? new Date(lastUpdate).toLocaleTimeString() : '--:--:--'}
          </span>
          
          {/* Sort Controls */}
          <div className="flex items-center space-x-1">
            <Button
              variant={sortBy === 'symbol' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSort('symbol')}
              className="text-xs"
            >
              Symbol
            </Button>
            <Button
              variant={sortBy === 'price' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSort('price')}
              className="text-xs"
            >
              Price
            </Button>
            <Button
              variant={sortBy === 'change' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleSort('change')}
              className="text-xs"
            >
              Change
            </Button>
          </div>
        </div>
      </div>

      {/* Price Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sortedSymbols.map((symbol) => (
          <PriceCard
            key={symbol}
            symbol={symbol}
            data={marketData[symbol]}
            theme={theme}
            onClick={() => setSelectedSymbol(selectedSymbol === symbol ? null : symbol)}
            isSelected={selectedSymbol === symbol}
          />
        ))}
      </div>

      {/* Selected Symbol Details */}
      {selectedSymbol && marketData[selectedSymbol] && (
        <Card className={`${
          theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-semibold">
                  {selectedSymbol.replace('-', '/')} Details
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedSymbol(null)}
                >
                  ×
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-gray-500">Current Price</span>
                  <div className="text-lg font-semibold">
                    ${isClient ? marketData[selectedSymbol].price.toLocaleString() : marketData[selectedSymbol].price.toFixed(2)}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-gray-500">24h Change</span>
                  <div className={`text-lg font-semibold ${
                    marketData[selectedSymbol].change >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}>
                    {marketData[selectedSymbol].change >= 0 ? '+' : ''}
                    {marketData[selectedSymbol].changePercent.toFixed(2)}%
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-gray-500">24h Volume</span>
                  <div className="text-lg font-semibold">
                    {(marketData[selectedSymbol].volume / 1000000).toFixed(2)}M
                  </div>
                </div>
                
                <div className="space-y-1">
                  <span className="text-sm text-gray-500">Last Update</span>
                  <div className="text-lg font-semibold">
                    {isClient ? new Date(marketData[selectedSymbol].timestamp).toLocaleTimeString() : '--:--:--'}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
