import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../connection';
import { positions, type Position, type NewPosition } from '../schema';
import { PortfolioService } from './portfolio-service';

export class PositionService {
  // Create a new position
  static async createPosition(positionData: Omit<NewPosition, 'id' | 'openedAt' | 'updatedAt'>): Promise<Position> {
    const [position] = await db.insert(positions).values({
      ...positionData,
      unrealizedPnL: '0',
      unrealizedPnLPercent: '0',
    }).returning();

    // Update portfolio metrics
    await PortfolioService.updatePortfolioMetrics(position.portfolioId);

    return position;
  }

  // Get position by ID
  static async getPositionById(id: string): Promise<Position | null> {
    const [position] = await db.select().from(positions).where(eq(positions.id, id));
    return position || null;
  }

  // Get portfolio positions
  static async getPortfolioPositions(portfolioId: string, activeOnly: boolean = true): Promise<Position[]> {
    const conditions = [eq(positions.portfolioId, portfolioId)];
    if (activeOnly) {
      conditions.push(eq(positions.isActive, true));
    }

    return db
      .select()
      .from(positions)
      .where(and(...conditions))
      .orderBy(desc(positions.openedAt));
  }

  // Get positions by symbol
  static async getPositionsBySymbol(symbol: string, activeOnly: boolean = true): Promise<Position[]> {
    const conditions = [eq(positions.symbol, symbol)];
    if (activeOnly) {
      conditions.push(eq(positions.isActive, true));
    }

    return db
      .select()
      .from(positions)
      .where(and(...conditions))
      .orderBy(desc(positions.openedAt));
  }

