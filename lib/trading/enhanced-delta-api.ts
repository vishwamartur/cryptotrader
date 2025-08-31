/**
 * Enhanced Delta Exchange API Client with Trading Best Practices
 * Integrates error handling, rate limiting, monitoring, and risk management
 */

import { generateHmacSha256 } from '../crypto-utils';
import { EnhancedAPIClient, APIClientConfig } from './api-client';
import { Logger, getLogger } from './logger';
import { MonitoringSystem, getMonitoring } from './monitoring';
import { RiskManager } from './risk-management';
import { DELTA_EXCHANGE_RATE_LIMITS } from './rate-limiter';
import { DEFAULT_RETRY_CONFIG, DEFAULT_CIRCUIT_BREAKER_CONFIG } from './retry-handler';
import { RequestPriority } from './rate-limiter';
import { TradingError, AuthenticationError, APIError } from './errors';

export interface EnhancedDeltaConfig {
  apiKey: string;
  apiSecret: string;
  baseURL?: string;
  testnet?: boolean;
  enableRiskManagement?: boolean;
  enableMonitoring?: boolean;
  enablePaperTrading?: boolean;
}

export interface DeltaProduct {
  id: number;
  symbol: string;
  description: string;
  created_at: string;
  updated_at: string;
  settlement_time: string;
  notional_type: string;
  impact_size: number;
  initial_margin: number;
  maintenance_margin: number;
  contract_value: string;
  contract_unit_currency: string;
  tick_size: string;
  product_specs: any;
  state: string;
  trading_status: string;
  max_leverage_notional: string;
  default_leverage: string;
  initial_margin_scaling_factor: string;
  maintenance_margin_scaling_factor: string;
  taker_commission_rate: string;
  maker_commission_rate: string;
  liquidation_penalty_factor: string;
  contract_type: string;
  position_size_limit: number;
  basis_factor_max_limit: string;
  is_quanto: boolean;
  funding_method: string;
  annualized_funding: string;
  price_band: string;
  underlying_asset: any;
  quoting_asset: any;
  settling_asset: any;
  spot_index: any;
}

export interface DeltaTicker {
  symbol: string;
  price: string;
  size: string;
  bid: string;
  ask: string;
  volume: string;
  timestamp: number;
  product_id: number;
  open: string;
  high: string;
  low: string;
  close: string;
  change: string;
  change_percent: string;
  turnover: string;
  turnover_symbol: string;
  turnover_usd: string;
  price_band: string;
  funding_rate: string;
  next_funding_time: string;
  predicted_funding_rate: string;
  open_interest: string;
  oi_value: string;
  oi_value_symbol: string;
  oi_value_usd: string;
  basis: string;
  mark_price: string;
  spot_price: string;
  greeks?: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
    rho: string;
  };
}

export class EnhancedDeltaExchangeAPI {
  private readonly config: EnhancedDeltaConfig;
  private readonly apiClient: EnhancedAPIClient;
  private readonly logger: Logger;
  private readonly monitoring: MonitoringSystem;
  private readonly riskManager?: RiskManager;

  constructor(config: EnhancedDeltaConfig) {
    this.config = {
      baseURL: config.testnet ? 'https://testnet-api.delta.exchange' : 'https://api.delta.exchange',
      enableRiskManagement: true,
      enableMonitoring: true,
      enablePaperTrading: false,
      ...config
    };

    this.logger = getLogger();
    this.monitoring = getMonitoring();

    // Initialize enhanced API client
    const apiClientConfig: APIClientConfig = {
      baseURL: this.config.baseURL,
      apiKey: this.config.apiKey,
      apiSecret: this.config.apiSecret,
      timeout: 30000,
      retryConfig: DEFAULT_RETRY_CONFIG,
      rateLimitConfig: DELTA_EXCHANGE_RATE_LIMITS,
      circuitBreakerConfig: DEFAULT_CIRCUIT_BREAKER_CONFIG,
      enableMetrics: true
    };

    this.apiClient = new EnhancedAPIClient(apiClientConfig);

    // Initialize risk manager if enabled
    if (this.config.enableRiskManagement) {
      this.riskManager = new RiskManager();
    }

    this.logger.info('Enhanced Delta Exchange API initialized', {
      baseURL: this.config.baseURL,
      testnet: this.config.testnet,
      riskManagement: this.config.enableRiskManagement,
      monitoring: this.config.enableMonitoring
    });
  }

