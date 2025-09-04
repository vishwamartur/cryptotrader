/**
 * Delta Exchange WebSocket Client
 * Handles real-time market data from Delta Exchange WebSocket API
 */

import { generateHmacSha256 } from './crypto-utils';

export interface DeltaWebSocketConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl?: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export interface DeltaProduct {
  id: number;
  symbol: string;
  description: string;
  underlying_asset: {
    symbol: string;
  };
  quoting_asset: {
    symbol: string;
  };
  contract_type: string;
  state: string;
  trading_status: string;
  tick_size: string;
  minimum_quantity: string;
  maximum_quantity: string;
}

export interface DeltaMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
  turnover: number;
  timestamp: number;
  product?: DeltaProduct;
}

export interface DeltaOrderBookData {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
  sequence?: number;
}

export interface DeltaTradeData {
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
  trade_id?: string;
}

export type DeltaWebSocketMessage =
  | { type: 'ticker'; data: DeltaMarketData }
  | { type: 'orderbook'; data: DeltaOrderBookData }
  | { type: 'trade'; data: DeltaTradeData }
  | { type: 'products'; data: DeltaProduct[] }
  | { type: 'subscription_success'; data: { channel: string; symbols: string[] } }
  | { type: 'subscription_error'; data: { channel: string; symbols: string[]; error: string } }
  | { type: 'error'; data: { message: string; code?: string } }
  | { type: 'connected'; data: { message: string } }
  | { type: 'disconnected'; data: { message: string } }
  | { type: 'auth_success'; data: { message: string } }
  | { type: 'auth_error'; data: { message: string } };

export class DeltaWebSocketClient {
  private ws: WebSocket | null = null;
  private config: DeltaWebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isAuthenticated = false;
  private subscriptions = new Map<string, Set<string>>(); // channel -> symbols
  private messageHandlers = new Map<string, (message: DeltaWebSocketMessage) => void>();
  private products: DeltaProduct[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastHeartbeat = 0;

  constructor(config: DeltaWebSocketConfig) {
    this.config = {
      baseUrl: 'wss://socket.india.delta.exchange',
      reconnectAttempts: 10,
      reconnectDelay: 5000,
      ...config
    };

    // Initialize subscription channels
    this.subscriptions.set('ticker', new Set());
    this.subscriptions.set('l2_orderbook', new Set());
    this.subscriptions.set('recent_trade', new Set());
  }

  /**
   * Connect to Delta Exchange WebSocket
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('[DeltaWebSocket] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    console.log('[DeltaWebSocket] Connecting to:', this.config.baseUrl);

    try {
      // Validate configuration before connecting
      if (!this.config.baseUrl) {
        throw new Error('WebSocket URL is not configured');
      }

      // Check if WebSocket is supported
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not supported in this environment');
      }

      console.log('[DeltaWebSocket] Creating WebSocket connection...');
      this.ws = new WebSocket(this.config.baseUrl);

      // Set up event handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.warn('[DeltaWebSocket] Connection timeout');
          this.ws.close();
          this.isConnecting = false;
          this.broadcastMessage({
            type: 'error',
            data: {
              message: 'Connection timeout',
              code: 'CONNECTION_TIMEOUT'
            }
          });
        }
      }, 15000); // 15 second timeout

      // Clear timeout when connection is established
      this.ws.onopen = (event) => {
        clearTimeout(connectionTimeout);
        this.handleOpen();
      };

    } catch (error) {
      console.error('[DeltaWebSocket] Connection setup error:', error);
      this.isConnecting = false;

      this.broadcastMessage({
        type: 'error',
        data: {
          message: error instanceof Error ? error.message : 'Connection setup failed',
          code: 'CONNECTION_SETUP_ERROR'
        }
      });

      this.handleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('[DeltaWebSocket] Disconnecting...');

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnecting = false;
    this.isAuthenticated = false;
    this.reconnectAttempts = 0;
    this.subscriptions.clear();
    this.products = [];
  }

  /**
   * Get all subscribed symbols for a channel
   */
  getSubscriptions(channel?: string): string[] {
    if (channel) {
      return Array.from(this.subscriptions.get(channel) || []);
    }

    const allSymbols = new Set<string>();
    this.subscriptions.forEach(symbols => {
      symbols.forEach(symbol => allSymbols.add(symbol));
    });

    return Array.from(allSymbols);
  }

  /**
   * Check if authenticated
   */
  isAuthenticatedUser(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Discover all available products from Delta Exchange
   */
  async discoverProducts(): Promise<DeltaProduct[]> {
    try {
      console.log('[DeltaWebSocket] Discovering available products...');

      // Fetch products from Delta Exchange REST API for discovery
      const response = await fetch('https://api.delta.exchange/v2/products');
      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.result)) {
        throw new Error('Invalid products response format');
      }

      this.products = data.result.map((product: any) => ({
        id: product.id,
        symbol: product.symbol,
        description: product.description,
        underlying_asset: product.underlying_asset,
        quoting_asset: product.quoting_asset,
        contract_type: product.contract_type,
        state: product.state,
        trading_status: product.trading_status,
        tick_size: product.tick_size,
        minimum_quantity: product.minimum_quantity,
        maximum_quantity: product.maximum_quantity
      }));

      console.log(`[DeltaWebSocket] Discovered ${this.products.length} products`);

      // Broadcast products to handlers
      this.broadcastMessage({
        type: 'products',
        data: this.products
      });

      return this.products;
    } catch (error) {
      console.error('[DeltaWebSocket] Failed to discover products:', error);
      throw error;
    }
  }

