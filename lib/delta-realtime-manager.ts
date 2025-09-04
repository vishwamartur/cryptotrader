'use client';

import { EventEmitter } from 'events';
import { createDeltaWebSocketClient, DeltaWebSocketClient } from './delta-websocket-client';
import { createDeltaWebSocketAPI, DeltaWebSocketAPI } from './delta-websocket-api';
import { createDeltaExchangeAPIFromEnv } from './delta-exchange';
import { WebSocketPerformanceMonitor, createPerformanceMonitor } from './websocket-performance-monitor';

export interface RealtimeDataStreams {
  tickers: Map<string, any>;
  orderbooks: Map<string, any>;
  trades: Map<string, any[]>;
  balances: Map<string, any>;
  positions: Map<string, any>;
  orders: Map<number, any>;
  userTrades: any[];
}

export interface ConnectionHealth {
  connected: boolean;
  authenticated: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  latency: number;
  messagesReceived: number;
  messagesSent: number;
  subscriptions: string[];
  errors: string[];
}

export interface SubscriptionConfig {
  tickers?: string[];
  orderbooks?: string[];
  trades?: string[];
  includeUserData?: boolean;
  maxTradeHistory?: number;
  maxOrderbookLevels?: number;
}

export class DeltaRealtimeManager extends EventEmitter {
  private wsClient: DeltaWebSocketClient;
  private wsAPI: DeltaWebSocketAPI;
  private dataStreams: RealtimeDataStreams;
  private subscriptionConfig: SubscriptionConfig;
  private isInitialized = false;
  private connectionHealth: ConnectionHealth;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private performanceMonitor: WebSocketPerformanceMonitor;

  constructor(config: SubscriptionConfig = {}) {
    super();
    
    this.subscriptionConfig = {
      maxTradeHistory: 100,
      maxOrderbookLevels: 20,
      includeUserData: false,
      ...config,
    };

    this.dataStreams = {
      tickers: new Map(),
      orderbooks: new Map(),
      trades: new Map(),
      balances: new Map(),
      positions: new Map(),
      orders: new Map(),
      userTrades: [],
    };

    this.connectionHealth = {
      connected: false,
      authenticated: false,
      reconnectAttempts: 0,
      lastHeartbeat: 0,
      latency: 0,
      messagesReceived: 0,
      messagesSent: 0,
      subscriptions: [],
      errors: [],
    };

    this.performanceMonitor = createPerformanceMonitor({
      maxLatency: 500,
      maxMemoryMB: 50,
      maxErrorRate: 0.02,
      minMessagesPerSecond: 1
    });

    this.setupPerformanceMonitoring();
    this.initializeWebSocket();
  }

  private setupPerformanceMonitoring(): void {
    // Forward performance events
    this.performanceMonitor.on('alert', (alert) => {
      console.warn('[DeltaRealtimeManager] Performance alert:', alert);
      this.emit('performanceAlert', alert);
    });

    this.performanceMonitor.on('metricsUpdated', (metrics) => {
      this.emit('performanceMetrics', metrics);
    });

    this.performanceMonitor.on('error', (error) => {
      console.error('[DeltaRealtimeManager] Performance monitor error:', error);
    });
  }

  private initializeWebSocket(): void {
    try {
      this.wsClient = createDeltaWebSocketClient();
      const restClient = createDeltaExchangeAPIFromEnv();
      this.wsAPI = createDeltaWebSocketAPI(this.wsClient, restClient);

      this.setupEventHandlers();
      this.isInitialized = true;
      
      console.log('[DeltaRealtimeManager] Initialized successfully');
    } catch (error) {
      console.error('[DeltaRealtimeManager] Failed to initialize:', error);
      this.emit('error', error);
    }
  }

