import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fetch products from Delta Exchange public API
    const response = await fetch("https://api.delta.exchange/v2/products", {
      headers: {
        "User-Agent": "CryptoTrader/1.0",
      },
      next: { revalidate: 60 }, // Cache for 1 minute
    })

    if (!response.ok) {
      throw new Error(`Delta Exchange API error: ${response.status}`)
    }

    const data = await response.json()

    // Filter for active spot and futures products
    const activeProducts = data.result.filter(
      (product: any) =>
        product.state === "live" &&
        product.trading_status === "operational" &&
        (product.contract_type === "spot" || product.contract_type === "perpetual_futures"),
    )

    return NextResponse.json({
      success: true,
      products: activeProducts.slice(0, 20), // Limit to first 20 products
    })
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch market products" }, { status: 500 })
  }
}
