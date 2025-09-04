"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createDeltaWebSocketClient } from "../lib/delta-websocket-client"
import { createDeltaWebSocketAPI, RealtimeTradeData } from "../lib/delta-websocket-api"
import { createDeltaExchangeAPIFromEnv } from "../lib/delta-exchange"

interface EnhancedTradeData {
  symbol: string
  price: string
  size: number
  side: 'buy' | 'sell'
  timestamp: number
  tradeId?: string
  buyerRole?: 'maker' | 'taker'
  sellerRole?: 'maker' | 'taker'
  value: string
  formattedTime: string
}

interface UserTradeData {
  fillId: string
  symbol: string
  orderId: number
  side: 'buy' | 'sell'
  size: number
  price: string
  role: 'maker' | 'taker'
  timestamp: number
  reason: string
  value: string
  formattedTime: string
}

interface TradeStats {
  totalVolume: string
  totalTrades: number
  buyVolume: string
  sellVolume: string
  buyTrades: number
  sellTrades: number
  averageTradeSize: string
  lastPrice: string
  priceChange: string
}

export function useEnhancedRealtimeTrades(
  symbols: string[] = [], 
  maxTrades: number = 100,
  includeUserTrades: boolean = false
) {
  const [publicTrades, setPublicTrades] = useState<Map<string, EnhancedTradeData[]>>(new Map())
  const [userTrades, setUserTrades] = useState<UserTradeData[]>([])
  const [tradeStats, setTradeStats] = useState<Map<string, TradeStats>>(new Map())
  const [isConnected, setIsConnected] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  
  const wsAPIRef = useRef<any>(null)
  const subscribedSymbolsRef = useRef<Set<string>>(new Set())

  // Initialize WebSocket API
  useEffect(() => {
    if (!wsAPIRef.current) {
      const wsClient = createDeltaWebSocketClient()
      const restClient = createDeltaExchangeAPIFromEnv()
      wsAPIRef.current = createDeltaWebSocketAPI(wsClient, restClient)

      // Set up event handlers
      wsAPIRef.current.on('connected', () => {
        console.log('[useEnhancedRealtimeTrades] Connected to WebSocket')
        setIsConnected(true)
        setError(null)
      })

      wsAPIRef.current.on('disconnected', (data: any) => {
        console.log('[useEnhancedRealtimeTrades] Disconnected from WebSocket:', data)
        setIsConnected(false)
        setIsAuthenticated(false)
        setError(data.reason || 'Connection lost')
      })

      wsAPIRef.current.on('authenticated', () => {
        console.log('[useEnhancedRealtimeTrades] Authenticated')
        setIsAuthenticated(true)
      })

      wsAPIRef.current.on('error', (error: Error) => {
        console.error('[useEnhancedRealtimeTrades] WebSocket error:', error)
        setError(error.message)
      })

      wsAPIRef.current.on('trade', (tradeData: RealtimeTradeData) => {
        handlePublicTradeUpdate(tradeData)
      })

      wsAPIRef.current.on('userTrade', (userTradeData: any) => {
        if (includeUserTrades) {
          handleUserTradeUpdate(userTradeData)
        }
      })
    }

    return () => {
      if (wsAPIRef.current) {
        wsAPIRef.current.disconnect()
        wsAPIRef.current = null
      }
    }
  }, [includeUserTrades])

  const handlePublicTradeUpdate = useCallback((tradeData: RealtimeTradeData) => {
    const enhancedTrade: EnhancedTradeData = {
      symbol: tradeData.symbol,
      price: tradeData.price,
      size: tradeData.size,
      side: tradeData.side,
      timestamp: tradeData.timestamp,
      tradeId: tradeData.tradeId,
      buyerRole: tradeData.buyerRole,
      sellerRole: tradeData.sellerRole,
      value: (parseFloat(tradeData.price) * tradeData.size).toFixed(8),
      formattedTime: formatTime(tradeData.timestamp),
    }

    setPublicTrades(prev => {
      const newMap = new Map(prev)
      const symbolTrades = newMap.get(tradeData.symbol) || []
      
      // Add new trade and keep only the latest maxTrades
      const updatedTrades = [enhancedTrade, ...symbolTrades].slice(0, maxTrades)
      newMap.set(tradeData.symbol, updatedTrades)
      
      return newMap
    })

    // Update trade statistics
    updateTradeStats(tradeData.symbol, enhancedTrade)
    setLastUpdate(Date.now())
  }, [maxTrades])

  const handleUserTradeUpdate = useCallback((userTradeData: any) => {
    const enhancedUserTrade: UserTradeData = {
      fillId: userTradeData.fillId,
      symbol: userTradeData.symbol,
      orderId: userTradeData.orderId,
      side: userTradeData.side,
      size: userTradeData.size,
      price: userTradeData.price,
      role: userTradeData.role,
      timestamp: userTradeData.timestamp,
      reason: userTradeData.reason,
      value: (parseFloat(userTradeData.price) * userTradeData.size).toFixed(8),
      formattedTime: formatTime(userTradeData.timestamp),
    }

    setUserTrades(prev => [enhancedUserTrade, ...prev].slice(0, maxTrades))
    setLastUpdate(Date.now())
  }, [maxTrades])

  const updateTradeStats = useCallback((symbol: string, trade: EnhancedTradeData) => {
    setTradeStats(prev => {
      const newMap = new Map(prev)
      const currentStats = newMap.get(symbol) || {
        totalVolume: '0',
        totalTrades: 0,
        buyVolume: '0',
        sellVolume: '0',
        buyTrades: 0,
        sellTrades: 0,
        averageTradeSize: '0',
        lastPrice: '0',
        priceChange: '0',
      }

      const tradeValue = parseFloat(trade.value)
      const newTotalVolume = parseFloat(currentStats.totalVolume) + tradeValue
      const newTotalTrades = currentStats.totalTrades + 1

      const updatedStats: TradeStats = {
        totalVolume: newTotalVolume.toFixed(8),
        totalTrades: newTotalTrades,
        buyVolume: trade.side === 'buy' 
          ? (parseFloat(currentStats.buyVolume) + tradeValue).toFixed(8)
          : currentStats.buyVolume,
        sellVolume: trade.side === 'sell' 
          ? (parseFloat(currentStats.sellVolume) + tradeValue).toFixed(8)
          : currentStats.sellVolume,
        buyTrades: trade.side === 'buy' ? currentStats.buyTrades + 1 : currentStats.buyTrades,
        sellTrades: trade.side === 'sell' ? currentStats.sellTrades + 1 : currentStats.sellTrades,
        averageTradeSize: (newTotalVolume / newTotalTrades).toFixed(8),
        lastPrice: trade.price,
        priceChange: calculatePriceChange(currentStats.lastPrice, trade.price),
      }

      newMap.set(symbol, updatedStats)
      return newMap
    })
  }, [])

  // Subscribe to trades for symbols
  useEffect(() => {
    if (wsAPIRef.current && symbols.length > 0) {
      const normalizedSymbols = symbols.map(s => s.toUpperCase())
      
      // Connect if not already connected
      if (!isConnected) {
        wsAPIRef.current.connect().catch((error: Error) => {
          console.error('[useEnhancedRealtimeTrades] Failed to connect:', error)
          setError(error.message)
        })
      }

      // Subscribe to new symbols
      const newSymbols = normalizedSymbols.filter(symbol => 
        !subscribedSymbolsRef.current.has(symbol)
      )
      
      if (newSymbols.length > 0) {
        wsAPIRef.current.subscribeToTrades(newSymbols)
        newSymbols.forEach(symbol => subscribedSymbolsRef.current.add(symbol))
      }

      // Subscribe to user trades if authenticated and requested
      if (includeUserTrades && isAuthenticated) {
        wsAPIRef.current.subscribeToOrders(normalizedSymbols)
      }

      // Unsubscribe from symbols no longer needed
      const symbolsToRemove = Array.from(subscribedSymbolsRef.current).filter(symbol =>
        !normalizedSymbols.includes(symbol)
      )
      
      if (symbolsToRemove.length > 0) {
        wsAPIRef.current.unsubscribeFromTrades(symbolsToRemove)
        symbolsToRemove.forEach(symbol => {
          subscribedSymbolsRef.current.delete(symbol)
          setPublicTrades(prev => {
            const newMap = new Map(prev)
            newMap.delete(symbol)
            return newMap
          })
          setTradeStats(prev => {
            const newMap = new Map(prev)
            newMap.delete(symbol)
            return newMap
          })
        })
      }
    }
  }, [symbols, isConnected, isAuthenticated, includeUserTrades])

  const reconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.connect().catch((error: Error) => {
        console.error('[useEnhancedRealtimeTrades] Manual reconnect failed:', error)
        setError(error.message)
      })
    }
  }, [])

  const disconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.disconnect()
    }
  }, [])

  const getTradesForSymbol = useCallback((symbol: string): EnhancedTradeData[] => {
    return publicTrades.get(symbol.toUpperCase()) || []
  }, [publicTrades])

  const getStatsForSymbol = useCallback((symbol: string): TradeStats | null => {
    return tradeStats.get(symbol.toUpperCase()) || null
  }, [tradeStats])

  const getLatestTradeForSymbol = useCallback((symbol: string): EnhancedTradeData | null => {
    const symbolTrades = publicTrades.get(symbol.toUpperCase())
    return symbolTrades?.[0] || null
  }, [publicTrades])

  const getAllTrades = useCallback((): EnhancedTradeData[] => {
    const allTrades: EnhancedTradeData[] = []
    publicTrades.forEach(trades => allTrades.push(...trades))
    return allTrades.sort((a, b) => b.timestamp - a.timestamp).slice(0, maxTrades)
  }, [publicTrades, maxTrades])

  return {
    publicTrades: Array.from(publicTrades.entries()).reduce((acc, [symbol, trades]) => {
      acc[symbol] = trades
      return acc
    }, {} as Record<string, EnhancedTradeData[]>),
    userTrades,
    tradeStats: Array.from(tradeStats.entries()).reduce((acc, [symbol, stats]) => {
      acc[symbol] = stats
      return acc
    }, {} as Record<string, TradeStats>),
    isConnected,
    isAuthenticated,
    error,
    lastUpdate,
    reconnect,
    disconnect,
    getTradesForSymbol,
    getStatsForSymbol,
    getLatestTradeForSymbol,
    getAllTrades,
  }
}

// Utility functions
function formatTime(timestamp: number): string {
  const date = new Date(timestamp / 1000) // Convert microseconds to milliseconds
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function calculatePriceChange(oldPrice: string, newPrice: string): string {
  const oldPriceNum = parseFloat(oldPrice)
  const newPriceNum = parseFloat(newPrice)
  
  if (oldPriceNum === 0) return '0'
  
  const change = ((newPriceNum - oldPriceNum) / oldPriceNum) * 100
  return change.toFixed(4)
}
