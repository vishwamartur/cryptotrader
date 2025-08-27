// Quant Backtesting Module
// Allows testing of quant strategies on historical data

import { QuantStrategy, QuantSignal } from './quant-strategy-engine';
import { MarketData } from './market-data-provider';

export type BacktestResult = {
  signals: QuantSignal[];
  trades: { action: string; price: number; timestamp: number }[];
  profit: number;
};

export class QuantBacktester {
  constructor(private strategy: QuantStrategy) {}

  runBacktest(historicalData: MarketData[]): BacktestResult {
    const signals: QuantSignal[] = [];
    const trades: { action: string; price: number; timestamp: number }[] = [];
    let position: 'none' | 'long' | 'short' = 'none';
    let entryPrice = 0;
    let profit = 0;

    for (let i = 0; i < historicalData.length; i++) {
      const prices = historicalData.slice(Math.max(0, i - 20), i + 1).map(d => d.price);
      const signal = this.strategy.run({ prices });
      signals.push(signal);
      const { action } = signal;
      const price = historicalData[i].price;
      const timestamp = historicalData[i].timestamp;

      if (action === 'buy' && position !== 'long') {
        if (position === 'short') {
          profit += entryPrice - price;
        }
        position = 'long';
        entryPrice = price;
        trades.push({ action: 'buy', price, timestamp });
      } else if (action === 'sell' && position !== 'short') {
        if (position === 'long') {
          profit += price - entryPrice;
        }
        position = 'short';
        entryPrice = price;
        trades.push({ action: 'sell', price, timestamp });
      }
    }
    // Close last position
    if (position === 'long') {
      profit += historicalData[historicalData.length - 1].price - entryPrice;
    } else if (position === 'short') {
      profit += entryPrice - historicalData[historicalData.length - 1].price;
    }
    return { signals, trades, profit };
  }
}
