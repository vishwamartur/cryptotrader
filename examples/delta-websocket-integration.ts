/**
 * Complete Delta Exchange WebSocket Integration Examples
 * Demonstrates "all" symbol subscriptions, authentication, and production usage
 */

import { DeltaWebSocketClient } from '../lib/delta-websocket-client';
import { useDeltaWebSocket } from '../hooks/use-delta-websocket';
import { useWebSocketMarketData } from '../hooks/use-websocket-market-data';

// Example 1: Basic "All" Symbol Subscription
export function basicAllSymbolExample() {
  const client = new DeltaWebSocketClient({
    environment: 'production', // or 'testnet'
    apiKey: process.env.DELTA_API_KEY,
    apiSecret: process.env.DELTA_API_SECRET
  });

  // Connect and subscribe to ALL symbols
  client.connect().then(() => {
    console.log('Connected to Delta Exchange WebSocket');
    
    // Subscribe to ALL symbols for ticker data
    client.subscribeToAllSymbols(['v2/ticker', 'ticker']);
    
    // Subscribe to ALL symbols for trades
    client.subscribeToAllSymbols(['all_trades']);
    
    // Subscribe to specific symbols for order book (limited channels)
    client.subscribe([
      {
        name: 'l2_orderbook',
        symbols: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'] // Max 20 symbols
      }
    ]);
  });

  // Handle different message types
  client.on('message', (message) => {
    switch (message.type) {
      case 'v2/ticker':
        console.log('Ticker update:', message.symbol, message.data);
        break;
      case 'all_trades':
        console.log('Trade:', message.symbol, message.data);
        break;
      case 'l2_orderbook':
        console.log('Order book:', message.symbol, message.data);
        break;
    }
  });

  // Handle connection events
  client.on('connected', () => {
    console.log('✅ Connected to Delta Exchange');
  });

  client.on('authenticated', () => {
    console.log('✅ Authenticated successfully');
  });

  client.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  return client;
}

// Example 2: React Hook Integration with "All" Symbols
export function ReactHookExample() {
  // Use the enhanced WebSocket market data hook
  const marketData = useWebSocketMarketData({
    autoConnect: true,
    subscribeToAllSymbols: true, // Enable "all" symbol subscription
    channels: ['v2/ticker', 'l1_orderbook', 'all_trades'],
    environment: 'production'
  });

  // Component logic
  React.useEffect(() => {
    if (marketData.isConnected) {
      console.log('✅ Connected with', marketData.subscribedSymbols.length, 'symbols');
      console.log('📊 Market data available for', marketData.connectedSymbols, 'symbols');
    }
  }, [marketData.isConnected, marketData.subscribedSymbols.length, marketData.connectedSymbols]);

  // Handle errors
  React.useEffect(() => {
    if (marketData.error) {
      console.error('Market data error:', marketData.error);
    }
  }, [marketData.error]);

  return {
    // Connection state
    isConnected: marketData.isConnected,
    isConnecting: marketData.isConnecting,
    error: marketData.error,
    
    // Data
    marketDataArray: marketData.marketDataArray,
    statistics: marketData.statistics,
    
    // Actions
    subscribeToAllSymbols: marketData.subscribeToAllSymbols,
    subscribeToSymbols: marketData.subscribeToSymbols,
    
    // Computed values
    totalSymbols: marketData.subscribedSymbols.length,
    liveDataCount: marketData.connectedSymbols
  };
}

// Example 3: Advanced Trading Application Integration
export class AdvancedTradingApp {
  private wsClient: DeltaWebSocketClient;
  private marketData = new Map<string, any>();
  private orderBooks = new Map<string, any>();
  private trades: any[] = [];

  constructor() {
    this.wsClient = new DeltaWebSocketClient({
      environment: 'production',
      apiKey: process.env.DELTA_API_KEY,
      apiSecret: process.env.DELTA_API_SECRET,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10
    });

    this.setupEventHandlers();
  }

