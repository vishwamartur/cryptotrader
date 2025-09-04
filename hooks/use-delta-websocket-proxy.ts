/**
 * Delta Exchange WebSocket Proxy Hook
 * Connects to server-side proxy instead of directly to Delta Exchange
 * Eliminates client-side API credential exposure
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export interface UseDeltaWebSocketProxyConfig {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  environment?: 'production' | 'testnet';
  enableMockFallback?: boolean;
}

export interface DeltaWebSocketProxyState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  error: string | null;
  products: any[];
  marketData: Map<string, any>;
  orderBooks: Map<string, any>;
  trades: any[];
  subscriptions: Map<string, string[]>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastUpdate: Date;
  lastHeartbeat: Date;
}

// Global connection manager to prevent multiple connections
const connectionManager = {
  activeConnection: null as EventSource | null,
  connectionCount: 0,
  maxConnections: 1,

  canCreateConnection(): boolean {
    return this.connectionCount < this.maxConnections && !this.activeConnection;
  },

  registerConnection(eventSource: EventSource): boolean {
    if (!this.canCreateConnection()) {
      console.warn('[Delta Proxy Hook] Connection limit reached, reusing existing connection');
      return false;
    }

    this.activeConnection = eventSource;
    this.connectionCount++;
    console.log('[Delta Proxy Hook] Connection registered, count:', this.connectionCount);
    return true;
  },

  unregisterConnection(eventSource: EventSource): void {
    if (this.activeConnection === eventSource) {
      this.activeConnection = null;
      this.connectionCount = Math.max(0, this.connectionCount - 1);
      console.log('[Delta Proxy Hook] Connection unregistered, count:', this.connectionCount);
    }
  },

  getActiveConnection(): EventSource | null {
    return this.activeConnection;
  }
};

export function useDeltaWebSocketProxy(config: UseDeltaWebSocketProxyConfig = {}) {
  const [state, setState] = useState<DeltaWebSocketProxyState>({
    isConnected: false,
    isConnecting: false,
    isAuthenticated: false,
    error: null,
    products: [],
    marketData: new Map(),
    orderBooks: new Map(),
    trades: [],
    subscriptions: new Map(),
    connectionStatus: 'disconnected',
    lastUpdate: new Date(),
    lastHeartbeat: new Date()
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Proxy endpoint URL
  const proxyUrl = '/api/websocket/delta-stream';

  // Connect to the proxy server
  const connect = useCallback(() => {
    if (state.isConnecting || state.isConnected) {
      console.log('[Delta Proxy Hook] Already connecting or connected');
      return;
    }

    // Check if we can create a new connection
    const existingConnection = connectionManager.getActiveConnection();
    if (existingConnection && existingConnection.readyState === EventSource.OPEN) {
      console.log('[Delta Proxy Hook] Reusing existing connection');
      eventSourceRef.current = existingConnection;
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        connectionStatus: 'connected',
        error: null,
        lastHeartbeat: new Date()
      }));
      return;
    }

    if (!connectionManager.canCreateConnection()) {
      console.warn('[Delta Proxy Hook] Cannot create connection - limit reached');
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: 'Connection limit reached'
      }));
      return;
    }

    console.log('[Delta Proxy Hook] Connecting to proxy server...');
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Create EventSource connection to proxy
      eventSourceRef.current = new EventSource(proxyUrl);

      // Register the connection
      if (!connectionManager.registerConnection(eventSourceRef.current)) {
        console.warn('[Delta Proxy Hook] Failed to register connection');
        eventSourceRef.current.close();
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: 'Failed to register connection'
        }));
        return;
      }

      eventSourceRef.current.onopen = () => {
        console.log('[Delta Proxy Hook] Connected to proxy server');
        setState(prev => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          connectionStatus: 'connected',
          error: null,
          lastHeartbeat: new Date()
        }));
        reconnectAttemptsRef.current = 0;
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleProxyMessage(message);
        } catch (error) {
          console.error('[Delta Proxy Hook] Error parsing message:', error);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('[Delta Proxy Hook] EventSource error:', error);

        // Unregister the connection on error
        if (eventSourceRef.current) {
          connectionManager.unregisterConnection(eventSourceRef.current);
        }

        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
          connectionStatus: 'error',
          error: 'Connection error'
        }));

        // Schedule reconnection
        scheduleReconnection();
      };

    } catch (error) {
      console.error('[Delta Proxy Hook] Failed to create connection:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, [state.isConnecting, state.isConnected, proxyUrl]);

  // Handle messages from proxy
  const handleProxyMessage = useCallback((message: any) => {
    console.log('[Delta Proxy Hook] Received message:', message.type);

    setState(prev => ({ ...prev, lastUpdate: new Date() }));

    switch (message.type) {
      case 'connected':
        console.log('[Delta Proxy Hook] Proxy connection established');
        break;

      case 'auth_success':
        console.log('[Delta Proxy Hook] Authentication successful');
        setState(prev => ({ ...prev, isAuthenticated: true }));
        break;

      case 'auth_error':
      case 'auth_warning':
        console.warn('[Delta Proxy Hook] Authentication issue:', message.data?.message);
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false,
          error: message.data?.message || 'Authentication failed'
        }));
        break;

      case 'ticker':
      case 'v2/ticker':
        if (message.data) {
          setState(prev => {
            const newMarketData = new Map(prev.marketData);
            newMarketData.set(message.data.symbol, {
              ...message.data,
              timestamp: Date.now(),
              lastUpdate: new Date()
            });
            return { ...prev, marketData: newMarketData };
          });
        }
        break;

      case 'l2_orderbook':
      case 'l1_orderbook':
        if (message.data) {
          setState(prev => {
            const newOrderBooks = new Map(prev.orderBooks);
            newOrderBooks.set(message.data.symbol, {
              ...message.data,
              timestamp: Date.now()
            });
            return { ...prev, orderBooks: newOrderBooks };
          });
        }
        break;

      case 'products':
        if (Array.isArray(message.data)) {
          setState(prev => ({ ...prev, products: message.data }));
        }
        break;

      case 'subscription_success':
        console.log('[Delta Proxy Hook] Subscription successful:', message.data);
        if (message.data?.channel && message.data?.symbols) {
          setState(prev => {
            const newSubscriptions = new Map(prev.subscriptions);
            newSubscriptions.set(message.data.channel, message.data.symbols);
            return { ...prev, subscriptions: newSubscriptions };
          });
        }
        break;

      case 'subscription_error':
        console.error('[Delta Proxy Hook] Subscription error:', message.data);
        setState(prev => ({ 
          ...prev, 
          error: message.data?.message || 'Subscription failed' 
        }));
        break;

      case 'connection_closed':
        console.log('[Delta Proxy Hook] Delta connection closed');
        setState(prev => ({ 
          ...prev, 
          isAuthenticated: false,
          error: 'Delta Exchange connection lost'
        }));
        break;

      case 'connection_error':
        console.error('[Delta Proxy Hook] Connection error:', message.data);
        setState(prev => ({ 
          ...prev, 
          error: message.data?.message || 'Connection error'
        }));
        break;

      default:
        console.log('[Delta Proxy Hook] Unhandled message type:', message.type);
    }
  }, []);

  // Schedule reconnection with exponential backoff
  const scheduleReconnection = useCallback(() => {
    if (reconnectAttemptsRef.current >= (config.reconnectAttempts || 10)) {
      console.error('[Delta Proxy Hook] Max reconnection attempts reached');
      setState(prev => ({ 
        ...prev, 
        error: 'Max reconnection attempts reached' 
      }));
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current++;

    console.log(`[Delta Proxy Hook] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [config.reconnectAttempts, connect]);

  // Disconnect from proxy
  const disconnect = useCallback(() => {
    console.log('[Delta Proxy Hook] Disconnecting from proxy...');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      // Unregister the connection before closing
      connectionManager.unregisterConnection(eventSourceRef.current);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isAuthenticated: false,
      connectionStatus: 'disconnected',
      error: null
    }));
  }, []);

  // Send subscription request to proxy
  const sendSubscription = useCallback(async (action: 'subscribe' | 'unsubscribe', channels: any[]) => {
    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          channels
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Subscription failed');
      }

      console.log(`[Delta Proxy Hook] ${action} request sent:`, result);
      return result;

    } catch (error) {
      console.error(`[Delta Proxy Hook] ${action} error:`, error);
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : `${action} failed`
      }));
      throw error;
    }
  }, [proxyUrl]);

  // Subscription methods
  const subscribe = useCallback((channels: any[]) => {
    return sendSubscription('subscribe', channels);
  }, [sendSubscription]);

  const unsubscribe = useCallback((channels: any[]) => {
    return sendSubscription('unsubscribe', channels);
  }, [sendSubscription]);

  const subscribeToAllSymbols = useCallback((channels: string[] = ['ticker', 'v2/ticker']) => {
    console.log('[Delta Proxy Hook] 🌐 Subscribing to ALL symbols via proxy');
    const subscriptionChannels = channels.map(channel => ({
      name: channel,
      symbols: ['all']
    }));
    return subscribe(subscriptionChannels);
  }, [subscribe]);

  const subscribeToAllProducts = useCallback((channels: string[] = ['ticker']) => {
    console.log('[Delta Proxy Hook] Subscribing to all products via proxy');
    const subscriptionChannels = channels.map(channel => ({
      name: channel
    }));
    return subscribe(subscriptionChannels);
  }, [subscribe]);

  const subscribeToMajorPairs = useCallback((channels: string[] = ['ticker', 'l2_orderbook']) => {
    console.log('[Delta Proxy Hook] Subscribing to major pairs via proxy');
    const majorPairs = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT'];
    const subscriptionChannels = channels.map(channel => ({
      name: channel,
      symbols: majorPairs
    }));
    return subscribe(subscriptionChannels);
  }, [subscribe]);

  // Auto-connect on mount
  useEffect(() => {
    if (config.autoConnect !== false) {
      connect();
    }

    // Return a proper cleanup function with defensive programming
    return () => {
      try {
        if (typeof disconnect === 'function') {
          disconnect();
        } else {
          console.warn('[Delta Proxy Hook] disconnect is not a function:', typeof disconnect);
        }
      } catch (error) {
        console.error('[Delta Proxy Hook] Error during cleanup:', error);
      }
    };
  }, [config.autoConnect, connect, disconnect]);

  // Computed values
  const computedValues = useMemo(() => {
    const marketDataArray = Array.from(state.marketData.values());
    const orderBooksArray = Array.from(state.orderBooks.values());
    const allSubscriptions = Array.from(state.subscriptions.values()).flat();

    return {
      marketDataArray,
      orderBooksArray,
      subscribedSymbols: Array.from(new Set(allSubscriptions)),
      totalProducts: state.products.length,
      activeProducts: state.products.filter(p => p.state === 'live').length,
      connectedSymbols: marketDataArray.length,
      lastPriceUpdate: marketDataArray.length > 0 ?
        Math.max(...marketDataArray.map(data => data.timestamp)) : 0
    };
  }, [state.marketData, state.orderBooks, state.subscriptions, state.products]);

  // Cleanup effect with defensive programming
  useEffect(() => {
    // Return a proper cleanup function that handles all edge cases
    return () => {
      try {
        console.log('[Delta Proxy Hook] Component unmounting, cleaning up connection');

        // Clean up EventSource connection
        if (eventSourceRef.current) {
          try {
            connectionManager.unregisterConnection(eventSourceRef.current);
            eventSourceRef.current.close();
          } catch (closeError) {
            console.warn('[Delta Proxy Hook] Error closing EventSource:', closeError);
          } finally {
            eventSourceRef.current = null;
          }
        }

        // Clean up reconnect timeout
        if (reconnectTimeoutRef.current) {
          try {
            clearTimeout(reconnectTimeoutRef.current);
          } catch (timeoutError) {
            console.warn('[Delta Proxy Hook] Error clearing timeout:', timeoutError);
          } finally {
            reconnectTimeoutRef.current = null;
          }
        }
      } catch (error) {
        console.error('[Delta Proxy Hook] Error during component cleanup:', error);
      }
    };
  }, []);

  return {
    // Connection State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isAuthenticated: state.isAuthenticated,
    connectionStatus: state.connectionStatus,
    error: state.error,
    lastUpdate: state.lastUpdate,
    lastHeartbeat: state.lastHeartbeat,

    // Data
    products: state.products,
    marketData: state.marketData,
    orderBooks: state.orderBooks,
    trades: state.trades,
    subscriptions: state.subscriptions,

    // Actions
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    subscribeToAllProducts,
    subscribeToMajorPairs,
    subscribeToAllSymbols,

    // Computed Values
    ...computedValues
  };
}
