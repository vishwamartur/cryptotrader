import crypto from "crypto"

// Delta Exchange API configuration
const DELTA_BASE_URL = "https://api.delta.exchange"

interface DeltaExchangeConfig {
  apiKey: string
  apiSecret: string
}

export class DeltaExchangeAPI {
  private apiKey: string
  private apiSecret: string

  constructor(config: DeltaExchangeConfig) {
    this.apiKey = config.apiKey
    this.apiSecret = config.apiSecret
  }

  // Generate signature for authenticated requests
  private generateSignature(
    method: string,
    timestamp: string,
    requestPath: string,
    queryParams = "",
    body = "",
  ): string {
    // Delta Exchange expects: method + timestamp + requestPath + queryParams + body
    // Query params should NOT include the leading "?" in signature
    const message = method + timestamp + requestPath + queryParams + body
    return crypto.createHmac("sha256", this.apiSecret).update(message).digest("hex")
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
    const signature = this.generateSignature(
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
        const errorText = await response.text()
        console.error(`Delta Exchange API Error ${response.status}:`, errorText)
        throw new Error(`Delta Exchange API error: ${response.status}`)
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

// Utility function to create API instance
export function createDeltaExchangeAPI(apiKey: string, apiSecret: string) {
  return new DeltaExchangeAPI({ apiKey, apiSecret })
}
