/**
 * Enhanced Delta Exchange WebSocket Integration
 * Improved real-time data streaming with proper channel management
 * Based on official Delta Exchange WebSocket documentation
 */

'use client';

import { EventEmitter } from 'events';
import { DeltaWebSocketClient } from './delta-websocket-client';

// Enhanced WebSocket channel types
export interface WebSocketChannel {
  name: string;
  symbols?: string[];
}

export interface WebSocketSubscription {
  channel: string;
  symbols: string[];
  subscribed: boolean;
  lastUpdate: number;
}

export interface MarketDataUpdate {
  symbol: string;
  type: string;
  data: any;
  timestamp: number;
}

export interface PortfolioUpdate {
  type: 'balance' | 'position' | 'order' | 'trade';
  data: any;
  timestamp: number;
}

// Enhanced WebSocket Manager
export class EnhancedDeltaWebSocket extends EventEmitter {
  private client: DeltaWebSocketClient;
  private subscriptions: Map<string, WebSocketSubscription> = new Map();
  private marketData: Map<string, any> = new Map();
  private portfolioData: {
    balances: Map<string, any>;
    positions: Map<string, any>;
    orders: Map<string, any>;
    trades: any[];
  } = {
    balances: new Map(),
    positions: new Map(),
    orders: new Map(),
    trades: []
  };

  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isReconnecting = false;

