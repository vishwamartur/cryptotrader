/**
 * Delta Exchange Hybrid Integration Strategy
 * Implements proper separation between REST API and WebSocket usage
 * Based on official Delta Exchange API documentation
 */

'use client';

import { DeltaExchangeAPI } from './delta-exchange';
import { DeltaWebSocketClient } from './delta-websocket-client';

// REST API Service - For one-time operations
export class DeltaRESTService {
  private api: DeltaExchangeAPI;

  constructor(apiKey: string, apiSecret: string) {
    this.api = new DeltaExchangeAPI({ apiKey, apiSecret });
  }

  // ===== ORDER MANAGEMENT (REST API) =====
  
  /**
   * Place a new order - Use REST API for order placement
   */
  async placeOrder(orderData: {
    product_id: number;
    size: string;
    side: "buy" | "sell";
    order_type: "limit_order" | "market_order";
    limit_price?: string;
    time_in_force?: "gtc" | "ioc" | "fok";
    reduce_only?: boolean;
    post_only?: boolean;
    client_order_id?: string;
  }) {
    return this.api.placeOrder(orderData);
  }

  /**
   * Cancel an existing order - Use REST API for order cancellation
   */
  async cancelOrder(orderId: string) {
    return this.api.cancelOrder(orderId);
  }

  /**
   * Edit an existing order - Use REST API for order modification
   */
  async editOrder(orderId: string, updates: {
    size?: string;
    limit_price?: string;
  }) {
    return this.api.makeAuthenticatedRequest("PUT", `/v2/orders/${orderId}`, {}, updates);
  }

  /**
   * Place bracket order - Use REST API for complex order types
   */
  async placeBracketOrder(orderData: {
    product_id: number;
    size: string;
    side: "buy" | "sell";
    limit_price: string;
    stop_loss_price: string;
    take_profit_price: string;
    bracket_stop_loss_limit_price?: string;
    bracket_take_profit_limit_price?: string;
  }) {
    return this.api.makeAuthenticatedRequest("POST", "/v2/orders/bracket", {}, orderData);
  }

  /**
   * Cancel all open orders - Use REST API for bulk operations
   */
  async cancelAllOrders(filters?: {
    product_ids?: number[];
    cancel_limit_orders?: boolean;
    cancel_stop_orders?: boolean;
  }) {
    return this.api.makeAuthenticatedRequest("DELETE", "/v2/orders/all", {}, filters);
  }

  // ===== ACCOUNT SETUP & CONFIGURATION (REST API) =====

  /**
   * Get initial account balances - Use REST API for initial data load
   */
  async getInitialBalances() {
    return this.api.getBalance();
  }

  /**
   * Get initial positions - Use REST API for initial data load
   */
  async getInitialPositions() {
    return this.api.getPositions();
  }

  /**
   * Get product catalog - Use REST API for static data
   */
  async getProducts() {
    return this.api.getProducts();
  }

