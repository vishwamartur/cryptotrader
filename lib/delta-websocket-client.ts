import { EventEmitter } from 'events';
import WebSocket from 'ws';
import crypto from 'crypto';

export interface DeltaWebSocketConfig {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  environment?: 'production' | 'testnet'; // New: Environment selection
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  authTimeout?: number;
}

export interface SubscriptionChannel {
  name: string;
  symbols: string[];
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ConnectionStatus {
  connected: boolean;
  authenticated: boolean;
  reconnectAttempts: number;
  lastHeartbeat: number;
  subscriptions: Map<string, SubscriptionChannel>;
  messagesReceived: number;
  messagesSent: number;
  latency: number;
  errors: string[];
}

export class DeltaWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<DeltaWebSocketConfig>;
  private connectionStatus: ConnectionStatus;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private pingTimeout: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private subscriptionQueue: SubscriptionChannel[] = [];
  private isReconnecting = false;

  constructor(config: DeltaWebSocketConfig = {}) {
    super();
    
    // Environment URLs - Official Delta Exchange WebSocket endpoints
    const environmentUrls = {
      production: 'wss://socket.india.delta.exchange',
      testnet: 'wss://socket-ind.testnet.deltaex.org'
    };

    const environment = config.environment || 'production';

    this.config = {
      apiKey: config.apiKey || '',
      apiSecret: config.apiSecret || '',
      baseUrl: config.baseUrl || environmentUrls[environment],
      environment,
      reconnectInterval: config.reconnectInterval || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      connectionTimeout: config.connectionTimeout || 15000,
      authTimeout: config.authTimeout || 10000
    };

    this.connectionStatus = {
      connected: false,
      authenticated: false,
      reconnectAttempts: 0,
      lastHeartbeat: 0,
      subscriptions: new Map(),
      messagesReceived: 0,
      messagesSent: 0,
      latency: 0,
      errors: [],
    };
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('[DeltaWS] Connecting to:', this.config.baseUrl);
        this.ws = new WebSocket(this.config.baseUrl);

        this.ws.onopen = () => {
          console.log('[DeltaWS] Connected successfully');
          this.connectionStatus.connected = true;
          this.connectionStatus.reconnectAttempts = 0;
          this.connectionStatus.lastHeartbeat = Date.now();
          
          this.startHeartbeat();
          this.emit('connected');
          
          // Authenticate if credentials are provided
          if (this.config.apiKey && this.config.apiSecret) {
            this.authenticate().then(() => {
              this.resubscribeAll();
              resolve();
            }).catch(reject);
          } else {
            this.resubscribeAll();
            resolve();
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = typeof event.data === 'string' ? event.data : event.data.toString();
            this.handleMessage(data);
          } catch (error) {
            console.error('[DeltaWS] Failed to process message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('[DeltaWS] Connection closed:', event.code, event.reason);
          this.connectionStatus.connected = false;
          this.connectionStatus.authenticated = false;
          this.stopHeartbeat();
          this.emit('disconnected', { code: event.code, reason: event.reason });
          
          if (!this.isReconnecting && this.connectionStatus.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DeltaWS] WebSocket error:', error);
          const errorMessage = `WebSocket connection error`;
          this.connectionStatus.errors.push(errorMessage);
          this.emit('error', new Error(errorMessage));
          reject(new Error(errorMessage));
        };

      } catch (error) {
        console.error('[DeltaWS] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.isReconnecting = false;
    this.clearTimeouts();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connectionStatus.connected = false;
    this.connectionStatus.authenticated = false;
    this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
  }

  private async authenticate(): Promise<void> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('API credentials not provided');
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const message = 'GET' + timestamp + '/live';
      const signature = crypto
        .createHmac('sha256', this.config.apiSecret)
        .update(message)
        .digest('hex');

      const authMessage = {
        type: 'auth',
        api_key: this.config.apiKey,
        signature,
        timestamp,
      };

      console.log('[DeltaWS] Sending authentication');
      this.sendMessage(authMessage);
      
      // Wait for auth response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Authentication timeout'));
        }, 10000);

        const authHandler = (data: any) => {
          if (data.type === 'auth' || data.type === 'authenticated') {
            clearTimeout(timeout);
            this.removeMessageHandler('auth', authHandler);
            
            if (data.success !== false) {
              console.log('[DeltaWS] Authentication successful');
              this.connectionStatus.authenticated = true;
              this.emit('authenticated');
              resolve();
            } else {
              const error = new Error(`Authentication failed: ${data.error || 'Unknown error'}`);
              this.emit('error', error);
              reject(error);
            }
          }
        };

        this.addMessageHandler('auth', authHandler);
      });
    } catch (error) {
      console.error('[DeltaWS] Authentication error:', error);
      throw error;
    }
  }

  subscribe(channels: SubscriptionChannel[]): void {
    if (!this.connectionStatus.connected) {
      // Queue subscriptions for when connection is established
      this.subscriptionQueue.push(...channels);
      console.log('[DeltaWS] Queued subscriptions for later:', channels);
      return;
    }

    // Validate and process channels for "all" symbol support
    const processedChannels = this.processChannelsForSubscription(channels);

    if (processedChannels.length === 0) {
      console.warn('[DeltaWS] No valid channels to subscribe to');
      return;
    }

    const subscribeMessage = {
      type: 'subscribe',
      payload: { channels: processedChannels },
    };

    console.log('[DeltaWS] Subscribing to channels:', processedChannels);
    this.sendMessage(subscribeMessage);

    // Track subscriptions
    processedChannels.forEach(channel => {
      const key = `${channel.name}:${channel.symbols.join(',')}`;
      this.connectionStatus.subscriptions.set(key, channel);
    });

    this.emit('subscribed', processedChannels);
  }

  /**
   * Subscribe to ALL symbols using "all" keyword
   */
  subscribeToAllSymbols(channelNames: string[]): void {
    console.log('[DeltaWS] 🌐 Subscribing to ALL symbols for channels:', channelNames);

    // Create channels with "all" symbol
    const channels: SubscriptionChannel[] = channelNames.map(name => ({
      name,
      symbols: ['all']
    }));

    this.subscribe(channels);
  }

  /**
   * Process channels for subscription, handling "all" symbol validation
   */
  private processChannelsForSubscription(channels: SubscriptionChannel[]): SubscriptionChannel[] {
    const channelsWithAllSupport = [
      'v2/ticker',
      'ticker',
      'l1_orderbook',
      'all_trades',
      'funding_rate',
      'mark_price',
      'announcements'
    ];

    const channelLimits: Record<string, number> = {
      'l2_orderbook': 20,
      'l2_updates': 100
    };

    return channels.filter(channel => {
      // Check if channel uses "all" symbol
      if (channel.symbols.length === 1 && channel.symbols[0] === 'all') {
        if (!channelsWithAllSupport.includes(channel.name)) {
          console.warn(`[DeltaWS] Channel "${channel.name}" does not support "all" symbol subscription`);
          return false;
        }
        console.log(`[DeltaWS] ✅ Channel "${channel.name}" supports "all" symbol subscription`);
        return true;
      }

      // Check channel limits for specific symbols
      const limit = channelLimits[channel.name];
      if (limit && channel.symbols.length > limit) {
        console.warn(`[DeltaWS] Channel "${channel.name}" exceeds limit of ${limit} symbols (requested: ${channel.symbols.length})`);
        // Truncate to limit
        channel.symbols = channel.symbols.slice(0, limit);
      }

      return true;
    });
  }

  unsubscribe(channels: SubscriptionChannel[]): void {
    if (!this.connectionStatus.connected) {
      return;
    }

    const unsubscribeMessage = {
      type: 'unsubscribe',
      payload: { channels },
    };

    console.log('[DeltaWS] Unsubscribing from channels:', channels);
    this.sendMessage(unsubscribeMessage);

    // Remove from tracked subscriptions
    channels.forEach(channel => {
      const key = `${channel.name}:${channel.symbols.join(',')}`;
      this.connectionStatus.subscriptions.delete(key);
    });

    this.emit('unsubscribed', channels);
  }

  addMessageHandler(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  removeMessageHandler(type: string, handler?: (data: any) => void): void {
    this.messageHandlers.delete(type);
  }

  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  private sendMessage(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      this.connectionStatus.messagesSent++;
      console.log('[DeltaWS] Sent message:', message.type);
    } else {
      console.warn('[DeltaWS] Cannot send message, WebSocket not connected');
    }
  }

  private handleMessage(data: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(data);
      this.connectionStatus.messagesReceived++;
      this.connectionStatus.lastHeartbeat = Date.now();

      console.log('[DeltaWS] Received message:', message.type);

      // Handle heartbeat/ping messages
      if (message.type === 'ping') {
        this.sendMessage({ type: 'pong' });
        return;
      }

      // Emit to specific handler if exists
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message);
      }

      // Emit generic message event
      this.emit('message', message);
      this.emit(message.type, message);

    } catch (error) {
      console.error('[DeltaWS] Error parsing message:', error, 'Raw data:', data);
      this.connectionStatus.errors.push(`Message parse error: ${error}`);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendMessage({ type: 'ping' });
        
        // Set timeout for pong response
        this.pingTimeout = setTimeout(() => {
          console.warn('[DeltaWS] Heartbeat timeout, reconnecting...');
          this.ws?.close();
        }, 10000);
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isReconnecting || this.connectionStatus.reconnectAttempts >= this.config.maxReconnectAttempts) {
      return;
    }

    this.isReconnecting = true;
    this.connectionStatus.reconnectAttempts++;
    
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.connectionStatus.reconnectAttempts - 1),
      30000
    );

    console.log(`[DeltaWS] Scheduling reconnect attempt ${this.connectionStatus.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.isReconnecting = false;
      this.connect().catch(error => {
        console.error('[DeltaWS] Reconnect failed:', error);
        this.scheduleReconnect();
      });
    }, delay);

    this.emit('reconnecting', { attempt: this.connectionStatus.reconnectAttempts, delay });
  }

  private resubscribeAll(): void {
    // Process queued subscriptions
    if (this.subscriptionQueue.length > 0) {
      this.subscribe([...this.subscriptionQueue]);
      this.subscriptionQueue = [];
    }

    // Resubscribe to existing subscriptions
    const channels = Array.from(this.connectionStatus.subscriptions.values());
    if (channels.length > 0) {
      this.subscribe(channels);
    }
  }

  private clearTimeouts(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopHeartbeat();
  }
}



// Factory function to create client with environment credentials
export function createDeltaWebSocketClient(config: Partial<DeltaWebSocketConfig> = {}): DeltaWebSocketClient {
  // Check if credentials are provided in config first (for server-side initialization)
  if (config.apiKey && config.apiSecret) {
    const defaultConfig: DeltaWebSocketConfig = {
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      baseUrl: process.env.NEXT_PUBLIC_DELTA_WS_URL || config.baseUrl || 'wss://socket.india.delta.exchange',
      ...config,
    };

    console.log('[WebSocket Factory] Creating live WebSocket client with provided credentials');
    return new DeltaWebSocketClient(defaultConfig);
  }

  // Try to get credentials from environment (server-side only)
  const apiKey = process.env.DELTA_API_KEY || process.env.DELTA_EXCHANGE_API_KEY;
  const apiSecret = process.env.DELTA_API_SECRET || process.env.DELTA_EXCHANGE_API_SECRET;

  if (!apiKey || !apiSecret) {
    // Check if we're on the client side
    if (typeof window !== 'undefined') {
      throw new Error(
        'Delta Exchange WebSocket client cannot be initialized on the client-side without credentials. ' +
        'WebSocket connections should be initialized server-side or credentials should be passed via props.'
      );
    }

    throw new Error(
      'Delta Exchange WebSocket credentials are required. Please set DELTA_EXCHANGE_API_KEY and DELTA_EXCHANGE_API_SECRET environment variables. ' +
      'Get your API credentials from: https://www.delta.exchange/app/api-management'
    );
  }

  const defaultConfig: DeltaWebSocketConfig = {
    apiKey,
    apiSecret,
    baseUrl: process.env.NEXT_PUBLIC_DELTA_WS_URL || process.env.DELTA_WS_URL || 'wss://socket.india.delta.exchange',
    ...config,
  };

  console.log('[WebSocket Factory] Creating live WebSocket client with credentials');
  return new DeltaWebSocketClient(defaultConfig);
}
