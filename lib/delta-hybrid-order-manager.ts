/**
 * Delta Exchange Hybrid Order Management
 * Uses REST API for order operations and WebSocket for real-time status updates
 * Follows official Delta Exchange best practices
 */

'use client';

import { EventEmitter } from 'events';
import { DeltaOrderService } from './delta-rest-services';
import { EnhancedDeltaWebSocket } from './delta-websocket-enhanced';

export interface OrderRequest {
  product_id: number;
  size: string;
  side: "buy" | "sell";
  order_type: "limit_order" | "market_order";
  limit_price?: string;
  time_in_force?: "gtc" | "ioc";
  reduce_only?: boolean;
  post_only?: boolean;
  client_order_id?: string;
  stop_order_type?: "stop_loss_order" | "take_profit_order";
  stop_price?: string;
  trail_amount?: string;
}

export interface BracketOrderRequest {
  product_id: number;
  size: string;
  side: "buy" | "sell";
  limit_price: string;
  bracket_stop_loss_price: string;
  bracket_take_profit_price: string;
  bracket_stop_loss_limit_price?: string;
  bracket_take_profit_limit_price?: string;
  bracket_trail_amount?: string;
  time_in_force?: "gtc" | "ioc";
  client_order_id?: string;
}

export interface OrderUpdate {
  id: string;
  client_order_id?: string;
  product_id: number;
  symbol: string;
  size: string;
  side: "buy" | "sell";
  order_type: string;
  state: "open" | "pending" | "closed" | "cancelled";
  limit_price?: string;
  stop_price?: string;
  filled_size: string;
  average_fill_price?: string;
  created_at: string;
  updated_at: string;
  timestamp: number;
}

export interface OrderExecutionResult {
  success: boolean;
  order?: any;
  error?: string;
  orderId?: string;
  clientOrderId?: string;
}

// Hybrid Order Manager - REST for operations, WebSocket for updates
export class DeltaHybridOrderManager extends EventEmitter {
  private restService: DeltaOrderService;
  private websocket: EnhancedDeltaWebSocket;
  private orders: Map<string, OrderUpdate> = new Map();
  private pendingOrders: Map<string, OrderRequest> = new Map();
  private orderCallbacks: Map<string, (result: OrderExecutionResult) => void> = new Map();

