/**
 * Delta Exchange Fallback Manager
 * Implements comprehensive fallback mechanisms and error handling
 * for both REST API and WebSocket connections
 */

'use client';

import { EventEmitter } from 'events';
import { DeltaRESTService } from './delta-hybrid-integration';
import { EnhancedDeltaWebSocket } from './delta-websocket-enhanced';

export interface FallbackConfig {
  enableRestFallback: boolean;
  enableMockFallback: boolean;
  restFallbackTimeout: number;
  websocketReconnectAttempts: number;
  websocketReconnectDelay: number;
  healthCheckInterval: number;
  fallbackDataTTL: number;
}

export interface ConnectionHealth {
  websocket: {
    connected: boolean;
    authenticated: boolean;
    lastHeartbeat: number;
    reconnectAttempts: number;
  };
  rest: {
    available: boolean;
    lastSuccessfulCall: number;
    consecutiveFailures: number;
  };
  fallbackMode: 'none' | 'rest' | 'mock';
  lastHealthCheck: number;
}

export interface FallbackData {
  marketData: Map<string, any>;
  portfolioData: {
    balances: any[];
    positions: any[];
    orders: any[];
  };
  lastUpdate: number;
  source: 'websocket' | 'rest' | 'mock';
}

// Comprehensive Fallback Manager
export class DeltaFallbackManager extends EventEmitter {
  private config: FallbackConfig;
  private restService: DeltaRESTService;
  private websocket: EnhancedDeltaWebSocket;
  private health: ConnectionHealth;
  private fallbackData: FallbackData;
  private healthCheckTimer?: NodeJS.Timeout;
  private restFallbackTimer?: NodeJS.Timeout;

  constructor(
    apiKey: string,
    apiSecret: string,
    config: Partial<FallbackConfig> = {}
  ) {
    super();

    this.config = {
      enableRestFallback: true,
      enableMockFallback: true,
      restFallbackTimeout: 10000,
      websocketReconnectAttempts: 10,
      websocketReconnectDelay: 1000,
      healthCheckInterval: 30000,
      fallbackDataTTL: 300000, // 5 minutes
      ...config
    };

    this.restService = new DeltaRESTService(apiKey, apiSecret);
    this.websocket = new EnhancedDeltaWebSocket({ apiKey, apiSecret });

    this.health = {
      websocket: {
        connected: false,
        authenticated: false,
        lastHeartbeat: 0,
        reconnectAttempts: 0
      },
      rest: {
        available: false,
        lastSuccessfulCall: 0,
        consecutiveFailures: 0
      },
      fallbackMode: 'none',
      lastHealthCheck: 0
    };

    this.fallbackData = {
      marketData: new Map(),
      portfolioData: {
        balances: [],
        positions: [],
        orders: []
      },
      lastUpdate: 0,
      source: 'websocket'
    };

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // WebSocket event handlers
    this.websocket.on('connected', () => {
      console.log('[Fallback Manager] WebSocket connected');
      this.health.websocket.connected = true;
      this.health.websocket.reconnectAttempts = 0;
      this.health.fallbackMode = 'none';
      this.stopRestFallback();
      this.emit('connectionRestored', 'websocket');
    });

    this.websocket.on('authenticated', () => {
      console.log('[Fallback Manager] WebSocket authenticated');
      this.health.websocket.authenticated = true;
    });

    this.websocket.on('disconnected', (reason) => {
      console.log('[Fallback Manager] WebSocket disconnected:', reason);
      this.health.websocket.connected = false;
      this.health.websocket.authenticated = false;
      this.handleWebSocketFailure();
    });

    this.websocket.on('error', (error) => {
      console.error('[Fallback Manager] WebSocket error:', error);
      this.handleWebSocketFailure();
    });

    // Data update handlers
    this.websocket.on('marketData', (data) => {
      this.updateFallbackData('market', data);
    });

    this.websocket.on('portfolioUpdate', (data) => {
      this.updateFallbackData('portfolio', data);
    });
  }

  private handleWebSocketFailure() {
    this.health.websocket.reconnectAttempts++;
    
    if (this.health.websocket.reconnectAttempts >= this.config.websocketReconnectAttempts) {
      console.log('[Fallback Manager] WebSocket max reconnect attempts reached, switching to fallback');
      this.activateFallback();
    }
  }

  private activateFallback() {
    if (this.config.enableRestFallback && this.health.rest.available) {
      console.log('[Fallback Manager] Activating REST API fallback');
      this.health.fallbackMode = 'rest';
      this.startRestFallback();
      this.emit('fallbackActivated', 'rest');
    } else if (this.config.enableMockFallback) {
      console.log('[Fallback Manager] Activating mock data fallback');
      this.health.fallbackMode = 'mock';
      this.loadMockData();
      this.emit('fallbackActivated', 'mock');
    } else {
      console.error('[Fallback Manager] No fallback options available');
      this.emit('allConnectionsFailed');
    }
  }

