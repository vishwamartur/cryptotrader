import { NextResponse } from "next/server"
import { createDeltaExchangeAPIFromEnv, getDeltaCredentials } from "@/lib/delta-exchange"

export async function GET() {
  try {
    // Get credentials - will throw if not available
    const credentials = getDeltaCredentials()

    // Create API instance
    const deltaAPI = createDeltaExchangeAPIFromEnv()

    // Test connection with a simple balance request
    const balanceData = await deltaAPI.getBalance()

    // Test public API as well
    const products = await deltaAPI.getProducts()

    return NextResponse.json({
      success: true,
      message: "Delta Exchange API connection successful",
      data: {
        mode: "live",
        apiKeyMasked: `${credentials.apiKey.substring(0, 8)}...${credentials.apiKey.slice(-4)}`,
        balanceCount: balanceData.result?.length || 0,
        productsCount: products.result?.length || 0,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Delta Exchange connection test failed:", error)
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    
    // Provide helpful error messages
    if (errorMessage.includes("credentials not found") || errorMessage.includes("credentials are required")) {
      return NextResponse.json({
        success: false,
        error: "Delta Exchange API credentials not configured",
        details: "Please set DELTA_EXCHANGE_API_KEY and DELTA_EXCHANGE_API_SECRET environment variables",
        suggestions: [
          "Get your API credentials from: https://www.delta.exchange/app/api-management",
          "Set DELTA_EXCHANGE_API_KEY in your environment",
          "Set DELTA_EXCHANGE_API_SECRET in your environment",
          "Restart the application after setting credentials"
        ],
        code: "MISSING_CREDENTIALS"
      }, { status: 400 })
    }
    
    if (errorMessage.includes("invalid_api_key")) {
      return NextResponse.json({
        success: false,
        error: "Invalid Delta Exchange API credentials",
        details: "Please verify your API key and secret are correct",
        suggestions: [
          "Verify your API key is correct and active",
          "Ensure you're using production keys (not testnet)",
          "Check that your API key hasn't expired",
          "Verify the API key format is correct (no extra spaces)",
          "Visit https://www.delta.exchange/app/api-management to manage your API keys"
        ],
        code: "INVALID_CREDENTIALS"
      }, { status: 401 })
    }
    
    if (errorMessage.includes("insufficient_permissions")) {
      return NextResponse.json({
        success: false,
        error: "Insufficient API permissions",
        details: "Please ensure your API key has trading permissions enabled",
        code: "INSUFFICIENT_PERMISSIONS"
      }, { status: 403 })
    }
    
    return NextResponse.json({
      success: false,
      error: "Delta Exchange API connection failed",
      details: errorMessage,
      code: "CONNECTION_FAILED"
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const deltaAPI = createDeltaExchangeAPIFromEnv()
    
    // Test various API endpoints
    const tests = await Promise.allSettled([
      deltaAPI.getBalance(),
      deltaAPI.getPositions(),
      deltaAPI.getOrders(),
      deltaAPI.getProducts(),
      deltaAPI.getTicker("BTCUSDT")
    ])
    
    const results = tests.map((test, index) => ({
      endpoint: ["balance", "positions", "orders", "products", "ticker"][index],
      status: test.status,
      success: test.status === "fulfilled",
      error: test.status === "rejected" ? (test.reason as Error).message : null
    }))
    
    const successCount = results.filter(r => r.success).length
    const totalTests = results.length
    
    return NextResponse.json({
      success: successCount === totalTests,
      message: `Delta Exchange API comprehensive test: ${successCount}/${totalTests} endpoints working`,
      results,
      summary: {
        total: totalTests,
        passed: successCount,
        failed: totalTests - successCount,
        successRate: `${Math.round((successCount / totalTests) * 100)}%`
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error("Delta Exchange comprehensive test failed:", error)
    
    return NextResponse.json({
      success: false,
      error: "Comprehensive test failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
