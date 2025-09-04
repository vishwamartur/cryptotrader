"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createDeltaWebSocketClient } from "../lib/delta-websocket-client"
import { createDeltaWebSocketAPI, RealtimeOrderbookData } from "../lib/delta-websocket-api"
import { createDeltaExchangeAPIFromEnv } from "../lib/delta-exchange"

interface OrderbookEntry {
  price: string
  size: string
  total?: string
}

interface EnhancedOrderbook {
  symbol: string
  bids: OrderbookEntry[]
  asks: OrderbookEntry[]
  spread: string
  spreadPercent: string
  midPrice: string
  timestamp: number
  checksum?: string
}

interface OrderbookStats {
  totalBidVolume: string
  totalAskVolume: string
  bidAskRatio: string
  depthLevels: number
}

export function useEnhancedRealtimeOrderbook(symbol: string, maxLevels: number = 20) {
  const [orderbook, setOrderbook] = useState<EnhancedOrderbook | null>(null)
  const [stats, setStats] = useState<OrderbookStats | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<number>(0)
  
  const wsAPIRef = useRef<any>(null)
  const currentSymbolRef = useRef<string>('')

  // Initialize WebSocket API
  useEffect(() => {
    if (!wsAPIRef.current) {
      const wsClient = createDeltaWebSocketClient()
      const restClient = createDeltaExchangeAPIFromEnv()
      wsAPIRef.current = createDeltaWebSocketAPI(wsClient, restClient)

      // Set up event handlers
      wsAPIRef.current.on('connected', () => {
        console.log('[useEnhancedRealtimeOrderbook] Connected to WebSocket')
        setIsConnected(true)
        setError(null)
      })

      wsAPIRef.current.on('disconnected', (data: any) => {
        console.log('[useEnhancedRealtimeOrderbook] Disconnected from WebSocket:', data)
        setIsConnected(false)
        setError(data.reason || 'Connection lost')
      })

      wsAPIRef.current.on('error', (error: Error) => {
        console.error('[useEnhancedRealtimeOrderbook] WebSocket error:', error)
        setError(error.message)
      })

      wsAPIRef.current.on('orderbook', (orderbookData: RealtimeOrderbookData) => {
        if (orderbookData.symbol === currentSymbolRef.current) {
          handleOrderbookUpdate(orderbookData)
        }
      })
    }

    return () => {
      if (wsAPIRef.current) {
        wsAPIRef.current.disconnect()
        wsAPIRef.current = null
      }
    }
  }, [])

  const handleOrderbookUpdate = useCallback((orderbookData: RealtimeOrderbookData) => {
    try {
      // Process and sort orderbook data
      const processedBids = orderbookData.buy
        .map(entry => ({
          price: entry.price,
          size: entry.size,
        }))
        .sort((a, b) => parseFloat(b.price) - parseFloat(a.price))
        .slice(0, maxLevels)

      const processedAsks = orderbookData.sell
        .map(entry => ({
          price: entry.price,
          size: entry.size,
        }))
        .sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
        .slice(0, maxLevels)

      // Calculate running totals
      let bidTotal = 0
      const bidsWithTotals = processedBids.map(bid => {
        bidTotal += parseFloat(bid.size)
        return {
          ...bid,
          total: bidTotal.toFixed(8),
        }
      })

      let askTotal = 0
      const asksWithTotals = processedAsks.map(ask => {
        askTotal += parseFloat(ask.size)
        return {
          ...ask,
          total: askTotal.toFixed(8),
        }
      })

      // Calculate spread and mid price
      const bestBid = processedBids[0]?.price || '0'
      const bestAsk = processedAsks[0]?.price || '0'
      const bestBidNum = parseFloat(bestBid)
      const bestAskNum = parseFloat(bestAsk)
      
      const spread = bestAskNum > 0 && bestBidNum > 0 ? (bestAskNum - bestBidNum).toFixed(8) : '0'
      const spreadPercent = bestBidNum > 0 && bestAskNum > 0 
        ? (((bestAskNum - bestBidNum) / bestBidNum) * 100).toFixed(4) 
        : '0'
      const midPrice = bestBidNum > 0 && bestAskNum > 0 
        ? ((bestBidNum + bestAskNum) / 2).toFixed(8) 
        : '0'

      const enhancedOrderbook: EnhancedOrderbook = {
        symbol: orderbookData.symbol,
        bids: bidsWithTotals,
        asks: asksWithTotals,
        spread,
        spreadPercent,
        midPrice,
        timestamp: orderbookData.timestamp,
        checksum: orderbookData.checksum,
      }

      // Calculate stats
      const totalBidVolume = bidTotal.toFixed(8)
      const totalAskVolume = askTotal.toFixed(8)
      const bidAskRatio = askTotal > 0 ? (bidTotal / askTotal).toFixed(4) : '0'

      const orderbookStats: OrderbookStats = {
        totalBidVolume,
        totalAskVolume,
        bidAskRatio,
        depthLevels: Math.max(processedBids.length, processedAsks.length),
      }

      setOrderbook(enhancedOrderbook)
      setStats(orderbookStats)
      setLastUpdate(Date.now())

    } catch (error) {
      console.error('[useEnhancedRealtimeOrderbook] Error processing orderbook data:', error)
      setError(error instanceof Error ? error.message : 'Failed to process orderbook data')
    }
  }, [maxLevels])

  // Subscribe to orderbook for the given symbol
  useEffect(() => {
    if (wsAPIRef.current && symbol && symbol !== currentSymbolRef.current) {
      // Unsubscribe from previous symbol
      if (currentSymbolRef.current) {
        wsAPIRef.current.unsubscribeFromOrderbook([currentSymbolRef.current])
      }

      // Update current symbol
      currentSymbolRef.current = symbol.toUpperCase()

      // Connect if not already connected
      if (!isConnected) {
        wsAPIRef.current.connect().catch((error: Error) => {
          console.error('[useEnhancedRealtimeOrderbook] Failed to connect:', error)
          setError(error.message)
        })
      }

      // Subscribe to new symbol
      wsAPIRef.current.subscribeToOrderbook([currentSymbolRef.current])
      
      // Clear previous data
      setOrderbook(null)
      setStats(null)
      setLastUpdate(0)
    }
  }, [symbol, isConnected])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsAPIRef.current && currentSymbolRef.current) {
        wsAPIRef.current.unsubscribeFromOrderbook([currentSymbolRef.current])
      }
    }
  }, [])

  const reconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.connect().catch((error: Error) => {
        console.error('[useEnhancedRealtimeOrderbook] Manual reconnect failed:', error)
        setError(error.message)
      })
    }
  }, [])

  const disconnect = useCallback(() => {
    if (wsAPIRef.current) {
      wsAPIRef.current.disconnect()
    }
  }, [])

  const getBestBid = useCallback((): OrderbookEntry | null => {
    return orderbook?.bids[0] || null
  }, [orderbook])

  const getBestAsk = useCallback((): OrderbookEntry | null => {
    return orderbook?.asks[0] || null
  }, [orderbook])

  const getSpread = useCallback((): { absolute: string; percent: string } => {
    return {
      absolute: orderbook?.spread || '0',
      percent: orderbook?.spreadPercent || '0',
    }
  }, [orderbook])

  const getMidPrice = useCallback((): string => {
    return orderbook?.midPrice || '0'
  }, [orderbook])

  const getVolumeAtPrice = useCallback((price: string, side: 'bid' | 'ask'): string => {
    if (!orderbook) return '0'
    
    const entries = side === 'bid' ? orderbook.bids : orderbook.asks
    const entry = entries.find(e => e.price === price)
    return entry?.size || '0'
  }, [orderbook])

  const getTotalVolumeUpToPrice = useCallback((price: string, side: 'bid' | 'ask'): string => {
    if (!orderbook) return '0'
    
    const entries = side === 'bid' ? orderbook.bids : orderbook.asks
    const priceNum = parseFloat(price)
    
    let total = 0
    for (const entry of entries) {
      const entryPrice = parseFloat(entry.price)
      if (side === 'bid' && entryPrice >= priceNum) {
        total += parseFloat(entry.size)
      } else if (side === 'ask' && entryPrice <= priceNum) {
        total += parseFloat(entry.size)
      }
    }
    
    return total.toFixed(8)
  }, [orderbook])

  return {
    orderbook,
    stats,
    isConnected,
    error,
    lastUpdate,
    reconnect,
    disconnect,
    getBestBid,
    getBestAsk,
    getSpread,
    getMidPrice,
    getVolumeAtPrice,
    getTotalVolumeUpToPrice,
    // Legacy compatibility
    symbol: orderbook?.symbol || symbol,
    buy: orderbook?.bids || [],
    sell: orderbook?.asks || [],
    timestamp: orderbook?.timestamp || 0,
  }
}
