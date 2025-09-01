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

// Network and retry configuration
interface NetworkConfig {
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  exponentialBackoff: boolean;
}

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
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

  // Network configuration
  private networkConfig: NetworkConfig = {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 10000,
    exponentialBackoff: true,
  };

  // Track network status
  private isOnline = true;
  private lastNetworkCheck = 0;

  constructor() {
    super();
    this.setupNetworkMonitoring();
    this.loadProducts();
  }

  // Setup network monitoring
  private setupNetworkMonitoring(): void {
    if (typeof window !== 'undefined') {
      // Monitor online/offline status
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.emit('networkStatusChanged', { online: true });
        // Retry failed operations when back online
        this.retryFailedOperations();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.emit('networkStatusChanged', { online: false });
      });

      this.isOnline = navigator.onLine;
    }
  }

  // Check network connectivity
  private async checkNetworkConnectivity(): Promise<boolean> {
    if (typeof window === 'undefined') return true;

    // Use cached result if recent
    const now = Date.now();
    if (now - this.lastNetworkCheck < 5000) {
      return this.isOnline;
    }

    try {
      // Try to fetch a small resource to test connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      await fetch('/favicon.ico', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });

      clearTimeout(timeoutId);
      this.isOnline = true;
      this.lastNetworkCheck = now;
      return true;
    } catch (error) {
      this.isOnline = false;
      this.lastNetworkCheck = now;
      return false;
    }
  }

  // Enhanced fetch with timeout, retries, and error handling
  private async fetchWithRetry(url: string, options: FetchOptions = {}): Promise<Response> {
    const {
      timeout = this.networkConfig.timeout,
      retries = this.networkConfig.maxRetries,
      ...fetchOptions
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Check network connectivity before attempting
        if (!(await this.checkNetworkConnectivity())) {
          throw new Error('Network connectivity unavailable');
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain errors
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeout}ms`);
          }
          if (error.message.includes('HTTP 4')) {
            // Don't retry client errors (4xx)
            throw error;
          }
        }

        // Calculate delay for next attempt
        if (attempt < retries) {
          const delay = this.networkConfig.exponentialBackoff
            ? this.networkConfig.retryDelay * Math.pow(2, attempt)
            : this.networkConfig.retryDelay;

          this.emit('retryAttempt', {
            attempt: attempt + 1,
            maxRetries: retries,
            delay,
            error: error.message
          });

          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  // Utility method for delays
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Retry failed operations when network comes back online
  private async retryFailedOperations(): Promise<void> {
    try {
      // Reload products if cache is empty
      if (this.productsCache.size === 0) {
        await this.loadProducts();
      }

      // Refresh market data if we have subscriptions
      if (this.subscribedSymbols.size > 0) {
        await this.fetchMarketData();
      }
    } catch (error) {
      console.warn('Failed to retry operations after network recovery:', error);
    }
  }

  // Load all available products from Delta Exchange
  async loadProducts(): Promise<void> {
    try {
      this.emit('loadingProducts', true);

      // Handle both client-side and server-side URL resolution
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const url = `${baseUrl}/api/market/products`;

      // Use enhanced fetch with retry logic
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-cache',
      });

      const data = await response.json();

      if (data.success && data.result) {
        this.productsCache.clear();
        data.result.forEach((product: ProductInfo) => {
          this.productsCache.set(product.symbol, product);
        });

        this.emit('productsLoaded', Array.from(this.productsCache.values()));
        this.emit('loadingProducts', false);

        console.log(`Successfully loaded ${data.result.length} products`);
      } else {
        throw new Error(data.message || 'Invalid response format from products API');
      }
    } catch (error) {
      this.emit('loadingProducts', false);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const enhancedError = new Error(`Failed to load products: ${errorMessage}`);

      console.error('Failed to load products:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        networkStatus: this.isOnline ? 'online' : 'offline',
        cacheSize: this.productsCache.size,
      });

      // Emit detailed error information
      this.emit('error', {
        type: 'PRODUCTS_LOAD_FAILED',
        message: errorMessage,
        originalError: error,
        timestamp: Date.now(),
        networkStatus: this.isOnline,
        retryable: this.isRetryableError(error),
      });

      // Don't throw the error to prevent breaking the application
      // Instead, emit error event and let consumers handle it
    }
  }

  // Determine if an error is retryable
  private isRetryableError(error: any): boolean {
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';

    // Network-related errors that are retryable
    const retryableErrors = [
      'network',
      'timeout',
      'fetch',
      'connection',
      'unavailable',
      'temporary',
      'rate limit',
      'too many requests',
    ];

    return retryableErrors.some(keyword => message.includes(keyword)) ||
           error.name === 'NetworkError' ||
           error.name === 'TimeoutError' ||
           (error.status && error.status >= 500); // Server errors
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

      // Handle both client-side and server-side URL resolution
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

      const url = `${baseUrl}/api/market/tickers?symbols=${symbols.join(',')}`;

      // Use enhanced fetch with retry logic
      const response = await this.fetchWithRetry(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        cache: 'no-cache',
      });

      const data = await response.json();

      if (data.success && data.result) {
        const now = Date.now();

        data.result.forEach((ticker: any) => {
          const marketData: RealtimeMarketData = {
            symbol: ticker.symbol,
            price: ticker.price || 0,
            change: ticker.change || 0,
            changePercent: ticker.changePercent || 0,
            volume: ticker.volume || 0,
            high24h: ticker.high24h || 0,
            low24h: ticker.low24h || 0,
            bid: ticker.bestBid || 0,
            ask: ticker.bestAsk || 0,
            bidSize: ticker.bestBidSize || 0,
            askSize: ticker.bestAskSize || 0,
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
      } else {
        throw new Error(data.message || 'Invalid response format from tickers API');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      console.error('Error fetching market data:', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        symbols: Array.from(this.subscribedSymbols),
        networkStatus: this.isOnline ? 'online' : 'offline',
      });

      // Emit detailed error information
      this.emit('error', {
        type: 'MARKET_DATA_FETCH_FAILED',
        message: errorMessage,
        originalError: error,
        timestamp: Date.now(),
        symbols: Array.from(this.subscribedSymbols),
        networkStatus: this.isOnline,
        retryable: this.isRetryableError(error),
      });
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
