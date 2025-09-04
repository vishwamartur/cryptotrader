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
      this.emit('connected');
      
      console.log('[ClientMarketDataManager] Connected successfully');
    } catch (error) {
      console.error('[ClientMarketDataManager] Connection failed:', error);
      this.emit('error', error);
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
  }

  private async loadProducts(): Promise<void> {
    try {
      const response = await fetch('/api/market/products');
      const data = await response.json();
      
      if (data.success && data.result) {
        this.products = data.result;
        this.emit('products', this.products);
      }
    } catch (error) {
      console.error('[ClientMarketDataManager] Failed to load products:', error);
    }
  }

  private async fetchMarketData(): Promise<void> {
    try {
      const response = await fetch('/api/market/realtime-data');
      const data = await response.json();
      
      if (data.success && data.marketData) {
        // Update market data map
        data.marketData.forEach((item: RealtimeMarketData) => {
          this.marketData.set(item.symbol, item);
        });
        
        // Emit updated data
        this.emit('data', Array.from(this.marketData.values()));
      }
    } catch (error) {
      console.error('[ClientMarketDataManager] Failed to fetch market data:', error);
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

  // Subscribe methods for compatibility (client-side doesn't need real subscriptions)
  subscribe(symbols: string[]): void {
    console.log('[ClientMarketDataManager] Subscribe called for:', symbols);
    // Client-side polling handles all symbols automatically
  }

  unsubscribe(symbols: string[]): void {
    console.log('[ClientMarketDataManager] Unsubscribe called for:', symbols);
    // Client-side polling handles all symbols automatically
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
