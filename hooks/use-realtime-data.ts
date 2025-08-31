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

  // Fetch live market data from Delta Exchange API
  const fetchLiveMarketData = useCallback(async (symbol: string): Promise<MarketData | null> => {
    try {
      const response = await fetch(`/api/market/realtime/${symbol}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data for ${symbol}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        return {
          symbol: result.data.symbol,
          price: result.data.price,
          change: result.data.change,
          changePercent: result.data.changePercent,
          volume: result.data.volume,
          high24h: result.data.high24h,
          low24h: result.data.low24h,
          bid: result.data.bid,
          ask: result.data.ask,
          timestamp: result.data.lastUpdated || Date.now()
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error);
      return null;
    }
  }, []);

  // Fetch live portfolio data from Delta Exchange API
  const fetchLivePortfolioData = useCallback(async (): Promise<PortfolioData | null> => {
    try {
      // Fetch balance and positions in parallel
      const [balanceResponse, positionsResponse] = await Promise.all([
        fetch('/api/portfolio/balance'),
        fetch('/api/portfolio/positions')
      ]);

      if (!balanceResponse.ok || !positionsResponse.ok) {
        throw new Error('Failed to fetch portfolio data');
      }

      const balanceData = await balanceResponse.json();
      const positionsData = await positionsResponse.json();

      if (!balanceData.success || !positionsData.success) {
        throw new Error('API returned error response');
      }

      // Transform Delta Exchange positions to our format
      const positions: Position[] = (positionsData.positions || []).map((pos: any) => ({
        symbol: pos.product?.symbol || 'UNKNOWN',
        size: parseFloat(pos.size || '0'),
        entryPrice: parseFloat(pos.entry_price || '0'),
        currentPrice: parseFloat(pos.mark_price || pos.entry_price || '0'),
        unrealizedPnL: parseFloat(pos.unrealized_pnl || '0'),
        unrealizedPnLPercent: parseFloat(pos.unrealized_pnl_percent || '0'),
        side: pos.size > 0 ? 'long' : 'short',
        timestamp: Date.now()
      }));

      const totalBalance = parseFloat(balanceData.summary?.totalBalance || '0');
      const totalPnL = parseFloat(balanceData.summary?.totalUnrealizedPnL || '0');

      return {
        totalValue: totalBalance,
        totalPnL: totalPnL,
        dailyPnL: totalPnL * 0.3, // Estimate daily P&L (would need historical data for accuracy)
        positions,
        balance: totalBalance,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      return null;
    }
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
        
        // Update market data every 2 seconds with live data
        const marketInterval = setInterval(async () => {
          const newMarketData: Record<string, MarketData> = {};

          // Fetch live data for all symbols
          const marketPromises = SYMBOLS.map(async (symbol) => {
            const data = await fetchLiveMarketData(symbol);
            if (data) {
              newMarketData[symbol] = data;
            }
          });

          await Promise.all(marketPromises);

          // Only update if we have data
          if (Object.keys(newMarketData).length > 0) {
            setState(prev => ({
              ...prev,
              marketData: { ...prev.marketData, ...newMarketData },
              lastUpdate: Date.now()
            }));
          }
        }, 2000);

        // Update portfolio every 10 seconds with live data
        const portfolioInterval = setInterval(async () => {
          const portfolioData = await fetchLivePortfolioData();
          if (portfolioData) {
            setState(prev => ({
              ...prev,
              portfolio: portfolioData,
              lastUpdate: Date.now()
            }));
          }
        }, 10000);

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
  }, [fetchLiveMarketData, fetchLivePortfolioData, generateMockAISignal]);

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
      // Fetch fresh data from live APIs
      const [portfolioData, ...marketDataResults] = await Promise.all([
        fetchLivePortfolioData(),
        ...SYMBOLS.map(symbol => fetchLiveMarketData(symbol))
      ]);

      const newMarketData: Record<string, MarketData> = {};
      marketDataResults.forEach((data, index) => {
        if (data) {
          newMarketData[SYMBOLS[index]] = data;
        }
      });

      setState(prev => ({
        ...prev,
        ...(portfolioData && { portfolio: portfolioData }),
        ...(Object.keys(newMarketData).length > 0 && { marketData: { ...prev.marketData, ...newMarketData } }),
        lastUpdate: Date.now()
      }));
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  }, [fetchLivePortfolioData, fetchLiveMarketData]);

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
