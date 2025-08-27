// Live Strategy Deployment & Monitoring Scaffold
// Use this to run strategies live and monitor performance

import { QuantStrategy } from './quant-strategy-engine'
import { MarketDataProvider } from './market-data-provider'
import { OrderExecutor } from './quant-order-executor'

export type LiveStrategyConfig = {
  strategy: QuantStrategy;
  symbol: string;
  intervalMs: number;
  riskParams?: any;
};

export class LiveStrategyRunner {
  private running = false;
  private timer: NodeJS.Timeout | null = null;
  private logs: any[] = [];

  constructor(
    private config: LiveStrategyConfig,
    private marketProvider: MarketDataProvider,
    private orderExecutor: OrderExecutor
  ) {}

  async runStep() {
    const data = await this.marketProvider.getRealtimeData(this.config.symbol);
    const signal = this.config.strategy.run({ prices: [data.price] });
    // TODO: Add risk management, position sizing, etc.
    if (signal.action !== 'hold') {
      const order = {
        symbol: this.config.symbol,
        action: signal.action,
        quantity: 0.001, // Example
        price: data.price,
      };
      const result = await this.orderExecutor.executeOrder(order);
      this.logs.push({ time: Date.now(), signal, order, result });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => this.runStep(), this.config.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.running = false;
  }

  getLogs() {
    return this.logs;
  }
}
