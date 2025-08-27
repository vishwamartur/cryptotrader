// Quant Order Execution Module
// Executes orders based on quant signals

export type Order = {
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price?: number;
  timestamp?: number;
};

export interface OrderExecutor {
  executeOrder(order: Order): Promise<OrderExecutionResult>;
}

export type OrderExecutionResult = {
  success: boolean;
  order: Order;
  message?: string;
};

// Example: Dummy executor for testing
export class DummyOrderExecutor implements OrderExecutor {
  async executeOrder(order: Order): Promise<OrderExecutionResult> {
    return {
      success: true,
      order: { ...order, timestamp: Date.now() },
      message: `Executed ${order.action} for ${order.symbol}`,
    };
  }
}
