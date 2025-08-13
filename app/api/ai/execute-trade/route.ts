import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { analysis, config } = await request.json()

    const apiKey = request.headers.get("x-api-key")
    const apiSecret = request.headers.get("x-api-secret")

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Delta Exchange API credentials required for autonomous trading" },
        { status: 400 },
      )
    }

    const orderData = {
      product_id: analysis.symbol,
      side: analysis.signal.toLowerCase(),
      order_type: "limit_order",
      size: analysis.positionSize,
      price: analysis.entryPrice,
      stop_loss: analysis.stopLoss,
      take_profit: analysis.takeProfit,
      time_in_force: "gtc",
    }

    const deltaClient = await import("@/lib/delta-exchange")
    const client = new deltaClient.DeltaExchangeClient(apiKey, apiSecret)

    const orderResult = await client.placeOrder(orderData)

    console.log("Autonomous trade executed:", {
      analysis: analysis.reasoning,
      confidence: analysis.confidence,
      order: orderResult,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      orderId: orderResult.id,
      analysis: analysis.reasoning,
      confidence: analysis.confidence,
    })
  } catch (error) {
    console.error("Autonomous trade execution error:", error)
    return NextResponse.json({ error: "Failed to execute autonomous trade" }, { status: 500 })
  }
}
