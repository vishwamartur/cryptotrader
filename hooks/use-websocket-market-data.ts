/**
 * WebSocket-based Market Data Hook
 * Replaces REST API calls with real-time WebSocket data streaming
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWebSocketMarketData as useWebSocketMarketDataManager } from './use-websocket-manager';
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
  subscribeToAllSymbols?: boolean; // New: Use "all" keyword for efficient subscription
  channels?: string[];
  maxSymbols?: number;
  environment?: 'production' | 'testnet'; // New: Environment selection
}

export function useWebSocketMarketData(config: UseWebSocketMarketDataConfig = {}) {
  const {
    autoConnect = true,
    subscribeToMajorPairs = true,
    subscribeToAllProducts = false,
    subscribeToAllSymbols = false,
    channels = ['ticker'],
    maxSymbols = 100,
    environment = 'production'
  } = config;

  // Use the singleton WebSocket manager
  const manager = useWebSocketMarketDataManager({
    autoConnect,
    subscribeToAllSymbols,
    symbols: subscribeToMajorPairs ? ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'] : undefined
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const error = manager.error;

  // Initialize subscriptions when connected - using new WebSocket manager
  useEffect(() => {
    if (manager.isConnected && !isInitialized) {
      console.log('[useWebSocketMarketData] Initializing subscriptions with WebSocket manager...');

      try {
        // The new manager handles subscriptions automatically based on configuration
        // No need for manual subscription calls as they're handled in the manager
        setIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error('[useWebSocketMarketData] Failed to initialize subscriptions:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize subscriptions');
      }
    }
  }, [manager.isConnected, isInitialized]);

  // Convert WebSocket market data to the expected format
  const marketData = useMemo((): MarketDataItem[] => {
    // Use the marketDataArray from the new WebSocket manager
    return manager.marketDataArray.slice(0, maxSymbols);
  }, [manager.marketDataArray, maxSymbols]);

  // Get market data for a specific symbol
  const getMarketData = useCallback((symbol: string): MarketDataItem | null => {
    // Find the symbol in the marketDataArray from the manager
    const wsData = manager.marketDataArray.find(item => item.symbol === symbol);
    if (!wsData) return null;

    return wsData;
  }, [manager.marketDataArray]);

  // Subscribe to additional symbols
  const subscribeToSymbols = useCallback((symbols: string[], subscriptionChannels?: string[]) => {
    console.log('[useWebSocketMarketData] Subscribing to additional symbols:', symbols);
    // The new manager handles subscriptions automatically
    manager.subscribe([{ name: 'v2/ticker', symbols }]);
  }, [manager, channels]);

  // Subscribe to ALL symbols using "all" keyword
  const subscribeToAllSymbolsMethod = useCallback((subscriptionChannels?: string[]) => {
    console.log('[useWebSocketMarketData] 🌐 Subscribing to ALL symbols using "all" keyword');
    // The new manager handles subscriptions automatically
    manager.subscribe([{ name: 'v2/ticker' }]);
  }, [manager, channels]);

  // Unsubscribe from symbols
  const unsubscribeFromSymbols = useCallback((symbols: string[], subscriptionChannels?: string[]) => {
    console.log('[useWebSocketMarketData] Unsubscribing from symbols:', symbols);
    // The new manager doesn't have unsubscribe functionality yet
    console.warn('[useWebSocketMarketData] Unsubscribe not implemented in new manager');
  }, [manager, channels]);

  // Get products by category
  const getProductsByCategory = useCallback((category: 'spot' | 'futures' | 'perpetual' | 'all' = 'all'): any[] => {
    // The new manager doesn't have products data yet, return empty array
    return [];
  }, []);

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
      lastUpdate: manager.lastHeartbeat
    };
  }, [marketData, manager.lastHeartbeat]);

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
    isConnected: manager.isConnected,
    isConnecting: manager.isConnecting,
    isAuthenticated: manager.isAuthenticated,
    connectionStatus: manager.connectionStatus,
    isInitialized: manager.isConnected,
    error: manager.error,
    isLoading: manager.isConnecting, // Add isLoading for backward compatibility

    // Data - provide both formats for compatibility
    marketData: manager.marketData, // Map format for existing components
    marketDataArray: manager.marketDataArray, // Array format for new components
    products: [],
    orderBooks: manager.orderBooks,
    trades: [],
    lastUpdate: manager.lastHeartbeat,

    // Connection Actions
    connect: manager.connect,
    disconnect: manager.disconnect,
    refresh: manager.connect, // Add refresh method for backward compatibility

    // Subscription Actions
    subscribeToSymbols,
    unsubscribeFromSymbols,
    subscribeToAllProducts: () => console.warn('subscribeToAllProducts not implemented in new manager'),
    subscribeToMajorPairs: () => console.warn('subscribeToMajorPairs not implemented in new manager'),
    subscribeToAllSymbols: subscribeToAllSymbolsMethod, // New: Subscribe to ALL symbols using "all" keyword
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
    subscribedSymbols: [],
    connectedSymbols: [],
    totalProducts: 0,
    activeProducts: 0
  };
}
