"use client"

import { useState, useEffect } from "react"

/**
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Please use `useWebSocketMarketData` from '@/hooks/use-websocket-market-data' instead.
 *
 * The WebSocket-based hook provides:
 * - Real-time data updates via WebSocket connection
 * - Better performance with reduced API calls
 * - Improved error handling and connection management
 * - Consistent data structure and type safety
 *
 * Migration example:
 * ```typescript
 * // Old (deprecated)
 * import { useMarketData } from '@/hooks/use-market-data'
 * const { marketData, loading, error } = useMarketData()
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
  contract_type: string
  underlying_asset: {
    symbol: string
  }
  quoting_asset: {
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

export function useMarketData() {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️ DEPRECATED: useMarketData is deprecated and will be removed in a future version.\n' +
      '   Please migrate to useWebSocketMarketData for real-time data streaming.\n' +
      '   See: /hooks/use-websocket-market-data.ts'
    );
  }

  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMarketData() {
      try {
        setLoading(true)
        setError(null)

        // First, get available products
        console.log("[MarketData] Fetching products from API...")
        const productsResponse = await fetch("/api/market/products")

        if (!productsResponse.ok) {
          const errorText = await productsResponse.text().catch(() => 'Unable to read error response');
          throw new Error(`Failed to fetch products: ${productsResponse.status} ${productsResponse.statusText} - ${errorText}`)
        }

        const productsData = await productsResponse.json()
        console.log("[MarketData] Products response:", { success: productsData.success, dataType: typeof productsData });

        if (!productsData.success) {
          throw new Error(productsData.error || productsData.details || "Failed to fetch products")
        }

        // Handle different response structures (products vs result)
        const products = productsData.products || productsData.result || []

        if (!Array.isArray(products)) {
          throw new Error("Invalid products data structure received")
        }

        console.log("Available products:", products.length)

        let selectedPairs = products
          .filter((product: Product) => {
            if (!product || !product.symbol) return false

            const symbol = product.symbol.toLowerCase()
            const description = product.description?.toLowerCase() || ""
            const contractType = product.contract_type || product.productType || ""

            // First try to find major cryptocurrencies
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
          })
          .slice(0, 8)

        if (selectedPairs.length === 0) {
          console.log("No major pairs found, using first available products")
          selectedPairs = products
            .filter((product: Product) => {
              if (!product || !product.symbol) return false
              const contractType = product.contract_type || product.productType || ""
              return contractType === "spot" || contractType === "perpetual_futures"
            })
            .slice(0, 8)
        }

        if (selectedPairs.length === 0) {
          console.log("No spot/futures pairs found, using any available products")
          selectedPairs = products.slice(0, 8)
        }

        if (selectedPairs.length === 0) {
          throw new Error("No trading pairs available from Delta Exchange")
        }

        console.log(
          "Selected pairs:",
          selectedPairs.map((p: Product) => p.symbol),
        )

        // Get ticker data for these pairs
        const symbols = selectedPairs
          .filter((product: Product) => product && product.symbol)
          .map((product: Product) => product.symbol)
          .join(",")

        if (!symbols) {
          console.warn("[MarketData] No valid symbols found for ticker data - using fallback");
          throw new Error("No valid symbols found for ticker data")
        }

        console.log("[MarketData] Fetching tickers for symbols:", symbols.split(',').length, "symbols");
        const tickersResponse = await fetch(`/api/market/tickers?symbols=${symbols}`)

        if (!tickersResponse.ok) {
          const errorText = await tickersResponse.text().catch(() => 'Unable to read error response');
          throw new Error(`Failed to fetch tickers: ${tickersResponse.status} ${tickersResponse.statusText} - ${errorText}`)
        }

        const tickersData = await tickersResponse.json()
        console.log("[MarketData] Tickers response:", { success: tickersData.success, tickersCount: tickersData.tickers?.length || 0 });

        if (!tickersData.success) {
          throw new Error(tickersData.error || tickersData.details || "Failed to fetch ticker data")
        }

        const availableTickers = tickersData.tickers || tickersData.result || []

        if (!Array.isArray(availableTickers) || availableTickers.length === 0) {
          throw new Error("No ticker data available")
        }

        // Transform data for display
        const transformedData: MarketData[] = availableTickers
          .filter((ticker: Ticker) => ticker && ticker.symbol && ticker.close)
          .map((ticker: Ticker) => {
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
          })

        if (transformedData.length === 0) {
          console.warn("No valid market data could be processed - using fallback data")
          // Provide fallback data instead of throwing error
          const fallbackData = [{
            symbol: "BTCUSDT",
            price: "0",
            change: "0",
            changePercent: "0",
            volume: "0",
            high: "0",
            low: "0"
          }];
          setMarketData(fallbackData);
          setError("No market data available - showing fallback data");
        } else {
          setMarketData(transformedData)
          console.log("Market data loaded:", transformedData.length, "pairs")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch market data"
        console.error("Error fetching market data:", err)

        // Enhanced error logging with meaningful context
        const errorDetails = {
          error: errorMessage,
          errorType: err instanceof Error ? err.constructor.name : 'Unknown',
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.href : 'server',
          stack: err instanceof Error ? err.stack : 'No stack trace',
          fetchAttempt: 'market-data-fetch'
        };

        console.error("Market data fetch error details:", errorDetails)

        setError(errorMessage)

        // Log to monitoring system if available (client-side only)
        if (typeof window !== 'undefined') {
          try {
            fetch('/api/health/detailed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'market_data_error',
                error: {
                  message: errorMessage,
                  stack: err instanceof Error ? err.stack : undefined
                },
                timestamp: new Date().toISOString()
              })
            }).catch(monitoringError => {
              console.warn("Failed to log error to monitoring:", monitoringError)
            })
          } catch (monitoringError) {
            console.warn("Error logging to monitoring system:", monitoringError)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchMarketData()

    // Refresh data every 30 seconds
    const interval = setInterval(fetchMarketData, 30000)
    return () => clearInterval(interval)
  }, [])

  const refetch = async () => {
    setLoading(true)
    setError(null)
    // Trigger useEffect to run again
    window.dispatchEvent(new Event("focus"))
  }

  return { marketData, loading, error, refetch }
}

function formatVolume(volume: string): string {
  const num = Number.parseFloat(volume)
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`
  return num.toFixed(2)
}