  async initialize() {
    try {
      // Connect to WebSocket
      await this.wsClient.connect();
      console.log('✅ Connected to Delta Exchange');

      // Subscribe to ALL symbols for market overview
      this.wsClient.subscribeToAllSymbols([
        'v2/ticker',     // Complete ticker data
        'funding_rate',  // Funding rates for perpetuals
        'mark_price'     // Mark prices
      ]);

      // Subscribe to specific symbols for detailed trading
      const majorPairs = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'BNBUSDT'];
      
      this.wsClient.subscribe([
        {
          name: 'l2_orderbook',
          symbols: majorPairs
        },
        {
          name: 'l2_updates',
          symbols: majorPairs
        },
        {
          name: 'all_trades',
          symbols: majorPairs
        }
      ]);

      // Subscribe to private channels if authenticated
      if (this.wsClient.getConnectionState().authenticated) {
        this.wsClient.subscribe([
          { name: 'orders', symbols: [] },
          { name: 'positions', symbols: [] },
          { name: 'trading_notifications', symbols: [] }
        ]);
      }

    } catch (error) {
      console.error('❌ Failed to initialize trading app:', error);
      throw error;
    }
  }

  private setupEventHandlers() {
    // Handle ticker updates
    this.wsClient.addMessageHandler('v2/ticker', (data) => {
      this.marketData.set(data.symbol, {
        ...data,
        timestamp: Date.now()
      });
      
      // Emit update event for UI
      this.emit('marketDataUpdate', data.symbol, data);
    });

    // Handle order book snapshots
    this.wsClient.addMessageHandler('l2_orderbook', (data) => {
      this.orderBooks.set(data.symbol, {
        ...data,
        timestamp: Date.now()
      });
      
      this.emit('orderBookSnapshot', data.symbol, data);
    });

    // Handle order book updates
    this.wsClient.addMessageHandler('l2_updates', (data) => {
      const currentOrderBook = this.orderBooks.get(data.symbol);
      if (currentOrderBook) {
        const updatedOrderBook = this.applyOrderBookUpdate(currentOrderBook, data);
        this.orderBooks.set(data.symbol, updatedOrderBook);
        this.emit('orderBookUpdate', data.symbol, updatedOrderBook);
      }
    });

    // Handle trades
    this.wsClient.addMessageHandler('all_trades', (data) => {
      this.trades.push({
        ...data,
        timestamp: Date.now()
      });
      
      // Keep only last 1000 trades
      if (this.trades.length > 1000) {
        this.trades = this.trades.slice(-1000);
      }
      
      this.emit('tradeUpdate', data);
    });

    // Handle private data
    this.wsClient.addMessageHandler('orders', (data) => {
      this.emit('orderUpdate', data);
    });

    this.wsClient.addMessageHandler('positions', (data) => {
      this.emit('positionUpdate', data);
    });

    // Handle connection events
    this.wsClient.on('connected', () => {
      this.emit('connectionStatusChange', 'connected');
    });

    this.wsClient.on('disconnected', () => {
      this.emit('connectionStatusChange', 'disconnected');
    });

    this.wsClient.on('error', (error) => {
      this.emit('error', error);
    });
  }

  // Get current market data
  getMarketData(symbol?: string) {
    if (symbol) {
      return this.marketData.get(symbol);
    }
    return Array.from(this.marketData.values());
  }

  // Get order book
  getOrderBook(symbol: string) {
    return this.orderBooks.get(symbol);
  }

  // Get recent trades
  getRecentTrades(symbol?: string, limit: number = 100) {
    let trades = this.trades;
    
    if (symbol) {
      trades = trades.filter(trade => trade.symbol === symbol);
    }
    
    return trades.slice(-limit);
  }

  // Subscribe to additional symbols
  async subscribeToSymbol(symbol: string, channels: string[] = ['v2/ticker']) {
    const subscriptionChannels = channels.map(name => ({
      name,
      symbols: [symbol]
    }));
    
    this.wsClient.subscribe(subscriptionChannels);
  }

  // Unsubscribe from symbols
  async unsubscribeFromSymbol(symbol: string, channels: string[] = ['v2/ticker']) {
    const subscriptionChannels = channels.map(name => ({
      name,
      symbols: [symbol]
    }));
    
    this.wsClient.unsubscribe(subscriptionChannels);
  }

  // Get connection statistics
  getConnectionStats() {
    const state = this.wsClient.getConnectionState();
    return {
      isConnected: state.connected,
      isAuthenticated: state.authenticated,
      reconnectAttempts: state.reconnectAttempts,
      subscriptions: state.subscriptions.size,
      marketDataSymbols: this.marketData.size,
      orderBookSymbols: this.orderBooks.size,
      totalTrades: this.trades.length
    };
  }

  // Apply order book update
  private applyOrderBookUpdate(orderBook: any, update: any) {
    // Implementation for applying incremental updates
    // This would merge the update with the existing order book
    return {
      ...orderBook,
      ...update,
      timestamp: Date.now()
    };
  }

  // Event emitter functionality
  private emit(event: string, ...args: any[]) {
    // Implementation depends on your event system
    console.log(`[TradingApp] Event: ${event}`, ...args);
  }

  // Cleanup
  async destroy() {
    this.wsClient.disconnect();
    this.marketData.clear();
    this.orderBooks.clear();
    this.trades = [];
  }
}

// Example 4: Environment-Specific Configuration
export function createEnvironmentSpecificClient(env: 'production' | 'testnet' = 'production') {
  const config = {
    production: {
      environment: 'production' as const,
      apiKey: process.env.DELTA_PROD_API_KEY,
      apiSecret: process.env.DELTA_PROD_API_SECRET,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10
    },
    testnet: {
      environment: 'testnet' as const,
      apiKey: process.env.DELTA_TEST_API_KEY,
      apiSecret: process.env.DELTA_TEST_API_SECRET,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5
    }
  };

  return new DeltaWebSocketClient(config[env]);
}

// Example 5: Error Handling and Recovery
export function createRobustWebSocketClient() {
  const client = new DeltaWebSocketClient({
    environment: 'production',
    apiKey: process.env.DELTA_API_KEY,
    apiSecret: process.env.DELTA_API_SECRET
  });

  // Comprehensive error handling
  client.on('error', (error) => {
    console.error('WebSocket error:', error);
    
    // Log error details for debugging
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    if (error.troubleshooting) {
      console.log('Troubleshooting steps:');
      error.troubleshooting.forEach((step: string) => {
        console.log(' -', step);
      });
    }
  });

  // Connection recovery
  client.on('disconnected', () => {
    console.log('Connection lost, will attempt to reconnect...');
  });

  client.on('connected', () => {
    console.log('Connection restored');
  });

  // Authentication handling
  client.on('auth_error', (error) => {
    console.error('Authentication failed:', error);
    
    // Handle different auth error types
    if (error.message?.includes('Invalid API key')) {
      console.error('Please check your API key configuration');
    } else if (error.message?.includes('Invalid signature')) {
      console.error('Please check your API secret configuration');
    }
  });

  return client;
}
