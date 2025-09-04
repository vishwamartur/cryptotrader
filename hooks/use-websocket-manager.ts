/**
 * React Hook for Global WebSocket Connection Manager
 * Provides a singleton WebSocket connection shared across all components
 */

import { useState, useEffect, useCallback } from 'react';
import WebSocketConnectionManager, { WebSocketConnectionState } from '@/lib/websocket-connection-manager';

export interface UseWebSocketManagerConfig {
  autoConnect?: boolean;
  subscribeToChannels?: Array<{ name: string; symbols?: string[] }>;
}

export function useWebSocketManager(config: UseWebSocketManagerConfig = {}) {
  const {
    autoConnect = true,
    subscribeToChannels: channelsToSubscribe = []
  } = config;

  const [state, setState] = useState<WebSocketConnectionState>(() => 
    WebSocketConnectionManager.getInstance().getState()
  );

  // Get the singleton instance
  const manager = WebSocketConnectionManager.getInstance();

  // Connect function
  const connect = useCallback(() => {
    manager.connect();
  }, [manager]);

  // Disconnect function
  const disconnect = useCallback(() => {
    manager.disconnect();
  }, [manager]);

  // Subscribe to channels
  const subscribeToChannelsCallback = useCallback(async (channels: Array<{ name: string; symbols?: string[] }>) => {
    await manager.subscribe(channels);
  }, [manager]);

  // Subscribe to state changes with defensive cleanup
  useEffect(() => {
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState);
    });

    // Return a defensive cleanup function
    return () => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        } else {
          console.warn('[useWebSocketManager] unsubscribe is not a function:', typeof unsubscribe);
        }
      } catch (error) {
        console.error('[useWebSocketManager] Error during cleanup:', error);
      }
    };
  }, [manager]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !state.isConnected && !state.isConnecting) {
      console.log('[useWebSocketManager] Auto-connecting...');
      connect();
    }
  }, [autoConnect, state.isConnected, state.isConnecting, connect]);

  // Subscribe to channels when connected
  useEffect(() => {
    if (state.isConnected && channelsToSubscribe && channelsToSubscribe.length > 0) {
      console.log('[useWebSocketManager] Subscribing to channels:', channelsToSubscribe);
      subscribeToChannelsCallback(channelsToSubscribe);
    }
  }, [state.isConnected, channelsToSubscribe, subscribeToChannelsCallback]);

  return {
    // Connection state
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isAuthenticated: state.isAuthenticated,
    connectionStatus: state.connectionStatus,
    error: state.error,
    lastHeartbeat: state.lastHeartbeat,
    clientCount: state.clientCount,

    // Data
    marketData: state.marketData,
    portfolioData: state.portfolioData,
    orderBooks: state.orderBooks,
    subscriptions: state.subscriptions,
    products: state.products,

    // Actions
    connect,
    disconnect,
    subscribe: subscribeToChannelsCallback,

    // Debug info
    listenerCount: manager.getListenerCount()
  };
}

// Convenience hooks for specific data types
export function useWebSocketPortfolio(config: Omit<UseWebSocketManagerConfig, 'subscribeToChannels'> = {}) {
  const websocket = useWebSocketManager({
    ...config,
    subscribeToChannels: [
      { name: 'positions' },
      { name: 'margins' }
    ]
  });

  // Transform portfolio data to match existing interface
  const portfolioData = websocket.portfolioData || {};
  
  return {
    // Connection state
    isConnected: websocket.isConnected,
    isConnecting: websocket.isConnecting,
    connectionStatus: websocket.connectionStatus,
    error: websocket.error,
    lastHeartbeat: websocket.lastHeartbeat,

    // Portfolio data in expected format
    positions: portfolioData.positions || [],
    summary: {
      totalBalance: portfolioData.totalBalance || '0',
      availableBalance: portfolioData.availableBalance || '0',
      reservedBalance: portfolioData.reservedBalance || '0',
      unrealizedPnl: portfolioData.unrealizedPnl || '0',
      realizedPnl: portfolioData.realizedPnl || '0'
    },
    orders: portfolioData.orders || [],

    // Actions
    connect: websocket.connect,
    disconnect: websocket.disconnect
  };
}

export function useWebSocketMarketData(config: Omit<UseWebSocketManagerConfig, 'subscribeToChannels'> & {
  symbols?: string[];
  subscribeToAllSymbols?: boolean;
} = {}) {
  const {
    symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'],
    subscribeToAllSymbols = false,
    ...restConfig
  } = config;

  const channels = subscribeToAllSymbols 
    ? [{ name: 'v2/ticker' }]
    : [{ name: 'v2/ticker', symbols }];

  const websocket = useWebSocketManager({
    ...restConfig,
    subscribeToChannels: channels
  });

  // Transform market data to match existing interface
  const marketDataArray = websocket.marketData || [];
  
  return {
    // Connection state
    isConnected: websocket.isConnected,
    isConnecting: websocket.isConnecting,
    connectionStatus: websocket.connectionStatus,
    error: websocket.error,
    lastHeartbeat: websocket.lastHeartbeat,

    // Market data in expected format
    marketDataArray,
    marketData: marketDataArray.reduce((acc: any, item: any) => {
      if (item.symbol) {
        acc[item.symbol] = item;
      }
      return acc;
    }, {}),

    // Order books
    orderBooks: websocket.orderBooks,

    // Actions
    connect: websocket.connect,
    disconnect: websocket.disconnect,
    subscribe: websocket.subscribe
  };
}