  /**
   * Get all available products
   */
  getProducts(): DeltaProduct[] {
    return this.products;
  }

  /**
   * Validate channels that support "all" symbol subscription
   */
  private validateChannelsForAllSubscription(channels: string[]): string[] {
    const allSupportedChannels = [
      'v2/ticker',
      'ticker',
      'l1_orderbook',
      'all_trades',
      'funding_rate',
      'mark_price',
      'announcements'
    ];

    const validChannels = channels.filter(channel => {
      const isSupported = allSupportedChannels.includes(channel);
      if (!isSupported) {
        console.warn(`[DeltaWebSocket] Channel "${channel}" does not support "all" symbol subscription`);
      }
      return isSupported;
    });

    console.log(`[DeltaWebSocket] Valid channels for "all" subscription:`, validChannels);
    return validChannels;
  }

  /**
   * Validate symbol subscriptions against channel limits
   */
  private validateSymbolSubscriptions(symbols: string[], channels: string[]): Array<{channel: string, validSymbols: string[]}> {
    const channelLimits: Record<string, number> = {
      'l2_orderbook': 20,
      'l2_updates': 100,
      'v2/ticker': -1, // No limit
      'ticker': -1, // No limit
      'l1_orderbook': -1, // No limit
      'all_trades': -1, // No limit
      'funding_rate': -1, // No limit
      'mark_price': -1, // No limit
      'announcements': -1, // No limit
      'orders': -1, // Private channel, no limit
      'positions': -1, // Private channel, no limit
      'trading_notifications': -1 // Private channel, no limit
    };

    return channels.map(channel => {
      const limit = channelLimits[channel] || -1;

      if (limit === -1) {
        // No limit for this channel
        return { channel, validSymbols: symbols };
      }

      // Count current subscriptions for this channel
      const currentCount = this.subscriptions.get(channel)?.size || 0;
      const availableSlots = Math.max(0, limit - currentCount);

      if (availableSlots === 0) {
        console.warn(`[DeltaWebSocket] Channel "${channel}" has reached its limit of ${limit} symbols`);
        return { channel, validSymbols: [] };
      }

      const validSymbols = symbols.slice(0, availableSlots);

      if (validSymbols.length < symbols.length) {
        console.warn(`[DeltaWebSocket] Channel "${channel}" can only accept ${validSymbols.length} of ${symbols.length} requested symbols (limit: ${limit})`);
      }

      return { channel, validSymbols };
    });
  }

