'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VirtualizedGrid } from '@/components/ui/virtualized-list';
import { 
  TrendingUp, 
  TrendingDown, 
  Search,
  Filter,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { useWebSocketMarketData } from '@/hooks/use-websocket-market-data';
import { RealtimeMarketData, ProductInfo } from '@/lib/realtime-market-data';

interface LivePriceFeedsOptimizedProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

interface OptimizedPriceCardProps {
  product: ProductInfo;
  data: RealtimeMarketData | null;
  theme: 'light' | 'dark';
  onClick: () => void;
  isSelected: boolean;
}

// Memoized price card component for performance
const OptimizedPriceCard = React.memo<OptimizedPriceCardProps>(({ 
  product, 
  data, 
  theme, 
  onClick, 
  isSelected 
}) => {
  const isPositive = data ? data.changePercent >= 0 : false;
  const isLoading = !data;

  if (isLoading) {
    return (
      <Card className={`cursor-pointer transition-all duration-200 ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } animate-pulse h-32`}>
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-6 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        isSelected 
          ? 'ring-2 ring-blue-500 shadow-lg' 
          : ''
      } ${
        theme === 'dark' ? 'bg-gray-800 border-gray-700 hover:bg-gray-750' : 'bg-white border-gray-200 hover:bg-gray-50'
      } h-32`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm truncate">{product.symbol}</span>
              <Badge variant="outline" className="text-xs">
                {product.productType === 'perpetual_futures' ? 'PERP' : 
                 product.productType === 'futures' ? 'FUT' : 
                 product.productType.slice(0, 3).toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              {isPositive ? (
                <ArrowUpRight className="w-3 h-3 text-green-500" />
              ) : (
                <ArrowDownRight className="w-3 h-3 text-red-500" />
              )}
            </div>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <div className="text-lg font-bold">
              ${data.price.toLocaleString(undefined, { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 6 
              })}
            </div>
            <div className={`text-sm font-medium ${
              isPositive ? 'text-green-500' : 'text-red-500'
            }`}>
              {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
            </div>
          </div>

          {/* Volume */}
          <div className="text-xs text-gray-500">
            Vol: {data.volume > 1000000 
              ? `${(data.volume / 1000000).toFixed(1)}M`
              : `${(data.volume / 1000).toFixed(1)}K`
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

OptimizedPriceCard.displayName = 'OptimizedPriceCard';

export function LivePriceFeedsOptimized({ theme, autoRefresh, refreshInterval }: LivePriceFeedsOptimizedProps) {
  // Use WebSocket-based market data instead of REST API
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToMajorPairs: true,
    subscribeToAllProducts: false,
    channels: ['ticker', 'l2_orderbook'],
    maxSymbols: 200
  });
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change' | 'volume'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [containerDimensions, setContainerDimensions] = useState({ width: 800, height: 600 });

  // Auto-connect and subscribe to top products
  useEffect(() => {
    if (!marketData.isConnected && marketData.products.length > 0) {
      const topSymbols = marketData.products
        .filter(p => p.productType === 'perpetual_futures')
        .slice(0, 50)
        .map(p => p.symbol);
      
      if (topSymbols.length > 0) {
        marketData.subscribe(topSymbols);
      }
    }
  }, [marketData.products, marketData.isConnected, marketData]);

  // Filter and sort products with memoization
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = marketData.products;

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(product =>
        product.symbol.toLowerCase().includes(searchLower) ||
        product.underlying_asset?.symbol?.toLowerCase().includes(searchLower) ||
        product.description?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by product type
    if (productTypeFilter !== 'all') {
      filtered = filtered.filter(product => product.contract_type === productTypeFilter);
    }

    // Sort products
    return filtered.sort((a, b) => {
      const aData = marketData.marketData.get(a.symbol);
      const bData = marketData.marketData.get(b.symbol);
      
      let comparison = 0;
      switch (sortBy) {
        case 'symbol':
          comparison = a.symbol.localeCompare(b.symbol);
          break;
        case 'price':
          if (!aData || !bData) return 0;
          comparison = aData.price - bData.price;
          break;
        case 'change':
          if (!aData || !bData) return 0;
          comparison = aData.changePercent - bData.changePercent;
          break;
        case 'volume':
          if (!aData || !bData) return 0;
          comparison = aData.volume - bData.volume;
          break;
        default:
          comparison = a.symbol.localeCompare(b.symbol);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [marketData.products, marketData.marketData, searchTerm, productTypeFilter, sortBy, sortOrder]);

  const handleSort = useCallback((criteria: 'symbol' | 'price' | 'change' | 'volume') => {
    if (sortBy === criteria) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(criteria);
      setSortOrder('asc');
    }
  }, [sortBy]);

  const handleSubscribeToMore = useCallback(() => {
    const unsubscribedProducts = filteredAndSortedProducts
      .filter(product => !marketData.subscribedSymbols.includes(product.symbol))
      .slice(0, 20);
    
    if (unsubscribedProducts.length > 0) {
      marketData.subscribeToSymbols(unsubscribedProducts.map(p => p.symbol));
    }
  }, [filteredAndSortedProducts, marketData]);

  // Render item function for virtualized grid
  const renderPriceCard = useCallback((product: ProductInfo, index: number) => {
    const data = marketData.marketData.get(product.symbol);
    return (
      <OptimizedPriceCard
        key={product.symbol}
        product={product}
        data={data || null}
        theme={theme}
        onClick={() => setSelectedSymbol(prev => prev === product.symbol ? null : product.symbol)}
        isSelected={selectedSymbol === product.symbol}
      />
    );
  }, [marketData.marketData, theme, selectedSymbol]);

  // Calculate grid dimensions
  const itemWidth = 280;
  const itemHeight = 140;
  const gap = 16;

  return (
    <Card className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg">Live Price Feeds (Optimized)</CardTitle>
            <Badge variant={marketData.isConnected ? 'default' : 'destructive'} className="flex items-center gap-1">
              {marketData.isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {marketData.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
            {marketData.error && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Error
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={marketData.refresh}
              disabled={marketData.isLoading}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${marketData.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubscribeToMore}
              disabled={marketData.isLoading}
            >
              Subscribe More
            </Button>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex items-center space-x-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search symbols, assets, or descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          
          <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="perpetual_futures">Perpetual Futures</SelectItem>
              <SelectItem value="futures">Futures</SelectItem>
              <SelectItem value="call_options">Call Options</SelectItem>
              <SelectItem value="put_options">Put Options</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center space-x-1">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Sort by:</span>
            {(['symbol', 'price', 'change', 'volume'] as const).map((criteria) => (
              <Button
                key={criteria}
                variant={sortBy === criteria ? 'default' : 'ghost'}
                size="sm"
                onClick={() => handleSort(criteria)}
                className="text-xs capitalize"
              >
                {criteria}
                {sortBy === criteria && (
                  <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </Button>
            ))}
          </div>
          
          <div className="text-xs text-gray-500">
            Showing {filteredAndSortedProducts.length} products
            {marketData.lastUpdate > 0 && (
              <span className="ml-2">
                • Last update: {new Date(marketData.lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Loading State */}
        {marketData.isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Loading market data...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {marketData.error && !marketData.isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-red-500">{marketData.error}</p>
              <Button variant="outline" onClick={marketData.refresh}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!marketData.isLoading && !marketData.error && filteredAndSortedProducts.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Search className="w-8 h-8 text-gray-400 mx-auto" />
              <p className="text-gray-500">No products found matching your criteria</p>
              <Button variant="outline" onClick={() => { setSearchTerm(''); setProductTypeFilter('all'); }}>
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Virtualized Price Cards Grid */}
        {!marketData.isLoading && filteredAndSortedProducts.length > 0 && (
          <div 
            className="w-full"
            style={{ height: '600px' }}
            ref={(el) => {
              if (el) {
                const rect = el.getBoundingClientRect();
                setContainerDimensions({ width: rect.width, height: 600 });
              }
            }}
          >
            <VirtualizedGrid
              items={filteredAndSortedProducts}
              itemWidth={itemWidth}
              itemHeight={itemHeight}
              containerWidth={containerDimensions.width}
              containerHeight={containerDimensions.height}
              renderItem={renderPriceCard}
              gap={gap}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
