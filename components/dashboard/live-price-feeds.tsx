'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  Volume2,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { useDynamicMarketData } from '@/hooks/use-dynamic-market-data';
import { RealtimeMarketData, ProductInfo } from '@/lib/realtime-market-data';

interface LivePriceFeedsProps {
  theme: 'light' | 'dark';
  autoRefresh: boolean;
  refreshInterval: number;
}

interface PriceCardProps {
  symbol: string;
  data: RealtimeMarketData;
  product: ProductInfo;
  theme: 'light' | 'dark';
  onClick: () => void;
  isSelected: boolean;
  isLoading?: boolean;
}

function PriceCard({ symbol, data, product, theme, onClick, isSelected, isLoading }: PriceCardProps) {
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

  if (isLoading || !data) {
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
              <span className="font-semibold text-lg">{symbol}</span>
              <Badge variant="outline" className="text-xs">
                {product.productType.replace('_', ' ').toUpperCase()}
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
  const marketData = useDynamicMarketData();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change' | 'volume'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [isClient, setIsClient] = useState(false);

  // Handle client-side hydration to prevent mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-connect when component mounts
  useEffect(() => {
    if (!marketData.isConnected && marketData.products.length > 0) {
      // Subscribe to top perpetual futures by default
      const topSymbols = marketData.products
        .filter(p => p.productType === 'perpetual_futures')
        .slice(0, 20)
        .map(p => p.symbol);

      if (topSymbols.length > 0) {
        marketData.subscribe(topSymbols);
      }
    }
  }, [marketData.products, marketData.isConnected, marketData]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = marketData.products;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.underlyingAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by product type
    if (productTypeFilter !== 'all') {
      filtered = filtered.filter(product => product.productType === productTypeFilter);
    }

    return filtered;
  }, [marketData.products, searchTerm, productTypeFilter]);

  // Sort products with market data
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
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
    }).slice(0, displayLimit);
  }, [filteredProducts, marketData.marketData, sortBy, sortOrder, displayLimit]);

  const handleSort = (criteria: 'symbol' | 'price' | 'change' | 'volume') => {
    if (sortBy === criteria) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(criteria);
      setSortOrder('asc');
    }
  };

  const handleSubscribeToMore = () => {
    const unsubscribedProducts = filteredProducts.filter(product =>
      !marketData.subscribedSymbols.includes(product.symbol)
    ).slice(0, 10);

    if (unsubscribedProducts.length > 0) {
      marketData.subscribe(unsubscribedProducts.map(p => p.symbol));
    }
  };

  return (
    <Card className={`${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CardTitle className="text-lg">Live Price Feeds</CardTitle>
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
              Load More
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

          <Select value={displayLimit.toString()} onValueChange={(value) => setDisplayLimit(parseInt(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
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
            Showing {sortedProducts.length} of {filteredProducts.length} products
            {marketData.lastUpdate > 0 && (
              <span className="ml-2">
                • Last update: {isClient ? new Date(marketData.lastUpdate).toLocaleTimeString() : '--:--:--'}
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
        {!marketData.isLoading && !marketData.error && sortedProducts.length === 0 && (
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

        {/* Price Cards Grid */}
        {!marketData.isLoading && sortedProducts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProducts.map((product) => {
              const data = marketData.marketData.get(product.symbol);
              return (
                <PriceCard
                  key={product.symbol}
                  symbol={product.symbol}
                  data={data!}
                  product={product}
                  theme={theme}
                  onClick={() => setSelectedSymbol(selectedSymbol === product.symbol ? null : product.symbol)}
                  isSelected={selectedSymbol === product.symbol}
                  isLoading={!data}
                />
              );
            })}
          </div>
        )}

        {/* Selected Symbol Details */}
        {selectedSymbol && (
          <Card className={`mt-4 ${
            theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-300'
          }`}>
            <CardContent className="p-6">
              {(() => {
                const data = marketData.marketData.get(selectedSymbol);
                const product = marketData.products.find(p => p.symbol === selectedSymbol);

                if (!data || !product) {
                  return (
                    <div className="flex items-center justify-center py-4">
                      <span className="text-gray-500">Loading details...</span>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xl font-semibold">{selectedSymbol}</h4>
                        <p className="text-sm text-gray-500">{product.description}</p>
                      </div>
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
                          ${isClient ? data.price.toLocaleString() : data.price.toFixed(2)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">24h Change</span>
                        <div className={`text-lg font-semibold ${
                          data.changePercent >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {data.changePercent >= 0 ? '+' : ''}
                          {data.changePercent.toFixed(2)}%
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">24h Volume</span>
                        <div className="text-lg font-semibold">
                          {data.volume > 1000000
                            ? `${(data.volume / 1000000).toFixed(2)}M`
                            : `${(data.volume / 1000).toFixed(2)}K`
                          }
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">Bid/Ask</span>
                        <div className="text-lg font-semibold">
                          ${data.bid.toFixed(2)} / ${data.ask.toFixed(2)}
                        </div>
                      </div>

                      {data.openInterest && (
                        <div className="space-y-1">
                          <span className="text-sm text-gray-500">Open Interest</span>
                          <div className="text-lg font-semibold">
                            {data.openInterest > 1000000
                              ? `${(data.openInterest / 1000000).toFixed(2)}M`
                              : `${(data.openInterest / 1000).toFixed(2)}K`
                            }
                          </div>
                        </div>
                      )}

                      {data.fundingRate && (
                        <div className="space-y-1">
                          <span className="text-sm text-gray-500">Funding Rate</span>
                          <div className="text-lg font-semibold">
                            {(data.fundingRate * 100).toFixed(4)}%
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">Product Type</span>
                        <div className="text-lg font-semibold capitalize">
                          {product.productType.replace('_', ' ')}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">Last Update</span>
                        <div className="text-lg font-semibold">
                          {isClient ? new Date(data.timestamp).toLocaleTimeString() : '--:--:--'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}