  constructor(apiKey: string, apiSecret: string) {
    super();
    
    this.restService = new DeltaOrderService(apiKey, apiSecret);
    this.websocket = new EnhancedDeltaWebSocket({ apiKey, apiSecret });
    
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers() {
    // Listen for order updates via WebSocket
    this.websocket.on('portfolio:orders', (orderData: any) => {
      this.handleOrderUpdate(orderData);
    });

    // Listen for trade executions
    this.websocket.on('portfolio:v2/user_trades', (tradeData: any) => {
      this.handleTradeExecution(tradeData);
    });

    // Handle WebSocket connection events
    this.websocket.on('connected', () => {
      console.log('[Hybrid Order Manager] WebSocket connected');
      this.emit('websocketConnected');
    });

    this.websocket.on('disconnected', (reason) => {
      console.log('[Hybrid Order Manager] WebSocket disconnected:', reason);
      this.emit('websocketDisconnected', reason);
    });

    this.websocket.on('error', (error) => {
      console.error('[Hybrid Order Manager] WebSocket error:', error);
      this.emit('websocketError', error);
    });
  }

  private handleOrderUpdate(orderData: any) {
    const orderId = orderData.id || orderData.order_id;
    const clientOrderId = orderData.client_order_id;
    
    if (!orderId) return;

    const orderUpdate: OrderUpdate = {
      id: orderId,
      client_order_id: clientOrderId,
      product_id: orderData.product_id,
      symbol: orderData.symbol,
      size: orderData.size,
      side: orderData.side,
      order_type: orderData.order_type,
      state: orderData.state,
      limit_price: orderData.limit_price,
      stop_price: orderData.stop_price,
      filled_size: orderData.filled_size || '0',
      average_fill_price: orderData.average_fill_price,
      created_at: orderData.created_at,
      updated_at: orderData.updated_at,
      timestamp: Date.now()
    };

    // Update local order cache
    this.orders.set(orderId, orderUpdate);
    if (clientOrderId) {
      this.orders.set(clientOrderId, orderUpdate);
    }

    // Handle pending order callbacks
    const callback = this.orderCallbacks.get(orderId) || 
                    (clientOrderId ? this.orderCallbacks.get(clientOrderId) : undefined);
    
    if (callback) {
      callback({
        success: true,
        order: orderUpdate,
        orderId,
        clientOrderId
      });
      
      // Clean up callback
      this.orderCallbacks.delete(orderId);
      if (clientOrderId) {
        this.orderCallbacks.delete(clientOrderId);
      }
    }

    // Emit order update event
    this.emit('orderUpdate', orderUpdate);
    this.emit(`orderUpdate:${orderId}`, orderUpdate);
    if (clientOrderId) {
      this.emit(`orderUpdate:${clientOrderId}`, orderUpdate);
    }

    // Emit state-specific events
    this.emit(`orderState:${orderUpdate.state}`, orderUpdate);
  }

  private handleTradeExecution(tradeData: any) {
    const orderId = tradeData.order_id;
    const order = this.orders.get(orderId);
    
    this.emit('tradeExecution', {
      orderId,
      order,
      trade: tradeData,
      timestamp: Date.now()
    });
  }

  // ===== PUBLIC API =====

  async initialize() {
    try {
      // Connect WebSocket for real-time updates
      await this.websocket.connect();
      
      // Subscribe to order updates
      await this.websocket.subscribeToOrders(['all']);
      await this.websocket.subscribeToUserTrades(['all']);
      
      console.log('[Hybrid Order Manager] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[Hybrid Order Manager] Initialization failed:', error);
      throw error;
    }
  }

  // ===== ORDER OPERATIONS (REST API) =====

  /**
   * Place a single order using REST API
   */
  async placeOrder(orderRequest: OrderRequest): Promise<OrderExecutionResult> {
    try {
      console.log('[Hybrid Order Manager] Placing order via REST API:', orderRequest);
      
      const response = await this.restService.placeOrder(orderRequest);
      
      if (response.success && response.result) {
        const order = response.result;
        const orderId = order.id;
        const clientOrderId = order.client_order_id || orderRequest.client_order_id;
        
        // Store pending order for WebSocket updates
        if (clientOrderId) {
          this.pendingOrders.set(clientOrderId, orderRequest);
        }
        
        console.log('[Hybrid Order Manager] Order placed successfully:', orderId);
        
        return {
          success: true,
          order,
          orderId,
          clientOrderId
        };
      } else {
        const error = response.error?.message || 'Order placement failed';
        console.error('[Hybrid Order Manager] Order placement failed:', error);
        
        return {
          success: false,
          error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Order placement failed';
      console.error('[Hybrid Order Manager] Order placement error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Place bracket order using REST API
   */
  async placeBracketOrder(orderRequest: BracketOrderRequest): Promise<OrderExecutionResult> {
    try {
      console.log('[Hybrid Order Manager] Placing bracket order via REST API:', orderRequest);
      
      const response = await this.restService.placeBracketOrder(orderRequest);
      
      if (response.success && response.result) {
        const order = response.result;
        const orderId = order.id;
        const clientOrderId = order.client_order_id || orderRequest.client_order_id;
        
        console.log('[Hybrid Order Manager] Bracket order placed successfully:', orderId);
        
        return {
          success: true,
          order,
          orderId,
          clientOrderId
        };
      } else {
        const error = response.error?.message || 'Bracket order placement failed';
        console.error('[Hybrid Order Manager] Bracket order placement failed:', error);
        
        return {
          success: false,
          error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bracket order placement failed';
      console.error('[Hybrid Order Manager] Bracket order placement error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Cancel order using REST API
   */
  async cancelOrder(orderId: string): Promise<OrderExecutionResult> {
    try {
      console.log('[Hybrid Order Manager] Cancelling order via REST API:', orderId);
      
      const response = await this.restService.cancelOrder(orderId);
      
      if (response.success) {
        console.log('[Hybrid Order Manager] Order cancelled successfully:', orderId);
        
        return {
          success: true,
          orderId
        };
      } else {
        const error = response.error?.message || 'Order cancellation failed';
        console.error('[Hybrid Order Manager] Order cancellation failed:', error);
        
        return {
          success: false,
          error,
          orderId
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Order cancellation failed';
      console.error('[Hybrid Order Manager] Order cancellation error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        orderId
      };
    }
  }

  /**
   * Cancel multiple orders using REST API
   */
  async cancelBatchOrders(orderIds: string[]): Promise<OrderExecutionResult[]> {
    try {
      console.log('[Hybrid Order Manager] Cancelling batch orders via REST API:', orderIds);
      
      const response = await this.restService.cancelBatchOrders(orderIds);
      
      if (response.success && response.result) {
        const results = response.result.map((result: any, index: number) => ({
          success: result.success,
          orderId: orderIds[index],
          error: result.error?.message
        }));
        
        console.log('[Hybrid Order Manager] Batch orders cancelled:', results);
        return results;
      } else {
        const error = response.error?.message || 'Batch order cancellation failed';
        return orderIds.map(orderId => ({
          success: false,
          error,
          orderId
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Batch order cancellation failed';
      return orderIds.map(orderId => ({
        success: false,
        error: errorMessage,
        orderId
      }));
    }
  }

  /**
   * Cancel all orders using REST API
   */
  async cancelAllOrders(filters?: {
    product_ids?: number[];
    cancel_limit_orders?: boolean;
    cancel_stop_orders?: boolean;
  }): Promise<OrderExecutionResult> {
    try {
      console.log('[Hybrid Order Manager] Cancelling all orders via REST API:', filters);
      
      const response = await this.restService.cancelAllOrders(filters);
      
      if (response.success) {
        console.log('[Hybrid Order Manager] All orders cancelled successfully');
        
        return {
          success: true
        };
      } else {
        const error = response.error?.message || 'Cancel all orders failed';
        console.error('[Hybrid Order Manager] Cancel all orders failed:', error);
        
        return {
          success: false,
          error
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Cancel all orders failed';
      console.error('[Hybrid Order Manager] Cancel all orders error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Edit order using REST API
   */
  async editOrder(orderId: string, updates: {
    size?: string;
    limit_price?: string;
    stop_price?: string;
    trail_amount?: string;
  }): Promise<OrderExecutionResult> {
    try {
      console.log('[Hybrid Order Manager] Editing order via REST API:', orderId, updates);
      
      const response = await this.restService.editOrder(orderId, updates);
      
      if (response.success && response.result) {
        const order = response.result;
        
        console.log('[Hybrid Order Manager] Order edited successfully:', orderId);
        
        return {
          success: true,
          order,
          orderId
        };
      } else {
        const error = response.error?.message || 'Order edit failed';
        console.error('[Hybrid Order Manager] Order edit failed:', error);
        
        return {
          success: false,
          error,
          orderId
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Order edit failed';
      console.error('[Hybrid Order Manager] Order edit error:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        orderId
      };
    }
  }

  // ===== ORDER TRACKING (WebSocket) =====

  /**
   * Get order by ID (from local cache updated via WebSocket)
   */
  getOrder(orderId: string): OrderUpdate | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders (from local cache updated via WebSocket)
   */
  getAllOrders(): OrderUpdate[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get orders by state
   */
  getOrdersByState(state: string): OrderUpdate[] {
    return Array.from(this.orders.values()).filter(order => order.state === state);
  }

  /**
   * Get open orders
   */
  getOpenOrders(): OrderUpdate[] {
    return this.getOrdersByState('open');
  }

  /**
   * Wait for order update (Promise-based)
   */
  waitForOrderUpdate(orderId: string, timeout: number = 30000): Promise<OrderUpdate> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.removeListener(`orderUpdate:${orderId}`, orderUpdateHandler);
        reject(new Error(`Order update timeout for ${orderId}`));
      }, timeout);

      const orderUpdateHandler = (order: OrderUpdate) => {
        clearTimeout(timeoutId);
        resolve(order);
      };

      this.once(`orderUpdate:${orderId}`, orderUpdateHandler);
    });
  }

  // ===== CLEANUP =====

  cleanup() {
    this.websocket.disconnect();
    this.orders.clear();
    this.pendingOrders.clear();
    this.orderCallbacks.clear();
    this.removeAllListeners();
  }

  // ===== STATUS =====

  isWebSocketConnected(): boolean {
    return this.websocket.isConnected();
  }

  getConnectionStatus() {
    return this.websocket.getConnectionStatus();
  }
}

// Factory function
export function createDeltaHybridOrderManager(apiKey: string, apiSecret: string) {
  return new DeltaHybridOrderManager(apiKey, apiSecret);
}
