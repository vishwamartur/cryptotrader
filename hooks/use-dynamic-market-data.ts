'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { realtimeMarketData, RealtimeMarketData, ProductInfo } from '@/lib/realtime-market-data';

export interface MarketDataState {
  products: ProductInfo[];
  marketData: Map<string, RealtimeMarketData>;
  subscribedSymbols: string[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: number;
}

export interface MarketDataHookReturn extends MarketDataState {
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  subscribeToAll: () => void;
  getMarketData: (symbol: string) => RealtimeMarketData | null;
  getProductsByType: (productType: string) => ProductInfo[];
  refresh: () => Promise<void>;
  connect: () => void;
  disconnect: () => void;
}

export function useDynamicMarketData(): MarketDataHookReturn {
  const [state, setState] = useState<MarketDataState>({
    products: [],
    marketData: new Map(),
    subscribedSymbols: [],
    isConnected: false,
    isLoading: true,
    error: null,
    lastUpdate: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Update state helper
  const updateState = useCallback((updates: Partial<MarketDataState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle products loaded
  const handleProductsLoaded = useCallback((products: ProductInfo[]) => {
    updateState({ 
      products, 
      isLoading: false,
      error: null 
    });
  }, [updateState]);

  // Handle market data updates
  const handleMarketData = useCallback((update: { symbol: string; data: RealtimeMarketData; previous?: RealtimeMarketData }) => {
    setState(prev => {
      const newMarketData = new Map(prev.marketData);
      newMarketData.set(update.symbol, update.data);
      
      return {
        ...prev,
        marketData: newMarketData,
        lastUpdate: update.data.timestamp,
        error: null,
      };
    });
  }, []);

  // Handle connection status changes
  const handleConnected = useCallback(() => {
    updateState({ isConnected: true, error: null });
  }, [updateState]);

  const handleDisconnected = useCallback(() => {
    updateState({ isConnected: false });
  }, [updateState]);

  // Handle subscription changes
  const handleSubscribed = useCallback((symbols: string[]) => {
    setState(prev => ({
      ...prev,
      subscribedSymbols: Array.from(new Set([...prev.subscribedSymbols, ...symbols])),
    }));
  }, []);

  const handleUnsubscribed = useCallback((symbols: string[]) => {
    setState(prev => {
      const newSubscribed = prev.subscribedSymbols.filter(s => !symbols.includes(s));
      const newMarketData = new Map(prev.marketData);
      symbols.forEach(symbol => newMarketData.delete(symbol));
      
      return {
        ...prev,
        subscribedSymbols: newSubscribed,
        marketData: newMarketData,
      };
    });
  }, []);

  // Handle errors
  const handleError = useCallback((error: any) => {
    updateState({ 
      error: error?.message || 'Unknown error occurred',
      isLoading: false 
    });
  }, [updateState]);

  // Handle data updates
  const handleDataUpdated = useCallback((timestamp: number) => {
    updateState({ lastUpdate: timestamp });
  }, [updateState]);

  // Setup event listeners
  useEffect(() => {
    const manager = realtimeMarketData;

    // Add event listeners
    manager.on('productsLoaded', handleProductsLoaded);
    manager.on('marketData', handleMarketData);
    manager.on('connected', handleConnected);
    manager.on('disconnected', handleDisconnected);
    manager.on('subscribed', handleSubscribed);
    manager.on('unsubscribed', handleUnsubscribed);
    manager.on('error', handleError);
    manager.on('dataUpdated', handleDataUpdated);

    // Initialize state from manager
    const products = manager.getProducts();
    const connectionInfo = manager.getConnectionInfo();
    
    setState(prev => ({
      ...prev,
      products,
      subscribedSymbols: connectionInfo.subscribedSymbols,
      isConnected: connectionInfo.connected,
      marketData: manager.getAllMarketData(),
      lastUpdate: connectionInfo.lastUpdateTime,
      isLoading: products.length === 0,
    }));

    // Load products if not already loaded
    if (products.length === 0) {
      manager.loadProducts();
    }

    // Cleanup event listeners
    return () => {
      manager.off('productsLoaded', handleProductsLoaded);
      manager.off('marketData', handleMarketData);
      manager.off('connected', handleConnected);
      manager.off('disconnected', handleDisconnected);
      manager.off('subscribed', handleSubscribed);
      manager.off('unsubscribed', handleUnsubscribed);
      manager.off('error', handleError);
      manager.off('dataUpdated', handleDataUpdated);
    };
  }, [
    handleProductsLoaded,
    handleMarketData,
    handleConnected,
    handleDisconnected,
    handleSubscribed,
    handleUnsubscribed,
    handleError,
    handleDataUpdated,
  ]);

  // API methods
  const subscribe = useCallback((symbols: string[]) => {
    realtimeMarketData.subscribe(symbols);
  }, []);

  const unsubscribe = useCallback((symbols: string[]) => {
    realtimeMarketData.unsubscribe(symbols);
  }, []);

  const subscribeToAll = useCallback(() => {
    realtimeMarketData.subscribeToAll();
  }, []);

  const getMarketData = useCallback((symbol: string) => {
    return realtimeMarketData.getMarketData(symbol);
  }, []);

  const getProductsByType = useCallback((productType: string) => {
    return realtimeMarketData.getProductsByType(productType);
  }, []);

  const refresh = useCallback(async () => {
    updateState({ isLoading: true, error: null });
    try {
      await realtimeMarketData.refresh();
    } catch (error) {
      handleError(error);
    }
  }, [updateState, handleError]);

  const connect = useCallback(() => {
    realtimeMarketData.connect();
  }, []);

  const disconnect = useCallback(() => {
    realtimeMarketData.disconnect();
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
    subscribeToAll,
    getMarketData,
    getProductsByType,
    refresh,
    connect,
    disconnect,
  };
}

// Hook for specific symbols
export function useMarketDataForSymbols(symbols: string[]) {
  const marketData = useDynamicMarketData();
  
  useEffect(() => {
    if (symbols.length > 0) {
      marketData.subscribe(symbols);
    }
    
    return () => {
      if (symbols.length > 0) {
        marketData.unsubscribe(symbols);
      }
    };
  }, [symbols.join(','), marketData]);

  const symbolData = symbols.reduce((acc, symbol) => {
    const data = marketData.getMarketData(symbol);
    if (data) {
      acc[symbol] = data;
    }
    return acc;
  }, {} as Record<string, RealtimeMarketData>);

  return {
    data: symbolData,
    isLoading: marketData.isLoading,
    error: marketData.error,
    isConnected: marketData.isConnected,
    lastUpdate: marketData.lastUpdate,
  };
}

// Hook for products by type
export function useProductsByType(productType: string) {
  const marketData = useDynamicMarketData();
  
  const products = marketData.getProductsByType(productType);
  
  return {
    products,
    isLoading: marketData.isLoading,
    error: marketData.error,
  };
}
