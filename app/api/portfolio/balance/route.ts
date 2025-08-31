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
