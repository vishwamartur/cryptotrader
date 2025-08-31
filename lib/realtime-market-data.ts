'use client';

import { EventEmitter } from 'events';

export interface RealtimeMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high24h: number;
  low24h: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  openInterest?: number;
  fundingRate?: number;
  markPrice?: number;
  spotPrice?: number;
  timestamp: number;
}

export interface ProductInfo {
  id: number;
  symbol: string;
  description: string;
  productType: string;
  underlyingAsset: string;
  quotingAsset: string;
  settlingAsset: string;
  tradingStatus: string;
  state: string;
}

class RealtimeMarketDataManager extends EventEmitter {
  private wsConnection: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private subscribedSymbols = new Set<string>();
  private marketDataCache = new Map<string, RealtimeMarketData>();
  private productsCache = new Map<string, ProductInfo>();
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastUpdateTime = 0;

  constructor() {
    super();
    this.loadProducts();
  }

  // Load all available products from Delta Exchange
  async loadProducts(): Promise<void> {
    try {
      const response = await fetch('/api/market/products');
      const data = await response.json();
      
      if (data.success && data.result) {
        this.productsCache.clear();
        data.result.forEach((product: ProductInfo) => {
          this.productsCache.set(product.symbol, product);
        });
        
        this.emit('productsLoaded', Array.from(this.productsCache.values()));
      }
    } catch (error) {
      console.error('Failed to load products:', error);
      this.emit('error', error);
    }
  }

  // Get all available products
  getProducts(): ProductInfo[] {
    return Array.from(this.productsCache.values());
  }

  // Get products by type
  getProductsByType(productType: string): ProductInfo[] {
    return Array.from(this.productsCache.values())
      .filter(product => product.productType === productType);
  }

  // Connect to WebSocket (Delta Exchange doesn't have public WebSocket, so we'll use polling)
  connect(): void {
    if (this.isConnecting || this.pollingInterval) {
      return;
    }

    this.isConnecting = true;
    this.startPolling();
  }

  // Start polling for market data updates
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        await this.fetchMarketData();
      } catch (error) {
        console.error('Error fetching market data:', error);
        this.emit('error', error);
      }
    }, 2000); // Poll every 2 seconds

    this.isConnecting = false;
    this.emit('connected');
  }

  // Fetch market data for subscribed symbols
  private async fetchMarketData(): Promise<void> {
    if (this.subscribedSymbols.size === 0) {
      return;
    }

    try {
      const symbols = Array.from(this.subscribedSymbols);
      const response = await fetch(`/api/market/tickers?symbols=${symbols.join(',')}`);
      const data = await response.json();

      if (data.success && data.result) {
        const now = Date.now();
        
        data.result.forEach((ticker: any) => {
          const marketData: RealtimeMarketData = {
            symbol: ticker.symbol,
            price: ticker.price,
            change: ticker.change,
            changePercent: ticker.changePercent,
            volume: ticker.volume,
            high24h: ticker.high24h,
            low24h: ticker.low24h,
            bid: ticker.bestBid,
            ask: ticker.bestAsk,
            bidSize: ticker.bestBidSize,
            askSize: ticker.bestAskSize,
            openInterest: ticker.openInterest,
            fundingRate: ticker.fundingRate,
            markPrice: ticker.markPrice,
            spotPrice: ticker.spotPrice,
            timestamp: now,
          };

          const previousData = this.marketDataCache.get(ticker.symbol);
          this.marketDataCache.set(ticker.symbol, marketData);

          // Emit update event
          this.emit('marketData', {
            symbol: ticker.symbol,
            data: marketData,
            previous: previousData,
          });
        });

        this.lastUpdateTime = now;
        this.emit('dataUpdated', now);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      this.emit('error', error);
    }
  }

  // Subscribe to market data for specific symbols
  subscribe(symbols: string[]): void {
    symbols.forEach(symbol => {
      this.subscribedSymbols.add(symbol.toUpperCase());
    });

    // If not connected, start connection
    if (!this.pollingInterval) {
      this.connect();
    }

    this.emit('subscribed', symbols);
  }

  // Unsubscribe from market data for specific symbols
  unsubscribe(symbols: string[]): void {
    symbols.forEach(symbol => {
      this.subscribedSymbols.delete(symbol.toUpperCase());
      this.marketDataCache.delete(symbol.toUpperCase());
    });

    this.emit('unsubscribed', symbols);
  }

  // Subscribe to all available products
  subscribeToAll(): void {
    const symbols = Array.from(this.productsCache.keys());
    this.subscribe(symbols);
  }

  // Get current market data for a symbol
  getMarketData(symbol: string): RealtimeMarketData | null {
    return this.marketDataCache.get(symbol.toUpperCase()) || null;
  }

  // Get all current market data
  getAllMarketData(): Map<string, RealtimeMarketData> {
    return new Map(this.marketDataCache);
  }

  // Disconnect and cleanup
  disconnect(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.emit('disconnected');
  }

  // Check connection status
  isConnected(): boolean {
    return this.pollingInterval !== null;
  }

  // Get connection info
  getConnectionInfo() {
    return {
      connected: this.isConnected(),
      subscribedSymbols: Array.from(this.subscribedSymbols),
      totalProducts: this.productsCache.size,
      lastUpdateTime: this.lastUpdateTime,
      cacheSize: this.marketDataCache.size,
    };
  }

  // Force refresh of products and market data
  async refresh(): Promise<void> {
    await this.loadProducts();
    if (this.subscribedSymbols.size > 0) {
      await this.fetchMarketData();
    }
  }
}

// Singleton instance
export const realtimeMarketData = new RealtimeMarketDataManager();

// React hook for using realtime market data
export function useRealtimeMarketData() {
  return realtimeMarketData;
}

export default realtimeMarketData;
