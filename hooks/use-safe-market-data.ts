"use client"

import { useState, useEffect, useCallback } from "react"
import { useErrorHandler } from "@/components/error-boundary"

/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Please use `useWebSocketMarketData` from '@/hooks/use-websocket-market-data' instead.
 *
 * The WebSocket-based hook provides:
 * - Real-time data updates via WebSocket connection
 * - Better performance with reduced API calls
 * - Improved error handling and connection management
 * - Built-in health monitoring and retry logic
 *
 * Migration example:
 * ```typescript
 * // Old (deprecated)
 * import { useSafeMarketData } from '@/hooks/use-safe-market-data'
 * const { data, loading, error, refetch } = useSafeMarketData()
 *
 * // New (recommended)
 * import { useWebSocketMarketData } from '@/hooks/use-websocket-market-data'
 * const marketData = useWebSocketMarketData({
 *   autoConnect: true,
 *   subscribeToMajorPairs: true
 * })
 * ```
 */

interface Product {
  id: number
  symbol: string
  description: string
  contract_type?: string
  productType?: string
  underlying_asset?: {
    symbol: string
  }
  quoting_asset?: {
    symbol: string
  }
  state: string
  trading_status: string
}

interface Ticker {
  symbol: string
  close: string
  change: string
  volume: string
  high: string
  low: string
  open: string
  turnover: string
}

interface MarketData {
  symbol: string
  price: string
  change: string
  changePercent: string
  volume: string
  high: string
  low: string
}

