/**
 * Client-side Market Data Provider
 * Safe for use in browser components - fetches data from API routes
 */

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
  timestamp: number;
}

export interface ProductInfo {
  id: number;
  symbol: string;
  description: string;
  tick_size: string;
  product_type?: string;
}

export class ClientMarketDataManager extends EventEmitter {
  private marketData: Map<string, RealtimeMarketData> = new Map();
  private products: ProductInfo[] = [];
  private isConnected: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private readonly POLLING_INTERVAL = 2000; // 2 seconds
  private subscribedSymbols: string[] = [];
  private lastUpdateTime: number = 0;
  private networkStatus: boolean = true;
  private loadingProducts: boolean = false;

  constructor() {
    super();
    console.log('[ClientMarketDataManager] Initialized for client-side use');
  }

  async connect(): Promise<void> {
    try {
      console.log('[ClientMarketDataManager] Connecting...');

      // Load initial data
      await this.loadProducts();
      await this.fetchMarketData();

      // Start polling for updates
      this.startPolling();

      this.isConnected = true;
      this.networkStatus = true;
      this.emit('connected');
      this.emit('networkStatusChanged', { online: true });

      console.log('[ClientMarketDataManager] Connected successfully');
    } catch (error) {
      console.error('[ClientMarketDataManager] Connection failed:', error);
      this.isConnected = false;
      this.networkStatus = false;
      this.emit('error', error);
      this.emit('networkStatusChanged', { online: false });
      throw error;
    }
  }

  disconnect(): void {
    console.log('[ClientMarketDataManager] Disconnecting...');

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.isConnected = false;
    this.emit('disconnected');
    this.emit('networkStatusChanged', { online: false });
  }

  async loadProducts(): Promise<void> {
    try {
      this.loadingProducts = true;
      this.emit('loadingProducts', true);

      const response = await fetch('/api/market/products');
      const data = await response.json();

      if (data.success && data.result) {
        this.products = data.result;
        this.emit('productsLoaded', this.products);
        this.emit('products', this.products);
      }

      this.loadingProducts = false;
      this.emit('loadingProducts', false);
    } catch (error) {
      console.error('[ClientMarketDataManager] Failed to load products:', error);
      this.loadingProducts = false;
      this.emit('loadingProducts', false);
      this.emit('error', error);
    }
  }

  private async fetchMarketData(): Promise<void> {
    try {
      const response = await fetch('/api/market/realtime-data');
      const data = await response.json();

      if (data.success && data.marketData) {
        // Update market data map and emit individual updates
        data.marketData.forEach((item: RealtimeMarketData) => {
          const previous = this.marketData.get(item.symbol);
          this.marketData.set(item.symbol, item);

          // Emit individual market data update
          this.emit('marketData', {
            symbol: item.symbol,
            data: item,
            previous
          });
        });

        // Update last update time
        this.lastUpdateTime = Date.now();
        this.emit('dataUpdated', this.lastUpdateTime);

        // Emit updated data array
        this.emit('data', Array.from(this.marketData.values()));
      }
    } catch (error) {
      console.error('[ClientMarketDataManager] Failed to fetch market data:', error);
      this.networkStatus = false;
      this.emit('networkStatusChanged', { online: false });
      this.emit('error', error);
    }
  }

  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      this.fetchMarketData();
    }, this.POLLING_INTERVAL);
  }

  getMarketData(symbol: string): RealtimeMarketData | null {
    return this.marketData.get(symbol) || null;
  }

  getAllMarketData(): RealtimeMarketData[] {
    return Array.from(this.marketData.values());
  }

  getProducts(): ProductInfo[] {
    return this.products;
  }

  isConnectedStatus(): boolean {
    return this.isConnected;
  }

  // Connection info method required by the hook
  getConnectionInfo(): {
    connected: boolean;
    subscribedSymbols: string[];
    lastUpdateTime: number;
    networkStatus: boolean;
    loadingProducts: boolean;
  } {
    return {
      connected: this.isConnected,
      subscribedSymbols: this.subscribedSymbols,
      lastUpdateTime: this.lastUpdateTime,
      networkStatus: this.networkStatus,
      loadingProducts: this.loadingProducts
    };
  }

  // Get all market data as Map (required by hook)
  getAllMarketData(): Map<string, RealtimeMarketData> {
    return new Map(this.marketData);
  }

  // Subscribe methods for compatibility (client-side doesn't need real subscriptions)
  subscribe(symbols: string[]): void {
    console.log('[ClientMarketDataManager] Subscribe called for:', symbols);
    this.subscribedSymbols = [...new Set([...this.subscribedSymbols, ...symbols])];
    this.emit('subscribed', symbols);
    // Client-side polling handles all symbols automatically
  }

  unsubscribe(symbols: string[]): void {
    console.log('[ClientMarketDataManager] Unsubscribe called for:', symbols);
    this.subscribedSymbols = this.subscribedSymbols.filter(s => !symbols.includes(s));
    this.emit('unsubscribed', symbols);
    // Client-side polling handles all symbols automatically
  }

  // Subscribe to all available symbols
  subscribeToAll(): void {
    const allSymbols = this.products.map(p => p.symbol);
    this.subscribe(allSymbols);
  }

  // Get products by type
  getProductsByType(productType: string): ProductInfo[] {
    return this.products.filter(p => p.product_type === productType);
  }

  // Refresh method for compatibility
  async refresh(): Promise<void> {
    await this.loadProducts();
    await this.fetchMarketData();
  }

  // Event listener management methods
  off(event: string, listener: (...args: any[]) => void): this {
    return this.removeListener(event, listener);
  }
}

// Singleton instance for client-side use
let clientMarketDataInstance: ClientMarketDataManager | null = null;

export function getClientMarketData(): ClientMarketDataManager {
  if (!clientMarketDataInstance) {
    clientMarketDataInstance = new ClientMarketDataManager();
  }
  return clientMarketDataInstance;
}

// Export for compatibility with existing code
export const realtimeMarketData = getClientMarketData();
