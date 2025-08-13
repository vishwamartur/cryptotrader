"use client"

import { useState, useEffect } from "react"

interface OrderbookEntry {
  size: string
  price: string
}

interface Orderbook {
  buy: OrderbookEntry[]
  sell: OrderbookEntry[]
  symbol: string
  last_updated_at: string
}

export function useOrderbook(symbol: string) {
  const [orderbook, setOrderbook] = useState<Orderbook | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return

    async function fetchOrderbook() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/trading/orderbook?symbol=${symbol}`)
        const data = await response.json()

        if (data.success) {
          setOrderbook(data.orderbook)
        } else {
          setError(data.error)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch orderbook")
      } finally {
        setLoading(false)
      }
    }

    fetchOrderbook()

    // Refresh orderbook every 5 seconds
    const interval = setInterval(fetchOrderbook, 5000)
    return () => clearInterval(interval)
  }, [symbol])

  return { orderbook, loading, error }
}
