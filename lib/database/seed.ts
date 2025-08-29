import { db } from './connection';
import { UserService } from './services/user-service';
import { PortfolioService } from './services/portfolio-service';
import { PositionService } from './services/position-service';
import { MarketDataService } from './services/market-data-service';
import { 
  users, 
  portfolios, 
  positions, 
  marketData, 
  aiSignals, 
  tradingStrategies,
  systemHealthLogs
} from './schema';

export async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...');

  try {
    // Create demo user
    console.log('Creating demo user...');
    const demoUser = await UserService.createUser({
      email: 'demo@cryptotrader.com',
      username: 'demo_trader',
      passwordHash: 'demo123', // Will be hashed by UserService
      firstName: 'Demo',
      lastName: 'Trader',
      isVerified: true,
      preferences: {
        theme: 'dark',
        notifications: true,
        defaultPortfolio: null,
      },
    });

    console.log('✅ Demo user created:', demoUser.id);

    // Get the default portfolio created by UserService
    const portfolios = await PortfolioService.getUserPortfolios(demoUser.id);
    const defaultPortfolio = portfolios[0];

    if (defaultPortfolio) {
      console.log('Setting up demo portfolio...');
      
      // Update portfolio with demo data
      await PortfolioService.updatePortfolio(defaultPortfolio.id, {
        balance: '10000.00',
        totalValue: '12500.00',
        totalPnL: '2500.00',
        dailyPnL: '150.00',
      });

      // Create sample positions
      console.log('Creating sample positions...');
      
      const samplePositions = [
        {
          portfolioId: defaultPortfolio.id,
          symbol: 'BTC-USD',
          side: 'long' as const,
          size: '0.25',
          entryPrice: '45000.00',
          currentPrice: '47000.00',
        },
        {
          portfolioId: defaultPortfolio.id,
          symbol: 'ETH-USD',
          side: 'long' as const,
          size: '2.5',
          entryPrice: '3000.00',
          currentPrice: '3200.00',
        },
        {
          portfolioId: defaultPortfolio.id,
          symbol: 'ADA-USD',
          side: 'short' as const,
          size: '1000',
          entryPrice: '0.50',
          currentPrice: '0.48',
        },
      ];

      for (const positionData of samplePositions) {
        const position = await PositionService.createPosition(positionData);
        await PositionService.updatePositionPrice(position.id, Number(positionData.currentPrice));
      }

      console.log('✅ Sample positions created');
    }

    // Create sample market data
    console.log('Creating sample market data...');
    
    const symbols = ['BTC-USD', 'ETH-USD', 'ADA-USD', 'SOL-USD'];
    const basePrices = {
      'BTC-USD': 47000,
      'ETH-USD': 3200,
      'ADA-USD': 0.48,
      'SOL-USD': 100,
    };

    const now = new Date();
    const marketDataEntries = [];

    // Generate 24 hours of sample data (hourly)
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
      
      for (const symbol of symbols) {
        const basePrice = basePrices[symbol as keyof typeof basePrices];
        const variation = (Math.random() - 0.5) * 0.1; // ±5% variation
        const price = basePrice * (1 + variation);
        const volume = Math.random() * 1000000 + 100000;
        
        marketDataEntries.push({
          symbol,
          price: price.toString(),
          volume: volume.toString(),
          change: (price - basePrice).toString(),
          changePercent: ((price - basePrice) / basePrice * 100).toString(),
          high24h: (price * 1.05).toString(),
          low24h: (price * 0.95).toString(),
          bid: (price - Math.random() * 10).toString(),
          ask: (price + Math.random() * 10).toString(),
          timestamp,
        });
      }
    }

    await MarketDataService.bulkInsertMarketData(marketDataEntries);
    console.log('✅ Sample market data created');

    // Create sample AI signals
    console.log('Creating sample AI signals...');
    
    const sampleSignals = [
      {
        userId: demoUser.id,
        symbol: 'BTC-USD',
        signal: 'BUY' as const,
        confidence: '0.85',
        reasoning: 'Technical analysis shows strong bullish momentum with RSI oversold conditions and volume confirmation.',
        entryPrice: '46500.00',
        stopLoss: '44000.00',
        takeProfit: '50000.00',
        riskReward: '1.4',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      {
        userId: demoUser.id,
        symbol: 'ETH-USD',
        signal: 'HOLD' as const,
        confidence: '0.65',
        reasoning: 'Market consolidation phase with mixed signals. Recommend waiting for clearer directional bias.',
        entryPrice: '3200.00',
        stopLoss: '3000.00',
        takeProfit: '3500.00',
        riskReward: '1.5',
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
    ];

    await db.insert(aiSignals).values(sampleSignals);
    console.log('✅ Sample AI signals created');

    // Create sample trading strategies
    console.log('Creating sample trading strategies...');
    
    const sampleStrategies = [
      {
        userId: demoUser.id,
        name: 'BTC Momentum Strategy',
        description: 'Momentum-based strategy for Bitcoin trading',
        strategyType: 'momentum',
        parameters: {
          period: 14,
          threshold: 0.02,
          stopLoss: 0.05,
          takeProfit: 0.08,
        },
        totalTrades: 45,
        winningTrades: 31,
        totalPnL: '1250.50',
        maxDrawdown: '8.5',
        sharpeRatio: '1.45',
        lastExecutedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        userId: demoUser.id,
        name: 'ETH Mean Reversion',
        description: 'Mean reversion strategy for Ethereum',
        strategyType: 'mean_reversion',
        parameters: {
          lookbackPeriod: 20,
          threshold: 2.0,
          stopLoss: 0.03,
          takeProfit: 0.06,
        },
        totalTrades: 32,
        winningTrades: 23,
        totalPnL: '890.25',
        maxDrawdown: '6.2',
        sharpeRatio: '1.72',
        lastExecutedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    ];

    await db.insert(tradingStrategies).values(sampleStrategies);
    console.log('✅ Sample trading strategies created');

    // Create sample system health logs
    console.log('Creating sample system health logs...');
    
    const healthLogs = [];
    for (let i = 0; i < 24; i++) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
      
      healthLogs.push({
        apiStatus: 'online' as const,
        websocketStatus: 'connected' as const,
        latency: Math.floor(Math.random() * 100) + 50,
        errorRate: Math.random() * 0.01,
        uptime: 86400 + (i * 3600),
        memoryUsage: Math.floor(Math.random() * 1000) + 500,
        cpuUsage: Math.random() * 80 + 10,
        activeConnections: Math.floor(Math.random() * 100) + 20,
        timestamp,
      });
    }

    await db.insert(systemHealthLogs).values(healthLogs);
    console.log('✅ Sample system health logs created');

    // Update portfolio metrics
    await PortfolioService.updatePortfolioMetrics(defaultPortfolio.id);
    console.log('✅ Portfolio metrics updated');

    console.log('🎉 Database seeding completed successfully!');
    
    return {
      demoUser,
      defaultPortfolio,
      message: 'Database seeded with demo data',
    };

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase()
    .then((result) => {
      console.log('Seeding completed:', result.message);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}
