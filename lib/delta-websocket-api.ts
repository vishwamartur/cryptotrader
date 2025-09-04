import { EventEmitter } from 'events';
import { DeltaWebSocketClient, SubscriptionChannel } from './delta-websocket-client';
import { DeltaExchangeAPI } from './delta-exchange';

export interface RealtimeTickerData {
  symbol: string;
  price: string;
  change: string;
  changePercent: string;
  volume: string;
  high: string;
  low: string;
  markPrice?: string;
  spotPrice?: string;
  timestamp: number;
}

export interface RealtimeOrderbookData {
  symbol: string;
  buy: Array<{ price: string; size: string }>;
  sell: Array<{ price: string; size: string }>;
  timestamp: number;
  checksum?: string;
}

export interface RealtimeTradeData {
  symbol: string;
  price: string;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
  tradeId?: string;
  buyerRole?: 'maker' | 'taker';
  sellerRole?: 'maker' | 'taker';
}

export interface RealtimeBalanceData {
  assetSymbol: string;
  availableBalance: string;
  walletBalance: string;
  blockedMargin: string;
  unrealizedPnl?: string;
  timestamp: number;
}

export interface RealtimePositionData {
  symbol: string;
  productId: number;
  size: string;
  entryPrice: string;
  margin: string;
  liquidationPrice?: string;
  bankruptcyPrice?: string;
  realizedPnl: string;
  unrealizedPnl?: string;
  timestamp: number;
}

export interface RealtimeOrderData {
  orderId: number;
  clientOrderId?: string;
  symbol: string;
  productId: number;
  side: 'buy' | 'sell';
  size: string;
  unfilledSize: string;
  limitPrice?: string;
  averageFillPrice?: string;
  state: 'open' | 'pending' | 'closed' | 'cancelled';
  orderType: string;
  timestamp: number;
  reason?: string;
}

export class DeltaWebSocketAPI extends EventEmitter {
  private wsClient: DeltaWebSocketClient;
  private restClient: DeltaExchangeAPI;
  private tickerCache: Map<string, RealtimeTickerData> = new Map();
  private orderbookCache: Map<string, RealtimeOrderbookData> = new Map();
  private balanceCache: Map<string, RealtimeBalanceData> = new Map();
  private positionCache: Map<string, RealtimePositionData> = new Map();
  private orderCache: Map<number, RealtimeOrderData> = new Map();
  private subscribedSymbols: Set<string> = new Set();

  constructor(wsClient: DeltaWebSocketClient, restClient: DeltaExchangeAPI) {
    super();
    this.wsClient = wsClient;
    this.restClient = restClient;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // WebSocket connection events
    this.wsClient.on('connected', () => {
      console.log('[DeltaWSAPI] WebSocket connected');
      this.emit('connected');
    });

    this.wsClient.on('disconnected', (data) => {
      console.log('[DeltaWSAPI] WebSocket disconnected:', data);
      this.emit('disconnected', data);
    });

    this.wsClient.on('authenticated', () => {
      console.log('[DeltaWSAPI] WebSocket authenticated');
      this.emit('authenticated');
    });

    this.wsClient.on('error', (error) => {
      console.error('[DeltaWSAPI] WebSocket error:', error);
      this.emit('error', error);
    });

    // Message handlers for different data types
    this.wsClient.addMessageHandler('v2_ticker', this.handleTickerUpdate.bind(this));
    this.wsClient.addMessageHandler('l2_orderbook', this.handleOrderbookSnapshot.bind(this));
    this.wsClient.addMessageHandler('l2_updates', this.handleOrderbookUpdate.bind(this));
    this.wsClient.addMessageHandler('all_trades', this.handleTradeUpdate.bind(this));
    this.wsClient.addMessageHandler('all_trades_snapshot', this.handleTradeSnapshot.bind(this));
    this.wsClient.addMessageHandler('margins', this.handleBalanceUpdate.bind(this));
    this.wsClient.addMessageHandler('positions', this.handlePositionUpdate.bind(this));
    this.wsClient.addMessageHandler('orders', this.handleOrderUpdate.bind(this));
    this.wsClient.addMessageHandler('v2/user_trades', this.handleUserTradeUpdate.bind(this));
  }

  async connect(): Promise<void> {
    await this.wsClient.connect();
  }

  disconnect(): void {
    this.wsClient.disconnect();
  }

