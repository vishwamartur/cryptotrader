import { eq, and, desc, sum, sql } from 'drizzle-orm';
import { db } from '../connection';
import { 
  portfolios, 
  positions, 
  orders,
  type Portfolio, 
  type NewPortfolio, 
  type Position,
  type Order
} from '../schema';

export class PortfolioService {
  // Create a new portfolio
  static async createPortfolio(portfolioData: Omit<NewPortfolio, 'id' | 'createdAt' | 'updatedAt'>): Promise<Portfolio> {
    const [portfolio] = await db.insert(portfolios).values(portfolioData).returning();
    return portfolio;
  }

  // Get portfolio by ID
  static async getPortfolioById(id: string): Promise<Portfolio | null> {
    const [portfolio] = await db.select().from(portfolios).where(eq(portfolios.id, id));
    return portfolio || null;
  }

  // Get user portfolios
  static async getUserPortfolios(userId: string): Promise<Portfolio[]> {
    return db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.userId, userId), eq(portfolios.isActive, true)))
      .orderBy(desc(portfolios.createdAt));
  }

  // Get portfolio with positions
  static async getPortfolioWithPositions(id: string): Promise<(Portfolio & { positions: Position[] }) | null> {
    const portfolio = await this.getPortfolioById(id);
    if (!portfolio) return null;

    const portfolioPositions = await db
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, id), eq(positions.isActive, true)))
      .orderBy(desc(positions.openedAt));

    return {
      ...portfolio,
      positions: portfolioPositions,
    };
  }

  // Update portfolio
  static async updatePortfolio(id: string, updates: Partial<Omit<Portfolio, 'id' | 'createdAt'>>): Promise<Portfolio | null> {
    const [updatedPortfolio] = await db
      .update(portfolios)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(portfolios.id, id))
      .returning();
    
    return updatedPortfolio || null;
  }

  // Calculate and update portfolio metrics
  static async updatePortfolioMetrics(portfolioId: string): Promise<void> {
    // Get all active positions
    const activePositions = await db
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, portfolioId), eq(positions.isActive, true)));

    // Calculate total value and P&L
    let totalValue = 0;
    let totalPnL = 0;
    let dailyPnL = 0;

    for (const position of activePositions) {
      const positionValue = Number(position.currentPrice) * Number(position.size);
      const positionPnL = Number(position.unrealizedPnL);
      
      totalValue += positionValue;
      totalPnL += positionPnL;
      
      // For daily P&L, we'd need to track daily changes
      // This is a simplified calculation
      dailyPnL += positionPnL * 0.1; // Assume 10% of total P&L is daily
    }

    // Get portfolio balance
    const portfolio = await this.getPortfolioById(portfolioId);
    if (portfolio) {
      totalValue += Number(portfolio.balance);
    }

    // Update portfolio metrics
    await db
      .update(portfolios)
      .set({
        totalValue: totalValue.toString(),
        totalPnL: totalPnL.toString(),
        dailyPnL: dailyPnL.toString(),
        updatedAt: new Date(),
      })
      .where(eq(portfolios.id, portfolioId));
  }

  // Get portfolio performance summary
  static async getPortfolioPerformance(portfolioId: string, days: number = 30) {
    const portfolio = await this.getPortfolioById(portfolioId);
    if (!portfolio) return null;

    // Get recent orders for performance calculation
    const recentOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.portfolioId, portfolioId),
          eq(orders.status, 'filled'),
          sql`${orders.filledAt} >= NOW() - INTERVAL '${days} days'`
        )
      )
      .orderBy(desc(orders.filledAt));

    // Calculate win rate
    const profitableOrders = recentOrders.filter(order => {
      // This is simplified - in reality you'd compare entry/exit prices
      return Number(order.filledPrice) > Number(order.price);
    });

    const winRate = recentOrders.length > 0 ? (profitableOrders.length / recentOrders.length) * 100 : 0;

    // Calculate total fees
    const totalFees = recentOrders.reduce((sum, order) => sum + Number(order.fees), 0);

    return {
      portfolio,
      totalOrders: recentOrders.length,
      profitableOrders: profitableOrders.length,
      winRate,
      totalFees,
      averageLatency: recentOrders.length > 0 
        ? recentOrders.reduce((sum, order) => sum + (order.latency || 0), 0) / recentOrders.length 
        : 0,
    };
  }

  // Get portfolio allocation
  static async getPortfolioAllocation(portfolioId: string) {
    const activePositions = await db
      .select()
      .from(positions)
      .where(and(eq(positions.portfolioId, portfolioId), eq(positions.isActive, true)));

    const totalValue = activePositions.reduce((sum, pos) => 
      sum + (Number(pos.currentPrice) * Number(pos.size)), 0
    );

    const allocation = activePositions.map(position => {
      const positionValue = Number(position.currentPrice) * Number(position.size);
      const percentage = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;
      
      return {
        symbol: position.symbol,
        value: positionValue,
        percentage,
        size: Number(position.size),
        unrealizedPnL: Number(position.unrealizedPnL),
        unrealizedPnLPercent: Number(position.unrealizedPnLPercent),
      };
    });

    return {
      totalValue,
      allocation: allocation.sort((a, b) => b.percentage - a.percentage),
    };
  }

  // Delete portfolio (soft delete)
  static async deletePortfolio(id: string): Promise<boolean> {
    // First, close all active positions
    await db
      .update(positions)
      .set({ isActive: false, closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(positions.portfolioId, id), eq(positions.isActive, true)));

    // Then deactivate the portfolio
    const [updatedPortfolio] = await db
      .update(portfolios)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(portfolios.id, id))
      .returning();
    
    return !!updatedPortfolio;
  }

  // Get portfolio statistics
  static async getPortfolioStats(portfolioId: string) {
    const [stats] = await db
      .select({
        totalPositions: sql<number>`COUNT(${positions.id})`,
        activePositions: sql<number>`COUNT(CASE WHEN ${positions.isActive} = true THEN 1 END)`,
        totalOrders: sql<number>`(SELECT COUNT(*) FROM ${orders} WHERE ${orders.portfolioId} = ${portfolioId})`,
        filledOrders: sql<number>`(SELECT COUNT(*) FROM ${orders} WHERE ${orders.portfolioId} = ${portfolioId} AND ${orders.status} = 'filled')`,
      })
      .from(positions)
      .where(eq(positions.portfolioId, portfolioId));

    return stats;
  }

  // Update portfolio balance
  static async updateBalance(portfolioId: string, newBalance: number): Promise<boolean> {
    const [updatedPortfolio] = await db
      .update(portfolios)
      .set({ 
        balance: newBalance.toString(), 
        updatedAt: new Date() 
      })
      .where(eq(portfolios.id, portfolioId))
      .returning();
    
    if (updatedPortfolio) {
      // Recalculate portfolio metrics
      await this.updatePortfolioMetrics(portfolioId);
      return true;
    }
    
    return false;
  }
}
