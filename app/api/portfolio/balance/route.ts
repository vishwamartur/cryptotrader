import { NextResponse } from "next/server"
import { createDeltaExchangeAPI } from "@/lib/delta-exchange"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const api_key = searchParams.get("api_key")
    const api_secret = searchParams.get("api_secret")

    if (!api_key || !api_secret) {
      return NextResponse.json(
        {
          success: false,
          error: "API credentials required. Please set up your Delta Exchange API credentials.",
          code: "MISSING_CREDENTIALS",
        },
        { status: 400 },
      )
    }

    if (api_key.length < 10 || api_secret.length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid API credentials format. Please check your Delta Exchange API key and secret.",
          code: "INVALID_CREDENTIALS",
        },
        { status: 400 },
      )
    }

    const deltaAPI = createDeltaExchangeAPI(api_key, api_secret)
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

    if (error instanceof Error) {
      if (error.message.includes("401")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Authentication failed. Please check your Delta Exchange API credentials and ensure they have trading permissions enabled.",
            code: "AUTH_FAILED",
          },
          { status: 401 },
        )
      }
      if (error.message.includes("403")) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Access forbidden. Please ensure your API key has the required permissions for accessing balance data.",
            code: "INSUFFICIENT_PERMISSIONS",
          },
          { status: 403 },
        )
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch balance",
        code: "API_ERROR",
      },
      { status: 500 },
    )
  }
}
