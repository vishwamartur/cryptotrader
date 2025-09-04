import { generateHmacSha256 } from "./crypto-utils"

// Delta Exchange API configuration
const DELTA_BASE_URL = process.env.DELTA_BASE_URL || "https://api.delta.exchange"

interface DeltaExchangeConfig {
  apiKey: string
  apiSecret: string
}

// Get Delta Exchange credentials from environment
export function getDeltaCredentials(): DeltaExchangeConfig {
  const apiKey = process.env.DELTA_API_KEY
  const apiSecret = process.env.DELTA_API_SECRET

  if (!apiKey || !apiSecret) {
    throw new Error(
      "Delta Exchange API credentials not found. Please set DELTA_API_KEY and DELTA_API_SECRET environment variables."
    )
  }

  return { apiKey, apiSecret }
}

export class DeltaExchangeAPI {
  private apiKey: string
  private apiSecret: string

  constructor(config: DeltaExchangeConfig) {
    this.apiKey = config.apiKey
    this.apiSecret = config.apiSecret
  }

  // Generate signature for authenticated requests
  private async generateSignature(
    method: string,
    timestamp: string,
    requestPath: string,
    queryParams = "",
    body = "",
  ): Promise<string> {
    // Delta Exchange expects: method + timestamp + requestPath + queryParams + body
    // Query params should NOT include the leading "?" in signature
    const message = method + timestamp + requestPath + queryParams + body
    return await generateHmacSha256(message, this.apiSecret)
  }

  // Make authenticated API request
  private async makeAuthenticatedRequest(
    method: string,
    endpoint: string,
    queryParams: Record<string, string> = {},
    body: any = null,
  ) {
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const queryString = new URLSearchParams(queryParams).toString()
    const requestPath = endpoint
    const bodyString = body ? JSON.stringify(body) : ""

    // For signature: query params without leading "?"
    const signature = await this.generateSignature(
      method.toUpperCase(),
      timestamp,
      requestPath,
      queryString, // No leading "?" for signature
      bodyString,
    )

    const headers: Record<string, string> = {
      "api-key": this.apiKey,
      signature: signature,
      timestamp: timestamp,
      "User-Agent": "CryptoTrader/1.0",
      "Content-Type": "application/json",
    }

    // For URL: query params with leading "?" if they exist
    const url = `${DELTA_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`

    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        headers,
        body: bodyString || undefined,
      })

      if (!response.ok) {
        const errorMessage = `Delta Exchange API error: ${response.status}`

        try {
          const responseText = await response.text()
          let errorData: any

          try {
            errorData = JSON.parse(responseText)
          } catch {
            // If JSON parsing fails, use the raw text
            console.error(`Delta Exchange API Error ${response.status}:`, responseText)
            throw new Error(`${errorMessage}: ${responseText}`)
          }

          console.error(`Delta Exchange API Error ${response.status}:`, errorData)

          if (errorData.error?.code === "invalid_api_key") {
            throw new Error(
              "Invalid API key. Please check your Delta Exchange API credentials:\n" +
                "1. Ensure you're using the correct API key\n" +
                "2. Verify you're using production keys (not testnet)\n" +
                "3. Check that your API key has trading permissions\n" +
                "4. Make sure your API key hasn't expired\n" +
                "Visit https://www.delta.exchange/app/api-management to manage your API keys.",
            )
          } else if (errorData.error?.code === "invalid_signature") {
            throw new Error("Invalid signature. There may be an issue with your API secret or system time.")
          } else if (errorData.error?.code === "insufficient_permissions") {
            throw new Error("Insufficient permissions. Please enable trading permissions for your API key.")
          } else if (errorData.error?.message) {
            throw new Error(`Delta Exchange API: ${errorData.error.message}`)
          } else {
            throw new Error(`Delta Exchange API error: ${JSON.stringify(errorData)}`)
          }
        } catch (readError) {
          console.error("Failed to read error response:", readError)
          throw new Error(`${errorMessage}: Unable to read error details`)
        }
      }

      return response.json()
    } catch (error) {
      console.error("Delta Exchange API request failed:", error)
      throw error
    }
  }

  // Public API methods (no authentication required)
  async getProducts() {
    const response = await fetch(`${DELTA_BASE_URL}/v2/products`)
    return response.json()
  }

  async getTicker(symbol: string) {
    const response = await fetch(`${DELTA_BASE_URL}/v2/tickers/${symbol}`)
    return response.json()
  }

  async getOrderbook(symbol: string) {
    const response = await fetch(`${DELTA_BASE_URL}/v2/l2orderbook/${symbol}`)
    return response.json()
  }

  // Authenticated API methods
  async getBalance() {
    return this.makeAuthenticatedRequest("GET", "/v2/wallet/balances")
  }

  async getPositions() {
    return this.makeAuthenticatedRequest("GET", "/v2/positions")
  }

  async placeOrder(orderData: {
    product_id: number
    size: string
    side: "buy" | "sell"
    order_type: "limit_order" | "market_order"
    limit_price?: string
  }) {
    return this.makeAuthenticatedRequest("POST", "/v2/orders", {}, orderData)
  }

  async cancelOrder(orderId: string) {
    return this.makeAuthenticatedRequest("DELETE", `/v2/orders/${orderId}`)
  }

  async getOrders(states: string[] = ["open"]) {
    return this.makeAuthenticatedRequest("GET", "/v2/orders", { states: states.join(",") })
  }
}

// Utility function to create API instance with provided credentials
export function createDeltaExchangeAPI(apiKey: string, apiSecret: string) {
  return new DeltaExchangeAPI({ apiKey, apiSecret })
}

// Utility function to create API instance from environment variables
export function createDeltaExchangeAPIFromEnv() {
  const credentials = getDeltaCredentials()
  return new DeltaExchangeAPI(credentials)
}
