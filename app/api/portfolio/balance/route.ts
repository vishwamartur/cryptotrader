import { NextResponse } from "next/server"
import { createDeltaExchangeAPIFromEnv } from "@/lib/delta-exchange"

export async function GET() {
  try {
    // Use environment credentials for authenticated API calls
    const deltaAPI = createDeltaExchangeAPIFromEnv()
    const balanceData = await deltaAPI.getBalance()

    // Calculate total portfolio value and P&L
    let totalBalance = 0
    let totalUnrealizedPnL = 0

    const balances = balanceData.result || []

    balances.forEach((balance: any) => {
      totalBalance += Number.parseFloat(balance.wallet_balance || "0")
      totalUnrealizedPnL += Number.parseFloat(balance.unrealized_pnl || "0")
    })

    return NextResponse.json({
      success: true,
      balances: balances,
      summary: {
        totalBalance: totalBalance.toFixed(2),
        totalUnrealizedPnL: totalUnrealizedPnL.toFixed(2),
        totalPnLPercent: totalBalance > 0 ? ((totalUnrealizedPnL / totalBalance) * 100).toFixed(2) : "0.00",
      },
    })
  } catch (error) {
    console.error("Error fetching balance:", error)

    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    // Handle specific Delta Exchange API errors
    if (errorMessage.includes("credentials not found")) {
      return NextResponse.json(
        {
          success: false,
          error: "Delta Exchange API credentials not configured. Please set DELTA_API_KEY and DELTA_API_SECRET environment variables.",
          code: "MISSING_CREDENTIALS",
        },
        { status: 500 },
      )
    }

    if (errorMessage.includes("invalid_api_key") || errorMessage.includes("401")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid Delta Exchange API credentials. Please verify your API key and secret.",
          code: "INVALID_CREDENTIALS",
        },
        { status: 401 },
      )
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
