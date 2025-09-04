/**
 * Delta Exchange Hybrid Integration Hook
 * Provides unified access to both REST API and WebSocket services
 * Following official Delta Exchange best practices
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DeltaHybridIntegration } from '../lib/delta-hybrid-integration';
import { DeltaHybridOrderManager } from '../lib/delta-hybrid-order-manager';
import { DeltaFallbackManager } from '../lib/delta-fallback-manager';

export interface HybridIntegrationConfig {
  apiKey: string;
  apiSecret: string;
  enableFallback?: boolean;
  enableOrderManager?: boolean;
  autoConnect?: boolean;
}

export interface HybridIntegrationState {
  // Connection status
  isInitialized: boolean;
  isConnecting: boolean;
  websocketConnected: boolean;
  restApiAvailable: boolean;
  
  // Data state
  marketData: Map<string, any>;
  portfolioData: {
    balances: any[];
    positions: any[];
    orders: any[];
    summary: any;
  };
  
  // Error state
  error: string | null;
  fallbackMode: 'none' | 'rest' | 'mock';
  
  // Timestamps
  lastUpdate: number;
  lastHeartbeat: number;
}

export interface OrderOperations {
  placeOrder: (orderData: any) => Promise<any>;
  cancelOrder: (orderId: string) => Promise<any>;
  editOrder: (orderId: string, updates: any) => Promise<any>;
  placeBracketOrder: (orderData: any) => Promise<any>;
  cancelAllOrders: (filters?: any) => Promise<any>;
}

export interface MarketDataOperations {
  subscribeToTickers: (symbols?: string[]) => Promise<boolean>;
  subscribeToOrderBooks: (symbols: string[], level?: 'l1' | 'l2') => Promise<boolean>;
  subscribeToTrades: (symbols?: string[]) => Promise<boolean>;
  getHistoricalCandles: (symbol: string, resolution: string, start?: number, end?: number) => Promise<any>;
  getMarketData: (symbol: string, type: string) => any;
}

export interface AccountOperations {
  getInitialData: () => Promise<any>;
  getTradingPreferences: () => Promise<any>;
  updateTradingPreferences: (preferences: any) => Promise<any>;
  changeMarginMode: (mode: 'cross' | 'isolated') => Promise<any>;
  getTradeHistory: (filters?: any) => Promise<any>;
}

// Main hybrid integration hook
export function useDeltaHybridIntegration(config: HybridIntegrationConfig) {
  const [state, setState] = useState<HybridIntegrationState>({
    isInitialized: false,
    isConnecting: false,
    websocketConnected: false,
    restApiAvailable: false,
    marketData: new Map(),
    portfolioData: {
      balances: [],
      positions: [],
      orders: [],
      summary: {}
    },
    error: null,
    fallbackMode: 'none',
    lastUpdate: 0,
    lastHeartbeat: 0
  });

  const integrationRef = useRef<DeltaHybridIntegration | null>(null);
  const orderManagerRef = useRef<DeltaHybridOrderManager | null>(null);
  const fallbackManagerRef = useRef<DeltaFallbackManager | null>(null);

  // Initialize integration
  const initialize = useCallback(async () => {
    if (state.isConnecting || state.isInitialized) return;

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Create main integration
      integrationRef.current = new DeltaHybridIntegration(config.apiKey, config.apiSecret);
      
      // Create order manager if enabled
      if (config.enableOrderManager) {
        orderManagerRef.current = new DeltaHybridOrderManager(config.apiKey, config.apiSecret);
      }

      // Create fallback manager if enabled
      if (config.enableFallback) {
        fallbackManagerRef.current = new DeltaFallbackManager(config.apiKey, config.apiSecret);
        
        // Setup fallback event handlers
        fallbackManagerRef.current.on('dataUpdate', (data) => {
          setState(prev => ({
            ...prev,
            marketData: data.marketData,
            portfolioData: data.portfolioData,
            lastUpdate: data.lastUpdate,
            fallbackMode: data.source === 'websocket' ? 'none' : data.source as any
          }));
        });

        fallbackManagerRef.current.on('fallbackActivated', (mode) => {
          setState(prev => ({ ...prev, fallbackMode: mode as any }));
        });

        fallbackManagerRef.current.on('connectionRestored', () => {
          setState(prev => ({ ...prev, fallbackMode: 'none', websocketConnected: true }));
        });

        // Initialize fallback manager
        await fallbackManagerRef.current.initialize();
      } else {
        // Initialize main integration without fallback
        const result = await integrationRef.current.initialize();
        
        if (result.success) {
          setState(prev => ({
            ...prev,
            portfolioData: {
              balances: result.initialData.balances,
              positions: result.initialData.positions,
              orders: [],
              summary: {}
            },
            websocketConnected: result.websocketConnected,
            restApiAvailable: true
          }));
        } else {
          throw new Error(result.error);
        }
      }

      // Initialize order manager
      if (orderManagerRef.current) {
        await orderManagerRef.current.initialize();
        
        // Setup order event handlers
        orderManagerRef.current.on('orderUpdate', (order) => {
          setState(prev => {
            const updatedOrders = [...prev.portfolioData.orders];
            const existingIndex = updatedOrders.findIndex(o => o.id === order.id);
            
            if (existingIndex >= 0) {
              updatedOrders[existingIndex] = order;
            } else {
              updatedOrders.push(order);
            }
            
            return {
              ...prev,
              portfolioData: {
                ...prev.portfolioData,
                orders: updatedOrders
              },
              lastUpdate: Date.now()
            };
          });
        });
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isConnecting: false,
        restApiAvailable: true
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Initialization failed';
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: errorMessage
      }));
      throw error;
    }
  }, [config.apiKey, config.apiSecret, config.enableOrderManager, config.enableFallback]);

  // Auto-connect on mount
  useEffect(() => {
    if (config.autoConnect !== false) {
      initialize();
    }

    // Cleanup on unmount
    return () => {
      integrationRef.current?.cleanup();
      orderManagerRef.current?.cleanup();
      fallbackManagerRef.current?.cleanup();
    };
  }, [initialize, config.autoConnect]);

  // Order operations
  const orderOperations: OrderOperations = {
    placeOrder: useCallback(async (orderData: any) => {
      if (!orderManagerRef.current) {
        throw new Error('Order manager not initialized');
      }
      return orderManagerRef.current.placeOrder(orderData);
    }, []),

    cancelOrder: useCallback(async (orderId: string) => {
      if (!orderManagerRef.current) {
        throw new Error('Order manager not initialized');
      }
      return orderManagerRef.current.cancelOrder(orderId);
    }, []),

    editOrder: useCallback(async (orderId: string, updates: any) => {
      if (!orderManagerRef.current) {
        throw new Error('Order manager not initialized');
      }
      return orderManagerRef.current.editOrder(orderId, updates);
    }, []),

    placeBracketOrder: useCallback(async (orderData: any) => {
      if (!orderManagerRef.current) {
        throw new Error('Order manager not initialized');
      }
      return orderManagerRef.current.placeBracketOrder(orderData);
    }, []),

    cancelAllOrders: useCallback(async (filters?: any) => {
      if (!orderManagerRef.current) {
        throw new Error('Order manager not initialized');
      }
      return orderManagerRef.current.cancelAllOrders(filters);
    }, [])
  };

  // Market data operations
  const marketDataOperations: MarketDataOperations = {
    subscribeToTickers: useCallback(async (symbols: string[] = ['all']) => {
      if (fallbackManagerRef.current) {
        return true; // Handled by fallback manager
      }
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.websocket.subscribeToTickers(symbols);
    }, []),

    subscribeToOrderBooks: useCallback(async (symbols: string[], level: 'l1' | 'l2' = 'l2') => {
      if (fallbackManagerRef.current) {
        return true; // Handled by fallback manager
      }
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.websocket.subscribeToOrderBooks(symbols, level);
    }, []),

    subscribeToTrades: useCallback(async (symbols: string[] = ['all']) => {
      if (fallbackManagerRef.current) {
        return true; // Handled by fallback manager
      }
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.websocket.subscribeToTrades(symbols);
    }, []),

    getHistoricalCandles: useCallback(async (symbol: string, resolution: string, start?: number, end?: number) => {
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.rest.getHistoricalCandles(symbol, resolution, start, end);
    }, []),

    getMarketData: useCallback((symbol: string, type: string) => {
      if (fallbackManagerRef.current) {
        return fallbackManagerRef.current.getMarketData(symbol, type);
      }
      return state.marketData.get(`${symbol}_${type}`);
    }, [state.marketData])
  };

  // Account operations
  const accountOperations: AccountOperations = {
    getInitialData: useCallback(async () => {
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      
      const [products, balances, positions] = await Promise.all([
        integrationRef.current.rest.getProducts(),
        integrationRef.current.rest.getInitialBalances(),
        integrationRef.current.rest.getInitialPositions()
      ]);

      return {
        products: products.result || [],
        balances: balances.result || [],
        positions: positions.result || []
      };
    }, []),

    getTradingPreferences: useCallback(async () => {
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.rest.getTradingPreferences();
    }, []),

    updateTradingPreferences: useCallback(async (preferences: any) => {
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.rest.updateTradingPreferences(preferences);
    }, []),

    changeMarginMode: useCallback(async (mode: 'cross' | 'isolated') => {
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.rest.changeMarginMode(mode);
    }, []),

    getTradeHistory: useCallback(async (filters?: any) => {
      if (!integrationRef.current) {
        throw new Error('Integration not initialized');
      }
      return integrationRef.current.rest.getTradeHistory(filters);
    }, [])
  };

  // Connection control
  const connect = useCallback(() => initialize(), [initialize]);
  
  const disconnect = useCallback(() => {
    integrationRef.current?.cleanup();
    orderManagerRef.current?.cleanup();
    fallbackManagerRef.current?.cleanup();
    
    setState(prev => ({
      ...prev,
      isInitialized: false,
      websocketConnected: false,
      restApiAvailable: false,
      fallbackMode: 'none'
    }));
  }, []);

  const reconnect = useCallback(async () => {
    disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return initialize();
  }, [disconnect, initialize]);

  return {
    // State
    ...state,
    
    // Operations
    orders: orderOperations,
    marketData: marketDataOperations,
    account: accountOperations,
    
    // Connection control
    connect,
    disconnect,
    reconnect,
    
    // Utilities
    isOrderManagerEnabled: !!orderManagerRef.current,
    isFallbackEnabled: !!fallbackManagerRef.current,
    getConnectionHealth: () => fallbackManagerRef.current?.getConnectionHealth(),
    getCurrentData: () => fallbackManagerRef.current?.getCurrentData()
  };
}

// Simplified hooks for specific use cases
export function useDeltaOrders(apiKey: string, apiSecret: string) {
  return useDeltaHybridIntegration({
    apiKey,
    apiSecret,
    enableOrderManager: true,
    enableFallback: true,
    autoConnect: true
  });
}

export function useDeltaMarketData(apiKey?: string, apiSecret?: string) {
  return useDeltaHybridIntegration({
    apiKey: apiKey || '',
    apiSecret: apiSecret || '',
    enableOrderManager: false,
    enableFallback: true,
    autoConnect: true
  });
}

export function useDeltaPortfolio(apiKey: string, apiSecret: string) {
  return useDeltaHybridIntegration({
    apiKey,
    apiSecret,
    enableOrderManager: true,
    enableFallback: true,
    autoConnect: true
  });
}
