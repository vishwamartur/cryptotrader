import { NextRequest, NextResponse } from 'next/server';
import { PortfolioService } from '@/lib/database/services/portfolio-service';
import { UserService } from '@/lib/database/services/user-service';

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params or use demo user
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const portfolioId = searchParams.get('portfolioId');
    
    let portfolioData;
    
    if (portfolioId) {
      // Get specific portfolio by ID
      const portfolioWithPositions = await PortfolioService.getPortfolioWithPositions(portfolioId);
      
      if (!portfolioWithPositions) {
        return NextResponse.json({
          success: false,
          error: 'Portfolio not found',
          timestamp: new Date().toISOString()
        }, { status: 404 });
      }
      
      portfolioData = formatPortfolioData(portfolioWithPositions);
      
    } else if (userId) {
      // Get user's portfolios from database
      const portfolios = await PortfolioService.getUserPortfolios(userId);
      
      if (portfolios.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No portfolios found for user',
          timestamp: new Date().toISOString()
        }, { status: 404 });
      }
      
      // Get the first portfolio with positions
      const portfolioWithPositions = await PortfolioService.getPortfolioWithPositions(portfolios[0].id);
      
      if (!portfolioWithPositions) {
        return NextResponse.json({
          success: false,
          error: 'Portfolio not found',
          timestamp: new Date().toISOString()
        }, { status: 404 });
      }
      
      portfolioData = formatPortfolioData(portfolioWithPositions);
      
    } else {
      // Try to get demo user data
      const demoUser = await UserService.getUserByEmail('demo@cryptotrader.com');
      
      if (demoUser) {
        const portfolios = await PortfolioService.getUserPortfolios(demoUser.id);
        
        if (portfolios.length > 0) {
          const portfolioWithPositions = await PortfolioService.getPortfolioWithPositions(portfolios[0].id);
          
          if (portfolioWithPositions) {
            portfolioData = formatPortfolioData(portfolioWithPositions);
          }
        }
      }
      
      // Fallback to mock data if no database data available
      if (!portfolioData) {
        portfolioData = {
          totalValue: 12500.00,
          totalPnL: 2500.00,
          dailyPnL: 150.00,
          positions: [
            {
              symbol: 'BTC-USD',
              size: 0.25,
              entryPrice: 45000,
              currentPrice: 47000,
              unrealizedPnL: 500,
              unrealizedPnLPercent: 4.44,
              side: 'long'
            },
            {
              symbol: 'ETH-USD',
              size: 2.5,
              entryPrice: 3000,
              currentPrice: 3200,
              unrealizedPnL: 500,
              unrealizedPnLPercent: 6.67,
              side: 'long'
            }
          ],
          balance: 10000.00,
          timestamp: Date.now()
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: portfolioData,
      source: portfolioData.id ? 'database' : 'mock',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Portfolio status error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch portfolio status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Helper function to format portfolio data
function formatPortfolioData(portfolioWithPositions: any) {
  return {
    id: portfolioWithPositions.id,
    name: portfolioWithPositions.name,
    description: portfolioWithPositions.description,
    totalValue: Number(portfolioWithPositions.totalValue),
    totalPnL: Number(portfolioWithPositions.totalPnL),
    dailyPnL: Number(portfolioWithPositions.dailyPnL),
    balance: Number(portfolioWithPositions.balance),
    positions: portfolioWithPositions.positions.map((pos: any) => ({
      id: pos.id,
      symbol: pos.symbol,
      size: Number(pos.size),
      entryPrice: Number(pos.entryPrice),
      currentPrice: Number(pos.currentPrice),
      unrealizedPnL: Number(pos.unrealizedPnL),
      unrealizedPnLPercent: Number(pos.unrealizedPnLPercent),
      side: pos.side,
      openedAt: pos.openedAt,
      stopLoss: pos.stopLoss ? Number(pos.stopLoss) : null,
      takeProfit: pos.takeProfit ? Number(pos.takeProfit) : null,
      isActive: pos.isActive,
    })),
    createdAt: portfolioWithPositions.createdAt,
    updatedAt: portfolioWithPositions.updatedAt,
    timestamp: portfolioWithPositions.updatedAt?.getTime() || Date.now()
  };
}

// Create a new portfolio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name, description, initialBalance } = body;
    
    if (!userId || !name) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, name',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    // Verify user exists
    const user = await UserService.getUserById(userId);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
    // Create portfolio
    const portfolio = await PortfolioService.createPortfolio({
      userId,
      name,
      description: description || '',
      balance: initialBalance ? initialBalance.toString() : '0',
    });
    
    return NextResponse.json({
      success: true,
      data: {
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        balance: Number(portfolio.balance),
        totalValue: Number(portfolio.totalValue),
        createdAt: portfolio.createdAt,
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Portfolio creation error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to create portfolio',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// Update portfolio
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { portfolioId, name, description, balance } = body;
    
    if (!portfolioId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: portfolioId',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (balance !== undefined) updates.balance = balance.toString();
    
    const updatedPortfolio = await PortfolioService.updatePortfolio(portfolioId, updates);
    
    if (!updatedPortfolio) {
      return NextResponse.json({
        success: false,
        error: 'Portfolio not found',
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: updatedPortfolio.id,
        name: updatedPortfolio.name,
        description: updatedPortfolio.description,
        balance: Number(updatedPortfolio.balance),
        totalValue: Number(updatedPortfolio.totalValue),
        updatedAt: updatedPortfolio.updatedAt,
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Portfolio update error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update portfolio',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
