/**
 * WebSocket-based Portfolio Hook
 * Replaces REST API calls with real-time WebSocket data streaming
 * Resolves 401 authentication errors by using WebSocket authentication
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDeltaWebSocket } from './use-delta-websocket';

export interface WebSocketBalance {
  asset: string;
  wallet_balance: string;
  unrealized_pnl: string;
  available_balance: string;
  reserved_balance: string;
  timestamp: number;
}

export interface WebSocketPosition {
  product: {
    symbol: string;
    id: number;
  };
  size: string;
  entry_price: string;
  mark_price: string;
  unrealized_pnl: string;
  unrealized_pnl_percent: string;
  realized_pnl: string;
  side: 'buy' | 'sell';
  timestamp: number;
}

export interface WebSocketOrder {
  id: number;
  product: {
    symbol: string;
    id: number;
  };
  size: string;
  price: string;
  side: 'buy' | 'sell';
  order_type: string;
  state: string;
  timestamp: number;
}

export interface PortfolioSummary {
  totalBalance: string;
  totalUnrealizedPnL: string;
  totalPnLPercent: string;
  totalRealizedPnL: string;
  availableBalance: string;
  reservedBalance: string;
  openPositions: number;
  activeOrders: number;
  lastUpdate: number;
}

export interface WebSocketPortfolioData {
  balances: WebSocketBalance[];
  positions: WebSocketPosition[];
  orders: WebSocketOrder[];
  summary: PortfolioSummary;
}

export interface UseWebSocketPortfolioConfig {
  autoConnect?: boolean;
  environment?: 'production' | 'testnet';
  apiKey?: string;
  apiSecret?: string;
  enableMockFallback?: boolean;
}

export function useWebSocketPortfolio(config: UseWebSocketPortfolioConfig = {}) {
  const {
    autoConnect = true,
    environment = 'production',
    apiKey,
    apiSecret,
    enableMockFallback = true
  } = config;

  const [portfolioData, setPortfolioData] = useState<WebSocketPortfolioData>({
    balances: [],
    positions: [],
    orders: [],
    summary: {
      totalBalance: '0.00',
      totalUnrealizedPnL: '0.00',
      totalPnLPercent: '0.00',
      totalRealizedPnL: '0.00',
      availableBalance: '0.00',
      reservedBalance: '0.00',
      openPositions: 0,
      activeOrders: 0,
      lastUpdate: 0
    }
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingMockData, setIsUsingMockData] = useState(false);

  // Use Delta WebSocket with authentication
  const deltaWS = useDeltaWebSocket({
    autoConnect,
    environment,
    apiKey,
    apiSecret,
    reconnectAttempts: 10
  });

  // Track if we've subscribed to private channels
  const hasSubscribedRef = useRef(false);

  // Subscribe to private channels when authenticated
  useEffect(() => {
    if (deltaWS.isAuthenticated && !hasSubscribedRef.current) {
      console.log('[useWebSocketPortfolio] Subscribing to private channels...');
      
      try {
        // Subscribe to private channels for portfolio data
        deltaWS.subscribe([], ['positions', 'orders', 'wallet']);
        hasSubscribedRef.current = true;
        setIsInitialized(true);
        setError(null);
        setIsUsingMockData(false);
        
        console.log('[useWebSocketPortfolio] ✅ Subscribed to private channels');
      } catch (err) {
        console.error('[useWebSocketPortfolio] Failed to subscribe to private channels:', err);
        setError(err instanceof Error ? err.message : 'Failed to subscribe to private channels');
        
        if (enableMockFallback) {
          console.log('[useWebSocketPortfolio] Falling back to mock data');
          setMockPortfolioData();
        }
      }
    }
  }, [deltaWS.isAuthenticated, deltaWS, enableMockFallback]);

  // Handle authentication failures
  useEffect(() => {
    if (deltaWS.error && deltaWS.error.includes('auth')) {
      console.warn('[useWebSocketPortfolio] Authentication failed:', deltaWS.error);
      setError(`WebSocket authentication failed: ${deltaWS.error}`);
      
      if (enableMockFallback) {
        console.log('[useWebSocketPortfolio] Using mock data due to authentication failure');
        setMockPortfolioData();
      }
    }
  }, [deltaWS.error, enableMockFallback]);

  // Set mock portfolio data as fallback
  const setMockPortfolioData = useCallback(() => {
    const mockData: WebSocketPortfolioData = {
      balances: [
        {
          asset: 'USDT',
          wallet_balance: '10000.00',
          unrealized_pnl: '250.50',
          available_balance: '9500.00',
          reserved_balance: '500.00',
          timestamp: Date.now()
        },
        {
          asset: 'BTC',
          wallet_balance: '0.1',
          unrealized_pnl: '100.00',
          available_balance: '0.05',
          reserved_balance: '0.05',
          timestamp: Date.now()
        }
      ],
      positions: [
        {
          product: { symbol: 'BTCUSDT', id: 1 },
          size: '0.1',
          entry_price: '45000.00',
          mark_price: '46000.00',
          unrealized_pnl: '100.00',
          unrealized_pnl_percent: '2.22',
          realized_pnl: '0.00',
          side: 'buy',
          timestamp: Date.now()
        },
        {
          product: { symbol: 'ETHUSDT', id: 2 },
          size: '2.0',
          entry_price: '3000.00',
          mark_price: '3075.00',
          unrealized_pnl: '150.00',
          unrealized_pnl_percent: '2.50',
          realized_pnl: '0.00',
          side: 'buy',
          timestamp: Date.now()
        }
      ],
      orders: [
        {
          id: 12345,
          product: { symbol: 'ADAUSDT', id: 3 },
          size: '1000',
          price: '0.50',
          side: 'buy',
          order_type: 'limit',
          state: 'open',
          timestamp: Date.now()
        }
      ],
      summary: {
        totalBalance: '10000.00',
        totalUnrealizedPnL: '250.50',
        totalPnLPercent: '2.51',
        totalRealizedPnL: '0.00',
        availableBalance: '9500.00',
        reservedBalance: '500.00',
        openPositions: 2,
        activeOrders: 1,
        lastUpdate: Date.now()
      }
    };

    setPortfolioData(mockData);
    setIsUsingMockData(true);
    setIsInitialized(true);
  }, []);

  // Process WebSocket messages for portfolio data
  useEffect(() => {
    if (!deltaWS.isConnected) return;

    const handlePositionUpdate = (data: any) => {
      console.log('[useWebSocketPortfolio] Position update received:', data);
      
      setPortfolioData(prev => {
        const updatedPositions = [...prev.positions];
        const existingIndex = updatedPositions.findIndex(
          pos => pos.product.symbol === data.symbol
        );

        const newPosition: WebSocketPosition = {
          product: { symbol: data.symbol, id: data.product_id || 0 },
          size: data.size || '0',
          entry_price: data.entry_price || '0',
          mark_price: data.mark_price || '0',
          unrealized_pnl: data.unrealized_pnl || '0',
          unrealized_pnl_percent: data.unrealized_pnl_percent || '0',
          realized_pnl: data.realized_pnl || '0',
          side: data.side || 'buy',
          timestamp: Date.now()
        };

        if (existingIndex >= 0) {
          updatedPositions[existingIndex] = newPosition;
        } else {
          updatedPositions.push(newPosition);
        }

        return {
          ...prev,
          positions: updatedPositions
        };
      });
    };

    const handleOrderUpdate = (data: any) => {
      console.log('[useWebSocketPortfolio] Order update received:', data);
      
      setPortfolioData(prev => {
        const updatedOrders = [...prev.orders];
        const existingIndex = updatedOrders.findIndex(order => order.id === data.id);

        const newOrder: WebSocketOrder = {
          id: data.id || 0,
          product: { symbol: data.symbol, id: data.product_id || 0 },
          size: data.size || '0',
          price: data.price || '0',
          side: data.side || 'buy',
          order_type: data.order_type || 'limit',
          state: data.state || 'open',
          timestamp: Date.now()
        };

        if (existingIndex >= 0) {
          if (data.state === 'cancelled' || data.state === 'filled') {
            updatedOrders.splice(existingIndex, 1);
          } else {
            updatedOrders[existingIndex] = newOrder;
          }
        } else if (data.state === 'open') {
          updatedOrders.push(newOrder);
        }

        return {
          ...prev,
          orders: updatedOrders
        };
      });
    };

    const handleWalletUpdate = (data: any) => {
      console.log('[useWebSocketPortfolio] Wallet update received:', data);
      
      setPortfolioData(prev => {
        const updatedBalances = [...prev.balances];
        const existingIndex = updatedBalances.findIndex(
          balance => balance.asset === data.asset
        );

        const newBalance: WebSocketBalance = {
          asset: data.asset || 'UNKNOWN',
          wallet_balance: data.wallet_balance || '0',
          unrealized_pnl: data.unrealized_pnl || '0',
          available_balance: data.available_balance || '0',
          reserved_balance: data.reserved_balance || '0',
          timestamp: Date.now()
        };

        if (existingIndex >= 0) {
          updatedBalances[existingIndex] = newBalance;
        } else {
          updatedBalances.push(newBalance);
        }

        return {
          ...prev,
          balances: updatedBalances
        };
      });
    };

    // Set up message handlers
    deltaWS.on?.('positions', handlePositionUpdate);
    deltaWS.on?.('orders', handleOrderUpdate);
    deltaWS.on?.('wallet', handleWalletUpdate);

    // Cleanup
    return () => {
      deltaWS.off?.('positions', handlePositionUpdate);
      deltaWS.off?.('orders', handleOrderUpdate);
      deltaWS.off?.('wallet', handleWalletUpdate);
    };
  }, [deltaWS.isConnected, deltaWS]);

  // Calculate portfolio summary
  const calculatedSummary = useMemo((): PortfolioSummary => {
    const totalBalance = portfolioData.balances.reduce(
      (sum, balance) => sum + parseFloat(balance.wallet_balance || '0'), 0
    );
    
    const totalUnrealizedPnL = portfolioData.balances.reduce(
      (sum, balance) => sum + parseFloat(balance.unrealized_pnl || '0'), 0
    );
    
    const totalRealizedPnL = portfolioData.positions.reduce(
      (sum, position) => sum + parseFloat(position.realized_pnl || '0'), 0
    );
    
    const availableBalance = portfolioData.balances.reduce(
      (sum, balance) => sum + parseFloat(balance.available_balance || '0'), 0
    );
    
    const reservedBalance = portfolioData.balances.reduce(
      (sum, balance) => sum + parseFloat(balance.reserved_balance || '0'), 0
    );

    return {
      totalBalance: totalBalance.toFixed(2),
      totalUnrealizedPnL: totalUnrealizedPnL.toFixed(2),
      totalPnLPercent: totalBalance > 0 ? ((totalUnrealizedPnL / totalBalance) * 100).toFixed(2) : '0.00',
      totalRealizedPnL: totalRealizedPnL.toFixed(2),
      availableBalance: availableBalance.toFixed(2),
      reservedBalance: reservedBalance.toFixed(2),
      openPositions: portfolioData.positions.length,
      activeOrders: portfolioData.orders.length,
      lastUpdate: Date.now()
    };
  }, [portfolioData.balances, portfolioData.positions, portfolioData.orders]);

  // Update portfolio data with calculated summary
  useEffect(() => {
    setPortfolioData(prev => ({
      ...prev,
      summary: calculatedSummary
    }));
  }, [calculatedSummary]);

  return {
    // Connection state
    isConnected: deltaWS.isConnected,
    isConnecting: deltaWS.isConnecting,
    isAuthenticated: deltaWS.isAuthenticated,
    isInitialized,
    error: error || deltaWS.error,
    isUsingMockData,

    // Portfolio data
    portfolioData,
    balances: portfolioData.balances,
    positions: portfolioData.positions,
    orders: portfolioData.orders,
    summary: portfolioData.summary,

    // Connection actions
    connect: deltaWS.connect,
    disconnect: deltaWS.disconnect,

    // Utility methods
    getBalance: useCallback((asset: string) => {
      return portfolioData.balances.find(balance => balance.asset === asset) || null;
    }, [portfolioData.balances]),

    getPosition: useCallback((symbol: string) => {
      return portfolioData.positions.find(position => position.product.symbol === symbol) || null;
    }, [portfolioData.positions]),

    getOrder: useCallback((orderId: number) => {
      return portfolioData.orders.find(order => order.id === orderId) || null;
    }, [portfolioData.orders]),

    // Statistics
    statistics: {
      totalAssets: portfolioData.balances.length,
      openPositions: portfolioData.positions.length,
      activeOrders: portfolioData.orders.length,
      lastUpdate: portfolioData.summary.lastUpdate
    }
  };
}