  // Market Data Methods
  async getProducts(page: number = 1, pageSize: number = 100): Promise<{ success: boolean; result: DeltaProduct[] }> {
    try {
      const response = await this.apiClient.request({
        method: 'GET',
        endpoint: '/v2/products',
        params: { page_num: page, page_size: pageSize },
        priority: RequestPriority.NORMAL
      });

      this.monitoring.monitorAPICall('/v2/products', 'GET', response.status, response.duration);

      return {
        success: true,
        result: response.data.result || []
      };
    } catch (error) {
      this.logger.error('Failed to fetch products', {
        page,
        pageSize,
        error: (error as Error).message
      }, error as Error);

      throw new APIError(
        `Failed to fetch products: ${(error as Error).message}`,
        0,
        { operation: 'getProducts', page, pageSize }
      );
    }
  }

  async getTickers(symbols?: string[]): Promise<{ success: boolean; result: DeltaTicker[] }> {
    try {
      const params: any = {};
      if (symbols && symbols.length > 0) {
        params.symbols = symbols.join(',');
      }

      const response = await this.apiClient.request({
        method: 'GET',
        endpoint: '/v2/tickers',
        params,
        priority: RequestPriority.HIGH // Market data is high priority
      });

      this.monitoring.monitorAPICall('/v2/tickers', 'GET', response.status, response.duration, {
        symbolCount: symbols?.length || 'all'
      });

      return {
        success: true,
        result: response.data.result || []
      };
    } catch (error) {
      this.logger.error('Failed to fetch tickers', {
        symbols,
        error: (error as Error).message
      }, error as Error);

      throw new APIError(
        `Failed to fetch tickers: ${(error as Error).message}`,
        0,
        { operation: 'getTickers', symbols }
      );
    }
  }

  async getTicker(symbol: string): Promise<{ success: boolean; result: DeltaTicker }> {
    try {
      const response = await this.apiClient.request({
        method: 'GET',
        endpoint: `/v2/tickers/${symbol}`,
        priority: RequestPriority.HIGH
      });

      this.monitoring.monitorAPICall(`/v2/tickers/${symbol}`, 'GET', response.status, response.duration, {
        symbol
      });

      return {
        success: true,
        result: response.data.result
      };
    } catch (error) {
      this.logger.error('Failed to fetch ticker', {
        symbol,
        error: (error as Error).message
      }, error as Error);

      throw new APIError(
        `Failed to fetch ticker for ${symbol}: ${(error as Error).message}`,
        0,
        { operation: 'getTicker', symbol }
      );
    }
  }

  async getOrderbook(symbol: string, depth: number = 20): Promise<{ success: boolean; result: any }> {
    try {
      const response = await this.apiClient.request({
        method: 'GET',
        endpoint: `/v2/l2orderbook/${symbol}`,
        params: { depth },
        priority: RequestPriority.HIGH
      });

      this.monitoring.monitorAPICall(`/v2/l2orderbook/${symbol}`, 'GET', response.status, response.duration, {
        symbol,
        depth
      });

      return {
        success: true,
        result: response.data.result
      };
    } catch (error) {
      this.logger.error('Failed to fetch orderbook', {
        symbol,
        depth,
        error: (error as Error).message
      }, error as Error);

      throw new APIError(
        `Failed to fetch orderbook for ${symbol}: ${(error as Error).message}`,
        0,
        { operation: 'getOrderbook', symbol, depth }
      );
    }
  }

