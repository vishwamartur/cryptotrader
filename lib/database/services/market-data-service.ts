import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../connection';
import { marketData, type MarketData, type NewMarketData } from '../schema';

export class MarketDataService {
  // Insert new market data
  static async insertMarketData(data: Omit<NewMarketData, 'id' | 'createdAt'>): Promise<MarketData> {
    const [inserted] = await db.insert(marketData).values(data).returning();
    return inserted;
  }

  // Bulk insert market data
  static async bulkInsertMarketData(dataArray: Omit<NewMarketData, 'id' | 'createdAt'>[]): Promise<MarketData[]> {
    if (dataArray.length === 0) return [];
    
    return db.insert(marketData).values(dataArray).returning();
  }

  // Get latest market data for a symbol
  static async getLatestMarketData(symbol: string): Promise<MarketData | null> {
    const [latest] = await db
      .select()
      .from(marketData)
      .where(eq(marketData.symbol, symbol))
      .orderBy(desc(marketData.timestamp))
      .limit(1);
    
    return latest || null;
  }

  // Get latest market data for multiple symbols
  static async getLatestMarketDataForSymbols(symbols: string[]): Promise<MarketData[]> {
    if (symbols.length === 0) return [];

    // Get the latest record for each symbol
    const results: MarketData[] = [];
    
    for (const symbol of symbols) {
      const latest = await this.getLatestMarketData(symbol);
      if (latest) {
        results.push(latest);
      }
    }
    
    return results;
  }

  // Get historical market data
  static async getHistoricalData(
    symbol: string,
    startTime: Date,
    endTime: Date,
    limit: number = 1000
  ): Promise<MarketData[]> {
    return db
      .select()
      .from(marketData)
      .where(
        and(
          eq(marketData.symbol, symbol),
          gte(marketData.timestamp, startTime),
          lte(marketData.timestamp, endTime)
        )
      )
      .orderBy(desc(marketData.timestamp))
      .limit(limit);
  }

  // Get market data for a specific time range
  static async getMarketDataRange(
    symbol: string,
    hours: number = 24
  ): Promise<MarketData[]> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hours * 60 * 60 * 1000));
    
    return this.getHistoricalData(symbol, startTime, endTime);
  }

  // Get OHLCV data (aggregated)
  static async getOHLCVData(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    limit: number = 100
  ): Promise<Array<{
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>> {
    // Convert interval to minutes
    const intervalMinutes = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    }[interval];

    // This is a simplified aggregation - in production you'd want proper time-bucket aggregation
    const data = await db
      .select({
        timestamp: marketData.timestamp,
        price: marketData.price,
        volume: marketData.volume,
      })
      .from(marketData)
      .where(eq(marketData.symbol, symbol))
      .orderBy(desc(marketData.timestamp))
      .limit(limit * 10); // Get more data to aggregate

    // Group data by time intervals
    const grouped: { [key: string]: MarketData[] } = {};
    
    data.forEach(item => {
      const time = new Date(item.timestamp);
      const intervalStart = new Date(
        Math.floor(time.getTime() / (intervalMinutes * 60 * 1000)) * (intervalMinutes * 60 * 1000)
      );
      const key = intervalStart.toISOString();
      
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item as MarketData);
    });

    // Convert to OHLCV format
    const ohlcv = Object.entries(grouped)
      .map(([timestamp, items]) => {
        const prices = items.map(item => Number(item.price));
        const volumes = items.map(item => Number(item.volume));
        
        return {
          timestamp: new Date(timestamp),
          open: prices[prices.length - 1], // First price in interval
          high: Math.max(...prices),
          low: Math.min(...prices),
          close: prices[0], // Last price in interval
          volume: volumes.reduce((sum, vol) => sum + vol, 0),
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);

    return ohlcv;
  }

  // Get price statistics
  static async getPriceStatistics(symbol: string, hours: number = 24) {
    const startTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    const [stats] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        avgPrice: sql<number>`AVG(CAST(${marketData.price} AS DECIMAL))`,
        minPrice: sql<number>`MIN(CAST(${marketData.price} AS DECIMAL))`,
        maxPrice: sql<number>`MAX(CAST(${marketData.price} AS DECIMAL))`,
        totalVolume: sql<number>`SUM(CAST(${marketData.volume} AS DECIMAL))`,
        avgVolume: sql<number>`AVG(CAST(${marketData.volume} AS DECIMAL))`,
      })
      .from(marketData)
      .where(
        and(
          eq(marketData.symbol, symbol),
          gte(marketData.timestamp, startTime)
        )
      );

    return stats;
  }

  // Get all available symbols
  static async getAvailableSymbols(): Promise<string[]> {
    const symbols = await db
      .selectDistinct({ symbol: marketData.symbol })
      .from(marketData);
    
    return symbols.map(s => s.symbol);
  }

  // Get market data summary for dashboard
  static async getMarketSummary(symbols: string[]) {
    const summaries = [];
    
    for (const symbol of symbols) {
      const latest = await this.getLatestMarketData(symbol);
      const stats = await this.getPriceStatistics(symbol, 24);
      
      if (latest && stats) {
        summaries.push({
          symbol,
          currentPrice: Number(latest.price),
          change: Number(latest.change),
          changePercent: Number(latest.changePercent),
          volume24h: stats.totalVolume,
          high24h: stats.maxPrice,
          low24h: stats.minPrice,
          lastUpdate: latest.timestamp,
        });
      }
    }
    
    return summaries;
  }

  // Clean old market data (for maintenance)
  static async cleanOldMarketData(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
    
    const deleted = await db
      .delete(marketData)
      .where(lte(marketData.timestamp, cutoffDate))
      .returning({ id: marketData.id });
    
    return deleted.length;
  }

  // Get price changes for multiple symbols
  static async getPriceChanges(symbols: string[], hours: number = 24) {
    const changes = [];
    
    for (const symbol of symbols) {
      const latest = await this.getLatestMarketData(symbol);
      const historical = await this.getMarketDataRange(symbol, hours);
      
      if (latest && historical.length > 0) {
        const oldestPrice = Number(historical[historical.length - 1].price);
        const currentPrice = Number(latest.price);
        const change = currentPrice - oldestPrice;
        const changePercent = oldestPrice > 0 ? (change / oldestPrice) * 100 : 0;
        
        changes.push({
          symbol,
          currentPrice,
          previousPrice: oldestPrice,
          change,
          changePercent,
          timestamp: latest.timestamp,
        });
      }
    }
    
    return changes;
  }

  // Update market data with calculated changes
  static async updateMarketDataWithChanges(symbol: string): Promise<void> {
    const latest = await this.getLatestMarketData(symbol);
    if (!latest) return;

    // Get previous day's data for comparison
    const oneDayAgo = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const [previousData] = await db
      .select()
      .from(marketData)
      .where(
        and(
          eq(marketData.symbol, symbol),
          lte(marketData.timestamp, oneDayAgo)
        )
      )
      .orderBy(desc(marketData.timestamp))
      .limit(1);

    if (previousData) {
      const currentPrice = Number(latest.price);
      const previousPrice = Number(previousData.price);
      const change = currentPrice - previousPrice;
      const changePercent = previousPrice > 0 ? (change / previousPrice) * 100 : 0;

      // Update the latest record with calculated changes
      await db
        .update(marketData)
        .set({
          change: change.toString(),
          changePercent: changePercent.toString(),
        })
        .where(eq(marketData.id, latest.id));
    }
  }
}