  private startRestFallback() {
    if (this.restFallbackTimer) {
      clearInterval(this.restFallbackTimer);
    }

    this.restFallbackTimer = setInterval(async () => {
      try {
        await this.fetchDataViaRest();
      } catch (error) {
        console.error('[Fallback Manager] REST fallback error:', error);
        this.health.rest.consecutiveFailures++;
        
        if (this.health.rest.consecutiveFailures >= 3) {
          console.log('[Fallback Manager] REST fallback failed, switching to mock data');
          this.stopRestFallback();
          if (this.config.enableMockFallback) {
            this.health.fallbackMode = 'mock';
            this.loadMockData();
            this.emit('fallbackActivated', 'mock');
          }
        }
      }
    }, this.config.restFallbackTimeout);
  }

  private stopRestFallback() {
    if (this.restFallbackTimer) {
      clearInterval(this.restFallbackTimer);
      this.restFallbackTimer = undefined;
    }
  }

  private async fetchDataViaRest() {
    try {
      // Fetch portfolio data via REST API
      const [balances, positions] = await Promise.all([
        this.restService.getInitialBalances(),
        this.restService.getInitialPositions()
      ]);

      if (balances.success && positions.success) {
        this.fallbackData.portfolioData = {
          balances: balances.result || [],
          positions: positions.result || [],
          orders: [] // Orders require WebSocket for real-time updates
        };
        this.fallbackData.lastUpdate = Date.now();
        this.fallbackData.source = 'rest';
        
        this.health.rest.lastSuccessfulCall = Date.now();
        this.health.rest.consecutiveFailures = 0;
        
        this.emit('dataUpdate', this.fallbackData);
      }
    } catch (error) {
      this.health.rest.consecutiveFailures++;
      throw error;
    }
  }

  private loadMockData() {
    // Load comprehensive mock data for development/testing
    this.fallbackData = {
      marketData: new Map([
        ['BTCUSDT_ticker', {
          symbol: 'BTCUSDT',
          mark_price: '45000.00',
          last_price: '45050.00',
          bid: '44980.00',
          ask: '45020.00',
          volume_24h: '1234567.89',
          change_24h: '2.5',
          timestamp: Date.now()
        }],
        ['ETHUSDT_ticker', {
          symbol: 'ETHUSDT',
          mark_price: '3000.00',
          last_price: '3005.00',
          bid: '2998.00',
          ask: '3002.00',
          volume_24h: '987654.32',
          change_24h: '1.8',
          timestamp: Date.now()
        }]
      ]),
      portfolioData: {
        balances: [
          {
            asset: 'USDT',
            wallet_balance: '10000.00',
            unrealized_pnl: '250.50',
            available_balance: '9500.00',
            reserved_balance: '500.00'
          },
          {
            asset: 'BTC',
            wallet_balance: '0.1',
            unrealized_pnl: '100.00',
            available_balance: '0.05',
            reserved_balance: '0.05'
          }
        ],
        positions: [
          {
            id: 1,
            product: { id: 1, symbol: 'BTCUSDT' },
            size: '0.1',
            entry_price: '45000.00',
            mark_price: '46000.00',
            unrealized_pnl: '100.00',
            side: 'buy'
          },
          {
            id: 2,
            product: { id: 2, symbol: 'ETHUSDT' },
            size: '2.0',
            entry_price: '3000.00',
            mark_price: '3075.00',
            unrealized_pnl: '150.00',
            side: 'buy'
          }
        ],
        orders: [
          {
            id: '1',
            product: { id: 1, symbol: 'BTCUSDT' },
            size: '0.05',
            side: 'buy',
            order_type: 'limit_order',
            limit_price: '44000.00',
            state: 'open'
          }
        ]
      },
      lastUpdate: Date.now(),
      source: 'mock'
    };

    this.emit('dataUpdate', this.fallbackData);
  }

  private updateFallbackData(type: 'market' | 'portfolio', data: any) {
    if (type === 'market') {
      const key = `${data.symbol}_${data.type}`;
      this.fallbackData.marketData.set(key, {
        ...data.data,
        timestamp: data.timestamp
      });
    } else if (type === 'portfolio') {
      // Update portfolio data based on type
      switch (data.type) {
        case 'balance':
          const balanceIndex = this.fallbackData.portfolioData.balances.findIndex(
            b => b.asset === data.data.asset
          );
          if (balanceIndex >= 0) {
            this.fallbackData.portfolioData.balances[balanceIndex] = data.data;
          } else {
            this.fallbackData.portfolioData.balances.push(data.data);
          }
          break;
        
        case 'position':
          const positionIndex = this.fallbackData.portfolioData.positions.findIndex(
            p => p.product.symbol === data.data.symbol
          );
          if (positionIndex >= 0) {
            this.fallbackData.portfolioData.positions[positionIndex] = data.data;
          } else {
            this.fallbackData.portfolioData.positions.push(data.data);
          }
          break;
        
        case 'order':
          const orderIndex = this.fallbackData.portfolioData.orders.findIndex(
            o => o.id === data.data.id
          );
          if (orderIndex >= 0) {
            if (data.data.state === 'cancelled' || data.data.state === 'closed') {
              this.fallbackData.portfolioData.orders.splice(orderIndex, 1);
            } else {
              this.fallbackData.portfolioData.orders[orderIndex] = data.data;
            }
          } else if (data.data.state === 'open') {
            this.fallbackData.portfolioData.orders.push(data.data);
          }
          break;
      }
    }

    this.fallbackData.lastUpdate = Date.now();
    this.fallbackData.source = 'websocket';
    this.emit('dataUpdate', this.fallbackData);
  }

