import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbols = searchParams.get("symbols")?.split(",") || []

    if (symbols.length === 0) {
      return NextResponse.json({ success: false, error: "No symbols provided" }, { status: 400 })
    }

    // Fetch ticker data for each symbol
    const tickerPromises = symbols.map(async (symbol) => {
      try {
        const response = await fetch(`https://api.delta.exchange/v2/tickers/${symbol}`, {
          headers: {
            "User-Agent": "CryptoTrader/1.0",
          },
          next: { revalidate: 10 }, // Cache for 10 seconds
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch ticker for ${symbol}`)
        }

        const data = await response.json()
        return { symbol, ...data.result }
      } catch (error) {
        console.error(`Error fetching ticker for ${symbol}:`, error)
        return null
      }
    })

    const tickers = await Promise.all(tickerPromises)
    const validTickers = tickers.filter((ticker) => ticker !== null)

    return NextResponse.json({
      success: true,
      tickers: validTickers,
    })
  } catch (error) {
    console.error("Error fetching tickers:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch ticker data" }, { status: 500 })
  }
}
