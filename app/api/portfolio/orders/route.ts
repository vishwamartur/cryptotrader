import { NextResponse } from "next/server"
import { createDeltaExchangeAPIFromEnv } from "@/lib/delta-exchange"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const states = searchParams.get("states")?.split(",") || ["open", "closed"]

    // Use environment credentials for authenticated API calls
    const deltaAPI = createDeltaExchangeAPIFromEnv()
    const ordersData = await deltaAPI.getOrders(states)

    return NextResponse.json({
      success: true,
      orders: ordersData.result || [],
    })
  } catch (error) {
    console.error("Error fetching orders:", error)

    const errorMessage = error instanceof Error ? error.message : "Failed to fetch orders"

    if (errorMessage.includes("invalid_api_key")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid API Key. Please check: 1) Your API key is correct, 2) You're using the right environment (production vs testnet), 3) Your API key hasn't expired. Get your API key from: https://www.delta.exchange/app/api-management",
          code: "INVALID_API_KEY",
        },
        { status: 401 },
      )
    }

    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication failed. Please verify your Delta Exchange API credentials have 'Trading' permissions enabled and are correctly configured.",
          code: "AUTH_FAILED",
        },
        { status: 401 },
      )
    }

    if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Access denied. Your API key may not have sufficient permissions. Please ensure 'Trading' permissions are enabled in your Delta Exchange API settings.",
          code: "INSUFFICIENT_PERMISSIONS",
        },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        code: "API_ERROR",
      },
      { status: 500 },
    )
  }
}