  private setupEventHandlers(): void {
    // Connection events
    this.wsAPI.on('connected', () => {
      console.log('[DeltaRealtimeManager] Connected to WebSocket');
      this.connectionHealth.connected = true;
      this.connectionHealth.reconnectAttempts = 0;
      this.startHealthCheck();
      this.emit('connected');
    });

    this.wsAPI.on('disconnected', (data) => {
      console.log('[DeltaRealtimeManager] Disconnected from WebSocket:', data);
      this.connectionHealth.connected = false;
      this.connectionHealth.authenticated = false;
      this.stopHealthCheck();
      this.emit('disconnected', data);
    });

    this.wsAPI.on('authenticated', () => {
      console.log('[DeltaRealtimeManager] Authenticated');
      this.connectionHealth.authenticated = true;
      this.emit('authenticated');
      
      // Subscribe to user data if requested
      if (this.subscriptionConfig.includeUserData) {
        this.subscribeToUserData();
      }
    });

    this.wsAPI.on('error', (error) => {
      console.error('[DeltaRealtimeManager] WebSocket error:', error);
      this.connectionHealth.errors.push(error.message);
      this.emit('error', error);
    });

    this.wsAPI.on('reconnecting', (data) => {
      console.log('[DeltaRealtimeManager] Reconnecting:', data);
      this.connectionHealth.reconnectAttempts = data.attempt;
      this.emit('reconnecting', data);
    });

    // Data events
    this.wsAPI.on('ticker', (data) => {
      this.dataStreams.tickers.set(data.symbol, data);
      this.connectionHealth.messagesReceived++;

      // Record performance metrics
      const messageSize = JSON.stringify(data).length;
      this.performanceMonitor.recordMessage('ticker', messageSize);

      this.emit('ticker', data);
      this.emit('dataUpdate', { type: 'ticker', symbol: data.symbol, data });
    });

    this.wsAPI.on('orderbook', (data) => {
      this.dataStreams.orderbooks.set(data.symbol, data);
      this.connectionHealth.messagesReceived++;

      // Record performance metrics
      const messageSize = JSON.stringify(data).length;
      this.performanceMonitor.recordMessage('orderbook', messageSize);

      this.emit('orderbook', data);
      this.emit('dataUpdate', { type: 'orderbook', symbol: data.symbol, data });
    });

    this.wsAPI.on('trade', (data) => {
      const symbolTrades = this.dataStreams.trades.get(data.symbol) || [];
      const updatedTrades = [data, ...symbolTrades].slice(0, this.subscriptionConfig.maxTradeHistory);
      this.dataStreams.trades.set(data.symbol, updatedTrades);
      this.connectionHealth.messagesReceived++;

      // Record performance metrics
      const messageSize = JSON.stringify(data).length;
      this.performanceMonitor.recordMessage('trade', messageSize);

      this.emit('trade', data);
      this.emit('dataUpdate', { type: 'trade', symbol: data.symbol, data });
    });

    this.wsAPI.on('balance', (data) => {
      this.dataStreams.balances.set(data.assetSymbol, data);
      this.connectionHealth.messagesReceived++;
      this.emit('balance', data);
      this.emit('dataUpdate', { type: 'balance', symbol: data.assetSymbol, data });
    });

    this.wsAPI.on('position', (data) => {
      if (parseFloat(data.size) === 0) {
        this.dataStreams.positions.delete(data.symbol);
      } else {
        this.dataStreams.positions.set(data.symbol, data);
      }
      this.connectionHealth.messagesReceived++;
      this.emit('position', data);
      this.emit('dataUpdate', { type: 'position', symbol: data.symbol, data });
    });

    this.wsAPI.on('order', (data) => {
      if (data.state === 'closed' || data.state === 'cancelled') {
        this.dataStreams.orders.delete(data.orderId);
      } else {
        this.dataStreams.orders.set(data.orderId, data);
      }
      this.connectionHealth.messagesReceived++;
      this.emit('order', data);
      this.emit('dataUpdate', { type: 'order', symbol: data.symbol, data });
    });

    this.wsAPI.on('userTrade', (data) => {
      this.dataStreams.userTrades = [data, ...this.dataStreams.userTrades]
        .slice(0, this.subscriptionConfig.maxTradeHistory);
      this.connectionHealth.messagesReceived++;
      this.emit('userTrade', data);
      this.emit('dataUpdate', { type: 'userTrade', symbol: data.symbol, data });
    });
  }

  async connect(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('DeltaRealtimeManager not initialized');
    }

    try {
      await this.wsAPI.connect();
    } catch (error) {
      console.error('[DeltaRealtimeManager] Failed to connect:', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.wsAPI) {
      this.wsAPI.disconnect();
    }
    this.stopHealthCheck();
    this.performanceMonitor.stopMonitoring();
  }

  // Subscription methods
  subscribeToTickers(symbols: string[]): void {
    if (!this.connectionHealth.connected) {
      console.warn('[DeltaRealtimeManager] Not connected, queueing ticker subscription');
    }
    
    this.wsAPI.subscribeToTickers(symbols);
    this.updateSubscriptionList('tickers', symbols);
    this.emit('subscribed', { type: 'tickers', symbols });
  }

  subscribeToOrderbooks(symbols: string[]): void {
    if (!this.connectionHealth.connected) {
      console.warn('[DeltaRealtimeManager] Not connected, queueing orderbook subscription');
    }
    
    this.wsAPI.subscribeToOrderbook(symbols);
    this.updateSubscriptionList('orderbooks', symbols);
    this.emit('subscribed', { type: 'orderbooks', symbols });
  }

  subscribeToTrades(symbols: string[]): void {
    if (!this.connectionHealth.connected) {
      console.warn('[DeltaRealtimeManager] Not connected, queueing trades subscription');
    }
    
    this.wsAPI.subscribeToTrades(symbols);
    this.updateSubscriptionList('trades', symbols);
    this.emit('subscribed', { type: 'trades', symbols });
  }

  private subscribeToUserData(): void {
    if (!this.connectionHealth.authenticated) {
      console.warn('[DeltaRealtimeManager] Not authenticated, cannot subscribe to user data');
      return;
    }

    this.wsAPI.subscribeToBalances();
    this.wsAPI.subscribeToPositions();
    this.wsAPI.subscribeToOrders();
    
    this.updateSubscriptionList('user', ['balances', 'positions', 'orders']);
    this.emit('subscribed', { type: 'user', symbols: ['balances', 'positions', 'orders'] });
  }

