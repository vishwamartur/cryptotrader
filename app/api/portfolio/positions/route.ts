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
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid API key. Please check: 1) You're using the correct environment (production vs testnet), 2) Your API key hasn't expired, 3) Your API key has trading permissions enabled. Get your API credentials from: https://www.delta.exchange/app/api-management",
            code: "INVALID_API_KEY",
          },
          { status: 401 },
        )
      }

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
