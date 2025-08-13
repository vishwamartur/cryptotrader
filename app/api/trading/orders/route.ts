import { NextResponse } from "next/server"
import { createDeltaExchangeAPI } from "@/lib/delta-exchange"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { product_id, size, side, order_type, limit_price, api_key, api_secret } = body

    // Validate required fields
    if (!product_id || !size || !side || !order_type || !api_key || !api_secret) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Create Delta Exchange API instance
    const deltaAPI = createDeltaExchangeAPI(api_key, api_secret)

    // Prepare order data
    const orderData = {
      product_id: Number.parseInt(product_id),
      size: size.toString(),
      side: side as "buy" | "sell",
      order_type: order_type as "limit_order" | "market_order",
      ...(order_type === "limit_order" && limit_price && { limit_price: limit_price.toString() }),
    }

    // Place the order
    const result = await deltaAPI.placeOrder(orderData)

    return NextResponse.json({
      success: true,
      order: result,
      message: `${side.toUpperCase()} order placed successfully`,
    })
  } catch (error) {
    console.error("Error placing order:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to place order",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const api_key = searchParams.get("api_key")
    const api_secret = searchParams.get("api_secret")

    if (!api_key || !api_secret) {
      return NextResponse.json({ success: false, error: "API credentials required" }, { status: 400 })
    }

    const deltaAPI = createDeltaExchangeAPI(api_key, api_secret)
    const orders = await deltaAPI.getOrders()

    return NextResponse.json({
      success: true,
      orders: orders,
    })
  } catch (error) {
    console.error("Error fetching orders:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch orders",
      },
      { status: 500 },
    )
  }
}