  // Trading Methods (with risk management)
  async placeOrder(
    symbol: string,
    side: 'buy' | 'sell',
    orderType: 'market' | 'limit',
    size: number,
    price?: number,
    options?: {
      timeInForce?: 'gtc' | 'ioc' | 'fok';
      postOnly?: boolean;
      reduceOnly?: boolean;
      clientOrderId?: string;
    }
  ): Promise<{ success: boolean; result: any }> {
    try {
      // Risk management validation
      if (this.riskManager && !this.config.enablePaperTrading) {
        const validation = await this.riskManager.validateTrade(
          symbol,
          side === 'buy' ? 'long' : 'short',
          size,
          price || 0,
          'manual'
        );

        if (!validation.approved) {
          throw new TradingError(
            validation.reason || 'Trade rejected by risk management',
            'RISK_MANAGEMENT_ERROR' as any,
            'HIGH' as any,
            { symbol, side, size, price, validation }
          );
        }

        if (validation.adjustedQuantity) {
          size = validation.adjustedQuantity;
          this.logger.warn('Order size adjusted by risk management', {
            symbol,
            originalSize: size,
            adjustedSize: validation.adjustedQuantity,
            reason: validation.reason
          });
        }
      }

      const orderData: any = {
        product_symbol: symbol,
        side,
        order_type: orderType,
        size: size.toString(),
        time_in_force: options?.timeInForce || 'gtc'
      };

      if (orderType === 'limit' && price) {
        orderData.limit_price = price.toString();
      }

      if (options?.postOnly) {
        orderData.post_only = true;
      }

      if (options?.reduceOnly) {
        orderData.reduce_only = true;
      }

      if (options?.clientOrderId) {
        orderData.client_order_id = options.clientOrderId;
      }

      // Paper trading mode
      if (this.config.enablePaperTrading) {
        return this.simulatePaperOrder(orderData);
      }

      const response = await this.makeAuthenticatedRequest('POST', '/v2/orders', orderData);

      this.monitoring.monitorTradingOperation(
        'place_order',
        symbol,
        'success',
        response.duration,
        { side, orderType, size, price }
      );

      this.logger.info('Order placed successfully', {
        symbol,
        side,
        orderType,
        size,
        price,
        orderId: response.data.result?.id
      });

      return {
        success: true,
        result: response.data.result
      };
    } catch (error) {
      this.monitoring.monitorTradingOperation(
        'place_order',
        symbol,
        'failure',
        0,
        { side, orderType, size, price, error: (error as Error).message }
      );

      this.logger.error('Failed to place order', {
        symbol,
        side,
        orderType,
        size,
        price,
        error: (error as Error).message
      }, error as Error);

      throw error;
    }
  }

  // Private helper methods
  private async makeAuthenticatedRequest(
    method: string,
    endpoint: string,
    data?: any
  ): Promise<any> {
    const timestamp = Date.now().toString();
    const body = data ? JSON.stringify(data) : '';
    
    const signature = await this.generateSignature(
      method,
      timestamp,
      endpoint,
      '',
      body
    );

    const headers = {
      'api-key': this.config.apiKey,
      'timestamp': timestamp,
      'signature': signature,
      'Content-Type': 'application/json'
    };

    return await this.apiClient.request({
      method: method as any,
      endpoint,
      data,
      headers,
      priority: RequestPriority.CRITICAL, // Trading operations are critical
      skipRateLimit: false,
      skipRetry: false
    });
  }

  private async generateSignature(
    method: string,
    timestamp: string,
    requestPath: string,
    queryParams = '',
    body = ''
  ): Promise<string> {
    const message = method + timestamp + requestPath + queryParams + body;
    return await generateHmacSha256(message, this.config.apiSecret);
  }

  private async simulatePaperOrder(orderData: any): Promise<{ success: boolean; result: any }> {
    // Simulate paper trading order
    const mockOrder = {
      id: `paper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      product_symbol: orderData.product_symbol,
      side: orderData.side,
      order_type: orderData.order_type,
      size: orderData.size,
      limit_price: orderData.limit_price,
      status: 'filled',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.logger.info('Paper order simulated', {
      orderId: mockOrder.id,
      symbol: orderData.product_symbol,
      side: orderData.side,
      size: orderData.size
    });

    return {
      success: true,
      result: mockOrder
    };
  }

  // Utility methods
  getMetrics() {
    return {
      apiClient: this.apiClient.getMetrics(),
      riskManager: this.riskManager ? {
        positions: this.riskManager.getPositions().length,
        riskMetrics: this.riskManager.getRiskMetrics(),
        tradingSuspended: this.riskManager.isTradingSuspended()
      } : null,
      monitoring: this.monitoring.getSystemStatus()
    };
  }

  destroy(): void {
    this.apiClient.destroy();
    this.logger.info('Enhanced Delta Exchange API destroyed');
  }
}

// Factory function for creating enhanced Delta API instance
export function createEnhancedDeltaAPI(config?: Partial<EnhancedDeltaConfig>): EnhancedDeltaExchangeAPI {
  const apiKey = process.env.DELTA_API_KEY;
  const apiSecret = process.env.DELTA_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new AuthenticationError(
      'Delta Exchange API credentials not found. Please set DELTA_API_KEY and DELTA_API_SECRET environment variables.',
      { missingCredentials: true }
    );
  }

  return new EnhancedDeltaExchangeAPI({
    apiKey,
    apiSecret,
    ...config
  });
}