  constructor(config: {
    apiKey?: string;
    apiSecret?: string;
    environment?: 'production' | 'testnet';
  } = {}) {
    super();
    
    this.client = new DeltaWebSocketClient({
      apiKey: config.apiKey || '',
      apiSecret: config.apiSecret || '',
      environment: config.environment || 'production'
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('connected', () => {
      console.log('[Enhanced WebSocket] Connected to Delta Exchange');
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.emit('connected');
      this.resubscribeAll();
    });

    this.client.on('disconnected', (reason) => {
      console.log('[Enhanced WebSocket] Disconnected:', reason);
      this.emit('disconnected', reason);
      this.handleReconnection();
    });

    this.client.on('authenticated', () => {
      console.log('[Enhanced WebSocket] Authenticated successfully');
      this.emit('authenticated');
    });

    this.client.on('error', (error) => {
      console.error('[Enhanced WebSocket] Error:', error);
      this.emit('error', error);
    });

    this.client.onMessage((message) => {
      this.handleMessage(message);
    });
  }

  private handleMessage(message: any) {
    try {
      const { type, symbol } = message;

      // Handle market data updates
      if (this.isMarketDataChannel(type)) {
        this.handleMarketDataUpdate(message);
      }
      // Handle portfolio updates
      else if (this.isPortfolioChannel(type)) {
        this.handlePortfolioUpdate(message);
      }
      // Handle system updates
      else if (this.isSystemChannel(type)) {
        this.handleSystemUpdate(message);
      }

      // Emit raw message for custom handling
      this.emit('message', message);
    } catch (error) {
      console.error('[Enhanced WebSocket] Error handling message:', error);
      this.emit('error', error);
    }
  }

  private isMarketDataChannel(type: string): boolean {
    return [
      'v2/ticker', 'ticker',
      'l1_orderbook', 'l2_orderbook', 'l2_updates',
      'all_trades', 'mark_price', 'candlestick_1m', 'candlestick_5m',
      'spot_price', 'v2/spot_price', 'funding_rate'
    ].includes(type);
  }

  private isPortfolioChannel(type: string): boolean {
    return [
      'margins', 'positions', 'orders', 'user_trades', 'v2/user_trades',
      'portfolio_margins'
    ].includes(type);
  }

  private isSystemChannel(type: string): boolean {
    return [
      'product_updates', 'announcements', 'mmp_trigger'
    ].includes(type);
  }

  private handleMarketDataUpdate(message: any) {
    const { type, symbol } = message;
    
    // Store market data
    if (symbol) {
      const key = `${symbol}_${type}`;
      this.marketData.set(key, {
        ...message,
        lastUpdate: Date.now()
      });
    }

    // Emit specific market data events
    this.emit('marketData', {
      symbol,
      type,
      data: message,
      timestamp: Date.now()
    } as MarketDataUpdate);

    // Emit channel-specific events
    this.emit(`marketData:${type}`, message);
    if (symbol) {
      this.emit(`marketData:${symbol}:${type}`, message);
    }
  }

  private handlePortfolioUpdate(message: any) {
    const { type, symbol, action } = message;

    // Handle different portfolio update types
    switch (type) {
      case 'margins':
        this.portfolioData.balances.set(message.asset_symbol || message.asset_id, message);
        this.emit('portfolioUpdate', {
          type: 'balance',
          data: message,
          timestamp: Date.now()
        } as PortfolioUpdate);
        break;

      case 'positions':
        if (symbol) {
          if (action === 'delete') {
            this.portfolioData.positions.delete(symbol);
          } else {
            this.portfolioData.positions.set(symbol, message);
          }
        }
        this.emit('portfolioUpdate', {
          type: 'position',
          data: message,
          timestamp: Date.now()
        } as PortfolioUpdate);
        break;

      case 'orders':
        if (message.order_id) {
          if (action === 'delete' || message.state === 'cancelled' || message.state === 'closed') {
            this.portfolioData.orders.delete(message.order_id);
          } else {
            this.portfolioData.orders.set(message.order_id, message);
          }
        }
        this.emit('portfolioUpdate', {
          type: 'order',
          data: message,
          timestamp: Date.now()
        } as PortfolioUpdate);
        break;

      case 'user_trades':
      case 'v2/user_trades':
        this.portfolioData.trades.unshift(message);
        // Keep only last 1000 trades
        if (this.portfolioData.trades.length > 1000) {
          this.portfolioData.trades = this.portfolioData.trades.slice(0, 1000);
        }
        this.emit('portfolioUpdate', {
          type: 'trade',
          data: message,
          timestamp: Date.now()
        } as PortfolioUpdate);
        break;
    }

    // Emit channel-specific events
    this.emit(`portfolio:${type}`, message);
  }

  private handleSystemUpdate(message: any) {
    const { type } = message;
    
    this.emit('systemUpdate', message);
    this.emit(`system:${type}`, message);

    // Handle specific system events
    if (type === 'product_updates') {
      this.emit('productUpdate', message);
    } else if (type === 'announcements') {
      this.emit('announcement', message);
    } else if (type === 'mmp_trigger') {
      this.emit('mmpTrigger', message);
    }
  }

  private handleReconnection() {
    if (this.isReconnecting || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`[Enhanced WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[Enhanced WebSocket] Reconnection failed:', error);
        this.isReconnecting = false;
        this.handleReconnection();
      });
    }, delay);
  }

  private async resubscribeAll() {
    const subscriptions = Array.from(this.subscriptions.values());
    
    for (const subscription of subscriptions) {
      if (subscription.subscribed) {
        try {
          await this.client.subscribe([{
            name: subscription.channel,
            symbols: subscription.symbols
          }]);
          console.log(`[Enhanced WebSocket] Resubscribed to ${subscription.channel}`);
        } catch (error) {
          console.error(`[Enhanced WebSocket] Failed to resubscribe to ${subscription.channel}:`, error);
        }
      }
    }
  }

  // ===== PUBLIC API =====

  async connect() {
    try {
      await this.client.connect();
      return true;
    } catch (error) {
      console.error('[Enhanced WebSocket] Connection failed:', error);
      throw error;
    }
  }

  disconnect() {
    this.client.disconnect();
    this.subscriptions.clear();
    this.marketData.clear();
    this.portfolioData.balances.clear();
    this.portfolioData.positions.clear();
    this.portfolioData.orders.clear();
    this.portfolioData.trades = [];
  }

  // ===== MARKET DATA SUBSCRIPTIONS =====

  async subscribeToTickers(symbols: string[] = ['all']) {
    return this.subscribe('v2/ticker', symbols);
  }

  async subscribeToOrderBooks(symbols: string[], level: 'l1' | 'l2' = 'l2') {
    return this.subscribe(`${level}_orderbook`, symbols);
  }

  async subscribeToTrades(symbols: string[] = ['all']) {
    return this.subscribe('all_trades', symbols);
  }

  async subscribeToMarkPrices(symbols: string[]) {
    const markSymbols = symbols.map(s => `MARK:${s}`);
    return this.subscribe('mark_price', markSymbols);
  }

  async subscribeToCandlesticks(symbols: string[], resolution: string = '1m') {
    return this.subscribe(`candlestick_${resolution}`, symbols);
  }

  // ===== PORTFOLIO SUBSCRIPTIONS =====

  async subscribeToBalances() {
    return this.subscribe('margins', []);
  }

  async subscribeToPositions(symbols: string[] = ['all']) {
    return this.subscribe('positions', symbols);
  }

  async subscribeToOrders(symbols: string[] = ['all']) {
    return this.subscribe('orders', symbols);
  }

  async subscribeToUserTrades(symbols: string[] = ['all']) {
    return this.subscribe('v2/user_trades', symbols);
  }

  async subscribeToPortfolioMargins() {
    return this.subscribe('portfolio_margins', []);
  }

  // ===== SYSTEM SUBSCRIPTIONS =====

  async subscribeToProductUpdates() {
    return this.subscribe('product_updates', []);
  }

  async subscribeToAnnouncements() {
    return this.subscribe('announcements', []);
  }

  async subscribeToMmpTrigger() {
    return this.subscribe('mmp_trigger', []);
  }

  // ===== SUBSCRIPTION MANAGEMENT =====

  private async subscribe(channel: string, symbols: string[]) {
    try {
      await this.client.subscribe([{ name: channel, symbols }]);
      
      const key = `${channel}_${symbols.join(',')}`;
      this.subscriptions.set(key, {
        channel,
        symbols,
        subscribed: true,
        lastUpdate: Date.now()
      });

      console.log(`[Enhanced WebSocket] Subscribed to ${channel} with symbols:`, symbols);
      return true;
    } catch (error) {
      console.error(`[Enhanced WebSocket] Failed to subscribe to ${channel}:`, error);
      throw error;
    }
  }

  async unsubscribe(channel: string, symbols: string[]) {
    try {
      await this.client.unsubscribe([{ name: channel, symbols }]);
      
      const key = `${channel}_${symbols.join(',')}`;
      this.subscriptions.delete(key);

      console.log(`[Enhanced WebSocket] Unsubscribed from ${channel}`);
      return true;
    } catch (error) {
      console.error(`[Enhanced WebSocket] Failed to unsubscribe from ${channel}:`, error);
      throw error;
    }
  }

  // ===== DATA ACCESS =====

  getMarketData(symbol: string, type: string) {
    const key = `${symbol}_${type}`;
    return this.marketData.get(key);
  }

  getAllMarketData() {
    return Array.from(this.marketData.values());
  }

  getBalance(asset: string) {
    return this.portfolioData.balances.get(asset);
  }

  getAllBalances() {
    return Array.from(this.portfolioData.balances.values());
  }

  getPosition(symbol: string) {
    return this.portfolioData.positions.get(symbol);
  }

  getAllPositions() {
    return Array.from(this.portfolioData.positions.values());
  }

  getOrder(orderId: string) {
    return this.portfolioData.orders.get(orderId);
  }

  getAllOrders() {
    return Array.from(this.portfolioData.orders.values());
  }

  getRecentTrades(limit: number = 100) {
    return this.portfolioData.trades.slice(0, limit);
  }

  // ===== STATUS =====

  getConnectionStatus() {
    return this.client.getConnectionStatus();
  }

  getSubscriptions() {
    return Array.from(this.subscriptions.values());
  }

  isConnected() {
    return this.client.getConnectionStatus().connected;
  }

  isAuthenticated() {
    return this.client.getConnectionStatus().authenticated;
  }
}

// Factory function
export function createEnhancedDeltaWebSocket(config: {
  apiKey?: string;
  apiSecret?: string;
  environment?: 'production' | 'testnet';
} = {}) {
  return new EnhancedDeltaWebSocket(config);
}
