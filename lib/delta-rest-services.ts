/**
 * Delta Exchange REST API Services
 * Dedicated services for one-time operations following official API documentation
 */

import { DeltaExchangeAPI } from './delta-exchange';

// Order Management Service - REST API for order operations
export class DeltaOrderService {
  private api: DeltaExchangeAPI;

  constructor(apiKey: string, apiSecret: string) {
    this.api = new DeltaExchangeAPI({ apiKey, apiSecret });
  }

  /**
   * Place a single order
   */
  async placeOrder(orderData: {
    product_id: number;
    size: string;
    side: "buy" | "sell";
    order_type: "limit_order" | "market_order";
    limit_price?: string;
    time_in_force?: "gtc" | "ioc";
    reduce_only?: boolean;
    post_only?: boolean;
    client_order_id?: string;
    stop_order_type?: "stop_loss_order" | "take_profit_order";
    stop_price?: string;
    trail_amount?: string;
  }) {
    return this.api.makeAuthenticatedRequest("POST", "/v2/orders", {}, orderData);
  }

  /**
   * Place bracket order (stop loss + take profit)
   */
  async placeBracketOrder(orderData: {
    product_id: number;
    size: string;
    side: "buy" | "sell";
    limit_price: string;
    bracket_stop_loss_price: string;
    bracket_take_profit_price: string;
    bracket_stop_loss_limit_price?: string;
    bracket_take_profit_limit_price?: string;
    bracket_trail_amount?: string;
    time_in_force?: "gtc" | "ioc";
    client_order_id?: string;
  }) {
    return this.api.makeAuthenticatedRequest("POST", "/v2/orders/bracket", {}, orderData);
  }

  /**
   * Place multiple orders in batch
   */
  async placeBatchOrders(orders: Array<{
    product_id: number;
    size: string;
    side: "buy" | "sell";
    order_type: "limit_order" | "market_order";
    limit_price?: string;
    client_order_id?: string;
  }>) {
    return this.api.makeAuthenticatedRequest("POST", "/v2/orders/batch", {}, { orders });
  }

  /**
   * Cancel a single order
   */
  async cancelOrder(orderId: string) {
    return this.api.makeAuthenticatedRequest("DELETE", `/v2/orders/${orderId}`);
  }

  /**
   * Cancel multiple orders in batch
   */
  async cancelBatchOrders(orderIds: string[]) {
    const orders = orderIds.map(id => ({ id }));
    return this.api.makeAuthenticatedRequest("DELETE", "/v2/orders/batch", {}, { orders });
  }

  /**
   * Cancel all open orders with optional filters
   */
  async cancelAllOrders(filters?: {
    product_ids?: number[];
    cancel_limit_orders?: boolean;
    cancel_stop_orders?: boolean;
  }) {
    return this.api.makeAuthenticatedRequest("DELETE", "/v2/orders/all", {}, filters || {});
  }

  /**
   * Edit an existing order
   */
  async editOrder(orderId: string, updates: {
    size?: string;
    limit_price?: string;
    stop_price?: string;
    trail_amount?: string;
  }) {
    return this.api.makeAuthenticatedRequest("PUT", `/v2/orders/${orderId}`, {}, updates);
  }

  /**
   * Edit bracket order
   */
  async editBracketOrder(orderId: string, updates: {
    size?: string;
    limit_price?: string;
    bracket_stop_loss_price?: string;
    bracket_take_profit_price?: string;
    bracket_stop_loss_limit_price?: string;
    bracket_take_profit_limit_price?: string;
  }) {
    return this.api.makeAuthenticatedRequest("PUT", `/v2/orders/bracket/${orderId}`, {}, updates);
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/orders/${orderId}`);
  }

  /**
   * Get order by client order ID
   */
  async getOrderByClientId(clientOrderId: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/orders/client_order_id/${clientOrderId}`);
  }

  /**
   * Get order leverage
   */
  async getOrderLeverage(productId: number) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/orders/leverage/${productId}`);
  }

  /**
   * Change order leverage
   */
  async changeOrderLeverage(productId: number, leverage: number) {
    return this.api.makeAuthenticatedRequest("PUT", `/v2/orders/leverage/${productId}`, {}, { leverage });
  }
}

// Account Management Service - REST API for account operations
export class DeltaAccountService {
  private api: DeltaExchangeAPI;

  constructor(apiKey: string, apiSecret: string) {
    this.api = new DeltaExchangeAPI({ apiKey, apiSecret });
  }

  /**
   * Get wallet balances (initial load)
   */
  async getWalletBalances() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/wallet/balances");
  }

  /**
   * Get margined positions (initial load)
   */
  async getMarginedPositions() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/positions/margined");
  }

  /**
   * Get positions (lightweight, for latest position data)
   */
  async getPositions() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/positions");
  }

  /**
   * Get specific position
   */
  async getPosition(productId: number) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/positions/${productId}`);
  }

  /**
   * Add or remove position margin
   */
  async adjustPositionMargin(productId: number, delta_margin: string) {
    return this.api.makeAuthenticatedRequest("POST", `/v2/positions/change_margin`, {}, {
      product_id: productId,
      delta_margin
    });
  }

  /**
   * Enable/disable auto topup for position
   */
  async setAutoTopup(productId: number, auto_topup: boolean) {
    return this.api.makeAuthenticatedRequest("POST", `/v2/positions/auto_topup`, {}, {
      product_id: productId,
      auto_topup
    });
  }

  /**
   * Close all positions
   */
  async closeAllPositions() {
    return this.api.makeAuthenticatedRequest("POST", "/v2/positions/close_all");
  }

  /**
   * Get user information
   */
  async getUserInfo() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/users");
  }

  /**
   * Get trading preferences
   */
  async getTradingPreferences() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/users/trading_preferences");
  }

  /**
   * Update trading preferences
   */
  async updateTradingPreferences(preferences: {
    email_preference?: boolean;
    sms_preference?: boolean;
    default_leverage?: number;
    mmp_enabled?: boolean;
  }) {
    return this.api.makeAuthenticatedRequest("PUT", "/v2/users/trading_preferences", {}, preferences);
  }

  /**
   * Change margin mode (cross/isolated)
   */
  async changeMarginMode(margin_mode: "cross" | "isolated") {
    return this.api.makeAuthenticatedRequest("POST", "/v2/users/margin_mode", {}, { margin_mode });
  }

  /**
   * Get subaccounts
   */
  async getSubaccounts() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/users/subaccounts");
  }

  /**
   * Request asset transfer between subaccounts
   */
  async transferAsset(transferData: {
    asset: string;
    subaccount: string;
    amount: string;
    transfer_type: "deposit" | "withdrawal";
  }) {
    return this.api.makeAuthenticatedRequest("POST", "/v2/wallet/subaccount_transfer", {}, transferData);
  }
}

