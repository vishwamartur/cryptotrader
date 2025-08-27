// Quant Strategy Engine
// This module allows you to define and run quantitative trading strategies.

export type QuantStrategy = {
  name: string;
  description?: string;
  run: (marketData: any) => QuantSignal;
};

export type QuantSignal = {
  action: 'buy' | 'sell' | 'hold';
  confidence: number; // 0 to 1
  details?: any;
};

export class QuantStrategyEngine {
  private strategies: QuantStrategy[] = [];

  addStrategy(strategy: QuantStrategy) {
    this.strategies.push(strategy);
  }

  runAll(marketData: any): QuantSignal[] {
    return this.strategies.map(strategy => strategy.run(marketData));
  }

  getStrategies(): QuantStrategy[] {
    return this.strategies;
  }
}

// Example: Moving Average Crossover Strategy
export const MovingAverageCrossoverStrategy: QuantStrategy = {
  name: 'Moving Average Crossover',
  description: 'Generates buy/sell signals based on short and long moving averages.',
  run: (marketData: { prices: number[] }) => {
    const prices = marketData.prices || [];
    if (prices.length < 20) {
      return { action: 'hold', confidence: 0 };
    }
    const shortMA = prices.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const longMA = prices.slice(-20).reduce((a, b) => a + b, 0) / 20;
    if (shortMA > longMA) {
      return { action: 'buy', confidence: Math.min((shortMA - longMA) / longMA, 1) };
    } else if (shortMA < longMA) {
      return { action: 'sell', confidence: Math.min((longMA - shortMA) / longMA, 1) };
    } else {
      return { action: 'hold', confidence: 0 };
    }
  }
};