  /**
   * Get trading preferences - Use REST API for configuration
   */
  async getTradingPreferences() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/users/trading_preferences");
  }

  /**
   * Update trading preferences - Use REST API for configuration
   */
  async updateTradingPreferences(preferences: {
    email_preference?: boolean;
    sms_preference?: boolean;
    default_leverage?: number;
  }) {
    return this.api.makeAuthenticatedRequest("PUT", "/v2/users/trading_preferences", {}, preferences);
  }

  /**
   * Change margin mode - Use REST API for account configuration
   */
  async changeMarginMode(mode: "cross" | "isolated") {
    return this.api.makeAuthenticatedRequest("POST", "/v2/users/margin_mode", {}, { margin_mode: mode });
  }

  // ===== HISTORICAL DATA (REST API) =====

  /**
   * Get historical OHLC candles - Use REST API for historical data
   */
  async getHistoricalCandles(symbol: string, resolution: string, start?: number, end?: number) {
    const params: any = { symbol, resolution };
    if (start) params.start = start;
    if (end) params.end = end;
    
    return this.api.makeAuthenticatedRequest("GET", "/v2/history/candles", params);
  }

  /**
   * Get trade history - Use REST API for historical data
   */
  async getTradeHistory(filters?: {
    product_ids?: number[];
    start_time?: number;
    end_time?: number;
    page_size?: number;
    after?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/fills", filters);
  }

  /**
   * Get wallet transaction history - Use REST API for historical data
   */
  async getWalletTransactions(filters?: {
    asset_ids?: number[];
    transaction_types?: string[];
    start_time?: number;
    end_time?: number;
    page_size?: number;
    after?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/wallet/transactions", filters);
  }

  // ===== AUTHENTICATION & VALIDATION (REST API) =====

  /**
   * Test API connection - Use REST API for validation
   */
  async testConnection() {
    try {
      const balance = await this.api.getBalance();
      const products = await this.api.getProducts();
      
      return {
        success: true,
        balanceCount: balance.result?.length || 0,
        productsCount: products.result?.length || 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }
}

// WebSocket Service - For real-time streaming
export class DeltaWebSocketService {
  private client: DeltaWebSocketClient;
  private subscriptions: Map<string, Set<string>> = new Map();

  constructor(apiKey?: string, apiSecret?: string) {
    this.client = new DeltaWebSocketClient({
      apiKey,
      apiSecret,
      environment: 'production'
    });
  }

  // ===== REAL-TIME MARKET DATA (WebSocket) =====

  /**
   * Subscribe to real-time ticker data - Use WebSocket for live updates
   */
  subscribeToTickers(symbols: string[] = ['all']) {
    return this.client.subscribe([{
      name: 'v2/ticker',
      symbols
    }]);
  }

  /**
   * Subscribe to real-time order book - Use WebSocket for live updates
   */
  subscribeToOrderBook(symbols: string[], level: 'l1' | 'l2' = 'l2') {
    return this.client.subscribe([{
      name: `${level}_orderbook`,
      symbols
    }]);
  }

  /**
   * Subscribe to real-time trades - Use WebSocket for live updates
   */
  subscribeToTrades(symbols: string[] = ['all']) {
    return this.client.subscribe([{
      name: 'all_trades',
      symbols
    }]);
  }

  /**
   * Subscribe to mark price updates - Use WebSocket for live updates
   */
  subscribeToMarkPrices(symbols: string[]) {
    const markSymbols = symbols.map(s => `MARK:${s}`);
    return this.client.subscribe([{
      name: 'mark_price',
      symbols: markSymbols
    }]);
  }

  // ===== REAL-TIME PORTFOLIO DATA (WebSocket) =====

  /**
   * Subscribe to balance updates - Use WebSocket for live updates
   */
  subscribeToBalances() {
    return this.client.subscribe([{
      name: 'margins'
    }]);
  }

  /**
   * Subscribe to position updates - Use WebSocket for live updates
   */
  subscribeToPositions(symbols: string[] = ['all']) {
    return this.client.subscribe([{
      name: 'positions',
      symbols
    }]);
  }

  /**
   * Subscribe to order updates - Use WebSocket for live updates
   */
  subscribeToOrders(symbols: string[] = ['all']) {
    return this.client.subscribe([{
      name: 'orders',
      symbols
    }]);
  }

  /**
   * Subscribe to trade notifications - Use WebSocket for live updates
   */
  subscribeToUserTrades(symbols: string[] = ['all']) {
    return this.client.subscribe([{
      name: 'v2/user_trades',
      symbols
    }]);
  }

  // ===== CONNECTION MANAGEMENT =====

  async connect() {
    return this.client.connect();
  }

  disconnect() {
    this.client.disconnect();
  }

  onMessage(callback: (message: any) => void) {
    return this.client.onMessage(callback);
  }

  getConnectionStatus() {
    return this.client.getConnectionStatus();
  }
}

// Hybrid Integration Manager - Coordinates REST and WebSocket services
export class DeltaHybridIntegration {
  public rest: DeltaRESTService;
  public websocket: DeltaWebSocketService;

  constructor(apiKey: string, apiSecret: string) {
    this.rest = new DeltaRESTService(apiKey, apiSecret);
    this.websocket = new DeltaWebSocketService(apiKey, apiSecret);
  }

  /**
   * Initialize the hybrid integration
   * 1. Test REST API connection
   * 2. Load initial data via REST API
   * 3. Connect WebSocket for real-time updates
   */
  async initialize() {
    try {
      // Step 1: Test REST API connection
      const connectionTest = await this.rest.testConnection();
      if (!connectionTest.success) {
        throw new Error(`REST API connection failed: ${connectionTest.error}`);
      }

      // Step 2: Load initial data via REST API
      const [products, balances, positions] = await Promise.all([
        this.rest.getProducts(),
        this.rest.getInitialBalances(),
        this.rest.getInitialPositions()
      ]);

      // Step 3: Connect WebSocket for real-time updates
      await this.websocket.connect();

      // Step 4: Subscribe to real-time data streams
      await Promise.all([
        this.websocket.subscribeToTickers(['all']),
        this.websocket.subscribeToBalances(),
        this.websocket.subscribeToPositions(['all']),
        this.websocket.subscribeToOrders(['all']),
        this.websocket.subscribeToUserTrades(['all'])
      ]);

      return {
        success: true,
        initialData: {
          products: products.result || [],
          balances: balances.result || [],
          positions: positions.result || []
        },
        websocketConnected: true
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      };
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.websocket.disconnect();
  }
}

// Factory function to create hybrid integration
export function createDeltaHybridIntegration(apiKey: string, apiSecret: string) {
  return new DeltaHybridIntegration(apiKey, apiSecret);
}
