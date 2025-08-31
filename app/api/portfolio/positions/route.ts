import { NextResponse } from "next/server"
import { createDeltaExchangeAPIFromEnv } from "@/lib/delta-exchange"

export async function GET() {
  try {
    // Use environment credentials for authenticated API calls
    const deltaAPI = createDeltaExchangeAPIFromEnv()
    const positionsData = await deltaAPI.getPositions()

    return NextResponse.json({
      success: true,
      positions: positionsData.result || [],
    })
  } catch (error) {
    console.error("Error fetching positions:", error)

    if (error instanceof Error) {
      if (error.message.includes("invalid_api_key")) {
        console.warn("Invalid Delta Exchange API key, returning mock positions");
        return NextResponse.json({
          success: true,
          positions: [
            {
              product: { symbol: "BTCUSDT" },
              size: "0.1",
              entry_price: "45000.00",
              mark_price: "46000.00",
              unrealized_pnl: "100.00",
              unrealized_pnl_percent: "2.22"
            }
          ],
          warning: "Using mock data - Invalid Delta Exchange API key"
        });
      }

      if (error.message.includes("401")) {
        console.warn("Delta Exchange authentication failed, returning mock positions");
        return NextResponse.json({
          success: true,
          positions: [
            {
              product: { symbol: "BTCUSDT" },
              size: "0.1",
              entry_price: "45000.00",
              mark_price: "46000.00",
              unrealized_pnl: "100.00",
              unrealized_pnl_percent: "2.22"
            }
          ],
          warning: "Using mock data - Delta Exchange authentication failed"
        });
      }
      if (error.message.includes("403")) {
        return NextResponse.json(
          {
            success: false,
            error: "Access forbidden. Please ensure your API key has the required permissions for accessing positions.",
            code: "INSUFFICIENT_PERMISSIONS",
          },
          { status: 403 },
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch positions",
        code: "API_ERROR",
      },
      { status: 500 },
    )
  }
}
