"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createDeltaWebSocketClient } from "../lib/delta-websocket-client"
import { createDeltaWebSocketAPI, RealtimeTickerData } from "../lib/delta-websocket-api"
import { createDeltaExchangeAPIFromEnv } from "../lib/delta-exchange"

interface EnhancedRealtimePrice {
  symbol: string
  price: string
  change: string
  changePercent: string
  volume: string
  high: string
  low: string
  markPrice?: string
  spotPrice?: string
  timestamp: number
}

interface ConnectionStatus {
  connected: boolean
  authenticated: boolean
  reconnectAttempts: number
  lastHeartbeat: number
  error?: string
}

export function useEnhancedRealtimeMarket(symbols: string[] = []) {
  const [prices, setPrices] = useState<Map<string, EnhancedRealtimePrice>>(new Map())
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    authenticated: false,
    reconnectAttempts: 0,
    lastHeartbeat: 0,
  })
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
        console.log('[useEnhancedRealtimeMarket] Connected to WebSocket')
        setConnectionStatus(prev => ({ ...prev, connected: true, error: undefined }))
      })

      wsAPIRef.current.on('disconnected', (data: any) => {
        console.log('[useEnhancedRealtimeMarket] Disconnected from WebSocket:', data)
        setConnectionStatus(prev => ({ 
          ...prev, 
          connected: false, 
          authenticated: false,
          error: data.reason 
        }))
      })

      wsAPIRef.current.on('authenticated', () => {
        console.log('[useEnhancedRealtimeMarket] Authenticated')
        setConnectionStatus(prev => ({ ...prev, authenticated: true }))
      })

      wsAPIRef.current.on('error', (error: Error) => {
        console.error('[useEnhancedRealtimeMarket] WebSocket error:', error)
        setConnectionStatus(prev => ({ ...prev, error: error.message }))
      })

      wsAPIRef.current.on('reconnecting', (data: any) => {
        console.log('[useEnhancedRealtimeMarket] Reconnecting:', data)
        setConnectionStatus(prev => ({ 
          ...prev, 
          reconnectAttempts: data.attempt,
          connected: false,
          authenticated: false 
        }))
      })

      wsAPIRef.current.on('ticker', (tickerData: RealtimeTickerData) => {
        handleTickerUpdate(tickerData)
      })
    }

    return () => {
      if (wsAPIRef.current) {
        wsAPIRef.current.disconnect()
        wsAPIRef.current = null
      }
    }
  }, [])

  const handleTickerUpdate = useCallback((tickerData: RealtimeTickerData) => {
    const changeNum = parseFloat(tickerData.change || '0')
    const priceNum = parseFloat(tickerData.price || '0')
    
    const priceUpdate: EnhancedRealtimePrice = {
      symbol: tickerData.symbol,
      price: formatPrice(priceNum),
      change: changeNum >= 0 ? `+${changeNum.toFixed(2)}` : changeNum.toFixed(2),
      changePercent: tickerData.changePercent 
        ? (parseFloat(tickerData.changePercent) >= 0 
            ? `+${parseFloat(tickerData.changePercent).toFixed(2)}%` 
            : `${parseFloat(tickerData.changePercent).toFixed(2)}%`)
        : '0.00%',
      volume: formatVolume(tickerData.volume || '0'),
      high: tickerData.high || '0',
      low: tickerData.low || '0',
      markPrice: tickerData.markPrice,
      spotPrice: tickerData.spotPrice,
      timestamp: tickerData.timestamp,
    }

    setPrices(prev => new Map(prev.set(tickerData.symbol, priceUpdate)))
    setLastUpdate(Date.now())
  }, [])

  // Connect and subscribe to symbols
  useEffect(() => {
    if (wsAPIRef.current && symbols.length > 0) {
      const normalizedSymbols = symbols.map(s => s.toUpperCase())
      
      // Connect if not already connected
      if (!connectionStatus.connected) {
        wsAPIRef.current.connect().catch((error: Error) => {
          console.error('[useEnhancedRealtimeMarket] Failed to connect:', error)
        })
      }

      // Subscribe to new symbols
      const newSymbols = normalizedSymbols.filter(symbol => 
        !subscribedSymbolsRef.current.has(symbol)
      )
      
      if (newSymbols.length > 0) {
        wsAPIRef.current.subscribeToTickers(newSymbols)
        newSymbols.forEach(symbol => subscribedSymbolsRef.current.add(symbol))
      }

      // Unsubscribe from symbols no longer needed
      const symbolsToRemove = Array.from(subscribedSymbolsRef.current).filter(symbol =>
        !normalizedSymbols.includes(symbol)
      )
      
      if (symbolsToRemove.length > 0) {
        wsAPIRef.current.unsubscribeFromTickers(symbolsToRemove)
        symbolsToRemove.forEach(symbol => {
          subscribedSymbolsRef.current.delete(symbol)
          setPrices(prev => {
            const newMap = new Map(prev)
            newMap.delete(symbol)
            return newMap
          })
        })
      }
    }
  }, [symbols, connectionStatus.connected])

  const reconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.connect().catch((error: Error) => {
        console.error('[useEnhancedRealtimeMarket] Manual reconnect failed:', error)
      })
    }
  }, [])

  const disconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.disconnect()
    }
  }, [])

  const getPrice = useCallback((symbol: string): EnhancedRealtimePrice | null => {
    return prices.get(symbol.toUpperCase()) || null
  }, [prices])

  const getAllPrices = useCallback((): EnhancedRealtimePrice[] => {
    return Array.from(prices.values())
  }, [prices])

  return {
    prices: getAllPrices(),
    pricesMap: prices,
    connectionStatus,
    lastUpdate,
    getPrice,
    getAllPrices,
    reconnect,
    disconnect,
    // Legacy compatibility
    isConnected: connectionStatus.connected,
    error: connectionStatus.error,
    reconnectAttempts: connectionStatus.reconnectAttempts,
  }
}

// Utility functions
function formatPrice(price: number): string {
  if (price === 0) return '0.00'
  
  if (price < 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 8,
    })
  } else if (price < 100) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })
  } else {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
}

function formatVolume(volume: string): string {
  const num = parseFloat(volume)
  if (num === 0) return '0'
  
  if (num >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B'
  } else if (num >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M'
  } else if (num >= 1e3) {
    return (num / 1e3).toFixed(2) + 'K'
  } else {
    return num.toFixed(2)
  }
}
