'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Utility function for safe number formatting
const safeToFixed = (value: number | null | undefined, decimals: number = 2): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.00'
  }
  return value.toFixed(decimals)
}
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
import { useWebSocketMarketData } from '@/hooks/use-websocket-market-data';
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
    if (typeof data?.price === 'number' && data.price !== prevPrice) {
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

  const isPositive = (data?.change ?? 0) >= 0;
  const formatPrice = (price: number | undefined) => {
    if (!price && price !== 0) return '0.00';
    if (price < 1) return price.toFixed(4);
    if (price < 100) return price.toFixed(2);
    // Use toFixed instead of toLocaleString to prevent hydration mismatch
    return price.toFixed(2);
  };

  // Use module-level safeToFixed

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
                {isPositive ? '+' : ''}${safeToFixed(Math.abs(data?.change ?? 0), 2)}
              </span>
              <span className={`text-sm ${
                isPositive ? 'text-green-500' : 'text-red-500'
              }`}>
                ({isPositive ? '+' : ''}{safeToFixed(data?.changePercent, 2)}%)
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
              {(((data?.volume ?? 0) / 1_000_000)).toFixed(2)}M
            </span>
          </div>

          {/* Bid/Ask Spread */}
          {data.bid != null && data.ask != null && (
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
  // Use WebSocket-based market data with "all" symbol subscription for maximum efficiency
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true, // ✅ Use "all" symbol subscription for ALL cryptocurrency pairs
    subscribeToMajorPairs: false, // Disable individual subscriptions since we're using "all"
    subscribeToAllProducts: false,
    channels: ['v2/ticker', 'l1_orderbook'], // Enhanced channels for comprehensive real-time data
    maxSymbols: 1000, // Allow all symbols
    environment: 'production'
  });

  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'change' | 'volume'>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState<string>('all');
  const [displayLimit, setDisplayLimit] = useState(20);
  const [isClient, setIsClient] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  // Use ref to track subscription state
  const subscriptionStateRef = useRef({ majorPairs: false, allProducts: false });

  // Handle client-side hydration to prevent mismatch
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle subscription to all products when requested
  const handleSubscribeToAllProducts = useCallback(() => {
    if (marketData.isConnected && !subscriptionStateRef.current.allProducts) {
      console.log('[LivePriceFeeds] Subscribing to all products');
      marketData.subscribeToAllProducts(['ticker']);
      subscriptionStateRef.current.allProducts = true;
      setShowAllProducts(true);
    }
  }, [marketData.isConnected, marketData.subscribeToAllProducts]);

  // Handle subscription to major pairs only
  const handleSubscribeToMajorPairs = useCallback(() => {
    if (marketData.isConnected && subscriptionStateRef.current.allProducts) {
      console.log('[LivePriceFeeds] Switching back to major pairs only');
      // Disconnect and reconnect to reset subscriptions
      marketData.disconnect();
      setTimeout(() => {
        marketData.connect();
      }, 1000);
      subscriptionStateRef.current.allProducts = false;
      subscriptionStateRef.current.majorPairs = false;
      setShowAllProducts(false);
    }
  }, [marketData.isConnected, marketData.disconnect, marketData.connect]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let filtered = marketData.products;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.underlying_asset?.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by product type
    if (productTypeFilter !== 'all') {
      filtered = filtered.filter(product => product.contract_type === productTypeFilter);
    }

    return filtered;
  }, [marketData.products, searchTerm, productTypeFilter]);

  // Access the Map data structure correctly from the WebSocket hook
  const marketDataMap = useMemo(() => {
    // The marketData from useWebSocketMarketData is already a Map
    if (marketData.marketData instanceof Map) {
      return marketData.marketData;
    }

    // Fallback: if it's not a Map, create one
    console.warn('[LivePriceFeeds] marketData.marketData is not a Map, creating fallback');
    const dataMap = new Map();

    if (Array.isArray(marketData.marketDataArray)) {
      marketData.marketDataArray.forEach(item => {
        dataMap.set(item.symbol, {
          symbol: item.symbol,
          price: parseFloat(item.price),
          change: parseFloat(item.change),
          changePercent: parseFloat(item.changePercent),
          volume: parseFloat(item.volume),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          lastUpdate: item.lastUpdate
        });
      });
    }

    return dataMap;
  }, [marketData.marketData, marketData.marketDataArray]);

  // Sort products with market data - with proper error handling
  const sortedProducts = useMemo(() => {
    try {
      if (!Array.isArray(filteredProducts)) {
        console.warn('[LivePriceFeeds] filteredProducts is not an array:', typeof filteredProducts);
        return [];
      }

      if (!marketDataMap || typeof marketDataMap.get !== 'function') {
        console.warn('[LivePriceFeeds] marketDataMap is not a valid Map:', typeof marketDataMap);
        return filteredProducts.slice(0, displayLimit);
      }

      return [...filteredProducts].sort((a, b) => {
        // Validate product objects
        if (!a || !b || !a.symbol || !b.symbol) {
          console.warn('[LivePriceFeeds] Invalid product objects in sort:', { a, b });
          return 0;
        }

        const aData = marketDataMap.get(a.symbol);
        const bData = marketDataMap.get(b.symbol);

        let comparison = 0;

        try {
          switch (sortBy) {
            case 'symbol':
              comparison = (a.symbol || '').localeCompare(b.symbol || '');
              break;
            case 'price':
              if (!aData || !bData || typeof aData.price !== 'number' || typeof bData.price !== 'number') {
                return 0;
              }
              comparison = aData.price - bData.price;
              break;
            case 'change':
              if (!aData || !bData || typeof aData.changePercent !== 'number' || typeof bData.changePercent !== 'number') {
                return 0;
              }
              comparison = aData.changePercent - bData.changePercent;
              break;
            case 'volume':
              if (!aData || !bData || typeof aData.volume !== 'number' || typeof bData.volume !== 'number') {
                return 0;
              }
              comparison = aData.volume - bData.volume;
              break;
            default:
              comparison = (a.symbol || '').localeCompare(b.symbol || '');
          }
        } catch (sortError) {
          console.warn('[LivePriceFeeds] Error in sort comparison:', sortError);
          return 0;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      }).slice(0, displayLimit);

    } catch (sortingError) {
      console.error('[LivePriceFeeds] Error in sorting products:', sortingError);
      return filteredProducts.slice(0, displayLimit);
    }
  }, [filteredProducts, marketDataMap, sortBy, sortOrder, displayLimit]);

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
      marketData.subscribeToSymbols(unsubscribedProducts.map(p => p.symbol));
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
              onClick={showAllProducts ? handleSubscribeToMajorPairs : handleSubscribeToAllProducts}
              disabled={marketData.isConnecting}
              className="flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${marketData.isConnecting ? 'animate-spin' : ''}`} />
              {showAllProducts ? 'Major Pairs Only' : 'All Products'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSubscribeToMore}
              disabled={marketData.isConnecting}
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

        {/* Error Display */}
        {marketData.error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
                <div className="mt-1 text-sm text-red-700">
                  {marketData.error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="mt-2 p-2 bg-gray-50 rounded-md">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  marketData.isConnected ? 'bg-green-500' :
                  marketData.isConnecting ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span className={`font-medium ${
                  marketData.isConnected ? 'text-green-700' :
                  marketData.isConnecting ? 'text-yellow-700' : 'text-red-700'
                }`}>
                  {marketData.isConnected ? 'Connected' :
                   marketData.isConnecting ? 'Connecting...' : 'Disconnected'}
                </span>
              </div>
              {marketData.isAuthenticated && (
                <span className="text-green-600 text-xs">✓ Authenticated</span>
              )}
            </div>
            <div className="text-gray-500">
              {marketData.lastUpdate && (
                <span>Updated: {marketData.lastUpdate.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* WebSocket Statistics */}
        <div className="flex items-center justify-between text-sm text-gray-500 mt-2 pt-2 border-t">
          <div className="flex items-center space-x-4">
            <span>Products: {marketData.totalProducts || 0}</span>
            <span>Active: {marketData.activeProducts || 0}</span>
            <span>Subscribed: {marketData.subscribedSymbols?.length || 0}</span>
            <span>Live Data: {marketData.connectedSymbols || 0}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>Status: {marketData.connectionStatus || 'unknown'}</span>
            <span>Filtered: {sortedProducts.length}</span>
          </div>
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
                          ${isClient ? (data?.price ?? 0).toLocaleString() : safeToFixed(data?.price, 2)}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">24h Change</span>
                        <div className={`text-lg font-semibold ${
                          (data?.changePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {(data?.changePercent ?? 0) >= 0 ? '+' : ''}
                          {safeToFixed(data?.changePercent, 2)}%
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">24h Volume</span>
                        <div className="text-lg font-semibold">
                          {(data?.volume ?? 0) > 1000000
                            ? `${safeToFixed((data?.volume ?? 0) / 1000000, 2)}M`
                            : `${safeToFixed((data?.volume ?? 0) / 1000, 2)}K`
                          }
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-sm text-gray-500">Bid/Ask</span>
                        <div className="text-lg font-semibold">
                          ${safeToFixed(data?.bid, 2)} / ${safeToFixed(data?.ask, 2)}
                        </div>
                      </div>

                      {data?.openInterest && (
                        <div className="space-y-1">
                          <span className="text-sm text-gray-500">Open Interest</span>
                          <div className="text-lg font-semibold">
                            {(data.openInterest ?? 0) > 1000000
                              ? `${safeToFixed((data.openInterest ?? 0) / 1000000, 2)}M`
                              : `${safeToFixed((data.openInterest ?? 0) / 1000, 2)}K`
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
