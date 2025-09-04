/**
 * React Hook for Delta Exchange WebSocket
 * Provides real-time market data from Delta Exchange WebSocket
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { DeltaWebSocketClient, DeltaMarketData, DeltaOrderBookData, DeltaTradeData, DeltaWebSocketMessage } from '@/lib/delta-websocket';

export interface UseDeltaWebSocketConfig {
  apiKey?: string;
  apiSecret?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
}

export interface DeltaWebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  marketData: Map<string, DeltaMarketData>;
  orderBooks: Map<string, DeltaOrderBookData>;
  trades: DeltaTradeData[];
  lastUpdate: Date;
}

export function useDeltaWebSocket(config: UseDeltaWebSocketConfig = {}) {
  const [state, setState] = useState<DeltaWebSocketState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    marketData: new Map(),
    orderBooks: new Map(),
    trades: [],
    lastUpdate: new Date()
  });

  const clientRef = useRef<DeltaWebSocketClient | null>(null);
  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Initialize WebSocket client
  useEffect(() => {
    console.log('[useDeltaWebSocket] Initializing WebSocket client');

    // Get credentials from environment if not provided
    const apiKey = config.apiKey || process.env.NEXT_PUBLIC_DELTA_EXCHANGE_API_KEY || '';
    const apiSecret = config.apiSecret || process.env.NEXT_PUBLIC_DELTA_EXCHANGE_API_SECRET || '';

    if (!apiKey || !apiSecret) {
      console.warn('[useDeltaWebSocket] No API credentials provided, WebSocket will connect without authentication');
    }

    clientRef.current = new DeltaWebSocketClient({
      apiKey,
      apiSecret,
      reconnectAttempts: config.reconnectAttempts || 10
    });

    // Set up message handler
    const unsubscribe = clientRef.current.onMessage(handleMessage);

    // Auto-connect if enabled
    if (config.autoConnect !== false) {
      connect();
    }

    return () => {
      console.log('[useDeltaWebSocket] Cleaning up WebSocket client');
      unsubscribe();
      if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, [config.apiKey, config.apiSecret, config.reconnectAttempts]);

  // Handle WebSocket messages
  const handleMessage = useCallback((message: DeltaWebSocketMessage) => {
    setState(prevState => {
      const newState = { ...prevState };

      switch (message.type) {
        case 'connected':
          console.log('[useDeltaWebSocket] ✅ Connected to Delta Exchange WebSocket');
          newState.isConnected = true;
          newState.isConnecting = false;
          newState.error = null;
          break;

        case 'disconnected':
          console.log('[useDeltaWebSocket] 🔌 Disconnected from Delta Exchange WebSocket');
          newState.isConnected = false;
          newState.isConnecting = false;
          break;

        case 'error':
          console.error('[useDeltaWebSocket] ❌ WebSocket error:', message.data.message);
          newState.error = message.data.message;
          newState.isConnecting = false;
          break;

        case 'ticker':
          console.log('[useDeltaWebSocket] 📊 Ticker update:', message.data.symbol);
          newState.marketData = new Map(prevState.marketData);
          newState.marketData.set(message.data.symbol, message.data);
          newState.lastUpdate = new Date();
          break;

        case 'orderbook':
          console.log('[useDeltaWebSocket] 📋 Order book update:', message.data.symbol);
          newState.orderBooks = new Map(prevState.orderBooks);
          newState.orderBooks.set(message.data.symbol, message.data);
          newState.lastUpdate = new Date();
          break;

        case 'trade':
          console.log('[useDeltaWebSocket] 💱 Trade update:', message.data.symbol);
          newState.trades = [...prevState.trades.slice(-99), message.data]; // Keep last 100 trades
          newState.lastUpdate = new Date();
          break;

        default:
          console.log('[useDeltaWebSocket] Unknown message type:', message);
      }

      return newState;
    });
  }, []);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (!clientRef.current) {
      console.error('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Connecting to Delta Exchange WebSocket...');
    setState(prevState => ({
      ...prevState,
      isConnecting: true,
      error: null
    }));

    try {
      await clientRef.current.connect();
    } catch (error) {
      console.error('[useDeltaWebSocket] Connection failed:', error);
      setState(prevState => ({
        ...prevState,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    }
  }, []);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Disconnecting from Delta Exchange WebSocket...');
    clientRef.current.disconnect();
    subscriptionsRef.current.clear();

    setState(prevState => ({
      ...prevState,
      isConnected: false,
      isConnecting: false,
      error: null
    }));
  }, []);

  // Subscribe to symbols
  const subscribe = useCallback((symbols: string[]) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Subscribing to symbols:', symbols);
    
    // Add to subscriptions
    symbols.forEach(symbol => subscriptionsRef.current.add(symbol));
    
    // Subscribe via WebSocket
    clientRef.current.subscribe(symbols);
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols: string[]) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Unsubscribing from symbols:', symbols);
    
    // Remove from subscriptions
    symbols.forEach(symbol => subscriptionsRef.current.delete(symbol));
    
    // Unsubscribe via WebSocket
    clientRef.current.unsubscribe(symbols);
  }, []);

  // Get market data for a specific symbol
  const getMarketData = useCallback((symbol: string): DeltaMarketData | null => {
    return state.marketData.get(symbol) || null;
  }, [state.marketData]);

  // Get order book for a specific symbol
  const getOrderBook = useCallback((symbol: string): DeltaOrderBookData | null => {
    return state.orderBooks.get(symbol) || null;
  }, [state.orderBooks]);

  // Get recent trades for a specific symbol
  const getRecentTrades = useCallback((symbol?: string): DeltaTradeData[] => {
    if (symbol) {
      return state.trades.filter(trade => trade.symbol === symbol);
    }
    return state.trades;
  }, [state.trades]);

  // Get connection status
  const getConnectionStatus = useCallback(() => {
    if (!clientRef.current) return 'disconnected';
    return clientRef.current.getStatus();
  }, []);

  // Get subscribed symbols
  const getSubscriptions = useCallback((): string[] => {
    return Array.from(subscriptionsRef.current);
  }, []);

  return {
    // State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    error: state.error,
    marketData: state.marketData,
    orderBooks: state.orderBooks,
    trades: state.trades,
    lastUpdate: state.lastUpdate,

    // Actions
    connect,
    disconnect,
    subscribe,
    unsubscribe,

    // Getters
    getMarketData,
    getOrderBook,
    getRecentTrades,
    getConnectionStatus,
    getSubscriptions,

    // Computed
    subscribedSymbols: Array.from(subscriptionsRef.current),
    marketDataArray: Array.from(state.marketData.values()),
    orderBooksArray: Array.from(state.orderBooks.values())
  };
}
