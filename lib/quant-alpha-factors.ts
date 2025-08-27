// Quant Signal & Alpha Factor Template
// Use this to design custom signals and alpha factors

import { MarketData } from './market-data-provider'

export type AlphaFactor = {
  name: string;
  description?: string;
  compute: (data: MarketData[]) => number[]; // returns factor values per data point
};

// Example: Simple momentum factor
export const MomentumFactor: AlphaFactor = {
  name: 'Momentum',
  description: 'Price change over N periods',
  compute: (data: MarketData[]) => {
    const N = 5;
    return data.map((d, i) => {
      if (i < N) return 0;
      return d.price - data[i - N].price;
    });
  },
};

// Example: Mean reversion factor
export const MeanReversionFactor: AlphaFactor = {
  name: 'Mean Reversion',
  description: 'Deviation from moving average',
  compute: (data: MarketData[]) => {
    const N = 10;
    return data.map((d, i) => {
      if (i < N) return 0;
      const avg = data.slice(i - N, i).reduce((a, b) => a + b.price, 0) / N;
      return avg - d.price;
    });
  },
};

// Add your own factors below
