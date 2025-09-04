import { NextResponse } from "next/server"

/**
 * Portfolio Positions API - Migrated to WebSocket-based data
 * This endpoint now provides guidance for using WebSocket instead of REST API
 */
export async function GET() {
  try {
    console.log('[Portfolio Positions API] ⚠️  DEPRECATED: This endpoint now recommends WebSocket data')
    console.log('[Portfolio Positions API] REST API calls were experiencing 401 authentication errors')
    console.log('[Portfolio Positions API] Please migrate to useWebSocketPortfolio hook for real-time data')

    // Return comprehensive mock positions data with migration guidance
    const mockPositions = [
      {
        product: { symbol: "BTCUSDT", id: 1 },
        size: "0.1",
        entry_price: "45000.00",
        mark_price: "46000.00",
        unrealized_pnl: "100.00",
        unrealized_pnl_percent: "2.22",
        realized_pnl: "0.00",
        side: "buy",
        timestamp: Date.now()
      },
      {
        product: { symbol: "ETHUSDT", id: 2 },
        size: "2.0",
        entry_price: "3000.00",
        mark_price: "3075.00",
        unrealized_pnl: "150.00",
        unrealized_pnl_percent: "2.50",
        realized_pnl: "0.00",
        side: "buy",
        timestamp: Date.now()
      },
      {
        product: { symbol: "ADAUSDT", id: 3 },
        size: "1000",
        entry_price: "0.45",
        mark_price: "0.47",
        unrealized_pnl: "20.00",
        unrealized_pnl_percent: "4.44",
        realized_pnl: "0.00",
        side: "buy",
        timestamp: Date.now()
      }
    ]

    return NextResponse.json({
      success: true,
      positions: mockPositions,
      isMockData: true,
      isDeprecated: true,
      migrationInfo: {
        message: 'This REST API endpoint is deprecated due to 401 authentication errors. Use WebSocket-based portfolio data for real-time updates.',
        newHook: 'useWebSocketPortfolio',
        benefits: [
          'Real-time position updates via WebSocket',
          'No more 401 authentication errors',
          'Sub-second latency instead of 1000+ ms REST calls',
          'Automatic reconnection and error handling',
          'Live P&L updates without polling'
        ],
        example: `
          import { useWebSocketPortfolio } from '@/hooks/use-websocket-portfolio';

          const portfolio = useWebSocketPortfolio({
            autoConnect: true,
            environment: 'production'
          });

          // Access real-time positions
          const positions = portfolio.positions;
          const openPositions = portfolio.summary.openPositions;
        `
      }
    })
  } catch (error) {
    console.error("Error in deprecated positions endpoint:", error)

    if (error instanceof Error && error.message.includes("403")) {
      return NextResponse.json(
        {
          success: false,
          error: "Access forbidden. Please ensure your API key has the required permissions for accessing positions.",
          code: "INSUFFICIENT_PERMISSIONS",
        },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch positions",
        code: "API_ERROR",
        isDeprecated: true,
        migrationInfo: {
          message: 'This REST API endpoint is deprecated. Use WebSocket-based portfolio data instead.',
          newHook: 'useWebSocketPortfolio'
        }
      },
      { status: 500 },
    )
  }
}
