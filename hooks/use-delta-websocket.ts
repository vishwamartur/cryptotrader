/**
 * React Hook for Delta Exchange WebSocket
 * Provides real-time market data from Delta Exchange WebSocket
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DeltaWebSocketClient, DeltaMarketData, DeltaOrderBookData, DeltaTradeData, DeltaWebSocketMessage, DeltaProduct } from '@/lib/delta-websocket';

export interface UseDeltaWebSocketConfig {
  apiKey?: string;
  apiSecret?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  environment?: 'production' | 'testnet';
}

export interface DeltaWebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  error: string | null;
  products: DeltaProduct[];
  marketData: Map<string, DeltaMarketData>;
  orderBooks: Map<string, DeltaOrderBookData>;
  trades: DeltaTradeData[];
  subscriptions: Map<string, string[]>;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  lastUpdate: Date;
  lastHeartbeat: Date;
}

export function useDeltaWebSocket(config: UseDeltaWebSocketConfig = {}) {
  const [state, setState] = useState<DeltaWebSocketState>({
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

  const clientRef = useRef<DeltaWebSocketClient | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStatusRef = useRef<'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting'>('disconnected');

  // Initialize WebSocket client
  useEffect(() => {
    console.log('[useDeltaWebSocket] Initializing WebSocket client');

    // Use provided credentials only - never load from client-side environment variables for security
    const apiKey = config.apiKey || '';
    const apiSecret = config.apiSecret || '';

    if (!apiKey || !apiSecret) {
      console.warn('[useDeltaWebSocket] No API credentials provided, WebSocket will connect without authentication');
      console.warn('[useDeltaWebSocket] For authenticated connections, pass apiKey and apiSecret via config parameter');
    }

    // Set base URL based on environment
    const environment = config.environment || 'production';
    const baseUrl = environment === 'testnet'
      ? 'wss://socket.testnet.deltaex.org'
      : 'wss://socket.india.delta.exchange';

    clientRef.current = new DeltaWebSocketClient({
      apiKey,
      apiSecret,
      baseUrl,
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
          newState.connectionStatus = 'connected';
          newState.error = null;
          newState.lastHeartbeat = new Date();
          connectionStatusRef.current = 'connected';
          break;

        case 'disconnected':
          console.log('[useDeltaWebSocket] 🔌 Disconnected from Delta Exchange WebSocket');
          newState.isConnected = false;
          newState.isConnecting = false;
          newState.isAuthenticated = false;
          newState.connectionStatus = 'disconnected';
          connectionStatusRef.current = 'disconnected';
          break;

        case 'error':
          console.error('[useDeltaWebSocket] ❌ WebSocket error:', message.data.message);
          newState.error = message.data.message;
          newState.isConnecting = false;
          newState.connectionStatus = 'error';
          connectionStatusRef.current = 'error';
          break;

        case 'auth_success':
          console.log('[useDeltaWebSocket] ✅ Authentication successful');
          newState.isAuthenticated = true;
          newState.error = null;
          break;

        case 'auth_error':
          console.error('[useDeltaWebSocket] ❌ Authentication failed:', message.data.message);
          newState.isAuthenticated = false;
          newState.error = `Authentication failed: ${message.data.message}`;
          break;

        case 'products':
          console.log('[useDeltaWebSocket] 📦 Products discovered:', message.data.length);
          newState.products = message.data;
          break;

        case 'subscription_success':
          console.log('[useDeltaWebSocket] ✅ Subscription successful:', message.data.channel, message.data.symbols);
          newState.subscriptions = new Map(prevState.subscriptions);
          newState.subscriptions.set(message.data.channel, message.data.symbols);
          break;

        case 'subscription_error':
          console.error('[useDeltaWebSocket] ❌ Subscription failed:', message.data.error);
          newState.error = `Subscription failed: ${message.data.error}`;
          break;

        case 'ticker':
          // Only log occasionally to avoid spam
          if (Math.random() < 0.01) {
            console.log('[useDeltaWebSocket] 📊 Ticker update:', message.data.symbol);
          }
          newState.marketData = new Map(prevState.marketData);
          newState.marketData.set(message.data.symbol, message.data);
          newState.lastUpdate = new Date();
          break;

        case 'orderbook':
          if (Math.random() < 0.01) {
            console.log('[useDeltaWebSocket] 📋 Order book update:', message.data.symbol);
          }
          newState.orderBooks = new Map(prevState.orderBooks);
          newState.orderBooks.set(message.data.symbol, message.data);
          newState.lastUpdate = new Date();
          break;

        case 'trade':
          if (Math.random() < 0.1) {
            console.log('[useDeltaWebSocket] 💱 Trade update:', message.data.symbol);
          }
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

    setState(prevState => ({
      ...prevState,
      isConnected: false,
      isConnecting: false,
      error: null
    }));
  }, []);

  // Discover all available products
  const discoverProducts = useCallback(async () => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return [];
    }

    try {
      console.log('[useDeltaWebSocket] Discovering products...');
      const products = await clientRef.current.discoverProducts();
      return products;
    } catch (error) {
      console.error('[useDeltaWebSocket] Failed to discover products:', error);
      setState(prevState => ({
        ...prevState,
        error: error instanceof Error ? error.message : 'Failed to discover products'
      }));
      return [];
    }
  }, []);

  // Subscribe to symbols with specific channels
  const subscribe = useCallback((symbols: string[], channels: string[] = ['ticker', 'l2_orderbook']) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Subscribing to symbols:', symbols, 'channels:', channels);

    // Subscribe via WebSocket
    clientRef.current.subscribe(symbols, channels);
  }, []);

  // Subscribe to all available products
  const subscribeToAllProducts = useCallback((channels: string[] = ['ticker']) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Subscribing to all products');
    clientRef.current.subscribeToAllProducts(channels);
  }, []);

  // Subscribe to major currency pairs
  const subscribeToMajorPairs = useCallback((channels: string[] = ['ticker', 'l2_orderbook']) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Subscribing to major pairs');
    clientRef.current.subscribeToMajorPairs(channels);
  }, []);

  // Subscribe to ALL symbols using "all" keyword
  const subscribeToAllSymbols = useCallback((channels: string[] = ['ticker', 'v2/ticker']) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] 🌐 Subscribing to ALL symbols using "all" keyword');
    clientRef.current.subscribeToAllSymbols(channels);
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols: string[], channels: string[] = ['ticker', 'l2_orderbook', 'recent_trade']) => {
    if (!clientRef.current) {
      console.warn('[useDeltaWebSocket] WebSocket client not initialized');
      return;
    }

    console.log('[useDeltaWebSocket] Unsubscribing from symbols:', symbols, 'channels:', channels);

    // Unsubscribe via WebSocket
    clientRef.current.unsubscribe(symbols, channels);
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

  // Get all subscriptions
  const getSubscriptions = useCallback((channel?: string): string[] => {
    if (!clientRef.current) return [];
    return clientRef.current.getSubscriptions(channel);
  }, []);

  // Get products by filter
  const getProductsByFilter = useCallback((filter: (product: DeltaProduct) => boolean): DeltaProduct[] => {
    return state.products.filter(filter);
  }, [state.products]);

  // Get active products
  const getActiveProducts = useCallback((): DeltaProduct[] => {
    return state.products.filter(product =>
      product.state === 'live' && product.trading_status === 'operational'
    );
  }, [state.products]);

  // Get major pairs
  const getMajorPairs = useCallback((): DeltaProduct[] => {
    const majorSymbols = [
      'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT',
      'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT'
    ];
    return state.products.filter(product => majorSymbols.includes(product.symbol));
  }, [state.products]);

  // Computed values using useMemo for performance
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

  return {
    // Connection State
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    isAuthenticated: state.isAuthenticated,
    connectionStatus: state.connectionStatus,
    error: state.error,
    lastUpdate: state.lastUpdate,
    lastHeartbeat: state.lastHeartbeat,

    // Data State
    products: state.products,
    marketData: state.marketData,
    orderBooks: state.orderBooks,
    trades: state.trades,
    subscriptions: state.subscriptions,

    // Connection Actions
    connect,
    disconnect,

    // Product Discovery
    discoverProducts,
    getActiveProducts,
    getMajorPairs,
    getProductsByFilter,

    // Subscription Actions
    subscribe,
    unsubscribe,
    subscribeToAllProducts,
    subscribeToMajorPairs,
    subscribeToAllSymbols,

    // Data Getters
    getMarketData,
    getOrderBook,
    getRecentTrades,
    getConnectionStatus,
    getSubscriptions,

    // Computed Values
    ...computedValues
  };
}
