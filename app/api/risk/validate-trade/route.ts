import { NextRequest, NextResponse } from 'next/server';
import { RiskManager } from '@/lib/risk-management';

// Initialize Risk Manager
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
    const { signal, symbol, positionSize, positions = [], balance = 10000 } = body;

    // Validate required fields
    if (!signal || !['BUY', 'SELL'].includes(signal.toUpperCase())) {
      return NextResponse.json(
        {
          error: true,
          message: 'Signal must be either BUY or SELL',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    if (!symbol || typeof symbol !== 'string') {
      return NextResponse.json(
        {
          error: true,
          message: 'Symbol is required and must be a string',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    if (typeof positionSize !== 'number' || positionSize <= 0) {
      return NextResponse.json(
        {
          error: true,
          message: 'Position size must be a positive number',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

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

    // Validate trade using risk manager
    const tradeAllowed = riskManager.shouldAllowTrade(
      signal.toUpperCase() as 'BUY' | 'SELL',
      symbol,
      positionSize,
      positions,
      balance
    );

    // Calculate risk score and adjusted position size
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
    const riskScore = Math.min(riskMetrics.portfolioRisk, 1.0);
    
    // Adjust position size based on risk
    let adjustedSize = positionSize;
    if (riskScore > 0.8) {
      adjustedSize = positionSize * 0.5; // Reduce size by 50% for high risk
    } else if (riskScore > 0.6) {
      adjustedSize = positionSize * 0.75; // Reduce size by 25% for medium risk
    }

    // Determine reason for decision
    let reason = 'Trade within risk limits';
    if (!tradeAllowed) {
      if (riskMetrics.totalExposure / balance > 0.9) {
        reason = 'Excessive portfolio exposure';
      } else if (positionSize > riskManager.config.maxPositionSize) {
        reason = 'Position size exceeds maximum limit';
      } else if (riskMetrics.portfolioRisk > riskManager.config.maxDrawdown) {
        reason = 'Portfolio risk too high';
      } else {
        reason = 'Trade violates risk management rules';
      }
    }

    // Return validation result
    return NextResponse.json({
      success: true,
      data: {
        allowed: tradeAllowed,
        reason,
        adjustedSize,
        riskScore,
        riskMetrics: {
          currentExposure: riskMetrics.totalExposure,
          portfolioRisk: riskMetrics.portfolioRisk,
          maxAllowedSize: riskManager.config.maxPositionSize
        }
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Trade Validation Error:', error);

    return NextResponse.json(
      {
        error: true,
        message: 'Internal server error during trade validation',
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
      message: 'Method not allowed. Use POST to validate trades.',
      code: 'METHOD_NOT_ALLOWED'
    },
    { status: 405 }
  );
}
