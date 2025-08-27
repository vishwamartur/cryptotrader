// Market Data Acquisition Interface
// Provides methods to fetch real-time and historical market data

export type MarketData = {
  symbol: string;
  timestamp: number;
  price: number;
  volume?: number;
  [key: string]: any;
};

export interface MarketDataProvider {
  getRealtimeData(symbol: string): Promise<MarketData>;
  getHistoricalData(symbol: string, start: number, end: number): Promise<MarketData[]>;
}

// Example: Dummy provider for testing
export class DummyMarketDataProvider implements MarketDataProvider {
  async getRealtimeData(symbol: string): Promise<MarketData> {
    return {
      symbol,
      timestamp: Date.now(),
      price: Math.random() * 10000,
      volume: Math.random() * 1000,
    };
  }

  async getHistoricalData(symbol: string, start: number, end: number): Promise<MarketData[]> {
    const data: MarketData[] = [];
    for (let t = start; t <= end; t += 3600 * 1000) {
      data.push({
        symbol,
        timestamp: t,
        price: Math.random() * 10000,
        volume: Math.random() * 1000,
      });
    }
    return data;
  }
}