  // Real-time price feed methods
  subscribeToTickers(symbols: string[]): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'v2_ticker',
        symbols: symbols,
      },
    ];

    this.wsClient.subscribe(channels);
    symbols.forEach(symbol => this.subscribedSymbols.add(symbol));
    this.emit('subscribed', { type: 'tickers', symbols });
  }

  unsubscribeFromTickers(symbols: string[]): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'v2_ticker',
        symbols: symbols,
      },
    ];

    this.wsClient.unsubscribe(channels);
    symbols.forEach(symbol => this.subscribedSymbols.delete(symbol));
    this.emit('unsubscribed', { type: 'tickers', symbols });
  }

  // Real-time order book methods
  subscribeToOrderbook(symbols: string[]): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'l2_orderbook',
        symbols: symbols,
      },
      {
        name: 'l2_updates',
        symbols: symbols,
      },
    ];

    this.wsClient.subscribe(channels);
    this.emit('subscribed', { type: 'orderbook', symbols });
  }

  unsubscribeFromOrderbook(symbols: string[]): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'l2_orderbook',
        symbols: symbols,
      },
      {
        name: 'l2_updates',
        symbols: symbols,
      },
    ];

    this.wsClient.unsubscribe(channels);
    this.emit('unsubscribed', { type: 'orderbook', symbols });
  }

  // Real-time trade methods
  subscribeToTrades(symbols: string[]): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'all_trades',
        symbols: symbols,
      },
    ];

    this.wsClient.subscribe(channels);
    this.emit('subscribed', { type: 'trades', symbols });
  }

  unsubscribeFromTrades(symbols: string[]): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'all_trades',
        symbols: symbols,
      },
    ];

    this.wsClient.unsubscribe(channels);
    this.emit('unsubscribed', { type: 'trades', symbols });
  }

  // Real-time account data methods (requires authentication)
  subscribeToBalances(): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'margins',
        symbols: ['all'],
      },
    ];

    this.wsClient.subscribe(channels);
    this.emit('subscribed', { type: 'balances', symbols: ['all'] });
  }

  subscribeToPositions(symbols: string[] = ['all']): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'positions',
        symbols: symbols,
      },
    ];

    this.wsClient.subscribe(channels);
    this.emit('subscribed', { type: 'positions', symbols });
  }

  subscribeToOrders(symbols: string[] = ['all']): void {
    const channels: SubscriptionChannel[] = [
      {
        name: 'orders',
        symbols: symbols,
      },
      {
        name: 'v2/user_trades',
        symbols: symbols,
      },
    ];

    this.wsClient.subscribe(channels);
    this.emit('subscribed', { type: 'orders', symbols });
  }

  // Data access methods
  getTicker(symbol: string): RealtimeTickerData | null {
    return this.tickerCache.get(symbol) || null;
  }

  getAllTickers(): RealtimeTickerData[] {
    return Array.from(this.tickerCache.values());
  }

  getOrderbook(symbol: string): RealtimeOrderbookData | null {
    return this.orderbookCache.get(symbol) || null;
  }

  getBalances(): RealtimeBalanceData[] {
    return Array.from(this.balanceCache.values());
  }

  getBalance(assetSymbol: string): RealtimeBalanceData | null {
    return this.balanceCache.get(assetSymbol) || null;
  }

  getPositions(): RealtimePositionData[] {
    return Array.from(this.positionCache.values());
  }

  getPosition(symbol: string): RealtimePositionData | null {
    return this.positionCache.get(symbol) || null;
  }

  getOrders(): RealtimeOrderData[] {
    return Array.from(this.orderCache.values());
  }

  getOrder(orderId: number): RealtimeOrderData | null {
    return this.orderCache.get(orderId) || null;
  }

  // Fallback to REST API for trading operations
  async placeOrder(orderData: any): Promise<any> {
    return this.restClient.placeOrder(orderData);
  }

  async cancelOrder(orderId: string): Promise<any> {
    return this.restClient.cancelOrder(orderId);
  }

  async getProducts(): Promise<any> {
    return this.restClient.getProducts();
  }

  // Message handlers
  private handleTickerUpdate(data: any): void {
    const tickerData: RealtimeTickerData = {
      symbol: data.symbol || data.s,
      price: data.price || data.p,
      change: data.change || data.c,
      changePercent: data.change_percent || data.cp,
      volume: data.volume || data.v,
      high: data.high || data.h,
      low: data.low || data.l,
      markPrice: data.mark_price || data.mp,
      spotPrice: data.spot_price || data.sp,
      timestamp: data.timestamp || Date.now(),
    };

    this.tickerCache.set(tickerData.symbol, tickerData);
    this.emit('ticker', tickerData);
    this.emit(`ticker:${tickerData.symbol}`, tickerData);
  }

  private handleOrderbookSnapshot(data: any): void {
    const orderbookData: RealtimeOrderbookData = {
      symbol: data.symbol,
      buy: data.buy || [],
      sell: data.sell || [],
      timestamp: data.timestamp || Date.now(),
      checksum: data.checksum,
    };

    this.orderbookCache.set(orderbookData.symbol, orderbookData);
    this.emit('orderbook', orderbookData);
    this.emit(`orderbook:${orderbookData.symbol}`, orderbookData);
  }

  private handleOrderbookUpdate(data: any): void {
    const symbol = data.symbol;
    const existingOrderbook = this.orderbookCache.get(symbol);
    
    if (existingOrderbook) {
      // Apply incremental updates
      if (data.buy) {
        this.applyOrderbookUpdates(existingOrderbook.buy, data.buy);
      }
      if (data.sell) {
        this.applyOrderbookUpdates(existingOrderbook.sell, data.sell);
      }
      
      existingOrderbook.timestamp = data.timestamp || Date.now();
      existingOrderbook.checksum = data.checksum;
      
      this.emit('orderbook', existingOrderbook);
      this.emit(`orderbook:${symbol}`, existingOrderbook);
    }
  }

  private applyOrderbookUpdates(existing: Array<{ price: string; size: string }>, updates: Array<{ price: string; size: string }>): void {
    updates.forEach(update => {
      const index = existing.findIndex(entry => entry.price === update.price);
      if (parseFloat(update.size) === 0) {
        // Remove entry if size is 0
        if (index !== -1) {
          existing.splice(index, 1);
        }
      } else {
        // Update or add entry
        if (index !== -1) {
          existing[index] = update;
        } else {
          existing.push(update);
          existing.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        }
      }
    });
  }

  private handleTradeUpdate(data: any): void {
    const tradeData: RealtimeTradeData = {
      symbol: data.symbol,
      price: data.price,
      size: data.size,
      side: data.side,
      timestamp: data.timestamp || Date.now(),
      tradeId: data.trade_id,
      buyerRole: data.buyer_role,
      sellerRole: data.seller_role,
    };

    this.emit('trade', tradeData);
    this.emit(`trade:${tradeData.symbol}`, tradeData);
  }

  private handleTradeSnapshot(data: any): void {
    if (data.trades && Array.isArray(data.trades)) {
      data.trades.forEach((trade: any) => {
        this.handleTradeUpdate({ ...trade, symbol: data.symbol });
      });
    }
  }

  private handleBalanceUpdate(data: any): void {
    const balanceData: RealtimeBalanceData = {
      assetSymbol: data.asset_symbol,
      availableBalance: data.available_balance,
      walletBalance: data.balance,
      blockedMargin: data.blocked_margin,
      unrealizedPnl: data.unrealized_pnl,
      timestamp: data.timestamp || Date.now(),
    };

    this.balanceCache.set(balanceData.assetSymbol, balanceData);
    this.emit('balance', balanceData);
    this.emit(`balance:${balanceData.assetSymbol}`, balanceData);
  }

  private handlePositionUpdate(data: any): void {
    const positionData: RealtimePositionData = {
      symbol: data.symbol,
      productId: data.product_id,
      size: data.size?.toString() || '0',
      entryPrice: data.entry_price,
      margin: data.margin,
      liquidationPrice: data.liquidation_price,
      bankruptcyPrice: data.bankruptcy_price,
      realizedPnl: data.realized_pnl || '0',
      unrealizedPnl: data.unrealized_pnl,
      timestamp: data.timestamp || Date.now(),
    };

    if (parseFloat(positionData.size) === 0) {
      this.positionCache.delete(positionData.symbol);
    } else {
      this.positionCache.set(positionData.symbol, positionData);
    }

    this.emit('position', positionData);
    this.emit(`position:${positionData.symbol}`, positionData);
  }

  private handleOrderUpdate(data: any): void {
    const orderData: RealtimeOrderData = {
      orderId: data.order_id,
      clientOrderId: data.client_order_id,
      symbol: data.symbol,
      productId: data.product_id,
      side: data.side,
      size: data.size?.toString() || '0',
      unfilledSize: data.unfilled_size?.toString() || '0',
      limitPrice: data.limit_price,
      averageFillPrice: data.average_fill_price,
      state: data.state,
      orderType: data.order_type || 'limit_order',
      timestamp: data.timestamp || Date.now(),
      reason: data.reason,
    };

    if (orderData.state === 'closed' || orderData.state === 'cancelled') {
      this.orderCache.delete(orderData.orderId);
    } else {
      this.orderCache.set(orderData.orderId, orderData);
    }

    this.emit('order', orderData);
    this.emit(`order:${orderData.symbol}`, orderData);
  }

  private handleUserTradeUpdate(data: any): void {
    const tradeData = {
      fillId: data.f,
      symbol: data.sy,
      orderId: data.o,
      side: data.S,
      size: data.s,
      price: data.p,
      role: data.r,
      timestamp: data.t,
      reason: data.R,
    };

    this.emit('userTrade', tradeData);
    this.emit(`userTrade:${tradeData.symbol}`, tradeData);
  }

  getConnectionStatus() {
    return this.wsClient.getConnectionStatus();
  }
}

// Factory function
export function createDeltaWebSocketAPI(wsClient: DeltaWebSocketClient, restClient: DeltaExchangeAPI): DeltaWebSocketAPI {
  return new DeltaWebSocketAPI(wsClient, restClient);
}
