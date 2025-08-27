// Quant Backtesting Module
// Allows testing of quant strategies on historical data

import { QuantStrategy, QuantSignal } from './quant-strategy-engine';
import { MarketData } from './market-data-provider';

export type BacktestResult = {
  signals: QuantSignal[];
  trades: { action: string; price: number; timestamp: number; cost: number; slippage: number }[];
  profit: number;
  totalCost: number;
  totalSlippage: number;
};

export class QuantBacktester {
  constructor(private strategy: QuantStrategy, private costPerTrade = 0.001, private slippagePct = 0.0005) {}

  runBacktest(historicalData: MarketData[]): BacktestResult {
    const signals: QuantSignal[] = [];
    const trades: { action: string; price: number; timestamp: number; cost: number; slippage: number }[] = [];
    let position: 'none' | 'long' | 'short' = 'none';
    let entryPrice = 0;
    let profit = 0;
    let totalCost = 0;
    let totalSlippage = 0;

    // Avoid look-ahead bias: only use data up to i (not i+1)
    for (let i = 20; i < historicalData.length; i++) {
      const prices = historicalData.slice(i - 20, i).map(d => d.price);
      const signal = this.strategy.run({ prices });
      signals.push(signal);
      const { action } = signal;
      const price = historicalData[i].price;
      const timestamp = historicalData[i].timestamp;

      // Simulate transaction cost and slippage
      let cost = price * this.costPerTrade;
      let slippage = price * this.slippagePct;

      if (action === 'buy' && position !== 'long') {
        if (position === 'short') {
          profit += entryPrice - price - cost - slippage;
          totalCost += cost;
          totalSlippage += slippage;
        }
        position = 'long';
        entryPrice = price + slippage;
        trades.push({ action: 'buy', price, timestamp, cost, slippage });
        totalCost += cost;
        totalSlippage += slippage;
      } else if (action === 'sell' && position !== 'short') {
        if (position === 'long') {
          profit += price - entryPrice - cost - slippage;
          totalCost += cost;
          totalSlippage += slippage;
        }
        position = 'short';
        entryPrice = price - slippage;
        trades.push({ action: 'sell', price, timestamp, cost, slippage });
        totalCost += cost;
        totalSlippage += slippage;
      }
    }
    // Close last position
    if (position === 'long') {
      profit += historicalData[historicalData.length - 1].price - entryPrice;
    } else if (position === 'short') {
      profit += entryPrice - historicalData[historicalData.length - 1].price;
    }
    return { signals, trades, profit, totalCost, totalSlippage };
  }
}
