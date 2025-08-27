import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ success: false, error: "Symbol is required" }, { status: 400 })
    }

    const response = await fetch(`https://api.delta.exchange/v2/l2orderbook/${symbol}`, {
      headers: {
        "User-Agent": "CryptoTrader/1.0",
      },
      next: { revalidate: 5 }, // Cache for 5 seconds
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch orderbook for ${symbol}`)
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      orderbook: data.result,
    })
  } catch (error) {
    console.error("Error fetching orderbook:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch orderbook",
      },
      { status: 500 },
    )
  }
}