interface MarketDataState {
  data: MarketData[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  retryCount: number
  isHealthy: boolean
}

interface MarketDataHookReturn extends MarketDataState {
  refetch: () => Promise<void>
  clearError: () => void
  checkHealth: () => Promise<boolean>
}

/**
 * Enhanced Market Data Hook with Comprehensive Error Handling
 * Integrates with our API health monitoring and provides robust error recovery
 */
export function useSafeMarketData(): MarketDataHookReturn {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️ DEPRECATED: useSafeMarketData is deprecated and will be removed in a future version.\n' +
      '   Please migrate to useWebSocketMarketData for real-time data streaming.\n' +
      '   See: /hooks/use-websocket-market-data.ts'
    );
  }

  const [state, setState] = useState<MarketDataState>({
    data: [],
    loading: true,
    error: null,
    lastUpdated: null,
    retryCount: 0,
    isHealthy: true
  })

  const handleError = useErrorHandler()

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/health/apis?detailed=true')
      const healthData = await response.json()
      
      const isHealthy = healthData.success && 
                       healthData.data?.overall?.status !== 'unhealthy'
      
      setState(prev => ({ ...prev, isHealthy }))
      return isHealthy
    } catch (error) {
      console.warn('Health check failed:', error)
      setState(prev => ({ ...prev, isHealthy: false }))
      return false
    }
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const fetchMarketData = useCallback(async (isRetry = false) => {
    try {
      setState(prev => ({ 
        ...prev, 
        loading: true, 
        error: null,
        retryCount: isRetry ? prev.retryCount + 1 : 0
      }))

      // Check system health first
      const isHealthy = await checkHealth()
      if (!isHealthy && state.retryCount === 0) {
        console.warn('System health check indicates issues, but proceeding with data fetch')
      }

      // Fetch products with timeout
      const productsController = new AbortController()
      const productsTimeout = setTimeout(() => productsController.abort(), 10000)

      const productsResponse = await fetch("/api/market/products", {
        signal: productsController.signal
      })
      clearTimeout(productsTimeout)
      
      if (!productsResponse.ok) {
        throw new Error(`Products API failed: ${productsResponse.status} ${productsResponse.statusText}`)
      }
      
      const productsData = await productsResponse.json()

      if (!productsData.success) {
        throw new Error(productsData.error || "Failed to fetch products")
      }

      // Handle different response structures
      const products = productsData.products || productsData.result || []
      
      if (!Array.isArray(products)) {
        throw new Error("Invalid products data structure received")
      }

      if (products.length === 0) {
        throw new Error("No products available from API")
      }

      console.log("Available products:", products.length)

      // Filter and select products with enhanced error handling
      let selectedPairs = products
        .filter((product: Product) => {
          try {
            if (!product || !product.symbol) return false
            
            const symbol = product.symbol.toLowerCase()
            const description = product.description?.toLowerCase() || ""
            const contractType = product.contract_type || product.productType || ""

            return (
              (symbol.includes("btc") ||
                symbol.includes("eth") ||
                symbol.includes("ada") ||
                symbol.includes("sol") ||
                symbol.includes("matic") ||
                symbol.includes("avax") ||
                symbol.includes("usdt") ||
                symbol.includes("usdc") ||
                description.includes("bitcoin") ||
                description.includes("ethereum")) &&
              (contractType === "spot" || contractType === "perpetual_futures")
            )
          } catch (filterError) {
            console.warn('Error filtering product:', product, filterError)
            return false
          }
        })
        .slice(0, 8)

      // Fallback selection strategies
      if (selectedPairs.length === 0) {
        console.log("No major pairs found, using first available products")
        selectedPairs = products
          .filter((product: Product) => {
            try {
              if (!product || !product.symbol) return false
              const contractType = product.contract_type || product.productType || ""
              return contractType === "spot" || contractType === "perpetual_futures"
            } catch (filterError) {
              console.warn('Error in fallback filter:', product, filterError)
              return false
            }
          })
          .slice(0, 8)
      }

      if (selectedPairs.length === 0) {
        console.log("No spot/futures pairs found, using any available products")
        selectedPairs = products.slice(0, 8)
      }

      if (selectedPairs.length === 0) {
        throw new Error("No valid trading pairs available")
      }

      console.log("Selected pairs:", selectedPairs.map((p: Product) => p.symbol))

      // Fetch ticker data with timeout
      const symbols = selectedPairs
        .filter((product: Product) => product && product.symbol)
        .map((product: Product) => product.symbol)
        .join(",")
        
      if (!symbols) {
        throw new Error("No valid symbols found for ticker data")
      }
      
      const tickersController = new AbortController()
      const tickersTimeout = setTimeout(() => tickersController.abort(), 10000)

      const tickersResponse = await fetch(`/api/market/tickers?symbols=${symbols}`, {
        signal: tickersController.signal
      })
      clearTimeout(tickersTimeout)
      
      if (!tickersResponse.ok) {
        throw new Error(`Tickers API failed: ${tickersResponse.status} ${tickersResponse.statusText}`)
      }
      
      const tickersData = await tickersResponse.json()

      if (!tickersData.success) {
        throw new Error(tickersData.error || "Failed to fetch ticker data")
      }

      const availableTickers = tickersData.tickers || tickersData.result || []

      if (!Array.isArray(availableTickers) || availableTickers.length === 0) {
        throw new Error("No ticker data available")
      }

      // Transform data with enhanced error handling
      const transformedData: MarketData[] = availableTickers
        .filter((ticker: Ticker) => {
          try {
            return ticker && ticker.symbol && ticker.close
          } catch (filterError) {
            console.warn('Error filtering ticker:', ticker, filterError)
            return false
          }
        })
        .map((ticker: Ticker) => {
          try {
            const changeNum = Number.parseFloat(ticker.change || "0")
            const openPrice = Number.parseFloat(ticker.open || ticker.close || "0")
            const closePrice = Number.parseFloat(ticker.close || "0")
            const changePercent = openPrice > 0 ? ((changeNum / openPrice) * 100).toFixed(2) : "0.00"

            return {
              symbol: ticker.symbol || "Unknown",
              price: closePrice.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 8,
              }),
              change: changeNum >= 0 ? `+${changeNum.toFixed(2)}` : changeNum.toFixed(2),
              changePercent: changeNum >= 0 ? `+${changePercent}%` : `${changePercent}%`,
              volume: formatVolume(ticker.turnover || ticker.volume || "0"),
              high: ticker.high || "0",
              low: ticker.low || "0",
            }
          } catch (transformError) {
            console.warn('Error transforming ticker:', ticker, transformError)
            return {
              symbol: ticker.symbol || "Unknown",
              price: "0.00",
              change: "0.00",
              changePercent: "0.00%",
              volume: "0",
              high: "0",
              low: "0",
            }
          }
        })

      if (transformedData.length === 0) {
        throw new Error("No valid market data could be processed")
      }

      setState(prev => ({
        ...prev,
        data: transformedData,
        loading: false,
        error: null,
        lastUpdated: new Date(),
        isHealthy: true
      }))

      console.log("Market data loaded successfully:", transformedData.length, "pairs")

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to fetch market data"
      console.error("Error fetching market data:", error)
      
      // Log error to monitoring system
      handleError(error instanceof Error ? error : new Error(errorMessage))
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        isHealthy: false
      }))
    }
  }, [checkHealth, handleError, state.retryCount])

  const refetch = useCallback(async () => {
    await fetchMarketData(true)
  }, [fetchMarketData])

  useEffect(() => {
    fetchMarketData()

    // Set up refresh interval
    const interval = setInterval(() => {
      if (!state.loading && state.error === null) {
        fetchMarketData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [fetchMarketData, state.loading, state.error])

  return {
    ...state,
    refetch,
    clearError,
    checkHealth
  }
}

function formatVolume(volume: string): string {
  try {
    const num = Number.parseFloat(volume)
    if (isNaN(num)) return "0"
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
    return num.toFixed(2)
  } catch (error) {
    console.warn('Error formatting volume:', volume, error)
    return "0"
  }
}

export default useSafeMarketData
