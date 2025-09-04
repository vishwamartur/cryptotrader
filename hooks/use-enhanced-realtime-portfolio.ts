"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createDeltaWebSocketClient } from "../lib/delta-websocket-client"
import { createDeltaWebSocketAPI, RealtimeBalanceData, RealtimePositionData, RealtimeOrderData } from "../lib/delta-websocket-api"
import { createDeltaExchangeAPIFromEnv } from "../lib/delta-exchange"

interface EnhancedBalanceData {
  assetSymbol: string
  availableBalance: string
  walletBalance: string
  blockedMargin: string
  unrealizedPnl: string
  totalValue: string
  percentageOfPortfolio: string
  timestamp: number
  formattedTime: string
}

interface EnhancedPositionData {
  symbol: string
  productId: number
  size: string
  entryPrice: string
  currentPrice?: string
  margin: string
  liquidationPrice?: string
  bankruptcyPrice?: string
  realizedPnl: string
  unrealizedPnl: string
  unrealizedPnlPercent: string
  side: 'long' | 'short' | 'none'
  timestamp: number
  formattedTime: string
}

interface PortfolioSummary {
  totalBalance: string
  totalUnrealizedPnl: string
  totalRealizedPnl: string
  totalMargin: string
  freeBalance: string
  marginRatio: string
  openPositions: number
  activeOrders: number
  lastUpdate: number
}

