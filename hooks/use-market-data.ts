"use client"

import { useState, useEffect } from "react"

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
  const [marketData, setMarketData] = useState<MarketData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMarketData() {
      try {
        setLoading(true)
        setError(null)

        // First, get available products
        const productsResponse = await fetch("/api/market/products")
        const productsData = await productsResponse.json()

        if (!productsData.success) {
          throw new Error(productsData.error)
        }

        console.log("Available products:", productsData.products.length)

        let selectedPairs = productsData.products
          .filter((product: Product) => {
            const symbol = product.symbol.toLowerCase()
            const description = product.description?.toLowerCase() || ""

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
              (product.contract_type === "spot" || product.contract_type === "perpetual_futures")
            )
          })
          .slice(0, 8)

        if (selectedPairs.length === 0) {
          console.log("No major pairs found, using first available products")
          selectedPairs = productsData.products
            .filter(
              (product: Product) => product.contract_type === "spot" || product.contract_type === "perpetual_futures",
            )
            .slice(0, 8)
        }

        if (selectedPairs.length === 0) {
          console.log("No spot/futures pairs found, using any available products")
          selectedPairs = productsData.products.slice(0, 8)
        }

        if (selectedPairs.length === 0) {
          throw new Error("No trading pairs available from Delta Exchange")
        }

        console.log(
          "Selected pairs:",
          selectedPairs.map((p: Product) => p.symbol),
        )

        // Get ticker data for these pairs
        const symbols = selectedPairs.map((product: Product) => product.symbol).join(",")
        const tickersResponse = await fetch(`/api/market/tickers?symbols=${symbols}`)
        const tickersData = await tickersResponse.json()

        if (!tickersData.success) {
          throw new Error(tickersData.error)
        }

        const availableTickers = tickersData.tickers || []

        if (availableTickers.length === 0) {
          throw new Error("No ticker data available")
        }

        // Transform data for display
        const transformedData: MarketData[] = availableTickers.map((ticker: Ticker) => {
          const changeNum = Number.parseFloat(ticker.change || "0")
          const openPrice = Number.parseFloat(ticker.open || ticker.close || "0")
          const closePrice = Number.parseFloat(ticker.close || "0")
          const changePercent = openPrice > 0 ? ((changeNum / openPrice) * 100).toFixed(2) : "0.00"

          return {
            symbol: ticker.symbol,
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

        setMarketData(transformedData)
        console.log("Market data loaded:", transformedData.length, "pairs")
      } catch (err) {
        console.error("Error fetching market data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch market data")
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
