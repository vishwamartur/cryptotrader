'use client';

import { EventEmitter } from 'events';
import { createDeltaWebSocketClient, DeltaWebSocketClient } from './delta-websocket-client';
import { createDeltaWebSocketAPI, DeltaWebSocketAPI, RealtimeTickerData } from './delta-websocket-api';
import { createDeltaExchangeAPIFromEnv } from './delta-exchange';

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
  private wsClient: DeltaWebSocketClient;
  private wsAPI: DeltaWebSocketAPI;
  private subscribedSymbols = new Set<string>();
  private marketDataCache = new Map<string, RealtimeMarketData>();
  private productsCache = new Map<string, ProductInfo>();
  private lastUpdateTime = 0;
  private isConnected = false;

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

    // Initialize WebSocket clients
    this.wsClient = createDeltaWebSocketClient();
    const restClient = createDeltaExchangeAPIFromEnv();
    this.wsAPI = createDeltaWebSocketAPI(this.wsClient, restClient);

    this.setupWebSocketEventHandlers();
    this.setupNetworkMonitoring();
    this.loadProducts();
  }

  // Setup WebSocket event handlers
  private setupWebSocketEventHandlers(): void {
    this.wsAPI.on('connected', () => {
      console.log('[RealtimeMarketData] WebSocket connected');
      this.isConnected = true;
      this.emit('connected');

      // Subscribe to all previously subscribed symbols
      if (this.subscribedSymbols.size > 0) {
        this.wsAPI.subscribeToTickers(Array.from(this.subscribedSymbols));
      }
    });

    this.wsAPI.on('disconnected', (data) => {
      console.log('[RealtimeMarketData] WebSocket disconnected:', data);
      this.isConnected = false;
      this.emit('disconnected', data);
    });

    this.wsAPI.on('error', (error) => {
      console.error('[RealtimeMarketData] WebSocket error:', error);
      this.emit('error', error);
    });

    this.wsAPI.on('ticker', (tickerData: RealtimeTickerData) => {
      this.handleTickerUpdate(tickerData);
    });

    this.wsAPI.on('reconnecting', (data) => {
      console.log('[RealtimeMarketData] WebSocket reconnecting:', data);
      this.emit('reconnecting', data);
    });
  }

  // Handle ticker updates from WebSocket
  private handleTickerUpdate(tickerData: RealtimeTickerData): void {
    const marketData: RealtimeMarketData = {
      symbol: tickerData.symbol,
      price: parseFloat(tickerData.price),
      change: parseFloat(tickerData.change || '0'),
      changePercent: parseFloat(tickerData.changePercent || '0'),
      volume: parseFloat(tickerData.volume || '0'),
      high24h: parseFloat(tickerData.high || '0'),
      low24h: parseFloat(tickerData.low || '0'),
      bid: 0, // Will be updated from orderbook data
      ask: 0, // Will be updated from orderbook data
      bidSize: 0,
      askSize: 0,
      markPrice: tickerData.markPrice ? parseFloat(tickerData.markPrice) : undefined,
      spotPrice: tickerData.spotPrice ? parseFloat(tickerData.spotPrice) : undefined,
      timestamp: tickerData.timestamp,
    };

    this.marketDataCache.set(tickerData.symbol, marketData);
    this.lastUpdateTime = Date.now();

    this.emit('marketDataUpdate', {
      symbol: tickerData.symbol,
      data: marketData,
      timestamp: this.lastUpdateTime,
    });

    this.emit(`marketData:${tickerData.symbol}`, marketData);
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

  // Connect to WebSocket for real-time data streaming
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      console.log('[RealtimeMarketData] Connecting to Delta Exchange WebSocket...');
      await this.wsAPI.connect();
    } catch (error) {
      console.error('[RealtimeMarketData] Failed to connect to WebSocket:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // This method is no longer needed as we use WebSocket streaming
  // Kept for backward compatibility but does nothing
  private startPolling(): void {
    console.warn('[RealtimeMarketData] startPolling() is deprecated - using WebSocket streaming instead');
  }

  // This method is no longer needed as we use WebSocket streaming
  // Kept for backward compatibility but does nothing
  private async fetchMarketData(): Promise<void> {
    console.warn('[RealtimeMarketData] fetchMarketData() is deprecated - using WebSocket streaming instead');
  }

  // Subscribe to market data for specific symbols
  subscribe(symbols: string[]): void {
    const normalizedSymbols = symbols.map(s => s.toUpperCase());

    normalizedSymbols.forEach(symbol => {
      this.subscribedSymbols.add(symbol);
    });

    // If connected, subscribe immediately via WebSocket
    if (this.isConnected) {
      this.wsAPI.subscribeToTickers(normalizedSymbols);
    } else {
      // If not connected, connect first (subscriptions will be handled in connect event)
      this.connect().catch(error => {
        console.error('[RealtimeMarketData] Failed to connect for subscription:', error);
      });
    }

    this.emit('subscribed', normalizedSymbols);
  }

  // Unsubscribe from market data for specific symbols
  unsubscribe(symbols: string[]): void {
    const normalizedSymbols = symbols.map(s => s.toUpperCase());

    normalizedSymbols.forEach(symbol => {
      this.subscribedSymbols.delete(symbol);
      this.marketDataCache.delete(symbol);
    });

    // Unsubscribe via WebSocket if connected
    if (this.isConnected) {
      this.wsAPI.unsubscribeFromTickers(normalizedSymbols);
    }

    this.emit('unsubscribed', normalizedSymbols);
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
    console.log('[RealtimeMarketData] Disconnecting WebSocket...');
    this.wsAPI.disconnect();
    this.isConnected = false;
    this.emit('disconnected');
  }

  // Check connection status
  isConnected(): boolean {
    return this.wsAPI.getConnectionStatus().connected;
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