export function useEnhancedRealtimePortfolio() {
  const [balances, setBalances] = useState<Map<string, EnhancedBalanceData>>(new Map())
  const [positions, setPositions] = useState<Map<string, EnhancedPositionData>>(new Map())
  const [orders, setOrders] = useState<Map<number, RealtimeOrderData>>(new Map())
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  
  const wsAPIRef = useRef<any>(null)

  // Initialize WebSocket API
  useEffect(() => {
    if (!wsAPIRef.current) {
      const wsClient = createDeltaWebSocketClient()
      const restClient = createDeltaExchangeAPIFromEnv()
      wsAPIRef.current = createDeltaWebSocketAPI(wsClient, restClient)

      // Set up event handlers
      wsAPIRef.current.on('connected', () => {
        console.log('[useEnhancedRealtimePortfolio] Connected to WebSocket')
        setIsConnected(true)
        setError(null)
      })

      wsAPIRef.current.on('disconnected', (data: any) => {
        console.log('[useEnhancedRealtimePortfolio] Disconnected from WebSocket:', data)
        setIsConnected(false)
        setIsAuthenticated(false)
        setError(data.reason || 'Connection lost')
      })

      wsAPIRef.current.on('authenticated', () => {
        console.log('[useEnhancedRealtimePortfolio] Authenticated')
        setIsAuthenticated(true)
        
        // Subscribe to portfolio data after authentication
        subscribeToPortfolioData()
      })

      wsAPIRef.current.on('error', (error: Error) => {
        console.error('[useEnhancedRealtimePortfolio] WebSocket error:', error)
        setError(error.message)
      })

      wsAPIRef.current.on('balance', (balanceData: RealtimeBalanceData) => {
        handleBalanceUpdate(balanceData)
      })

      wsAPIRef.current.on('position', (positionData: RealtimePositionData) => {
        handlePositionUpdate(positionData)
      })

      wsAPIRef.current.on('order', (orderData: RealtimeOrderData) => {
        handleOrderUpdate(orderData)
      })
    }

    return () => {
      if (wsAPIRef.current) {
        wsAPIRef.current.disconnect()
        wsAPIRef.current = null
      }
    }
  }, [])

  const subscribeToPortfolioData = useCallback(() => {
    if (wsAPIRef.current && isAuthenticated) {
      wsAPIRef.current.subscribeToBalances()
      wsAPIRef.current.subscribeToPositions()
      wsAPIRef.current.subscribeToOrders()
    }
  }, [isAuthenticated])

  const handleBalanceUpdate = useCallback((balanceData: RealtimeBalanceData) => {
    const enhancedBalance: EnhancedBalanceData = {
      assetSymbol: balanceData.assetSymbol,
      availableBalance: balanceData.availableBalance,
      walletBalance: balanceData.walletBalance,
      blockedMargin: balanceData.blockedMargin,
      unrealizedPnl: balanceData.unrealizedPnl || '0',
      totalValue: calculateTotalValue(balanceData),
      percentageOfPortfolio: '0', // Will be calculated in portfolio summary
      timestamp: balanceData.timestamp,
      formattedTime: formatTime(balanceData.timestamp),
    }

    setBalances(prev => new Map(prev.set(balanceData.assetSymbol, enhancedBalance)))
    setLastUpdate(Date.now())
    updatePortfolioSummary()
  }, [])

  const handlePositionUpdate = useCallback((positionData: RealtimePositionData) => {
    const positionSize = parseFloat(positionData.size)
    
    if (positionSize === 0) {
      // Position closed
      setPositions(prev => {
        const newMap = new Map(prev)
        newMap.delete(positionData.symbol)
        return newMap
      })
    } else {
      // Position opened or updated
      const enhancedPosition: EnhancedPositionData = {
        symbol: positionData.symbol,
        productId: positionData.productId,
        size: positionData.size,
        entryPrice: positionData.entryPrice,
        margin: positionData.margin,
        liquidationPrice: positionData.liquidationPrice,
        bankruptcyPrice: positionData.bankruptcyPrice,
        realizedPnl: positionData.realizedPnl,
        unrealizedPnl: positionData.unrealizedPnl || '0',
        unrealizedPnlPercent: calculateUnrealizedPnlPercent(positionData),
        side: positionSize > 0 ? 'long' : positionSize < 0 ? 'short' : 'none',
        timestamp: positionData.timestamp,
        formattedTime: formatTime(positionData.timestamp),
      }

      setPositions(prev => new Map(prev.set(positionData.symbol, enhancedPosition)))
    }

    setLastUpdate(Date.now())
    updatePortfolioSummary()
  }, [])

  const handleOrderUpdate = useCallback((orderData: RealtimeOrderData) => {
    if (orderData.state === 'closed' || orderData.state === 'cancelled') {
      // Order closed or cancelled
      setOrders(prev => {
        const newMap = new Map(prev)
        newMap.delete(orderData.orderId)
        return newMap
      })
    } else {
      // Order active
      setOrders(prev => new Map(prev.set(orderData.orderId, orderData)))
    }

    setLastUpdate(Date.now())
    updatePortfolioSummary()
  }, [])

  const updatePortfolioSummary = useCallback(() => {
    const balanceArray = Array.from(balances.values())
    const positionArray = Array.from(positions.values())
    const orderArray = Array.from(orders.values())

    const totalBalance = balanceArray.reduce((sum, balance) => 
      sum + parseFloat(balance.walletBalance), 0
    ).toFixed(8)

    const totalUnrealizedPnl = positionArray.reduce((sum, position) => 
      sum + parseFloat(position.unrealizedPnl), 0
    ).toFixed(8)

    const totalRealizedPnl = positionArray.reduce((sum, position) => 
      sum + parseFloat(position.realizedPnl), 0
    ).toFixed(8)

    const totalMargin = balanceArray.reduce((sum, balance) => 
      sum + parseFloat(balance.blockedMargin), 0
    ).toFixed(8)

    const freeBalance = balanceArray.reduce((sum, balance) => 
      sum + parseFloat(balance.availableBalance), 0
    ).toFixed(8)

    const marginRatio = parseFloat(totalBalance) > 0 
      ? ((parseFloat(totalMargin) / parseFloat(totalBalance)) * 100).toFixed(2)
      : '0'

    // Update percentage of portfolio for each balance
    const totalBalanceNum = parseFloat(totalBalance)
    if (totalBalanceNum > 0) {
      setBalances(prev => {
        const newMap = new Map()
        prev.forEach((balance, key) => {
          const percentage = ((parseFloat(balance.walletBalance) / totalBalanceNum) * 100).toFixed(2)
          newMap.set(key, { ...balance, percentageOfPortfolio: percentage })
        })
        return newMap
      })
    }

    const summary: PortfolioSummary = {
      totalBalance,
      totalUnrealizedPnl,
      totalRealizedPnl,
      totalMargin,
      freeBalance,
      marginRatio,
      openPositions: positionArray.length,
      activeOrders: orderArray.length,
      lastUpdate: Date.now(),
    }

    setPortfolioSummary(summary)
  }, [balances, positions, orders])

  // Connect and authenticate
  useEffect(() => {
    if (wsAPIRef.current && !isConnected) {
      wsAPIRef.current.connect().catch((error: Error) => {
        console.error('[useEnhancedRealtimePortfolio] Failed to connect:', error)
        setError(error.message)
      })
    }
  }, [isConnected])

  const reconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.connect().catch((error: Error) => {
        console.error('[useEnhancedRealtimePortfolio] Manual reconnect failed:', error)
        setError(error.message)
      })
    }
  }, [])

  const disconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.disconnect()
    }
  }, [])

  const getBalance = useCallback((assetSymbol: string): EnhancedBalanceData | null => {
    return balances.get(assetSymbol) || null
  }, [balances])

  const getPosition = useCallback((symbol: string): EnhancedPositionData | null => {
    return positions.get(symbol) || null
  }, [positions])

  const getOrder = useCallback((orderId: number): RealtimeOrderData | null => {
    return orders.get(orderId) || null
  }, [orders])

  const getAllBalances = useCallback((): EnhancedBalanceData[] => {
    return Array.from(balances.values())
  }, [balances])

  const getAllPositions = useCallback((): EnhancedPositionData[] => {
    return Array.from(positions.values())
  }, [positions])

  const getAllOrders = useCallback((): RealtimeOrderData[] => {
    return Array.from(orders.values())
  }, [orders])

  const getPositionsBySymbol = useCallback((symbols: string[]): EnhancedPositionData[] => {
    return symbols.map(symbol => positions.get(symbol)).filter(Boolean) as EnhancedPositionData[]
  }, [positions])

  return {
    balances: getAllBalances(),
    positions: getAllPositions(),
    orders: getAllOrders(),
    portfolioSummary,
    isConnected,
    isAuthenticated,
    error,
    lastUpdate,
    reconnect,
    disconnect,
    getBalance,
    getPosition,
    getOrder,
    getAllBalances,
    getAllPositions,
    getAllOrders,
    getPositionsBySymbol,
    // Legacy compatibility
    balancesMap: balances,
    positionsMap: positions,
    ordersMap: orders,
  }
}

// Utility functions
function calculateTotalValue(balanceData: RealtimeBalanceData): string {
  const walletBalance = parseFloat(balanceData.walletBalance)
  const unrealizedPnl = parseFloat(balanceData.unrealizedPnl || '0')
  return (walletBalance + unrealizedPnl).toFixed(8)
}

function calculateUnrealizedPnlPercent(positionData: RealtimePositionData): string {
  const unrealizedPnl = parseFloat(positionData.unrealizedPnl || '0')
  const margin = parseFloat(positionData.margin)
  
  if (margin === 0) return '0'
  
  return ((unrealizedPnl / margin) * 100).toFixed(2)
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp / 1000) // Convert microseconds to milliseconds
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
