/**
 * WebSocket-based Market Data Hook
 * Replaces REST API calls with real-time WebSocket data streaming
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDeltaWebSocket } from './use-delta-websocket';
import { DeltaMarketData, DeltaProduct } from '@/lib/delta-websocket';

export interface MarketDataItem {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  high: string;
  low: string;
  open?: string;
  close?: string;
  turnover?: string;
  lastUpdate: Date;
  product?: DeltaProduct;
}

export interface UseWebSocketMarketDataConfig {
  autoConnect?: boolean;
  subscribeToMajorPairs?: boolean;
  subscribeToAllProducts?: boolean;
  channels?: string[];
  maxSymbols?: number;
}

export function useWebSocketMarketData(config: UseWebSocketMarketDataConfig = {}) {
  const {
    autoConnect = true,
    subscribeToMajorPairs = true,
    subscribeToAllProducts = false,
    channels = ['ticker'],
    maxSymbols = 100
  } = config;

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the Delta WebSocket hook
  const deltaWS = useDeltaWebSocket({
    autoConnect,
    reconnectAttempts: 10
  });

  // Initialize subscriptions when connected and products are available
  useEffect(() => {
    if (deltaWS.isConnected && deltaWS.products.length > 0 && !isInitialized) {
      console.log('[useWebSocketMarketData] Initializing subscriptions...');
      
      try {
        if (subscribeToAllProducts) {
          console.log('[useWebSocketMarketData] Subscribing to all products');
          deltaWS.subscribeToAllProducts(channels);
        } else if (subscribeToMajorPairs) {
          console.log('[useWebSocketMarketData] Subscribing to major pairs');
          deltaWS.subscribeToMajorPairs(channels);
        }
        
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('[useWebSocketMarketData] Failed to initialize subscriptions:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize subscriptions');
      }
    }
  }, [deltaWS.isConnected, deltaWS.products.length, isInitialized, subscribeToAllProducts, subscribeToMajorPairs, channels, deltaWS]);

  // Convert WebSocket market data to the expected format
  const marketData = useMemo((): MarketDataItem[] => {
    const data: MarketDataItem[] = [];
    
    deltaWS.marketData.forEach((wsData: DeltaMarketData, symbol: string) => {
      data.push({
        symbol,
        price: wsData.price.toString(),
        change: wsData.change.toString(),
        changePercent: wsData.changePercent.toString(),
        volume: wsData.volume.toString(),
        high: wsData.high.toString(),
        low: wsData.low.toString(),
        open: wsData.open?.toString(),
        close: wsData.close?.toString(),
        turnover: wsData.turnover?.toString(),
        lastUpdate: new Date(wsData.timestamp),
        product: wsData.product
      });
    });

    // Sort by volume (descending) and limit results
    return data
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, maxSymbols);
  }, [deltaWS.marketData, maxSymbols]);

  // Get market data for a specific symbol
  const getMarketData = useCallback((symbol: string): MarketDataItem | null => {
    const wsData = deltaWS.getMarketData(symbol);
    if (!wsData) return null;

    return {
      symbol,
      price: wsData.price.toString(),
      change: wsData.change.toString(),
      changePercent: wsData.changePercent.toString(),
      volume: wsData.volume.toString(),
      high: wsData.high.toString(),
      low: wsData.low.toString(),
      open: wsData.open?.toString(),
      close: wsData.close?.toString(),
      turnover: wsData.turnover?.toString(),
      lastUpdate: new Date(wsData.timestamp),
      product: wsData.product
    };
  }, [deltaWS]);

  // Subscribe to additional symbols
  const subscribeToSymbols = useCallback((symbols: string[], subscriptionChannels?: string[]) => {
    console.log('[useWebSocketMarketData] Subscribing to additional symbols:', symbols);
    deltaWS.subscribe(symbols, subscriptionChannels || channels);
  }, [deltaWS, channels]);

  // Unsubscribe from symbols
  const unsubscribeFromSymbols = useCallback((symbols: string[], subscriptionChannels?: string[]) => {
    console.log('[useWebSocketMarketData] Unsubscribing from symbols:', symbols);
    deltaWS.unsubscribe(symbols, subscriptionChannels || channels);
  }, [deltaWS, channels]);

  // Get products by category
  const getProductsByCategory = useCallback((category: 'spot' | 'futures' | 'perpetual' | 'all' = 'all'): DeltaProduct[] => {
    if (category === 'all') {
      return deltaWS.products;
    }
    
    return deltaWS.products.filter(product => {
      switch (category) {
        case 'spot':
          return product.contract_type === 'spot';
        case 'futures':
          return product.contract_type === 'futures';
        case 'perpetual':
          return product.contract_type === 'perpetual_futures';
        default:
          return true;
      }
    });
  }, [deltaWS.products]);

  // Get top performers
  const getTopPerformers = useCallback((limit: number = 10): MarketDataItem[] => {
    return marketData
      .filter(item => parseFloat(item.changePercent) > 0)
      .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent))
      .slice(0, limit);
  }, [marketData]);

  // Get top losers
  const getTopLosers = useCallback((limit: number = 10): MarketDataItem[] => {
    return marketData
      .filter(item => parseFloat(item.changePercent) < 0)
      .sort((a, b) => parseFloat(a.changePercent) - parseFloat(b.changePercent))
      .slice(0, limit);
  }, [marketData]);

  // Get top volume
  const getTopVolume = useCallback((limit: number = 10): MarketDataItem[] => {
    return marketData
      .sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume))
      .slice(0, limit);
  }, [marketData]);

  // Search symbols
  const searchSymbols = useCallback((query: string): MarketDataItem[] => {
    const lowerQuery = query.toLowerCase();
    return marketData.filter(item => 
      item.symbol.toLowerCase().includes(lowerQuery) ||
      item.product?.description?.toLowerCase().includes(lowerQuery)
    );
  }, [marketData]);

  // Computed statistics
  const statistics = useMemo(() => {
    const totalSymbols = marketData.length;
    const gainers = marketData.filter(item => parseFloat(item.changePercent) > 0).length;
    const losers = marketData.filter(item => parseFloat(item.changePercent) < 0).length;
    const unchanged = totalSymbols - gainers - losers;
    
    const totalVolume = marketData.reduce((sum, item) => sum + parseFloat(item.volume || '0'), 0);
    const avgChange = totalSymbols > 0 ? 
      marketData.reduce((sum, item) => sum + parseFloat(item.changePercent || '0'), 0) / totalSymbols : 0;

    return {
      totalSymbols,
      gainers,
      losers,
      unchanged,
      totalVolume,
      avgChange,
      lastUpdate: deltaWS.lastUpdate
    };
  }, [marketData, deltaWS.lastUpdate]);

  // Create a Map structure for backward compatibility with existing components
  const marketDataMap = useMemo(() => {
    const dataMap = new Map<string, any>();
    marketData.forEach(item => {
      dataMap.set(item.symbol, {
        symbol: item.symbol,
        price: parseFloat(item.price),
        change: parseFloat(item.change),
        changePercent: parseFloat(item.changePercent),
        volume: parseFloat(item.volume),
        high: parseFloat(item.high),
        low: parseFloat(item.low),
        open: item.open ? parseFloat(item.open) : undefined,
        close: item.close ? parseFloat(item.close) : undefined,
        turnover: item.turnover ? parseFloat(item.turnover) : undefined,
        lastUpdate: item.lastUpdate,
        product: item.product
      });
    });
    return dataMap;
  }, [marketData]);

  return {
    // Connection State
    isConnected: deltaWS.isConnected,
    isConnecting: deltaWS.isConnecting,
    isAuthenticated: deltaWS.isAuthenticated,
    connectionStatus: deltaWS.connectionStatus,
    isInitialized,
    error: error || deltaWS.error,
    isLoading: deltaWS.isConnecting, // Add isLoading for backward compatibility

    // Data - provide both formats for compatibility
    marketData: marketDataMap, // Map format for existing components
    marketDataArray: marketData, // Array format for new components
    products: deltaWS.products,
    orderBooks: deltaWS.orderBooks,
    trades: deltaWS.trades,
    lastUpdate: deltaWS.lastUpdate,

    // Connection Actions
    connect: deltaWS.connect,
    disconnect: deltaWS.disconnect,
    refresh: deltaWS.connect, // Add refresh method for backward compatibility

    // Subscription Actions
    subscribeToSymbols,
    unsubscribeFromSymbols,
    subscribeToAllProducts: deltaWS.subscribeToAllProducts,
    subscribeToMajorPairs: deltaWS.subscribeToMajorPairs,
    subscribe: subscribeToSymbols, // Add subscribe alias for backward compatibility

    // Data Getters
    getMarketData,
    getProductsByCategory,
    getTopPerformers,
    getTopLosers,
    getTopVolume,
    searchSymbols,

    // Computed Values
    statistics,
    subscribedSymbols: deltaWS.subscribedSymbols,
    connectedSymbols: deltaWS.connectedSymbols,
    totalProducts: deltaWS.totalProducts,
    activeProducts: deltaWS.activeProducts
  };
}
