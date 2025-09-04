# Delta Exchange WebSocket Implementation Guide

## Overview
This comprehensive guide provides complete implementation examples for integrating with Delta Exchange WebSocket API, including "all" symbol subscriptions, proper authentication, and production-ready features.

## Table of Contents
1. [WebSocket Connection Implementation](#1-websocket-connection-implementation)
2. [Authentication Implementation](#2-authentication-implementation)
3. [Channel Subscription Management](#3-channel-subscription-management)
4. [Message Handling and Data Processing](#4-message-handling-and-data-processing)
5. [Production-Ready Implementation Features](#5-production-ready-implementation-features)
6. [Integration Examples](#6-integration-examples)
7. [Testing and Validation](#7-testing-and-validation)

## 1. WebSocket Connection Implementation

### Environment Configuration

```typescript
// Environment URLs
const DELTA_WEBSOCKET_URLS = {
  production: 'wss://socket.india.delta.exchange',
  testnet: 'wss://socket.testnet.deltaex.org'
} as const;

interface DeltaWebSocketConfig {
  environment: 'production' | 'testnet';
  apiKey?: string;
  apiSecret?: string;
  reconnectAttempts: number;
  reconnectDelay: number;
  heartbeatInterval: number;
}
```

### Complete Connection Implementation

```typescript
class DeltaWebSocketClient {
  private ws: WebSocket | null = null;
  private config: DeltaWebSocketConfig;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isAuthenticated = false;
  private subscriptions = new Map<string, Set<string>>();

  constructor(config: DeltaWebSocketConfig) {
    this.config = {
      reconnectAttempts: 10,
      reconnectDelay: 1000,
      heartbeatInterval: 30000,
      ...config
    };
  }

  /**
   * Establish WebSocket connection with comprehensive error handling
   */
  async connect(): Promise<void> {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('[DeltaWebSocket] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    const wsUrl = DELTA_WEBSOCKET_URLS[this.config.environment];
    
    console.log(`[DeltaWebSocket] Connecting to ${this.config.environment}: ${wsUrl}`);

    try {
      // Validate WebSocket support
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not supported in this environment');
      }

      this.ws = new WebSocket(wsUrl);
      
      // Set up event handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.warn('[DeltaWebSocket] Connection timeout');
          this.ws.close();
          this.handleReconnect();
        }
      }, 15000);

      // Clear timeout when connection is established
      this.ws.onopen = (event) => {
        clearTimeout(connectionTimeout);
        this.handleOpen();
      };

    } catch (error) {
      console.error('[DeltaWebSocket] Connection setup error:', error);
      this.isConnecting = false;
      this.handleReconnect();
    }
  }

  /**
   * Handle connection open event
   */
  private handleOpen(): void {
    console.log('[DeltaWebSocket] ✅ Connected successfully');
    this.isConnecting = false;
    this.reconnectAttempts = 0;

    // Start heartbeat
    this.startHeartbeat();

    // Authenticate if credentials provided
    if (this.config.apiKey && this.config.apiSecret) {
      this.authenticate();
    }

    // Restore subscriptions
    this.restoreSubscriptions();

    this.broadcastMessage({
      type: 'connected',
      data: { timestamp: Date.now() }
    });
  }

  /**
   * Handle connection close event with exponential backoff
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[DeltaWebSocket] Connection closed: ${event.code} - ${event.reason}`);
    
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.stopHeartbeat();

    this.broadcastMessage({
      type: 'disconnected',
      data: { 
        code: event.code, 
        reason: event.reason,
        wasClean: event.wasClean
      }
    });

    // Attempt reconnection if not a clean close
    if (!event.wasClean && event.code !== 1000) {
      this.handleReconnect();
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      console.error('[DeltaWebSocket] Max reconnection attempts reached');
      this.broadcastMessage({
        type: 'error',
        data: { message: 'Max reconnection attempts reached' }
      });
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`[DeltaWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          payload: { timestamp: Date.now() }
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat timer
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
```

### Connection State Management

```typescript
interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'authenticated' | 'error';
}

class ConnectionManager {
  private state: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    isAuthenticated: false,
    reconnectAttempts: 0,
    lastHeartbeat: 0,
    connectionStatus: 'disconnected'
  };

  updateConnectionState(updates: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyStateChange();
  }

  getConnectionState(): ConnectionState {
    return { ...this.state };
  }

  private notifyStateChange(): void {
    // Emit state change events for UI updates
    this.emit('stateChange', this.state);
  }
}
```

## 2. Authentication Implementation

### HMAC-SHA256 Signature Generation

```typescript
import crypto from 'crypto';

/**
 * Generate HMAC-SHA256 signature for Delta Exchange authentication
 */
function generateHmacSha256(message: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

/**
 * Create authentication signature for WebSocket
 */
function createAuthSignature(apiSecret: string): {
  timestamp: string;
  signature: string;
  method: string;
  path: string;
} {
  const timestamp = Date.now().toString();
  const method = 'GET';
  const path = '/live';
  const body = '';

  const message = method + timestamp + path + body;
  const signature = generateHmacSha256(message, apiSecret);

  return {
    timestamp,
    signature,
    method,
    path
  };
}
```

### Complete Authentication Implementation

```typescript
class DeltaWebSocketAuth {
  private apiKey: string;
  private apiSecret: string;
  private authTimeout: NodeJS.Timeout | null = null;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  /**
   * Authenticate with Delta Exchange WebSocket
   */
  authenticate(ws: WebSocket): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.apiKey || !this.apiSecret) {
          reject(new Error('Missing API credentials'));
          return;
        }

        console.log('[DeltaWebSocket] Starting authentication process...');
        
        const authData = createAuthSignature(this.apiSecret);
        
        console.log('[DeltaWebSocket] Authentication details:', {
          apiKey: this.apiKey.substring(0, 8) + '...',
          timestamp: authData.timestamp,
          method: authData.method,
          path: authData.path,
          signaturePreview: authData.signature.substring(0, 16) + '...'
        });

        // Send authentication message
        const authMessage = {
          type: 'auth',
          payload: {
            api_key: this.apiKey,
            signature: authData.signature,
            timestamp: authData.timestamp
          }
        };

        ws.send(JSON.stringify(authMessage));
        console.log('[DeltaWebSocket] Authentication request sent');

        // Set authentication timeout
        this.authTimeout = setTimeout(() => {
          console.warn('[DeltaWebSocket] Authentication timeout - no response received');
          reject(new Error('Authentication timeout - no response from server'));
        }, 10000); // 10 second timeout

        // Listen for authentication response
        const authHandler = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            
            if (message.type === 'auth_success') {
              console.log('[DeltaWebSocket] ✅ Authentication successful');
              this.clearAuthTimeout();
              ws.removeEventListener('message', authHandler);
              resolve(true);
            } else if (message.type === 'auth_error') {
              console.error('[DeltaWebSocket] ❌ Authentication failed:', message.data);
              this.clearAuthTimeout();
              ws.removeEventListener('message', authHandler);
              reject(new Error(`Authentication failed: ${message.data?.message || 'Unknown error'}`));
            }
          } catch (parseError) {
            // Ignore non-JSON messages during auth
          }
        };

        ws.addEventListener('message', authHandler);

      } catch (error) {
        console.error('[DeltaWebSocket] Authentication error:', error);
        reject(error);
      }
    });
  }

  private clearAuthTimeout(): void {
    if (this.authTimeout) {
      clearTimeout(this.authTimeout);
      this.authTimeout = null;
    }
  }
}
```

### Authentication Error Handling

```typescript
interface AuthError {
  code: string;
  message: string;
  details?: any;
  troubleshooting: string[];
}

function handleAuthError(error: any): AuthError {
  const troubleshooting: string[] = [];

  if (error.message?.includes('Invalid signature')) {
    troubleshooting.push('🔍 Check API secret is correct');
    troubleshooting.push('🔍 Verify timestamp is within acceptable range');
    troubleshooting.push('🔍 Ensure signature generation matches Delta Exchange format');
  }

  if (error.message?.includes('Invalid API key')) {
    troubleshooting.push('🔍 Verify API key is correct and active');
    troubleshooting.push('🔍 Check API key permissions include WebSocket access');
    troubleshooting.push('🔍 Ensure API key is not expired or suspended');
  }

  if (error.message?.includes('timeout')) {
    troubleshooting.push('🔍 Check network connectivity');
    troubleshooting.push('🔍 Verify Delta Exchange WebSocket service is operational');
    troubleshooting.push('🔍 Try connecting from a different network');
  }

  return {
    code: 'AUTH_ERROR',
    message: error.message || 'Authentication failed',
    details: error,
    troubleshooting
  };
}
```

## 3. Channel Subscription Management

### Available Channels and Limits

```typescript
interface ChannelConfig {
  name: string;
  description: string;
  maxSymbols: number; // -1 for unlimited
  supportsAll: boolean; // Supports "all" symbol subscription
  isPrivate: boolean; // Requires authentication
}

const DELTA_CHANNELS: Record<string, ChannelConfig> = {
  'v2/ticker': {
    name: 'v2/ticker',
    description: 'Real-time ticker data with 24h statistics',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'ticker': {
    name: 'ticker',
    description: 'Basic ticker data',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'l1_orderbook': {
    name: 'l1_orderbook',
    description: 'Level 1 order book (best bid/ask)',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'l2_orderbook': {
    name: 'l2_orderbook',
    description: 'Level 2 order book snapshot',
    maxSymbols: 20,
    supportsAll: false,
    isPrivate: false
  },
  'l2_updates': {
    name: 'l2_updates',
    description: 'Level 2 order book incremental updates',
    maxSymbols: 100,
    supportsAll: false,
    isPrivate: false
  },
  'all_trades': {
    name: 'all_trades',
    description: 'All public trades',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'funding_rate': {
    name: 'funding_rate',
    description: 'Funding rate updates for perpetual contracts',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'mark_price': {
    name: 'mark_price',
    description: 'Mark price updates',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'announcements': {
    name: 'announcements',
    description: 'System announcements',
    maxSymbols: -1,
    supportsAll: true,
    isPrivate: false
  },
  'orders': {
    name: 'orders',
    description: 'User order updates',
    maxSymbols: -1,
    supportsAll: false,
    isPrivate: true
  },
  'positions': {
    name: 'positions',
    description: 'User position updates',
    maxSymbols: -1,
    supportsAll: false,
    isPrivate: true
  },
  'trading_notifications': {
    name: 'trading_notifications',
    description: 'Trading notifications and alerts',
    maxSymbols: -1,
    supportsAll: false,
    isPrivate: true
  }
};
```

### Complete Subscription Management

```typescript
class DeltaSubscriptionManager {
  private subscriptions = new Map<string, Set<string>>();
  private ws: WebSocket | null = null;

  constructor(ws: WebSocket) {
    this.ws = ws;
  }

  /**
   * Subscribe to channels with "all" symbol support
   */
  async subscribe(symbols: string[], channels: string[]): Promise<void> {
    console.log('[DeltaSubscription] Subscribing to symbols:', symbols, 'channels:', channels);

    // Handle "all" symbol subscription
    if (symbols.length === 1 && symbols[0] === 'all') {
      return this.subscribeToAllSymbols(channels);
    }

    // Handle specific symbol subscriptions
    return this.subscribeToSpecificSymbols(symbols, channels);
  }

  /**
   * Subscribe to ALL symbols using "all" keyword
   */
  private async subscribeToAllSymbols(channels: string[]): Promise<void> {
    console.log('[DeltaSubscription] 🌐 Subscribing to ALL symbols');

    // Filter channels that support "all" subscription
    const validChannels = channels.filter(channel => {
      const config = DELTA_CHANNELS[channel];
      if (!config) {
        console.warn(`[DeltaSubscription] Unknown channel: ${channel}`);
        return false;
      }
      if (!config.supportsAll) {
        console.warn(`[DeltaSubscription] Channel "${channel}" does not support "all" subscription`);
        return false;
      }
      return true;
    });

    if (validChannels.length === 0) {
      throw new Error('No valid channels for "all" subscription');
    }

    // Store subscriptions
    validChannels.forEach(channel => {
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add('all');
    });

    // Send subscription message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'subscribe',
        payload: {
          channels: validChannels.map(channel => ({
            name: channel,
            symbols: ['all']
          }))
        }
      };

      this.ws.send(JSON.stringify(message));
      console.log('[DeltaSubscription] ✅ Sent "all" subscription for channels:', validChannels);
    }
  }

  /**
   * Subscribe to specific symbols with limit validation
   */
  private async subscribeToSpecificSymbols(symbols: string[], channels: string[]): Promise<void> {
    const validatedSubscriptions = this.validateSubscriptions(symbols, channels);

    // Store subscriptions
    validatedSubscriptions.forEach(({ channel, validSymbols }) => {
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      validSymbols.forEach(symbol => {
        this.subscriptions.get(channel)!.add(symbol);
      });
    });

    // Send subscription messages
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      validatedSubscriptions.forEach(({ channel, validSymbols }) => {
        if (validSymbols.length > 0) {
          const message = {
            type: 'subscribe',
            payload: {
              channels: [{
                name: channel,
                symbols: validSymbols
              }]
            }
          };

          this.ws!.send(JSON.stringify(message));
        }
      });
      console.log('[DeltaSubscription] ✅ Sent specific symbol subscriptions');
    }
  }

  /**
   * Validate subscriptions against channel limits
   */
  private validateSubscriptions(symbols: string[], channels: string[]): Array<{channel: string, validSymbols: string[]}> {
    return channels.map(channel => {
      const config = DELTA_CHANNELS[channel];

      if (!config) {
        console.warn(`[DeltaSubscription] Unknown channel: ${channel}`);
        return { channel, validSymbols: [] };
      }

      if (config.maxSymbols === -1) {
        // No limit
        return { channel, validSymbols: symbols };
      }

      // Check current subscriptions
      const currentCount = this.subscriptions.get(channel)?.size || 0;
      const availableSlots = Math.max(0, config.maxSymbols - currentCount);

      if (availableSlots === 0) {
        console.warn(`[DeltaSubscription] Channel "${channel}" has reached its limit of ${config.maxSymbols} symbols`);
        return { channel, validSymbols: [] };
      }

      const validSymbols = symbols.slice(0, availableSlots);

      if (validSymbols.length < symbols.length) {
        console.warn(`[DeltaSubscription] Channel "${channel}" can only accept ${validSymbols.length} of ${symbols.length} requested symbols`);
      }

      return { channel, validSymbols };
    });
  }

  /**
   * Unsubscribe from channels
   */
  async unsubscribe(symbols: string[], channels: string[]): Promise<void> {
    console.log('[DeltaSubscription] Unsubscribing from symbols:', symbols, 'channels:', channels);

    // Remove from stored subscriptions
    channels.forEach(channel => {
      if (this.subscriptions.has(channel)) {
        symbols.forEach(symbol => {
          this.subscriptions.get(channel)!.delete(symbol);
        });

        // Remove channel if no symbols left
        if (this.subscriptions.get(channel)!.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    });

    // Send unsubscription message
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        type: 'unsubscribe',
        payload: {
          channels: channels.map(channel => ({
            name: channel,
            symbols: symbols
          }))
        }
      };

      this.ws.send(JSON.stringify(message));
      console.log('[DeltaSubscription] ✅ Sent unsubscription request');
    }
  }

  /**
   * Get current subscriptions
   */
  getSubscriptions(channel?: string): string[] {
    if (channel) {
      return Array.from(this.subscriptions.get(channel) || []);
    }

    const allSubscriptions: string[] = [];
    this.subscriptions.forEach((symbols, channel) => {
      symbols.forEach(symbol => {
        allSubscriptions.push(`${channel}:${symbol}`);
      });
    });

    return allSubscriptions;
  }

  /**
   * Restore subscriptions after reconnection
   */
  restoreSubscriptions(): void {
    console.log('[DeltaSubscription] Restoring subscriptions after reconnection');

    this.subscriptions.forEach((symbols, channel) => {
      const symbolArray = Array.from(symbols);
      this.subscribe(symbolArray, [channel]);
    });
  }
}
```

### Subscription Examples

```typescript
// Example 1: Subscribe to ALL symbols for ticker data
const subscriptionManager = new DeltaSubscriptionManager(ws);

// This will subscribe to ALL symbols efficiently
await subscriptionManager.subscribe(['all'], ['v2/ticker', 'ticker']);

// Example 2: Subscribe to specific symbols
await subscriptionManager.subscribe(
  ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'],
  ['v2/ticker', 'l1_orderbook', 'all_trades']
);

// Example 3: Subscribe to order book data (limited channels)
await subscriptionManager.subscribe(
  ['BTCUSDT', 'ETHUSDT'], // Max 20 symbols for l2_orderbook
  ['l2_orderbook', 'l2_updates']
);

// Example 4: Subscribe to private channels (requires authentication)
await subscriptionManager.subscribe(
  [], // Private channels don't use symbols
  ['orders', 'positions', 'trading_notifications']
);
```

## 4. Message Handling and Data Processing

### Message Types and Structures

```typescript
interface DeltaMessage {
  type: string;
  symbol?: string;
  data?: any;
  timestamp?: number;
  sequence_number?: number;
  checksum?: string;
}

interface TickerData {
  symbol: string;
  price: string;
  change: string;
  change_percent: string;
  high: string;
  low: string;
  volume: string;
  turnover: string;
  open_interest?: string;
  funding_rate?: string;
  mark_price?: string;
  timestamp: number;
}

interface OrderBookData {
  symbol: string;
  buy: Array<[string, string]>; // [price, size]
  sell: Array<[string, string]>; // [price, size]
  timestamp: number;
  sequence_number: number;
  checksum?: string;
}

interface TradeData {
  symbol: string;
  price: string;
  size: string;
  side: 'buy' | 'sell';
  timestamp: number;
  trade_id: string;
}
```

### Complete Message Handler

```typescript
class DeltaMessageHandler {
  private sequenceNumbers = new Map<string, number>();
  private orderBooks = new Map<string, OrderBookData>();

  /**
   * Process incoming WebSocket messages
   */
  handleMessage(event: MessageEvent): void {
    try {
      const message: DeltaMessage = JSON.parse(event.data);

      // Handle different message types
      switch (message.type) {
        case 'v2/ticker':
          this.handleTickerMessage(message);
          break;
        case 'ticker':
          this.handleBasicTickerMessage(message);
          break;
        case 'l1_orderbook':
          this.handleL1OrderBookMessage(message);
          break;
        case 'l2_orderbook':
          this.handleL2OrderBookSnapshot(message);
          break;
        case 'l2_updates':
          this.handleL2OrderBookUpdate(message);
          break;
        case 'all_trades':
          this.handleTradeMessage(message);
          break;
        case 'funding_rate':
          this.handleFundingRateMessage(message);
          break;
        case 'mark_price':
          this.handleMarkPriceMessage(message);
          break;
        case 'orders':
          this.handleOrderMessage(message);
          break;
        case 'positions':
          this.handlePositionMessage(message);
          break;
        case 'auth_success':
          this.handleAuthSuccess(message);
          break;
        case 'auth_error':
          this.handleAuthError(message);
          break;
        case 'error':
          this.handleErrorMessage(message);
          break;
        case 'pong':
          this.handlePongMessage(message);
          break;
        default:
          console.warn('[DeltaMessageHandler] Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('[DeltaMessageHandler] Error parsing message:', error);
    }
  }

  /**
   * Handle ticker messages with validation
   */
  private handleTickerMessage(message: DeltaMessage): void {
    if (!message.symbol || !message.data) {
      console.warn('[DeltaMessageHandler] Invalid ticker message:', message);
      return;
    }

    const tickerData: TickerData = {
      symbol: message.symbol,
      price: message.data.price || '0',
      change: message.data.change || '0',
      change_percent: message.data.change_percent || '0',
      high: message.data.high || '0',
      low: message.data.low || '0',
      volume: message.data.volume || '0',
      turnover: message.data.turnover || '0',
      open_interest: message.data.open_interest,
      funding_rate: message.data.funding_rate,
      mark_price: message.data.mark_price,
      timestamp: message.timestamp || Date.now()
    };

    // Validate data
    if (this.validateTickerData(tickerData)) {
      this.broadcastData('ticker', tickerData);
    }
  }

  /**
   * Handle L2 order book snapshots
   */
  private handleL2OrderBookSnapshot(message: DeltaMessage): void {
    if (!message.symbol || !message.data) {
      console.warn('[DeltaMessageHandler] Invalid L2 orderbook message:', message);
      return;
    }

    const orderBookData: OrderBookData = {
      symbol: message.symbol,
      buy: message.data.buy || [],
      sell: message.data.sell || [],
      timestamp: message.timestamp || Date.now(),
      sequence_number: message.sequence_number || 0,
      checksum: message.checksum
    };

    // Validate checksum if provided
    if (orderBookData.checksum && !this.validateChecksum(orderBookData)) {
      console.error('[DeltaMessageHandler] Checksum validation failed for:', message.symbol);
      return;
    }

    // Store order book
    this.orderBooks.set(message.symbol, orderBookData);
    this.sequenceNumbers.set(message.symbol, orderBookData.sequence_number);

    this.broadcastData('orderbook', orderBookData);
  }

  /**
   * Handle L2 order book incremental updates
   */
  private handleL2OrderBookUpdate(message: DeltaMessage): void {
    if (!message.symbol || !message.data) {
      console.warn('[DeltaMessageHandler] Invalid L2 update message:', message);
      return;
    }

    // Validate sequence number
    const lastSequence = this.sequenceNumbers.get(message.symbol) || 0;
    const currentSequence = message.sequence_number || 0;

    if (currentSequence <= lastSequence) {
      console.warn(`[DeltaMessageHandler] Out of order update for ${message.symbol}: ${currentSequence} <= ${lastSequence}`);
      return;
    }

    if (currentSequence !== lastSequence + 1) {
      console.error(`[DeltaMessageHandler] Missing sequence for ${message.symbol}: expected ${lastSequence + 1}, got ${currentSequence}`);
      // Request snapshot to resync
      this.requestOrderBookSnapshot(message.symbol);
      return;
    }

    // Apply incremental update
    const currentOrderBook = this.orderBooks.get(message.symbol);
    if (currentOrderBook) {
      const updatedOrderBook = this.applyOrderBookUpdate(currentOrderBook, message.data);

      // Validate checksum if provided
      if (message.checksum && !this.validateChecksum(updatedOrderBook)) {
        console.error('[DeltaMessageHandler] Checksum validation failed after update:', message.symbol);
        this.requestOrderBookSnapshot(message.symbol);
        return;
      }

      this.orderBooks.set(message.symbol, updatedOrderBook);
      this.sequenceNumbers.set(message.symbol, currentSequence);

      this.broadcastData('orderbook_update', updatedOrderBook);
    }
  }

  /**
   * Validate ticker data
   */
  private validateTickerData(data: TickerData): boolean {
    const requiredFields = ['symbol', 'price', 'change', 'change_percent', 'volume'];

    for (const field of requiredFields) {
      if (!data[field as keyof TickerData]) {
        console.warn(`[DeltaMessageHandler] Missing required field: ${field}`);
        return false;
      }
    }

    // Validate numeric fields
    const numericFields = ['price', 'change', 'change_percent', 'volume'];
    for (const field of numericFields) {
      const value = data[field as keyof TickerData] as string;
      if (isNaN(parseFloat(value))) {
        console.warn(`[DeltaMessageHandler] Invalid numeric value for ${field}: ${value}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Validate order book checksum
   */
  private validateChecksum(orderBook: OrderBookData): boolean {
    if (!orderBook.checksum) return true; // No checksum to validate

    // Implement checksum validation logic
    const calculatedChecksum = this.calculateOrderBookChecksum(orderBook);
    return calculatedChecksum === orderBook.checksum;
  }

  /**
   * Calculate order book checksum
   */
  private calculateOrderBookChecksum(orderBook: OrderBookData): string {
    // Combine all price levels and calculate CRC32
    const combined = [
      ...orderBook.buy.map(([price, size]) => `${price}:${size}`),
      ...orderBook.sell.map(([price, size]) => `${price}:${size}`)
    ].join('|');

    // Use a CRC32 library or implement checksum calculation
    return this.crc32(combined).toString();
  }

  /**
   * Apply incremental order book update
   */
  private applyOrderBookUpdate(orderBook: OrderBookData, update: any): OrderBookData {
    const updatedOrderBook = { ...orderBook };

    // Apply buy side updates
    if (update.buy) {
      updatedOrderBook.buy = this.applyPriceLevelUpdates(updatedOrderBook.buy, update.buy);
    }

    // Apply sell side updates
    if (update.sell) {
      updatedOrderBook.sell = this.applyPriceLevelUpdates(updatedOrderBook.sell, update.sell);
    }

    updatedOrderBook.timestamp = update.timestamp || Date.now();
    updatedOrderBook.sequence_number = update.sequence_number || orderBook.sequence_number + 1;

    return updatedOrderBook;
  }

  /**
   * Apply price level updates to order book side
   */
  private applyPriceLevelUpdates(
    currentLevels: Array<[string, string]>,
    updates: Array<[string, string]>
  ): Array<[string, string]> {
    const levelMap = new Map(currentLevels);

    updates.forEach(([price, size]) => {
      if (parseFloat(size) === 0) {
        // Remove price level
        levelMap.delete(price);
      } else {
        // Update price level
        levelMap.set(price, size);
      }
    });

    // Convert back to array and sort
    return Array.from(levelMap.entries()).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  }

  /**
   * Request order book snapshot for resync
   */
  private requestOrderBookSnapshot(symbol: string): void {
    console.log(`[DeltaMessageHandler] Requesting order book snapshot for ${symbol}`);
    // Implementation depends on your WebSocket client
    // this.ws.send(JSON.stringify({
    //   type: 'subscribe',
    //   payload: {
    //     channels: [{ name: 'l2_orderbook', symbols: [symbol] }]
    //   }
    // }));
  }

  /**
   * Simple CRC32 implementation (use a proper library in production)
   */
  private crc32(str: string): number {
    let crc = 0 ^ (-1);
    for (let i = 0; i < str.length; i++) {
      crc = (crc >>> 8) ^ this.crc32Table[(crc ^ str.charCodeAt(i)) & 0xFF];
    }
    return (crc ^ (-1)) >>> 0;
  }

  private crc32Table = (() => {
    const table = [];
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[i] = c;
    }
    return table;
  })();

  /**
   * Broadcast processed data to subscribers
   */
  private broadcastData(type: string, data: any): void {
    // Implement your data broadcasting logic here
    // This could emit events, update state, call callbacks, etc.
    console.log(`[DeltaMessageHandler] Broadcasting ${type} data:`, data);
  }
}
```