  private startHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }

  private async performHealthCheck() {
    this.health.lastHealthCheck = Date.now();

    // Check REST API health
    try {
      const testResult = await this.restService.testConnection();
      this.health.rest.available = testResult.success;
      if (testResult.success) {
        this.health.rest.lastSuccessfulCall = Date.now();
        this.health.rest.consecutiveFailures = 0;
      }
    } catch (error) {
      this.health.rest.available = false;
      this.health.rest.consecutiveFailures++;
    }

    // Check WebSocket health
    this.health.websocket.lastHeartbeat = Date.now();

    // Emit health status
    this.emit('healthCheck', this.health);

    // Check if fallback data is stale
    const dataAge = Date.now() - this.fallbackData.lastUpdate;
    if (dataAge > this.config.fallbackDataTTL) {
      console.warn('[Fallback Manager] Fallback data is stale, attempting refresh');
      if (this.health.fallbackMode === 'rest') {
        await this.fetchDataViaRest().catch(() => {
          console.warn('[Fallback Manager] Failed to refresh REST data');
        });
      }
    }
  }

  // ===== PUBLIC API =====

  async initialize() {
    try {
      console.log('[Fallback Manager] Initializing...');

      // Test REST API connection
      const restTest = await this.restService.testConnection();
      this.health.rest.available = restTest.success;
      
      if (restTest.success) {
        this.health.rest.lastSuccessfulCall = Date.now();
        console.log('[Fallback Manager] REST API connection verified');
      } else {
        console.warn('[Fallback Manager] REST API connection failed:', restTest.error);
      }

      // Connect WebSocket
      try {
        await this.websocket.connect();
        
        // Subscribe to data streams
        await Promise.all([
          this.websocket.subscribeToTickers(['all']),
          this.websocket.subscribeToBalances(),
          this.websocket.subscribeToPositions(['all']),
          this.websocket.subscribeToOrders(['all']),
          this.websocket.subscribeToUserTrades(['all'])
        ]);

        console.log('[Fallback Manager] WebSocket connection established');
      } catch (error) {
        console.warn('[Fallback Manager] WebSocket connection failed:', error);
        this.activateFallback();
      }

      // Start health monitoring
      this.startHealthCheck();

      console.log('[Fallback Manager] Initialization complete');
      return true;
    } catch (error) {
      console.error('[Fallback Manager] Initialization failed:', error);
      throw error;
    }
  }

  // ===== DATA ACCESS =====

  getCurrentData(): FallbackData {
    return { ...this.fallbackData };
  }

  getMarketData(symbol: string, type: string) {
    const key = `${symbol}_${type}`;
    return this.fallbackData.marketData.get(key);
  }

  getPortfolioData() {
    return { ...this.fallbackData.portfolioData };
  }

  getConnectionHealth(): ConnectionHealth {
    return { ...this.health };
  }

  isDataStale(): boolean {
    const dataAge = Date.now() - this.fallbackData.lastUpdate;
    return dataAge > this.config.fallbackDataTTL;
  }

  // ===== CONTROL =====

  async forceWebSocketReconnect() {
    console.log('[Fallback Manager] Forcing WebSocket reconnection');
    this.websocket.disconnect();
    await this.websocket.connect();
  }

  async switchToRestFallback() {
    console.log('[Fallback Manager] Manually switching to REST fallback');
    this.websocket.disconnect();
    this.health.fallbackMode = 'rest';
    this.startRestFallback();
    this.emit('fallbackActivated', 'rest');
  }

  async switchToMockFallback() {
    console.log('[Fallback Manager] Manually switching to mock fallback');
    this.websocket.disconnect();
    this.stopRestFallback();
    this.health.fallbackMode = 'mock';
    this.loadMockData();
    this.emit('fallbackActivated', 'mock');
  }

  // ===== CLEANUP =====

  cleanup() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.restFallbackTimer) {
      clearInterval(this.restFallbackTimer);
    }
    
    this.websocket.disconnect();
    this.removeAllListeners();
    
    console.log('[Fallback Manager] Cleanup complete');
  }
}

// Factory function
export function createDeltaFallbackManager(
  apiKey: string,
  apiSecret: string,
  config?: Partial<FallbackConfig>
) {
  return new DeltaFallbackManager(apiKey, apiSecret, config);
}
