/**
 * Global WebSocket Connection Manager
 * Ensures only one WebSocket connection is active at a time across all components
 */

export interface WebSocketConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  isAuthenticated: boolean;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  error: string | null;
  lastHeartbeat: Date | null;
  clientCount: number;
  marketData: any[];
  portfolioData: any;
  orderBooks: Record<string, any>;
  subscriptions: string[];
  products: any[];
}

type StateListener = (state: WebSocketConnectionState) => void;

class WebSocketConnectionManager {
  private static instance: WebSocketConnectionManager | null = null;
  private eventSource: EventSource | null = null;
  private listeners: Set<StateListener> = new Set();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  
  private state: WebSocketConnectionState = {
    isConnected: false,
    isConnecting: false,
    isAuthenticated: false,
    connectionStatus: 'disconnected',
    error: null,
    lastHeartbeat: null,
    clientCount: 0,
    marketData: [],
    portfolioData: null,
    orderBooks: {},
    subscriptions: [],
    products: []
  };

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): WebSocketConnectionManager {
    if (!WebSocketConnectionManager.instance) {
      WebSocketConnectionManager.instance = new WebSocketConnectionManager();
    }
    return WebSocketConnectionManager.instance;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.state);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update state and notify all listeners
   */
  private updateState(updates: Partial<WebSocketConnectionState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Get current state
   */
  getState(): WebSocketConnectionState {
    return { ...this.state };
  }

  /**
   * Connect to WebSocket proxy
   */
  connect(): void {
    if (this.state.isConnecting || this.state.isConnected) {
      console.log('[WebSocket Manager] Already connecting or connected');
      return;
    }

    console.log('[WebSocket Manager] Connecting to proxy server...');
    this.updateState({ 
      isConnecting: true, 
      error: null,
      connectionStatus: 'connecting'
    });

    try {
      // Create EventSource connection to proxy
      this.eventSource = new EventSource('/api/websocket/delta-stream');

      // Connection opened
      this.eventSource.onopen = () => {
        console.log('[WebSocket Manager] Connected to proxy server');
        this.reconnectAttempts = 0;
        this.updateState({
          isConnected: true,
          isConnecting: false,
          connectionStatus: 'connected',
          error: null,
          lastHeartbeat: new Date()
        });
      };

      // Handle messages
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[WebSocket Manager] Failed to parse message:', error);
        }
      };

      // Handle errors
      this.eventSource.onerror = (error) => {
        console.error('[WebSocket Manager] EventSource error:', error);
        
        this.updateState({
          isConnected: false,
          isConnecting: false,
          connectionStatus: 'error',
          error: 'Connection error'
        });

        // Schedule reconnection
        this.scheduleReconnection();
      };

    } catch (error) {
      console.error('[WebSocket Manager] Failed to create EventSource:', error);
      this.updateState({
        isConnecting: false,
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  }

  /**
   * Disconnect from WebSocket proxy
   */
  disconnect(): void {
    console.log('[WebSocket Manager] Disconnecting from proxy...');

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.updateState({
      isConnected: false,
      isConnecting: false,
      isAuthenticated: false,
      connectionStatus: 'disconnected',
      error: null
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: any) {
    console.log('[WebSocket Manager] Received message:', data.type);

    switch (data.type) {
      case 'connection_status':
        this.updateState({
          isAuthenticated: data.authenticated,
          clientCount: data.clientCount || 0,
          lastHeartbeat: new Date()
        });
        break;

      case 'market_data':
        this.updateState({
          marketData: data.data || [],
          lastHeartbeat: new Date()
        });
        break;

      case 'portfolio_data':
        this.updateState({
          portfolioData: data.data,
          lastHeartbeat: new Date()
        });
        break;

      case 'orderbook_data':
        if (data.symbol) {
          this.updateState({
            orderBooks: {
              ...this.state.orderBooks,
              [data.symbol]: data.data
            },
            lastHeartbeat: new Date()
          });
        }
        break;

      case 'subscription_update':
        this.updateState({
          subscriptions: data.subscriptions || [],
          lastHeartbeat: new Date()
        });
        break;

      case 'products':
        this.updateState({
          products: data.data || [],
          lastHeartbeat: new Date()
        });
        break;

      case 'heartbeat':
        this.updateState({
          lastHeartbeat: new Date()
        });
        break;

      case 'error':
        console.error('[WebSocket Manager] Server error:', data.message);
        this.updateState({
          error: data.message,
          lastHeartbeat: new Date()
        });
        break;

      default:
        console.log('[WebSocket Manager] Unknown message type:', data.type);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket Manager] Max reconnection attempts reached');
      this.updateState({
        error: 'Max reconnection attempts reached'
      });
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[WebSocket Manager] Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to specific channels
   */
  async subscribe(channels: Array<{ name: string; symbols?: string[] }>): Promise<void> {
    if (!this.state.isConnected) {
      console.warn('[WebSocket Manager] Cannot subscribe - not connected');
      return;
    }

    try {
      const response = await fetch('/api/websocket/delta-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subscribe',
          channels
        })
      });

      if (!response.ok) {
        throw new Error(`Subscription failed: ${response.status}`);
      }

      console.log('[WebSocket Manager] Subscription request sent');
    } catch (error) {
      console.error('[WebSocket Manager] Subscription failed:', error);
      this.updateState({
        error: error instanceof Error ? error.message : 'Subscription failed'
      });
    }
  }

  /**
   * Get connection count for debugging
   */
  getListenerCount(): number {
    return this.listeners.size;
  }
}

export default WebSocketConnectionManager;
