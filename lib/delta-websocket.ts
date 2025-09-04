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

export interface DeltaMarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  timestamp: number;
}

export interface DeltaOrderBookData {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

export interface DeltaTradeData {
  symbol: string;
  price: number;
  size: number;
  side: 'buy' | 'sell';
  timestamp: number;
}

export type DeltaWebSocketMessage = 
  | { type: 'ticker'; data: DeltaMarketData }
  | { type: 'orderbook'; data: DeltaOrderBookData }
  | { type: 'trade'; data: DeltaTradeData }
  | { type: 'error'; data: { message: string; code?: string } }
  | { type: 'connected'; data: { message: string } }
  | { type: 'disconnected'; data: { message: string } };

export class DeltaWebSocketClient {
  private ws: WebSocket | null = null;
  private config: DeltaWebSocketConfig;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private subscriptions = new Set<string>();
  private messageHandlers = new Map<string, (message: DeltaWebSocketMessage) => void>();

  constructor(config: DeltaWebSocketConfig) {
    this.config = {
      baseUrl: 'wss://socket.india.delta.exchange',
      reconnectAttempts: 10,
      reconnectDelay: 5000,
      ...config
    };
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
      this.ws = new WebSocket(this.config.baseUrl!);
      
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('[DeltaWebSocket] Connection error:', error);
      this.isConnecting = false;
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

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.subscriptions.clear();
  }

  /**
   * Subscribe to market data for symbols
   */
  subscribe(symbols: string[]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[DeltaWebSocket] Not connected, storing subscriptions for later');
      symbols.forEach(symbol => this.subscriptions.add(symbol));
      return;
    }

    console.log('[DeltaWebSocket] Subscribing to symbols:', symbols);

    symbols.forEach(symbol => {
      this.subscriptions.add(symbol);
      
      // Subscribe to ticker updates
      this.send({
        type: 'subscribe',
        payload: {
          channels: [
            { name: 'ticker', symbols: [symbol] },
            { name: 'l2_orderbook', symbols: [symbol] }
          ]
        }
      });
    });
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[]): void {
    console.log('[DeltaWebSocket] Unsubscribing from symbols:', symbols);

    symbols.forEach(symbol => {
      this.subscriptions.delete(symbol);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({
          type: 'unsubscribe',
          payload: {
            channels: [
              { name: 'ticker', symbols: [symbol] },
              { name: 'l2_orderbook', symbols: [symbol] }
            ]
          }
        });
      }
    });
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

    // Authenticate if credentials are provided
    if (this.config.apiKey && this.config.apiSecret) {
      this.authenticate();
    }

    // Re-subscribe to previous subscriptions
    if (this.subscriptions.size > 0) {
      const symbols = Array.from(this.subscriptions);
      this.subscriptions.clear(); // Clear to avoid duplicates
      this.subscribe(symbols);
    }

    this.broadcastMessage({
      type: 'connected',
      data: { message: 'Connected to Delta Exchange WebSocket' }
    });
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      console.log('[DeltaWebSocket] Received message:', data.type || 'unknown');

      // Process different message types
      if (data.type === 'ticker' && data.symbol) {
        const marketData: DeltaMarketData = {
          symbol: data.symbol,
          price: parseFloat(data.close || data.price || '0'),
          change: parseFloat(data.change || '0'),
          changePercent: parseFloat(data.change_percent || '0'),
          volume: parseFloat(data.volume || '0'),
          high: parseFloat(data.high || '0'),
          low: parseFloat(data.low || '0'),
          timestamp: Date.now()
        };

        this.broadcastMessage({
          type: 'ticker',
          data: marketData
        });
      } else if (data.type === 'l2_orderbook' && data.symbol) {
        const orderBookData: DeltaOrderBookData = {
          symbol: data.symbol,
          bids: data.buy || [],
          asks: data.sell || [],
          timestamp: Date.now()
        };

        this.broadcastMessage({
          type: 'orderbook',
          data: orderBookData
        });
      } else if (data.type === 'recent_trade' && data.symbol) {
        const tradeData: DeltaTradeData = {
          symbol: data.symbol,
          price: parseFloat(data.price || '0'),
          size: parseFloat(data.size || '0'),
          side: data.side === 'buy' ? 'buy' : 'sell',
          timestamp: Date.now()
        };

        this.broadcastMessage({
          type: 'trade',
          data: tradeData
        });
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
    console.error('[DeltaWebSocket] ❌ WebSocket error:', event);
    this.isConnecting = false;

    this.broadcastMessage({
      type: 'error',
      data: { message: 'WebSocket connection error' }
    });

    this.handleReconnect();
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
    const timestamp = Date.now().toString();
    const method = 'GET';
    const path = '/live';
    const body = '';

    const signature = generateHmacSha256(
      method + timestamp + path + body,
      this.config.apiSecret
    );

    this.send({
      type: 'auth',
      payload: {
        api_key: this.config.apiKey,
        signature: signature,
        timestamp: timestamp
      }
    });

    console.log('[DeltaWebSocket] Authentication sent');
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
