/**
 * Portfolio Hook - Fetches and manages portfolio data from Delta Exchange
 *
 * @deprecated This hook is deprecated and will be removed in a future version.
 * Please use `useWebSocketPortfolio` from '@/hooks/use-websocket-portfolio' instead.
 *
 * The WebSocket-based hook provides:
 * - Real-time portfolio updates via WebSocket connection
 * - No more 401 authentication errors
 * - Better performance with sub-second updates
 * - Improved error handling and connection management
 * - Built-in health monitoring and retry logic
 *
 * Migration example:
 * ```typescript
 * // Old (deprecated)
 * import { usePortfolio } from '@/hooks/use-portfolio'
 * const { portfolioData, loading, error } = usePortfolio(credentials)
 *
 * // New (recommended)
 * import { useWebSocketPortfolio } from '@/hooks/use-websocket-portfolio'
 * const portfolio = useWebSocketPortfolio({
 *   autoConnect: true,
 *   environment: 'production',
 *   apiKey: credentials?.api_key,
 *   apiSecret: credentials?.api_secret
 * })
 * ```
 */

"use client"

import { useState, useEffect } from "react"

interface Balance {
  asset_id: number
  asset_symbol: string
  available_balance: string
  wallet_balance: string
  unrealized_pnl: string
  position_margin: string
  order_margin: string
}

interface Position {
  user_id: number
  size: string
  entry_price: string
  margin: string
  liquidation_price: string
  realized_pnl: string
  product: {
    id: number
    symbol: string
    underlying_asset: {
      symbol: string
    }
  }
}

interface Order {
  id: number
  size: string
  unfilled_size: string
  side: "buy" | "sell"
  order_type: string
  limit_price: string
  state: string
  created_at: string
  product: {
    symbol: string
  }
}

interface PortfolioSummary {
  totalBalance: string
  totalUnrealizedPnL: string
  totalPnLPercent: string
}

interface PortfolioData {
  balances: Balance[]
  positions: Position[]
  orders: Order[]
  summary: PortfolioSummary
}

export function usePortfolio(credentials: { api_key: string; api_secret: string } | null) {
  const [portfolioData, setPortfolioData] = useState<PortfolioData>({
    balances: [],
    positions: [],
    orders: [],
    summary: {
      totalBalance: "0.00",
      totalUnrealizedPnL: "0.00",
      totalPnLPercent: "0.00",
    },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!credentials) {
      setPortfolioData({
        balances: [],
        positions: [],
        orders: [],
        summary: {
          totalBalance: "0.00",
          totalUnrealizedPnL: "0.00",
          totalPnLPercent: "0.00",
        },
      })
      return
    }

    async function fetchPortfolioData() {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          api_key: credentials.api_key,
          api_secret: credentials.api_secret,
        })

        // Fetch all portfolio data in parallel
        const [balanceResponse, positionsResponse, ordersResponse] = await Promise.all([
          fetch(`/api/portfolio/balance?${params}`),
          fetch(`/api/portfolio/positions?${params}`),
          fetch(`/api/portfolio/orders?${params}`),
        ])

        const [balanceData, positionsData, ordersData] = await Promise.all([
          balanceResponse.json(),
          positionsResponse.json(),
          ordersResponse.json(),
        ])

        if (!balanceData.success) {
          throw new Error(balanceData.error)
        }

        setPortfolioData({
          balances: balanceData.balances || [],
          positions: positionsData.success ? positionsData.positions || [] : [],
          orders: ordersData.success ? ordersData.orders || [] : [],
          summary: balanceData.summary || {
            totalBalance: "0.00",
            totalUnrealizedPnL: "0.00",
            totalPnLPercent: "0.00",
          },
        })
      } catch (err) {
        console.error("Error fetching portfolio data:", err)
        setError(err instanceof Error ? err.message : "Failed to fetch portfolio data")
      } finally {
        setLoading(false)
      }
    }

    fetchPortfolioData()

    // Refresh portfolio data every 30 seconds
    const interval = setInterval(fetchPortfolioData, 30000)
    return () => clearInterval(interval)
  }, [credentials])

  return { portfolioData, loading, error }
}