  // Update position
  static async updatePosition(id: string, updates: Partial<Omit<Position, 'id' | 'openedAt'>>): Promise<Position | null> {
    const [updatedPosition] = await db
      .update(positions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();
    
    if (updatedPosition) {
      // Update portfolio metrics
      await PortfolioService.updatePortfolioMetrics(updatedPosition.portfolioId);
    }
    
    return updatedPosition || null;
  }

  // Update position price and calculate P&L
  static async updatePositionPrice(id: string, newPrice: number): Promise<Position | null> {
    const position = await this.getPositionById(id);
    if (!position || !position.isActive) return null;

    const entryPrice = Number(position.entryPrice);
    const size = Number(position.size);
    
    // Calculate unrealized P&L
    let unrealizedPnL: number;
    if (position.side === 'long') {
      unrealizedPnL = (newPrice - entryPrice) * size;
    } else {
      unrealizedPnL = (entryPrice - newPrice) * size;
    }

    const unrealizedPnLPercent = entryPrice > 0 ? (unrealizedPnL / (entryPrice * size)) * 100 : 0;

    return this.updatePosition(id, {
      currentPrice: newPrice.toString(),
      unrealizedPnL: unrealizedPnL.toString(),
      unrealizedPnLPercent: unrealizedPnLPercent.toString(),
    });
  }

  // Close position
  static async closePosition(id: string, closePrice?: number): Promise<Position | null> {
    const position = await this.getPositionById(id);
    if (!position || !position.isActive) return null;

    const finalPrice = closePrice || Number(position.currentPrice);
    
    // Calculate final P&L
    const entryPrice = Number(position.entryPrice);
    const size = Number(position.size);
    
    let realizedPnL: number;
    if (position.side === 'long') {
      realizedPnL = (finalPrice - entryPrice) * size;
    } else {
      realizedPnL = (entryPrice - finalPrice) * size;
    }

    const realizedPnLPercent = entryPrice > 0 ? (realizedPnL / (entryPrice * size)) * 100 : 0;

    return this.updatePosition(id, {
      isActive: false,
      closedAt: new Date(),
      currentPrice: finalPrice.toString(),
      unrealizedPnL: realizedPnL.toString(),
      unrealizedPnLPercent: realizedPnLPercent.toString(),
    });
  }

  // Update stop loss
  static async updateStopLoss(id: string, stopLoss: number): Promise<Position | null> {
    return this.updatePosition(id, { stopLoss: stopLoss.toString() });
  }

  // Update take profit
  static async updateTakeProfit(id: string, takeProfit: number): Promise<Position | null> {
    return this.updatePosition(id, { takeProfit: takeProfit.toString() });
  }

  // Check stop loss and take profit triggers
  static async checkPositionTriggers(id: string): Promise<{ triggered: boolean; type?: 'stop_loss' | 'take_profit' }> {
    const position = await this.getPositionById(id);
    if (!position || !position.isActive) {
      return { triggered: false };
    }

    const currentPrice = Number(position.currentPrice);
    const stopLoss = position.stopLoss ? Number(position.stopLoss) : null;
    const takeProfit = position.takeProfit ? Number(position.takeProfit) : null;

    // Check stop loss
    if (stopLoss) {
      if (
        (position.side === 'long' && currentPrice <= stopLoss) ||
        (position.side === 'short' && currentPrice >= stopLoss)
      ) {
        await this.closePosition(id, stopLoss);
        return { triggered: true, type: 'stop_loss' };
      }
    }

    // Check take profit
    if (takeProfit) {
      if (
        (position.side === 'long' && currentPrice >= takeProfit) ||
        (position.side === 'short' && currentPrice <= takeProfit)
      ) {
        await this.closePosition(id, takeProfit);
        return { triggered: true, type: 'take_profit' };
      }
    }

    return { triggered: false };
  }

  // Get position statistics
  static async getPositionStats(portfolioId: string) {
    const [stats] = await db
      .select({
        totalPositions: sql<number>`COUNT(*)`,
        activePositions: sql<number>`COUNT(CASE WHEN ${positions.isActive} = true THEN 1 END)`,
        longPositions: sql<number>`COUNT(CASE WHEN ${positions.side} = 'long' AND ${positions.isActive} = true THEN 1 END)`,
        shortPositions: sql<number>`COUNT(CASE WHEN ${positions.side} = 'short' AND ${positions.isActive} = true THEN 1 END)`,
        totalUnrealizedPnL: sql<number>`SUM(CASE WHEN ${positions.isActive} = true THEN CAST(${positions.unrealizedPnL} AS DECIMAL) ELSE 0 END)`,
        profitablePositions: sql<number>`COUNT(CASE WHEN ${positions.isActive} = true AND CAST(${positions.unrealizedPnL} AS DECIMAL) > 0 THEN 1 END)`,
      })
      .from(positions)
      .where(eq(positions.portfolioId, portfolioId));

    return stats;
  }

  // Get positions by performance
  static async getTopPerformingPositions(portfolioId: string, limit: number = 10): Promise<Position[]> {
    return db
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, portfolioId), eq(positions.isActive, true)))
      .orderBy(desc(sql`CAST(${positions.unrealizedPnLPercent} AS DECIMAL)`))
      .limit(limit);
  }

  // Get worst performing positions
  static async getWorstPerformingPositions(portfolioId: string, limit: number = 10): Promise<Position[]> {
    return db
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, portfolioId), eq(positions.isActive, true)))
      .orderBy(sql`CAST(${positions.unrealizedPnLPercent} AS DECIMAL)`)
      .limit(limit);
  }

  // Bulk update positions with new prices
  static async bulkUpdatePositionPrices(priceUpdates: { symbol: string; price: number }[]): Promise<void> {
    for (const update of priceUpdates) {
      const symbolPositions = await this.getPositionsBySymbol(update.symbol, true);
      
      for (const position of symbolPositions) {
        await this.updatePositionPrice(position.id, update.price);
        
        // Check for triggers
        await this.checkPositionTriggers(position.id);
      }
    }
  }

  // Get position history for a symbol
  static async getPositionHistory(portfolioId: string, symbol: string, limit: number = 50): Promise<Position[]> {
    return db
      .select()
      .from(positions)
      .where(and(
        eq(positions.portfolioId, portfolioId),
        eq(positions.symbol, symbol)
      ))
      .orderBy(desc(positions.openedAt))
      .limit(limit);
  }
}
