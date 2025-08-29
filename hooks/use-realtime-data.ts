'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high24h: number;
  low24h: number;
  timestamp: number;
  bid?: number;
  ask?: number;
}

export interface PortfolioData {
  totalValue: number;
  totalPnL: number;
  dailyPnL: number;
  positions: Position[];
  balance: number;
  timestamp: number;
}

export interface Position {
  symbol: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  side: 'long' | 'short';
  timestamp: number;
}

export interface AISignal {
  symbol: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
}

export interface SystemHealth {
  apiStatus: 'online' | 'offline' | 'degraded';
  websocketStatus: 'connected' | 'disconnected' | 'reconnecting';
  latency: number;
  errorRate: number;
  uptime: number;
  lastUpdate: number;
}

export interface OrderExecution {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  size: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  latency: number;
  timestamp: number;
}

interface RealtimeDataState {
  marketData: Record<string, MarketData>;
  portfolio: PortfolioData | null;
  aiSignals: AISignal[];
  systemHealth: SystemHealth;
  orderExecutions: OrderExecution[];
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastUpdate: number;
}

const SYMBOLS = ['BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD'];
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
const RECONNECT_INTERVAL = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useRealtimeData() {
  const [state, setState] = useState<RealtimeDataState>({
    marketData: {},
    portfolio: null,
    aiSignals: [],
    systemHealth: {
      apiStatus: 'online',
      websocketStatus: 'disconnected',
      latency: 0,
      errorRate: 0,
      uptime: 0,
      lastUpdate: Date.now()
    },
    orderExecutions: [],
    connectionStatus: 'disconnected',
    lastUpdate: Date.now()
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Mock data generators for demo purposes
  const generateMockMarketData = useCallback((symbol: string): MarketData => {
    const basePrice = {
      'BTC-USD': 45000,
      'ETH-USD': 3000,
      'ADA-USD': 0.5,
      'SOL-USD': 100
    }[symbol] || 1000;

    const change = (Math.random() - 0.5) * basePrice * 0.02;
    const price = basePrice + change;
    
    return {
      symbol,
      price,
      change,
      changePercent: (change / basePrice) * 100,
      volume: Math.random() * 1000000,
      high24h: price * (1 + Math.random() * 0.05),
      low24h: price * (1 - Math.random() * 0.05),
      bid: price - (Math.random() * 10),
      ask: price + (Math.random() * 10),
      timestamp: Date.now()
    };
  }, []);

  const generateMockPortfolio = useCallback((): PortfolioData => {
    const positions: Position[] = SYMBOLS.slice(0, 3).map(symbol => {
      const entryPrice = Math.random() * 1000;
      const currentPrice = entryPrice + (Math.random() - 0.5) * entryPrice * 0.1;
      const size = Math.random() * 10;
      const unrealizedPnL = (currentPrice - entryPrice) * size;
      
      return {
        symbol,
        size,
        entryPrice,
        currentPrice,
        unrealizedPnL,
        unrealizedPnLPercent: (unrealizedPnL / (entryPrice * size)) * 100,
        side: Math.random() > 0.5 ? 'long' : 'short',
        timestamp: Date.now()
      };
    });

    const totalValue = positions.reduce((sum, pos) => sum + pos.currentPrice * pos.size, 10000);
    const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);

    return {
      totalValue,
      totalPnL,
      dailyPnL: totalPnL * 0.3, // Mock daily P&L
      positions,
      balance: 10000,
      timestamp: Date.now()
    };
  }, []);

  const generateMockAISignal = useCallback((): AISignal => {
    const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const signals = ['BUY', 'SELL', 'HOLD'] as const;
    const signal = signals[Math.floor(Math.random() * signals.length)];
    const price = Math.random() * 50000;
    
    return {
      symbol,
      signal,
      confidence: Math.random(),
      reasoning: `Technical analysis suggests ${signal.toLowerCase()} signal based on moving averages and volume indicators.`,
      entryPrice: price,
      stopLoss: price * (signal === 'BUY' ? 0.95 : 1.05),
      takeProfit: price * (signal === 'BUY' ? 1.05 : 0.95),
      timestamp: Date.now()
    };
  }, []);

  // WebSocket connection management
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState(prev => ({ ...prev, connectionStatus: 'connecting' }));

    try {
      // For demo purposes, we'll simulate WebSocket with intervals
      // In production, this would be a real WebSocket connection
      const simulateWebSocket = () => {
        setState(prev => ({ ...prev, connectionStatus: 'connected' }));
        
        // Update market data every second
        const marketInterval = setInterval(() => {
          const newMarketData: Record<string, MarketData> = {};
          SYMBOLS.forEach(symbol => {
            newMarketData[symbol] = generateMockMarketData(symbol);
          });
          
          setState(prev => ({
            ...prev,
            marketData: newMarketData,
            lastUpdate: Date.now()
          }));
        }, 1000);

        // Update portfolio every 5 seconds
        const portfolioInterval = setInterval(() => {
          setState(prev => ({
            ...prev,
            portfolio: generateMockPortfolio(),
            lastUpdate: Date.now()
          }));
        }, 5000);

        // Generate AI signals every 30 seconds
        const aiInterval = setInterval(() => {
          const newSignal = generateMockAISignal();
          setState(prev => ({
            ...prev,
            aiSignals: [newSignal, ...prev.aiSignals.slice(0, 9)], // Keep last 10 signals
            lastUpdate: Date.now()
          }));
        }, 30000);

        // Update system health every 10 seconds
        const healthInterval = setInterval(() => {
          setState(prev => ({
            ...prev,
            systemHealth: {
              ...prev.systemHealth,
              latency: Math.random() * 100,
              errorRate: Math.random() * 0.01,
              uptime: prev.systemHealth.uptime + 10,
              lastUpdate: Date.now()
            },
            lastUpdate: Date.now()
          }));
        }, 10000);

        // Store intervals for cleanup
        return () => {
          clearInterval(marketInterval);
          clearInterval(portfolioInterval);
          clearInterval(aiInterval);
          clearInterval(healthInterval);
        };
      };

      const cleanup = simulateWebSocket();
      
      // Store cleanup function
      wsRef.current = { cleanup } as any;
      
    } catch (error) {
      console.error('WebSocket connection error:', error);
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
      scheduleReconnect();
    }
  }, [generateMockMarketData, generateMockPortfolio, generateMockAISignal]);

  const disconnect = useCallback(() => {
    if (wsRef.current?.cleanup) {
      wsRef.current.cleanup();
    }
    wsRef.current = null;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      return;
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
      connect();
    }, RECONNECT_INTERVAL);
  }, [connect]);

  // Initialize connection
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  // Reset reconnection attempts on successful connection
  useEffect(() => {
    if (state.connectionStatus === 'connected') {
      reconnectAttemptsRef.current = 0;
    }
  }, [state.connectionStatus]);

  // API methods
  const refreshData = useCallback(async () => {
    try {
      // In a real implementation, this would fetch fresh data from APIs
      setState(prev => ({
        ...prev,
        portfolio: generateMockPortfolio(),
        lastUpdate: Date.now()
      }));
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [generateMockPortfolio]);

  const executeOrder = useCallback(async (order: Partial<OrderExecution>) => {
    const newOrder: OrderExecution = {
      orderId: Math.random().toString(36).substr(2, 9),
      symbol: order.symbol || 'BTC-USD',
      side: order.side || 'buy',
      size: order.size || 1,
      price: order.price || 45000,
      status: 'pending',
      latency: Math.random() * 100,
      timestamp: Date.now()
    };

    setState(prev => ({
      ...prev,
      orderExecutions: [newOrder, ...prev.orderExecutions.slice(0, 49)], // Keep last 50 orders
      lastUpdate: Date.now()
    }));

    // Simulate order execution
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        orderExecutions: prev.orderExecutions.map(o => 
          o.orderId === newOrder.orderId 
            ? { ...o, status: Math.random() > 0.1 ? 'filled' : 'rejected' }
            : o
        ),
        lastUpdate: Date.now()
      }));
    }, Math.random() * 3000 + 1000);

    return newOrder;
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    refreshData,
    executeOrder,
    isConnected: state.connectionStatus === 'connected'
  };
}