  /**
   * Subscribe to market data for symbols
   */
  subscribe(symbols: string[], channels: string[] = ['ticker', 'l2_orderbook', 'recent_trade']): void {
    console.log('[DeltaWebSocket] Subscribing to symbols:', symbols, 'channels:', channels);

    // Handle "all" symbol subscription
    if (symbols.length === 1 && symbols[0] === 'all') {
      console.log('[DeltaWebSocket] 🌐 Subscribing to ALL symbols for channels:', channels);

      // Validate channels that support "all" subscription
      const validChannels = this.validateChannelsForAllSubscription(channels);
      if (validChannels.length === 0) {
        console.warn('[DeltaWebSocket] No valid channels for "all" subscription');
        return;
      }

      // Store "all" subscriptions for reconnection
      validChannels.forEach(channel => {
        if (!this.subscriptions.has(channel)) {
          this.subscriptions.set(channel, new Set());
        }
        this.subscriptions.get(channel)!.add('all');
      });

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.warn('[DeltaWebSocket] Not connected, "all" subscriptions stored for later');
        return;
      }

      // Send "all" subscription requests
      validChannels.forEach(channel => {
        this.send({
          type: 'subscribe',
          payload: {
            channels: [{ name: channel, symbols: ['all'] }]
          }
        });
      });
      console.log('[DeltaWebSocket] ✅ Sent "all" subscription for channels:', validChannels);
      return;
    }

    // Handle specific symbol subscriptions with limits validation
    const validatedSubscriptions = this.validateSymbolSubscriptions(symbols, channels);

    // Store subscriptions for reconnection
    validatedSubscriptions.forEach(({ channel, validSymbols }) => {
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      validSymbols.forEach(symbol => {
        this.subscriptions.get(channel)!.add(symbol);
      });
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[DeltaWebSocket] Not connected, subscriptions stored for later');
      return;
    }

    // Send subscription requests for validated symbols
    validatedSubscriptions.forEach(({ channel, validSymbols }) => {
      if (validSymbols.length > 0) {
        this.send({
          type: 'subscribe',
          payload: {
            channels: [{ name: channel, symbols: validSymbols }]
          }
        });
      }
    });
    console.log('[DeltaWebSocket] ✅ Sent subscriptions for validated symbols');
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[], channels: string[] = ['ticker', 'l2_orderbook', 'recent_trade']): void {
    console.log('[DeltaWebSocket] Unsubscribing from symbols:', symbols, 'channels:', channels);

    // Remove from stored subscriptions
    channels.forEach(channel => {
      if (this.subscriptions.has(channel)) {
        symbols.forEach(symbol => {
          this.subscriptions.get(channel)!.delete(symbol);
        });
      }
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      channels.forEach(channel => {
        this.send({
          type: 'unsubscribe',
          payload: {
            channels: [{ name: channel, symbols: symbols }]
          }
        });
      });
    }
  }

  /**
   * Subscribe to all available products using individual symbols
   */
  subscribeToAllProducts(channels: string[] = ['ticker']): void {
    if (this.products.length === 0) {
      console.warn('[DeltaWebSocket] No products available, discover products first');
      return;
    }

    const symbols = this.products
      .filter(product => product.state === 'live' && product.trading_status === 'operational')
      .map(product => product.symbol);

    console.log(`[DeltaWebSocket] Subscribing to all ${symbols.length} active products individually`);
    this.subscribe(symbols, channels);
  }

  /**
   * Subscribe to ALL symbols using Delta Exchange "all" keyword
   * This is more efficient than subscribing to individual symbols
   */
  subscribeToAllSymbols(channels: string[] = ['ticker', 'v2/ticker']): void {
    console.log('[DeltaWebSocket] 🌐 Subscribing to ALL symbols using "all" keyword');

    // Filter channels that support "all" subscription
    const validChannels = this.validateChannelsForAllSubscription(channels);

    if (validChannels.length === 0) {
      console.warn('[DeltaWebSocket] No valid channels for "all" subscription, falling back to individual products');
      this.subscribeToAllProducts(channels);
      return;
    }

    // Use the "all" keyword for efficient subscription
    this.subscribe(['all'], validChannels);

    // For channels that don't support "all", subscribe individually
    const unsupportedChannels = channels.filter(ch => !validChannels.includes(ch));
    if (unsupportedChannels.length > 0) {
      console.log('[DeltaWebSocket] Subscribing to unsupported channels individually:', unsupportedChannels);
      this.subscribeToAllProducts(unsupportedChannels);
    }
  }

  /**
   * Subscribe to major currency pairs
   */
  subscribeToMajorPairs(channels: string[] = ['ticker', 'l2_orderbook']): void {
    const majorPairs = [
      'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT',
      'XRPUSDT', 'DOGEUSDT', 'MATICUSDT', 'DOTUSDT', 'AVAXUSDT',
      'LINKUSDT', 'UNIUSDT', 'LTCUSDT', 'BCHUSDT', 'XLMUSDT'
    ];

    console.log('[DeltaWebSocket] Subscribing to major pairs:', majorPairs);
    this.subscribe(majorPairs, channels);
  }

  /**
   * Subscribe to private channels (requires authentication)
   */
  subscribeToPrivateChannels(channels: string[] = ['positions', 'orders', 'wallet']): void {
    if (!this.isAuthenticated) {
      console.warn('[DeltaWebSocket] Cannot subscribe to private channels - not authenticated');
      return;
    }

    console.log('[DeltaWebSocket] 🔐 Subscribing to private channels:', channels);

    // Private channels don't use symbols, they use empty array or no symbols
    channels.forEach(channel => {
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add('private');
    });

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[DeltaWebSocket] Not connected, private subscriptions stored for later');
      return;
    }

    // Send private channel subscription requests
    channels.forEach(channel => {
      this.send({
        type: 'subscribe',
        payload: {
          channels: [{ name: channel, symbols: [] }] // Private channels use empty symbols array
        }
      });
    });

    console.log('[DeltaWebSocket] ✅ Sent private channel subscriptions');
  }

