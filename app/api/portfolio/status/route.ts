import { NextRequest, NextResponse } from 'next/server';

// Mock portfolio data for demonstration
// In a real implementation, this would come from a database
const mockPortfolioData = {
  totalValue: 12500,
  totalPnL: 2500,
  dailyPnL: 150,
  positions: [
    {
      symbol: 'BTC-USD',
      size: 0.5,
      value: 22500,
      pnl: 500,
      percentage: 18.0,
      entryPrice: 44000,
      currentPrice: 45000,
      unrealizedPnL: 500,
      realizedPnL: 0
    },
    {
      symbol: 'ETH-USD',
      size: 2.0,
      value: 6000,
      pnl: 200,
      percentage: 4.8,
      entryPrice: 2900,
      currentPrice: 3000,
      unrealizedPnL: 200,
      realizedPnL: 0
    },
    {
      symbol: 'ADA-USD',
      size: 1000,
      value: 500,
      pnl: -50,
      percentage: 0.4,
      entryPrice: 0.55,
      currentPrice: 0.50,
      unrealizedPnL: -50,
      realizedPnL: 0
    }
  ],
  allocation: {
    'BTC-USD': 0.18,
    'ETH-USD': 0.048,
    'ADA-USD': 0.004,
    'cash': 0.768
  },
  performance: {
    totalReturn: 25.0,
    dailyReturn: 1.2,
    weeklyReturn: 5.8,
    monthlyReturn: 18.5,
    sharpeRatio: 1.45,
    maxDrawdown: 8.2,
    volatility: 0.25,
    winRate: 0.68
  },
  riskMetrics: {
    portfolioRisk: 0.15,
    valueAtRisk: 1250,
    expectedShortfall: 1875,
    beta: 1.1,
    correlation: 0.85
  }
};

export async function GET(request: NextRequest) {
  try {
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('includeHistory') === 'true';
    const includeRisk = searchParams.get('includeRisk') === 'true';
    const symbol = searchParams.get('symbol');

    // Base portfolio data
    let portfolioData = { ...mockPortfolioData };

    // Filter by symbol if requested
    if (symbol) {
      portfolioData.positions = portfolioData.positions.filter(
        pos => pos.symbol.toLowerCase() === symbol.toLowerCase()
      );
      
      if (portfolioData.positions.length === 0) {
        return NextResponse.json(
          {
            error: true,
            message: `No position found for symbol: ${symbol}`,
            code: 'POSITION_NOT_FOUND'
          },
          { status: 404 }
        );
      }
    }

    // Add historical data if requested
    if (includeHistory) {
      portfolioData = {
        ...portfolioData,
        history: {
          portfolioValues: generateMockHistory(portfolioData.totalValue, 30),
          dailyReturns: generateMockReturns(30),
          drawdownHistory: generateMockDrawdown(30)
        }
      };
    }

    // Remove risk metrics if not requested
    if (!includeRisk) {
      delete (portfolioData as any).riskMetrics;
    }

    // Calculate additional metrics
    const enhancedData = {
      ...portfolioData,
      summary: {
        totalPositions: portfolioData.positions.length,
        profitablePositions: portfolioData.positions.filter(p => p.pnl > 0).length,
        largestPosition: portfolioData.positions.reduce((max, pos) => 
          pos.percentage > max.percentage ? pos : max, portfolioData.positions[0]
        ),
        totalUnrealizedPnL: portfolioData.positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0),
        totalRealizedPnL: portfolioData.positions.reduce((sum, pos) => sum + pos.realizedPnL, 0)
      },
      lastUpdated: Date.now()
    };

    return NextResponse.json({
      success: true,
      data: enhancedData,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Portfolio Status Error:', error);

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error while fetching portfolio status',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to generate mock historical data
function generateMockHistory(currentValue: number, days: number): number[] {
  const history = [];
  let value = currentValue * 0.8; // Start 20% lower
  
  for (let i = 0; i < days; i++) {
    const change = (Math.random() - 0.5) * 0.05; // ±2.5% daily change
    value *= (1 + change);
    history.push(Math.round(value * 100) / 100);
  }
  
  return history;
}

// Helper function to generate mock returns
function generateMockReturns(days: number): number[] {
  const returns = [];
  
  for (let i = 0; i < days; i++) {
    const dailyReturn = (Math.random() - 0.5) * 0.1; // ±5% daily return
    returns.push(Math.round(dailyReturn * 10000) / 100); // Convert to percentage
  }
  
  return returns;
}

// Helper function to generate mock drawdown data
function generateMockDrawdown(days: number): number[] {
  const drawdown = [];
  let currentDrawdown = 0;
  
  for (let i = 0; i < days; i++) {
    const change = Math.random() * 0.02; // Up to 2% change
    if (Math.random() > 0.7) {
      currentDrawdown = Math.max(0, currentDrawdown - change); // Recovery
    } else {
      currentDrawdown = Math.min(0.15, currentDrawdown + change); // Drawdown
    }
    drawdown.push(Math.round(currentDrawdown * 10000) / 100);
  }
  
  return drawdown;
}

// Handle unsupported methods
export async function POST() {
  return NextResponse.json(
    {
      error: true,
      message: 'Method not allowed. Use GET to fetch portfolio status.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
