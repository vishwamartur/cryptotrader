import { NextRequest, NextResponse } from 'next/server';
import { RiskManager } from '@/lib/risk-management';

// Initialize Risk Manager with default settings
const riskManager = new RiskManager({
  maxPortfolioRisk: 10,
  maxPositionSize: 10000,
  maxDailyLoss: 1000,
  maxDrawdown: 0.15,
  maxOpenPositions: 10,
  correlationLimit: 0.7,
  riskPerTrade: 0.02
});

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { positions = [], balance = 10000 } = body;

    // Validate positions array
    if (!Array.isArray(positions)) {
      return NextResponse.json(
        {
          error: true,
          message: 'Positions must be an array',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Validate balance
    if (typeof balance !== 'number' || balance <= 0) {
      return NextResponse.json(
        {
          error: true,
          message: 'Balance must be a positive number',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Calculate risk metrics
    // Mock market data for risk calculation
    const mockMarketData = positions.map(pos => ({
      symbol: pos.product?.symbol || 'UNKNOWN',
      price: parseFloat(pos.mark_price || '0'),
      change: 0,
      changePercent: 0,
      volume: 0,
      high24h: 0,
      low24h: 0,
      lastUpdated: new Date()
    }));

    const riskMetrics = riskManager.calculateRiskMetrics(positions, balance, mockMarketData);

    // Return successful response
    return NextResponse.json({
      success: true,
      data: riskMetrics,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Risk Metrics Calculation Error:', error);

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error during risk calculation',
        code: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle unsupported methods
export async function GET() {
  return NextResponse.json(
    {
      error: true,
      message: 'Method not allowed. Use POST to calculate risk metrics.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