// Historical Data Service - REST API for historical data
export class DeltaHistoricalService {
  private api: DeltaExchangeAPI;

  constructor(apiKey: string, apiSecret: string) {
    this.api = new DeltaExchangeAPI({ apiKey, apiSecret });
  }

  /**
   * Get historical OHLC candles
   */
  async getHistoricalCandles(params: {
    symbol: string;
    resolution: "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "2h" | "4h" | "6h" | "12h" | "1d" | "1w" | "2w" | "30d";
    start?: number;
    end?: number;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/history/candles", params);
  }

  /**
   * Get sparkline data
   */
  async getSparklines(symbol: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/history/sparklines/${symbol}`);
  }

  /**
   * Get order history (cancelled and closed orders)
   */
  async getOrderHistory(filters?: {
    product_ids?: number[];
    states?: string[];
    start_time?: number;
    end_time?: number;
    page_size?: number;
    after?: string;
    before?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/orders/history", filters);
  }

  /**
   * Get user fills/trades history
   */
  async getFillsHistory(filters?: {
    product_ids?: number[];
    start_time?: number;
    end_time?: number;
    page_size?: number;
    after?: string;
    before?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/fills", filters);
  }

  /**
   * Download fills history (for large datasets)
   */
  async downloadFillsHistory(filters?: {
    product_ids?: number[];
    start_time?: number;
    end_time?: number;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/fills/history/download", filters);
  }

  /**
   * Get wallet transaction history
   */
  async getWalletTransactions(filters?: {
    asset_ids?: number[];
    transaction_types?: string[];
    start_time?: number;
    end_time?: number;
    page_size?: number;
    after?: string;
    before?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/wallet/transactions", filters);
  }

  /**
   * Download wallet transaction history
   */
  async downloadWalletTransactions(filters?: {
    asset_ids?: number[];
    transaction_types?: string[];
    start_time?: number;
    end_time?: number;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/wallet/transactions/download", filters);
  }

  /**
   * Get subaccount transfer history
   */
  async getSubaccountTransferHistory(filters?: {
    start_time?: number;
    end_time?: number;
    page_size?: number;
    after?: string;
    before?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/wallet/subaccount_transfer_history", filters);
  }
}

// Market Data Service - REST API for static/reference data
export class DeltaMarketDataService {
  private api: DeltaExchangeAPI;

  constructor(apiKey?: string, apiSecret?: string) {
    this.api = new DeltaExchangeAPI({ apiKey: apiKey || '', apiSecret: apiSecret || '' });
  }

  /**
   * Get all products (static data)
   */
  async getProducts(filters?: {
    contract_types?: string[];
    states?: string[];
    page_size?: number;
    after?: string;
    before?: string;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/products", filters);
  }

  /**
   * Get product by symbol
   */
  async getProductBySymbol(symbol: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/products/${symbol}`);
  }

  /**
   * Get all assets
   */
  async getAssets() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/assets");
  }

  /**
   * Get indices
   */
  async getIndices() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/indices");
  }

  /**
   * Get tickers for all products (snapshot)
   */
  async getAllTickers() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/tickers");
  }

  /**
   * Get ticker for specific product
   */
  async getTicker(symbol: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/tickers/${symbol}`);
  }

  /**
   * Get L2 orderbook (snapshot)
   */
  async getOrderbook(symbol: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/l2orderbook/${symbol}`);
  }

  /**
   * Get public trades (snapshot)
   */
  async getPublicTrades(symbol: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/trades/${symbol}`);
  }

  /**
   * Get option chain
   */
  async getOptionChain(symbol: string) {
    return this.api.makeAuthenticatedRequest("GET", `/v2/products/option_chain/${symbol}`);
  }

  /**
   * Get settlement prices
   */
  async getSettlementPrices(filters?: {
    product_ids?: number[];
    settlement_time?: number;
  }) {
    return this.api.makeAuthenticatedRequest("GET", "/v2/settlement_prices", filters);
  }

  /**
   * Get volume stats
   */
  async getVolumeStats() {
    return this.api.makeAuthenticatedRequest("GET", "/v2/stats/volume");
  }
}

// Factory functions for creating services
export function createDeltaOrderService(apiKey: string, apiSecret: string) {
  return new DeltaOrderService(apiKey, apiSecret);
}

export function createDeltaAccountService(apiKey: string, apiSecret: string) {
  return new DeltaAccountService(apiKey, apiSecret);
}

export function createDeltaHistoricalService(apiKey: string, apiSecret: string) {
  return new DeltaHistoricalService(apiKey, apiSecret);
}

export function createDeltaMarketDataService(apiKey?: string, apiSecret?: string) {
  return new DeltaMarketDataService(apiKey, apiSecret);
}