  // Unsubscription methods
  unsubscribeFromTickers(symbols: string[]): void {
    this.wsAPI.unsubscribeFromTickers(symbols);
    this.removeFromSubscriptionList('tickers', symbols);
    this.emit('unsubscribed', { type: 'tickers', symbols });
  }

  unsubscribeFromOrderbooks(symbols: string[]): void {
    this.wsAPI.unsubscribeFromOrderbook(symbols);
    this.removeFromSubscriptionList('orderbooks', symbols);
    this.emit('unsubscribed', { type: 'orderbooks', symbols });
  }

  unsubscribeFromTrades(symbols: string[]): void {
    this.wsAPI.unsubscribeFromTrades(symbols);
    this.removeFromSubscriptionList('trades', symbols);
    this.emit('unsubscribed', { type: 'trades', symbols });
  }

  // Data access methods
  getTicker(symbol: string): any {
    return this.dataStreams.tickers.get(symbol.toUpperCase());
  }

  getOrderbook(symbol: string): any {
    return this.dataStreams.orderbooks.get(symbol.toUpperCase());
  }

  getTrades(symbol: string): any[] {
    return this.dataStreams.trades.get(symbol.toUpperCase()) || [];
  }

  getBalance(assetSymbol: string): any {
    return this.dataStreams.balances.get(assetSymbol.toUpperCase());
  }

  getPosition(symbol: string): any {
    return this.dataStreams.positions.get(symbol.toUpperCase());
  }

  getOrder(orderId: number): any {
    return this.dataStreams.orders.get(orderId);
  }

  getAllTickers(): any[] {
    return Array.from(this.dataStreams.tickers.values());
  }

  getAllBalances(): any[] {
    return Array.from(this.dataStreams.balances.values());
  }

  getAllPositions(): any[] {
    return Array.from(this.dataStreams.positions.values());
  }

  getAllOrders(): any[] {
    return Array.from(this.dataStreams.orders.values());
  }

  getUserTrades(): any[] {
    return this.dataStreams.userTrades;
  }

  // Health and status methods
  getConnectionHealth(): ConnectionHealth {
    return { ...this.connectionHealth };
  }

  getDataStreams(): RealtimeDataStreams {
    return {
      tickers: new Map(this.dataStreams.tickers),
      orderbooks: new Map(this.dataStreams.orderbooks),
      trades: new Map(this.dataStreams.trades),
      balances: new Map(this.dataStreams.balances),
      positions: new Map(this.dataStreams.positions),
      orders: new Map(this.dataStreams.orders),
      userTrades: [...this.dataStreams.userTrades],
    };
  }

  private updateSubscriptionList(type: string, symbols: string[]): void {
    symbols.forEach(symbol => {
      const subscription = `${type}:${symbol}`;
      if (!this.connectionHealth.subscriptions.includes(subscription)) {
        this.connectionHealth.subscriptions.push(subscription);
      }
    });
  }

  private removeFromSubscriptionList(type: string, symbols: string[]): void {
    symbols.forEach(symbol => {
      const subscription = `${type}:${symbol}`;
      const index = this.connectionHealth.subscriptions.indexOf(subscription);
      if (index > -1) {
        this.connectionHealth.subscriptions.splice(index, 1);
      }
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.connectionHealth.lastHeartbeat = Date.now();
      
      // Calculate latency (simplified)
      const now = Date.now();
      this.connectionHealth.latency = now - this.connectionHealth.lastHeartbeat;
      
      // Emit health update
      this.emit('healthUpdate', this.getConnectionHealth());
    }, 10000); // Every 10 seconds
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Utility methods
  isConnected(): boolean {
    return this.connectionHealth.connected;
  }

  isAuthenticated(): boolean {
    return this.connectionHealth.authenticated;
  }

  getSubscriptionCount(): number {
    return this.connectionHealth.subscriptions.length;
  }

  clearErrors(): void {
    this.connectionHealth.errors = [];
  }

  // Performance monitoring methods
  getPerformanceMetrics() {
    return this.performanceMonitor.getMetrics();
  }

  getPerformanceSummary(): string {
    return this.performanceMonitor.getPerformanceSummary();
  }

  resetPerformanceMetrics(): void {
    this.performanceMonitor.reset();
  }
}

// Singleton instance for global use
let globalRealtimeManager: DeltaRealtimeManager | null = null;

export function getGlobalRealtimeManager(config?: SubscriptionConfig): DeltaRealtimeManager {
  if (!globalRealtimeManager) {
    globalRealtimeManager = new DeltaRealtimeManager(config);
  }
  return globalRealtimeManager;
}

export function resetGlobalRealtimeManager(): void {
  if (globalRealtimeManager) {
    globalRealtimeManager.disconnect();
    globalRealtimeManager = null;
  }
}
