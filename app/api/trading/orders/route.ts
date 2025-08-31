import { NextResponse } from "next/server"
import { createDeltaExchangeAPIFromEnv } from "@/lib/delta-exchange"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { product_id, size, side, order_type, limit_price } = body

    // Validate required fields
    if (!product_id || !size || !side || !order_type) {
      return NextResponse.json({ success: false, error: "Missing required fields: product_id, size, side, order_type" }, { status: 400 })
    }

    // Create Delta Exchange API instance using environment credentials
    const deltaAPI = createDeltaExchangeAPIFromEnv()

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

export async function GET() {
  try {
    // Use environment credentials for authenticated API calls
    const deltaAPI = createDeltaExchangeAPIFromEnv()
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
