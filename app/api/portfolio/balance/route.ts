import { NextResponse } from "next/server"

/**
 * Portfolio Balance API - Migrated to WebSocket-based data
 * This endpoint now provides guidance for using WebSocket instead of REST API
 */
export async function GET() {
  try {
    console.log('[Portfolio Balance API] ⚠️  DEPRECATED: This endpoint now recommends WebSocket data')
    console.log('[Portfolio Balance API] REST API calls were experiencing 401 authentication errors')
    console.log('[Portfolio Balance API] Please migrate to useWebSocketPortfolio hook for real-time data')

    // Return mock data with migration guidance for backward compatibility
    const mockBalances = [
      {
        asset: "USDT",
        wallet_balance: "10000.00",
        unrealized_pnl: "250.50",
        available_balance: "9500.00",
        reserved_balance: "500.00",
        timestamp: Date.now()
      },
      {
        asset: "BTC",
        wallet_balance: "0.1",
        unrealized_pnl: "100.00",
        available_balance: "0.05",
        reserved_balance: "0.05",
        timestamp: Date.now()
      },
      {
        asset: "ETH",
        wallet_balance: "2.5",
        unrealized_pnl: "75.25",
        available_balance: "2.0",
        reserved_balance: "0.5",
        timestamp: Date.now()
      }
    ]

    // Calculate totals from mock data
    let totalBalance = 0
    let totalUnrealizedPnL = 0

    mockBalances.forEach((balance: any) => {
      totalBalance += Number.parseFloat(balance.wallet_balance || "0")
      totalUnrealizedPnL += Number.parseFloat(balance.unrealized_pnl || "0")
    })

    return NextResponse.json({
      success: true,
      balances: mockBalances,
      summary: {
        totalBalance: totalBalance.toFixed(2),
        totalUnrealizedPnL: totalUnrealizedPnL.toFixed(2),
        totalPnLPercent: totalBalance > 0 ? ((totalUnrealizedPnL / totalBalance) * 100).toFixed(2) : "0.00",
      },
      isMockData: true,
      isDeprecated: true,
      migrationInfo: {
        message: 'This REST API endpoint is deprecated due to 401 authentication errors. Use WebSocket-based portfolio data for real-time updates.',
        newHook: 'useWebSocketPortfolio',
        benefits: [
          'Real-time balance updates via WebSocket',
          'No more 401 authentication errors',
          'Sub-second latency instead of 1000+ ms REST calls',
          'Automatic reconnection and error handling'
        ],
        example: `
          import { useWebSocketPortfolio } from '@/hooks/use-websocket-portfolio';

          const portfolio = useWebSocketPortfolio({
            autoConnect: true,
            environment: 'production'
          });

          // Access real-time balances
          const balances = portfolio.balances;
          const summary = portfolio.summary;
        `
      }
    })
  } catch (error) {
    console.error("Error in deprecated balance endpoint:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Handle specific Delta Exchange API errors
    if (errorMessage.includes("credentials not found")) {
      console.warn("Delta Exchange API credentials not configured, returning mock data");
      return NextResponse.json({
        success: true,
        balances: [
          {
            asset: "USDT",
            wallet_balance: "10000.00",
            unrealized_pnl: "250.50"
          }
        ],
        summary: {
          totalBalance: "10000.00",
          totalUnrealizedPnL: "250.50",
          totalPnLPercent: "2.51"
        },
        warning: "Using mock data - Delta Exchange API credentials not configured"
      });
    }

    if (errorMessage.includes("invalid_api_key") || errorMessage.includes("401")) {
      console.warn("Invalid Delta Exchange API credentials, returning mock data");
      return NextResponse.json({
        success: true,
        balances: [
          {
            asset: "USDT",
            wallet_balance: "10000.00",
            unrealized_pnl: "250.50"
          }
        ],
        summary: {
          totalBalance: "10000.00",
          totalUnrealizedPnL: "250.50",
          totalPnLPercent: "2.51"
        },
        warning: "Using mock data - Invalid Delta Exchange API credentials"
      });
    }

    if (errorMessage.includes("insufficient_permissions") || errorMessage.includes("403")) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient API permissions. Please enable trading permissions for your Delta Exchange API key.",
          code: "INSUFFICIENT_PERMISSIONS",
        },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: `Failed to fetch balance from Delta Exchange: ${errorMessage}`,
        code: "DELTA_API_ERROR",
      },
      { status: 500 },
    )
  }
}