  /**
   * Add message handler
   */
  onMessage(handler: (message: DeltaWebSocketMessage) => void): () => void {
    const id = Math.random().toString(36);
    this.messageHandlers.set(id, handler);
    
    return () => {
      this.messageHandlers.delete(id);
    };
  }

  /**
   * Get connection status
   */
  getStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    if (this.ws?.readyState === WebSocket.CLOSED) return 'disconnected';
    return 'error';
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('[DeltaWebSocket] ✅ Connected successfully');
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();

    // Start heartbeat
    this.startHeartbeat();

    // Authenticate if credentials are provided
    if (this.config.apiKey && this.config.apiSecret) {
      this.authenticate();
    } else {
      // If no authentication, discover products immediately
      this.discoverProducts().catch(error => {
        console.error('[DeltaWebSocket] Failed to discover products on connect:', error);
      });
    }

    // Re-subscribe to previous subscriptions
    this.resubscribeAll();

    this.broadcastMessage({
      type: 'connected',
      data: { message: 'Connected to Delta Exchange WebSocket' }
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', payload: { timestamp: Date.now() } });
        this.lastHeartbeat = Date.now();
      }
    }, 30000); // Send ping every 30 seconds
  }

  /**
   * Re-subscribe to all stored subscriptions
   */
  private resubscribeAll(): void {
    this.subscriptions.forEach((symbols, channel) => {
      if (symbols.size > 0) {
        const symbolArray = Array.from(symbols);
        console.log(`[DeltaWebSocket] Re-subscribing to ${channel}:`, symbolArray);
        this.subscribe(symbolArray, [channel]);
      }
    });
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);

      // Handle different message formats
      if (data.type) {
        this.handleTypedMessage(data);
      } else if (data.channel) {
        this.handleChannelMessage(data);
      } else if (data.event) {
        this.handleEventMessage(data);
      } else {
        console.log('[DeltaWebSocket] Unknown message format:', data);
      }

    } catch (error) {
      console.error('[DeltaWebSocket] Error parsing message:', error);
      this.broadcastMessage({
        type: 'error',
        data: { message: 'Failed to parse WebSocket message' }
      });
    }
  }

  /**
   * Handle typed messages (type field)
   */
  private handleTypedMessage(data: any): void {
    switch (data.type) {
      case 'pong':
        this.lastHeartbeat = Date.now();
        break;

      case 'auth':
        if (data.success) {
          console.log('[DeltaWebSocket] ✅ Authentication successful');
          this.isAuthenticated = true;
          this.broadcastMessage({
            type: 'auth_success',
            data: { message: 'Authentication successful' }
          });

          // Discover products after authentication
          this.discoverProducts().catch(error => {
            console.error('[DeltaWebSocket] Failed to discover products after auth:', error);
          });
        } else {
          console.error('[DeltaWebSocket] ❌ Authentication failed:', data.message);
          this.broadcastMessage({
            type: 'auth_error',
            data: { message: data.message || 'Authentication failed' }
          });
        }
        break;

      case 'subscriptions':
        if (data.success) {
          console.log('[DeltaWebSocket] ✅ Subscription successful:', data.channels);
          this.broadcastMessage({
            type: 'subscription_success',
            data: { channel: data.channels?.[0]?.name || 'unknown', symbols: data.channels?.[0]?.symbols || [] }
          });
        } else {
          console.error('[DeltaWebSocket] ❌ Subscription failed:', data.message);
          this.broadcastMessage({
            type: 'subscription_error',
            data: { channel: 'unknown', symbols: [], error: data.message || 'Subscription failed' }
          });
        }
        break;

      default:
        console.log('[DeltaWebSocket] Unhandled typed message:', data.type);
    }
  }

  /**
   * Handle channel messages (channel field)
   */
  private handleChannelMessage(data: any): void {
    const symbol = data.symbol;
    if (!symbol) return;

    switch (data.channel) {
      case 'ticker':
        const marketData: DeltaMarketData = {
          symbol: symbol,
          price: parseFloat(data.close || data.price || '0'),
          change: parseFloat(data.change || '0'),
          changePercent: parseFloat(data.change_percent || data.changePercent || '0'),
          volume: parseFloat(data.volume || '0'),
          high: parseFloat(data.high || '0'),
          low: parseFloat(data.low || '0'),
          open: parseFloat(data.open || '0'),
          close: parseFloat(data.close || data.price || '0'),
          turnover: parseFloat(data.turnover || '0'),
          timestamp: Date.now(),
          product: this.products.find(p => p.symbol === symbol)
        };

        this.broadcastMessage({
          type: 'ticker',
          data: marketData
        });
        break;

      case 'l2_orderbook':
        const orderBookData: DeltaOrderBookData = {
          symbol: symbol,
          bids: data.buy || data.bids || [],
          asks: data.sell || data.asks || [],
          timestamp: Date.now(),
          sequence: data.sequence
        };

        this.broadcastMessage({
          type: 'orderbook',
          data: orderBookData
        });
        break;

      case 'recent_trade':
        const tradeData: DeltaTradeData = {
          symbol: symbol,
          price: parseFloat(data.price || '0'),
          size: parseFloat(data.size || data.quantity || '0'),
          side: data.side === 'buy' ? 'buy' : 'sell',
          timestamp: Date.now(),
          trade_id: data.trade_id || data.id
        };

        this.broadcastMessage({
          type: 'trade',
          data: tradeData
        });
        break;

      default:
        console.log('[DeltaWebSocket] Unhandled channel message:', data.channel);
    }
  }

  /**
   * Handle event messages (event field)
   */
  private handleEventMessage(data: any): void {
    console.log('[DeltaWebSocket] Event message:', data.event, data);
    // Handle specific events if needed
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('[DeltaWebSocket] 🔌 Connection closed:', event.code, event.reason);
    this.isConnecting = false;

    this.broadcastMessage({
      type: 'disconnected',
      data: { message: `Connection closed: ${event.reason || 'Unknown reason'}` }
    });

    // Attempt to reconnect if not a clean close
    if (event.code !== 1000) {
      this.handleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    // Extract comprehensive error details instead of logging empty objects
    let errorDetails: any = {};

    try {
      // Safely extract event properties
      errorDetails.eventType = event.type || 'error';
      errorDetails.timeStamp = event.timeStamp || Date.now();
      errorDetails.timestamp = new Date().toISOString();

      // Check if it's an ErrorEvent (has message property)
      if (event instanceof ErrorEvent) {
        errorDetails.isErrorEvent = true;
        errorDetails.message = event.message || 'No error message available';
        errorDetails.filename = event.filename || 'Unknown file';
        errorDetails.lineno = event.lineno || 0;
        errorDetails.colno = event.colno || 0;
        errorDetails.error = event.error ? {
          name: event.error.name,
          message: event.error.message,
          stack: event.error.stack
        } : null;
      } else {
        errorDetails.isErrorEvent = false;
        errorDetails.message = 'WebSocket error (no message available)';
      }

      // Extract WebSocket target information if available
      if (event.target && event.target instanceof WebSocket) {
        const wsTarget = event.target as WebSocket;
        errorDetails.target = {
          readyState: wsTarget.readyState,
          readyStateName: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsTarget.readyState] || 'UNKNOWN',
          url: wsTarget.url || this.config.baseUrl,
          protocol: wsTarget.protocol || 'unknown',
          extensions: wsTarget.extensions || 'none'
        };
      } else {
        errorDetails.target = {
          readyState: 'unknown',
          readyStateName: 'UNKNOWN',
          url: this.config.baseUrl,
          protocol: 'unknown',
          extensions: 'none'
        };
      }

      // Add connection context
      errorDetails.connectionContext = {
        url: this.config.baseUrl,
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.config.reconnectAttempts,
        isConnected: this.ws?.readyState === WebSocket.OPEN,
        isAuthenticated: this.isAuthenticated
      };

      // Add troubleshooting suggestions
      errorDetails.troubleshooting = this.generateTroubleshootingSuggestions(errorDetails);

    } catch (extractError) {
      console.warn('[DeltaWebSocket] Error extracting WebSocket error details:', extractError);
      errorDetails = {
        eventType: 'error',
        message: 'Failed to extract error details',
        extractionError: extractError instanceof Error ? extractError.message : 'Unknown extraction error',
        url: this.config.baseUrl,
        reconnectAttempts: this.reconnectAttempts,
        timestamp: new Date().toISOString()
      };
    }

    console.error('[DeltaWebSocket] ❌ WebSocket error details:', errorDetails);
    this.isConnecting = false;

    // Generate detailed error message
    const errorMessage = this.generateDetailedErrorMessage(errorDetails);

    this.broadcastMessage({
      type: 'error',
      data: {
        message: errorMessage,
        details: errorDetails,
        code: 'WEBSOCKET_ERROR'
      }
    });

    this.handleReconnect();
  }

  /**
   * Generate troubleshooting suggestions based on error details
   */
  private generateTroubleshootingSuggestions(errorDetails: any): string[] {
    const suggestions: string[] = [];

    if (errorDetails.target?.url?.includes('delta.exchange')) {
      suggestions.push('🔍 Delta Exchange WebSocket Diagnostics:');
      suggestions.push('• Check if Delta Exchange WebSocket service is operational');
      suggestions.push('• Verify your API credentials are valid');
      suggestions.push('• Ensure your IP is not blocked by Delta Exchange');
      suggestions.push('• Check Delta Exchange status: https://status.delta.exchange');
    }

    if (errorDetails.target?.readyState === WebSocket.CONNECTING) {
      suggestions.push('🔍 Connection Diagnostics:');
      suggestions.push('• Server may be unreachable or overloaded');
      suggestions.push('• Check your internet connection');
      suggestions.push('• Verify firewall is not blocking WebSocket connections');
      suggestions.push('• Try connecting from a different network');
    }

    if (errorDetails.connectionContext?.reconnectAttempts > 0) {
      suggestions.push('🔍 Reconnection Diagnostics:');
      suggestions.push(`• This is reconnection attempt ${errorDetails.connectionContext.reconnectAttempts + 1}`);
      suggestions.push('• Previous connections have failed');
      suggestions.push('• Consider checking server logs for connection issues');
    }

    if (errorDetails.isErrorEvent && errorDetails.message) {
      suggestions.push('🔍 Error Message Analysis:');
      suggestions.push(`• Error: ${errorDetails.message}`);
      if (errorDetails.filename) {
        suggestions.push(`• Source: ${errorDetails.filename}:${errorDetails.lineno}:${errorDetails.colno}`);
      }
    }

    return suggestions;
  }

  /**
   * Generate detailed error message
   */
  private generateDetailedErrorMessage(errorDetails: any): string {
    let message = 'WebSocket connection error';

    if (errorDetails.isErrorEvent && errorDetails.message && errorDetails.message !== 'No error message available') {
      message = `WebSocket error: ${errorDetails.message}`;
    } else if (errorDetails.target && errorDetails.target.readyState !== 'unknown') {
      const readyState = errorDetails.target.readyState;
      const readyStateName = errorDetails.target.readyStateName;
      const wsUrl = errorDetails.target.url;

      switch (readyState) {
        case WebSocket.CONNECTING:
          message = `Failed to connect to WebSocket server (${wsUrl})`;
          break;
        case WebSocket.CLOSING:
          message = `WebSocket connection is closing (${wsUrl})`;
          break;
        case WebSocket.CLOSED:
          message = `WebSocket connection closed unexpectedly (${wsUrl})`;
          break;
        case WebSocket.OPEN:
          message = `WebSocket error while connected (${wsUrl})`;
          break;
        default:
          message = `WebSocket error in state: ${readyStateName} (${readyState})`;
      }
    } else {
      message = `WebSocket connection error for ${this.config.baseUrl}`;
    }

    // Add connection context to error message
    if (this.reconnectAttempts > 0) {
      message += ` (attempt ${this.reconnectAttempts + 1}/${this.config.reconnectAttempts})`;
    }

    return message;
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts!) {
      console.error('[DeltaWebSocket] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * this.reconnectAttempts;

    console.log(`[DeltaWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to WebSocket
   */
  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[DeltaWebSocket] Cannot send message, not connected');
    }
  }

  /**
   * Authenticate with Delta Exchange
   */
  private authenticate(): void {
    try {
      if (!this.config.apiKey || !this.config.apiSecret) {
        console.warn('[DeltaWebSocket] Missing API credentials, skipping authentication');
        this.broadcastMessage({
          type: 'auth_error',
          data: { message: 'Missing API credentials' }
        });
        return;
      }

      console.log('[DeltaWebSocket] Starting authentication process...');

      const timestamp = Date.now().toString();
      const method = 'GET';
      const path = '/live';
      const body = '';

      // Generate signature for authentication
      const signature = generateHmacSha256(
        method + timestamp + path + body,
        this.config.apiSecret
      );

      console.log('[DeltaWebSocket] Authentication details:', {
        apiKey: this.config.apiKey.substring(0, 8) + '...',
        timestamp,
        method,
        path,
        signaturePreview: signature.substring(0, 16) + '...'
      });

      this.send({
        type: 'auth',
        payload: {
          api_key: this.config.apiKey,
          signature: signature,
          timestamp: timestamp
        }
      });

      console.log('[DeltaWebSocket] Authentication request sent');

      // Set a timeout for authentication
      setTimeout(() => {
        if (!this.isAuthenticated && this.ws?.readyState === WebSocket.OPEN) {
          console.warn('[DeltaWebSocket] Authentication timeout - no response received');
          this.broadcastMessage({
            type: 'auth_error',
            data: { message: 'Authentication timeout - no response from server' }
          });
        }
      }, 10000); // 10 second timeout

    } catch (error) {
      console.error('[DeltaWebSocket] Authentication error:', error);
      this.broadcastMessage({
        type: 'auth_error',
        data: {
          message: error instanceof Error ? error.message : 'Authentication failed',
          details: 'Failed to generate authentication signature'
        }
      });
    }
  }

  /**
   * Broadcast message to all handlers
   */
  private broadcastMessage(message: DeltaWebSocketMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('[DeltaWebSocket] Error in message handler:', error);
      }
    });
  }
}
